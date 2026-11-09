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
  var mode = get("mode") || (pagina === "organizzatore" ? "org" : "");
  var baseUrl = window.location.origin + window.location.pathname;

  var config = {
    uuid: get("uuid"),
    mode: mode,
    pagina: pagina,
    masterToken: get("masterToken") || get("mt"),
    masterId: get("masterId") || get("mid"),
    sedeId: get("sedeId") || get("sid"),
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
    // "fetch" | "jsonp" | "" (auto: jsonp se l'endpoint è cross-origin)
    transport: "",
    timeoutMs: 30000
  };

  window.GILDA_CONFIG = Object.assign(config, window.GILDA_CONFIG || {});
})();
