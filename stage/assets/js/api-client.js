/*
 * Client del backend del portale.
 *
 * Espone:
 *   window.gildaApi.call(method, args) -> Promise
 *   window.gildaApi.getToken() / setToken() / clearToken()
 *   window.google.script.run            (shim di compatibilità)
 *
 * Il monolite legacy chiamava il backend con `google.script.run` (159 punti di
 * chiamata). Lo shim mantiene quella sintassi — `.withSuccessHandler(fn)
 * .withFailureHandler(fn).nomeMetodo(arg…)` — traducendola in una chiamata
 * HTTP, così il codice applicativo resta invariato durante la migrazione.
 *
 * Protocollo:
 *   POST {apiUrl}  Content-Type: text/plain
 *   body: {"method":"…","args":[…],"token":"…"}
 *   risposta: {"__gilda":1,"ok":true,"result":…} | {"__gilda":1,"ok":false,"error":"…","code":"…"}
 *
 * Per endpoint cross-origin (backend Apps Script, che non espone header CORS)
 * si usa automaticamente JSONP:
 *   GET {apiUrl}?action=…&args=<json>&token=…&callback=…
 *
 * Sessione: il backend emette un token al login (`verificaPasswordOrg`).
 * Il token viene salvato in sessionStorage e allegato a ogni richiesta; se il
 * backend risponde `code: "AUTH"` viene scartato e l'app riceve l'evento
 * `gilda:auth-expired`.
 */
(function () {
  "use strict";

  var cfg = window.GILDA_CONFIG || (window.GILDA_CONFIG = {});
  var TOKEN_KEY = "gilda.api.token";
  var sequence = 0;

  // ── Sessione ────────────────────────────────────────────────────────────
  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function setToken(token) {
    var value = String(token || "").trim();
    if (!value) return clearToken();
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch (err) {
      /* storage non disponibile: il token resta solo in memoria */
      memoryToken = value;
    }
    return value;
  }

  var memoryToken = "";

  function readToken() {
    return getToken() || memoryToken;
  }

  function clearToken() {
    memoryToken = "";
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      /* niente da fare */
    }
  }

  // ── Trasporto ───────────────────────────────────────────────────────────
  function endpoint() {
    if (cfg.apiUrl) return String(cfg.apiUrl);
    return window.location.origin + "/api/run";
  }

  function isCrossOrigin(url) {
    try {
      return new URL(url, window.location.href).origin !== window.location.origin;
    } catch (err) {
      return false;
    }
  }

  function useJsonp() {
    if (cfg.transport === "jsonp") return true;
    if (cfg.transport === "fetch") return false;
    return isCrossOrigin(endpoint());
  }

  function toError(payload, fallback) {
    var message = (payload && (payload.error || payload.errore || payload.message)) || fallback;
    var error = new Error(message);
    if (payload && payload.code) error.code = payload.code;
    if (payload && payload.stack) error.stack = payload.stack;
    return error;
  }

  function unwrap(data) {
    if (data && typeof data === "object" && data.__gilda) {
      if (data.ok === false) throw toError(data, "Errore dal backend");
      if (data.result && typeof data.result === "object" && data.result.token) {
        setToken(data.result.token);
      }
      return data.result;
    }
    return data;
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  }

  function handleFailure(err) {
    if (err && err.code === "AUTH") {
      clearToken();
      try {
        window.dispatchEvent(new CustomEvent("gilda:auth-expired", { detail: { message: err.message } }));
      } catch (e) {
        /* CustomEvent non disponibile: ignora */
      }
    }
    throw err;
  }

  function fetchCall(method, args) {
    var timeout = Number(cfg.timeoutMs) || 30000;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : null;

    return fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ method: method, args: args || [], token: readToken() }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        return response.text().then(function (text) {
          if (!response.ok) throw toError(safeParse(text), "HTTP " + response.status);
          return unwrap(safeParse(text));
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") throw new Error("Richiesta scaduta (" + timeout + " ms)");
        throw err;
      })
      .then(
        function (result) { return result; },
        function (err) { return handleFailure(err); }
      )
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function jsonpCall(method, args) {
    return new Promise(function (resolve, reject) {
      var timeout = Number(cfg.timeoutMs) || 30000;
      var callbackName = "__gildaJsonp" + Date.now() + "_" + ++sequence;
      var script = document.createElement("script");
      var timer = null;
      var done = false;

      function cleanup() {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        try { delete window[callbackName]; } catch (err) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (payload) {
        cleanup();
        try {
          resolve(unwrap(payload));
        } catch (err) {
          try {
            handleFailure(err);
          } catch (rethrown) {
            reject(rethrown);
          }
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Impossibile contattare il backend (" + endpoint() + ")"));
      };

      timer = setTimeout(function () {
        cleanup();
        reject(new Error("Richiesta scaduta (" + timeout + " ms)"));
      }, timeout);

      var url = endpoint() + (endpoint().indexOf("?") === -1 ? "?" : "&");
      script.src =
        url +
        "action=" + encodeURIComponent(method) +
        "&callback=" + encodeURIComponent(callbackName) +
        "&args=" + encodeURIComponent(JSON.stringify(args || [])) +
        "&token=" + encodeURIComponent(readToken());
      document.head.appendChild(script);
    });
  }

  function call(method, args) {
    if (!method) return Promise.reject(new Error("Metodo backend mancante"));
    return useJsonp() ? jsonpCall(method, args || []) : fetchCall(method, args || []);
  }

  window.gildaApi = {
    call: call,
    endpoint: endpoint,
    transport: function () { return useJsonp() ? "jsonp" : "fetch"; },
    getToken: readToken,
    setToken: setToken,
    clearToken: clearToken
  };

  // ── Shim google.script.run ───────────────────────────────────────────────
  // Ogni accesso a `google.script.run` crea una catena nuova, con handler
  // isolati: stesso comportamento del runtime Apps Script.
  function createChain() {
    var state = { success: null, failure: null };
    var target = {};

    var proxy = new Proxy(target, {
      get: function (obj, prop) {
        if (prop === "withSuccessHandler") {
          return function (fn) { state.success = fn; return proxy; };
        }
        if (prop === "withFailureHandler") {
          return function (fn) { state.failure = fn; return proxy; };
        }
        if (prop in obj) return obj[prop];
        if (typeof prop === "string" && prop.charAt(0) !== "_") {
          return function () {
            var args = Array.prototype.slice.call(arguments);
            var onSuccess = state.success;
            var onFailure = state.failure;
            call(prop, args).then(
              function (result) { if (onSuccess) onSuccess(result); },
              function (err) { if (onFailure) onFailure(err); }
            );
          };
        }
        return undefined;
      }
    });

    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, "run", {
    configurable: true,
    get: function () { return createChain(); }
  });
})();
