/*
 * Sessione lato client.
 *
 * - Cancella il token API al logout (organizzatore e accoglienza).
 * - Alla scadenza della sessione riporta l'utente alla schermata di accesso.
 *
 * Va caricato dopo app.js: aggancia le funzioni globali già definite.
 */
(function () {
  "use strict";

  function clearToken() {
    try {
      if (window.gildaApi && window.gildaApi.clearToken) window.gildaApi.clearToken();
    } catch (err) {
      /* niente da fare */
    }
  }

  function wrapLogout(nome) {
    var originale = window[nome];
    if (typeof originale !== "function" || originale.__gildaWrapped) return;
    var wrapper = function () {
      clearToken();
      return originale.apply(this, arguments);
    };
    wrapper.__gildaWrapped = true;
    window[nome] = wrapper;
  }

  function onReady() {
    wrapLogout("logoutOrg");
    wrapLogout("accLogout");

    window.addEventListener("gilda:auth-expired", function (event) {
      var messaggio = (event && event.detail && event.detail.message) || "Sessione scaduta. Accedi di nuovo.";
      var err = document.getElementById("org-err");
      if (err) err.textContent = "⚠️ " + messaggio;
      if (typeof window.logoutOrg === "function") window.logoutOrg();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
