/*
 * Applica la configurazione runtime al markup statico.
 *
 * Il markup in index.html è lo stesso per tutti i ruoli: le parti riservate
 * all'organizzatore sono presenti ma nascoste inline (`[data-org-only]`) e
 * vengono mostrate qui quando `mode === "org"`. Va caricato dopo config.js e
 * prima di app.js, così il suo listener DOMContentLoaded gira per primo.
 */
(function () {
  "use strict";

  function apply() {
    var cfg = window.GILDA_CONFIG || {};
    var mode = String(cfg.mode || "").toLowerCase();
    var isOrg = mode === "org";
    var orgNome = cfg.orgNome || "Gilda dei Dadi";

    if (isOrg) {
      document.body.classList.add("mode-org");
      document.querySelectorAll("[data-org-only]").forEach(function (el) {
        el.style.display = "";
      });
      var app = document.getElementById("app");
      if (app) app.classList.add("wide");
    }

    document.querySelectorAll("[data-org-name]").forEach(function (el) {
      el.textContent = orgNome;
    });

    if (cfg.headerImageUrl) {
      var logo = document.getElementById("h-logo");
      if (logo) logo.src = cfg.headerImageUrl;
      document
        .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
        .forEach(function (link) { link.href = cfg.headerImageUrl; });
    }

    if (cfg.inviteToken) {
      var tokenEl = document.getElementById("gilda-invite-token-json");
      if (tokenEl) tokenEl.textContent = JSON.stringify(String(cfg.inviteToken));
    }

    if (!document.title || document.title === orgNome) {
      document.title = (isOrg ? "Dashboard organizzatore" : "Prenotazioni") + " · " + orgNome;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
