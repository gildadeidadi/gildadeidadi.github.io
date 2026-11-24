/*
 * Configurazione runtime del portale.
 *
 * Deve essere caricato PRIMA di api-client.js e app.js: i valori qui sotto
 * sostituiscono quelli che nel monolite arrivavano dal template Apps Script
 * (`<?= uuid ?>`, `<?= mode ?>`, …).
 *
 * Ordine di caricamento in index.html:
 *   1. config.js      ← default derivati dalla query string
 *   2. /api/config.js ← override forniti dal backend (se disponibile)
 *   3. api-client.js
 *   4. bootstrap.js
 *   5. app.js
 *
 * Parametri di query riconosciuti:
 *   ?uuid=…            area utente / invito
 *   ?pagina=…          prenotazione | utente | feedback | organizzatore | accoglienza | master | partner
 *   ?mode=org          forza la vista organizzatore
 *   ?masterToken=…&masterId=…
 *   ?sedeId=…
 *   ?token=…           token invito co-prenotante
 *   ?evento=…&sessione=…  parametri del modulo feedback
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var get = function (key) {
    var value = params.get(key);
    return value === null ? "" : String(value).trim();
  };

  var pagina = get("pagina");
  var baseUrl = window.location.origin + window.location.pathname;
  var redirect = "";

  // Pagine separate (GitHub Pages): ogni cartella ha <html data-pagina="…">.
  // I link con ?pagina=… (email, WordPress) vengono portati alla cartella giusta.
  var paginaFile = document.documentElement.getAttribute("data-pagina") || "";
  if (paginaFile) {
    var cartelle = {
      prenotazione: "", utente: "utente", organizzatore: "organizzatore", master: "master",
      partner: "partner", sede: "partner", accoglienza: "accoglienza", feedback: "feedback"
    };
    var qui = paginaFile === "prenotazione" ? "" : paginaFile;
    var root = window.location.pathname.replace(/[^/]*$/, "");
    if (qui) root = root.replace(/[^/]+\/$/, "");
    baseUrl = window.location.origin + root;

    // Stesse regole di paginaFile() in pack-gas-ui.js; sulle sottopagine conta solo ?pagina=.
    var richiesta = pagina.toLowerCase();
    if (!richiesta && !qui) {
      if (get("mode") === "org") richiesta = "organizzatore";
      else if (get("masterId") || get("mid") || get("master")) richiesta = "master";
      else if (get("sedeId") || get("sid") || get("sede")) richiesta = "partner";
      else if (get("uuid")) richiesta = "utente";
    }
    if (Object.prototype.hasOwnProperty.call(cartelle, richiesta) && cartelle[richiesta] !== qui) {
      var dest = cartelle[richiesta];
      redirect = window.location.origin + root + (dest ? dest + "/" : "") + window.location.search + window.location.hash;
    }
    if (!pagina && qui) pagina = qui;
  }
  var mode = get("mode") || (pagina === "organizzatore" ? "org" : "");

  var config = {
    uuid: get("uuid"),
    mode: mode,
    pagina: pagina,
    otp: get("otp") || get("codice"),
    masterToken: get("masterToken") || get("mt"),
    masterId: get("masterId") || get("mid"),
    sedeId: get("sedeId") || get("sid") || get("sede") ||
      ((pagina === "partner" || pagina === "sede") ? get("uuid") : ""),
    inviteToken: get("token") || get("invite"),
    buildId: "",
    orgNome: "Gilda dei Dadi",
    headerImageUrl: "",
    headerBackgroundImageUrl: "",
    webappUrlUtente: baseUrl,
    webappUrlMaster: baseUrl,
    webappUrlSede: baseUrl,
    feedbackParams: { evento: get("evento"), sessione: get("sessione") },
    // Endpoint del backend. Vuoto = stesso origin, path /api/run.
    apiUrl: "",
    // "fetch" (default) | "gas" (pagina servita da Apps Script, google.script.run)
    transport: "",
    timeoutMs: 30000,
    redirecting: redirect
  };

  window.GILDA_CONFIG = Object.assign(config, window.GILDA_CONFIG || {});
  if (redirect) window.location.replace(redirect);
})();
