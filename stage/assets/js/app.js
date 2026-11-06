/* Generato da dev/scripts/migrate-webapp.js — logica del portale. */
/* Configurazione runtime: sostituisce i valori che prima erano template Apps Script. */
const APP_CONFIG = window.GILDA_CONFIG || {};
const UUID = String(APP_CONFIG.uuid || "");
const MODE = String(APP_CONFIG.mode || "");
const PAGINA = String(APP_CONFIG.pagina || "");
const FEEDBACK_PARAMS = APP_CONFIG.feedbackParams || { evento: "", sessione: "" };
const MASTER_TOKEN = String(APP_CONFIG.masterToken || "");
const MASTER_ID = String(APP_CONFIG.masterId || "");
const SEDE_ID = String(APP_CONFIG.sedeId || "");
const BUILD_ID = String(APP_CONFIG.buildId || "");
const ORG_NOME = String(APP_CONFIG.orgNome || "Gilda dei Dadi");
const WEBAPP_URL_UTENTE = String(APP_CONFIG.webappUrlUtente || (location.origin + location.pathname));
const WEBAPP_URL_MASTER = String(APP_CONFIG.webappUrlMaster || (location.origin + location.pathname));
const WEBAPP_URL_SEDE = String(APP_CONFIG.webappUrlSede || (location.origin + location.pathname));
const HEADER_BACKGROUND_IMAGE_URL = String(APP_CONFIG.headerBackgroundImageUrl || "");
let FASCE_ETA = [];

/** Titolo tab browser: "Sezione · Organizzazione" */
function setAppTitle(section) {
 const org = String(ORG_NOME || "Gilda dei Dadi").trim() || "Gilda dei Dadi";
 document.title = section ? (String(section).trim() + " · " + org) : org;
}

function normalizeFasceEtaList(list) {
 if (!Array.isArray(list)) return [];
 return list.map(item => {
 if (item && typeof item === "object") {
 const label = String(item.label || item.fascia || "").trim();
 const id = String(item.id || item.fasciaId || "").trim();
 return label ? { id, label } : null;
 }
 const label = String(item || "").trim();
 return label ? { id: "", label } : null;
 }).filter(Boolean);
}
function applyFasceEtaConfig(list) {
 FASCE_ETA = normalizeFasceEtaList(list);
}
function syncFasceEtaDaFoglio(onDone) {
 const done = (typeof onDone === "function") ? onDone : function(){};
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 done();
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 applyFasceEtaConfig(Array.isArray(res?.fasceEta) ? res.fasceEta : []);
 done();
 })
 .withFailureHandler(() => done())
 .getFasceEtaConfig();
}
function isFasciaValoreInvalido(ref) {
 if (ref == null || ref === "") return true;
 if (ref instanceof Date) return true;
 const r = String(ref).trim();
 if (!r) return true;
 if (/GMT[+-]\d{4}/.test(r)) return true;
 if (/Ora standard/i.test(r)) return true;
 if (/^\w{3} \w{3} \d{1,2} \d{4}/.test(r)) return true;
 return false;
}
function fasciaId(ref) {
 if (isFasciaValoreInvalido(ref)) return "";
 const r = String(ref).trim();
 const hit = FASCE_ETA.find(f => f.id === r);
 if (hit) return hit.id;
 const n = r.replace(/ anni/gi, "").trim();
 const byLabel = FASCE_ETA.find(f => f.label === n || f.label.toLowerCase() === n.toLowerCase());
 return byLabel ? byLabel.id : "";
}
function labelFascia(ref) {
 if (isFasciaValoreInvalido(ref)) return "";
 const id = fasciaId(ref);
 const hit = FASCE_ETA.find(f => f.id === id);
 return hit ? hit.label : "";
}
function labelsFasciaCsv(csv) {
 return String(csv || "").split(",").map(s => labelFascia(s.trim())).filter(Boolean).join(", ");
}
function indiceFasciaEta(ref) {
 const id = fasciaId(ref);
 if (!id) return -1;
 for (let i = 0; i < FASCE_ETA.length; i++) {
 if (FASCE_ETA[i].id === id) return i;
 }
 return -1;
}
function fasceEtaFiltratePerMin(minRef) {
 const minI = indiceFasciaEta(minRef);
 if (minI < 0) return FASCE_ETA.slice();
 return FASCE_ETA.filter((_, idx) => idx >= minI);
}
function populateFasciaEtaSelect(sel, currentRef) {
 if (!sel) return;
 const curId = fasciaId(currentRef);
 sel.innerHTML = [`<option value="">Nessuna</option>`].concat(
 FASCE_ETA.map(f =>
 `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`
 )
 ).join("");
 sel.value = curId;
}
function fasciaMinEffettivaDaPreferenzeAttesa(tavoli, prefIds) {
 if (!Array.isArray(tavoli) || !Array.isArray(prefIds) || !prefIds.length) return "";
 let bestIdx = -1;
 prefIds.forEach(pid => {
 const t = tavoli.find(x => String(x.id) === String(pid));
 if (!t) return;
 const m = String(t.fasciaEtaMinima || "").trim();
 if (!m) return;
 const idx = indiceFasciaEta(m);
 if (idx >= 0 && idx > bestIdx) bestIdx = idx;
 });
 return bestIdx >= 0 ? FASCE_ETA[bestIdx].id : "";
}
function pruneFasciaEtaControMin(selCsv, minRef) {
 const allowed = new Set(fasceEtaFiltratePerMin(minRef).map(f => f.id));
 const parts = String(selCsv || "").split(",").map(s => fasciaId(s.trim())).filter(Boolean);
 return parts.filter(p => allowed.has(p)).join(", ");
}
function refreshRegAttesaFasceChips() {
 const chipsContainer = document.getElementById("reg-attesa-fasce-chips");
 if (!chipsContainer || !regAttesaSelezionata) return;
 const minL = fasciaMinEffettivaDaPreferenzeAttesa(regTavoliCorrenti || [], regAttesaPreferenze || []);
 const pruned = pruneFasciaEtaControMin(regAttesaFasciaEta, minL);
 if (pruned !== regAttesaFasciaEta) regAttesaFasciaEta = pruned;
 renderFasceIn(chipsContainer, regAttesaFasciaEta, minL);
 document.getElementById("reg-attesa-fasce-req")?.classList.toggle("visible", !String(regAttesaFasciaEta || "").trim());
}

/** SVG del dado per animazione caricamento (riutilizzabile) */
const DICE_SVG = `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="44" height="44" rx="10" stroke="#c05a1e" stroke-width="2.5" fill="none"/><circle cx="17" cy="17" r="4" fill="#c9922a"/><circle cx="35" cy="17" r="4" fill="#c9922a"/><circle cx="26" cy="26" r="4" fill="#c9922a"/><circle cx="17" cy="35" r="4" fill="#c9922a"/><circle cx="35" cy="35" r="4" fill="#c9922a"/></svg>`;
/** Blocco HTML per stato caricamento con dado (msg opzionale) */
function loaderHtml(msg) {
 return `<div class="loader" style="padding:32px 20px;text-align:center"><div class="dice-loader">${DICE_SVG}</div>${msg ? `<span style="display:block;margin-top:12px;color:var(--smoke);font-style:italic">${msg}</span>` : ""}</div>`;
}

let datiOrg = null;
/** Dopo login con slice `stats`, tavoli e anagrafiche foglio si caricano al cambio macro-tab. */
let ORG_LAZY = { tavoli: false, anagrafiche: false };
/** Sync live: polling revision dopo iscrizione/cancellazione/modifica. */
let LIVE_SYNC = {
 rev: null,
 timer: null,
 busy: false,
 /** Org / co-organizzatore: poll aggressivo così una cancellazione compare quasi subito. */
 intervalMsOrg: 2000,
 mode: null, // "org" | "sede"
 lastFlashAt: 0
};
let datiUtente = null;
let datiMaster = null;
/** Indici tab avventure master: [0]=Tutte, poi chiavi sistema (`__none__` = senza sistema). */
let _masterAvvTabKeys = ["__all__"];
let _masterAvvById = {};
let eventiReg = [];
const selTav = {};
let orgDettaglioUtenteUuid = null;
let WAITLIST_PRIORITY_ENABLED = false;
let WAITLIST_ACTIONS_ENABLED = false;
let WAITLIST_PROMEMORIA_ENABLED = false;
let EXPORT_CSV_EVENTO_ENABLED = true;
/** Co-prenotanti e inviti: false = disattivato (allineare a code.gs PARTECIPANTI_MULTI_ENABLED). */
const PARTECIPANTI_MULTI_ENABLED = true;
/** Hash SHA-256 (hex) della password org dopo login; usato per iscrizioni manuali ai tavoli. */
let ORG_HASH_CLIENT = null;
let NOTIFICA_EVENTO_CORRENTE_ID = null;
let regTavoliCorrenti = [];
let ORG_SISTEMI_GIOCO = [];
let ORG_LUOGHI = [];
let ORG_UTENTI_INDEX = {};
let ORG_SALVA_EVENTO_PENDING = null;

function _inviteTokenDaDoGet() {
 try {
 const el = document.getElementById("gilda-invite-token-json");
 if (!el || !el.textContent) return "";
 return JSON.parse(el.textContent.trim()) || "";
 } catch (_e) {
 return "";
 }
}

/** Invito co-prenotante: evita doppia esecuzione (URL + postMessage dalla pagina WordPress). */
let _inviteFlowAvviato = false;
let _inviteTokenCorrente = null;
/** Iframe WP: postMessage credenziali master (fallback se lo src iframe non ha query). */
let _gildaMasterCredsApplied = false;

function _buildPublicUtenteUrl(uuid) {
 const u = String(uuid || "").trim();
 const base = String(WEBAPP_URL_UTENTE || "").trim() || (window.location.origin + window.location.pathname);
 if (!u) return base;
 return `${base}?uuid=${encodeURIComponent(u)}`;
}

/** URL pubblico area master: come utente ma su WEBAPP_URL_MASTER + ?uuid= (stesso nome parametro). */
function _buildUrlAreaMaster(masterId) {
 const id = String(masterId || "").trim();
 let baseRaw = String(WEBAPP_URL_MASTER || "").trim();
 if (!baseRaw) {
 const u = String(WEBAPP_URL_UTENTE || "").trim();
 if (u && /\/utente\/?$/i.test(u)) baseRaw = u.replace(/\/utente\/?$/i, "/master/");
 else {
 const p = window.location.pathname.replace(/\/utente\/?$/i, "/master/");
 baseRaw = window.location.origin + (p.endsWith("/") ? p : p + "/");
 }
 }
 if (!baseRaw) baseRaw = window.location.origin + window.location.pathname;
 if (!id) return baseRaw;
 try {
 const u = new URL(baseRaw, window.location.origin);
 u.searchParams.delete("pagina");
 u.searchParams.delete("masterId");
 u.searchParams.set("uuid", id);
 return u.toString();
 } catch (_e) {
 const sep = baseRaw.includes("?") ? "&" : "?";
 return `${baseRaw}${sep}uuid=${encodeURIComponent(id)}`;
 }
}

function orgMostraLinkMaster(masterId) {
 const id = String(masterId || "").trim();
 const inp = document.getElementById("org-master-link-url");
 if (!inp) return;
 if (!id) {
 flash("org-fa", "Questo master non ha un masterId: impossibile costruire il link.", "err");
 return;
 }
 inp.value = _buildUrlAreaMaster(id);
 show("org-master-link-overlay");
 setTimeout(() => {
 try {
 inp.focus();
 inp.select();
 } catch (_e) {}
 }, 50);
}

function orgCopiaLinkMaster() {
 const inp = document.getElementById("org-master-link-url");
 if (!inp || !inp.value) return;
 const v = inp.value;
 navigator.clipboard.writeText(v).then(() => {
 flash("org-fa", "Link copiato negli appunti.", "ok");
 }).catch(() => {
 try {
 inp.select();
 document.execCommand("copy");
 flash("org-fa", "Link copiato negli appunti.", "ok");
 } catch (_e) {
 flash("org-fa", "Copia non disponibile: seleziona il testo e copia manualmente.", "err");
 }
 });
}

function orgApriLinkMasterNuovaScheda() {
 const inp = document.getElementById("org-master-link-url");
 if (!inp || !inp.value) return;
 const win = window.open(inp.value, "_blank", "noopener,noreferrer");
 if (win) try { win.opener = null; } catch (_e) {}
}

function apriMasterNuovaAvventuraPopup() {
 show("master-nuova-avventura-overlay");
 setTimeout(() => document.getElementById("m-new-titolo")?.focus(), 100);
}

function chiudiMasterNuovaAvventuraPopup() {
 hide("master-nuova-avventura-overlay");
}

function apriMasterModificaInfoPopup() {
 const m = datiMaster?.master || {};
 const nomeEl = document.getElementById("m-info-nome");
 const nickEl = document.getElementById("m-info-nick");
 const emailEl = document.getElementById("m-info-email");
 const cellEl = document.getElementById("m-info-cell");
 if (nomeEl) nomeEl.value = String(m.nome || "");
 if (nickEl) nickEl.value = String(m.nick || "");
 if (emailEl) emailEl.value = String(m.email || "");
 if (cellEl) cellEl.value = String(m.cellulare || "");
 show("master-modifica-info-overlay");
 setTimeout(() => nomeEl?.focus(), 80);
}

function chiudiMasterModificaInfoPopup() {
 hide("master-modifica-info-overlay");
}

function salvaMasterInfoDaPopup() {
 const cred = _masterCredential();
 const payload = {
 nome: String(document.getElementById("m-info-nome")?.value || "").trim(),
 nick: String(document.getElementById("m-info-nick")?.value || "").trim(),
 email: String(document.getElementById("m-info-email")?.value || "").trim(),
 cellulare: String(document.getElementById("m-info-cell")?.value || "").trim()
 };
 const btn = document.getElementById("m-info-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Salvataggio informazioni…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile salvare le informazioni."), "err");
 return;
 }
 chiudiMasterModificaInfoPopup();
 flash("master-fa", "✅ " + (res.messaggio || "Informazioni aggiornate."), "ok");
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .masterAggiornaInfo(cred, payload);
}

function _mostraMessaggioAreaUtenteAperta() {
 document.body.innerHTML = `
 <div style="font-family:Georgia,serif;max-width:560px;margin:40px auto;padding:20px;border:1px solid #e4cfb9;border-radius:12px;background:#fffaf4;color:#5b3b25;text-align:center">
 <div style="font-size:22px;margin-bottom:8px">✅ Area utente aperta</div>
 <div style="font-size:14px;line-height:1.6">Puoi chiudere questa finestra.</div>
 </div>`;
}

function _apriAreaUtente(uuid, preferNuovaFinestra) {
 const url = _buildPublicUtenteUrl(uuid);
 if (preferNuovaFinestra) {
 const win = window.open(url, "_blank", "noopener,noreferrer");
 if (win) {
 try { win.opener = null; } catch (_e) {}
 _mostraMessaggioAreaUtenteAperta();
 return;
 }
 }
 window.location.assign(url);
}

function gildaInviteFromParent(ev) {
 if (_inviteFlowAvviato || MODE === "org") return;
 const d = ev && ev.data;
 if (!d || d.type !== "gilda-invite-token") return;
 const tok = String(d.inviteToken || "").trim();
 if (!tok) return;
 avviaSchermataInvitoPartecipante(tok);
}

/** Credenziali master dalla pagina WordPress (query sul parent) → iframe senza query completa. */
function gildaMasterFromParent(ev) {
 if (MODE === "org") return;
 const d = ev && ev.data;
 if (!d || d.type !== "gilda-master-creds") return;
 const credExisting = _masterCredential();
 if (credExisting.masterId || credExisting.masterToken) return;
 const masterId = String(d.masterId || d.master || d.uuid || "").trim();
 const token = String(d.token || d.masterToken || "").trim();
 if (!masterId && !token) return;
 if (_gildaMasterCredsApplied) return;
 _gildaMasterCredsApplied = true;
 try {
 const u = new URL(window.location.href);
 if (masterId) {
 u.searchParams.set("uuid", masterId);
 u.searchParams.delete("masterId");
 }
 u.searchParams.set("pagina", "master");
 if (token) u.searchParams.set("token", token);
 history.replaceState({}, "", u.toString());
 } catch (_e) {}
 setAppTitle("Area Master");
 setMasterDashboardHeader(true);
 setHSub("Gestisci le tue avventure");
 hide("reg-main");
 hide("reg-panel");
 show("loader");
 caricaAreaMaster();
}

function _inviteNascondiContenutoReg() {
 hide("reg-panel");
 hide("reg-recupera");
 const bar = document.getElementById("reg-recupera-bar");
 if (bar) bar.classList.add("hidden");
}

function _inviteRipristinaVistaReg() {
 hide("invite-partecipante-wrap");
 const inner = document.getElementById("invite-partecipante-inner");
 if (inner) inner.innerHTML = "";
 _inviteTokenCorrente = null;
 window._inviteDettaglioRes = null;
 _inviteFlowAvviato = false;
 const pagUtente = (typeof PAGINA !== "undefined" && String(PAGINA).toLowerCase().trim() === "utente");
 const hasUuid = typeof UUID !== "undefined" && UUID && String(UUID).trim() && UUID !== "undefined";
 if (pagUtente && !hasUuid) {
 hide("reg-panel");
 show("reg-recupera");
 const bar = document.getElementById("reg-recupera-bar");
 if (bar) bar.classList.remove("hidden");
 setHSub("Recupera il tuo link personale");
 } else {
 show("reg-panel");
 const bar = document.getElementById("reg-recupera-bar");
 if (bar) bar.classList.remove("hidden");
 setHSub("Scegli l'evento e prenota in pochi click");
 if (typeof caricaEventiReg === "function") caricaEventiReg();
 }
}

function renderInviteGiaAccettato(res) {
 const inner = document.getElementById("invite-partecipante-inner");
 if (!inner) return;
 const ev = escapeHtml(res.eventNome || "");
 const sess = escapeHtml(res.sessioneNome || "—");
 const tav = escapeHtml(res.tavolo || "—");
 const np = escapeHtml(String(res.numPersone != null ? res.numPersone : "—"));
 const fas = escapeHtml(labelsFasciaCsv(res.fasciaEta) || "—");
 const owner = escapeHtml(res.ownerNome || "—");
 const uuid = String(res.uuid || "").trim();
 inner.innerHTML = `
 <div class="invite-flow-card">
 <div class="card-head">✅ Invito già accettato</div>
 <div class="card-body">
 <p style="font-size:14px;line-height:1.65;color:var(--smoke);margin:0 0 12px">Sei già collegato a questa prenotazione${ev ? ` (<strong>${ev}</strong>)` : ""}.</p>
 <ul class="invite-detail-list">
 <li><span class="invite-detail-key">📜 Evento</span><span class="invite-detail-value">${ev || "—"}</span></li>
 <li><span class="invite-detail-key">🧭 Area</span><span class="invite-detail-value">${sess}</span></li>
 <li><span class="invite-detail-key">🎲 Tavolo / postazione</span><span class="invite-detail-value">${tav}</span></li>
 <li><span class="invite-detail-key">Posti (prenotazione)</span><span class="invite-detail-value">${np}</span></li>
 <li><span class="invite-detail-key">Fasce d’età</span><span class="invite-detail-value">${fas}</span></li>
 <li><span class="invite-detail-key">Titolare prenotazione</span><span class="invite-detail-value">${owner}</span></li>
 </ul>
 <button type="button" class="btn btn-p" onclick="inviteVaiAreaUtente()">Vai all’area utente</button>
 </div>
 </div>`;
 window._inviteUuidRedirect = uuid;
}

function inviteVaiAreaUtente() {
 const u = String(window._inviteUuidRedirect || "").trim();
 window._inviteUuidRedirect = "";
 if (!u) return;
 _apriAreaUtente(u, true);
}

function renderInviteDettaglio(res) {
 const inner = document.getElementById("invite-partecipante-inner");
 if (!inner) return;
 window._inviteDettaglioRes = res || null;
 const owner = escapeHtml(res.ownerNome || "—");
 const ev = escapeHtml(res.eventNome || "—");
 const sess = escapeHtml(res.sessioneNome || "—");
 const tav = escapeHtml(res.tavolo || "—");
 const np = escapeHtml(String(res.numPersone != null ? res.numPersone : "—"));
 const fas = escapeHtml(labelsFasciaCsv(res.fasciaEta) || "—");
 const etiRaw = String(res.participantEtichetta != null ? res.participantEtichetta : res.participantNome || "").trim();
 const eti = escapeHtml(etiRaw || "—");
 const sugNome = String(res.suggestedNomeAnagrafica || "").trim();
 const em = escapeHtml(res.participantEmail || "");
 const nomeInputVal = escapeHtml(sugNome).replace(/"/g, "&quot;");
 inner.innerHTML = `
 <div class="invite-flow-card" id="invite-flow-root">
 <div class="card-head">📩 Invito come partecipante</div>
 <div class="card-body">
 <p class="invite-intro">
 <strong>${owner}</strong> ti ha invitato a far parte della stessa prenotazione. Controlla i dettagli e scegli se accettare o rifiutare.
 </p>
 <ul class="invite-detail-list">
 <li><span class="invite-detail-key">📜 Evento</span><span class="invite-detail-value">${ev}</span></li>
 <li><span class="invite-detail-key">🧭 Area</span><span class="invite-detail-value">${sess}</span></li>
 <li><span class="invite-detail-key">🎲 Tavolo / postazione</span><span class="invite-detail-value">${tav}</span></li>
 <li><span class="invite-detail-key">Posti (prenotazione)</span><span class="invite-detail-value">${np}</span></li>
 <li><span class="invite-detail-key">Fasce d’età</span><span class="invite-detail-value">${fas}</span></li>
 <li><span class="invite-detail-key">Come ti ha indicato il titolare</span><span class="invite-detail-value">${eti}</span></li>
 <li><span class="invite-detail-key">Email invito</span><span class="invite-detail-value">${em}</span></li>
 </ul>
 <div id="invite-step-scelta">
 <div class="invite-step-actions">
 <button type="button" class="btn btn-p" onclick="invitePassoAccetta()">Accetta invito</button>
 <button type="button" class="btn btn-o" onclick="invitePassoRifiuta()">Rifiuta</button>
 </div>
 </div>
 <div id="invite-step-nome" class="hidden">
 <p class="invite-note">Il titolare ti ha indicato come «<strong>${eti}</strong>».<br>Inserisci il tuo <strong>nome e cognome</strong> (se sono uguali all’etichetta riscrivili), una volta fatto conferma.</p>
 <div class="invite-nome-field field first">
 <label class="lbl" for="invite-nome-input">Nome e cognome (anagrafica)</label>
 <input type="text" id="invite-nome-input" autocomplete="name" value="${nomeInputVal}" placeholder="Nome e cognome">
 </div>
 <div class="invite-step-actions" style="margin-top:16px">
 <button type="button" class="btn btn-p" onclick="inviteConfermaAccettazione()">Conferma e collega il profilo</button>
 <button type="button" class="btn btn-o" onclick="inviteTornaAllaScelta()">Indietro</button>
 </div>
 </div>
 </div>
 </div>`;
}

function invitePassoAccetta() {
 const d = window._inviteDettaglioRes;
 if (d && d.richiediNomeAnagrafica === false) {
 inviteEseguiAccettazione("");
 return;
 }
 document.getElementById("invite-step-scelta")?.classList.add("hidden");
 document.getElementById("invite-step-nome")?.classList.remove("hidden");
 const inp = document.getElementById("invite-nome-input");
 if (inp) {
 const sug = String(d?.suggestedNomeAnagrafica || "").trim();
 inp.value = sug;
 }
 inp?.focus();
}

function inviteEseguiAccettazione(nome, confermaNomeUgualeEtichetta) {
 const tok = _inviteTokenCorrente;
 if (!tok || !(typeof google !== "undefined" && google.script && google.script.run)) return;
 setLdr("Conferma invito in corso…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (res && res.ok && res.uuid) {
 _apriAreaUtente(res.uuid, true);
 return;
 }
 flash("reg-fa", "⚠️ " + (res?.errore || "Invito non valido o scaduto."), "err");
 })
 .withFailureHandler(err => {
 hide("loader");
 flash("reg-fa", "❌ " + (err.message || err), "err");
 })
 .accettaInvitoPartecipante(tok, nome, "", confermaNomeUgualeEtichetta === true);
}

function inviteTornaAllaScelta() {
 document.getElementById("invite-step-nome")?.classList.add("hidden");
 document.getElementById("invite-step-scelta")?.classList.remove("hidden");
}

function invitePassoRifiuta() {
 chiediConferma("Vuoi rifiutare questo invito? Il titolare della prenotazione vedrà che non partecipi.", () => {
 const tok = _inviteTokenCorrente;
 if (!tok || !(typeof google !== "undefined" && google.script && google.script.run)) return;
 setLdr("Invio risposta…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (res && res.ok) {
 const inner = document.getElementById("invite-partecipante-inner");
 if (inner) {
 inner.innerHTML = `
 <div class="invite-flow-card">
 <div class="card-head">Invito rifiutato</div>
 <div class="card-body">
 <p style="font-size:14px;line-height:1.6;color:var(--smoke);margin:0 0 16px">La tua scelta è stata registrata.</p>
 <button type="button" class="btn btn-o" onclick="inviteChiudiPannello()">Chiudi</button>
 </div>
 </div>`;
 }
 } else {
 flash("reg-fa", "⚠️ " + (res?.errore || "Operazione non riuscita."), "err");
 }
 })
 .withFailureHandler(err => {
 hide("loader");
 flash("reg-fa", "❌ " + (err.message || err), "err");
 })
 .rifiutaInvitoPartecipante(tok);
 });
}

function inviteConfermaAccettazione() {
 const d = window._inviteDettaglioRes;
 const inputEl = document.getElementById("invite-nome-input");
 const nome = (inputEl && inputEl.value || "").trim();
 const etichetta = String(d?.participantEtichetta != null ? d.participantEtichetta : d?.participantNome || "").trim();
 const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
 let confermaNomeUgualeEtichetta = false;
 if (d && d.richiediNomeAnagrafica !== false) {
 if (typeof _haNomeECognomeUtente === "function" && !_haNomeECognomeUtente(nome)) {
 flash("reg-fa", "Inserisci nome e cognome (almeno due parole).", "err");
 return;
 }
 if (norm(nome) && norm(nome) === norm(etichetta)) {
 const normNome = norm(nome);
 if (window._inviteConfermaNomeUguale !== normNome) {
 window._inviteConfermaNomeUguale = normNome;
 if (inputEl) {
 inputEl.value = "";
 inputEl.focus();
 }
 flash("reg-fa", "Il nome coincide con l’etichetta invito: riscrivilo uguale e conferma di nuovo per procedere.", "err");
 return;
 }
 confermaNomeUgualeEtichetta = true;
 } else {
 window._inviteConfermaNomeUguale = "";
 }
 }
 inviteEseguiAccettazione(nome, confermaNomeUgualeEtichetta);
}

function inviteChiudiPannello() {
 _inviteRipristinaVistaReg();
}

function _masterCredential() {
 const params = new URLSearchParams(window.location.search);
 const paginaNorm = String(PAGINA || "").toLowerCase().trim();
 const masterIdTemplate = (typeof MASTER_ID !== "undefined") ? MASTER_ID : "";
 const masterTokenTemplate = (typeof MASTER_TOKEN !== "undefined") ? MASTER_TOKEN : "";
 let masterId = String(params.get("masterId") || params.get("master") || masterIdTemplate || "").trim();
 if (!masterId && paginaNorm === "master") {
 masterId = String(params.get("uuid") || UUID || "").trim();
 }
 return {
 masterToken: String(params.get("masterToken") || params.get("token") || masterTokenTemplate || "").trim(),
 masterId
 };
}

function _masterSistemaKey(a) {
 const s = String(a.sistemaGioco || "").trim();
 return s ? s : "__none__";
}

function _masterLabelSistemaTab(k) {
 return k === "__none__" ? "Senza sistema" : String(k);
}

function switchMasterAvventureTab(btn) {
 const idx = parseInt(btn.getAttribute("data-m-tab-idx") || "0", 10);
 const filterKey = _masterAvvTabKeys[idx] !== undefined ? _masterAvvTabKeys[idx] : "__all__";
 document.querySelectorAll("#m-avventure-tabs .m-avv-tab").forEach(b => b.classList.toggle("active", b === btn));
 document.querySelectorAll("#m-avventure-cards .m-avv-item").forEach(node => {
 const k = node.getAttribute("data-m-sistema") || "";
 const show = filterKey === "__all__" || k === filterKey;
 node.style.display = show ? "" : "none";
 });
}

function switchMasterMacroTab(panelId, btn) {
 const target = String(panelId || "m-panel-avventure");
 document.querySelectorAll("#master-macro-tabs .master-macro-btn").forEach(b => {
 b.classList.toggle("active", b === btn || b.getAttribute("data-master-panel") === target);
 });
 document.querySelectorAll("#master-main .m-panel").forEach(p => {
 p.classList.toggle("hidden", p.id !== target);
 });
 const subByPanel = {
 "m-panel-avventure": "Le tue avventure",
 "m-panel-tavoli": "Sessioni dove proporre",
 "m-panel-impegni": "Le avventure che porterai"
 };
 setHSub(subByPanel[target] || "Gestisci le tue avventure");
 requestAnimationFrame(syncOrgHeaderOffset);
}

function _masterRenderAvventure(avventure) {
 const tabsEl = document.getElementById("m-avventure-tabs");
 const cardsEl = document.getElementById("m-avventure-cards");
 if (!cardsEl) return;
 const list = Array.isArray(avventure) ? avventure : [];
 _masterAvvById = {};
 list.forEach(a => {
 const id = String(a?.avventuraId || "").trim().toLowerCase();
 if (id) _masterAvvById[id] = a;
 });
 if (!list.length) {
 if (tabsEl) {
 tabsEl.innerHTML = "";
 tabsEl.style.display = "none";
 }
 cardsEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>Nessuna avventura inserita.</div>`;
 return;
 }
 const keysOrder = [];
 const keySeen = new Set();
 list.forEach(a => {
 const k = _masterSistemaKey(a);
 if (!keySeen.has(k)) {
 keySeen.add(k);
 keysOrder.push(k);
 }
 });
 keysOrder.sort((a, b) => {
 if (a === "__none__") return 1;
 if (b === "__none__") return -1;
 return String(a).localeCompare(String(b), "it");
 });
 _masterAvvTabKeys = ["__all__"].concat(keysOrder);
 if (tabsEl) {
 tabsEl.innerHTML = [`<button type="button" class="tab-btn m-avv-tab active" data-m-tab-idx="0" onclick="switchMasterAvventureTab(this)">Tutte</button>`]
 .concat(keysOrder.map((k, i) => {
 const label = escapeHtml(_masterLabelSistemaTab(k));
 return `<button type="button" class="tab-btn m-avv-tab" data-m-tab-idx="${i + 1}" onclick="switchMasterAvventureTab(this)">${label}</button>`;
 }))
 .join("");
 tabsEl.style.display = "flex";
 }
 cardsEl.innerHTML = list.map(a => {
 const sk = _masterSistemaKey(a);
 const nome = escapeHtml(String(a.titoloAvventura || a.sistemaGioco || a.tavoloId || "Avventura"));
 const tipo = escapeHtml(String(a.tipo || "GDR"));
 const sistema = escapeHtml(String(a.sistemaGioco || ""));
 const desc = String(a.descrizione || "").trim();
 const temaStr = String(a.tema || "").trim();
 const ambStr = String(a.ambientazione || "").trim();
 const fascia = escapeHtml(labelFascia(a.fasciaEtaMinima) || "");
 const livelloEsc = escapeHtml(String(a.livello || "").trim());
 const skAttr = escapeHtml(sk);
 const tavoliArr = Array.isArray(a.tavoli) && a.tavoli.length ? a.tavoli : null;
 let luoghiHtml = "";
 if (tavoliArr) {
 luoghiHtml = tavoliArr.map(t => {
 const evL = escapeHtml(String(t.eventNome || t.eventId || ""));
 const da = escapeHtml(String(t.eventData || ""));
 const sn = escapeHtml(String(t.sessioneNome || t.sessioneId || ""));
 const or = escapeHtml(String(t.sessioneOrario || ""));
 const oc = Math.max(0, parseInt(t.occupati || 0, 10) || 0);
 const mx = Math.max(0, parseInt(t.max || 0, 10) || 0);
 return `📜 ${evL}${da ? ` · ${da}` : ""}<br>🧭 ${sn}${or ? ` · ${or}` : ""} · 👥 ${oc}/${mx}`;
 }).join("<br><br>");
 } else {
 const evento = escapeHtml(String(a.eventNome || a.eventId || "Evento"));
 const data = escapeHtml(String(a.eventData || ""));
 const sess = escapeHtml(String(a.sessioneNome || a.sessioneId || "Sessione"));
 const orario = escapeHtml(String(a.sessioneOrario || ""));
 const occ = Math.max(0, parseInt(a.occupati || 0, 10) || 0);
 const max = Math.max(0, parseInt(a.max || 0, 10) || 0);
 luoghiHtml = `📜 ${evento}${data ? ` · ${data}` : ""}<br>🧭 ${sess}${orario ? ` · ${orario}` : ""}<br>👥 ${occ}/${max} occupati`;
 }
 return `
 <div class="m-avv-item card" style="margin-top:10px" data-m-sistema="${skAttr}">
 <div class="card-body">
 <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
 <div style="font-family:var(--font-d);font-size:18px">${nome}</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
 <span class="tipo-badge ${tipo==="GDR"?"t-gdr":"t-gdt"}">${tipo}</span>
 ${sistema ? `<span class="tipo-badge sys">${sistema}</span>` : ""}
 ${livelloEsc ? `<span class="tipo-badge" title="Livello">📶 ${livelloEsc}</span>` : ""}
 </div>
 </div>
 <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-top:6px">
 <div style="font-size:13px;color:var(--smoke);flex:1;min-width:0">
 ${fascia ? `Età minima: ${fascia}` : ""}
 ${temaStr ? `<div style="margin-top:8px;font-size:13px;color:var(--smoke)">📚 Tema: ${escapeHtml(temaStr)}</div>` : ""}
 ${ambStr ? `<div style="margin-top:4px;font-size:13px;color:var(--smoke)">🌍 Ambientazione: ${escapeHtml(ambStr)}</div>` : ""}
 ${desc ? `<div style="margin-top:10px;font-size:14px;color:var(--ink2)">${formatDesc(desc)}</div>` : ""}
 </div>
 <div style="display:flex;flex-direction:column;gap:8px;justify-content:flex-end">
 <button type="button" class="btn btn-o btn-xs" onclick='apriMasterStoricoAvventuraPopup(${JSON.stringify(String(a.avventuraId || ""))})'>🗂️ Storico</button>
 <button type="button" class="btn btn-o btn-xs" onclick='apriMasterGestioneAvventuraPopup(${JSON.stringify(String(a.avventuraId || ""))})'>⚙️ Gestisci</button>
 </div>
 </div>
 </div>
 </div>`;
 }).join("");
}

function apriMasterStoricoAvventuraPopup(avventuraId) {
 const id = String(avventuraId || "").trim().toLowerCase();
 const a = _masterAvvById[id];
 if (!a) {
 flash("master-fa", "Avventura non trovata.", "err");
 return;
 }
 const titleEl = document.getElementById("m-storico-title");
 if (titleEl) {
 titleEl.textContent = "🗂️ Storico: " + String(a.titoloAvventura || a.sistemaGioco || "Avventura");
 }
 const contentEl = document.getElementById("m-storico-content");
 if (!contentEl) return;
 const tavoli = Array.isArray(a.tavoli) ? a.tavoli.slice() : [];
 window._masterStoricoRows = tavoli;
 const ordSel = document.getElementById("m-storico-order");
 if (ordSel && !ordSel.value) ordSel.value = "desc";
 renderMasterStoricoAvventuraContent();
 show("master-avventura-storico-overlay");
}

function renderMasterStoricoAvventuraContent() {
 const contentEl = document.getElementById("m-storico-content");
 if (!contentEl) return;
 const tavoliRaw = Array.isArray(window._masterStoricoRows) ? window._masterStoricoRows : [];
 const ordSel = document.getElementById("m-storico-order");
 const order = String(ordSel?.value || "desc").toLowerCase();
 const tavoli = tavoliRaw.slice();
 if (!tavoli.length) {
 contentEl.innerHTML = `<div class="empty-state" style="margin:0"><span class="empty-icon">🧭</span>Nessuna area storica collegata a questa avventura.</div>`;
 return;
 }
 tavoli.sort((x, y) => {
 const dx = String(x?.eventDataIso || "0000-00-00");
 const dy = String(y?.eventDataIso || "0000-00-00");
 if (dx !== dy) return order === "asc" ? dx.localeCompare(dy) : dy.localeCompare(dx);
 const tx = String(x?.sessioneOrario || "");
 const ty = String(y?.sessioneOrario || "");
 return order === "asc" ? tx.localeCompare(ty) : ty.localeCompare(tx);
 });
 contentEl.innerHTML = tavoli.map(t => {
 const ev = escapeHtml(String(t.eventNome || t.eventId || "Evento"));
 const data = escapeHtml(String(t.eventData || ""));
 const sess = escapeHtml(String(t.sessioneNome || t.sessioneId || "Sessione"));
 const ora = escapeHtml(String(t.sessioneOrario || ""));
 const tav = escapeHtml(String(t.tavoloId || ""));
 const occ = Math.max(0, parseInt(t.occupati || 0, 10) || 0);
 const max = Math.max(0, parseInt(t.max || 0, 10) || 0);
 return `<div style="padding:10px 0;border-bottom:1px dashed var(--vellum)">
 <div><strong>📜 Evento:</strong> ${ev}${data ? ` · ${data}` : ""}</div>
 <div><strong>🧭 Area:</strong> ${sess}${ora ? ` · ${ora}` : ""}</div>
 <div><strong>🪑 Tavolo:</strong> ${tav || "—"} · <strong>👥</strong> ${occ}/${max}</div>
 </div>`;
 }).join("");
}

function chiudiMasterStoricoAvventuraPopup() {
 hide("master-avventura-storico-overlay");
}

function apriMasterGestioneAvventuraPopup(avventuraId) {
 const id = String(avventuraId || "").trim().toLowerCase();
 const a = _masterAvvById[id];
 if (!a) {
 flash("master-fa", "Avventura non trovata.", "err");
 return;
 }
 document.getElementById("m-edit-avventura-id").value = id;
 document.getElementById("m-edit-titolo").value = String(a.titoloAvventura || "");
 document.getElementById("m-edit-sistema").value = String(a.sistemaGioco || "");
 const livEl = document.getElementById("m-edit-livello");
 if (livEl) livEl.value = String(a.livello || "");
 document.getElementById("m-edit-tipo").value = String(a.tipo || "GDR");
 document.getElementById("m-edit-max").value = Math.max(1, parseInt(a.max || 6, 10) || 6);
 document.getElementById("m-edit-descr").value = String(a.descrizione || "");
 const tmEl = document.getElementById("m-edit-tema");
 if (tmEl) tmEl.value = String(a.tema || "");
 const amEl = document.getElementById("m-edit-ambientazione");
 if (amEl) amEl.value = String(a.ambientazione || "");
 const toEl = document.getElementById("m-edit-tono");
 if (toEl) toEl.value = String(a.tono || "");
 const tsEl = document.getElementById("m-edit-tematiche");
 if (tsEl) tsEl.value = String(a.tematicheSensibili || "");

 populateFasciaEtaSelect(document.getElementById("m-edit-fascia-min"), a.fasciaEtaMinima);

 const linked = document.getElementById("m-edit-tavoli-linked");
 const tavoli = Array.isArray(a.tavoli) ? a.tavoli : [];
 if (linked) {
 linked.innerHTML = tavoli.length
 ? tavoli.map(t => `🪑 ${escapeHtml(String(t.tavoloId || ""))} · ${escapeHtml(String(t.eventNome || t.eventId || ""))} · ${escapeHtml(String(t.sessioneNome || t.sessioneId || ""))}`).join("<br>")
 : "Nessun tavolo collegato.";
 }
 show("master-gestione-avventura-overlay");
}

function chiudiMasterGestioneAvventuraPopup() {
 hide("master-gestione-avventura-overlay");
}

function masterSalvaModificaAvventuraDaPopup() {
 const cred = _masterCredential();
 const avventuraId = String(document.getElementById("m-edit-avventura-id")?.value || "").trim();
 if (!avventuraId) {
 flash("master-fa", "Avventura non valida.", "err");
 return;
 }
 const payload = {
 avventuraId,
 titoloAvventura: String(document.getElementById("m-edit-titolo")?.value || "").trim(),
 sistemaGioco: String(document.getElementById("m-edit-sistema")?.value || "").trim(),
 livello: String(document.getElementById("m-edit-livello")?.value || "").trim(),
 tipo: String(document.getElementById("m-edit-tipo")?.value || "GDR").trim().toUpperCase(),
 max: Math.max(1, parseInt(document.getElementById("m-edit-max")?.value || 6, 10) || 6),
 descrizione: String(document.getElementById("m-edit-descr")?.value || "").trim(),
 tema: String(document.getElementById("m-edit-tema")?.value || "").trim(),
 ambientazione: String(document.getElementById("m-edit-ambientazione")?.value || "").trim(),
 tono: String(document.getElementById("m-edit-tono")?.value || "").trim(),
 tematicheSensibili: String(document.getElementById("m-edit-tematiche")?.value || "").trim(),
 fasciaEtaMinima: String(document.getElementById("m-edit-fascia-min")?.value || "").trim(),
 mostraMaster: true
 };
 const btn = document.getElementById("m-edit-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Salvataggio avventura…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile salvare l'avventura."), "err");
 return;
 }
 chiudiMasterGestioneAvventuraPopup();
 flash("master-fa", "✅ " + (res.messaggio || "Avventura aggiornata."), "ok");
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .masterAggiornaAvventura(cred, payload);
}

function masterEliminaAvventuraDaPopup() {
 const cred = _masterCredential();
 const avventuraId = String(document.getElementById("m-edit-avventura-id")?.value || "").trim();
 if (!avventuraId) {
 flash("master-fa", "Avventura non valida.", "err");
 return;
 }
 chiediConferma("Confermi eliminazione avventura? I tavoli collegati verranno scollegati dal master.", () => {
 beginActionOverlay("Eliminazione avventura…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile eliminare l'avventura."), "err");
 return;
 }
 chiudiMasterGestioneAvventuraPopup();
 flash("master-fa", "✅ " + (res.messaggio || "Avventura eliminata."), "ok");
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .masterEliminaAvventura(cred, { avventuraId });
 });
}

function _masterRenderTavoliDisponibili(tavoli) {
 const el = document.getElementById("m-prossimi-tavoli-cards");
 if (!el) return;
 const list = Array.isArray(tavoli) ? tavoli : [];
 if (!list.length) {
 el.innerHTML = `<div class="empty-state"><span class="empty-icon">🗂️</span>Nessuna area disponibile: hai gia un tavolo su tutte le prossime aree.</div>`;
 return;
 }
 el.innerHTML = list.map(t => {
 const eNome = escapeHtml(String(t.eventNome || t.eventId || ""));
 const eData = escapeHtml(String(t.eventData || ""));
 const sNome = escapeHtml(String(t.sessioneNome || t.sessioneId || ""));
 const sOra = escapeHtml(String(t.sessioneOrario || ""));
 const liberi = Math.max(0, parseInt(t.tavoliLiberi || 0, 10) || 0);
 const tot = Math.max(0, parseInt(t.tavoliTotali || 0, 10) || 0);
 return `
 <div class="card" style="margin-top:10px">
 <div class="card-body">
 <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
 <div style="display:flex;flex-direction:column;gap:2px">
 <div style="font-family:var(--font-d);font-size:18px;line-height:1.2">📜 ${eNome}</div>
 <div style="font-size:13px;color:var(--ink2);font-weight:600;line-height:1.25">🧭 ${sNome}${sOra ? ` · ${sOra}` : ""}</div>
 </div>
 <div style="font-size:12px;color:var(--ash);font-weight:600">Tavoli senza master: ${liberi}${tot ? ` / ${tot}` : ""}</div>
 </div>
 <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-top:6px">
 <div style="font-size:13px;color:var(--smoke);flex:1;min-width:0">
 ${eData ? `📅 ${eData}<br>` : ""}
 Se c'è un tavolo senza master te lo assegna, altrimenti ne crea uno nuovo e collega subito una tua avventura.
 </div>
 <button
 type="button"
 class="btn btn-s btn-sm"
 data-event-id="${escapeHtml(String(t.eventId || ""))}"
 data-sessione-id="${escapeHtml(String(t.sessioneId || ""))}"
 data-event-nome="${escapeHtml(String(t.eventNome || t.eventId || ""))}"
 data-event-data="${escapeHtml(String(t.eventData || ""))}"
 data-sessione-nome="${escapeHtml(String(t.sessioneNome || t.sessioneId || ""))}"
 data-sessione-orario="${escapeHtml(String(t.sessioneOrario || ""))}"
 onclick="apriMasterPrendiTavoloPopup(this)"
 >🎯 Fai il Master</button>
 </div>
 </div>
 </div>`;
 }).join("");
}

function _masterSafeDomId(v) {
 return String(v || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function _masterStoricoCounts(st) {
 const s = st || {};
 return {
 nEv: Math.max(0, parseInt(s.eventiTotali || 0, 10) || 0),
 nAv: Math.max(0, parseInt(s.avventureMasterCount || 0, 10) || 0),
 avv: Array.isArray(s.avventureMaster) ? s.avventureMaster : []
 };
}

function _masterVolteAvventuraCorrente(st, ctx) {
 const { avv } = _masterStoricoCounts(st);
 const id = String(ctx?.avventuraId || "").trim().toLowerCase();
 const titolo = String(ctx?.titoloAvventura || "").trim().toLowerCase();
 let found = null;
 if (id) {
 found = avv.find(a => String(a.avventuraId || "").trim().toLowerCase() === id) || null;
 }
 if (!found && titolo) {
 found = avv.find(a => String(a.titolo || "").trim().toLowerCase() === titolo) || null;
 }
 if (!found) return 0;
 return Math.max(0, parseInt(found.volte || 0, 10) || 0);
}

function _masterFormatStoricoCompactStatsHtml(st, ctx) {
 const { nEv, nAv } = _masterStoricoCounts(st);
 const volteQuesta = Math.max(0, _masterVolteAvventuraCorrente(st, ctx) || 0);
 const questaChip = volteQuesta <= 1
 ? `<span class="master-st-chip master-st-chip--prima">prima volta</span>`
 : `<span class="master-st-chip master-st-chip--questa">${volteQuesta}× questa</span>`;
 const evLabel = nEv === 1 ? "1 evento" : `${Math.max(0, nEv)} eventi`;
 const avvLabel = nAv === 1 ? "1 tua avv." : `${Math.max(0, nAv)} tue avv.`;
 return `<div class="master-pren-stats">
 ${questaChip}
 <span class="master-st-chip master-st-chip--muted">${evLabel}</span>
 <span class="master-st-chip master-st-chip--muted">${avvLabel}</span>
 </div>`;
}

function _masterFormatStoricoChipsHtml(st, ctx) {
 return _masterFormatStoricoCompactStatsHtml(st, ctx);
}

function _masterHaStoricoUtile(st) {
 const { nEv, nAv } = _masterStoricoCounts(st);
 return nEv > 0 || nAv > 0;
}

function _masterFormatStoricoGiocatoreDetailHtml(st, ctx) {
 const { nEv, nAv, avv } = _masterStoricoCounts(st);
 const volteQuesta = _masterVolteAvventuraCorrente(st, ctx);
 const pills = _masterFormatStoricoCompactStatsHtml(st, ctx);
 if (!avv.length) {
 return `<div class="master-st-block">${pills}<div class="master-st-note">Prima volta con le tue avventure</div></div>`;
 }
 const curId = String(ctx?.avventuraId || "").trim().toLowerCase();
 const curTitolo = String(ctx?.titoloAvventura || "").trim().toLowerCase();
 const sorted = avv.slice().sort((a, b) => {
 const aCur = (curId && String(a.avventuraId || "").trim().toLowerCase() === curId)
 || (curTitolo && String(a.titolo || "").trim().toLowerCase() === curTitolo);
 const bCur = (curId && String(b.avventuraId || "").trim().toLowerCase() === curId)
 || (curTitolo && String(b.titolo || "").trim().toLowerCase() === curTitolo);
 if (aCur !== bCur) return aCur ? -1 : 1;
 return (parseInt(b.volte || 0, 10) || 0) - (parseInt(a.volte || 0, 10) || 0);
 });
 const items = sorted.map(a => {
 const titoloRaw = String(a.titolo || "Avventura").trim() || "Avventura";
 const titolo = escapeHtml(titoloRaw);
 const volte = Math.max(1, parseInt(a.volte || 0, 10) || 1);
 const volteLabel = volte === 1 ? "1 volta" : `${volte} volte`;
 const isCurrent = (curId && String(a.avventuraId || "").trim().toLowerCase() === curId)
 || (curTitolo && titoloRaw.toLowerCase() === curTitolo);
 const evs = (Array.isArray(a.eventi) ? a.eventi : [])
 .map(e => {
 const nome = String(e.eventNome || e.eventId || "").trim();
 const data = typeof formatDataItaliana === "function"
 ? (formatDataItaliana(e.eventData || "") || String(e.eventData || "").trim())
 : String(e.eventData || "").trim();
 if (!nome && !data) return "";
 return data ? `${nome} · ${data}` : nome;
 })
 .filter(Boolean)
 .map(escapeHtml);
 return `<li class="master-st-avv${isCurrent ? " master-st-avv--current" : ""}">
 <div class="master-st-avv-title">${titolo}${isCurrent ? ` <span class="master-st-chip master-st-chip--questa">questa</span>` : ""}<span class="master-st-avv-count">${volteLabel}</span></div>
 ${evs.length ? `<div class="master-st-avv-evs">${evs.join(" · ")}</div>` : ""}
 </li>`;
 }).join("");
 const note = volteQuesta <= 1 && nAv <= 1 && nEv <= 1
 ? `<div class="master-st-note">Prima volta su questa avventura</div>`
 : "";
 return `<div class="master-st-block">${pills}${note}<ul class="master-st-list">${items}</ul></div>`;
}

function _masterFormatCopartecipantiCompactHtml(partecipanti, ctx) {
 const list = Array.isArray(partecipanti) ? partecipanti : [];
 if (!list.length) return "";
 const rows = list.map(part => {
 const nome = escapeHtml(String(part.nomeCompleto || part.nome || "Partecipante").trim() || "Partecipante");
 const st = part.storicoGiocatore;
 const known = _masterHaStoricoUtile(st) || !!String(part.email || "").trim() || !!String(part.participantUuid || "").trim();
 const stats = known
 ? _masterFormatStoricoCompactStatsHtml(st, ctx)
 : `<div class="master-pren-stats master-pren-copart-unk">Storico non collegabile (manca email)</div>`;
 return `<div class="master-pren-copart">
 <span class="master-pren-copart-name">${nome}</span>${stats}
 </div>`;
 }).join("");
 return `<div class="master-pren-coparts">${rows}</div>`;
}

function _masterFormatCopartecipantiDetailHtml(partecipanti, ctx) {
 const list = Array.isArray(partecipanti) ? partecipanti : [];
 if (!list.length) return "";
 const items = list.map(part => {
 const nome = escapeHtml(String(part.nomeCompleto || part.nome || "Partecipante").trim() || "Partecipante");
 const email = String(part.email || "").trim();
 const st = part.storicoGiocatore;
 const known = _masterHaStoricoUtile(st) || !!email || !!String(part.participantUuid || "").trim();
 const body = known
 ? _masterFormatStoricoGiocatoreDetailHtml(st, ctx)
 : `<div class="master-st-note">Nessun match su email/uuid/nome: non posso ricostruire se ha già giocato.</div>`;
 return `<div class="master-st-copart-item">
 <div class="master-st-avv-title">${nome}${email ? ` <span class="master-st-avv-count">${escapeHtml(email)}</span>` : ""}</div>
 ${body}
 </div>`;
 }).join("");
 return `<div class="master-st-copart-block"><div class="master-st-copart-title">Partecipanti non prenotanti</div>${items}</div>`;
}

function _masterRenderPrenotazioniTavoloHtml(prenotazioni, compact, ctx) {
 const list = Array.isArray(prenotazioni) ? prenotazioni : [];
 const avCtx = ctx || {};
 if (!list.length) {
 return compact
 ? `<div style="font-size:12px;color:var(--ash);font-style:italic;margin-top:6px">Nessun prenotato ancora.</div>`
 : `<div class="empty-state" style="padding:12px 0"><span class="empty-icon">👤</span>Nessun prenotato ancora.</div>`;
 }
 if (compact) {
 const rows = list.map(p => {
 const nome = escapeHtml(String(p.nome || "—").trim() || "—");
 const numP = Math.max(1, parseInt(p.numPersone || 1, 10) || 1);
 const posti = numP > 1 ? `<span class="master-pren-posti">${numP} posti</span>` : "";
 const coparts = _masterFormatCopartecipantiCompactHtml(p.partecipanti, avCtx);
 return `<div class="master-pren-row">
 <div class="master-pren-who">
 <span class="master-pren-name">${nome}</span>${posti}
 ${_masterFormatStoricoCompactStatsHtml(p.storicoGiocatore, avCtx)}
 </div>
 ${coparts}
 </div>`;
 }).join("");
 return `<div class="master-pren-list">
 <div class="master-pren-head">Prenotati</div>
 <div class="master-pren-legend">
 <span class="master-st-chip master-st-chip--questa">N× questa</span>
 <span>= volte su quest’avventura</span>
 <span>·</span>
 <span class="master-st-chip master-st-chip--muted">eventi</span>
 <span>·</span>
 <span class="master-st-chip master-st-chip--muted">tue avv.</span>
 </div>
 ${rows}
 </div>`;
 }
 return `<div class="mtav-partecipanti" style="margin-top:4px">${list.map(p => {
 const numP = Math.max(1, parseInt(p.numPersone || 1, 10) || 1);
 const card = mtavPersonaCardDisplay(p);
 const storicoHtml = _masterFormatStoricoGiocatoreDetailHtml(p.storicoGiocatore, avCtx);
 const copartsHtml = _masterFormatCopartecipantiDetailHtml(p.partecipanti, avCtx);
 return `<div class="mtav-persona">
 <div class="mtav-persona-top">
 <div class="mtav-avatar">${card.iniziale}</div>
 <div class="mtav-pinfo">
 <div class="mtav-pnome">${escapeHtml(card.nome)}</div>
 ${card.pinfoHtml}
 ${storicoHtml}
 ${copartsHtml}
 </div>
 <div class="mtav-pnum">×${numP}</div>
 </div>
 </div>`;
 }).join("")}</div>`;
}

function _masterRenderImpegni(impegni) {
 const el = document.getElementById("m-impegni-cards");
 if (!el) return;
 const list = Array.isArray(impegni) ? impegni : [];
 if (!list.length) {
 el.innerHTML = `<div class="empty-state"><span class="empty-icon">🧭</span>Nessuna avventura assegnata ai prossimi eventi.</div>`;
 return;
 }
 window._masterImpegniMap = {};
 el.innerHTML = list.map(i => {
 const rowKey = [
 String(i.avventuraId || ""),
 String(i.eventId || ""),
 String(i.sessioneId || ""),
 String(i.tavoloId || "")
 ].join("|").toLowerCase();
 window._masterImpegniMap[rowKey] = i;
 const nome = escapeHtml(String(i.titoloAvventura || i.sistemaGioco || "Avventura"));
 const tipo = escapeHtml(String(i.tipo || "GDR"));
 const sistema = escapeHtml(String(i.sistemaGioco || ""));
 const eNome = escapeHtml(String(i.eventNome || i.eventId || ""));
 const eData = escapeHtml(String(i.eventData || ""));
 const sNome = escapeHtml(String(i.sessioneNome || i.sessioneId || ""));
 const sOra = escapeHtml(String(i.sessioneOrario || ""));
 const tav = escapeHtml(String(i.tavoloId || ""));
 const occ = Math.max(0, parseInt(i.occupati || 0, 10) || 0);
 const max = Math.max(0, parseInt(i.max || 0, 10) || 0);
 const fascia = escapeHtml(labelFascia(i.fasciaEtaMinima) || "");
 const temaI = String(i.tema || "").trim();
 const ambI = String(i.ambientazione || "").trim();
 return `
 <div class="card master-impegno-card">
 <div class="card-body">
 <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
 <div class="master-impegno-title">${nome}</div>
 <div style="display:flex;gap:5px;flex-wrap:wrap">
 <span class="tipo-badge ${tipo==="GDR"?"t-gdr":"t-gdt"}">${tipo}</span>
 ${sistema ? `<span class="tipo-badge sys">${sistema}</span>` : ""}
 </div>
 </div>
 <div class="master-impegno-main">
 <div class="master-impegno-meta">
 📜 ${eNome}${eData ? ` · ${eData}` : ""}<br>
 🧭 ${sNome}${sOra ? ` · ${sOra}` : ""}<br>
 🪑 Tavolo ${tav}<br>
 👥 ${occ}/${max}${fascia ? ` · Età minima: ${fascia}` : ""}
 ${temaI ? `<br>📚 ${escapeHtml(temaI)}` : ""}${ambI ? `<br>🌍 ${escapeHtml(ambI)}` : ""}
 </div>
 ${_masterRenderPrenotazioniTavoloHtml(i.prenotazioni, true, { avventuraId: i.avventuraId, titoloAvventura: i.titoloAvventura })}
 </div>
 <div class="master-impegno-actions">
 <button type="button" class="btn btn-o btn-xs" onclick='apriMasterImpegnoDettaglioPopup(${JSON.stringify(rowKey)})'>📋 Dettaglio</button>
 <button type="button" class="btn btn-d btn-xs" onclick='masterDisassociaImpegno(${JSON.stringify(rowKey)})'>🔓 Disassocia</button>
 </div>
 </div>
 </div>`;
 }).join("");
}

function apriMasterImpegnoDettaglioPopup(rowKey) {
 const key = String(rowKey || "").toLowerCase();
 const map = window._masterImpegniMap || {};
 const i = map[key];
 if (!i) {
 flash("master-fa", "Dettaglio non disponibile.", "err");
 return;
 }
 const el = document.getElementById("m-impegno-dettaglio-content");
 if (!el) return;
 const titolo = escapeHtml(String(i.titoloAvventura || i.sistemaGioco || "Avventura"));
 const sistema = escapeHtml(String(i.sistemaGioco || "—"));
 const tipo = escapeHtml(String(i.tipo || "—"));
 const evento = escapeHtml(String(i.eventNome || i.eventId || "—"));
 const data = escapeHtml(String(i.eventData || "—"));
 const sessione = escapeHtml(String(i.sessioneNome || i.sessioneId || "—"));
 const orario = escapeHtml(String(i.sessioneOrario || "—"));
 const tavolo = escapeHtml(String(i.tavoloId || "—"));
 const occ = Math.max(0, parseInt(i.occupati || 0, 10) || 0);
 const max = Math.max(0, parseInt(i.max || 0, 10) || 0);
 const fascia = escapeHtml(labelFascia(i.fasciaEtaMinima) || "—");
 const temaD = escapeHtml(String(i.tema || "—"));
 const ambD = escapeHtml(String(i.ambientazione || "—"));
 el.innerHTML = `
 <div><strong>🎲 Titolo:</strong> ${titolo}</div>
 <div><strong>🧩 Sistema:</strong> ${sistema}</div>
 <div><strong>🏷️ Tipo:</strong> ${tipo}</div>
 <div><strong>📚 Tema:</strong> ${temaD}</div>
 <div><strong>🌍 Ambientazione:</strong> ${ambD}</div>
 <hr style="border:none;border-top:1px solid var(--vellum);margin:10px 0">
 <div><strong>📜 Evento:</strong> ${evento}</div>
 <div><strong>📅 Data:</strong> ${data}</div>
 <div><strong>🧭 Area:</strong> ${sessione}</div>
 <div><strong>⏰ Orario:</strong> ${orario}</div>
 <div><strong>🪑 Tavolo:</strong> ${tavolo}</div>
 <div><strong>👥 Capienza:</strong> ${occ}/${max}</div>
 <div><strong>🧒 Età minima:</strong> ${fascia}</div>
 <hr style="border:none;border-top:1px solid var(--vellum);margin:12px 0">
 <div><strong>👤 Prenotati al tavolo</strong></div>
 ${_masterRenderPrenotazioniTavoloHtml(i.prenotazioni, false, { avventuraId: i.avventuraId, titoloAvventura: i.titoloAvventura })}
 `;
 show("master-impegno-dettaglio-overlay");
}

function chiudiMasterImpegnoDettaglioPopup() {
 hide("master-impegno-dettaglio-overlay");
}

function masterDisassociaImpegno(rowKey) {
 const key = String(rowKey || "").toLowerCase();
 const map = window._masterImpegniMap || {};
 const i = map[key];
 if (!i) {
 flash("master-fa", "Dettaglio non disponibile.", "err");
 return;
 }
 const cred = _masterCredential();
 const avventuraId = String(i.avventuraId || "").trim();
 const tavoloId = String(i.tavoloId || "").trim();
 if (!avventuraId || !tavoloId) {
 flash("master-fa", "Impossibile disassociare: dati mancanti.", "err");
 return;
 }
 chiediConferma("Confermi la disassociazione dell'avventura da questo tavolo?", () => {
 beginActionOverlay("Disassociazione in corso…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile disassociare il tavolo."), "err");
 return;
 }
 flash("master-fa", "✅ " + (res.messaggio || "Tavolo disassociato."), "ok");
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .masterDisassociaAvventuraDaTavolo(cred, { avventuraId, tavoloId });
 });
}

function masterOnSistemaGiocoChange() {
 const sel = document.getElementById("m-new-sistema");
 const custom = document.getElementById("m-new-sistema-custom");
 if (!sel || !custom) return;
 const isNew = String(sel.value || "") === "__new__";
 custom.classList.toggle("hidden", !isNew);
 if (isNew) {
 setTimeout(() => custom.focus(), 0);
 } else {
 custom.value = "";
 }
}

function _masterGetSistemaGiocoValue() {
 const sel = document.getElementById("m-new-sistema");
 const custom = document.getElementById("m-new-sistema-custom");
 if (!sel) return "";
 if (String(sel.value || "") === "__new__") {
 return String(custom?.value || "").trim();
 }
 return String(sel.value || "").trim();
}

function _masterPrendiSistemaKey(a) {
 const s = String(a?.sistemaGioco || "").trim();
 return s || "__none__";
}

function _masterPrendiSistemaLabel(k) {
 return k === "__none__" ? "Senza sistema" : k;
}

function _masterRenderPrendiAvventureList() {
 const listEl = document.getElementById("m-prendi-avventure-list");
 const selectedIdEl = document.getElementById("m-prendi-avventura-id");
 if (!listEl || !selectedIdEl) return;
 const full = Array.isArray(window._masterPrendiAvvCompatibili) ? window._masterPrendiAvvCompatibili : [];
 const filterKey = String(window._masterPrendiSistemaFiltro || "__all__");
 const selectedId = String(selectedIdEl.value || "").trim().toLowerCase();
 const list = full.filter(a => {
 if (filterKey === "__all__") return true;
 return _masterPrendiSistemaKey(a) === filterKey;
 });
 if (!list.length) {
 listEl.innerHTML = `<div class="empty-state" style="margin:0"><span class="empty-icon">🧩</span>Nessuna avventura compatibile per questo sistema.</div>`;
 return;
 }
 listEl.innerHTML = list.map(a => {
 const id = String(a.avventuraId || "").trim().toLowerCase();
 const nome = escapeHtml(String(a.titoloAvventura || a.sistemaGioco || "Avventura"));
 const tipo = escapeHtml(String(a.tipo || "GDR"));
 const sis = escapeHtml(String(a.sistemaGioco || "Senza sistema"));
 const liv = escapeHtml(String(a.livello || "").trim());
 const maxA = Math.max(0, parseInt(a?.max || 0, 10) || 0);
 const active = id && id === selectedId;
 return `
 <button
 type="button"
 class="btn ${active ? "btn-s" : "btn-o"} btn-sm"
 style="display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left"
 onclick='masterPrendiSelezionaAvventura(${JSON.stringify(id)})'
 >
 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</span>
 <span style="font-size:12px;opacity:.9">${tipo} · ${sis}${liv ? ` · 📶 ${liv}` : ""} · 👥 ${maxA}</span>
 </button>`;
 }).join("");
}

function masterPrendiSelezionaAvventura(avventuraId) {
 const selectedIdEl = document.getElementById("m-prendi-avventura-id");
 if (!selectedIdEl) return;
 selectedIdEl.value = String(avventuraId || "").trim().toLowerCase();
 _masterRenderPrendiAvventureList();
}

function masterPrendiFilterSistema(filterKey, btn) {
 window._masterPrendiSistemaFiltro = String(filterKey || "__all__");
 document.querySelectorAll("#m-prendi-sistemi-tabs .tab-btn").forEach(b => {
 b.classList.toggle("active", b === btn);
 });
 _masterRenderPrendiAvventureList();
}

function apriMasterPrendiTavoloPopup(btnEl) {
 const sistemiTabsEl = document.getElementById("m-prendi-sistemi-tabs");
 const selectedIdEl = document.getElementById("m-prendi-avventura-id");
 const avventure = Array.isArray(datiMaster?.avventure) ? datiMaster.avventure : [];
 const avvCompatibili = avventure;
 window._masterPrendiAvvCompatibili = avvCompatibili;
 window._masterPrendiSistemaFiltro = "__all__";
 if (selectedIdEl) selectedIdEl.value = "";
 if (sistemiTabsEl) {
 const keys = [];
 const seen = {};
 avvCompatibili.forEach(a => {
 const k = _masterPrendiSistemaKey(a);
 if (seen[k]) return;
 seen[k] = true;
 keys.push(k);
 });
 keys.sort((a, b) => {
 if (a === "__none__") return 1;
 if (b === "__none__") return -1;
 return String(a).localeCompare(String(b), "it");
 });
 sistemiTabsEl.innerHTML = [`<button type="button" class="tab-btn active" onclick="masterPrendiFilterSistema('__all__', this)">Tutti</button>`]
 .concat(keys.map(k => `<button type="button" class="tab-btn" onclick='masterPrendiFilterSistema(${JSON.stringify(k)}, this)'>${escapeHtml(_masterPrendiSistemaLabel(k))}</button>`))
 .join("");
 }
 _masterRenderPrendiAvventureList();
 document.getElementById("m-prendi-event-id").value = String(btnEl?.dataset?.eventId || "");
 document.getElementById("m-prendi-sessione-id").value = String(btnEl?.dataset?.sessioneId || "");
 const meta = document.getElementById("m-prendi-tavolo-meta");
 if (meta) {
 const eNome = String(btnEl?.dataset?.eventNome || "").trim();
 const eData = String(btnEl?.dataset?.eventData || "").trim();
 const sNome = String(btnEl?.dataset?.sessioneNome || "").trim();
 const sOra = String(btnEl?.dataset?.sessioneOrario || "").trim();
 meta.innerHTML = `📜 ${escapeHtml(eNome)}${eData ? ` · ${escapeHtml(eData)}` : ""}<br>🧭 ${escapeHtml(sNome)}${sOra ? ` · ${escapeHtml(sOra)}` : ""}<br>Se esiste un tavolo senza master, verrà assegnato; altrimenti ne verrà creato uno nuovo.`;
 }
 show("master-prendi-tavolo-overlay");
}

function chiudiMasterPrendiTavoloPopup() {
 hide("master-prendi-tavolo-overlay");
}

function confermaMasterPrendiTavolo() {
 const cred = _masterCredential();
 const selectedIdEl = document.getElementById("m-prendi-avventura-id");
 const avventuraId = String(selectedIdEl?.value || "").trim();
 if (!avventuraId) {
 flash("master-fa", "Seleziona prima una tua avventura.", "err");
 return;
 }
 const eventId = String(document.getElementById("m-prendi-event-id")?.value || "");
 const sessioneId = String(document.getElementById("m-prendi-sessione-id")?.value || "");
 const btn = document.getElementById("m-prendi-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Assegnazione tavolo in corso…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile prendere il tavolo."), "err");
 return;
 }
 chiudiMasterPrendiTavoloPopup();
 flash("master-fa", "✅ " + (res.messaggio || "Tavolo assegnato."), "ok");
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .masterPrendiTavoloConAvventura(cred, {
 eventId,
 sessioneId,
 avventuraId
 });
}

function _masterFillForm(dati) {
 const selectSistema = document.getElementById("m-new-sistema");
 const sistemaCustom = document.getElementById("m-new-sistema-custom");
 const sistemi = Array.isArray(dati?.sistemiGioco) ? dati.sistemiGioco : [];
 if (selectSistema) {
 const list = Array.from(new Set(
 sistemi.map(s => String(s || "").trim()).filter(Boolean)
 )).sort((a, b) => a.localeCompare(b, "it"));
 selectSistema.innerHTML = [`<option value="">— Seleziona sistema —</option>`]
 .concat(list.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`))
 .concat([`<option value="__new__">➕ Aggiungi nuovo…</option>`])
 .join("");
 selectSistema.value = "";
 }
 if (sistemaCustom) {
 sistemaCustom.value = "";
 sistemaCustom.classList.add("hidden");
 }

 populateFasciaEtaSelect(document.getElementById("m-new-fascia-min"), "");
}

const SEDE_SESSION_KEY = "gilda_sede_session_v1";

function _sedeSessionLoad() {
 try {
 const raw = sessionStorage.getItem(SEDE_SESSION_KEY);
 if (!raw) return null;
 const o = JSON.parse(raw);
 if (!o || !o.sessionToken || !o.sedeId) return null;
 return o;
 } catch (_e) {
 return null;
 }
}

function _sedeSessionSave(sedeId, sessionToken) {
 try {
 sessionStorage.setItem(SEDE_SESSION_KEY, JSON.stringify({
 sedeId: String(sedeId || "").trim().toLowerCase(),
 sessionToken: String(sessionToken || "").trim().toLowerCase()
 }));
 } catch (_e) {}
}

function _sedeSessionClear() {
 try { sessionStorage.removeItem(SEDE_SESSION_KEY); } catch (_e) {}
 window._sedeSessionToken = "";
}

function _sedeCredential() {
 const params = new URLSearchParams(window.location.search);
 const paginaNorm = String(PAGINA || "").toLowerCase().trim();
 const sedeIdTemplate = (typeof SEDE_ID !== "undefined") ? SEDE_ID : "";
 const override = String(window._sedeIdOverride || "").trim();
 let sedeId = String(override || params.get("sedeId") || params.get("sede") || sedeIdTemplate || "").trim();
 if (!sedeId && (paginaNorm === "partner" || paginaNorm === "sede")) {
 sedeId = String(params.get("uuid") || UUID || "").trim();
 }
 const sess = _sedeSessionLoad();
 const sessionToken = String(window._sedeSessionToken || sess?.sessionToken || "").trim();
 if (sess?.sedeId && !sedeId) sedeId = sess.sedeId;
 if (sess?.sedeId && sedeId && String(sess.sedeId).toLowerCase() !== String(sedeId).toLowerCase()) {
 // sessione di un'altra sede: non riusarla
 return { sedeId, sessionToken: "" };
 }
 return {
 sedeId,
 sessionToken,
 token: sessionToken
 };
}

function _setSedeAccessHeader() {
 const header = document.getElementById("app-header");
 const brand = document.getElementById("h-brand-row");
 const masterTabs = document.getElementById("master-macro-tabs");
 const sedeTabs = document.getElementById("sede-macro-tabs");
 const app = document.getElementById("app");
 document.body.classList.add("mode-master");
 document.body.classList.remove("master-dashboard", "sede-dashboard", "org-dashboard");
 if (header) header.classList.remove("header-org");
 if (brand) brand.style.justifyContent = "center";
 if (masterTabs) masterTabs.setAttribute("hidden", "");
 if (sedeTabs) sedeTabs.setAttribute("hidden", "");
 setMasterHeaderActionsVisible(false);
 setSedeHeaderActionsVisible(false);
 const hTitle = document.getElementById("h-title");
 if (hTitle) hTitle.textContent = "🤝 Accesso Co-organizzatore";
 setHSub("Scegli il co-organizzatore");
 if (app) app.classList.remove("wide");
 pinOrgHeaderFlush();
 requestAnimationFrame(syncOrgHeaderOffset);
}

function renderSedeLoginList() {
 const listEl = document.getElementById("sede-login-list");
 const errEl = document.getElementById("sede-login-err");
 if (!listEl) return;
 const q = String(document.getElementById("sede-login-q")?.value || "").toLowerCase().trim();
 let list = Array.isArray(window._sedeLoginSedi) ? window._sedeLoginSedi.slice() : [];
 if (q) {
 list = list.filter(s =>
 String(s.nomeSede || "").toLowerCase().includes(q) ||
 String(s.indirizzo || "").toLowerCase().includes(q)
 );
 }
 if (errEl && !errEl.dataset.sticky) errEl.textContent = "";
 if (!list.length) {
 listEl.innerHTML = `<div class="sede-login-empty">${q ? "Nessun co-organizzatore corrisponde alla ricerca." : "Nessun co-organizzatore attivo disponibile."}</div>`;
 return;
 }
 listEl.innerHTML = list.map(s => {
 const id = String(s.sedeId || "").replace(/'/g, "\\'");
 return `<button type="button" class="sede-login-item" onclick="accediSede('${id}')">
 <div>
 <div class="sede-login-item-nome">${escapeHtml(s.nomeSede || s.sedeId)}</div>
 ${s.indirizzo ? `<div class="sede-login-item-addr">📍 ${escapeHtml(s.indirizzo)}</div>` : ""}
 </div>
 <span class="sede-login-item-cta">Entra →</span>
 </button>`;
 }).join("");
}

function tornaElencoSediLogin() {
 window._sedeAuthTarget = null;
 show("sede-login-pick");
 hide("sede-login-auth");
 const headSub = document.getElementById("sede-login-head-sub");
 if (headSub) headSub.textContent = "Seleziona il co-organizzatore per gestire eventi e iscrizioni";
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = "";
}

function switchSedeAuthTab(whichtab) {
 const otp = String(whichtab || "") === "otp";
 document.getElementById("sede-auth-tab-otp")?.classList.toggle("active", otp);
 document.getElementById("sede-auth-tab-pwd")?.classList.toggle("active", !otp);
 document.getElementById("sede-auth-otp")?.classList.toggle("hidden", !otp);
 document.getElementById("sede-auth-pwd")?.classList.toggle("hidden", otp);
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = "";
}

function _mostraAuthSedeUi(info) {
 window._sedeAuthTarget = info;
 hide("sede-login-pick");
 show("sede-login-auth");
 show("sede-login");
 const headSub = document.getElementById("sede-login-head-sub");
 if (headSub) headSub.textContent = "Verifica l’accesso con codice email o password";
 const nomeEl = document.getElementById("sede-auth-nome");
 const metaEl = document.getElementById("sede-auth-meta");
 if (nomeEl) nomeEl.textContent = info.nomeSede || info.sedeId || "Co-organizzatore";
 if (metaEl) {
 const bits = [];
 if (info.indirizzo) bits.push(info.indirizzo);
 if (info.hasEmail) bits.push("OTP → " + (info.emailMasked || "email"));
 if (info.hasPassword) bits.push("Password disponibile");
 metaEl.textContent = bits.join(" · ") || "—";
 }
 const otpHint = document.getElementById("sede-auth-otp-hint");
 const pwdHint = document.getElementById("sede-auth-pwd-hint");
 const sendBtn = document.getElementById("sede-otp-send-btn");
 if (!info.hasEmail) {
 if (otpHint) otpHint.textContent = "Nessuna email configurata: usa la password.";
 if (sendBtn) sendBtn.disabled = true;
 switchSedeAuthTab(info.hasPassword ? "pwd" : "otp");
 } else {
 if (otpHint) otpHint.textContent = "Invia un codice a 6 cifre a " + (info.emailMasked || "email") + ".";
 if (sendBtn) sendBtn.disabled = false;
 switchSedeAuthTab("otp");
 }
 if (!info.hasPassword && pwdHint) {
 pwdHint.textContent = "Password non ancora impostata dall’organizzazione. Usa il codice email.";
 } else if (pwdHint) {
 pwdHint.textContent = "Password impostata dall’organizzazione per questo co-organizzatore.";
 }
 const otpEl = document.getElementById("sede-otp-code");
 const pwdEl = document.getElementById("sede-pwd");
 if (otpEl) otpEl.value = "";
 if (pwdEl) pwdEl.value = "";
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = "";
}

function mostraAuthSede(sedeId) {
 const id = String(sedeId || "").trim();
 if (!id) {
 mostraAccessoSede();
 return;
 }
 window._sedeIdOverride = id;
 hide("loader");
 hide("sede-main");
 hide("master-main");
 hide("org-main");
 hide("reg-main");
 hide("user-main");
 show("sede-login");
 _setSedeAccessHeader();
 setHSub("Autenticazione sede");
 const authBox = document.getElementById("sede-login-auth");
 if (authBox) {
 hide("sede-login-pick");
 show("sede-login-auth");
 const nomeEl = document.getElementById("sede-auth-nome");
 if (nomeEl) nomeEl.textContent = "Caricamento…";
 }
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = res?.errore || "Co-organizzatore non disponibile.";
 tornaElencoSediLogin();
 mostraAccessoSede();
 return;
 }
 _mostraAuthSedeUi(res);
 })
 .withFailureHandler(err => {
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = err?.message || String(err);
 mostraAccessoSede();
 })
 .getSedeAuthInfo(id);
}

function inviaOtpSede() {
 const id = String(window._sedeAuthTarget?.sedeId || window._sedeIdOverride || "").trim();
 const errAuth = document.getElementById("sede-auth-err");
 if (!id) {
 if (errAuth) errAuth.textContent = "Co-organizzatore non selezionato.";
 return;
 }
 const btn = document.getElementById("sede-otp-send-btn");
 if (btn) btn.disabled = true;
 if (errAuth) errAuth.textContent = "";
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (!res || !res.ok) {
 if (errAuth) errAuth.textContent = res?.errore || "Invio codice fallito.";
 return;
 }
 const hint = document.getElementById("sede-auth-otp-hint");
 if (hint) {
 hint.textContent = (res.messaggio || "Codice inviato.") +
 (res.devOtp ? (" · Demo: " + res.devOtp) : "");
 }
 document.getElementById("sede-otp-code")?.focus();
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 if (errAuth) errAuth.textContent = err?.message || String(err);
 })
 .richiediOtpAccessoSede(id);
}

function _dopoAccessoSedeOk(res) {
 const id = String(res.sedeId || window._sedeIdOverride || "").trim();
 window._sedeSessionToken = String(res.sessionToken || "").trim();
 _sedeSessionSave(id, window._sedeSessionToken);
 window._sedeIdOverride = id;
 try {
 const url = new URL(window.location.href);
 url.searchParams.set("pagina", "partner");
 url.searchParams.set("uuid", id);
 history.replaceState({}, "", url.pathname + url.search + url.hash);
 } catch (_e) {}
 hide("sede-login");
 setHSub("Gestisci gli eventi come co-organizzatore");
 caricaAreaSede();
}

function verificaOtpSede() {
 const id = String(window._sedeAuthTarget?.sedeId || window._sedeIdOverride || "").trim();
 const otp = String(document.getElementById("sede-otp-code")?.value || "").trim();
 const errAuth = document.getElementById("sede-auth-err");
 if (!otp) {
 if (errAuth) errAuth.textContent = "Inserisci il codice ricevuto via email.";
 return;
 }
 beginActionOverlay("Verifica codice…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 if (errAuth) errAuth.textContent = res?.errore || "Codice non valido.";
 return;
 }
 _dopoAccessoSedeOk(res);
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (errAuth) errAuth.textContent = err?.message || String(err);
 })
 .verificaAccessoSede({ sedeId: id, otp });
}

async function verificaPasswordSede() {
 const id = String(window._sedeAuthTarget?.sedeId || window._sedeIdOverride || "").trim();
 const pwd = String(document.getElementById("sede-pwd")?.value || "");
 const errAuth = document.getElementById("sede-auth-err");
 if (!pwd) {
 if (errAuth) errAuth.textContent = "Inserisci la password.";
 return;
 }
 beginActionOverlay("Verifica password…");
 try {
 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
 const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 if (errAuth) errAuth.textContent = res?.errore || "Password non corretta.";
 return;
 }
 _dopoAccessoSedeOk(res);
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (errAuth) errAuth.textContent = err?.message || String(err);
 })
 .verificaAccessoSede({ sedeId: id, passwordHash: hash });
 } catch (e) {
 endActionOverlay();
 if (errAuth) errAuth.textContent = e?.message || String(e);
 }
}

function mostraAccessoSede() {
 window._sedeIdOverride = "";
 window._sedeAuthTarget = null;
 window._sedeEvSel = null;
 window._sedeSessSel = null;
 hide("loader");
 hide("sede-main");
 hide("master-main");
 hide("org-main");
 hide("reg-main");
 hide("user-main");
 show("sede-login");
 show("sede-login-pick");
 hide("sede-login-auth");
 _setSedeAccessHeader();
 const headSub = document.getElementById("sede-login-head-sub");
 if (headSub) headSub.textContent = "Seleziona il co-organizzatore per gestire eventi e iscrizioni";
 const errEl = document.getElementById("sede-login-err");
 if (errEl) {
 errEl.textContent = "";
 delete errEl.dataset.sticky;
 }
 const listEl = document.getElementById("sede-login-list");
 if (listEl) listEl.innerHTML = `<div class="sede-login-empty">Caricamento co-organizzatori…</div>`;
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 window._sedeLoginSedi = [];
 if (errEl) {
 errEl.textContent = res?.errore || "Impossibile caricare i co-organizzatori.";
 errEl.dataset.sticky = "1";
 }
 renderSedeLoginList();
 return;
 }
 window._sedeLoginSedi = Array.isArray(res.sedi) ? res.sedi : [];
 renderSedeLoginList();
 setTimeout(() => document.getElementById("sede-login-q")?.focus(), 120);
 })
 .withFailureHandler(err => {
 window._sedeLoginSedi = [];
 if (errEl) {
 errEl.textContent = err?.message || String(err) || "Errore di rete.";
 errEl.dataset.sticky = "1";
 }
 renderSedeLoginList();
 })
 .getSediAttivePubbliche();
}

function accediSede(sedeId) {
 const id = String(sedeId || "").trim();
 if (!id) return;
 window._sedeIdOverride = id;
 try {
 const url = new URL(window.location.href);
 url.searchParams.set("pagina", "partner");
 url.searchParams.set("uuid", id);
 url.searchParams.delete("sedeId");
 url.searchParams.delete("sede");
 history.replaceState({}, "", url.pathname + url.search + url.hash);
 } catch (_e) {}
 const sess = _sedeSessionLoad();
 if (sess && String(sess.sedeId).toLowerCase() === id.toLowerCase() && sess.sessionToken) {
 window._sedeSessionToken = sess.sessionToken;
 hide("sede-login");
 setHSub("Gestisci gli eventi come co-organizzatore");
 caricaAreaSede();
 return;
 }
 mostraAuthSede(id);
}

function tornaAccessoSede() {
 stopLiveSync();
 _sedeSessionClear();
 window._sedeIdOverride = "";
 window._sedeDati = null;
 window._sedeEvSel = null;
 window._sedeSessSel = null;
 try {
 const url = new URL(window.location.href);
 url.searchParams.set("pagina", "partner");
 url.searchParams.delete("uuid");
 url.searchParams.delete("sedeId");
 url.searchParams.delete("sede");
 url.searchParams.delete("token");
 history.replaceState({}, "", url.pathname + url.search + url.hash);
 } catch (_e) {}
 mostraAccessoSede();
}

function caricaAreaSede() {
 const cred = _sedeCredential();
 hide("master-main");
 hide("org-main");
 hide("reg-main");
 hide("user-main");
 hide("sede-login");
 if (!cred.sedeId) {
 mostraAccessoSede();
 return;
 }
 if (!cred.sessionToken) {
 mostraAuthSede(cred.sedeId);
 return;
 }
 setSedeDashboardHeader(true);
 setHSub("Gestisci gli eventi come co-organizzatore");
 setLdr("Caricamento area co-organizzatore…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 hide("master-main");
 show("sede-main");
 setSedeDashboardHeader(true);
 requestAnimationFrame(syncOrgHeaderOffset);
 if (!res || !res.ok) {
 const msg = String(res?.errore || "");
 if (/autenticat|sessione/i.test(msg)) {
 _sedeSessionClear();
 mostraAuthSede(cred.sedeId);
 const errAuth = document.getElementById("sede-auth-err");
 if (errAuth) errAuth.textContent = msg;
 return;
 }
 flash("sede-fa", "⚠️ " + (res?.errore || "Errore caricamento area co-organizzatore."), "err");
 return;
 }
 _applicaDatiSedeArea(res, { keepSelection: true });
 if (res.revision != null) noteLiveRevision(res.revision);
 startLiveSync("sede");
 })
 .withFailureHandler(err => {
 hide("loader");
 show("sede-main");
 flash("sede-fa", "❌ " + (err.message || err), "err");
 })
 .getDatiSedeArea(cred);
}

function _applicaDatiSedeArea(res, opts) {
 if (!res || !res.ok) return;
 window._sedeDati = res;
 if (Array.isArray(res.fasceEta)) applyFasceEtaConfig(res.fasceEta);
 const s = res.sede || {};
 const nomeEl = document.getElementById("s-nome");
 const refEl = document.getElementById("s-referente");
 const metaEl = document.getElementById("s-profile-meta");
 if (nomeEl) nomeEl.textContent = s.nomeSede || "Area Co-organizzatore";
 if (refEl) refEl.textContent = s.referente ? ("Referente: " + s.referente) : "";
 if (metaEl) {
 const bits = [];
 if (s.indirizzo) bits.push(`📍 <span>${escapeHtml(s.indirizzo)}</span>`);
 if (s.email) bits.push(`✉️ <span>${escapeHtml(s.email)}</span>`);
 if (s.cellulare) bits.push(`📞 <span>${escapeHtml(s.cellulare)}</span>`);
 metaEl.innerHTML = bits.length ? bits.join('<span aria-hidden="true"> · </span>') : "—";
 }
 const keepEv = opts && opts.keepSelection ? window._sedeEvSel : null;
 const keepSess = opts && opts.keepSelection ? window._sedeSessSel : null;
 _sedeRenderEventi(res.eventi || []);
 if (keepEv && _sedeEventiList().some(e => String(e.eventId) === String(keepEv))) {
 sedeApriEvento(keepEv, keepSess || null);
 }
}

function _sedeEventiList() {
 return Array.isArray(window._sedeDati?.eventi) ? window._sedeDati.eventi : [];
}

function _sedeNormKey(v) {
 return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function _sedeRuoloEvento(ev) {
 const sedeKey = _sedeNormKey(window._sedeDati?.sede?.nomeSede || "");
 if (!sedeKey || !ev) return "";
 const luogoKey = _sedeNormKey(ev.luogoNome || ev.luogo || "");
 const coorgKey = _sedeNormKey(ev.sedeCoorganizzatore || "");
 if (luogoKey && luogoKey === sedeKey) return "sede";
 if (coorgKey && coorgKey === sedeKey) return "coorg";
 return "";
}

function _sedeCountsForEvent(ev) {
 let pren = 0, pers = 0, occ = 0, max = 0, liberi = 0, pieni = 0;
 (ev.sessioni || []).forEach(sess => {
 (sess.tavoli || []).forEach(t => {
 const o = Math.max(0, parseInt(t.occupati || 0, 10) || 0);
 const m = Math.max(0, parseInt(t.max || 0, 10) || 0);
 occ += Math.min(o, m || o);
 max += m;
 const lib = Math.max(0, m - o);
 liberi += lib;
 if (m > 0 && o >= m) pieni++;
 const plist = Array.isArray(t.prenotazioni) ? t.prenotazioni : [];
 pren += plist.length;
 pers += plist.reduce((s, p) => s + (parseInt(p.numPersone || 1, 10) || 1), 0);
 });
 });
 return { pren, pers, occ, max, liberi, pieni, sessioni: (ev.sessioni || []).length };
}

function _sedeCountsForSessione(sess) {
 let pren = 0, pers = 0, occ = 0, max = 0, liberi = 0, tavoli = 0;
 (sess?.tavoli || []).forEach(t => {
 tavoli++;
 const o = Math.max(0, parseInt(t.occupati || 0, 10) || 0);
 const m = Math.max(0, parseInt(t.max || 0, 10) || 0);
 occ += Math.min(o, m || o);
 max += m;
 liberi += Math.max(0, m - o);
 const plist = Array.isArray(t.prenotazioni) ? t.prenotazioni : [];
 pren += plist.length;
 pers += plist.reduce((s, p) => s + (parseInt(p.numPersone || 1, 10) || 1), 0);
 });
 return { pren, pers, occ, max, liberi, tavoli };
}

function _sedeSetEventOpen(open) {
 document.getElementById("sede-main")?.classList.toggle("is-event-open", !!open);
}

function _sedeRenderEventi(eventi) {
 const el = document.getElementById("s-eventi-grid");
 if (!el) return;
 show("sede-lv1");
 hide("sede-step2");
 _sedeSetEventOpen(false);
 const list = Array.isArray(eventi) ? eventi : [];
 if (!list.length) {
 el.innerHTML = `<div class="mev-empty"><span class="empty-icon">🤝</span>Nessun evento. Usa il tuo nome come Luogo oppure come Co-organizzatore sull’evento.</div>`;
 return;
 }
 el.innerHTML = list.map((ev, i) => {
 const c = _sedeCountsForEvent(ev);
 const pct = c.max > 0 ? Math.round(c.occ / c.max * 100) : 0;
 const dataLabel = (typeof formatDataItaliana === "function" && ev.data)
 ? (formatDataItaliana(ev.data) || ev.data)
 : (ev.data || "");
 const evIdJs = String(ev.eventId || "").replace(/'/g, "\\'");
 return `
 <div class="mappa-ev-card" onclick="sedeApriEvento('${evIdJs}')" style="animation-delay:${i * 0.05}s">
 <div class="mev-nome">${escapeHtml(ev.nome || ev.eventId)}</div>
 <div class="mev-data">${[dataLabel, ev.luogoNome || ev.luogo].filter(Boolean).map(escapeHtml).join(" · ")}</div>
 <div class="mev-stats">
 <div class="mev-stat"><div class="mev-stat-n">${c.pren}</div><div class="mev-stat-l">Prenotaz.</div></div>
 <div class="mev-stat"><div class="mev-stat-n">${c.pers}</div><div class="mev-stat-l">Persone</div></div>
 <div class="mev-stat"><div class="mev-stat-n">${c.liberi}</div><div class="mev-stat-l">Liberi</div></div>
 <div class="mev-stat"><div class="mev-stat-n">${ev.passato ? "✓" : (ev.attivo ? "●" : "–")}</div><div class="mev-stat-l">${ev.passato ? "Passato" : (ev.attivo ? "Attivo" : "Off")}</div></div>
 </div>
 ${c.max > 0 ? `
 <div class="mev-progress"><div class="mev-progress-fill" style="width:${pct}%"></div></div>
 <div style="font-family:var(--font-m);font-size:10px;color:var(--ash);margin-bottom:12px">${c.occ}/${c.max} posti · ${pct}%</div>
 ` : ""}
 <div class="mev-cta">Vedi tavoli <span style="font-size:14px">→</span></div>
 </div>`;
 }).join("");
}

function sedeChiudiEvento() {
 window._sedeEvSel = null;
 window._sedeSessSel = null;
 show("sede-lv1");
 hide("sede-step2");
 _sedeSetEventOpen(false);
 window.scrollTo({ top: 0, behavior: "smooth" });
}

function sedeApriEvento(evId, preferSessId) {
 const ev = _sedeEventiList().find(e => String(e.eventId) === String(evId));
 if (!ev) return;
 window._sedeEvSel = String(evId);
 hide("sede-lv1");
 show("sede-step2");
 _sedeSetEventOpen(true);
 const titleEl = document.getElementById("sede-det-title");
 const metaEl = document.getElementById("sede-det-meta");
 const dataLabel = (typeof formatDataItaliana === "function" && ev.data)
 ? (formatDataItaliana(ev.data) || ev.data)
 : (ev.data || "");
 if (titleEl) titleEl.textContent = ev.nome || ev.eventId;
 if (metaEl) {
 const luogo = String(ev.luogoNome || ev.luogo || "").trim();
 const statusCls = ev.passato ? "past" : (ev.attivo ? "on" : "off");
 const statusTxt = ev.passato ? "Passato" : (ev.attivo ? "Attivo" : "Inattivo");
 metaEl.innerHTML = [
 dataLabel ? `<span>${escapeHtml(dataLabel)}</span>` : "",
 luogo ? `<span>${escapeHtml(luogo)}</span>` : "",
 `<span class="coorg-status ${statusCls}">${statusTxt}</span>`
 ].filter(Boolean).join('<span aria-hidden="true" style="opacity:.35">·</span>');
 }
 const sessioni = (ev.sessioni || []).slice();
 const prefer = preferSessId != null ? String(preferSessId) : "";
 let selIdx = 0;
 if (prefer) {
 const found = sessioni.findIndex(s => String(s.sessioneId) === prefer);
 if (found >= 0) selIdx = found;
 }
 const tabsEl = document.getElementById("sede-sess-tabs");
 const sessBar = document.getElementById("sede-sess-bar");
 const sessLabel = sessBar?.querySelector(".coorg-sess-label");
 if (sessLabel) sessLabel.textContent = sessioni.length > 1 ? "Sessioni" : "Sessione";
 if (tabsEl) {
 if (!sessioni.length) {
 tabsEl.innerHTML = "";
 if (sessBar) sessBar.style.display = "none";
 } else {
 if (sessBar) sessBar.style.display = "";
 const evEsc = String(evId).replace(/'/g, "\\'");
 const single = sessioni.length === 1;
 tabsEl.innerHTML = sessioni.map((s, i) => {
 const sid = String(s.sessioneId || "").replace(/'/g, "\\'");
 const sn = String(s.nome || s.sessioneId || "Sessione").replace(/'/g, "\\'");
 const active = i === selIdx || single;
 return `<button type="button" class="coorg-sess-tab${active ? " active" : ""}${single ? " single" : ""}" role="tab" aria-selected="${active ? "true" : "false"}" data-sess-id="${escapeHtml(String(s.sessioneId || ""))}"
 onclick="sedeSelezionaSess('${evEsc}','${sid}','${sn}',this)">
 <span class="coorg-sess-name">${escapeHtml(s.nome || s.sessioneId)}</span>
 ${s.orario ? `<span class="coorg-sess-time">${escapeHtml(s.orario)}</span>` : ""}
 </button>`;
 }).join("");
 }
 }
 if (sessioni.length) {
 window._sedeSessSel = sessioni[selIdx].sessioneId;
 _sedeRenderTavoli(evId, sessioni[selIdx].sessioneId);
 } else {
 window._sedeSessSel = null;
 const sum = document.getElementById("sede-sess-summary");
 if (sum) sum.innerHTML = "";
 const grid = document.getElementById("sede-tavoli-grid");
 if (grid) grid.innerHTML = `<div class="mev-empty" style="grid-column:1/-1"><span class="empty-icon">🧭</span>Nessuna sessione.</div>`;
 }
 window.scrollTo({ top: 0, behavior: "smooth" });
}

function sedeSelezionaSess(evId, sessId, _sessNome, btn) {
 window._sedeSessSel = sessId;
 document.querySelectorAll("#sede-sess-tabs .coorg-sess-tab").forEach(b => {
 b.classList.remove("active");
 b.setAttribute("aria-selected", "false");
 });
 if (btn) {
 btn.classList.add("active");
 btn.setAttribute("aria-selected", "true");
 }
 _sedeRenderTavoli(evId, sessId);
}

function _sedeRenderSessSummary(sess) {
 const el = document.getElementById("sede-sess-summary");
 if (!el) return;
 const c = _sedeCountsForSessione(sess);
 if (!c.tavoli) {
 el.innerHTML = "";
 return;
 }
 const chipCls = c.liberi === 0 ? "full" : (c.liberi <= 2 ? "warn" : "ok");
 el.innerHTML = `
 <div class="sede-chip"><strong>${c.pren}</strong>prenotazioni</div>
 <div class="sede-chip"><strong>${c.pers}</strong>persone</div>
 <div class="sede-chip ${chipCls}"><strong>${c.liberi}</strong>${c.liberi === 1 ? "libero" : "liberi"}</div>
 <div class="sede-chip"><strong>${c.occ}/${c.max || "—"}</strong>occupati</div>
 <div class="sede-chip"><strong>${c.tavoli}</strong>tavoli</div>`;
}

function _sedeRenderTavoli(evId, sessId) {
 const grid = document.getElementById("sede-tavoli-grid");
 if (!grid) return;
 const ev = _sedeEventiList().find(e => String(e.eventId) === String(evId));
 if (!ev) {
 grid.innerHTML = "";
 return;
 }
 const sess = (ev.sessioni || []).find(s => String(s.sessioneId) === String(sessId));
 _sedeRenderSessSummary(sess);
 const tavoli = Array.isArray(sess?.tavoli) ? sess.tavoli : [];
 const canMutate = !ev.passato && !!ev.attivo;
 if (!tavoli.length) {
 grid.innerHTML = `<div class="mev-empty" style="grid-column:1/-1"><span class="empty-icon">🎲</span>Nessun tavolo in questa sessione.</div>`;
 return;
 }
 grid.innerHTML = tavoli.map(t => {
 const occ = Math.max(0, parseInt(t.occupati || 0, 10) || 0);
 const max = Math.max(0, parseInt(t.max || 0, 10) || 0);
 const pct = max > 0 ? Math.round(Math.min(occ, max) / max * 100) : 0;
 const lib = Math.max(0, max - occ);
 const barColor = pct >= 100 ? "#c62828" : pct >= 70 ? "#e65100" : "#2e7d32";
 const libCls = lib === 0 ? "zero" : lib <= 2 ? "pochi" : "ok";
 const libTxt = lib === 0 ? "Tavolo pieno" : lib === 1 ? "1 posto libero" : `${lib} posti liberi`;
 const pren = Array.isArray(t.prenotazioni) ? t.prenotazioni : [];
 const personeHtml = pren.length
 ? pren.map(p => {
 const numP = Math.max(1, parseInt(p.numPersone || 1, 10) || 1);
 const nome = String(p.nome || "—").trim() || "—";
 const iniziale = nome.charAt(0).toUpperCase();
 const email = String(p.email || "").trim();
 const fascia = labelsFasciaCsv ? (labelsFasciaCsv(p.fasciaEta) || "") : String(p.fasciaEta || "");
 const detail = [email, fascia].filter(Boolean).map(escapeHtml).join(" · ");
 return `<div class="mtav-persona">
 <div class="mtav-persona-top">
 <div class="mtav-avatar">${escapeHtml(iniziale)}</div>
 <div class="mtav-pinfo">
 <div class="mtav-pnome">${escapeHtml(nome)}${numP > 1 ? ` <span style="color:var(--ash);font-weight:600">(+${numP - 1})</span>` : ""}</div>
 ${detail ? `<div class="mtav-pdetail">${detail}</div>` : ""}
 </div>
 <div class="mtav-pnum">×${numP}</div>
 </div>
 </div>`;
 }).join("")
 : `<div style="font-size:12px;color:var(--ash);font-style:italic;padding:8px 4px">Nessun partecipante ancora</div>`;
 const ctx = {
 eventId: ev.eventId,
 sessioneId: sess.sessioneId,
 tavoloId: t.id,
 eventNome: ev.nome,
 sessioneNome: sess.nome,
 tavoloNome: t.gioco || t.id,
 fasce: t.fasce || [],
 fasciaEtaMinima: t.fasciaEtaMinima || ""
 };
 const foot = (canMutate && lib > 0)
 ? `<div class="mtav-card-actions"><button type="button" class="btn btn-s btn-sm" onclick='event.stopPropagation();apriSedeIscriviPopup(${JSON.stringify(ctx)})'>➕ Aggiungi iscritto</button></div>`
 : (lib === 0
 ? `<div class="sede-mtav-foot">Nessun posto libero · non puoi aggiungere iscritti</div>`
 : (ev.passato ? `<div class="sede-mtav-foot">Evento passato</div>` : `<div class="sede-mtav-foot">Evento non attivo</div>`));
 return `<div class="mtav-card sede-mtav">
 <div class="mtav-head">
 <div>
 <div class="mtav-nome">${escapeHtml(t.gioco || t.id || "Tavolo")}</div>
 <div class="mtav-count">${occ}/${max || "—"} · ${pct}%</div>
 </div>
 <div class="mtav-liberi ${libCls}">${libTxt}</div>
 </div>
 <div class="mtav-bar-wrap"><div class="mtav-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
 <div class="mtav-body">${personeHtml}</div>
 ${foot}
 </div>`;
 }).join("");
}

function apriSedeIscriviPopup(ctx) {
 const c = ctx || {};
 window._sedeIscriviCtx = c;
 const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? "" : String(v); };
 set("s-isc-event-id", c.eventId || "");
 set("s-isc-sessione-id", c.sessioneId || "");
 set("s-isc-tavolo-id", c.tavoloId || "");
 set("s-isc-nome", "");
 set("s-isc-email", "");
 set("s-isc-cell", "");
 set("s-isc-num", "1");
 const ctxEl = document.getElementById("s-isc-ctx");
 if (ctxEl) {
 ctxEl.textContent = [c.eventNome, c.sessioneNome, c.tavoloNome].filter(Boolean).join(" · ");
 }
 const sel = document.getElementById("s-isc-fascia");
 if (sel) {
 const fasce = Array.isArray(c.fasce) ? c.fasce : [];
 const opts = [`<option value="">—</option>`].concat(
 (fasce.length ? fasce : (FASCE_ETA || [])).map(f => {
 const id = typeof f === "string" ? f : String(f.id || f.fasciaId || f.label || "");
 const label = typeof f === "string" ? f : String(f.label || f.nome || id);
 return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
 })
 );
 sel.innerHTML = opts.join("");
 }
 const cb = document.getElementById("s-isc-email-send");
 if (cb) cb.checked = false;
 show("sede-iscrivi-overlay");
}

function chiudiSedeIscriviPopup() {
 hide("sede-iscrivi-overlay");
}

function confermaSedeIscrivi() {
 const cred = _sedeCredential();
 const payload = {
 eventId: String(document.getElementById("s-isc-event-id")?.value || "").trim(),
 sessioneId: String(document.getElementById("s-isc-sessione-id")?.value || "").trim(),
 idTavolo: String(document.getElementById("s-isc-tavolo-id")?.value || "").trim(),
 nome: String(document.getElementById("s-isc-nome")?.value || "").trim(),
 email: String(document.getElementById("s-isc-email")?.value || "").trim(),
 cellulare: String(document.getElementById("s-isc-cell")?.value || "").trim(),
 numPersone: Math.max(1, parseInt(document.getElementById("s-isc-num")?.value || "1", 10) || 1),
 fasciaEta: String(document.getElementById("s-isc-fascia")?.value || "").trim(),
 inviaEmail: !!document.getElementById("s-isc-email-send")?.checked
 };
 if (!payload.nome) {
 flash("sede-fa", "Inserisci il nome.", "err");
 return;
 }
 beginActionOverlay("Registrazione iscrizione…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("sede-fa", "⚠️ " + (res?.errore || "Impossibile registrare l'iscrizione."), "err");
 return;
 }
 chiudiSedeIscriviPopup();
 flash("sede-fa", "✅ " + (res.messaggio || "Iscrizione registrata."), "ok");
 caricaAreaSede();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("sede-fa", "❌ " + (err.message || err), "err");
 })
 .sedeAggiungiIscrittoTavolo(cred, payload);
}

function caricaAreaMaster() {
 setMasterDashboardHeader(true);
 const cred = _masterCredential();
 if (!cred.masterId && !cred.masterToken) {
 hide("loader");
 show("master-main");
 flash("master-fa", "Link master non valido: credenziali mancanti.", "err");
 requestAnimationFrame(syncOrgHeaderOffset);
 return;
 }
 setLdr("Caricamento area master…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 show("master-main");
 setMasterDashboardHeader(true);
 requestAnimationFrame(syncOrgHeaderOffset);
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Errore caricamento area master."), "err");
 return;
 }
 if (Array.isArray(res.fasceEta)) {
 applyFasceEtaConfig(res.fasceEta);
 }
 datiMaster = res;
 const mn = document.getElementById("m-nome");
 const mNickEl = document.getElementById("m-nick");
 const nomeM = String(res.master?.nome || "").trim();
 const nickM = String(res.master?.nick || "").trim();
 if (mn) mn.textContent = nomeM || "Area Master";
 if (mNickEl) {
 if (nickM && nickM !== nomeM) {
 mNickEl.textContent = nickM;
 mNickEl.style.display = "";
 } else {
 mNickEl.textContent = "";
 mNickEl.style.display = "none";
 }
 }
 document.getElementById("m-email").textContent = String(res.master?.email || "—");
 document.getElementById("m-cell").textContent = String(res.master?.cellulare || "—");
 _masterRenderAvventure(res.avventure || []);
 _masterRenderTavoliDisponibili(res.sessioniDisponibiliMaster || res.tavoliDisponibiliMaster || []);
 _masterRenderImpegni(res.impegniMaster || []);
 _masterFillForm(res);
 })
 .withFailureHandler(err => {
 hide("loader");
 show("master-main");
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .getDatiMasterArea(cred);
}

function salvaNuovaAvventuraDaMaster() {
 const cred = _masterCredential();
 const sistemaGioco = _masterGetSistemaGiocoValue();
 const payload = {
 titoloAvventura: String(document.getElementById("m-new-titolo")?.value || "").trim(),
 sistemaGioco: sistemaGioco,
 livello: String(document.getElementById("m-new-livello")?.value || "").trim(),
 tipo: String(document.getElementById("m-new-tipo")?.value || "GDR").trim().toUpperCase(),
 max: Math.max(1, parseInt(document.getElementById("m-new-max")?.value || 6, 10) || 6),
 descrizione: String(document.getElementById("m-new-descr")?.value || "").trim(),
 tema: String(document.getElementById("m-new-tema")?.value || "").trim(),
 ambientazione: String(document.getElementById("m-new-ambientazione")?.value || "").trim(),
 fasciaEtaMinima: String(document.getElementById("m-new-fascia-min")?.value || "").trim(),
 mostraMaster: true
 };
 const btn = document.getElementById("m-new-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Creazione avventura…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (!res || !res.ok) {
 flash("master-fa", "⚠️ " + (res?.errore || "Impossibile creare l'avventura."), "err");
 return;
 }
 document.getElementById("m-new-titolo").value = "";
 const sysSel = document.getElementById("m-new-sistema");
 const sysCustom = document.getElementById("m-new-sistema-custom");
 if (sysSel) sysSel.value = "";
 if (sysCustom) {
 sysCustom.value = "";
 sysCustom.classList.add("hidden");
 }
 document.getElementById("m-new-descr").value = "";
 const nTema = document.getElementById("m-new-tema");
 const nAmb = document.getElementById("m-new-ambientazione");
 if (nTema) nTema.value = "";
 if (nAmb) nAmb.value = "";
 const nl = document.getElementById("m-new-livello");
 if (nl) nl.value = "";
 flash("master-fa", "✅ " + (res.messaggio || "Avventura creata."), "ok");
 chiudiMasterNuovaAvventuraPopup();
 caricaAreaMaster();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 flash("master-fa", "❌ " + (err.message || err), "err");
 })
 .salvaNuovaAvventuraMaster(cred, payload);
}
function avviaSchermataInvitoPartecipante(token) {
 if (_inviteFlowAvviato) return;
 const t = String(token || "").trim();
 if (!t) return;
 _inviteFlowAvviato = true;
 window.removeEventListener("message", gildaInviteFromParent);
 _inviteTokenCorrente = t;
 _inviteNascondiContenutoReg();
 setAppTitle("Invito");
 setHSub("Invito come partecipante");
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 hide("loader");
 show("reg-main");
 flash("reg-fa", "Invito disponibile solo in ambiente Apps Script.", "err");
 _inviteRipristinaVistaReg();
 return;
 }
 setLdr("Caricamento invito…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (!res || !res.ok) {
 _inviteFlowAvviato = false;
 _inviteTokenCorrente = null;
 show("reg-main");
 _inviteRipristinaVistaReg();
 flash("reg-fa", "⚠️ " + (res?.errore || "Impossibile caricare l’invito."), "err");
 return;
 }
 show("reg-main");
 if (res.giaAccettato && res.uuid) {
 renderInviteGiaAccettato(res);
 } else {
 renderInviteDettaglio(res);
 }
 show("invite-partecipante-wrap");
 })
 .withFailureHandler(err => {
 hide("loader");
 _inviteFlowAvviato = false;
 _inviteTokenCorrente = null;
 show("reg-main");
 _inviteRipristinaVistaReg();
 flash("reg-fa", "❌ " + (err.message || err), "err");
 })
 .getDettaglioInvitoPartecipante(t);
}

// ── INIT ─────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
 applyHeaderBackgroundFromConfig();
 console.log("[app] build:", BUILD_ID, "| mode:", MODE, "| pagina:", PAGINA, "| uuid:", UUID ? "yes" : "no");
 updateMobileHeaderTopbar();
 // Due frame: misura header dopo layout (prenotazione/utente inclusi).
 requestAnimationFrame(() => {
 syncOrgHeaderOffset();
 requestAnimationFrame(syncOrgHeaderOffset);
 });
 // Watchdog: evita schermata bianca se qualcosa interrompe il bootstrap.
 setTimeout(ensureInitialViewVisible, 1200);
 if (String(PAGINA || "").toLowerCase().trim() === "feedback") { avviaModuloFeedback(); return; }
 if (MODE === "org") {
 document.body.classList.add("mode-org");
 hide("loader"); show("org-login");
 setOrgDashboardHeader(false);
 setTimeout(() => document.getElementById("org-pwd")?.focus(), 150);
 setAppTitle("Dashboard organizzatore");
 setHSub("Pannello Organizzatore");
 // carica opzioni Config (es. priorità lista d'attesa) per prefilling UI
 if (typeof google !== "undefined" && google.script && google.script.run) {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 WAITLIST_PRIORITY_ENABLED = !!res.USE_WAITLIST_PRIORITY;
 WAITLIST_ACTIONS_ENABLED = !!res.ENABLE_WAITLIST_ACTIONS;
 WAITLIST_PROMEMORIA_ENABLED = !!res.ENABLE_WAITLIST_PROMEMORIA;
 EXPORT_CSV_EVENTO_ENABLED = (res.ENABLE_EXPORT_CSV_EVENTO !== false);
 const cb = document.getElementById("cfg-waitlist-priority");
 if (cb) cb.checked = WAITLIST_PRIORITY_ENABLED;
 const cb2 = document.getElementById("cfg-waitlist-actions");
 if (cb2) cb2.checked = WAITLIST_ACTIONS_ENABLED;
 const cb3 = document.getElementById("cfg-waitlist-promemoria");
 if (cb3) cb3.checked = WAITLIST_PROMEMORIA_ENABLED;
 const cb4 = document.getElementById("cfg-export-csv-evento");
 if (cb4) cb4.checked = EXPORT_CSV_EVENTO_ENABLED;
 const cbArch = document.getElementById("cfg-email-copia-archivio");
 if (cbArch) cbArch.checked = (res.ENABLE_EMAIL_COPIA_ARCHIVIO !== false);
 const cbArchAvvisi = document.getElementById("cfg-email-copia-archivio-avvisi");
 if (cbArchAvvisi) cbArchAvvisi.checked = (res.ENABLE_EMAIL_COPIA_ARCHIVIO_AVVISI !== false);
 const cbEmailLogOrg = document.getElementById("cfg-email-log-org");
 if (cbEmailLogOrg) cbEmailLogOrg.checked = (res.ENABLE_EMAIL_LOG_ORG !== false);
 if (typeof syncCopiaArchivioCheckboxes === "function") syncCopiaArchivioCheckboxes();
 const cbEmailTestOk = document.getElementById("cfg-email-test-ok");
 if (cbEmailTestOk) cbEmailTestOk.checked = !!res.EMAIL_TEST_FUNZIONANO;
 const lastProof = document.getElementById("email-test-last-proof");
 if (lastProof) lastProof.textContent = res.EMAIL_TEST_ULTIMA_PROVA || "—";
 const hint = document.getElementById("reg-attesa-pref-hint");
 if (hint) {
 hint.textContent = WAITLIST_PRIORITY_ENABLED
 ? "Seleziona i tavoli pieni su cui vuoi essere messo in lista d'attesa, nell'ordine di preferenza (il primo è il più desiderato)."
 : "Seleziona i tavoli pieni su cui vuoi essere messo in lista d'attesa.";
 }
 }
 })
 .withFailureHandler(() => {})
 .getOpzioniConfig();
 }
 return;
 }
 window.addEventListener("message", gildaInviteFromParent);
 window.addEventListener("message", gildaMasterFromParent);
 const params = new URLSearchParams(window.location.search);
 const paginaNorm = String(PAGINA || "").toLowerCase().trim();
 const uuidFromUrlEarly = String(params.get("uuid") || "").trim();
 const masterTokenFromUrl = String(params.get("masterToken") || params.get("token") || "").trim();
 const masterIdFromUrl = String(params.get("masterId") || params.get("master") || "").trim();
 const masterTokenTemplate = (typeof MASTER_TOKEN !== "undefined") ? MASTER_TOKEN : "";
 const masterIdTemplate = (typeof MASTER_ID !== "undefined") ? MASTER_ID : "";
 const hasMasterCred = !!(masterTokenFromUrl || masterIdFromUrl || masterTokenTemplate || masterIdTemplate
 || (paginaNorm === "master" && uuidFromUrlEarly));
 if (paginaNorm === "master" || hasMasterCred) {
 setAppTitle("Area Master");
 setMasterDashboardHeader(true);
 setHSub("Gestisci le tue avventure");
 caricaAreaMaster();
 return;
 }
 const sedeIdFromUrl = String(params.get("sedeId") || params.get("sede") || "").trim();
 const sedeIdTemplate = (typeof SEDE_ID !== "undefined") ? SEDE_ID : "";
 const isPartnerPage = paginaNorm === "partner" || paginaNorm === "sede";
 const hasSedeCred = !!(sedeIdFromUrl || sedeIdTemplate || (isPartnerPage && uuidFromUrlEarly));
 if (isPartnerPage || hasSedeCred) {
 setAppTitle("Area Co-organizzatore");
 if (hasSedeCred) {
 const sedeIdBoot = String(sedeIdFromUrl || sedeIdTemplate || uuidFromUrlEarly || "").trim();
 const sessBoot = _sedeSessionLoad();
 if (sessBoot && sessBoot.sessionToken &&
 String(sessBoot.sedeId || "").toLowerCase() === sedeIdBoot.toLowerCase()) {
 window._sedeSessionToken = sessBoot.sessionToken;
 window._sedeIdOverride = sedeIdBoot;
 setSedeDashboardHeader(true);
 setHSub("Gestisci gli eventi come co-organizzatore");
 caricaAreaSede();
 } else {
 mostraAuthSede(sedeIdBoot);
 }
 } else {
 mostraAccessoSede();
 }
 return;
 }
 // Accoglienza: vista standalone con login
 if (paginaNorm === "accoglienza") {
 hide("reg-main"); hide("org-main");
 hide("loader"); show("accoglienza-login");
 setAppTitle("Accoglienza");
 setHSub("Check-in e gestione arrivi");
 const ht = document.getElementById("h-title");
 if (ht) ht.textContent = "🚪 Accoglienza";
 setTimeout(() => document.getElementById("acc-pwd")?.focus(), 150);
 return;
 }
 const uuidFromUrl = uuidFromUrlEarly;
 if (uuidFromUrl && uuidFromUrl !== "undefined") {
 setAppTitle("Le mie prenotazioni");
 setHSub("Gestisci la tua prenotazione");
 caricaUtente();
 return;
 }
 const inviteTokenFromUrl = params.get("inviteToken");
 const inviteToken = (inviteTokenFromUrl && String(inviteTokenFromUrl).trim())
 || _inviteTokenDaDoGet()
 || "";
 if (inviteToken) {
 avviaSchermataInvitoPartecipante(inviteToken);
 return;
 }
 if (UUID && UUID.trim() && UUID !== "undefined") {
 setAppTitle("Le mie prenotazioni");
 setHSub("Gestisci la tua prenotazione");
 caricaUtente();
 return;
 }
 // Se viene aperta esplicitamente la pagina utente senza UUID,
 // mostra direttamente il recupero link invece del modulo di prenotazione.
 if ((PAGINA || "").toLowerCase().trim() === "utente") {
 hide("loader");
 show("reg-main");
 hide("reg-panel");
 show("reg-recupera");
 setAppTitle("Le mie prenotazioni");
 setHSub("Recupera il tuo link personale");
 return;
 }
 setAppTitle("Prenotazioni");
 setHSub("Scegli l'evento e prenota in pochi click");
 caricaEventiReg();
});

function applyHeaderBackgroundFromConfig() {
 const header = document.getElementById("app-header");
 if (!header) return;
 const raw = String(HEADER_BACKGROUND_IMAGE_URL || "").trim();
 if (!raw) return;
 const safeUrl = raw.replace(/"/g, "%22");
 header.style.setProperty("--header-bg-image", `url("${safeUrl}")`);
 header.classList.add("header-bg-image");
}

window.addEventListener("resize", () => {
 updateMobileHeaderTopbar();
 syncOrgHeaderOffset();
 applyStoricoStatsLayout();
});

window.addEventListener("scroll", () => {
 updateMobileHeaderTopbar();
}, { passive: true });

function updateMobileHeaderTopbar() {
 const header = document.getElementById("app-header");
 if (!header) return;
 const isMobile = window.matchMedia && window.matchMedia("(max-width: 820px)").matches;
 if (!isMobile) {
 header.classList.remove("mobile-compact");
 document.body.classList.remove("mobile-topbar-on");
 syncOrgHeaderOffset();
 return;
 }
 const y = window.scrollY || window.pageYOffset || 0;
 const compact = y > 10;
 header.classList.toggle("mobile-compact", compact);
 document.body.classList.toggle("mobile-topbar-on", compact);
 syncOrgHeaderOffset();
}

// ── MODULO FEEDBACK POST-EVENTO (pagina partecipante, link via email) ──
let FEEDBACK_STATO = null;

function _feedbackMsg(titolo, testo) {
 return `<div class="feedback-card"><h2 class="feedback-title">${escapeHtml(titolo)}</h2>${testo ? `<p class="feedback-sub">${escapeHtml(testo)}</p>` : ""}</div>`;
}

function avviaModuloFeedback() {
 hide("loader");
 show("feedback-main");
 setAppTitle("Il tuo feedback");
 setHSub("Racconta com'è andata");
 const root = document.getElementById("feedback-root");
 const p = FEEDBACK_PARAMS || {};
 if (!UUID || !p.evento || !p.sessione) {
 root.innerHTML = _feedbackMsg("Link non valido", "Apri il link che hai ricevuto via email.");
 return;
 }
 root.innerHTML = _feedbackMsg("Caricamento…", "");
 if (typeof google === "undefined" || !google.script || !google.script.run) {
 root.innerHTML = _feedbackMsg("Non disponibile", "Riprova più tardi.");
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 root.innerHTML = _feedbackMsg("Link non valido", (res && res.errore) || "Riprova più tardi.");
 return;
 }
 FEEDBACK_STATO = Object.assign({}, res, { eventId: p.evento, sessioneId: p.sessione, uuid: UUID });
 if (res.giaInviato) {
 root.innerHTML = _feedbackMsg("Grazie!", "Hai già inviato il feedback per questa sessione.");
 return;
 }
 _feedbackRenderForm(FEEDBACK_STATO);
 })
 .withFailureHandler(err => {
 root.innerHTML = _feedbackMsg("Errore", (err && err.message) || "Riprova più tardi.");
 })
 .getModuloFeedbackContext(p.evento, p.sessione, UUID);
}

function _feedbackCampoHtml(d) {
 const req = d.obbligatoria ? '<span class="fb-req"> *</span>' : "";
 if (d.tipo === "voto") {
 return `<fieldset class="fb-q"><legend>${escapeHtml(d.testo)}${req}</legend>
 <div class="fb-opzioni">${[1, 2, 3, 4, 5].map(n => `<label class="fb-opt"><input type="radio" name="${d.id}" value="${n}"><span>${n}</span></label>`).join("")}</div></fieldset>`;
 }
 if (d.tipo === "si_no") {
 return `<fieldset class="fb-q"><legend>${escapeHtml(d.testo)}${req}</legend>
 <div class="fb-opzioni"><label class="fb-opt"><input type="radio" name="${d.id}" value="si"><span>Sì</span></label><label class="fb-opt"><input type="radio" name="${d.id}" value="no"><span>No</span></label></div></fieldset>`;
 }
 if (d.tipo === "scelta_multipla") {
 return `<fieldset class="fb-q"><legend>${escapeHtml(d.testo)}${req}</legend>
 <div class="fb-opzioni">${(d.opzioni || []).map(o => `<label class="fb-opt"><input type="checkbox" name="${d.id}" value="${escapeHtml(o)}"><span>${escapeHtml(o)}</span></label>`).join("")}</div></fieldset>`;
 }
 return `<label class="fb-q"><span class="fb-q-testo">${escapeHtml(d.testo)}</span>
 <textarea name="${d.id}" rows="3" maxlength="1000" placeholder="Facoltativo"></textarea></label>`;
}

function _feedbackRenderForm(st) {
 const root = document.getElementById("feedback-root");
 const sessTxt = st.sessNome && st.sessNome !== st.evNome ? " · " + escapeHtml(st.sessNome) : "";
 const intro = `Ciao${st.nome ? " " + escapeHtml(st.nome) : ""}! Com'è andata <strong>${escapeHtml(st.evNome)}</strong>${sessTxt}?`;
 const titolo = st.tipo === "GDT" ? "Feedback · Gioco libero" : "Feedback · Tavoli GDR";
 const campi = (st.domande || []).map(_feedbackCampoHtml).join("");
 root.innerHTML = `<div class="feedback-card">
 <h2 class="feedback-title">${titolo}</h2>
 <p class="feedback-sub">${intro}</p>
 <form id="fb-form" onsubmit="event.preventDefault();feedbackInvia();">${campi}
 <div class="feedback-err hidden" id="fb-err"></div>
 <button type="submit" class="btn btn-s" id="fb-send">Invia feedback</button>
 </form>
 </div>`;
}

function feedbackInvia() {
 const st = FEEDBACK_STATO;
 if (!st) return;
 const errEl = document.getElementById("fb-err");
 const risposte = {};
 let manca = false;
 (st.domande || []).forEach(d => {
 let v = "";
 if (d.tipo === "testo") v = (document.querySelector(`textarea[name="${d.id}"]`)?.value || "").trim();
 else if (d.tipo === "scelta_multipla") v = [...document.querySelectorAll(`input[name="${d.id}"]:checked`)].map(x => x.value);
 else v = document.querySelector(`input[name="${d.id}"]:checked`)?.value || "";
 if (d.obbligatoria && (!v || (Array.isArray(v) && !v.length))) manca = true;
 risposte[d.id] = v;
 });
 if (manca) {
 errEl.textContent = "Rispondi a tutte le domande contrassegnate con *.";
 errEl.classList.remove("hidden");
 return;
 }
 errEl.classList.add("hidden");
 const btn = document.getElementById("fb-send");
 btn.disabled = true;
 btn.textContent = "Invio in corso…";
 const ripristina = (msg) => {
 btn.disabled = false;
 btn.textContent = "Invia feedback";
 errEl.textContent = msg || "Errore durante il salvataggio.";
 errEl.classList.remove("hidden");
 };
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 document.getElementById("feedback-root").innerHTML = _feedbackMsg("Grazie!", res.messaggio || "Il tuo feedback è stato registrato.");
 return;
 }
 ripristina(res && res.errore);
 })
 .withFailureHandler(err => ripristina(err && err.message))
 .salvaModuloFeedback({ eventId: st.eventId, sessioneId: st.sessioneId, uuid: st.uuid, risposte: risposte });
}

// ── Organizzatore: invio modulo a tutti gli iscritti della sessione ──
function _orgFeedbackBtnHtml(evId, sessId, tipo) {
 const jsEv = _orgJsArg(evId);
 const jsSess = _orgJsArg(sessId);
 return `<button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();orgInviaModuloFeedback('${jsEv}','${jsSess}')">📝 Invia modulo feedback</button>
 <button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();orgApriModuliFeedback('${jsEv}','${tipo}')">⚙️ Domande</button>`;
}

function orgInviaModuloFeedback(evId, sessId) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) return;
 beginActionOverlay("Invio del modulo feedback…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) flash("org-fa", "✅ " + res.messaggio, "ok");
 else flash("org-fa", "⚠️ " + ((res && res.errore) || "Errore nell'invio."), "err");
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ Errore: " + ((err && err.message) || err), "err");
 })
 .inviaModuloFeedback(evId, sessId);
}

// ── EDITOR DOMANDE FEEDBACK (organizzatore) ──
let MODFB_STATO = null;
const MODFB_TIPI_UI = [["voto","Voto 1-5"],["si_no","Sì / No"],["testo","Testo libero"],["scelta_multipla","Scelta multipla"]];

function _modfbGoogleOk() {
 return typeof google !== "undefined" && google.script && google.script.run;
}

/** Carica le domande di uno scope; se provaEvento e l'evento non ha versione propria, ricade sul globale. */
function _modfbCarica(scope, evId, tipo, provaEvento) {
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) { endActionOverlay(); flash("org-fa", "⚠️ " + ((res && res.errore) || "Errore nel caricamento."), "err"); return; }
 if (provaEvento && !res.hasOverride) { _modfbCarica(tipo, evId, tipo, false); return; }
 endActionOverlay();
 MODFB_STATO = { evId: evId, tipo: tipo, scope: res.scope, domande: res.domande || [] };
 show("modfb-overlay");
 _modfbRender();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ Errore: " + ((err && err.message) || err), "err");
 })
 .getModuloFeedbackAdmin(scope, evId, tipo);
}

function orgApriModuliFeedback(evId, tipo) {
 if (!_modfbGoogleOk()) return;
 beginActionOverlay("Carico le domande…");
 _modfbCarica("EVENTO:" + evId + ":" + tipo, evId, tipo, true);
}

function _modfbLeggi() {
 return [...document.querySelectorAll("#modfb-righe .modfb-row")].map(r => {
 const ta = r.querySelector(".modfb-opz");
 return {
 id: r.dataset.id || "",
 testo: r.querySelector(".modfb-testo").value.trim(),
 tipo: r.querySelector(".modfb-tipo").value,
 obbligatoria: r.querySelector(".modfb-obb").checked,
 opzioni: ta ? ta.value.split("\n").map(s => s.trim()).filter(Boolean) : []
 };
 });
}

function _modfbRigaHtml(d, i) {
 const opts = MODFB_TIPI_UI.map(([v, l]) => `<option value="${v}"${d.tipo === v ? " selected" : ""}>${l}</option>`).join("");
 const opz = d.tipo === "scelta_multipla"
 ? `<textarea class="modfb-opz" rows="3" placeholder="Una opzione per riga" style="width:100%;margin-top:6px">${escapeHtml((d.opzioni || []).join("\n"))}</textarea>`
 : "";
 return `<div class="modfb-row" data-idx="${i}" data-id="${escapeHtml(d.id || "")}" style="border:1px solid rgba(201,146,42,.35);border-radius:8px;padding:10px;margin-bottom:8px">
 <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
 <input class="modfb-testo" type="text" value="${escapeHtml(d.testo || "")}" placeholder="Testo della domanda" style="flex:1 1 260px">
 <select class="modfb-tipo" onchange="modfbCambiaTipo(this)">${opts}</select>
 <label style="font-size:13px"><input type="checkbox" class="modfb-obb"${d.obbligatoria ? " checked" : ""}> obbligatoria</label>
 </div>
 ${opz}
 <div style="display:flex;gap:6px;margin-top:6px">
 <button class="btn btn-o btn-sm" type="button" onclick="modfbMuovi(${i},-1)">↑</button>
 <button class="btn btn-o btn-sm" type="button" onclick="modfbMuovi(${i},1)">↓</button>
 <button class="btn btn-d btn-sm" type="button" onclick="modfbElimina(${i})">✕ Elimina</button>
 </div>
 </div>`;
}

function _modfbRender() {
 const st = MODFB_STATO;
 const body = document.getElementById("modfb-body");
 if (!st || !body) return;
 const isEv = st.scope.indexOf("EVENTO:") === 0;
 const azioni = [];
 if (isEv) {
 azioni.push(`<button class="btn btn-o btn-sm" type="button" onclick="modfbVaiGlobale()">📄 Modifica il modulo globale</button>`);
 azioni.push(`<button class="btn btn-d btn-sm" type="button" onclick="modfbTornaGlobale()">↩ Usa il globale per questo evento</button>`);
 } else if (st.evId) {
 azioni.push(`<button class="btn btn-s btn-sm" type="button" onclick="modfbCreaEvento()">➕ Crea una versione per questo evento</button>`);
 }
 const descr = isEv
 ? "Questo evento usa queste domande al posto del modulo globale."
 : "Le modifiche valgono per tutti gli eventi che usano il modulo globale.";
 body.innerHTML = `<p class="hint" style="margin-bottom:10px"><strong>${isEv ? "Versione per questo evento" : "Modulo globale"} · ${escapeHtml(st.tipo)}</strong><br>${descr}</p>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${azioni.join("")}</div>
 <div id="modfb-righe">${st.domande.map(_modfbRigaHtml).join("")}</div>
 <button class="btn btn-o btn-sm" type="button" onclick="modfbAggiungi()" style="margin-top:4px">+ Aggiungi domanda</button>`;
}

function _modfbImposta(domande) {
 MODFB_STATO.domande = domande;
 _modfbRender();
}

function modfbAggiungi() {
 _modfbImposta(_modfbLeggi().concat([{ id: "", testo: "", tipo: "voto", obbligatoria: true, opzioni: [] }]));
}

function modfbElimina(i) {
 const arr = _modfbLeggi();
 arr.splice(i, 1);
 _modfbImposta(arr);
}

function modfbMuovi(i, dir) {
 const arr = _modfbLeggi();
 const j = i + dir;
 if (j < 0 || j >= arr.length) return;
 [arr[i], arr[j]] = [arr[j], arr[i]];
 _modfbImposta(arr);
}

function modfbCambiaTipo(sel) {
 const arr = _modfbLeggi();
 const i = parseInt(sel.closest(".modfb-row").dataset.idx, 10);
 if (arr[i]) arr[i].tipo = sel.value;
 _modfbImposta(arr);
}

function modfbSalva() {
 const st = MODFB_STATO;
 if (!st || !_modfbGoogleOk()) return;
 const domande = _modfbLeggi();
 const btn = document.getElementById("modfb-save");
 btn.disabled = true;
 google.script.run
 .withSuccessHandler(res => {
 btn.disabled = false;
 if (res && res.ok) {
 hide("modfb-overlay");
 flash("org-fa", "✅ " + res.messaggio, "ok");
 } else {
 flash("org-fa", "⚠️ " + ((res && res.errore) || "Errore nel salvataggio."), "err");
 }
 })
 .withFailureHandler(err => {
 btn.disabled = false;
 flash("org-fa", "❌ Errore: " + ((err && err.message) || err), "err");
 })
 .salvaModuloFeedbackAdmin(st.scope, domande);
}

function modfbVaiGlobale() {
 const st = MODFB_STATO;
 if (!st) return;
 beginActionOverlay("Carico il modulo globale…");
 _modfbCarica(st.tipo, st.evId, st.tipo, false);
}

function _modfbAzioneEvento(metodo) {
 const st = MODFB_STATO;
 if (!st || !_modfbGoogleOk()) return;
 beginActionOverlay("Aggiorno il modulo…");
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 flash("org-fa", "✅ " + res.messaggio, "ok");
 _modfbCarica("EVENTO:" + st.evId + ":" + st.tipo, st.evId, st.tipo, true);
 } else {
 endActionOverlay();
 flash("org-fa", "⚠️ " + ((res && res.errore) || "Errore."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ Errore: " + ((err && err.message) || err), "err");
 })[metodo](st.evId, st.tipo);
}

function modfbTornaGlobale() { _modfbAzioneEvento("eliminaModuloFeedbackEvento"); }
function modfbCreaEvento() { _modfbAzioneEvento("creaModuloFeedbackEvento"); }

function ensureInitialViewVisible() {
 const loader = document.getElementById("loader");
 const orgLogin = document.getElementById("org-login");
 const orgMain = document.getElementById("org-main");
 const masterMain = document.getElementById("master-main");
 const sedeMain = document.getElementById("sede-main");
 const sedeLogin = document.getElementById("sede-login");
 const regMain = document.getElementById("reg-main");
 const userMain = document.getElementById("user-main");
 const noUuid = document.getElementById("no-uuid");
 const accLogin = document.getElementById("accoglienza-login");
 const accMain = document.getElementById("accoglienza-main");

 const hasVisible = [loader, orgLogin, orgMain, masterMain, sedeMain, sedeLogin, regMain, userMain, noUuid, accLogin, accMain, document.getElementById("feedback-main")]
 .some(el => el && !el.classList.contains("hidden"));
 if (hasVisible) return;

 // fallback estremo
 if (MODE === "org") {
 show("org-login");
 hide("loader");
 setOrgDashboardHeader(false);
 setHSub("Pannello Organizzatore");
 return;
 }
 const paginaNorm = String(typeof PAGINA !== "undefined" ? PAGINA : "").toLowerCase().trim();
 if (paginaNorm === "partner" || paginaNorm === "sede") {
 hide("loader");
 mostraAccessoSede();
 return;
 }
 if (paginaNorm === "master" || document.body.classList.contains("mode-master")) {
 show("master-main");
 hide("loader");
 setMasterDashboardHeader(true);
 setHSub("Gestisci le tue avventure");
 return;
 }
 if (paginaNorm === "accoglienza") {
 hide("reg-main");
 hide("loader");
 if (document.getElementById("accoglienza-main")?.classList.contains("hidden") === false) {
 show("accoglienza-main");
 } else {
 show("accoglienza-login");
 }
 return;
 }
 if (UUID && UUID.trim() && UUID !== "undefined") {
 mostraFallbackCaricamentoUtente("Caricamento non completato. Usa il recupero link.");
 return;
 }
 show("reg-main");
 hide("loader");
 setHSub("Scegli l'evento e prenota in pochi click");
}

// ── UTILITY ──────────────────────────────────
const sl = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,"_");
const _normSessJS = s => { const v = String(s||"").trim().toLowerCase(); return v === "unica" ? "" : v; };
function escapeHtml(str) {
 if (str == null) return "";
 const s = String(str);
 return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function formatDateTimeShort(ts) {
 if (!ts) return "";
 const d = new Date(ts);
 if (!isNaN(d.getTime())) {
 return d.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
 }
 // fallback: mostra stringa grezza se non è un Date valido
 return String(ts);
}

function _googleCalDateTimeStrFromIsoAndHHmm(dateIso, hhmm) {
 // Google Calendar accetta datetime floating se usiamo `ctz=Europe/Rome`.
 const iso = String(dateIso || "").trim();
 const t = String(hhmm || "").trim();
 if (!iso || !t || !iso.includes("-") || !t.includes(":")) return null;
 const [yStr, mStr, dStr] = iso.split("-");
 const [hhStr, mmStr] = t.split(":");
 const y = parseInt(yStr, 10);
 const m = parseInt(mStr, 10);
 const d = parseInt(dStr, 10);
 const hh = parseInt(hhStr, 10);
 const mm = parseInt(mmStr, 10);
 if ([y,m,d,hh,mm].some(n => Number.isNaN(n))) return null;

 const startUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
 return {
 startUtc
 };
}

function _buildGoogleCalendarUrl(titolo, dettagli, luogo, dateIso, hhmm, durataMin) {
 try {
 const dt = _googleCalDateTimeStrFromIsoAndHHmm(dateIso, hhmm);
 if (!dt) return "";
 const dur = parseInt(durataMin || 120, 10) || 120;
 const startUtc = dt.startUtc;
 const endUtc = new Date(startUtc.getTime() + dur * 60 * 1000);

 const pad = n => String(n).padStart(2, "0");
 const fmt = (dtx) =>
 dtx.getUTCFullYear() +
 pad(dtx.getUTCMonth() + 1) +
 pad(dtx.getUTCDate()) +
 "T" +
 pad(dtx.getUTCHours()) +
 pad(dtx.getUTCMinutes()) +
 "00";

 const startStr = fmt(startUtc);
 const endStr = fmt(endUtc);
 const ctz = "Europe/Rome";

 return (
 "https://www.google.com/calendar/render?action=TEMPLATE" +
 "&text=" + encodeURIComponent(titolo || "") +
 "&details=" + encodeURIComponent(dettagli || "") +
 "&location=" + encodeURIComponent(luogo || "") +
 "&dates=" + encodeURIComponent(startStr + "/" + endStr) +
 "&ctz=" + encodeURIComponent(ctz)
 );
 } catch (e) {
 return "";
 }
}

function buildGoogleCalendarUrlForPren(p) {
 try {
 if (!p) return "";
 const dateIso = p.eventDataIso || "";
 const hhmm = p.sessioneOrario || "";
 if (!dateIso || !hhmm) return "";

 const eventNome = p.eventNome || "Evento";
 const sessNome = p.sessioneNome ? (" - " + p.sessioneNome) : "";
 const titolo = eventNome + sessNome;

 const nomeTav = p.tavolo?.includes(" – ")
 ? p.tavolo.split(" – ").slice(1).join(" – ")
 : (p.tavolo || "");

 const dettagli =
 `Tavolo: ${nomeTav || "—"} · Persone: ${p.numPersone || "—"} · Fasce età: ${labelsFasciaCsv(p.fasciaEta) || "—"}`;

 const luogo = p.luogo || "";
 return _buildGoogleCalendarUrl(titolo, dettagli, luogo, dateIso, hhmm, 120);
 } catch (e) {
 return "";
 }
}

let _logAzioniCache = [];

function _logFiltriCorrenti() {
 const catEl = document.getElementById("log-categoria");
 const qEl = document.getElementById("log-q");
 return {
 categoria: catEl ? String(catEl.value || "all") : "all",
 q: qEl ? String(qEl.value || "").trim() : ""
 };
}

function renderLogAzioni() {
 const limitSel = document.getElementById("log-limit");
 const limit = limitSel ? parseInt(limitSel.value || "20", 10) : 20;
 const filtri = _logFiltriCorrenti();
 const tbody = document.getElementById("log-tbody");
 const cntEl = document.getElementById("log-cnt");
 if (!tbody) return;

 tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:14px 6px">
 <span class="empty-icon">🧾</span>Caricamento log…
 </div></td></tr>`;
 if (cntEl) cntEl.textContent = "";

 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 const why = res == null
 ? "Risposta vuota dal server (timeout o serializzazione)."
 : (res.errore || "Errore durante il caricamento log.");
 tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:14px 6px">
 <span class="empty-icon">⚠️</span>${escapeHtml(why)}
 </div></td></tr>`;
 if (cntEl) cntEl.textContent = "";
 return;
 }
 const voci = res.voci || [];
 _logAzioniCache = voci;
 const counts = res.counts || {};
 const meta = [
 `${voci.length}/${res.totalMatching || voci.length} mostrate`,
 `attive ${res.totalActive != null ? res.totalActive : "—"}`,
 `archivio ${res.archiveRows != null ? res.archiveRows : "—"}`,
 `max ${res.maxRows || "—"}`,
 `op ${counts.operativa || 0}`,
 `form ${counts.form || 0}`,
 `mail ${counts.email || 0}`,
 `err ${counts.errore || 0}`
 ].join(" · ");
 if (cntEl) cntEl.textContent = meta;
 if (!voci.length) {
 tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:14px 6px">
 <span class="empty-icon">🧾</span>Nessuna attività con i filtri correnti.
 </div></td></tr>`;
 return;
 }
 tbody.innerHTML = voci.map(v => {
 const when = formatDateTimeShort(v.timestamp);
 const cat = escapeHtml(v.categoria || "");
 const tipo = escapeHtml(v.tipo || "");
 const ev = escapeHtml(v.eventId || "");
 const ses = escapeHtml(v.sessioneId || "");
 const tav = escapeHtml(v.tavolo || "");
 const nome = escapeHtml(v.nome || "");
 const mail = escapeHtml(v.email || "");
 const det = escapeHtml(v.dettaglio || "");
 const detFull = [nome || mail ? `<div>${nome || mail}</div>` : "", det ? `<div style="font-style:italic;color:var(--smoke);margin-top:4px">${det}</div>` : ""].join("");
 return `<tr>
 <td style="white-space:nowrap;font-family:'DM Mono',monospace;font-size:11px">${escapeHtml(when)}</td>
 <td style="font-size:11px;color:var(--smoke)">${cat || "—"}</td>
 <td>${tipo}</td>
 <td>${ev || "—"}</td>
 <td>${ses || "—"}</td>
 <td>${tav || "—"}</td>
 <td>${detFull || "—"}</td>
 </tr>`;
 }).join("");
 })
 .withFailureHandler(err => {
 tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:14px 6px">
 <span class="empty-icon">❌</span>${escapeHtml(err.message || String(err))}
 </div></td></tr>`;
 if (cntEl) cntEl.textContent = "";
 })
 .getLogAzioni(limit, filtri);
}

function esportaLogAzioniCsv() {
 const voci = _logAzioniCache || [];
 if (!voci.length) {
 alert("Nessuna riga log da esportare. Aggiorna prima l'elenco.");
 return;
 }
 const headers = ["Timestamp","Categoria","Tipo","EventId","SessioneId","Tavolo","UUID","Email","Nome","Dettaglio"];
 const lines = [headers.join(";")];
 voci.forEach(v => {
 const cells = [
 v.timestamp, v.categoria, v.tipo, v.eventId, v.sessioneId, v.tavolo, v.uuid, v.email, v.nome, v.dettaglio
 ].map(x => {
 const s = String(x == null ? "" : x).replace(/"/g, '""');
 return `"${s}"`;
 });
 lines.push(cells.join(";"));
 });
 const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
 const a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = "log-azioni.csv";
 a.click();
 setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function archiviaLogVecchiDaUI() {
 if (!confirm("Archiviare le voci oltre il limite configurato su LogAzioniArchivio?")) return;
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 alert(`Archiviate ${res.archived || 0} righe (rimosse ${res.deleted || 0}).`);
 renderLogAzioni();
 } else {
 alert(res?.errore || "Archiviazione non riuscita.");
 }
 })
 .withFailureHandler(err => alert(err?.message || String(err)))
 .archiviaLogAzioniVecchi();
}

function purgaLogFormDaUI() {
 if (!confirm("Rimuovere dal log attivo tutte le voci del form (reg_form_*)? Verranno archiviate se LOG_ARCHIVE_ENABLED è attivo.")) return;
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 alert(`Rimosse ${res.removed || 0} voci form (archiviate ${res.archived || 0}).`);
 renderLogAzioni();
 } else {
 alert(res?.errore || "Pulizia non riuscita.");
 }
 })
 .withFailureHandler(err => alert(err?.message || String(err)))
 .purgaLogFormAzioni();
}

let _notifyPopupKeyHandler = null;

const show = id => {
 document.getElementById(id)?.classList.remove("hidden");
 if (id === "modifica-overlay" || id === "nome-unifica-overlay") document.body.classList.add("overlay-modifica-open");
};
const hide = id => {
 document.getElementById(id)?.classList.add("hidden");
 if (id === "modifica-overlay" || id === "nome-unifica-overlay") document.body.classList.remove("overlay-modifica-open");
 if (id === "notify-popup" && _notifyPopupKeyHandler) {
 document.removeEventListener("keydown", _notifyPopupKeyHandler);
 _notifyPopupKeyHandler = null;
 }
};
const setLdr = m => { document.getElementById("loader-msg").textContent = m||"Caricamento…"; };
const setHSub = t => { const el=document.getElementById("h-sub"); if(el) el.textContent=t; };

function setOrgHeaderActionsVisible(visible) {
 const el = document.getElementById("h-org-actions");
 if (!el) return;
 el.classList.toggle("is-visible", !!visible);
}

function _isDashboardChromeMode() {
 return document.body.classList.contains("mode-org") || document.body.classList.contains("mode-master");
}

/** Forza #app-header a filo viewport (override inline + correzione offset sandbox). */
function pinOrgHeaderFlush() {
 document.documentElement.style.setProperty("margin", "0", "important");
 document.documentElement.style.setProperty("padding", "0", "important");
 document.body.style.setProperty("padding-top", "0", "important");
 document.body.style.setProperty("margin-top", "0", "important");
 document.body.style.setProperty("margin", "0", "important");
 const header = document.getElementById("app-header");
 if (!header) return;
 header.style.setProperty("position", "fixed", "important");
 header.style.setProperty("left", "0", "important");
 header.style.setProperty("right", "0", "important");
 header.style.setProperty("margin", "0", "important");
 header.style.setProperty("z-index", "400", "important");
 // Prima misura a top:0; se il containing block sandbox lo sposta, compensa.
 header.style.setProperty("top", "0", "important");
 const top = header.getBoundingClientRect().top;
 if (Math.abs(top) > 0.5) {
 header.style.setProperty("top", (-top) + "px", "important");
 }
}

/** Allinea #app sotto l'header fixed (prenotazione + org + master). */
function syncOrgHeaderOffset() {
 const header = document.getElementById("app-header");
 if (!header) {
 document.documentElement.style.removeProperty("--org-header-offset");
 return;
 }
 pinOrgHeaderFlush();
 const h = Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 0);
 if (h > 0) document.documentElement.style.setProperty("--org-header-offset", h + "px");
}

function setMasterHeaderActionsVisible(visible) {
 const el = document.getElementById("h-master-actions");
 if (!el) return;
 el.classList.toggle("is-visible", !!visible);
}

function setSedeHeaderActionsVisible(visible) {
 const el = document.getElementById("h-sede-actions");
 if (!el) return;
 el.classList.toggle("is-visible", !!visible);
}

/** Dashboard master = stesso chrome header dell'org (macro tab + azioni). */
function setMasterDashboardHeader(active) {
 const header = document.getElementById("app-header");
 const brand = document.getElementById("h-brand-row");
 const masterTabs = document.getElementById("master-macro-tabs");
 const sedeTabs = document.getElementById("sede-macro-tabs");
 document.body.classList.toggle("mode-master", !!active);
 document.body.classList.toggle("master-dashboard", !!active);
 document.body.classList.remove("sede-dashboard");
 if (header) header.classList.toggle("header-org", !!active);
 if (brand) brand.style.justifyContent = active ? "flex-start" : "center";
 if (masterTabs) {
 if (active) masterTabs.removeAttribute("hidden");
 else masterTabs.setAttribute("hidden", "");
 }
 if (sedeTabs) sedeTabs.setAttribute("hidden", "");
 setMasterHeaderActionsVisible(!!active);
 setSedeHeaderActionsVisible(false);
 const hTitle = document.getElementById("h-title");
 if (hTitle && active) hTitle.textContent = "🧙 Vista Master";
 const app = document.getElementById("app");
 if (app) app.classList.toggle("wide", !!active);
 pinOrgHeaderFlush();
 requestAnimationFrame(() => {
 syncOrgHeaderOffset();
 requestAnimationFrame(syncOrgHeaderOffset);
 });
}

/** Dashboard sede = stesso chrome header dell'org (macro tab + azioni). */
function setSedeDashboardHeader(active) {
 const header = document.getElementById("app-header");
 const brand = document.getElementById("h-brand-row");
 const masterTabs = document.getElementById("master-macro-tabs");
 const sedeTabs = document.getElementById("sede-macro-tabs");
 document.body.classList.toggle("mode-master", !!active);
 document.body.classList.toggle("master-dashboard", !!active);
 document.body.classList.toggle("sede-dashboard", !!active);
 if (header) header.classList.toggle("header-org", !!active);
 if (brand) brand.style.justifyContent = active ? "flex-start" : "center";
 if (masterTabs) masterTabs.setAttribute("hidden", "");
 if (sedeTabs) {
 if (active) sedeTabs.removeAttribute("hidden");
 else sedeTabs.setAttribute("hidden", "");
 }
 setMasterHeaderActionsVisible(false);
 setSedeHeaderActionsVisible(!!active);
 const hTitle = document.getElementById("h-title");
 if (hTitle && active) hTitle.textContent = "🤝 Vista Co-organizzatore";
 const app = document.getElementById("app");
 if (app) app.classList.toggle("wide", !!active);
 pinOrgHeaderFlush();
 requestAnimationFrame(() => {
 syncOrgHeaderOffset();
 requestAnimationFrame(syncOrgHeaderOffset);
 });
}

/** Login = header classico centrato; dashboard org = layout immagine2 + azioni. */
function setOrgDashboardHeader(active) {
 const header = document.getElementById("app-header");
 const brand = document.getElementById("h-brand-row");
 if (header) header.classList.toggle("header-org", !!active);
 document.body.classList.toggle("org-dashboard", !!active);
 if (brand) brand.style.justifyContent = active ? "flex-start" : "center";
 setOrgHeaderActionsVisible(!!active);
 const hTitle = document.getElementById("h-title");
 if (hTitle && MODE === "org") {
 hTitle.textContent = "🔐 Vista Organizzatore";
 }
 if (!active) {
 hide("loader");
 hide("org-main");
 }
 pinOrgHeaderFlush();
 requestAnimationFrame(() => {
 syncOrgHeaderOffset();
 requestAnimationFrame(syncOrgHeaderOffset);
 });
}
const togglePwd = id => { const i=document.getElementById(id); if(i) i.type = i.type==="password" ? "text" : "password"; };

let _actionOverlayDepth = 0;
function beginActionOverlay(message) {
 const msgEl = document.getElementById("action-overlay-msg");
 if (msgEl) msgEl.textContent = message || "Salvataggio in corso…";
 _actionOverlayDepth++;
 show("action-overlay");
}
function endActionOverlay() {
 _actionOverlayDepth = Math.max(0, _actionOverlayDepth - 1);
 if (_actionOverlayDepth === 0) hide("action-overlay");
}

function switchTab(id, btn) {
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.getElementById(id)?.classList.add("active");
 btn.classList.add("active");
 // sincronizza macro-tab organizzatore
 const macroBtns = document.querySelectorAll(".org-macro-btn");
 if (macroBtns.length) {
 let macro = null;
 if (id === "t-pren" || id === "t-fasce" || id === "t-log" || id === "t-hc" || id === "t-mail") macro = "macro-stats";
 else if (id === "t-utenti") macro = "macro-utenti";
 else if (id === "t-mappa" || id === "t-eventi") macro = "macro-eventi";
 else if (id === "t-setup") macro = "macro-setup";
 if (macro) {
 macroBtns.forEach(b => b.classList.toggle("active", b.dataset.macro === macro));
 }
 }
 // mostra/nascondi blocco Statistiche (stats + sottotab)
 const statsPage = document.getElementById("org-stats-page");
 if (statsPage) {
 const onStats = id === "t-pren" || id === "t-fasce" || id === "t-log" || id === "t-hc" || id === "t-mail";
 statsPage.classList.toggle("hidden", !onStats);
 }
 const eventiPage = document.getElementById("org-eventi-page");
 if (eventiPage) eventiPage.classList.add("hidden");
 if (id === "t-eventi") {
 const evAttiviBtn = document.querySelector('.eventi-subtab[data-eventi-panel="eventi-panel-attivi"]');
 if (evAttiviBtn) switchEventiSubtab("eventi-panel-attivi", evAttiviBtn);
 }
 if (id === "t-mappa") {
 const mappaAttiviBtn = document.querySelector('.mappa-subtab[data-mappa-panel="mappa-panel-attivi"]');
 if (mappaAttiviBtn) switchMappaSubtab("mappa-panel-attivi", mappaAttiviBtn);
 if (typeof _renderMappaActionPanel === "function") _renderMappaActionPanel();
 }
 if (id === "t-hc" || id === "t-mail" || id === "t-pren" || id === "t-fasce" || id === "t-log" || id === "t-setup") {
 ensureOrgStatsData();
 }
 if (id === "t-mappa" || id === "t-eventi") {
 ensureOrgTavoliData();
 // Anagrafiche: badge "prima volta" sulla mappa tavoli (silenzioso)
 ensureOrgAnagraficheData({ silent: true });
 }
 if (id === "t-utenti") ensureOrgAnagraficheData();
}

/** Apre la vista accoglienza: mappa eventi in modalità operativa (arrivi e presenze). */
function apriAccoglienza(btn) {
 const statsPage = document.getElementById("org-stats-page");
 if (statsPage) statsPage.classList.add("hidden");
 const eventiPage = document.getElementById("org-eventi-page");
 if (eventiPage) eventiPage.classList.add("hidden");
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.querySelectorAll(".org-macro-btn").forEach(b => b.classList.toggle("active", b === btn));
 document.getElementById("t-mappa")?.classList.add("active");
 if (typeof setHSub === "function") setHSub("🚪 Accoglienza");
 const attiviBtn = document.querySelector('.mappa-subtab[data-mappa-panel="mappa-panel-attivi"]');
 if (attiviBtn) switchMappaSubtab("mappa-panel-attivi", attiviBtn);
 if (typeof _syncMappaShellState === "function") _syncMappaShellState();
 ensureOrgTavoliData();
 ensureOrgAnagraficheData({ silent: true });
 if (typeof renderMappaEventi === "function" && datiOrg) renderMappaEventi();
}

function switchOrgMacro(section, btn) {
 const macroBtns = document.querySelectorAll(".org-macro-btn");
 macroBtns.forEach(b => b.classList.remove("active"));
 if (btn) btn.classList.add("active");
 if (typeof MODE !== "undefined" && MODE === "org") {
 if (section === "macro-stats") setHSub("📊 Statistiche");
 else if (section === "macro-utenti") setHSub("👤 Anagrafiche");
 else if (section === "macro-eventi") setHSub("📌 Eventi e Tavoli");
 else if (section === "macro-setup") setHSub("🔧 Setup");
 }
 const statsPage = document.getElementById("org-stats-page");
 const eventiPage = document.getElementById("org-eventi-page");
 let targetTab = "t-hc";
 if (section === "macro-stats") {
 if (statsPage) statsPage.classList.remove("hidden");
 if (eventiPage) eventiPage.classList.add("hidden");
 targetTab = "t-hc";
 const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
 if (tabBtn) switchTab(targetTab, tabBtn);
 } else if (section === "macro-utenti") {
 if (statsPage) statsPage.classList.add("hidden");
 if (eventiPage) eventiPage.classList.add("hidden");
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.getElementById("t-utenti")?.classList.add("active");
 } else if (section === "macro-eventi") {
 if (statsPage) statsPage.classList.add("hidden");
 if (eventiPage) eventiPage.classList.add("hidden");
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.getElementById("t-mappa")?.classList.add("active");
 const mappaAttiviBtn = document.querySelector('.mappa-subtab[data-mappa-panel="mappa-panel-attivi"]');
 if (mappaAttiviBtn) switchMappaSubtab("mappa-panel-attivi", mappaAttiviBtn);
 if (typeof _syncMappaShellState === "function") _syncMappaShellState();
 if (typeof renderMappaEventi === "function" && datiOrg) renderMappaEventi();
 } else if (section === "macro-setup") {
 if (statsPage) statsPage.classList.add("hidden");
 const eventiPage = document.getElementById("org-eventi-page");
 if (eventiPage) eventiPage.classList.add("hidden");
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.getElementById("t-setup")?.classList.add("active");
 ensureOrgStatsData();
 }
 if (section === "macro-eventi") {
 ensureOrgTavoliData();
 ensureOrgAnagraficheData({ silent: true });
 } else if (section === "macro-utenti") ensureOrgAnagraficheData();
}

function switchEventiSubtab(panelId, btn) {
 document.querySelectorAll(".eventi-panel").forEach(p => p.classList.add("hidden"));
 document.querySelectorAll(".eventi-subtab").forEach(b => b.classList.remove("active"));
 document.getElementById(panelId)?.classList.remove("hidden");
 btn.classList.add("active");
}

function switchMappaSubtab(panelId, btn) {
 document.querySelectorAll("#mappa-lv1 .mappa-panel").forEach(p => p.classList.add("hidden"));
 document.querySelectorAll("#mappa-lv1 .mappa-subtab").forEach(b => b.classList.remove("active"));
 document.getElementById(panelId)?.classList.remove("hidden");
 if (btn) btn.classList.add("active");
}

function switchUtentiSubtab(panelId, btn) {
 document.querySelectorAll(".utenti-panel").forEach(p => p.classList.add("hidden"));
 document.querySelectorAll(".utenti-subtab").forEach(b => b.classList.remove("active"));
 document.getElementById(panelId)?.classList.remove("hidden");
 btn.classList.add("active");
 if (panelId === "utenti-panel-partecipanti") renderPartecipantiOrg();
 if (panelId === "utenti-panel-masters") renderMastersOrg();
 if (panelId === "utenti-panel-sedi") renderSediOrg();
}

/** Apre/chiude i pannelli form org (nuovo utente/master). forceOpen: true|false|undefined=toggle */
function toggleOrgDisclose(id, forceOpen) {
 const el = document.getElementById(id);
 if (!el) return;
 const open = (forceOpen === true) ? true : (forceOpen === false) ? false : !el.classList.contains("is-open");
 el.classList.toggle("is-open", open);
 const toggle = el.querySelector(".org-disclose-toggle");
 if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
 if (open) {
 const sel = el.getAttribute("data-focus");
 const focusEl = sel ? el.querySelector(sel) : el.querySelector("input,select,textarea");
 if (focusEl && typeof focusEl.focus === "function") {
 setTimeout(() => focusEl.focus(), 30);
 }
 }
}

function hideNotifyPopup() {
 hide("notify-popup");
}

function showNotifyPopup(msg, tipo) {
 const ov = document.getElementById("notify-popup");
 const textEl = document.getElementById("notify-popup-msg");
 const card = document.getElementById("notify-popup-card");
 const iconEl = document.getElementById("notify-popup-icon");
 const okBtn = document.getElementById("notify-popup-ok");
 if (!ov || !textEl || !card) return;
 const t = (tipo === "err" || tipo === "ok" || tipo === "info") ? tipo : "ok";
 textEl.textContent = String(msg ?? "");
 card.className = "dialog notify-popup-card notify-popup-" + t;
 if (iconEl) {
 iconEl.textContent = t === "err" ? "❌" : t === "info" ? "ℹ️" : "✅";
 }
 if (okBtn) {
 okBtn.className = "btn btn-full " + (t === "err" ? "btn-d" : t === "info" ? "btn-g" : "btn-s");
 okBtn.onclick = function() { hideNotifyPopup(); };
 }
 if (_notifyPopupKeyHandler) {
 document.removeEventListener("keydown", _notifyPopupKeyHandler);
 _notifyPopupKeyHandler = null;
 }
 _notifyPopupKeyHandler = function(e) {
 if (e.key === "Escape") hideNotifyPopup();
 };
 document.addEventListener("keydown", _notifyPopupKeyHandler);
 ov.classList.remove("hidden");
 setTimeout(function() { okBtn?.focus(); }, 50);
}

function flash(area, msg, tipo) {
 void area;
 showNotifyPopup(msg, tipo || "ok");
}

function popupErrorePrenotazione(msg) {
 showNotifyPopup(String(msg || "Errore nel flusso di prenotazione."), "err");
}

function chiediConferma(msg, cb, onCancel, opts) {
 const ovMsg = document.getElementById("ov-msg");
 const ovOk = document.getElementById("ov-ok");
 const ovNo = document.getElementById("ov-no");
 const notifyWrap = document.getElementById("ov-notify-wrap");
 const notifyEl = document.getElementById("ov-notify");
 if (!ovMsg || !ovOk || !ovNo) return;
 ovMsg.textContent = msg;
 const showNotify = !!(opts && opts.notifyOptional);
 if (notifyWrap) {
 notifyWrap.classList.toggle("hidden", !showNotify);
 notifyWrap.style.display = showNotify ? "flex" : "none";
 }
 if (notifyEl && showNotify) notifyEl.checked = opts.notifyDefault !== false;
 ovOk.onclick = () => {
 hide("overlay");
 if (typeof cb !== "function") return;
 if (showNotify) cb(!!(notifyEl && notifyEl.checked));
 else cb();
 };
 ovNo.onclick = () => {
 hide("overlay");
 if (notifyWrap) { notifyWrap.classList.add("hidden"); notifyWrap.style.display = "none"; }
 if (typeof onCancel === "function") onCancel();
 };
 show("overlay");
}

function apriFeedback(source, extra) {
 const sel = document.getElementById("fb-source");
 const nome = document.getElementById("fb-nome");
 const email = document.getElementById("fb-email");
 const msg = document.getElementById("fb-messaggio");
 const flashEl = document.getElementById("fb-flash");
 if (sel) sel.value = source || "altro";
 if (msg) msg.value = "";
 if (flashEl) { flashEl.classList.add("hidden"); flashEl.innerHTML = ""; }
 if (source === "area_utente" && typeof UUID !== "undefined" && UUID) {
 if (email) email.value = (datiUtente && datiUtente.persona && datiUtente.persona.email) ? datiUtente.persona.email : "";
 if (nome) nome.value = (datiUtente && datiUtente.persona && datiUtente.persona.nome) ? datiUtente.persona.nome : "";
 } else if (source === "registrazione") {
 if (nome) nome.value = document.getElementById("r-nome") ? document.getElementById("r-nome").value : "";
 if (email) email.value = document.getElementById("r-email") ? document.getElementById("r-email").value : "";
 } else {
 if (nome) nome.value = "";
 if (email) email.value = "";
 }
 window._fbExtra = extra || null;
 show("feedback-overlay");
 if (msg) msg.focus();
}

function inviaFeedbackFront() {
 const source = document.getElementById("fb-source").value;
 const nome = document.getElementById("fb-nome").value.trim();
 const email = document.getElementById("fb-email").value.trim();
 const messaggio = document.getElementById("fb-messaggio").value.trim();
 const flashEl = document.getElementById("fb-flash");
 const btn = document.getElementById("fb-invia");
 if (!messaggio) {
 if (flashEl) { flashEl.classList.remove("hidden"); flashEl.innerHTML = "<span class=\"flash f-err\" style=\"margin:0\">Inserisci un messaggio.</span>"; }
 return;
 }
 if (flashEl) { flashEl.classList.add("hidden"); flashEl.innerHTML = ""; }
 btn.disabled = true;
 const extra = window._fbExtra || null;
 const payload = { source, nome, email, messaggio, extra: typeof extra === "object" ? JSON.stringify(extra) : (extra || "") };
 if (typeof UUID !== "undefined" && UUID) payload.uuid = UUID;
 if (extra && extra.eventId) payload.eventId = extra.eventId;
 google.script.run
 .withSuccessHandler(function(res) {
 btn.disabled = false;
 if (res.ok) {
 hide("feedback-overlay");
 document.getElementById("fb-messaggio").value = "";
 var area = "reg-fa";
 if (source === "area_utente") area = "user-fa";
 else if (source === "dashboard_organizzatore") area = "org-fa";
 flash(area, "✅ " + (res.messaggio || "Grazie per il feedback!"), "ok");
 } else {
 if (flashEl) { flashEl.classList.remove("hidden"); flashEl.innerHTML = "<span class=\"flash f-err\" style=\"margin:0\">" + (res.errore || "Errore.") + "</span>"; }
 }
 })
 .withFailureHandler(function() {
 btn.disabled = false;
 if (flashEl) { flashEl.classList.remove("hidden"); flashEl.innerHTML = "<span class=\"flash f-err\" style=\"margin:0\">Invio fallito. Riprova.</span>"; }
 })
 .inviaFeedback(payload);
}

function emptyStateHtml(icon, message) {
 return `<div class="empty-state"><span class="empty-icon">${icon||"🎲"}</span>${message}</div>`;
}
function formatLuogoConACapo(luogoRaw) {
 const s = String(luogoRaw || "").trim();
 if (!s) return "";
 const parts = s.split(/\s+[—-]\s+/);
 if (parts.length < 2) return escapeHtml(s);
 const nome = escapeHtml(String(parts[0] || "").trim());
 const indirizzo = escapeHtml(String(parts.slice(1).join(" — ") || "").trim());
 if (!indirizzo) return nome;
 return `${nome}<br><span>${indirizzo}</span>`;
}

// ── TAVOLI (shared render) ────────────────────
function _inferWaitlistOptionIdAttesa(tavoloStr) {
 const s = String(tavoloStr || "").toLowerCase();
 // Heuristics: in tavolo "Lista d'attesa – Serata GDR ..." compare tipicamente "gdr" o "gdt".
 if (s.includes("gdt") || s.includes("giochi da tavolo")) return "Lista d'attesa - Giochi da Tavolo";
 if (s.includes("gdr") || s.includes("giochi di ruolo") || s.includes("ruolo")) return "Lista d'attesa - Giochi di Ruolo";
 return "Lista d'attesa - Giochi di Ruolo";
}

function _parsePrefIdsFromTavolo(tavoloStr) {
 const s = String(tavoloStr || "");
 const m = s.match(/\|\s*Pref:\s*([^|]+)/i);
 if (!m) return [];
 return String(m[1] || "")
 .split(",")
 .map(x => String(x || "").trim())
 .filter(Boolean);
}

function _estraiIdTavoloDaStringa(tavoloStr) {
 const s = String(tavoloStr || "").trim();
 if (!s) return "";
 // Supporta separatori legacy/misti: "-", "–", "—", "--" con spazi opzionali.
 const m = s.match(/^(.+?)\s*(?:-|–|—){1,2}\s*/);
 if (m && m[1]) return String(m[1]).trim();
 return s;
}

function _estraiNomeTavoloDaStringa(tavoloStr) {
 const s = String(tavoloStr || "").trim();
 if (!s) return "";
 const m = s.match(/^.+?\s*(?:-|–|—){1,2}\s*(.+)$/);
 if (m && m[1]) return String(m[1]).trim();
 return s;
}

function _normTavLabel(v) {
 return String(v || "")
 .toLowerCase()
 .replace(/\s+/g, " ")
 .replace(/[_\-–—]+/g, " ")
 .trim();
}

function _resolveTavoloIdPerMappa(tavoloStr, tavoliCfg) {
 const list = Array.isArray(tavoliCfg) ? tavoliCfg : [];
 const ids = new Set(list.map(t => String(t?.id || "").trim()).filter(Boolean));
 const idRaw = _estraiIdTavoloDaStringa(tavoloStr);
 if (idRaw && ids.has(idRaw)) return idRaw;

 // Fallback legacy: id storico non più presente, ma nome tavolo invariato.
 const nomeRaw = _normTavLabel(_estraiNomeTavoloDaStringa(tavoloStr));
 if (!nomeRaw) return idRaw;
 let byName = list.find(t => _normTavLabel(String(t?.gioco || t?.titoloAvventura || "")) === nomeRaw);
 if (!byName) {
 // Ultimo fallback: match parziale (es. suffissi/prefissi legacy)
 byName = list.find(t => {
 const n = _normTavLabel(String(t?.gioco || t?.titoloAvventura || ""));
 return !!n && (nomeRaw.includes(n) || n.includes(nomeRaw));
 });
 }
 return byName ? String(byName.id || "").trim() : idRaw;
}

// tavoliHtml: render tavoli disponibili + blocco "Liste d'attesa".
// opts.hideRealTables: se true, nasconde i tavoli reali.
// opts.hideWaitlistOptions: se true, nasconde i box "Liste d'attesa" (serve per il modal modifica: non serve scegliere GDR/GDT).
function tavoliHtml(sKey, tavoli, idAtt, opts) {
 const hideRealTables = !!opts?.hideRealTables;
 const hideWaitlistOptions = !!opts?.hideWaitlistOptions;
 tavoli = Array.isArray(tavoli) ? tavoli : [];

 const gdrs = tavoli.filter(t => t.tipo==="GDR");
 const gdts = tavoli.filter(t => t.tipo==="GDT");
 let h = `<div class="tav-grid">`;

 function grp(lista, lbl) {
 if (!lista.length) return;
 h += `<div class="grp-header"><span class="grp-lbl">${lbl}</span></div>`;
 lista.forEach(t => {
 const isA = t.id === idAtt;
 const pno = !isA && t.liberi <= 0;
 const cls = ["tc", isA?"tc-att":"", isA?"sel":"", pno?"tc-full":""].filter(Boolean).join(" ");
 const pCls = t.liberi>3 ? "c-ok" : t.liberi>0 ? "c-few" : "c-zero";
 const pTxt = pno
 ? `<span class="pn c-zero">Completo</span>`
 : `<span class="pn ${pCls}">${t.liberi} ${t.liberi===1?"posto":"posti"} liber${t.liberi===1?"o":"i"}${isA?" (tuo)":""}</span>`;
 const fLbl = t.fasce?.length ? `<span class="tc-fasce">· Fasce: ${t.fasce.map(f => escapeHtml(labelFascia(f))).join(", ")}</span>` : "";
 const clk = pno ? "" : `onclick="selTavolo('${sKey}','${t.id}',${t.liberi},${t.max})"`;
 h += `<div class="${cls}" id="tc-${sKey}-${t.id}" ${clk}>
 ${isA ? `<span class="att-tag">✓ Attuale</span>` : ""}
 <div class="tc-row">
 <div>
 <div class="tc-nome">${t.gioco}</div>
 <div class="tc-id">${t.id} · max ${t.max} persone</div>
 </div>
 <span class="tipo-badge ${t.tipo==="GDR"?"t-gdr":"t-gdt"}">${t.tipo}</span>
 </div>
 <div class="tc-posti">${pTxt}${fLbl}</div>
 </div>`;
 });
 }

 if (!hideRealTables) {
 grp(gdrs, "🐉 Giochi di Ruolo");
 grp(gdts, "🎲 Giochi da Tavolo");
 }

 if (!hideWaitlistOptions) {
 h += `<div class="grp-header"><span class="grp-lbl">⏳ Liste d'attesa</span></div>`;
 ["Lista d'attesa - Giochi di Ruolo","Lista d'attesa - Giochi da Tavolo"].forEach(v => {
 const isA = v === idAtt;
 const lbl = v.includes("Ruolo") ? "Lista d'attesa – GDR" : "Lista d'attesa – GDT";
 h += `<div class="tc tc-attesa${isA?" sel":""}" id="tc-${sKey}-${sl(v)}" onclick="selTavolo('${sKey}','${v}',999,999)">
 <div class="tc-row">
 <div class="tc-nome">${lbl}</div>
 <span class="tipo-badge t-att">ATTESA</span>
 </div>
 <div class="tc-posti" style="font-size:13px;color:var(--ash);font-style:italic">Ti contatteremo appena si libera un posto</div>
 </div>`;
 });
 }

 return h + `</div>`;
}

function selTavolo(sKey, id, liberi, max) {
 document.querySelectorAll(`[id^="tc-${sKey}-"]`).forEach(e => e.classList.remove("sel"));
 const tid = id.startsWith("Lista") ? sl(id) : id;
 const cardEl = document.getElementById("tc-"+sKey+"-"+tid);
 cardEl?.classList.add("sel");
 selTav[sKey] = id;
 const mxC = id.startsWith("Lista") ? 10 : Math.min(liberi||10, max||10);
 ["num-"+sKey,"r-num"].forEach(n => {
 const i = document.getElementById(n);
 if (!i) return;
 i.max = mxC;
 if (parseInt(i.value) > mxC) i.value = mxC;
 });
 _warnIfAvventuraGiaGiocata(cardEl, id);
}

function _normAvventuraWarningKey(v) {
 return String(v || "")
 .toLowerCase()
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g, "")
 .replace(/[^\w\s]/g, " ")
 .replace(/\s+/g, " ")
 .trim();
}

function _estraiNomeAvventuraDaTavoloStorico(tavoloStr) {
 const v = String(tavoloStr || "").trim();
 if (!v) return "";
 if (v.includes("Lista d'attesa")) return "";
 const parts = v.split(/\s*(?:-|–|—){1,2}\s*/);
 if (parts.length <= 1) return v;
 return String(parts.slice(1).join(" - ") || "").trim();
}

function _warnIfAvventuraGiaGiocata(cardEl, idSel) {
 if (!cardEl || String(idSel || "").startsWith("Lista")) return;
 const nomeCorrente = String(cardEl.querySelector(".tc-nome")?.textContent || "").trim();
 const keyCorrente = _normAvventuraWarningKey(nomeCorrente);
 if (!keyCorrente) return;

 const prenPass = Array.isArray(datiUtente?.prenotazioniPassate) ? datiUtente.prenotazioniPassate : [];
 const giaGiocata = prenPass.some(p => {
 if (!p || p.isListaAttesa) return false;
 const nomeStorico = _estraiNomeAvventuraDaTavoloStorico(p.tavolo);
 return _normAvventuraWarningKey(nomeStorico) === keyCorrente;
 });
 if (!giaGiocata) return;

 window._warnAvvGiaGiocataShown = window._warnAvvGiaGiocataShown || {};
 const warnKey = keyCorrente + "|" + String(idSel || "");
 if (window._warnAvvGiaGiocataShown[warnKey]) return;
 window._warnAvvGiaGiocataShown[warnKey] = true;
 flash("user-fa", `⚠️ Attenzione: hai già giocato l'avventura "${nomeCorrente}".`, "err");
}

function _haGiaGiocatoAvventura(nomeAvventura) {
 const keyCorrente = _normAvventuraWarningKey(nomeAvventura);
 if (!keyCorrente) return false;
 const prenPass = Array.isArray(datiUtente?.prenotazioniPassate) ? datiUtente.prenotazioniPassate : [];
 return prenPass.some(p => {
 if (!p || p.isListaAttesa) return false;
 const nomeStorico = _estraiNomeAvventuraDaTavoloStorico(p.tavolo);
 return _normAvventuraWarningKey(nomeStorico) === keyCorrente;
 });
}

function _confermaAvventureGiaGiocate(nomiAvventure) {
 const uniques = Array.from(new Set((nomiAvventure || [])
 .map(x => String(x || "").trim())
 .filter(Boolean)));
 if (!uniques.length) return true;
 const giaGiocate = uniques.filter(_haGiaGiocatoAvventura);
 if (!giaGiocate.length) return true;
 const elenco = giaGiocate.join(", ");
 flash("user-fa", `⚠️ Hai già giocato: ${elenco}. Avviso informativo, puoi continuare.`, "err");
 return true;
}

// ── FASCE ETA ─────────────────────────────────
function renderFasceIn(el, attuale, minRef) {
 const sel = attuale ? attuale.split(",").map(f => fasciaId(f.trim())).filter(Boolean) : [];
 const lista = fasceEtaFiltratePerMin(minRef);
 el.innerHTML = "";
 lista.forEach(f => {
 const lbl = document.createElement("label");
 lbl.className = "fchip" + (sel.includes(f.id) ? " on" : "");
 lbl.dataset.val = f.id;
 lbl.innerHTML = `<input type="checkbox" value="${escapeHtml(f.id)}"${sel.includes(f.id)?" checked":""}><span class="cdot"></span>${escapeHtml(f.label)}`;
 lbl.addEventListener("click", () => {
 const cb = lbl.querySelector("input");
 cb.checked = !cb.checked;
 lbl.classList.toggle("on", cb.checked);
 });
 el.appendChild(lbl);
 });
}

function getFasce(el) {
 return Array.from(el.querySelectorAll("input:checked")).map(c => c.value).join(", ");
}

// ═══════════════════════════════════════════
// REGISTRAZIONE UTENTE
// ═══════════════════════════════════════════
let regEvSelezionato = null;
let regTipoMisto = "";
let regGdtNumPersone = 1;
let regGdtLiberi = 0;
/** false finché getTavoliPerSessione non risponde (evita flash "limite raggiunto" con liberi=0). */
let regGdtCapienzaPronta = false;
let regGdtFasciaEta = "";

/** Normalizza tipo sessione: Gioco Libero = GDT (GIOCO_LIBERO legacy → GDT). */
function normalizzaTipoSessione(tipo) {
 const t = String(tipo || "").trim().toUpperCase();
 if (t === "PANEL") return "PANEL";
 if (t === "GDT" || t === "GIOCO_LIBERO") return "GDT";
 if (t === "PRENOTAZIONI_TAVOLI" || t === "GDR") return "PRENOTAZIONI_TAVOLI";
 return "PRENOTAZIONI_TAVOLI";
}

function labelTipoSessione(tipo) {
 const t = normalizzaTipoSessione(tipo);
 if (t === "PANEL") return "Panel";
 if (t === "GDT") return "GDT";
 return "Prenotazioni Tavoli";
}

/** Sessione a ingresso numerico (niente tavoli): GDT (Gioco Libero) / PANEL. GIOCO_LIBERO legacy ok. */
function sessioneSenzaTavoli(sess) {
 if (!sess) return false;
 if (sess.senzaTavoli === true) return true;
 const t = String(sess.tipoSessione || "").trim().toUpperCase();
 if (t === "GDT" || t === "GIOCO_LIBERO" || t === "PANEL") return true;
 if (t === "PRENOTAZIONI_TAVOLI" || t === "GDR") return false;
 // legacy: maxPosti > 0 senza tipo tavoli esplicito
 return (parseInt(sess.maxPosti || 0, 10) || 0) > 0 && !t;
}

/** Evento con almeno una sessione ingresso e una a tavoli (supportato; UI guida per sessione). */
function eventoSessioniMiste(ev) {
 const sessioni = (ev && ev.sessioni) || [];
 let hasIng = false, hasTav = false;
 for (let i = 0; i < sessioni.length; i++) {
 if (sessioneSenzaTavoli(sessioni[i])) hasIng = true;
 else hasTav = true;
 if (hasIng && hasTav) return true;
 }
 return false;
}

function _regLabelTipoSessionePill(sess) {
 if (sessioneSenzaTavoli(sess)) return labelTipoSessione(sess && sess.tipoSessione);
 return "Prenotazioni Tavoli";
}

function _regHtmlSessionePill(s, active) {
 const nome = s.nome || s.sessioneId || "Sessione";
 const ora = s.orario ? ` <span style="opacity:.8">| 🕑 ${s.orario}</span>` : "";
 return `<button class="mappa-sess-btn${active ? " active" : ""}"
 onclick="regSelezionaSessioneWizard('${String(s.sessioneId || "").replace(/'/g, "\\'")}',this)">
 🧭 ${nome}${ora}
 </button>`;
}

/**
 * Applica la sessione scelta: la UI (ingresso vs tavoli) dipende solo da tipoSessione.
 * Su eventi misti resta sullo step dati/prenotazione; i tavoli si aprono dopo i dati (GDR).
 */
function regApplicaSessioneWizard(sessId, btn) {
 if (btn) {
 const wrap = btn.closest("#reg-gdt-sess-pills, #reg-sess-pills") || document;
 wrap.querySelectorAll(".mappa-sess-btn").forEach(b => b.classList.remove("active"));
 btn.classList.add("active");
 }
 const s = regEvSelezionato?.sessioni?.find(x => x.sessioneId === sessId) || { sessioneId: sessId };
 regSessSelezionata = s;
 regTavoliSelezionati = {};
 regAttesaSelezionata = false;
 regGdtNumPersone = 1;
 regGdtFasciaEta = "";
 const selSess = document.getElementById("r-sessione");
 if (selSess) selSess.innerHTML = `<option value="${sessId}" selected></option>`;
 logRegForm("sessione_scelta", s?.nome || sessId, {
 eventId: regEvSelezionato?.eventId,
 sessioneId: sessId,
 tipoSessione: (s && s.tipoSessione) || "",
 senzaTavoli: sessioneSenzaTavoli(s),
 misto: eventoSessioniMiste(regEvSelezionato)
 });
 regApplyWizardModeForEvento(regEvSelezionato, s);
 hide("reg-s2");
 show("reg-s3");
 regPrecompilaDatiUtente();
 if (sessioneSenzaTavoli(s)) {
 regGdtCaricaCapienza(regEvSelezionato.eventId, sessId);
 } else {
 caricaTavoliRegNew(regEvSelezionato.eventId, sessId);
 }
}

/** Alias: pill sessioni (ingresso / misto / GDR). */
function regSelezionaSessioneWizard(sessId, btn) {
 regApplicaSessioneWizard(sessId, btn);
}

/** Flusso ingresso numerico: dipende solo dalla sessione selezionata. */
function regIsGdtEvento(ev) {
 const e = ev || regEvSelezionato;
 if (regSessSelezionata) return sessioneSenzaTavoli(regSessSelezionata);
 if (e && Array.isArray(e.sessioni) && e.sessioni.length) {
 return sessioneSenzaTavoli(e.sessioni[0]);
 }
 return false;
}

function regGdtSessioneIllimitata(sess) {
 const s = sess || regSessSelezionata;
 return sessioneSenzaTavoli(s) && !(parseInt(s?.maxPosti || 0, 10) > 0);
}

function regApplyWizardModeForEvento(ev, sessOpt) {
 const sess = sessOpt || regSessSelezionata || (ev && ev.sessioni && ev.sessioni[0]) || null;
 const isIngresso = sessioneSenzaTavoli(sess);
 document.querySelectorAll(".rs-gdr-only").forEach(el => el.classList.toggle("hidden", isIngresso));
 const lbl2 = document.getElementById("rs-2-lbl");
 if (lbl2) lbl2.textContent = isIngresso ? "🎲 Informazioni" : "📝 Dati";
 const title = document.getElementById("reg-s3-title");
 if (title) title.textContent = isIngresso ? "🎲 Invia informazioni" : "📝 I tuoi dati";
 const desc = document.getElementById("reg-s3-desc");
 if (desc) {
 desc.textContent = isIngresso
 ? "Indica quanti venite e lascia nome e email: sono obbligatori."
 : "Inserisci i dati del prenotante, poi prosegui alla scelta dei tavoli.";
 }
 const gdtBlock = document.getElementById("reg-gdt-block");
 if (gdtBlock) gdtBlock.classList.toggle("hidden", !isIngresso);
 const note = document.getElementById("reg-dati-gdt-note");
 if (note) note.classList.add("hidden");
 const lblNome = document.getElementById("lbl-r-nome");
 const lblEmail = document.getElementById("lbl-r-email");
 if (lblNome) lblNome.textContent = "Nome e Cognome *";
 if (lblEmail) lblEmail.textContent = "Email *";
 const btnNext = document.getElementById("reg-s3-next");
 const btnGdt = document.getElementById("reg-gdt-submit");
 if (btnNext) btnNext.classList.toggle("hidden", isIngresso);
 if (btnGdt) btnGdt.classList.toggle("hidden", !isIngresso);
 const sessWrap = document.getElementById("reg-gdt-sess-wrap");
 if (sessWrap && regTipoMisto) {
 const wantGdt = regTipoMisto === "gdt";
 const n = (regEvSelezionato?.sessioni || []).filter(s => sessioneSenzaTavoli(s) === wantGdt).length;
 sessWrap.classList.toggle("hidden", n < 2);
 }
 regAggiornaBloccoEmail();
  if (isIngresso) {
    regGdtRenderFasce();
    regGdtRenderGiochiDisponibili(sess);
  } else {
    regGdtRenderGiochiDisponibili(null);
  }
}

function regGdtPostiEsauriti() {
 if (regGdtSessioneIllimitata()) return false;
 const max = parseInt(regSessSelezionata?.maxPosti || 0, 10) || 0;
 return max > 0 && regGdtLiberi < 1;
}

function regGdtCambiaQty(delta) {
 if (!regGdtCapienzaPronta) return;
 // Sempre fino a 50: se il gruppo supera i posti liberi → lista d'attesa (backend + UI).
 const max = 50;
 regGdtNumPersone = Math.max(1, Math.min(max, (regGdtNumPersone || 1) + delta));
 const el = document.getElementById("reg-gdt-num-val");
 if (el) el.textContent = String(regGdtNumPersone);
 regGdtAggiornaCapienzaUI();
}

/** Abilita/disabilita controlli GDT finché non arriva lo stato posti. */
function regGdtSetControlliAbilitati(abilitati) {
 const on = !!abilitati;
 const btn = document.getElementById("reg-gdt-submit");
 if (btn) btn.disabled = !on;
 regAggiornaBloccoEmail();
 const minus = document.getElementById("reg-gdt-qty-minus");
 const plus = document.getElementById("reg-gdt-qty-plus");
 if (minus) minus.disabled = !on;
 if (plus) plus.disabled = !on;
 const chips = document.getElementById("reg-gdt-fasce-chips");
 if (chips) {
 chips.style.pointerEvents = on ? "" : "none";
 chips.style.opacity = on ? "" : "0.55";
 }
 const giochiBtn = document.getElementById("reg-gdt-giochi-btn");
 if (giochiBtn) giochiBtn.disabled = !on;
}

function regGdtInAttesaPrevista() {
 if (regGdtSessioneIllimitata()) return false;
 if (!regGdtCapienzaPronta) return false;
 const need = Math.max(1, parseInt(regGdtNumPersone || 1, 10) || 1);
 return regGdtLiberi < 1 || need > regGdtLiberi;
}

function _regGdtGiochiLista(sess) {
 const s = sess || null;
 if (!s || !sessioneSenzaTavoli(s)) return [];
 if (Array.isArray(s.giochiDisponibili)) {
 return s.giochiDisponibili.map(g => String(g || "").trim()).filter(Boolean);
 }
 return _parseGiochiDisponibiliUI(s.giochiDisponibili || "");
}

function regGdtRenderGiochiDisponibili(sess) {
 const wrap = document.getElementById("reg-gdt-giochi-wrap");
 const list = document.getElementById("reg-gdt-giochi-list");
 const sessEl = document.getElementById("reg-gdt-giochi-sess");
 if (!wrap) return;
 const s = (arguments.length ? sess : regSessSelezionata) || null;
 const giochi = _regGdtGiochiLista(s);
 if (!giochi.length) {
 wrap.classList.add("hidden");
 if (list) list.innerHTML = "";
 if (sessEl) sessEl.textContent = "";
 chiudiRegGdtGiochiPopup();
 return;
 }
 if (list) list.innerHTML = giochi.map(g => `<li>${escapeHtml(g)}</li>`).join("");
 if (sessEl) {
 const bits = [s?.nome, s?.orario].filter(Boolean).join(" · ");
 sessEl.textContent = bits || "";
 sessEl.classList.toggle("hidden", !bits);
 }
 wrap.classList.remove("hidden");
}

function apriRegGdtGiochiPopup() {
 regGdtRenderGiochiDisponibili(regSessSelezionata);
 const list = document.getElementById("reg-gdt-giochi-list");
 if (!list || !list.children.length) return;
 show("reg-gdt-giochi-overlay");
}

function chiudiRegGdtGiochiPopup() {
 hide("reg-gdt-giochi-overlay");
}

function regGdtAggiornaCapienzaUI() {
 const capEl = document.getElementById("reg-gdt-capienza");
 const warnEl = document.getElementById("reg-gdt-limite-warn");
 if (!capEl) return;
 const sess = regSessSelezionata;
 const sessBits = [sess?.nome, sess?.orario].filter(Boolean).map(escapeHtml).join(" · ");

 if (!regGdtCapienzaPronta) {
 capEl.innerHTML = sessBits
 ? `⏳ Caricamento posti disponibili… · ${sessBits}`
 : "⏳ Caricamento posti disponibili…";
 if (warnEl) {
 warnEl.innerHTML = "";
 warnEl.classList.add("hidden");
 }
 regGdtSetControlliAbilitati(false);
 const btn = document.getElementById("reg-gdt-submit");
 if (btn) btn.textContent = "Caricamento…";
 return;
 }

 const illimitata = regGdtSessioneIllimitata(sess);
 const inAttesa = regGdtInAttesaPrevista();
 const baseHint = sessBits
 ? `Indica quante persone siete. · ${sessBits}`
 : "Indica quante persone siete.";
 // Sempre hint neutro (niente conteggio posti / niente limite inline).
 capEl.innerHTML = baseHint;
 if (warnEl) {
 if (inAttesa) {
 const lib = Math.max(0, parseInt(regGdtLiberi || 0, 10) || 0);
 const titolo = lib < 1
 ? "Limite posti raggiunto"
 : "Il gruppo supera i posti liberi";
 warnEl.innerHTML = `<strong>${titolo}.</strong> Puoi comunque inviare i dati: ti mettiamo in lista d'attesa e ti avviseremo se si liberano posti.`;
 warnEl.classList.remove("hidden");
 } else {
 warnEl.innerHTML = "";
 warnEl.classList.add("hidden");
 }
 }
 regGdtRenderGiochiDisponibili(sess);
 const btn = document.getElementById("reg-gdt-submit");
 if (btn) btn.textContent = inAttesa ? "Entra in lista d'attesa →" : "Invia Informazioni →";
 regGdtSetControlliAbilitati(true);
}

function regGdtRenderFasce() {
 const chips = document.getElementById("reg-gdt-fasce-chips");
 if (!chips) return;
 const paint = () => {
 const minRef = String(regSessSelezionata?.fasciaEtaMinima || "").trim();
 const lblEl = document.getElementById("reg-gdt-fasce-lbl");
 if (lblEl) {
 if (minRef) {
 lblEl.innerHTML = `🎯 Fasce età del gruppo <span style="margin-left:8px;font-size:11px;color:var(--ash);font-weight:500">Età minima sessione:</span> <span class="tipo-badge t-gdt" style="margin-left:4px">${escapeHtml(labelFascia(minRef) || minRef)}</span>`;
 } else {
 lblEl.textContent = "🎯 Fasce età del gruppo";
 }
 }
 regGdtFasciaEta = pruneFasciaEtaControMin(regGdtFasciaEta, minRef);
 const lista = fasceEtaFiltratePerMin(minRef);
 const sel = regGdtFasciaEta
 ? regGdtFasciaEta.split(",").map(f => fasciaId(f.trim())).filter(Boolean)
 : [];
 chips.innerHTML = "";
 lista.forEach(f => {
 const lbl = document.createElement("label");
 const on = sel.includes(f.id);
 lbl.className = "fchip" + (on ? " on" : "");
 lbl.innerHTML = `<input type="checkbox" value="${escapeHtml(f.id)}"${on ? " checked" : ""}><span class="cdot"></span>${escapeHtml(f.label)}`;
 lbl.addEventListener("click", (e) => {
 e.preventDefault();
 const cb = lbl.querySelector("input");
 cb.checked = !cb.checked;
 lbl.classList.toggle("on", cb.checked);
 regGdtFasciaEta = getFasce(chips);
 document.getElementById("reg-gdt-fasce-req")?.classList.toggle("visible", !String(regGdtFasciaEta || "").trim());
 });
 chips.appendChild(lbl);
 });
 document.getElementById("reg-gdt-fasce-req")?.classList.remove("visible");
 };
 if (FASCE_ETA.length) paint();
 else syncFasceEtaDaFoglio(paint);
}

function regGdtCaricaCapienza(evId, sessId) {
 regGdtLiberi = 0;
 regGdtCapienzaPronta = false;
 regGdtAggiornaCapienzaUI();
 google.script.run
 .withSuccessHandler((tavoli) => {
 const list = Array.isArray(tavoli) ? tavoli : [];
 const virt = list.find(t => String(t.id) === "SESSIONE_LIBERA") || list[0];
 regGdtLiberi = Math.max(0, parseInt(virt?.liberi ?? 0, 10) || 0);
 // Non ridurre il qty ai posti liberi: se il gruppo è più grande → lista d'attesa.
 if (regGdtLiberi < 1) regGdtNumPersone = Math.max(1, regGdtNumPersone || 1);
 const el = document.getElementById("reg-gdt-num-val");
 if (el) el.textContent = String(regGdtNumPersone);
 regGdtCapienzaPronta = true;
 regGdtAggiornaCapienzaUI();
 })
 .withFailureHandler(() => {
 regGdtLiberi = regGdtSessioneIllimitata()
 ? 9999
 : (parseInt(regSessSelezionata?.maxPosti || 0, 10) || 0);
 regGdtCapienzaPronta = true;
 regGdtAggiornaCapienzaUI();
 })
 .getTavoliPerSessione(evId, sessId);
}

function inviaRegGdt() {
 if (!regGdtCapienzaPronta) {
 popupErrorePrenotazione("⏳ Attendi il caricamento dei posti disponibili.");
 return;
 }
 const nome = String(document.getElementById("r-nome")?.value || "").trim();
 const email = String(document.getElementById("r-email")?.value || "").trim();
 const cell = String(document.getElementById("r-cell")?.value || "").trim();
 const fonte = String(document.getElementById("r-fonte")?.value || "");
 const evId = regEvSelezionato?.eventId;
 const sessId= regSessSelezionata?.sessioneId || "";
 const illimitata = regGdtSessioneIllimitata();
 if (!evId) { popupErrorePrenotazione("⚠️ Nessun evento selezionato."); return; }
 if (!sessId) { popupErrorePrenotazione("⚠️ Seleziona una sessione."); return; }
 if (!nome) { popupErrorePrenotazione("⚠️ Inserisci nome e cognome."); return; }
 if (!email || email.indexOf("@") < 0) { popupErrorePrenotazione("⚠️ L'indirizzo email deve contenere @."); return; }
 const chips = document.getElementById("reg-gdt-fasce-chips");
 regGdtFasciaEta = chips ? getFasce(chips) : (regGdtFasciaEta || "");
 if (!String(regGdtFasciaEta || "").trim()) {
 document.getElementById("reg-gdt-fasce-req")?.classList.add("visible");
 popupErrorePrenotazione("⚠️ Seleziona almeno una fascia età del gruppo.");
 return;
 }
 const num = Math.max(1, Math.min(50, regGdtNumPersone || 1));
 const inAttesa = !illimitata && (regGdtLiberi < 1 || num > regGdtLiberi);
 if (inAttesa && (!email || email.indexOf("@") <= 0)) {
 popupErrorePrenotazione("⚠️ Limite posti raggiunto: lascia un'email per entrare in lista d'attesa e ricevere l'avviso se si liberano posti.");
 return;
 }
 const sessNome = regSessSelezionata?.nome || sessId;
 const evNome = regEvSelezionato?.nome || evId;
 const tavolo = inAttesa
 ? `Lista d'attesa – ${evNome} – ${sessNome}`
 : "SESSIONE_LIBERA – Ingresso";

 const btn = document.getElementById("reg-gdt-submit");
 if (btn) btn.disabled = true;
 hide("reg-recupera-link");
 setLdr(inAttesa ? "Iscrizione in lista d'attesa…" : "Invio informazioni…");
 hide("reg-panel"); show("loader");

 const payloadReg = {
 nome,
 email,
 cellulare: cell,
 eventId: evId,
 sessioneId: sessId,
 fonte,
 prenotazioni: [{ tavolo, numPersone: num, fasciaEta: regGdtFasciaEta.trim() }],
 prenotantePartecipa: true
 };
 if (typeof UUID !== "undefined" && UUID && String(UUID).trim()) {
 payloadReg.uuid = String(UUID).trim();
 }
 logRegForm(inAttesa ? "invio_gdt_lista_attesa" : "invio_gdt", `${num} posti`, {
 eventId: evId, sessioneId: sessId, email: email || "(anonimo)"
 });

 google.script.run
 .withSuccessHandler((res) => {
 hide("loader");
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 const isAttesa = !!(res.listaAttesa || inAttesa);
 logRegForm(isAttesa ? "invio_gdt_lista_attesa_ok" : "invio_gdt_ok", res.messaggio || "Informazioni registrate", { eventId: evId, sessioneId: sessId });
 hide("reg-panel");
 const okTitle = document.querySelector("#reg-ok h2");
 const okP = document.querySelector("#reg-ok .suc-panel > p");
 if (okTitle) okTitle.textContent = isAttesa ? "Sei in lista d'attesa!" : "Informazioni inviate!";
 if (okP) {
 if (isAttesa) {
 okP.innerHTML = `Abbiamo raggiunto il <strong>limite dei posti</strong>. Ti abbiamo messo in lista d'attesa<br>e ti avviseremo via <strong>email</strong> se se ne liberano.`;
 } else if (email) {
 okP.innerHTML = `Grazie! Ti abbiamo inviato un'<strong>email</strong> con il riepilogo<br>e un link personale per gestire i tuoi dati.`;
 } else {
 okP.innerHTML = `Grazie! Abbiamo registrato <strong>${num} post${num === 1 ? "o" : "i"}</strong> per questa serata.<br>Non hai lasciato un'email: i dati restano anonimi.`;
 }
 }
 show("reg-ok");
 show("reg-recupera-link");
 return;
 }
 show("reg-panel");
 popupErrorePrenotazione("⚠️ " + ((res && res.errore) || "Invio non riuscito."));
 })
 .withFailureHandler((err) => {
 hide("loader");
 show("reg-panel");
 if (btn) btn.disabled = false;
 popupErrorePrenotazione("❌ " + (err.message || err));
 })
 .registraPrenotazioneMulti(payloadReg);
}
let regSessSelezionata = null;
let regTavoliSelezionati = {};
let regPrecheckAvvRequestId = 0;
let regAttesaSelezionata = false;
let regAttesaNumPersone = 1;
let regAttesaFasciaEta = "";
let regAttesaPreferenze = [];
let regPartecipanti = [];
let regPrenotantePartecipa = true;

function _regFormCtxEmailNome() {
 return {
 nome: String(document.getElementById("r-nome")?.value || "").trim(),
 email: String(document.getElementById("r-email")?.value || "").trim().toLowerCase()
 };
}

/** Scrive nel foglio Log le azioni del wizard prenotazione (fire-and-forget). */
function logRegForm(azione, dettaglio, opts) {
 if (typeof google === "undefined" || !google.script?.run) return;
 const o = opts || {};
 const ctx = _regFormCtxEmailNome();
 const payload = {
 azione: String(azione || "").trim(),
 eventId: String(o.eventId || regEvSelezionato?.eventId || ""),
 sessioneId: String(o.sessioneId || regSessSelezionata?.sessioneId || ""),
 tavolo: String(o.tavolo || ""),
 uuid: String(o.uuid || (typeof UUID !== "undefined" ? UUID : "") || "").trim(),
 email: String(o.email || ctx.email || ""),
 nome: String(o.nome || ctx.nome || ""),
 dettaglio: String(dettaglio != null ? dettaglio : o.dettaglio || "").slice(0, 500)
 };
 google.script.run
 .withFailureHandler(() => {})
 .logRegFormAzione(payload);
}

function avviaPrenotaDaUtente() {
 if (!UUID) return;
 stopLiveSync();
 hide("user-main");
 regTornaStep1();
 logRegForm("avvio_da_area_utente", "Apertura wizard da area utente");
 caricaEventiReg();
}

function _postiTotaliRegCorrenti() {
 if (regAttesaSelezionata) return Math.max(1, parseInt(regAttesaNumPersone || 1, 10) || 1);
 const entries = Object.values(regTavoliSelezionati || {});
 return Math.max(1, entries.reduce((s, t) => s + (parseInt(t?.num || 1, 10) || 1), 0));
}

function _maxAltriPartecipantiReg() {
 if (!PARTECIPANTI_MULTI_ENABLED) return 0;
 const ownerSlots = regPrenotantePartecipa ? 1 : 0;
 if (regAttesaSelezionata) return Math.max(0, regAttesaNumPersone - ownerSlots);
 const entries = Object.values(regTavoliSelezionati || {});
 if (!entries.length) return 0;
 // Un record per tavolo: slot partecipanti = posti_tavolo − (1 se prenotante partecipa)
 return entries.reduce((s, t) => s + Math.max(0, (parseInt(t?.num || 1, 10) || 1) - ownerSlots), 0);
}

function renderPartecipantiReg() {
 const wrap = document.getElementById("reg-partecipanti-wrap");
 const list = document.getElementById("reg-partecipanti-list");
 const count = document.getElementById("reg-partecipanti-count");
 const amici = Array.isArray(datiUtente?.amicizie) ? datiUtente.amicizie : [];
 const mostraRubrica = !!(UUID && amici.length);
 const max = _maxAltriPartecipantiReg();
 const hint = document.getElementById("reg-partecipanti-hint");
 if (!wrap || !list || !count) return;
 wrap.classList.toggle("hidden", max <= 0);
 if (hint) {
 hint.innerHTML = regPrenotantePartecipa
 ? `Nome o nickname per ogni co-prenotante (in ordine: prima i posti del primo tavolo, poi del secondo, e così via).<br>Se inserisci anche l'email riceveranno l'invito e potranno gestire insieme a te la prenotazione.`
 : `Hai indicato che non partecipi: inserisci i nomi dei partecipanti effettivi (es. tuo figlio).<br>Se inserisci anche l'email riceveranno l'invito e potranno gestire insieme a te la prenotazione.`;
 }
 if (max <= 0) {
 regPartecipanti = [];
 return;
 }

 if (regPartecipanti.length > max) regPartecipanti = regPartecipanti.slice(0, max);
 while (regPartecipanti.length < max) regPartecipanti.push({ nome: "", email: "", emailEnabled: false });
 list.innerHTML = "";
 regPartecipanti.forEach((p, idx) => {
 const emailEnabled = !!p?.emailEnabled;
 const friendOptions = amici.map(a => {
 const fid = escapeHtml(String(a?.friendId || ""));
 const nm = String(a?.nome || "").trim();
 const em = String(a?.email || "").trim();
 const label = escapeHtml(`${nm || em}${em ? " — " + em : ""}`);
 return `<option value="${fid}">${label}</option>`;
 }).join("");
 const row = document.createElement("div");
 row.style.display = "flex";
 row.style.flexDirection = "column";
 row.style.gap = "8px";
 row.innerHTML = `
 ${mostraRubrica ? `
 <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
 <select id="reg-part-friend-${idx}" style="flex:1;min-width:220px">
 <option value="">Seleziona amico dalla rubrica</option>
 ${friendOptions}
 </select>
 <button type="button" class="btn btn-o btn-sm" onclick="compilaPartecipanteDaAmicoReg(${idx})">Compila da rubrica</button>
 </div>` : ""}
 <div style="display:grid;grid-template-columns:${emailEnabled ? "1.15fr 1fr auto" : "1fr auto"};gap:8px">
 <input type="text" placeholder="Nome o nickname partecipante ${idx + 1}" autocomplete="nickname" value="${escapeHtml(p?.nome || "")}" oninput="regPartecipanti[${idx}].nome=this.value">
 ${emailEnabled
 ? `<input type="email" placeholder="nome.cognome@email.it" autocomplete="email" value="${escapeHtml(p?.email || "")}" oninput="regPartecipanti[${idx}].email=this.value">`
 : ""}
 <button type="button" class="btn btn-o btn-sm" title="${emailEnabled ? "Rimuovi email" : "Aggiungi email"}" onclick="toggleEmailPartecipanteReg(${idx})">${emailEnabled ? "✉️" : "➕✉️"}</button>
 </div>
 `;
 list.appendChild(row);
 });
 count.textContent = `${regPartecipanti.length}/${max} ${regPrenotantePartecipa ? "co-prenotanti" : "partecipanti"}`;
}

function regTogglePrenotantePartecipa() {
 const cb = document.getElementById("reg-owner-partecipa");
 regPrenotantePartecipa = !(cb && cb.checked);
 logRegForm("prenotante_partecipa", regPrenotantePartecipa ? "Partecipa" : "Non partecipa (prenota per altri)");
 renderPartecipantiReg();
 renderRegRiepilogo();
}

function aggiungiPartecipanteReg() {
 // Non usato nella UI: i campi vengono creati automaticamente in base ai posti selezionati.
 const max = _maxAltriPartecipantiReg();
 if (regPartecipanti.length >= max) return;
 regPartecipanti.push({ nome: "", email: "", emailEnabled: false });
 renderPartecipantiReg();
}

function rimuoviPartecipanteReg(idx) {
 regPartecipanti.splice(idx, 1);
 renderPartecipantiReg();
}

function toggleEmailPartecipanteReg(idx) {
 if (!regPartecipanti[idx]) return;
 const enabled = !regPartecipanti[idx].emailEnabled;
 regPartecipanti[idx].emailEnabled = enabled;
 if (!enabled) regPartecipanti[idx].email = "";
 renderPartecipantiReg();
}

function compilaPartecipanteDaAmicoReg(idx) {
 if (!regPartecipanti[idx]) return;
 const sel = document.getElementById("reg-part-friend-" + idx);
 const friendId = String(sel?.value || "").trim();
 if (!friendId) return;
 const amici = Array.isArray(datiUtente?.amicizie) ? datiUtente.amicizie : [];
 const amico = amici.find(a => String(a?.friendId || "").trim() === friendId);
 if (!amico) return;
 regPartecipanti[idx].nome = String(amico.nome || "").trim();
 regPartecipanti[idx].email = String(amico.email || "").trim();
 regPartecipanti[idx].emailEnabled = !!regPartecipanti[idx].email;
 renderPartecipantiReg();
}

/** Etichetta co-prenotante: nome, nickname o label (non vuota). */
function etichettaPartecipanteRegOk(nome) {
 const clean = String(nome || "").trim().replace(/\s+/g, " ");
 if (!clean || clean.length > 120) return false;
 return true;
}

function tornaDaRegAUserArea() {
 hide("reg-main");
 regTornaStep1();
 // Ricarica la vista utente per mostrare eventuali nuove info.
 if (typeof UUID !== "undefined" && UUID) caricaUtente();
 else show("user-main");
}

function caricaEventiReg() {
 setLdr("Caricamento eventi…"); show("loader");
 syncFasceEtaDaFoglio(() => {
 google.script.run
 .withSuccessHandler(ev => {
 eventiReg = (ev || []).filter(e => !isDataPassata(e.data));
 sortEventiPerDataEOra(eventiReg);
 if (!eventiReg.length) {
 hide("loader");
 const grid = document.getElementById("reg-ev-grid");
 if (grid) {
 grid.innerHTML = `
 <div class="reg-empty-state" style="grid-column:1/-1;text-align:center;padding:48px 24px;background:var(--parch2);border:1px dashed var(--vellum);border-radius:var(--radius-l);">
 <span style="font-size:48px;display:block;margin-bottom:16px;opacity:.7">🎲</span>
 <p style="font-family:var(--font-d);font-size:18px;color:var(--ink2);margin:0 0 8px">Nessun evento attivo al momento</p>
 <p style="font-size:14px;color:var(--smoke);margin:0">Torna a trovarci presto per scoprire le prossime date!</p>
 </div>`;
 }
 show("reg-main");
 } else {
 hide("loader");
 renderRegEventi();
 show("reg-main");
 logRegForm("eventi_caricati", `${eventiReg.length} eventi disponibili`);
 regPreloadEventiDisponibilitaTavoli();
 }
 document.getElementById("h-title").textContent = "Prenota il tuo posto al tavolo!";
 const tornaBar = document.getElementById("reg-torna-user-bar");
 const recuperaBar = document.getElementById("reg-recupera-bar");
 if (tornaBar && typeof UUID !== "undefined" && UUID) { tornaBar.classList.remove("hidden"); if (recuperaBar) recuperaBar.classList.add("hidden"); }
 else { if (tornaBar) tornaBar.classList.add("hidden"); if (recuperaBar) recuperaBar.classList.remove("hidden"); }
 })
 .withFailureHandler(err => {
 hide("loader"); show("reg-main");
 flash("reg-fa","Impossibile caricare gli eventi. Controlla la connessione e riprova.","err");
 })
 .getEventiConSessioni();
 });
}

function caricaUtente() {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 console.error("[caricaUtente] google.script.run non disponibile");
 mostraFallbackCaricamentoUtente("Connessione con Google Apps Script non disponibile.");
 return;
 }
 setLdr("Caricamento prenotazioni…"); show("loader"); hide("user-main");
 stopLiveSync();
 google.script.run
 .withSuccessHandler(r => {
 console.log("[caricaUtente] risposta getPrenotazioni:", r);
 if (r == null) {
 console.error("[caricaUtente] getPrenotazioni ha restituito null. Avvio diagnostica UUID…", UUID);
 google.script.run
 .withSuccessHandler(diag => {
 console.log("[caricaUtente] diagnosticaUuidUtente:", diag);
 mostraFallbackCaricamentoUtente("Errore di caricamento dati utente. Riprova tra pochi secondi.");
 })
 .withFailureHandler(err2 => {
 console.error("[caricaUtente] failure diagnosticaUuidUtente:", err2);
 mostraFallbackCaricamentoUtente("Risposta nulla da getPrenotazioni e diagnostica fallita.");
 })
 .diagnosticaUuidUtente(UUID);
 return;
 }
 if (Array.isArray(r?.fasceEta)) {
 renderUtente(r);
 return;
 }
 syncFasceEtaDaFoglio(() => renderUtente(r));
 })
 .withFailureHandler(err => {
 console.error("[caricaUtente] failure getPrenotazioni:", err);
 mostraFallbackCaricamentoUtente((err && err.message) ? err.message : "Operazione non riuscita. Riprova.");
 })
 .getPrenotazioniSafe(UUID);
}

function mostraFallbackCaricamentoUtente(msg) {
 hide("loader");
 const detail = escapeHtml(msg || "Errore caricamento area utente.");
 const noUuid = document.getElementById("no-uuid");
 if (noUuid) {
 noUuid.innerHTML = `<div class="flash f-err">⚠️ ${detail}</div>`;
 show("no-uuid");
 }
 // Fallback visivo: evita pagina bianca, mostra subito recupero link.
 show("reg-main");
 hide("reg-panel");
 show("reg-recupera");
 hide("user-main");
 setHSub("Recupera il tuo link personale");
}

function formatDesc(testo) {
 if (!testo) return "";
 return testo
 .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
 .replace(/\*(.+?)\*/g, "<em>$1</em>")
 .replace(/\n{2,}/g, "</p><p>")
 .replace(/\n/g, "<br>")
 .replace(/^/, "<p>").replace(/$/, "</p>");
}

function troncaDesc(html, maxChars) {
 const tmp = document.createElement("div");
 tmp.innerHTML = html;
 const testo = tmp.textContent || "";
 if (testo.length <= maxChars) return { corto: html, lungo: null };
 const taglio = testo.lastIndexOf(" ", maxChars) || maxChars;
 return { corto: testo.slice(0, taglio) + "…", lungo: html };
}

function toggleDesc(i) {
 const s = document.getElementById(`rdesc-s-${i}`);
 const f = document.getElementById(`rdesc-f-${i}`);
 const btn = document.getElementById(`rdesc-btn-${i}`);
 if (!s || !f || !btn) return;
 const expanded = !f.classList.contains("hidden");
 s.classList.toggle("hidden", !expanded);
 f.classList.toggle("hidden", expanded);
 btn.textContent = expanded ? "Leggi tutto ↓" : "Riduci ↑";
}

/** Badge GDR/GDT (e altri tipi) sulle card evento — dati da getEventiConSessioni().tipiTavolo */
function regHtmlTipiTavolo(tipi) {
 const arr = Array.isArray(tipi) ? tipi.map(t => String(t || "").trim().toUpperCase()).filter(Boolean) : [];
 if (!arr.length) return "";
 const titleMap = { GDR: "Gioco di ruolo", GDT: "Gioco Libero (GDT)", GIOCO_LIBERO: "Gioco Libero (GDT)", PANEL: "Panel", PRENOTAZIONI_TAVOLI: "Prenotazioni Tavoli" };
 const labelMap = { GDR: "GDR", GDT: "GDT", GIOCO_LIBERO: "GDT", PANEL: "Panel", PRENOTAZIONI_TAVOLI: "Prenotazioni Tavoli" };
 const toHuman = (raw) => {
 const s = String(raw || "").trim().toLowerCase().replace(/[_-]+/g, " ");
 if (!s) return "";
 return s.replace(/\b\w/g, c => c.toUpperCase());
 };
 const pills = arr.map(u => {
 const cls = u === "GDR" ? "ev-tipo-gdr" : (u === "GDT" || u === "GIOCO_LIBERO") ? "ev-tipo-gdt" : "ev-tipo-alt";
 const label = escapeHtml(labelMap[u] || toHuman(u));
 const title = titleMap[u] || ("Tipo tavolo: " + u);
 return `<span class="rec-pill ev-tipo ${cls}" title="${escapeHtml(title)}">${label}</span>`;
 }).join("");
 return `<div class="rec-tipit-wrap" role="group" aria-label="Tipi di tavolo disponibili per questo evento">${pills}</div>`;
}

function renderRegEventi() {
 const grid = document.getElementById("reg-ev-grid");
 if (!grid) return;
 const openMap = window._regEventHasTavoliMap || {};

 grid.innerHTML = eventiReg.map((ev, i) => {
 const sessioni = (ev.sessioni || []).slice();
 // Ordina per ora d'inizio sessione prima di mostrare le pills
 sessioni.sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 const nSess = sessioni.length;

 let sessPills = "";
 if (nSess === 1 && sessioni[0].orario) {
 sessPills = `<span class="rec-pill ev-sess">🕐 ${sessioni[0].orario}</span>`;
 } else if (nSess === 1) {
 sessPills = `<span class="rec-pill ev-sess">1 sessione</span>`;
 } else {
 sessPills = sessioni.map(s =>
 `<span class="rec-pill ev-sess">🕐 ${s.nome}${s.orario ? " · " + s.orario : ""}</span>`
 ).join("");
 }

 const statoPren = openMap[ev.eventId];
 const inApertura = (statoPren === false);
 const prenInfo = (statoPren === false)
 ? `<div class="rec-info-row">📌 <span>Prenotazioni in apertura</span></div>`
 : "";
 const cardOnclick = inApertura ? "" : ` onclick="regSelezionaEvento('${ev.eventId}')"`;
 const ctaText = inApertura
 ? `<span style="color:var(--ash);font-style:italic">Prenotazioni in apertura</span>`
 : `<span>Prenota <span style="font-size:14px">→</span></span>`;

 return `
 <div class="reg-ev-card${inApertura ? " disabled" : ""}"${cardOnclick} style="animation-delay:${Math.min(i, 6)*.04}s">
 <div class="rec-body">
 <div class="rec-nome">${ev.nome}</div>
 ${regHtmlTipiTavolo(ev.tipiTavolo)}
 <div class="rec-info">
 ${ev.data ? `<div class="rec-info-row">📅 <span>${formatDataItaliana(ev.data)}</span></div>` : ""}
 ${ev.luogo ? `<div class="rec-info-row">📍 <span>${formatLuogoConACapo(ev.luogo)}</span></div>` : ""}
 ${prenInfo}
 </div>
 ${sessPills ? `<div class="rec-pills" style="margin-top:10px">${sessPills}</div>` : ""}
 </div>
 <div class="rec-footer">
 <button type="button" class="rec-foot-btn" onclick="event.stopPropagation();apriDettaglioEvento(${i})">Dettaglio</button>
 ${ctaText}
 </div>
 </div>`;
 }).join('');
}

function _evDetailCols(n, maxCols) {
 const count = Math.max(1, parseInt(n, 10) || 1);
 const max = Math.max(1, parseInt(maxCols, 10) || 4);
 return Math.min(count, max);
}

function _htmlGiochiDettaglioEvento(giochi) {
 if (!giochi || !giochi.length) return "";
 const cols = _evDetailCols(giochi.length, 4);
 const cards = giochi.map(g =>
 `<div class="ev-detail-gioco-card"><span class="gioco-ico" aria-hidden="true">🎲</span>${escapeHtml(g)}</div>`
 ).join("");
 return `<div style="margin-top:8px">
 <div style="font-family:var(--font-m);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ash);margin-bottom:8px">🎲 Giochi presenti</div>
 <div class="ev-detail-giochi-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cards}</div>
 </div>`;
}

function _htmlTavoliDettaglioEvento(tavoli) {
 const list = (Array.isArray(tavoli) ? tavoli : [])
 .filter(t => String(t?.id || "") !== "SESSIONE_LIBERA" && t?.attivo !== false);
 if (!list.length) {
 return `<p style="margin:8px 0 0;font-size:13px;color:var(--ash);font-style:italic">Nessun tavolo in questa sessione.</p>`;
 }
 const cols = _evDetailCols(list.length, 3);
 return `<div class="ev-detail-tavoli-grid" style="margin-top:8px;grid-template-columns:repeat(${cols},minmax(0,1fr))">${list.map(t => {
 const titolo = String(t.titoloAvventura || t.gioco || "Tavolo").trim();
 const sistema = String(t.sistemaGioco || "").trim();
 const max = Math.max(0, parseInt(t.max || 0, 10) || 0);
 const occ = Math.min(max, Math.max(0, parseInt(t.occupati || 0, 10) || 0));
 const lib = Math.max(0, parseInt(t.liberi != null ? t.liberi : (max - occ), 10) || 0);
 const postiTxt = lib > 0
 ? `${lib} post${lib === 1 ? "o" : "i"} liber${lib === 1 ? "o" : "i"}`
 : "Pieno";
 return `<div class="ev-detail-gioco-card" style="font-weight:400">
 <div style="font-weight:600;color:var(--ink);font-size:14.5px;line-height:1.3">${escapeHtml(titolo)}</div>
 ${sistema ? `<div style="font-size:13px;color:var(--smoke);margin-top:4px">🎲 ${escapeHtml(sistema)}</div>` : ""}
 <div style="font-size:13px;margin-top:8px;color:${lib > 0 ? "var(--ok)" : "var(--err)"}">${lib > 0 ? "🟢" : "🔴"} ${postiTxt}</div>
 </div>`;
 }).join("")}</div>`;
}

function apriDettaglioEvento(idx) {
 const ev = eventiReg && eventiReg[idx];
 if (!ev) return;
 const titleEl = document.getElementById("evento-detail-title");
 const contentEl = document.getElementById("evento-detail-content");
 if (!titleEl || !contentEl) return;

 const sessioni = (ev.sessioni || []).slice().sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 const tipoHtml = regHtmlTipiTavolo(ev.tipiTavolo || []);
 const descr = (ev.descrizione || "").trim();
 const descrHtml = descr ? formatDesc(descr) : `<p style="font-style:italic;color:var(--ash)">Nessuna descrizione disponibile.</p>`;
 const sessHtml = sessioni.length
 ? sessioni.map((s, si) => {
 const label = `🕐 ${escapeHtml(s.nome || s.sessioneId || "Sessione")}${s.orario ? " · " + escapeHtml(s.orario) : ""}`;
 const senzaTav = sessioneSenzaTavoli(s);
 const giochi = _regGdtGiochiLista(s);
 let body = "";
 if (senzaTav) {
 body = _htmlGiochiDettaglioEvento(giochi);
 } else {
 body = `<div id="ev-detail-tavoli-${si}" style="margin-top:8px;font-size:13px;color:var(--ash);font-style:italic">Caricamento tavoli…</div>`;
 }
 return `<div style="margin:0 0 14px">
 <span class="rec-pill ev-sess">${label}</span>
 ${body}
 </div>`;
 }).join("")
 : `<span style="font-size:13px;color:var(--ash);font-style:italic">Nessuna sessione disponibile.</span>`;

 titleEl.textContent = ev.nome || "Dettaglio evento";
 contentEl.innerHTML = `
 <div class="ev-detail-meta">
 ${ev.data ? `<span class="rec-pill ev-sess">📅 ${escapeHtml(formatDataItaliana(ev.data))}</span>` : ""}
 ${ev.luogo ? `<span class="rec-pill ev-sess">📍 ${escapeHtml(ev.luogo)}</span>` : ""}
 </div>
 ${tipoHtml}
 <div class="ev-detail-desc">${descrHtml}</div>
 <div class="ev-detail-sess">${sessHtml}</div>
 `;
 show("evento-detail-overlay");

 // GDR / sessioni con tavoli: carica titolo avventura, sistema, posti liberi
 const evId = String(ev.eventId || "").trim();
 sessioni.forEach((s, si) => {
 if (sessioneSenzaTavoli(s)) return;
 const slot = document.getElementById("ev-detail-tavoli-" + si);
 if (!slot || !evId) return;
 google.script.run
 .withSuccessHandler((tavoli) => {
 if (!slot.isConnected) return;
 slot.outerHTML = _htmlTavoliDettaglioEvento(tavoli);
 })
 .withFailureHandler(() => {
 if (!slot.isConnected) return;
 slot.innerHTML = `<span style="color:var(--err)">Impossibile caricare i tavoli.</span>`;
 })
 .getTavoliPerSessione(evId, s.sessioneId);
 });
}

function chiudiDettaglioEvento() {
 hide("evento-detail-overlay");
}

function apriDettaglioTavolo(tavoloId) {
 const t = (regTavoliCorrenti || []).find(x => String(x.id) === String(tavoloId));
 if (!t) return;

 const occ = Math.min(Number(t.occupati || 0), Number(t.max || 0));
 const max = Number(t.max || 0);
 const lib = Math.max(0, max - occ);
 const tipo = String(t.tipo || "GDR").toUpperCase();
 const sistema = String(t.sistemaGioco || "").trim();
 const master = (t.mostraMaster && t.master) ? String(t.master || "").trim() : "";
 const livello = String(t.livello || "").trim();
 const descrAvv = String(t.descrizione || "").trim();
 const descrTav = String(t.descrizioneTavolo || "").trim();
 const fasce = Array.isArray(t.fasce) ? t.fasce.filter(Boolean) : [];

 const titleEl = document.getElementById("tavolo-detail-title");
 const contentEl = document.getElementById("tavolo-detail-content");
 if (!titleEl || !contentEl) return;

 titleEl.textContent = t.gioco || "Dettaglio tavolo";
 contentEl.innerHTML = `
 <div class="ev-detail-meta">
 <span class="rec-pill ${tipo === "GDR" ? "ev-tipo-gdr" : "ev-tipo-gdt"}">${escapeHtml(tipo)}</span>
 ${sistema ? `<span class="rec-pill ev-sess">🎲 ${escapeHtml(sistema)}</span>` : ""}
 ${livello ? `<span class="rec-pill ev-sess">📶 ${escapeHtml(livello)}</span>` : ""}
 ${master ? `<span class="rec-pill ev-sess">🧙 ${escapeHtml(master)}</span>` : ""}
 <span class="rec-pill ev-sess">👥 ${occ}/${max} occupati</span>
 <span class="rec-pill ev-sess">${lib > 0 ? `🟢 ${lib} liberi` : "🔴 Pieno"}</span>
 </div>
 ${descrAvv ? `<div class="ev-detail-desc"><div style="font-size:12px;font-weight:600;color:var(--ember2);margin-bottom:6px">Avventura</div>${formatDesc(descrAvv)}</div>` : ""}
 ${descrTav ? `<div class="ev-detail-desc" style="margin-top:${descrAvv ? "14px" : "0"}"><div style="font-size:12px;font-weight:600;color:var(--ember2);margin-bottom:6px">Tavolo</div>${formatDesc(descrTav)}</div>` : ""}
 ${!descrAvv && !descrTav ? `<p style="font-style:italic;color:var(--ash)">Nessuna descrizione disponibile.</p>` : ""}
 ${fasce.length ? `<div class="ev-detail-sess">${fasce.map(f => `<span class="rec-pill ev-sess">👥 ${escapeHtml(f)}</span>`).join("")}</div>` : ""}
 `;
 show("tavolo-detail-overlay");
}

function chiudiDettaglioTavolo() {
 hide("tavolo-detail-overlay");
}

function regEventoHaTavoliAttivi(evObj, onDone) {
 const ev = evObj || {};
 const evId = String(ev.eventId || "").trim();
 const sessioni = Array.isArray(ev.sessioni) ? ev.sessioni.slice() : [];
 if (!evId || !sessioni.length) {
 if (typeof onDone === "function") onDone(false);
 return;
 }
 let pending = sessioni.length;
 let found = false;
 const finish = () => {
 pending--;
 if (pending <= 0 && typeof onDone === "function") onDone(found);
 };
 sessioni.forEach(s => {
 const sessId = String(s?.sessioneId || "").trim();
 if (!sessId) { finish(); return; }
 google.script.run
 .withSuccessHandler(tavoli => {
 if (!found && Array.isArray(tavoli) && tavoli.length > 0) found = true;
 finish();
 })
 .withFailureHandler(() => finish())
 .getTavoliPerSessione(evId, sessId);
 });
}

function regSelezionaEvento(evId) {
 const statoPren = window._regEventHasTavoliMap?.[evId];
 if (statoPren === false) return;
 regEvSelezionato = eventiReg.find(e => e.eventId === evId);
 regSessSelezionata = null;
 regTavoliSelezionati = {};
 regAttesaSelezionata = false;
 regGdtNumPersone = 1;
 regGdtFasciaEta = "";
 if (!regEvSelezionato) return;

 const selEv = document.getElementById("r-evento");
 selEv.innerHTML = `<option value="${evId}" selected></option>`;

 const sessioni = (regEvSelezionato.sessioni || []).slice().sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 const misto = eventoSessioniMiste(regEvSelezionato);
 document.getElementById("reg-s2-title").textContent =
 "📜 " + regEvSelezionato.nome + (regEvSelezionato.data ? " · " + formatDataItaliana(regEvSelezionato.data) : "");

 if (misto) {
 regTipoMisto = "";
 regMostraSceltaMisto();
 logRegForm("evento_scelto", regEvSelezionato.nome, { eventId: evId, misto: true });
 return;
 }

 hide("reg-misto-scelta");
 show("reg-s1-lista");
 show("reg-s3-dati");
 show("reg-s3-actions");
 const cambiaTipo = document.getElementById("reg-misto-cambia");
 if (cambiaTipo) cambiaTipo.classList.add("hidden");

 const primaS = sessioni[0] || { sessioneId: "", nome: "" };
 regSessSelezionata = primaS;
 const isIngresso = sessioneSenzaTavoli(primaS);

 setRegStep(2);
 regApplyWizardModeForEvento(regEvSelezionato, primaS);
 logRegForm("evento_scelto", regEvSelezionato.nome, {
 eventId: evId,
 tipoSessione: primaS.tipoSessione || "",
 senzaTavoli: !!isIngresso,
 misto: false
 });

 // Solo ingresso multi: pill sullo step dati. Solo tavoli multi: pill sullo step tavoli.
 if (isIngresso && sessioni.length > 1) {
 const pillsEl = document.getElementById("reg-gdt-sess-pills");
 if (pillsEl) pillsEl.innerHTML = sessioni.map((s, i) => _regHtmlSessionePill(s, i === 0)).join("");
 show("reg-gdt-sess-wrap");
 hide("reg-sess-wrap");
 } else if (!isIngresso && sessioni.length > 1) {
 const pillsEl = document.getElementById("reg-sess-pills");
 if (pillsEl) {
 pillsEl.innerHTML = sessioni.map((s, i) =>
 `<button class="mappa-sess-btn${i===0?" active":""}"
 onclick="regSelezionaSessione('${String(s.sessioneId || "").replace(/'/g, "\\'")}',this)">
 🧭 ${s.nome||s.sessioneId}${s.orario?` <span style="opacity:.8">| 🕑 ${s.orario}</span>`:""}
 </button>`
 ).join("");
 }
 show("reg-sess-wrap");
 hide("reg-gdt-sess-wrap");
 } else {
 hide("reg-sess-wrap");
 hide("reg-gdt-sess-wrap");
 }

 hide("reg-s1"); show("reg-s3");
 regPrecompilaDatiUtente();

 const selSess = document.getElementById("r-sessione");
 selSess.innerHTML = `<option value="${primaS.sessioneId}" selected></option>`;

 if (isIngresso) {
 regGdtCaricaCapienza(evId, primaS.sessioneId);
 } else {
 caricaTavoliRegNew(evId, primaS.sessioneId);
 }
}

function regApriDettaglioMisto() {
 const evId = regEvSelezionato && regEvSelezionato.eventId;
 if (!evId) return;
 const idx = (eventiReg || []).findIndex(e => e && e.eventId === evId);
 if (idx < 0) return;
 apriDettaglioEvento(idx);
}

function regMostraSceltaMisto() {
 if (!eventoSessioniMiste(regEvSelezionato)) return;
 regTipoMisto = "";
 regSessSelezionata = null;
 regTavoliSelezionati = {};
 regAttesaSelezionata = false;
 hide("reg-s2");
 hide("reg-s4");
 hide("reg-s3");
 hide("reg-gdt-sess-wrap");
 hide("reg-gdt-block");
 hide("reg-s1-lista");
 show("reg-misto-scelta");
 show("reg-s1");
 const cambia = document.getElementById("reg-misto-cambia");
 if (cambia) cambia.classList.add("hidden");
 setRegStep(1);
 const intro = document.getElementById("reg-home-intro");
 if (intro) intro.classList.add("hidden");
}

function regScegliTipoMisto(tipo) {
 const wantGdt = tipo === "gdt";
 regTipoMisto = wantGdt ? "gdt" : "gdr";
 const sessioni = (regEvSelezionato?.sessioni || []).slice()
 .filter(s => sessioneSenzaTavoli(s) === wantGdt)
 .sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 if (!sessioni.length) return;
 hide("reg-misto-scelta");
 show("reg-s1-lista");
 hide("reg-s1");
 show("reg-s3-dati");
 show("reg-s3-actions");
 setRegStep(2);
 const cambia = document.getElementById("reg-misto-cambia");
 if (cambia) cambia.classList.remove("hidden");
 const pillsEl = document.getElementById("reg-gdt-sess-pills");
 if (sessioni.length > 1 && pillsEl) {
 pillsEl.innerHTML = sessioni.map((s, i) => _regHtmlSessionePill(s, i === 0)).join("");
 show("reg-gdt-sess-wrap");
 } else {
 hide("reg-gdt-sess-wrap");
 }
 regApplicaSessioneWizard(sessioni[0].sessioneId);
}

function regSelezionaSessioneGdt(sessId, btn) {
 // compat → wizard unificato (anche eventi misti: niente salto ai tavoli senza dati)
 regApplicaSessioneWizard(sessId, btn);
}

function regPreloadEventiDisponibilitaTavoli(onDone) {
 // Non chiedere i tavoli di ogni sessione all'apertura della home: con molti
 // eventi sono decine di chiamate e bloccano prenota e dettaglio. Le card
 // restano prenotabili; l'assenza di tavoli si vede aprendo l'evento.
 if (Array.isArray(eventiReg)) {
 const map = window._regEventHasTavoliMap || {};
 window._regEventHasTavoliMap = map;
 eventiReg.forEach(ev => {
 const evId = String(ev?.eventId || "").trim();
 if (evId && !Object.prototype.hasOwnProperty.call(map, evId)) map[evId] = true;
 });
 }
 if (typeof onDone === "function") onDone();
}

function regSelezionaSessione(sessId, btn) {
 // Da step tavoli (solo GDR multi): se la sessione è ingresso, torna allo step prenotazione.
 if (eventoSessioniMiste(regEvSelezionato) || sessioneSenzaTavoli(
 (regEvSelezionato?.sessioni || []).find(x => x.sessioneId === sessId)
 )) {
 regApplicaSessioneWizard(sessId, btn);
 return;
 }
 document.querySelectorAll("#reg-sess-pills .mappa-sess-btn").forEach(b => b.classList.remove("active"));
 if (btn) btn.classList.add("active");
 const s = regEvSelezionato?.sessioni?.find(x => x.sessioneId === sessId);
 regSessSelezionata = s || { sessioneId: sessId };
 regTavoliSelezionati = {};
 regAttesaSelezionata = false;
 const selSess = document.getElementById("r-sessione");
 selSess.innerHTML = `<option value="${sessId}" selected></option>`;
 logRegForm("sessione_scelta", s?.nome || sessId, {
 eventId: regEvSelezionato?.eventId,
 sessioneId: sessId,
 tipoSessione: (s && s.tipoSessione) || "",
 senzaTavoli: false
 });
 regApplyWizardModeForEvento(regEvSelezionato, regSessSelezionata);
 caricaTavoliRegNew(regEvSelezionato.eventId, sessId);
}

function caricaTavoliRegNew(evId, sessId) {
 document.getElementById("reg-tav-grid").innerHTML =
 `<div style="grid-column:1/-1">${loaderHtml("Caricamento tavoli…")}</div>`;
 google.script.run
 .withSuccessHandler(tavoli => {
 const list = tavoli || [];
 logRegForm("tavoli_caricati", `${list.length} tavoli`, { eventId: evId, sessioneId: sessId });
 renderRegTavoli(evId, sessId, list);
 })
 .withFailureHandler(() => {
 logRegForm("tavoli_errore", "Caricamento tavoli fallito", { eventId: evId, sessioneId: sessId });
 document.getElementById("reg-tav-grid").innerHTML =
 `<div style="grid-column:1/-1;color:var(--err);padding:16px">Errore caricamento tavoli. Riprova.</div>`;
 })
 .getTavoliPerSessione(evId, sessId);
}

function renderRegTavoli(evId, sessId, tavoli) {
 const grid = document.getElementById("reg-tav-grid");
 const sKey = "reg_"+sl(evId)+"_"+sl(sessId);
 const tuttoPieno = tavoli.every(t => t.liberi <= 0);
 const richiedeFascia = (tipo) => {
 const t = String(tipo || "").trim().toUpperCase();
 return !(t === "PANEL" || t === "GIOCO_LIBERO");
 };

 regTavoliSelezionati = {};
 regAttesaPreferenze = [];
 regTavoliCorrenti = Array.isArray(tavoli) ? tavoli : [];

 if (!tavoli.length) {
 grid.classList.remove("single");
 grid.innerHTML = `<div style="grid-column:1/-1">${emptyStateHtml("🎲", "Nessun tavolo disponibile per questa sessione.")}</div>`;
 hide("reg-attesa-row");
 aggiornaRegSummary();
 return;
 }
 grid.classList.toggle("single", tavoli.length === 1);

 grid.innerHTML = tavoli.map((t, i) => {
 const occ = Math.min(t.occupati, t.max);
 const pct = t.max > 0 ? Math.round(occ / t.max * 100) : 0;
 const lib = Math.max(0, t.max - occ);
 const pieno = lib <= 0;
 const barCol = pieno ? '#c62828' : pct >= 70 ? '#e65100' : '#2e7d32';
 const postiCls = pieno ? 'rtc-posti-zero' : lib <= 2 ? 'rtc-posti-few' : 'rtc-posti-ok';
 const postiTxt = pieno ? '🔴 Pieno' : lib === 1 ? '🟠 1 posto libero' : `🟢 ${lib} liberi`;
 const giocoEsc = t.gioco.replace(/'/g,"\\'").replace(/"/g,'&quot;');
 const fasceArr = Array.isArray(t.fasce) ? t.fasce.filter(Boolean) : [];
 const fasceEsistenti = richiedeFascia(t.tipo)
 ? `<div class="rtc-fasce-esistenti" onclick="event.stopPropagation()">
 <span class="rtc-fasce-lbl">👥 Fasce già presenti:</span>
 ${fasceArr.length
 ? fasceArr.map(f => `<span class="rtc-fascia-chip">${escapeHtml(labelFascia(f) || f)}</span>`).join('')
 : `<span class="rtc-fascia-chip rtc-fascia-chip-empty">Nessuna indicata</span>`}
 </div>`
 : "";

 const sistemaBadge = t.sistemaGioco
 ? `<span class="tipo-badge sys" title="${escapeHtml(String(t.sistemaGioco))}">${escapeHtml(String(t.sistemaGioco))}</span>`
 : "";
 const livelloBadge = t.livello
 ? `<span class="tipo-badge" title="Livello avventura">📶 ${escapeHtml(String(t.livello))}</span>`
 : "";
 const masterLine = (t.mostraMaster && t.master)
 ? `<div class="rtc-master" style="font-size:12px;color:var(--ash);margin-top:4px">🧙 Master: ${escapeHtml(String(t.master))}</div>`
 : "";
 const cardTitle = pieno ? " title=\"Tavolo pieno. Usa la lista d'attesa per questo gioco.\"" : "";
 const cardOnclick = pieno ? "" : ` onclick="regToggleTavolo('${t.id}','${giocoEsc}',${lib},${t.max})"`;
 return `
 <div class="reg-tav-card${pieno?" pieno":""}" id="rtc-${sKey}-${t.id}" data-tipo="${String(t.tipo||"").replace(/"/g,'&quot;')}" style="animation-delay:${i*.05}s" role="button" tabindex="${pieno?-1:0}"${cardTitle}${cardOnclick}>
 <div class="rtc-head">
 <div class="rtc-nome">${t.gioco}</div>
 </div>
 <div class="rtc-id">
 <span class="tipo-badge ${t.tipo==="GDR"?"t-gdr":"t-gdt"}">${t.tipo||"GDR"}</span>
 ${sistemaBadge}
 ${livelloBadge}
 </div>
 ${masterLine}
 <div class="rtc-bar-wrap">
 <div class="rtc-bar-fill" style="width:${pct}%;background:${barCol}"></div>
 </div>
 <div class="rtc-footer">
 <span class="${postiCls}">${postiTxt}</span>
 <button type="button" class="rtc-detail-btn" onclick="event.stopPropagation();apriDettaglioTavolo('${t.id}')">Dettaglio</button>
 ${pieno ? '' : `
 <div class="rtc-qty-wrap hidden" id="qty-${sKey}-${t.id}" onclick="event.stopPropagation()">
 <button class="qty-btn" onclick="regCambiaQty('${t.id}',${lib},-1)">−</button>
 <span class="qty-val" id="qval-${sKey}-${t.id}">1</span>
 <button class="qty-btn" onclick="regCambiaQty('${t.id}',${lib},+1)">+</button>
 </div>`}
 </div>
 ${fasceEsistenti}
 ${pieno || !richiedeFascia(t.tipo) ? '' : `
 <!-- Fasce età inline – visibili solo quando il tavolo è selezionato -->
 <div class="tav-fasce-inline hidden" id="fasce-inline-${sKey}-${t.id}" onclick="event.stopPropagation()">
 <div class="lbl-fasce" id="fasce-lbl-${sKey}-${t.id}">🎯 Fasce età del gruppo</div>
 <div class="fasce-grid" id="fasce-chips-${sKey}-${t.id}"></div>
 <div class="tav-fasce-req" id="fasce-req-${sKey}-${t.id}">⚠ Seleziona almeno una fascia età</div>
 </div>`}
 </div>`;
 }).join('');

 if (tuttoPieno) {
 show("reg-attesa-row");
 renderRegAttesaPreferenze(tavoli);
 if (!window._regAttesaLastHWired) {
 window._regAttesaLastHWired = true;
 const chkLast = document.getElementById("reg-attesa-last-chk");
 const inpLast = document.getElementById("reg-attesa-last-ore");
 chkLast?.addEventListener("change", () => {
 logRegForm("attesa_lasth", chkLast.checked
 ? `Ultime ${Math.max(1, Math.min(24, parseInt(inpLast?.value || "6", 10) || 6))} ore`
 : "Solo oltre 24h prima della sessione");
 });
 inpLast?.addEventListener("change", () => {
 if (chkLast?.checked) {
 logRegForm("attesa_lasth_ore", `${Math.max(1, Math.min(24, parseInt(inpLast?.value || "6", 10) || 6))} ore`);
 }
 });
 }
 } else {
 hide("reg-attesa-row");
 }

 aggiornaRegSummary();
}

function renderRegAttesaPreferenze(tavoli) {
 const prefEl = document.getElementById("reg-attesa-pref");
 const reqEl = document.getElementById("reg-attesa-pref-req");
 if (!prefEl) return;
 const pieni = (tavoli || []).filter(t => (t.liberi || 0) <= 0);
 // Se non ci sono tavoli pieni, nessuna lista d'attesa disponibile
 if (!pieni.length) {
 prefEl.innerHTML = `<span style="font-size:12px;color:var(--ash);font-style:italic">Nessun tavolo pieno: la lista d'attesa non è disponibile.</span>`;
 if (reqEl) reqEl.classList.remove("visible");
 regAttesaPreferenze = [];
 return;
 }
 // Se c'è un solo tavolo pieno, la preferenza è implicita: lo selezioniamo in automatico e non mostriamo i chip
 if (pieni.length === 1) {
 prefEl.innerHTML = `<span style="font-size:12px;color:var(--ash);font-style:italic">La lista d'attesa è per il tavolo <strong>${pieni[0].gioco}</strong>.</span>`;
 regAttesaPreferenze = [pieni[0].id];
 if (reqEl) reqEl.classList.remove("visible");
 aggiornaRegSummary();
 if (regAttesaSelezionata) refreshRegAttesaFasceChips();
 return;
 }
 // Più di un tavolo pieno: mostra selezione con priorità
 regAttesaPreferenze = [];
 prefEl.innerHTML = "";
 pieni.forEach(t => {
 const lbl = document.createElement("label");
 lbl.className = "fchip";
 const usePriority = WAITLIST_PRIORITY_ENABLED;
 lbl.innerHTML = usePriority
 ? `<input type="checkbox" value="${t.id}"><span class="cdot"></span>${t.gioco}<span class="pref-rank" data-id="${t.id}"></span>`
 : `<input type="checkbox" value="${t.id}"><span class="cdot"></span>${t.gioco}`;
 lbl.addEventListener("click", () => {
 const cb = lbl.querySelector("input");
 cb.checked = !cb.checked;
 lbl.classList.toggle("on", cb.checked);
 const id = t.id;
 if (cb.checked) {
 // Aggiungi in coda alla lista di priorità
 if (!regAttesaPreferenze.includes(id)) regAttesaPreferenze.push(id);
 } else {
 regAttesaPreferenze = regAttesaPreferenze.filter(x => x !== id);
 }
 // Aggiorna badge numerati #1, #2, ... solo se la priorità è abilitata
 if (usePriority) {
 const ranks = prefEl.querySelectorAll(".pref-rank");
 ranks.forEach(span => {
 const rid = span.getAttribute("data-id");
 const idx = regAttesaPreferenze.indexOf(rid);
 span.textContent = idx >= 0 ? `#${idx+1}` : "";
 });
 }
 if (reqEl) reqEl.classList.toggle("visible", regAttesaPreferenze.length === 0);
 logRegForm("attesa_pref_tavolo", (regAttesaPreferenze || []).join(", "), {
 eventId: regEvSelezionato?.eventId,
 sessioneId: regSessSelezionata?.sessioneId
 });
 aggiornaRegSummary();
 refreshRegAttesaFasceChips();
 });
 prefEl.appendChild(lbl);
 });
 if (reqEl) reqEl.classList.add("visible");
 if (regAttesaSelezionata) refreshRegAttesaFasceChips();
}

// Toggle selezione tavolo (single-select)
function regToggleTavolo(id, gioco, liberi, max) {
 const evId = regEvSelezionato?.eventId || "";
 const sessId= regSessSelezionata?.sessioneId || "";
 const sKey = "reg_"+sl(evId)+"_"+sl(sessId);
 const card = document.getElementById(`rtc-${sKey}-${id}`);
 const qWrap = document.getElementById(`qty-${sKey}-${id}`);
 const fasceInline = document.getElementById(`fasce-inline-${sKey}-${id}`);
 const fasceChips = document.getElementById(`fasce-chips-${sKey}-${id}`);

 const tipoTavolo = String(card?.dataset?.tipo || "").trim().toUpperCase();
 const richiedeFascia = !(tipoTavolo === "PANEL" || tipoTavolo === "GIOCO_LIBERO");

 if (regTavoliSelezionati[id]) {
 // Deseleziona
 logRegForm("tavolo_deselezionato", gioco, { eventId: evId, sessioneId: sessId, tavolo: id });
 delete regTavoliSelezionati[id];
 card?.classList.remove("selected");
 qWrap?.classList.add("hidden");
 fasceInline?.classList.add("hidden");
 } else {
 // Modalità tavolo singolo: prima deseleziona eventuali altri tavoli già scelti.
 Object.keys(regTavoliSelezionati).forEach(otherId => {
 const otherCard = document.getElementById(`rtc-${sKey}-${otherId}`);
 const otherQ = document.getElementById(`qty-${sKey}-${otherId}`);
 const otherF = document.getElementById(`fasce-inline-${sKey}-${otherId}`);
 delete regTavoliSelezionati[otherId];
 otherCard?.classList.remove("selected");
 otherQ?.classList.add("hidden");
 otherF?.classList.add("hidden");
 });

 // Seleziona
 const tMeta = (regTavoliCorrenti || []).find(x => String(x.id) === String(id));
 const sistemaGioco = tMeta ? String(tMeta.sistemaGioco || "").trim() : "";
 const minFascia = tMeta ? String(tMeta.fasciaEtaMinima || "").trim() : "";
 regTavoliSelezionati[id] = { id, gioco, tipo: tipoTavolo, liberi, max, num: 1, fasciaEta: "", sistemaGioco };
 card?.classList.add("selected");
 qWrap?.classList.remove("hidden");
 // Mostra fasce e inizializza i chip
 if (richiedeFascia && fasceInline && fasceChips) {
 fasceInline.classList.remove("hidden");
 renderFasceInlineIn(fasceChips, id, sKey, minFascia);
 } else if (regTavoliSelezionati[id]) {
 regTavoliSelezionati[id].fasciaEta = "";
 }
 if (qWrap) {
 const qv = document.getElementById(`qval-${sKey}-${id}`);
 if (qv) qv.textContent = "1";
 }
 logRegForm("tavolo_selezionato", `${gioco} · 1 posto`, { eventId: evId, sessioneId: sessId, tavolo: id });
 }

 document.getElementById("rtc-attesa")?.classList.remove("selected");
 regAttesaSelezionata = false;

 aggiornaRegSummary();
}

/** Renderizza i chip fasce età dentro la card tavolo, collegandoli allo stato */
function renderFasceInlineIn(container, tavId, sKey, minLabel) {
 container.innerHTML = "";
 const lbl = document.getElementById(`fasce-lbl-${sKey}-${tavId}`);
 if (lbl) {
 if (String(minLabel || "").trim()) {
 lbl.innerHTML = `🎯 Fasce età del gruppo <span style="margin-left:8px;font-size:11px;color:var(--ash);font-weight:500">Età minima tavolo:</span> <span class="tipo-badge t-gdt" style="margin-left:4px">${escapeHtml(labelFascia(minLabel))}</span>`;
 } else {
 lbl.textContent = "🎯 Fasce età del gruppo";
 }
 }
 const cur = regTavoliSelezionati[tavId]?.fasciaEta || "";
 const pruned = pruneFasciaEtaControMin(cur, minLabel);
 if (regTavoliSelezionati[tavId] && pruned !== cur) regTavoliSelezionati[tavId].fasciaEta = pruned;
 const lista = fasceEtaFiltratePerMin(minLabel);
 lista.forEach(f => {
 const lbl = document.createElement("label");
 const on = (regTavoliSelezionati[tavId]?.fasciaEta || "").split(",").map(x => fasciaId(x.trim())).filter(Boolean).includes(f.id);
 lbl.className = "fchip" + (on ? " on" : "");
 lbl.innerHTML = `<input type="checkbox" value="${escapeHtml(f.id)}"${on ? " checked" : ""}><span class="cdot"></span>${escapeHtml(f.label)}`;
 lbl.addEventListener("click", () => {
 const cb = lbl.querySelector("input");
 cb.checked = !cb.checked;
 lbl.classList.toggle("on", cb.checked);
 // Aggiorna lo stato nel dizionario
 if (regTavoliSelezionati[tavId]) {
 regTavoliSelezionati[tavId].fasciaEta = getFasce(container);
 }
 const fasceSel = getFasce(container);
 logRegForm("fascia_tavolo", labelsFasciaCsv(fasceSel) || fasceSel, {
 eventId: regEvSelezionato?.eventId,
 sessioneId: regSessSelezionata?.sessioneId,
 tavolo: tavId
 });
 // Nascondi l'avviso se almeno una fascia è selezionata
 const reqEl = document.getElementById(`fasce-req-${sKey}-${tavId}`);
 if (reqEl) reqEl.classList.toggle("visible", !getFasce(container));
 aggiornaRegSummary();
 });
 container.appendChild(lbl);
 });
}

function regCambiaQty(id, liberi, delta) {
 if (!regTavoliSelezionati[id]) return;
 const evId = regEvSelezionato?.eventId || "";
 const sessId= regSessSelezionata?.sessioneId || "";
 const sKey = "reg_"+sl(evId)+"_"+sl(sessId);
 const cur = regTavoliSelezionati[id].num;
 const nuova = Math.max(1, Math.min(liberi, cur + delta));
 regTavoliSelezionati[id].num = nuova;
 const qv = document.getElementById(`qval-${sKey}-${id}`);
 if (qv) qv.textContent = nuova;
 logRegForm("tavolo_posti", `${nuova} posti`, { eventId: evId, sessioneId: sessId, tavolo: id });
 aggiornaRegSummary();
}

function aggiornaRegSummary() {
 const entries = Object.values(regTavoliSelezionati);
 const hasAttesa = regAttesaSelezionata;
 const hasScelta = entries.length > 0 || hasAttesa;
 const richiedeFascia = (t) => {
 const tipo = String(t?.tipo || "").trim().toUpperCase();
 return !(tipo === "PANEL" || tipo === "GIOCO_LIBERO");
 };

 // Il bottone "Continua ai partecipanti" dipende dalla validità della scelta tavoli.
 const tutteFasceOk = entries.every(t => !richiedeFascia(t) || (t.fasciaEta && t.fasciaEta.trim() !== ""));
 const attesaFasciaOk = !regAttesaFasciaEta || regAttesaFasciaEta.trim() === "" ? false : true;
 const attesaPrefsOk = regAttesaPreferenze && regAttesaPreferenze.length > 0;
 const sceltaValida = hasScelta && (hasAttesa ? (attesaFasciaOk && attesaPrefsOk) : tutteFasceOk);
 const nextBtn = document.getElementById("reg-s2-next");
 if (nextBtn) nextBtn.disabled = !sceltaValida;
 const submitBtn = document.getElementById("r-submit");
 if (submitBtn) submitBtn.disabled = !sceltaValida;

 const summaryEl = document.getElementById("reg-sel-summary");
 const textEl = document.getElementById("reg-sel-text");
 if (!hasScelta) { summaryEl?.classList.add("hidden"); return; }

 summaryEl?.classList.remove("hidden");
 if (hasAttesa) {
 const fasceOk = regAttesaFasciaEta && regAttesaFasciaEta.trim() !== "";
 const prefsOk = regAttesaPreferenze && regAttesaPreferenze.length > 0;
 const prefsText = prefsOk
 ? ` · <span style="color:var(--smoke);font-style:italic;font-size:12px">🎲 Tavoli preferiti: ${regAttesaPreferenze.join(", ")}</span>`
 : ` · <span style="color:var(--err);font-size:11px">⚠ Seleziona almeno un tavolo preferito</span>`;
 textEl.innerHTML = `⏳ <strong>Lista d'attesa</strong> · <span style="font-family:var(--font-m);color:var(--ember)">${regAttesaNumPersone} person${regAttesaNumPersone===1?"a":"e"}</span>` +
 (fasceOk ? ` · <span style="color:var(--smoke);font-style:italic;font-size:12px">🎯 ${regAttesaFasciaEta}</span>` : ` · <span style="color:var(--err);font-size:11px">⚠ Seleziona fascia età</span>`) +
 prefsText;
 } else {
 const totP = entries.reduce((s,t) => s + t.num, 0);
 textEl.innerHTML = entries.map(t => {
 const fasceOk = t.fasciaEta && t.fasciaEta.trim() !== "";
 const fasciaNecessaria = richiedeFascia(t);
 return `🎲 <strong>${t.gioco}</strong> · <span style="font-family:var(--font-m);color:var(--ember)">${t.num} post${t.num===1?"o":"i"}</span>` +
 (!fasciaNecessaria
 ? ` · <span style="color:var(--smoke);font-style:italic;font-size:12px">🎯 fascia età non richiesta</span>`
 : (fasceOk
 ? ` · <span style="color:var(--smoke);font-style:italic;font-size:12px">🎯 ${escapeHtml(labelsFasciaCsv(t.fasciaEta))}</span>`
 : ` · <span style="color:var(--err);font-size:11px;font-family:var(--font-m)">⚠ fascia età richiesta</span>`));
 }).join("<br>") +
 `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--vellum);font-family:var(--font-m);font-size:11px;color:var(--ember)">
 Totale: ${totP} person${totP===1?"a":"e"}
 </div>`;
 }
}

// ── Step 2 (dati) → 3 (tavoli) ─────────────────────────────
function regPassaStep3() {
 if (regIsGdtEvento()) {
 inviaRegGdt();
 return;
 }
 const nome = String(document.getElementById("r-nome")?.value || "").trim();
 const email = String(document.getElementById("r-email")?.value || "").trim();
 if (!nome) { logRegForm("validazione_fallita", "Nome mancante (fase dati)"); popupErrorePrenotazione("⚠️ Inserisci nome e cognome."); return; }
 if (!email || email.indexOf("@") < 0) { logRegForm("validazione_fallita", "Email non valida (fase dati)"); popupErrorePrenotazione("⚠️ L'indirizzo email deve contenere @."); return; }

 logRegForm("fase_dati_ok", "Continua alla scelta tavoli", { email, nome });
 setRegStep(3);
 hide("reg-s3"); show("reg-s2");
 caricaTavoliRegNew(regEvSelezionato?.eventId, regSessSelezionata?.sessioneId || "");
 regWireAvventuraPrecheck();
 regPrecheckAvventuraGiaGiocata();
}

function regPassaStep4() {
 const entries = Object.values(regTavoliSelezionati);
 const hasScelta = entries.length > 0 || regAttesaSelezionata;
 if (!hasScelta) return;

 if (regAttesaSelezionata) {
 if (!regAttesaFasciaEta || regAttesaFasciaEta.trim() === "") {
 logRegForm("validazione_fallita", "Fascia età lista attesa mancante");
 popupErrorePrenotazione("⚠️ Seleziona almeno una fascia età per la lista d'attesa.");
 document.getElementById("reg-attesa-fasce-req")?.classList.add("visible");
 return;
 }
 if (!regAttesaPreferenze || regAttesaPreferenze.length === 0) {
 logRegForm("validazione_fallita", "Tavoli preferiti lista attesa mancanti");
 popupErrorePrenotazione("⚠️ Seleziona almeno un tavolo preferito per la lista d'attesa.");
 document.getElementById("reg-attesa-pref-req")?.classList.add("visible");
 return;
 }
 } else {
 const richiedeFascia = (t) => {
 const tipo = String(t?.tipo || "").trim().toUpperCase();
 return !(tipo === "PANEL" || tipo === "GIOCO_LIBERO");
 };
 for (const t of entries) {
 if (richiedeFascia(t) && (!t.fasciaEta || t.fasciaEta.trim() === "")) {
 logRegForm("validazione_fallita", `Fascia età mancante: ${t.gioco}`, { tavolo: t.id });
 popupErrorePrenotazione(`⚠️ Seleziona almeno una fascia età per il tavolo "${t.gioco}".`);
 const evId = regEvSelezionato?.eventId || "";
 const sessId= regSessSelezionata?.sessioneId || "";
 const sKey = "reg_"+sl(evId)+"_"+sl(sessId);
 const reqEl = document.getElementById(`fasce-req-${sKey}-${t.id}`);
 if (reqEl) reqEl.classList.add("visible");
 return;
 }
 }
 }

 const nextBtn = document.getElementById("reg-s2-next");
 if (nextBtn) nextBtn.disabled = true;
 regSetStep3Lock(true);
 regConfermaWarningStep34((ok) => {
 if (!ok) {
 logRegForm("conferma_warning_annullata", "Utente ha annullato dopo avviso precheck");
 regSetStep3Lock(false);
 if (nextBtn) nextBtn.disabled = false;
 return;
 }
 const detStep4 = regAttesaSelezionata
 ? `Lista attesa · ${regAttesaNumPersone} pers. · pref: ${(regAttesaPreferenze || []).join(", ")}`
 : entries.map(t => `${t.gioco} ×${t.num}`).join(" | ");
 logRegForm("fase_tavoli_ok", detStep4);
 setRegStep(4);
 hide("reg-s2"); show("reg-s4");
 const ownerCb = document.getElementById("reg-owner-partecipa");
 regPrenotantePartecipa = !(ownerCb && ownerCb.checked);
 renderRegRiepilogo();
 renderPartecipantiReg();
 regSetStep3Lock(false);
 if (nextBtn) nextBtn.disabled = false;
 });
}

function _buildRegPrenotazioniSnapshot() {
 if (regAttesaSelezionata) {
 const evId = regEvSelezionato?.eventId || "";
 const sessNome = regSessSelezionata?.nome || regSessSelezionata?.sessioneId || "";
 const prefStr = Array.isArray(regAttesaPreferenze) ? regAttesaPreferenze.join(", ") : "";
 const tavolo = `Lista d'attesa - ${regEvSelezionato?.nome||evId} - ${sessNome}${prefStr ? " | Pref: " + prefStr : ""}`;
 return [{ tavolo }];
 }
 const entries = Object.values(regTavoliSelezionati || {});
 return entries.map(t => ({ tavolo: `${t.id} - ${t.gioco}` }));
}

function regWireAvventuraPrecheck() {
 const emailEl = document.getElementById("r-email");
 if (!emailEl || emailEl.dataset.avvPrecheckWired === "1") return;
 const fn = () => regPrecheckAvventuraGiaGiocata();
 emailEl.addEventListener("blur", fn);
 emailEl.addEventListener("change", fn);
 emailEl.dataset.avvPrecheckWired = "1";
}

function regShowAvventuraWarning(msg) {
 const el = document.getElementById("reg-avv-warning");
 if (!el) return;
 const txt = String(msg || "").trim();
 if (!txt) {
 el.textContent = "";
 el.classList.add("hidden");
 return;
 }
 el.textContent = "⚠️ " + txt;
 el.classList.remove("hidden");
}

function regShowDuplicatoTavoloWarning(msg) {
 const el = document.getElementById("reg-dup-warning");
 if (!el) return;
 const txt = String(msg || "").trim();
 if (!txt) {
 el.textContent = "";
 el.classList.add("hidden");
 return;
 }
 el.textContent = "⚠️ " + txt;
 el.classList.remove("hidden");
}

function regShowSuccessWarnings(warns) {
 const el = document.getElementById("reg-ok-warning");
 if (!el) return;
 const list = Array.isArray(warns)
 ? warns.map(w => String(w || "").trim()).filter(Boolean)
 : [];
 if (!list.length) {
 el.textContent = "";
 el.classList.add("hidden");
 return;
 }
 el.textContent = "⚠️ " + list.join(" ");
 el.classList.remove("hidden");
}

function regConfermaWarningStep34(onDecision) {
 const done = (ok) => { if (typeof onDecision === "function") onDecision(!!ok); };
 const email = String(document.getElementById("r-email")?.value || "").trim().toLowerCase();
 if (!email || email.indexOf("@") <= 0) { done(true); return; }
 const prenotazioni = _buildRegPrenotazioniSnapshot();
 if (!prenotazioni.length) { done(true); return; }

 google.script.run
 .withSuccessHandler(res => {
 const warns = []
 .concat(res?.warnings?.avventura ? [res.warnings.avventura] : [])
 .concat(res?.warnings?.avventuraStessoEvento ? [res.warnings.avventuraStessoEvento] : [])
 .concat(res?.warnings?.tavoloDuplicato ? [res.warnings.tavoloDuplicato] : [])
 .map(w => String(w || "").trim())
 .filter(Boolean);
 if (!warns.length) { done(true); return; }
 const msg = "Attenzione: " + warns.join(" • ") + " Vuoi continuare comunque?";
 chiediConferma(msg, () => done(true), () => done(false));
 })
 .withFailureHandler(() => {
 // Se il precheck non risponde, non blocchiamo la navigazione tra step.
 done(true);
 })
 .verificaAvventureGiaGiocatePerEmailPreview({
 email,
 eventId: regEvSelezionato?.eventId || "",
 sessioneId: regSessSelezionata?.sessioneId || "",
 prenotazioni
 });
}

function regSetStep3Lock(locked) {
 const isLocked = !!locked;
 const ids = ["reg-sess-wrap", "reg-tav-grid", "reg-attesa-row"];
 ids.forEach(id => {
 const el = document.getElementById(id);
 if (!el) return;
 el.style.pointerEvents = isLocked ? "none" : "";
 el.style.opacity = isLocked ? "0.55" : "";
 });
}

function regPrecheckAvventuraGiaGiocata() {
 const email = String(document.getElementById("r-email")?.value || "").trim().toLowerCase();
 if (!email || email.indexOf("@") <= 0) {
 regShowAvventuraWarning("");
 regShowDuplicatoTavoloWarning("");
 return;
 }
 const prenotazioni = _buildRegPrenotazioniSnapshot();
 if (!prenotazioni.length) {
 regShowAvventuraWarning("");
 regShowDuplicatoTavoloWarning("");
 return;
 }
 const reqId = ++regPrecheckAvvRequestId;
 google.script.run
 .withSuccessHandler(res => {
 if (reqId !== regPrecheckAvvRequestId) return;
 const avvWarn = [
 String(res?.warnings?.avventura || "").trim(),
 String(res?.warnings?.avventuraStessoEvento || "").trim()
 ].filter(Boolean).join(" ");
 const dupWarn = String(res?.warnings?.tavoloDuplicato || "").trim();
 regShowAvventuraWarning(avvWarn);
 regShowDuplicatoTavoloWarning(dupWarn);
 })
 .withFailureHandler(() => {
 if (reqId !== regPrecheckAvvRequestId) return;
 regShowAvventuraWarning("");
 regShowDuplicatoTavoloWarning("");
 })
 .verificaAvventureGiaGiocatePerEmailPreview({
 email,
 eventId: regEvSelezionato?.eventId || "",
 sessioneId: regSessSelezionata?.sessioneId || "",
 prenotazioni
 });
}

function regPrecompilaDatiUtente() {
 const msgEl = document.getElementById("reg-dati-prefill-msg");
 const rNome = document.getElementById("r-nome");
 const rEmail = document.getElementById("r-email");
 const rCell = document.getElementById("r-cell");
 const rFonte = document.getElementById("r-fonte");
 if (msgEl) msgEl.classList.add("hidden");
 if (rNome) rNome.removeAttribute("readonly");
 if (rEmail) rEmail.removeAttribute("readonly");
 if (rCell) rCell.removeAttribute("readonly");
 if (rFonte) rFonte.removeAttribute("disabled");
 if (typeof UUID === "undefined" || !UUID || !datiUtente || !datiUtente.persona) {
 regAggiornaBloccoEmail();
 return;
 }
 const p = datiUtente.persona;
 if (rNome) { rNome.value = p.nome || ""; rNome.setAttribute("readonly", "readonly"); }
 if (rEmail) { rEmail.value = p.email || ""; rEmail.setAttribute("readonly", "readonly"); }
 if (rCell) { rCell.value = p.cellulare || ""; rCell.setAttribute("readonly", "readonly"); }
 if (rFonte) rFonte.disabled = true;
 if (msgEl) msgEl.classList.remove("hidden");
 regAggiornaBloccoEmail();
}

function regEmailInserita() {
 return String(document.getElementById("r-email")?.value || "").trim();
}

function regAggiornaBloccoEmail() {
 const email = regEmailInserita();
 const senzaChiocciola = !!email && email.indexOf("@") < 0;
 const hint = document.getElementById("r-email-format");
 if (hint) hint.classList.toggle("hidden", !senzaChiocciola);
 const ingresso = sessioneSenzaTavoli(regSessSelezionata);
 const next = document.getElementById("reg-s3-next");
 const gdt = document.getElementById("reg-gdt-submit");
 if (next) {
 if (ingresso) {
 next.disabled = false;
 next.title = "";
 } else {
 const ok = email.indexOf("@") >= 0;
 next.disabled = !ok;
 next.title = ok ? "" : "Inserisci un indirizzo email con @";
 }
 }
 if (gdt && ingresso) {
 const nomeOk = String(document.getElementById("r-nome")?.value || "").trim().length > 0;
 const emailOk = email.indexOf("@") >= 0;
 if (!regGdtCapienzaPronta || !nomeOk || !emailOk) {
 gdt.disabled = true;
 gdt.title = !regGdtCapienzaPronta
 ? "Attendi il caricamento dei posti"
 : (!nomeOk ? "Inserisci nome e cognome" : "Inserisci un indirizzo email con @");
 } else {
 gdt.disabled = false;
 gdt.title = "";
 }
 }
}

function renderRegRiepilogo() {
 const el = document.getElementById("reg-riepilogo");
 if (!el) return;
 const ev = regEvSelezionato;
 const sess = regSessSelezionata;
 const entries = Object.values(regTavoliSelezionati);
 const totP = entries.reduce((s,t) => s + t.num, 0);

 let tavoloHtml = regAttesaSelezionata
 ? `<div class="rrep-item"><div class="rrep-lbl">🎲 Tavolo</div><div class="rrep-val">⏳ Lista d'attesa</div></div>
 <div class="rrep-item"><div class="rrep-lbl">Persone</div><div class="rrep-val">${regAttesaNumPersone}</div></div>
 <div class="rrep-item"><div class="rrep-lbl">Fasce età</div><div class="rrep-val" style="font-size:12px;color:var(--smoke)">${labelsFasciaCsv(regAttesaFasciaEta) || "–"}</div></div>
 <div class="rrep-item"><div class="rrep-lbl">Tavoli preferiti</div><div class="rrep-val" style="font-size:12px;color:var(--smoke)">${(regAttesaPreferenze||[]).join(", ") || "–"}</div></div>`
 : entries.map(t => `
 <div class="rrep-item">
 <div class="rrep-lbl">🎲 Tavolo</div>
 <div class="rrep-val">${t.gioco} <span style="font-family:var(--font-m);font-size:11px;color:var(--ember)">×${t.num}</span></div>
 </div>
 ${t.sistemaGioco ? `<div class="rrep-item">
 <div class="rrep-lbl">Sistema di gioco</div>
 <div class="rrep-val">${escapeHtml(t.sistemaGioco)}</div>
 </div>` : ""}
 <div class="rrep-item">
 <div class="rrep-lbl">Fasce età</div>
 <div class="rrep-val" style="font-size:12px;color:var(--smoke)">${escapeHtml(labelsFasciaCsv(t.fasciaEta) || "–")}</div>
 </div>`).join('');

 el.innerHTML = `
 <div class="rrep-item">
 <div class="rrep-lbl">📜 Evento</div>
 <div class="rrep-val">${ev?.nome||"–"}</div>
 </div>
 ${sess?.nome ? `<div class="rrep-item">
 <div class="rrep-lbl">🧭 Sessione</div>
 <div class="rrep-val">${sess.nome}${sess.orario?" · "+sess.orario:""}</div>
 </div>` : ""}
 ${tavoloHtml}
 <div class="rrep-item">
 <div class="rrep-lbl">Prenotante</div>
 <div class="rrep-val">${regPrenotantePartecipa ? "Partecipa" : "Non partecipa (prenota per altri)"}</div>
 </div>
 ${!regAttesaSelezionata && totP > 0 ? `<div class="rrep-item">
 <div class="rrep-lbl">Totale persone</div>
 <div class="rrep-val" style="color:var(--ember)">${totP}</div>
 </div>` : ""}`;
}

// ── Navigazione indietro ────────────────────
function regTornaStep1() {
 logRegForm("indietro", "Torna a scelta evento (fase 1)");
 regSessSelezionata = null;
 regTavoliSelezionati = {};
 regAttesaSelezionata = false;
 regAttesaNumPersone = 1;
 regAttesaFasciaEta = "";
 regPartecipanti = [];
 regPrenotantePartecipa = true;
 regGdtNumPersone = 1;
 regGdtLiberi = 0;
 regGdtCapienzaPronta = false;
 regGdtFasciaEta = "";
 regEvSelezionato = null;
 regTipoMisto = "";
 hide("reg-misto-scelta");
 show("reg-s1-lista");
 show("reg-s3-dati");
 show("reg-s3-actions");
 const cambiaTipo = document.getElementById("reg-misto-cambia");
 if (cambiaTipo) cambiaTipo.classList.add("hidden");
 regApplyWizardModeForEvento(null, null);
 const ownerCb = document.getElementById("reg-owner-partecipa");
 if (ownerCb) ownerCb.checked = false;
 setRegStep(1);
 // Se prima avevi appena completato una prenotazione, la schermata "conferma" (reg-ok)
 // resta visibile finche non viene nascosta: qui resettiamo davvero lo stato.
 hide("reg-ok");
 regShowSuccessWarnings([]);
 hide("reg-recupera");
 show("reg-panel");
 show("reg-recupera-link");
 hide("reg-s2"); hide("reg-s3"); hide("reg-s4"); show("reg-s1");
}

function regTornaStep2() {
 logRegForm("indietro", "Torna ai dati (fase 2)");
 setRegStep(2);
 hide("reg-s2"); show("reg-s3");
 regPrecompilaDatiUtente();
}

function regTornaStep3() {
 logRegForm("indietro", "Torna ai tavoli (fase 3)");
 setRegStep(3);
 hide("reg-s4"); show("reg-s2");
}

function setRegStep(n) {
 [1,2,3,4].forEach(i => {
 const el = document.getElementById("rs-"+i);
 const ln = document.querySelectorAll(".rs-line")[i-1];
 if (!el) return;
 el.classList.remove("active","done");
 if (i < n) el.classList.add("done");
 if (i === n) el.classList.add("active");
 if (ln) { ln.classList.remove("done"); if (i < n) ln.classList.add("done"); }
 });
 const introEl = document.getElementById("reg-home-intro");
 if (introEl) introEl.classList.toggle("hidden", n !== 1);
 const recLinkEl = document.getElementById("reg-recupera-link");
 if (recLinkEl) recLinkEl.classList.toggle("hidden", n > 2);
}

// ── Submit ──────────────────────────────────
function inviaReg() {
 const nome = document.getElementById("r-nome").value.trim();
 const email = document.getElementById("r-email").value.trim();
 const cell = document.getElementById("r-cell").value.trim();
 const fonte = document.getElementById("r-fonte").value;
 const evId = regEvSelezionato?.eventId;
 const sessId= regSessSelezionata?.sessioneId || "";
 const entries = Object.values(regTavoliSelezionati);
 const ownerCb = document.getElementById("reg-owner-partecipa");
 regPrenotantePartecipa = !(ownerCb && ownerCb.checked);

 if (!nome) { logRegForm("invio_bloccato", "Nome mancante"); popupErrorePrenotazione("⚠️ Inserisci nome e cognome."); return; }
 if (!email||!email.includes("@")) { logRegForm("invio_bloccato", "Email non valida"); popupErrorePrenotazione("⚠️ Email non valida."); return; }
 if (!evId) { logRegForm("invio_bloccato", "Evento non selezionato"); popupErrorePrenotazione("⚠️ Nessun evento selezionato."); return; }
 if (!entries.length && !regAttesaSelezionata) { logRegForm("invio_bloccato", "Nessun tavolo selezionato"); popupErrorePrenotazione("⚠️ Seleziona almeno un tavolo."); return; }

 // Costruisci array prenotazioni con fasciaEta per-tavolo (lista d'attesa: num, fascia e preferenze richiesti)
 let prenotazioni;
 if (regAttesaSelezionata) {
 const sessNome = regSessSelezionata?.nome || sessId || "";
 if (!regAttesaFasciaEta || !regAttesaFasciaEta.trim()) {
 popupErrorePrenotazione("⚠️ Seleziona almeno una fascia età per la lista d'attesa."); return;
 }
 if (!regAttesaPreferenze || regAttesaPreferenze.length === 0) {
 popupErrorePrenotazione("⚠️ Seleziona almeno un tavolo preferito per la lista d'attesa."); return;
 }
 const prefStr = regAttesaPreferenze.join(", ");
 const baseTav = `Lista d'attesa – ${regEvSelezionato?.nome||evId} – ${sessNome}`;
 let tavoloVal = `${baseTav} | Pref: ${prefStr}`;
 const chkLast = document.getElementById("reg-attesa-last-chk");
 const inpLast = document.getElementById("reg-attesa-last-ore");
 if (chkLast?.checked) {
 const ore = Math.max(1, Math.min(24, parseInt(inpLast?.value || "6", 10) || 6));
 tavoloVal += ` | LastH: ${ore}`;
 }
 prenotazioni = [{ tavolo: tavoloVal, numPersone: regAttesaNumPersone, fasciaEta: regAttesaFasciaEta.trim() }];
 } else {
 // Ultima validazione fasce
 const richiedeFascia = (t) => {
 const tipo = String(t?.tipo || "").trim().toUpperCase();
 return !(tipo === "PANEL" || tipo === "GIOCO_LIBERO");
 };
 for (const t of entries) {
 if (richiedeFascia(t) && (!t.fasciaEta || !t.fasciaEta.trim())) {
 popupErrorePrenotazione(`⚠️ Seleziona almeno una fascia età per il tavolo "${t.gioco}".`);
 return;
 }
 }
 prenotazioni = entries.map(t => ({
 tavolo: `${t.id} – ${t.gioco}`,
 numPersone: t.num,
 fasciaEta: t.fasciaEta
 }));
 }

 document.getElementById("r-submit").disabled = true;
 hide("reg-recupera-link");
 setLdr("Invio prenotazione…"); hide("reg-panel"); show("loader");

 const detInvio = regAttesaSelezionata
 ? `Lista attesa · ${regAttesaNumPersone} pers.`
 : prenotazioni.map(p => p.tavolo).join(" | ");
 logRegForm("invio_avviato", detInvio, { eventId: evId, sessioneId: sessId, email, nome });

 const payloadReg = { nome, email, cellulare: cell, eventId: evId, sessioneId: sessId, fonte, prenotazioni, prenotantePartecipa: regPrenotantePartecipa };
 if (typeof UUID !== "undefined" && UUID && String(UUID).trim()) {
 payloadReg.uuid = String(UUID).trim();
 }
 if (PARTECIPANTI_MULTI_ENABLED) {
 const maxPartecipantiSlot = _maxAltriPartecipantiReg();
 const partecipantiRaw = regPartecipanti
 .slice(0, maxPartecipantiSlot)
 .map(p => ({
 nome: String(p?.nome || "").trim().replace(/\s+/g, " "),
 email: String(p?.email || "").trim().toLowerCase(),
 emailEnabled: !!p?.emailEnabled
 }));
 for (let i = 0; i < partecipantiRaw.length; i++) {
 const p = partecipantiRaw[i];
 if (!p.nome) {
 show("reg-panel"); hide("loader");
 popupErrorePrenotazione(`⚠️ Inserisci un nome o nickname per il partecipante #${i + 1}.`);
 document.getElementById("r-submit").disabled = false;
 return;
 }
 if (!etichettaPartecipanteRegOk(p.nome)) {
 show("reg-panel"); hide("loader");
 popupErrorePrenotazione(`⚠️ Nome o nickname non valido per il partecipante #${i + 1} (max 120 caratteri).`);
 document.getElementById("r-submit").disabled = false;
 return;
 }
 if ((p.emailEnabled || p.email) && !p.email.includes("@")) {
 show("reg-panel"); hide("loader");
 popupErrorePrenotazione(`⚠️ Inserisci un'email valida per il partecipante #${i + 1}.`);
 document.getElementById("r-submit").disabled = false;
 return;
 }
 }
 const partecipantiPuliti = partecipantiRaw
 .filter(p => p.nome)
 .map(p => ({ nome: p.nome, email: p.email && p.email.includes("@") ? p.email : "" }));
 if (!regPrenotantePartecipa && partecipantiPuliti.length === 0) {
 show("reg-panel"); hide("loader");
 popupErrorePrenotazione("⚠️ Hai indicato che non partecipi: inserisci almeno un partecipante (es. nome del figlio).");
 document.getElementById("r-submit").disabled = false;
 return;
 }
 if (partecipantiPuliti.length) payloadReg.partecipanti = partecipantiPuliti;
 }
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (res.ok) {
 logRegForm("invio_ok", res.messaggio || "Prenotazione registrata", { eventId: evId, sessioneId: sessId, email, nome });
 const warns = []
 .concat(Array.isArray(res?.warnings) ? res.warnings : [])
 .concat(res?.warning ? [res.warning] : [])
 .map(w => String(w || "").trim())
 .filter(Boolean);
 if (warns.length) logRegForm("invio_warning", warns.join(" · "), { eventId: evId, sessioneId: sessId, email, nome });
 regShowSuccessWarnings(warns);
 show("reg-recupera-link");
 show("reg-ok");
 if (warns.length) {
 showNotifyPopup("⚠️ " + warns.join(" "), "err");
 }
 }
 else {
 const errTxt = String(res?.errore || "");
 logRegForm("invio_errore", errTxt, { eventId: evId, sessioneId: sessId, email, nome });
 show("reg-panel");
 setRegStep(4);
 hide("reg-s1"); hide("reg-s2"); hide("reg-s3"); show("reg-s4");
 show("reg-recupera-link");
 const errNorm = errTxt.toLowerCase();
 if (errNorm.indexOf("hai gia giocato") >= 0 || errNorm.indexOf("hai già giocato") >= 0 || errNorm.indexOf("hai già una prenotazione attiva su questo tavolo") >= 0 || errNorm.indexOf("hai gia una prenotazione attiva su questo tavolo") >= 0) {
 popupErrorePrenotazione("⚠️ " + errTxt);
 if (errNorm.indexOf("prenotazione attiva su questo tavolo") >= 0) {
 regShowDuplicatoTavoloWarning(errTxt);
 } else {
 regShowAvventuraWarning(errTxt);
 }
 } else {
 flash("reg-fa","⚠️ "+errTxt,"err");
 }
 document.getElementById("r-submit").disabled = false;
 }
 })
 .withFailureHandler(err => {
 logRegForm("invio_errore_rete", err.message || String(err), { eventId: evId, sessioneId: sessId, email, nome });
 hide("loader"); show("reg-panel");
 setRegStep(4);
 hide("reg-s1"); hide("reg-s2"); hide("reg-s3"); show("reg-s4");
 show("reg-recupera-link");
 segnalaErroreOrgClient("registraPrenotazioneMulti (connessione)", payloadReg, "Invio prenotazione fallito: connessione/eccezione (richiesta potrebbe non essere arrivata al server).", err.message || String(err));
 flash("reg-fa","Invio prenotazione fallito. Riprova o contattaci se il problema persiste.","err");
 document.getElementById("r-submit").disabled = false;
 })
 .registraPrenotazioneMulti(payloadReg);
}

function regToggleAttesa() {
 regAttesaSelezionata = !regAttesaSelezionata;
 logRegForm(regAttesaSelezionata ? "lista_attesa_on" : "lista_attesa_off", regAttesaSelezionata ? "Iscrizione lista attesa" : "Annullata lista attesa");
 const el = document.getElementById("rtc-attesa");
 const datiEl = document.getElementById("reg-attesa-dati");
 if (regAttesaSelezionata) {
 regTavoliSelezionati = {};
 regAttesaNumPersone = 1;
 regAttesaFasciaEta = "";
 document.getElementById("reg-attesa-num-val").textContent = "1";
 document.querySelectorAll(".reg-tav-card").forEach(c => {
 c.classList.remove("selected");
 c.querySelectorAll(".rtc-qty-wrap").forEach(q => q.classList.add("hidden"));
 c.querySelectorAll(".tav-fasce-inline").forEach(f => f.classList.add("hidden"));
 });
 el?.classList.add("selected");
 datiEl?.classList.remove("hidden");
 const chipsContainer = document.getElementById("reg-attesa-fasce-chips");
 refreshRegAttesaFasceChips();
 if (!window._regAttesaFasceWired && chipsContainer) {
 window._regAttesaFasceWired = true;
 chipsContainer.addEventListener("click", function() {
 regAttesaFasciaEta = getFasce(chipsContainer);
 logRegForm("attesa_fascia", labelsFasciaCsv(regAttesaFasciaEta) || regAttesaFasciaEta);
 document.getElementById("reg-attesa-fasce-req")?.classList.toggle("visible", !regAttesaFasciaEta.trim());
 aggiornaRegSummary();
 });
 }
 } else {
 el?.classList.remove("selected");
 datiEl?.classList.add("hidden");
 }
 aggiornaRegSummary();
}

function regAttesaCambiaQty(delta) {
 if (!regAttesaSelezionata) return;
 const nuova = Math.max(1, Math.min(10, regAttesaNumPersone + delta));
 regAttesaNumPersone = nuova;
 const vEl = document.getElementById("reg-attesa-num-val");
 if (vEl) vEl.textContent = nuova;
 logRegForm("attesa_posti", `${nuova} persone`);
 aggiornaRegSummary();
}

function mostraRecupera(e) { e.preventDefault(); hide("reg-panel"); show("reg-recupera"); }

function cambioEventoReg(){}
function cambioSessioneReg(){}
function caricaTavoliReg(){}

function inviaRecupera() {
 const email = document.getElementById("rec-email").value.trim();
 if (!email||!email.includes("@")) { flash("reg-fa","⚠️ Email non valida.","err"); return; }
 setLdr("Invio email…"); hide("reg-recupera"); show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader"); show("reg-recupera");
 if (res.ok) {
 flash("reg-fa", "📧 " + res.messaggio + " Controlla l'email e clicca sul link per accedere alle tue prenotazioni.", "ok");
 } else {
 flash("reg-fa", "⚠️ " + res.errore, "err");
 }
 })
 .withFailureHandler(err => {
 hide("loader"); show("reg-recupera");
 flash("reg-fa","Invio prenotazione fallito. Riprova o contattaci se il problema persiste.","err");
 })
 .recuperaLinkPrenotazione(email);
}

// ═══════════════════════════════════════════
// GESTIONE UTENTE (UUID)
// ═══════════════════════════════════════════
function renderUtente(r) {
 hide("loader");
 if (!r || typeof r !== "object") {
 console.error("[renderUtente] risposta non valida:", r);
 mostraFallbackCaricamentoUtente("Errore di caricamento dati utente. Riprova tra pochi secondi.");
 return;
 }
 if (!r.ok) {
 console.error("[renderUtente] risposta ok=false:", r);
 mostraFallbackCaricamentoUtente(r.errore || "Errore durante il caricamento.");
 return;
 }
 if (Array.isArray(r.fasceEta)) {
 applyFasceEtaConfig(r.fasceEta);
 }
 console.log("[renderUtente] ok, prenotazioni:", (r.prenotazioni || []).length, "timeline:", (r.timeline || []).length);
 const prenotazioniAttive = (r.prenotazioni || []).filter(p => !isDataPassata(p.eventData));
 const prenotazioniPassate = (r.prenotazioni || []).filter(p => isDataPassata(p.eventData));
 datiUtente = {
 persona: r.persona,
 prenotazioni: r.prenotazioni,
 prenotazioniAttive: prenotazioniAttive,
 prenotazioniPassate: prenotazioniPassate,
 sessioniAggiungibili: r.sessioniAggiungibili || {},
 preferenzeEmail: r.preferenzeEmail || { optOutNewEvent: false },
 timeline: r.timeline || [],
 amicizie: r.amicizie || []
 };
 show("user-main");

 // Imposta UI opt-out e gestisci eventuale disiscrizione automatica da URL
 const chkOptOut = document.getElementById("u-optout-new-event");
 if (chkOptOut) chkOptOut.checked = !!datiUtente.preferenzeEmail?.optOutNewEvent;
 gestisciOptOutDaUrl();

 const nomeParts = (r.persona.nome||"Partecipante");
 document.getElementById("u-nome").textContent = nomeParts;
 document.getElementById("u-email").textContent = r.persona.email||"–";
 document.getElementById("u-cell").textContent = r.persona.cellulare||"–";
 document.getElementById("h-title").textContent = "👋 Ciao, " + nomeParts.split(" ")[0] + "!";

 const nav = document.getElementById("u-ev-nav");
 if (nav) nav.innerHTML = "";

 const nPren = prenotazioniAttive.length;
 const introEl = document.getElementById("user-intro");
 if (introEl) {
 introEl.classList.remove("hidden");
 }
 const secTitle = document.getElementById("u-sec-title");
 if (secTitle) {
 secTitle.textContent = nPren === 0 ? "📅 Le tue prenotazioni" : "📅 Le tue prenotazioni (" + nPren + (nPren === 1 ? " attiva)" : " attive)");
 }
 renderListaPren(prenotazioniAttive, null, datiUtente.sessioniAggiungibili);
 renderStoricoPartecipazioni(prenotazioniPassate, r.timeline || []);
 renderAmicizieUtente();

 if (r.nomeUnificazioneRichiesta && Array.isArray(r.nomeUnificazioneRichiesta.nomi) && r.nomeUnificazioneRichiesta.nomi.length > 1) {
 mostraUnificaNomeOverlay(r.nomeUnificazioneRichiesta);
 }
}

function _normNomeUnificaFront(s) {
 return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function mostraUnificaNomeOverlay(req) {
 const nomi = req.nomi || [];
 const def = String(req.defaultNome || nomi[0] || "");
 window._nomeUnificaLista = nomi.slice();
 const list = document.getElementById("nome-unifica-list");
 const flash = document.getElementById("nome-unifica-flash");
 if (flash) {
 flash.classList.add("hidden");
 flash.textContent = "";
 }
 if (!list) return;
 list.innerHTML = nomi.map((nome, i) => {
 const checked = _normNomeUnificaFront(nome) === _normNomeUnificaFront(def) ? " checked" : "";
 return `<label class="nome-unifica-opt" style="display:flex;align-items:flex-start;gap:10px;margin:10px 0;cursor:pointer;font-size:14px;color:var(--smoke)">
 <input type="radio" name="nome-unifica-choice" value="${i}"${checked} style="margin-top:3px" />
 <span>${escapeHtml(nome)}</span>
 </label>`;
 }).join("");
 show("nome-unifica-overlay");
}

function confermaUnificaNomeUtente() {
 if (typeof UUID === "undefined" || !UUID) return;
 const lista = window._nomeUnificaLista || [];
 const sel = document.querySelector('input[name="nome-unifica-choice"]:checked');
 const flash = document.getElementById("nome-unifica-flash");
 const idx = sel ? parseInt(sel.value, 10) : NaN;
 const nome = lista[idx];
 if (!nome || String(nome).trim() === "") {
 if (flash) {
 flash.classList.remove("hidden");
 flash.style.color = "var(--danger, #c62828)";
 flash.textContent = "Seleziona una delle opzioni.";
 }
 return;
 }
 const btn = document.getElementById("nome-unifica-btn");
 if (btn) btn.disabled = true;
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 if (flash) {
 flash.classList.remove("hidden");
 flash.textContent = "Salvataggio non disponibile in questo ambiente.";
 }
 if (btn) btn.disabled = false;
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 hide("nome-unifica-overlay");
 window._nomeUnificaLista = null;
 if (res && res.ok) {
 flash("user-fa", "Nome aggiornato ovunque.", "ok");
 caricaUtente();
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Impossibile aggiornare il nome."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 flash("user-fa", "❌ " + (err.message || err), "err");
 })
 .consolidaNomeUtente(UUID, nome);
}

let _optOutUrlHandled = false;

function aggiornaOptOutCheckboxUI(val) {
 const chk = document.getElementById("u-optout-new-event");
 if (chk) chk.checked = !!val;
}

function salvaPreferenzeEmail() {
 if (typeof UUID === "undefined" || !UUID) return;
 const chk = document.getElementById("u-optout-new-event");
 const optOutNewEvent = !!chk?.checked;

 beginActionOverlay("Salvataggio preferenze…");
 if (chk) chk.disabled = true;

 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (chk) chk.disabled = false;
 if (res && res.ok) {
 if (datiUtente) datiUtente.preferenzeEmail = res.preferenzeEmail || { optOutNewEvent };
 aggiornaOptOutCheckboxUI(optOutNewEvent);
 flash("user-fa", "✅ Preferenze email aggiornate.", "ok");
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore durante il salvataggio delle preferenze."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (chk) chk.disabled = false;
 flash("user-fa", "❌ Errore: " + (err.message || err), "err");
 })
 .setPreferenzeEmail(UUID, { optOutNewEvent });
}

function gestisciOptOutDaUrl() {
 if (_optOutUrlHandled) return;
 if (typeof UUID === "undefined" || !UUID) return;
 const params = new URLSearchParams(window.location.search);
 const opt = params.get("optout");
 if (opt !== "new_event") return;

 _optOutUrlHandled = true;

 const chk = document.getElementById("u-optout-new-event");
 if (chk) chk.disabled = true;

 beginActionOverlay("Aggiornamento preferenze…");

 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (chk) chk.disabled = false;

 if (res && res.ok) {
 if (datiUtente) datiUtente.preferenzeEmail = res.preferenzeEmail || { optOutNewEvent: true };
 aggiornaOptOutCheckboxUI(true);
 flash("user-fa", "✅ Disiscrizione effettuata: non riceverai notifiche su nuovi eventi.", "ok");
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Impossibile applicare la disiscrizione."), "err");
 }

 // Rimuovi il parametro dalla URL per evitare richieste duplicate al refresh
 try {
 const url = new URL(window.location.href);
 url.searchParams.delete("optout");
 window.history.replaceState({}, "", url.toString());
 } catch (e) {}
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (chk) chk.disabled = false;
 flash("user-fa", "❌ Errore: " + (err.message || err), "err");

 // Anche in caso di errore, prova a rimuovere il parametro (se possibile)
 try {
 const url = new URL(window.location.href);
 url.searchParams.delete("optout");
 window.history.replaceState({}, "", url.toString());
 } catch (e) {}
 })
 .setPreferenzeEmail(UUID, { optOutNewEvent: true });
}

function apriPreferenzeEmail() {
 const wrap = document.getElementById("u-email-prefs-card-wrap");
 if (!wrap) return;

 const isHidden = wrap.classList.contains("hidden");
 if (isHidden) {
 // Se l'utente sta modificando i dati, chiudiamo il form per evitare sovrapposizioni UX
 const form = document.getElementById("u-edit-form");
 const isFormOpen = form && !form.classList.contains("hidden");
 if (isFormOpen && typeof chiudiModificaDatiUtente === "function") {
 chiudiModificaDatiUtente();
 }
 wrap.classList.remove("hidden");
 const chk = document.getElementById("u-optout-new-event");
 setTimeout(() => chk?.focus?.(), 50);
 } else {
 wrap.classList.add("hidden");
 }
}

function apriModificaDatiUtente() {
 if (!datiUtente || !datiUtente.persona) return;
 const form = document.getElementById("u-edit-form");
 const actions = document.getElementById("u-edit-actions");
 if (!form) return;
 const inpNome = document.getElementById("u-edit-nome");
 const inpCell = document.getElementById("u-edit-cell");
 if (inpNome) inpNome.value = datiUtente.persona.nome || "";
 if (inpCell) inpCell.value = datiUtente.persona.cellulare || "";
 form.classList.remove("hidden");
 if (actions) actions.classList.add("hidden");
}

function chiudiModificaDatiUtente() {
 const form = document.getElementById("u-edit-form");
 const actions = document.getElementById("u-edit-actions");
 if (form) form.classList.add("hidden");
 if (actions) actions.classList.remove("hidden");
}

function salvaDatiUtente() {
 if (typeof UUID === "undefined" || !UUID) return;
 const inpNome = document.getElementById("u-edit-nome");
 const inpCell = document.getElementById("u-edit-cell");
 const nome = (inpNome?.value || "").trim();
 const cellulare = (inpCell?.value || "").trim();
 if (!nome) {
 flash("user-fa","Il nome è obbligatorio.","err");
 return;
 }
 beginActionOverlay("Salvataggio dati…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 const persona = res.persona || {};
 if (!datiUtente) datiUtente = {};
 datiUtente.persona = {
 nome: persona.nome || nome,
 email: persona.email || (datiUtente.persona?.email || ""),
 cellulare: persona.cellulare || cellulare
 };
 document.getElementById("u-nome").textContent = datiUtente.persona.nome || "Partecipante";
 document.getElementById("u-cell").textContent = datiUtente.persona.cellulare || "–";
 document.getElementById("h-title").textContent = "👋 Ciao, " + (datiUtente.persona.nome || "Partecipante").split(" ")[0] + "!";
 chiudiModificaDatiUtente();
 flash("user-fa","Dati aggiornati.","ok");
 } else {
 flash("user-fa","⚠️ " + (res?.errore || "Errore durante il salvataggio dei dati."),"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("user-fa","❌ Errore: " + (err.message || err),"err");
 })
 .aggiornaDatiPersona(UUID, { nome, cellulare });
}

function switchUserTab(panelId, btn) {
 document.querySelectorAll(".u-main-tab").forEach(b => {
 b.classList.remove("active");
 b.setAttribute("aria-selected", "false");
 });
 document.querySelectorAll(".u-panel").forEach(p => p.classList.add("hidden"));
 if (btn) {
 btn.classList.add("active");
 btn.setAttribute("aria-selected", "true");
 }
 const panel = document.getElementById(panelId);
 if (panel) panel.classList.remove("hidden");
 if (panelId === "u-storico-panel") {
 applyStoricoStatsLayout();
 setTimeout(applyStoricoStatsLayout, 0);
 } else if (panelId === "u-friends-panel") {
 renderAmicizieUtente();
 }
}

function renderAmicizieUtente() {
 const wrap = document.getElementById("u-friends-list");
 if (!wrap) return;
 const amici = Array.isArray(datiUtente?.amicizie) ? datiUtente.amicizie : [];
 if (!amici.length) {
 wrap.innerHTML = `<div style="font-size:13px;color:var(--ash);font-style:italic">Nessuna amicizia salvata. Aggiungi amici per inserirli velocemente come co-prenotanti.</div>`;
 return;
 }
 wrap.innerHTML = amici.map(a => {
 const fid = String(a.friendId || "").replace(/'/g, "\\'");
 const payload = JSON.stringify(a || {}).replace(/'/g, "&#39;");
 return `<div style="padding:9px 0;border-top:1px dashed var(--vellum);display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
 <div>
 <strong>${escapeHtml(a.nome || "—")}</strong><br>
 <span style="font-size:12px;color:var(--ash)">${escapeHtml(a.email || "—")} ${a.cellulare ? " · " + escapeHtml(a.cellulare) : ""}</span>
 </div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
 <button type="button" class="btn btn-o btn-sm" onclick='apriFormAmicizia(${payload})'>Modifica</button>
 <button type="button" class="btn btn-d btn-sm" onclick="eliminaAmiciziaUtente('${fid}')">Elimina</button>
 </div>
 </div>`;
 }).join("");
}

function apriFormAmicizia(amico) {
 const form = document.getElementById("u-friend-form");
 if (!form) return;
 form.classList.remove("hidden");
 document.getElementById("u-friend-id").value = amico?.friendId || "";
 document.getElementById("u-friend-nome").value = amico?.nome || "";
 document.getElementById("u-friend-email").value = amico?.email || "";
 document.getElementById("u-friend-cell").value = amico?.cellulare || "";
 document.getElementById("u-friend-note").value = amico?.note || "";
}

function chiudiFormAmicizia() {
 const form = document.getElementById("u-friend-form");
 if (!form) return;
 form.classList.add("hidden");
}

function salvaAmiciziaUtente() {
 const payload = {
 friendId: (document.getElementById("u-friend-id")?.value || "").trim(),
 nome: (document.getElementById("u-friend-nome")?.value || "").trim(),
 email: (document.getElementById("u-friend-email")?.value || "").trim(),
 cellulare: (document.getElementById("u-friend-cell")?.value || "").trim(),
 note: (document.getElementById("u-friend-note")?.value || "").trim()
 };
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore salvataggio amicizia."), "err");
 return;
 }
 caricaUtente();
 flash("user-fa", "✅ Amicizia salvata.", "ok");
 chiudiFormAmicizia();
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .salvaAmiciziaUtente(UUID, payload);
}

function eliminaAmiciziaUtente(friendId) {
 chiediConferma("Eliminare questa amicizia?", () => {
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore eliminazione amicizia."), "err");
 return;
 }
 caricaUtente();
 flash("user-fa", "✅ Amicizia eliminata.", "ok");
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .eliminaAmiciziaUtente(UUID, friendId);
 });
}

function _haNomeECognomeUtente(s) {
 const parts = String(s || "").trim().split(/\s+/).filter(Boolean);
 return parts.length >= 2;
}

function _etichettaPartecipanteOk(s) {
 const t = String(s || "").trim();
 return t.length > 0 && t.length <= 120;
}

/** Vista organizzatore: nome anagrafico + etichetta se diversi. */
function _formatPartecipanteOrgDisplay(x) {
 const nick = String(x?.nome || "").trim();
 const nc = String(x?.nomeCompleto || "").trim();
 if (nc && nick && nc.replace(/\s+/g, " ").toLowerCase() !== nick.replace(/\s+/g, " ").toLowerCase()) {
 return nc + " · " + nick;
 }
 if (nc) return nc;
 return nick || "—";
}

function _trovaPrenotazioneUtenteByBookingId(bookingId) {
 const id = String(bookingId || "").trim();
 if (!id || !datiUtente) return null;
 const all = []
 .concat(datiUtente.prenotazioniAttive || [])
 .concat(datiUtente.prenotazioniPassate || [])
 .concat(datiUtente.prenotazioni || []);
 return all.find(p => String(p.bookingId || "").trim() === id) || null;
}

function _jsArg(v) {
 return JSON.stringify(v == null ? "" : String(v));
}

function _labelPrenotazionePerId(p, bookingId) {
 if (p) {
 if (p.isListaAttesa) return "lista d'attesa";
 const idT = String(p.idTavoloAttuale || "").trim();
 const nome = p.tavolo?.includes(" – ")
 ? p.tavolo.split(" – ").slice(1).join(" – ")
 : (p.tavolo || "");
 return idT ? `${nome} (${idT})` : (nome || bookingId);
 }
 return String(bookingId || "").trim() || "prenotazione";
}

function _partKeyPartecipante(nome, email) {
 const em = String(email || "").trim().toLowerCase();
 const nm = String(nome || "").trim().toLowerCase();
 return em && em.indexOf("@") > 0 ? ("e:" + em) : ("n:" + nm);
}

function _ownerPartecipaBooking(p) {
 if (typeof p?.prenotantePartecipa === "boolean") return p.prenotantePartecipa;
 return true;
}

function _maxPartecipantiBooking(p, prenotantePartecipaOpt) {
 const numP = Math.max(1, parseInt(p?.numPersone, 10) || 1);
 const ownerPart = (typeof prenotantePartecipaOpt === "boolean")
 ? prenotantePartecipaOpt
 : _ownerPartecipaBooking(p);
 return Math.max(0, numP - (ownerPart ? 1 : 0));
}

function _partecipantiAttiviBooking(p) {
 return (Array.isArray(p?.partecipanti) ? p.partecipanti : []).filter(x => {
 const st = String(x?.statoInvito || "").toLowerCase();
 return st !== "revoked" && st !== "declined";
 });
}

function refreshPartecipantiAddForm(bookingId) {
 const p = _trovaPrenotazioneUtenteByBookingId(bookingId);
 const wrap = document.getElementById("part-add-fields-" + bookingId);
 if (!wrap) return;
 const maxInvite = _maxPartecipantiBooking(p);
 const partecipanti = Array.isArray(p?.partecipanti) ? p.partecipanti : [];
 const full = partecipanti.length >= maxInvite;
 wrap.querySelectorAll("input").forEach(inp => { inp.disabled = !!full; });
 const btnAdd = document.getElementById("part-btn-add-" + bookingId);
 if (btnAdd) btnAdd.disabled = !!full;
 const tgl = document.getElementById("part-email-toggle-" + bookingId);
 if (tgl) tgl.disabled = !!full;
}

function toggleEmailPartecipanteBooking(bookingId) {
 window.partFormEmailEnabled = window.partFormEmailEnabled || {};
 const bid = String(bookingId || "").trim();
 const cur = partFormEmailEnabled[bid] === true;
 partFormEmailEnabled[bid] = !cur;
 const on = partFormEmailEnabled[bid] === true;
 const wrap = document.getElementById("part-email-wrap-" + bid);
 const em = document.getElementById("part-email-" + bid);
 const btn = document.getElementById("part-email-toggle-" + bid);
 if (!on && em) em.value = "";
 if (wrap) wrap.classList.toggle("hidden", !on);
 if (btn) {
 btn.textContent = on ? "✉️" : "➕✉️";
 btn.title = on ? "Nascondi email" : "Aggiungi email per invito";
 }
}

function aggiungiPartecipanteBooking(bookingId) {
 const nomeEl = document.getElementById("part-nome-" + bookingId);
 const emailEl = document.getElementById("part-email-" + bookingId);
 const nome = (nomeEl && nomeEl.value || "").trim();
 const bid = String(bookingId || "").trim();
 window.partFormEmailEnabled = window.partFormEmailEnabled || {};
 const emailOn = !!partFormEmailEnabled[bid];
 const email = emailOn ? ((emailEl && emailEl.value) || "").trim().toLowerCase() : "";
 const p = _trovaPrenotazioneUtenteByBookingId(bookingId);
 if (!p) {
 flash("user-fa", "Ricarica la pagina e riprova.", "err");
 return;
 }
 if (!_etichettaPartecipanteOk(nome)) {
 flash("user-fa", "Inserisci un nome o nickname per il partecipante (max 120 caratteri).", "err");
 return;
 }
 if (emailOn && email && email.indexOf("@") <= 0) {
 flash("user-fa", "Email non valida.", "err");
 return;
 }
 const partecipanti = _partecipantiAttiviBooking(p);
 const maxInvite = _maxPartecipantiBooking(p);
 if (partecipanti.length >= maxInvite) {
 flash("user-fa", "Hai raggiunto il numero massimo di partecipanti extra per questa prenotazione.", "err");
 return;
 }
 const kNew = _partKeyPartecipante(nome, email);
 for (let i = 0; i < partecipanti.length; i++) {
 const x = partecipanti[i];
 if (_partKeyPartecipante(x.nome, x.email) === kNew) {
 flash("user-fa", "Questa persona è già nell'elenco.", "err");
 return;
 }
 }
 const list = partecipanti.map(x => ({
 nome: String(x.nome || "").trim(),
 email: String(x.email || "").trim().toLowerCase()
 }));
 list.push({ nome, email: email || "" });
 persistPartecipantiLista(bookingId, list, () => {
 if (nomeEl) nomeEl.value = "";
 if (emailEl) emailEl.value = "";
 });
}

function aggiungiAmicoACampoPartecipanti(bookingId) {
 const sel = document.getElementById("part-friend-" + bookingId);
 const nomeEl = document.getElementById("part-nome-" + bookingId);
 const emailEl = document.getElementById("part-email-" + bookingId);
 if (!sel || !sel.value) return;
 const amici = Array.isArray(datiUtente?.amicizie) ? datiUtente.amicizie : [];
 const amico = amici.find(a => String(a.friendId || "") === String(sel.value || ""));
 if (!amico) return;
 if (nomeEl) nomeEl.value = String(amico.nome || "").trim();
 const em = String(amico.email || "").trim();
 window.partFormEmailEnabled = window.partFormEmailEnabled || {};
 const bid = String(bookingId || "").trim();
 if (em && em.indexOf("@") > 0) {
 partFormEmailEnabled[bid] = true;
 const wrap = document.getElementById("part-email-wrap-" + bid);
 if (wrap) wrap.classList.remove("hidden");
 const btn = document.getElementById("part-email-toggle-" + bid);
 if (btn) { btn.textContent = "✉️"; btn.title = "Nascondi email"; }
 if (emailEl) emailEl.value = em;
 } else {
 partFormEmailEnabled[bid] = false;
 const wrap = document.getElementById("part-email-wrap-" + bid);
 if (wrap) wrap.classList.add("hidden");
 const btn = document.getElementById("part-email-toggle-" + bid);
 if (btn) { btn.textContent = "➕✉️"; btn.title = "Aggiungi email per invito"; }
 if (emailEl) emailEl.value = "";
 }
 sel.value = "";
}

function rimuoviMeDaBooking(bookingId) {
 chiediConferma("Vuoi rimuoverti da questa prenotazione?", () => {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 flash("user-fa", "✅ Sei stato rimosso dalla prenotazione.", "ok");
 caricaUtente();
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore durante la rimozione."), "err");
 }
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .rimuoviMeDaPrenotazione(UUID, bookingId);
 });
}

function applyStoricoStatsLayout() {
 const statsEl = document.getElementById("u-storico-stats");
 if (!statsEl) return;
 const cards = statsEl.querySelectorAll(".u-storico-stat");
 const vvW = (window.visualViewport && window.visualViewport.width) ? window.visualViewport.width : 0;
 const w = vvW || window.innerWidth || document.documentElement.clientWidth || 0;
 const sw = (window.screen && window.screen.width) ? window.screen.width : w;
 const sh = (window.screen && window.screen.height) ? window.screen.height : w;
 const shortEdge = Math.min(sw, sh);
 const hasMatchMedia = typeof window.matchMedia === "function";
 const isCoarse = hasMatchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
 const noHover = hasMatchMedia ? window.matchMedia("(hover: none)").matches : false;
 const isNarrowViewport = hasMatchMedia ? window.matchMedia("(max-width: 1024px)").matches : (w <= 1024);
 const ua = navigator.userAgent || "";
 const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
 const hasTouchPoints = (navigator.maxTouchPoints || 0) > 0;
 const isPhoneLike = shortEdge <= 1200;
 const isMobileLike = isMobileUa || isCoarse || (noHover && isNarrowViewport) || (isPhoneLike && hasTouchPoints);
 const setCardsWidth = (widthValue) => {
 cards.forEach(card => {
 card.style.setProperty("width", widthValue, "important");
 card.style.setProperty("flex", `0 0 ${widthValue}`, "important");
 card.style.setProperty("max-width", widthValue, "important");
 card.style.setProperty("box-sizing", "border-box", "important");
 card.style.setProperty("min-width", "0", "important");
 });
 };
 // 1 colonna solo su schermi davvero stretti
 if (w <= 320) {
 statsEl.style.setProperty("display", "flex", "important");
 statsEl.style.setProperty("flex-wrap", "wrap", "important");
 statsEl.style.setProperty("gap", "10px", "important");
 statsEl.style.setProperty("grid-template-columns", "none", "important");
 setCardsWidth("100%");
 return;
 }
 // Su device mobile-like forziamo sempre la griglia 2 colonne
 // anche quando il browser usa viewport "desktop" (es. ~980px).
 if (isMobileLike || w <= 640) {
 statsEl.style.setProperty("display", "flex", "important");
 statsEl.style.setProperty("flex-wrap", "wrap", "important");
 statsEl.style.setProperty("gap", "10px", "important");
 statsEl.style.setProperty("grid-template-columns", "none", "important");
 setCardsWidth("calc(50% - 5px)");
 return;
 }
 // Desktop: torna al layout grid standard.
 cards.forEach(card => {
 card.style.removeProperty("width");
 card.style.removeProperty("flex");
 card.style.removeProperty("max-width");
 card.style.removeProperty("box-sizing");
 card.style.removeProperty("min-width");
 });
 statsEl.style.removeProperty("display");
 statsEl.style.removeProperty("flex-wrap");
 statsEl.style.setProperty("display", "grid");
 statsEl.style.setProperty("grid-template-columns", "repeat(auto-fill, minmax(160px, 1fr))");
 statsEl.style.setProperty("gap", "14px");
}

function renderStoricoPartecipazioni(prenotazioniPassate, timeline) {
 const statsEl = document.getElementById("u-storico-stats");
 const listaEl = document.getElementById("u-storico-lista");
 const timelineEl = document.getElementById("u-storico-timeline");
 if (!statsEl || !listaEl) return;
 const prenPass = prenotazioniPassate || [];
 const tl = Array.isArray(timeline) ? timeline : [];

 const showEmpty = () => {
 statsEl.innerHTML = "";
 listaEl.innerHTML = '<div class="empty-state"><span class="empty-icon">📜</span><p>Nessuna partecipazione passata.</p></div>';
 listaEl.style.display = "";
 if (timelineEl) timelineEl.classList.add("hidden");
 };

 if (!prenPass.length && !tl.length) {
 showEmpty();
 return;
 }

 // Statistiche: separa davvero confermate vs lista d'attesa
 const isWaitlist = (p) => {
 if (!p) return false;
 if (p.isListaAttesa) return true;
 return String(p.tavolo || "").includes("Lista d'attesa");
 };
 const prenConfermate = prenPass.filter(p => !isWaitlist(p));
 const prenInAttesa = prenPass.filter(p => isWaitlist(p));
 const nEventi = prenConfermate.length ? new Set(prenConfermate.map(p => p.eventId)).size : 0;
 const nPersone = prenConfermate.length ? prenConfermate.reduce((s, p) => s + parseInt(p.numPersone || 1, 10), 0) : 0;
 const nVolteInAttesa = prenInAttesa.length;
 const nPrenTotali = prenPass.length;
 const nCancellate = tl.filter(x => String(x?.tipo || "") === "cancellazione").length;

 const fmt2 = (txt) => {
 const s = String(txt || "").trim();
 if (!s) return "";
 const parts = s.split(/\s+/g).filter(Boolean);
 if (parts.length <= 1) return s;
 // Seconda riga = ultima parola, prima riga = resto
 return parts.slice(0, -1).join(" ") + "<br>" + parts[parts.length - 1];
 };
 statsEl.innerHTML = `
 <div class="u-storico-stat"><div class="u-storico-stat-n">${nPrenTotali}</div><div class="u-storico-stat-l">${fmt2("Prenotazioni totali")}</div></div>
 <div class="u-storico-stat"><div class="u-storico-stat-n">${nEventi}</div><div class="u-storico-stat-l">${fmt2("Eventi partecipati")}</div></div>
 <div class="u-storico-stat"><div class="u-storico-stat-n">${nVolteInAttesa}</div><div class="u-storico-stat-l">${fmt2("Volte in lista d'attesa")}</div></div>
 <div class="u-storico-stat"><div class="u-storico-stat-n">${nCancellate}</div><div class="u-storico-stat-l">${fmt2("Prenotazioni cancellate")}</div></div>
 `;
 applyStoricoStatsLayout();
 setTimeout(applyStoricoStatsLayout, 0);

 const hideList = () => {
 listaEl.style.display = "none";
 };
 const showTimeline = () => {
 if (!timelineEl) return;
 timelineEl.classList.remove("hidden");
 };
 const hideTimeline = () => {
 if (!timelineEl) return;
 timelineEl.classList.add("hidden");
 };

 if (tl.length) {
 showTimeline();
 hideList();

 const eventIdsPass = new Set((prenPass || []).map(p => p.eventId).filter(Boolean));
 const tlFiltered = (Array.isArray(tl) ? tl : []).filter(ev => {
 if (eventIdsPass.size && ev && ev.eventId && !eventIdsPass.has(ev.eventId)) return false;
 return true;
 });

 const tavoloUi = (t) => {
 const v = String(t || "");
 if (!v) return "—";
 const main = v.split("|")[0].trim();
 return main || "—";
 };

 const calForTl = (ev) => {
 if (!ev) return "";
 if (!ev.eventDataIso || !ev.sessioneOrario) return "";
 const titolo = `${ev.eventNome || ev.eventId || "Evento"}${ev.sessioneNome ? " - " + ev.sessioneNome : ""}`;
 const dettagli = ev.dettaglio || "";
 return _buildGoogleCalendarUrl(titolo, dettagli, ev.luogo || "", ev.eventDataIso, ev.sessioneOrario, 120);
 };

 const orderFiltered = [...tlFiltered].sort((a, b) => {
 const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
 const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
 return ta - tb;
 });

 if (!orderFiltered.length) {
 if (timelineEl) {
 timelineEl.innerHTML = `
 <div class="empty-state" style="padding:16px 8px">
 <span class="empty-icon">🧾</span>
 <p style="margin:0;font-size:13.5px;color:var(--ash);font-style:italic">Nessuna azione timeline da mostrare.</p>
 </div>`;
 }
 // Manteniamo la lista “storico” nascosta: la timeline è la UI principale.
 hideList();
 return;
 }

 const recent = orderFiltered.slice(-80);
 const toMs = (ts) => {
 if (ts instanceof Date) return ts.getTime();
 const d = new Date(ts);
 return isNaN(d.getTime()) ? 0 : d.getTime();
 };

 const groupsByKey = {};
 recent.forEach(ev => {
 const key = `${ev.eventId || ""}__${_normSessJS(ev.sessioneId || "")}`;
 if (!groupsByKey[key]) {
 groupsByKey[key] = {
 key,
 eventId: ev.eventId || "",
 sessioneId: ev.sessioneId || "",
 eventNome: ev.eventNome || ev.eventId || "Evento",
 sessioneNome: ev.sessioneNome || ev.sessioneId || "",
 eventDataIso: ev.eventDataIso || "",
 sessioneOrario: ev.sessioneOrario || "",
 luogo: ev.luogo || "",
 latestTs: toMs(ev.timestamp),
 items: []
 };
 }
 groupsByKey[key].items.push(ev);
 groupsByKey[key].latestTs = Math.max(groupsByKey[key].latestTs, toMs(ev.timestamp));
 });

 const groups = Object.values(groupsByKey)
 .sort((a, b) => b.latestTs - a.latestTs)
 .map(g => ({
 ...g,
 items: g.items.sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp))
 }));

 timelineEl.innerHTML = groups
 .map((g, gi) => {
 const gEventName = escapeHtml(g.eventNome || g.eventId || "Evento");
 const gSessName = g.sessioneNome ? escapeHtml(g.sessioneNome) : "";
 const gDate = g.eventDataIso ? escapeHtml(formatDataItaliana(g.eventDataIso)) : "";
 const gOra = g.sessioneOrario ? escapeHtml(g.sessioneOrario) : "";
 const gWhen = [gDate, gOra].filter(Boolean).join(" · ");
 const gLuogo = g.luogo ? escapeHtml(g.luogo) : "";
 const headSub = [gWhen ? `📅 ${gWhen}` : "", gLuogo ? `📍 ${gLuogo}` : ""].filter(Boolean).join(" · ");

 const itemsHtml = g.items.map((ev, i) => {
 const tipo = String(ev.tipo || "");
 const logWhen = formatDateTimeShort(ev.timestamp);
 const tavUIFull = tavoloUi(ev.tavolo);
 const posto = (ev.numPersone === null || ev.numPersone === undefined) ? "—" : String(ev.numPersone);

 let tavMeta = "";
 if (String(ev.tavolo || "").includes("Lista d'attesa")) {
 const prefM = String(ev.tavolo || "").match(/\|\s*Pref:\s*([^|]+)/i);
 const lastHM = String(ev.tavolo || "").match(/\|\s*LastH:\s*(\d+)/i);
 const prefStr = prefM ? String(prefM[1] || "").trim() : "";
 const prefIds = prefStr ? prefStr.split(",").map(x => String(x).trim()).filter(Boolean) : [];
 const prefShort = prefIds.length ? `Pref: ${escapeHtml(prefIds.slice(0, 2).join(", "))}${prefIds.length > 2 ? "…" : ""}` : "";
 const lastShort = lastHM ? `LastH: ${escapeHtml(lastHM[1] || "")}h` : "";
 const extra = [prefShort, lastShort].filter(Boolean).join(" · ");
 tavMeta = extra ? `⏳ Lista d'attesa · ${extra}` : "⏳ Lista d'attesa";
 } else {
 tavMeta = `🎲 ${escapeHtml(tavUIFull)}`;
 }

 let label = escapeHtml(tipo);
 if (tipo === "nuova_prenotazione") label = "Iscrizione";
 else if (tipo === "modifica_prenotazione") label = `Spostato al 🎲 Tavolo ${escapeHtml(tavUIFull)}`;
 else if (tipo === "cancellazione") label = "Cancellato";
 else if (tipo === "assegna_da_lista") label = "Assegnato da lista d'attesa";

 const calUrl = calForTl(ev);
 const calHtml = calUrl
 ? `<div class="u-tl-cal"><a href="${calUrl}" target="_blank" rel="noopener" style="color:var(--ember);font-weight:750;text-decoration:underline;font-size:12.5px">📅 Aggiungi al calendario</a></div>`
 : "";

 const metaLine = `👥 ${posto} posti · ${tavMeta}`;
 return `
 <div class="u-tl-item" style="animation-delay:${(gi * 0.03) + (i * 0.02)}s">
 <div class="u-tl-dot"></div>
 <div class="u-tl-main">
 <div class="u-tl-when" style="margin-bottom:6px">${logWhen ? escapeHtml(logWhen) : "—"}</div>
 <div class="u-tl-row">
 <div class="u-tl-label">${label}</div>
 <div class="u-tl-meta-right">${metaLine}</div>
 </div>
 ${calHtml}
 </div>
 </div>`;
 }).join("");

 const keyEsc = String(g.key || "").replace(/[^a-zA-Z0-9_\-]/g, "_");
 const isOpen = gi === 0;
 const chevTxt = isOpen ? "▾" : "▸";

 return `
 <section class="u-tl-group" id="u-tl-group-${keyEsc}">
 <div
 class="u-tl-group-head"
 id="u-tl-group-head-${keyEsc}"
 role="button"
 tabindex="0"
 aria-controls="u-tl-items-${keyEsc}"
 aria-expanded="${isOpen ? "true" : "false"}"
 onclick="toggleTimelineGroup('${keyEsc}')"
 onkeydown="if(event.key==='Enter' || event.key===' '){event.preventDefault();toggleTimelineGroup('${keyEsc}');}"
 >
 <div style="display:flex;align-items:flex-start;gap:10px">
 <div class="u-tl-group-title">📜 ${gEventName}${gSessName ? " · 🧭 " + gSessName : ""}</div>
 <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
 <span class="u-tl-group-toggle-txt">Dettagli</span>
 <span class="u-tl-group-chevron" id="u-tl-chev-${keyEsc}" aria-hidden="true">${chevTxt}</span>
 </div>
 </div>
 <div class="u-tl-group-sub">${headSub || "—"}</div>
 </div>
 <div class="u-tl-group-items${isOpen ? "" : " hidden"}" id="u-tl-items-${keyEsc}">
 ${itemsHtml}
 </div>
 </section>`;
 })
 .join("");

 return;
 }

 // Fallback: lista piatta (se timeline non disponibile)
 hideTimeline();
 listaEl.style.display = "";
 const sorted = [...prenPass].sort((a, b) => {
 const da = dataItalianaToYYYYMMDD(a.eventData) || "";
 const db = dataItalianaToYYYYMMDD(b.eventData) || "";
 return db.localeCompare(da);
 });
 listaEl.innerHTML = sorted.map((p, i) => viewPrenStorico(p, i)).join("");
}

function toggleTimelineGroup(key){
 try {
 const k = String(key || "").trim();
 if (!k) return;
 const items = document.getElementById("u-tl-items-" + k);
 const chev = document.getElementById("u-tl-chev-" + k);
 const head = document.getElementById("u-tl-group-head-" + k);
 if (!items) return;
 const willOpen = items.classList.contains("hidden");
 items.classList.toggle("hidden", !willOpen);
 if (chev) chev.textContent = willOpen ? "▾" : "▸";
 if (head) head.setAttribute("aria-expanded", willOpen ? "true" : "false");
 } catch (e) {}
}

function viewPrenStorico(p, i) {
 const nomeTav = p.tavolo && p.tavolo.includes(" – ") ? p.tavolo.split(" – ").slice(1).join(" – ") : (p.tavolo || "–");
 const numP = p.numPersone || 1;
 const fascia = (labelsFasciaCsv(p.fasciaEta) || "–").replace(/</g, "&lt;");
 const sistemaSt = !p.isListaAttesa ? sistemaGiocoDaPrenotazione(p) : "";
 const sistemaStHtml = sistemaSt
 ? `<div class="bk-tav-sistema" role="status" style="margin-top:8px;padding-top:0;border-top:none">
 <span aria-hidden="true">📘</span>
 <strong>Sistema di gioco:</strong>
 <span>${escapeHtml(sistemaSt)}</span>
 </div>`
 : "";
 const isAttesa = p.isListaAttesa;
 const evNome = (p.eventNome || "").replace(/</g, "&lt;");
 const sessNome = (p.sessioneNome || "").replace(/</g, "&lt;");
 const nomeTavEsc = nomeTav.replace(/</g, "&lt;");
 const calUrl = buildGoogleCalendarUrlForPren(p);
 const calHtml = calUrl
 ? `<div style="margin-top:10px;display:flex;justify-content:flex-end">
 <a href="${calUrl}" target="_blank" rel="noopener" style="color:var(--ember);font-weight:750;text-decoration:underline;font-size:12.5px">📅 Aggiungi al calendario</a>
 </div>`
 : "";
 return `
 <div class="bk-card bk-card-storico ${isAttesa ? "bk-card-attesa" : ""}" style="animation-delay:${(i || 0) * 0.03}s">
 <div class="bk-head">
 <div>
 <div class="bk-event">🎲 ${evNome}</div>
 <div class="bk-sub">📅 ${formatDataItaliana(p.eventData || "")}${sessNome ? " · 🕐 " + sessNome : ""}</div>
 ${!isAttesa && nomeTav ? `<div class="bk-sub" style="margin-top:2px;color:var(--ash)">🎲 ${nomeTavEsc}</div>` : ""}
 ${isAttesa ? "<div class=\"bk-sub\" style=\"margin-top:4px\">⏳ Lista d'attesa</div>" : ""}
 </div>
 <span class="badge ${isAttesa ? "b-att" : "b-ok"}">${isAttesa ? "⏳" : "✅"}</span>
 </div>
 <div class="bk-body">
 <div class="bk-tav-row"><span class="bk-tav-nome">${isAttesa ? "⏳ Lista d'attesa" : "🎲 " + nomeTavEsc}</span><span class="bk-tav-num">×${numP}</span></div>
 <div class="bk-detail-row"><span>👥 ${numP} person${parseInt(numP, 10) === 1 ? "a" : "e"}</span><span>🎯 ${fascia}</span></div>
 ${sistemaStHtml}
 ${calHtml}
 </div>
 </div>`;
}

/** Tab "➕ aggiungi sessione" da tutti gli eventi che hanno sessioni libere (nessun filtro evento in UI). */
function _collectSessioniAggiungiTabs(prenotazioni, sessioniAggiungibili) {
 const rows = [];
 if (!sessioniAggiungibili || typeof sessioniAggiungibili !== "object") return rows;
 Object.keys(sessioniAggiungibili).forEach(evId => {
 const block = sessioniAggiungibili[evId];
 if (!block || !Array.isArray(block.sessioni) || !block.sessioni.length) return;
 const sample = (prenotazioni || []).find(p => p.eventId === evId);
 const eventData = sample?.eventData || "";
 if (eventData && isDataPassata(eventData)) return;
 const evNome = sample?.eventNome || block.ev?.nome || evId;
 block.sessioni.forEach(s => {
 rows.push(Object.assign({}, s, { _addEvId: evId, _addEvNome: evNome }));
 });
 });
 rows.sort((a, b) => {
 const ta = orarioToMinuti(a.orario || a.sessioneOrario || "");
 const tb = orarioToMinuti(b.orario || b.sessioneOrario || "");
 if (ta !== tb) return ta - tb;
 return String(a.sessioneNome || a.nome || "").localeCompare(String(b.sessioneNome || b.nome || ""));
 });
 return rows;
}

function renderListaPren(prenotazioni, filtroEvId, sessioniAggiungibili, filtroSessId) {
 window.partFormEmailEnabled = {};
 const lista = document.getElementById("u-lista");
 const sessNav = document.getElementById("u-sess-nav");
 const evNav = document.getElementById("u-ev-nav");
 const allPren = Array.isArray(prenotazioni) ? prenotazioni : [];
 const eventiConPren = [];
 const seenEv = {};
 allPren.forEach(p => {
 const id = String(p?.eventId || "").trim();
 if (!id || seenEv[id]) return;
 seenEv[id] = true;
 eventiConPren.push({ eventId: id, eventNome: p.eventNome || id });
 });
 const evIdSel = (filtroEvId && seenEv[String(filtroEvId)]) ? String(filtroEvId) : (eventiConPren[0]?.eventId || "");
 const filtroEvAttivo = !!evIdSel;
 const pren = filtroEvAttivo ? allPren.filter(p => p.eventId === evIdSel) : allPren;
 window._uSelectedEventId = evIdSel;
 const _normSessUser = s => { const v = String(s||"").trim().toLowerCase(); return v === "unica" ? "" : v; };
 const evWrap = document.getElementById("u-ev-wrap");
 const evAccHeaderWrap = document.getElementById("u-ev-acc-header-wrap");
 const evSelectedInner = document.getElementById("u-ev-selected-inner");
 const evBodySlot = document.getElementById("u-ev-body-slot");
 if (evWrap) {
 evWrap.classList.toggle("u-ev-wrap--filtro", !!(filtroEvAttivo && pren.length));
 }
 if (evNav) {
 if (!eventiConPren.length) {
 evNav.innerHTML = "";
 evNav.style.display = "none";
 } else {
 evNav.style.display = "flex";
 evNav.setAttribute("role", "tablist");
 evNav.setAttribute("aria-label", "Eventi con prenotazioni");
 evNav.innerHTML = eventiConPren.map(ev => {
 const active = String(ev.eventId) === String(evIdSel);
 const evEsc = String(ev.eventId || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
 const sample = allPren.find(p => String(p?.eventId || "") === String(ev.eventId || ""));
 const evData = sample?.eventData ? formatDataItaliana(sample.eventData) : "";
 return `<button type="button" class="u-sess-tab${active ? " active" : ""}" role="tab" aria-selected="${active}" onclick="renderListaPren(datiUtente.prenotazioniAttive, '${evEsc}', datiUtente.sessioniAggiungibili)"><span style="display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.75;line-height:1.1">📜 Evento</span><span style="display:block;font-weight:700;line-height:1.2;margin-top:2px">📜 ${escapeHtml(ev.eventNome || ev.eventId)}</span>${evData ? `<span style="display:block;font-size:12px;opacity:.9;line-height:1.2;margin-top:2px">📅 ${escapeHtml(evData)}</span>` : ""}</button>`;
 }).join("");
 }
 }
 if (evAccHeaderWrap && evSelectedInner && evBodySlot) {
 evAccHeaderWrap.classList.add("hidden");
 evBodySlot.classList.remove("hidden");
 if (evWrap) evWrap.classList.remove("u-ev-wrap--collapsed");
 }

 if (sessNav) {
 sessNav.innerHTML = "";
 sessNav.classList.add("hidden");
 }

 if (pren.length === 0) {
 // Caso utente senza prenotazioni attive ma con sessioni ancora prenotabili:
 // se è stata selezionata una tab "add:", apri direttamente il blocco aggiunta sessione.
 if (filtroSessId !== undefined && String(filtroSessId).startsWith("add:")) {
 const raw = String(filtroSessId).slice(4);
 let evIdAdd = filtroEvId;
 let sessIdAdd = raw;
 if (raw.indexOf(":") >= 0) {
 const c = raw.indexOf(":");
 evIdAdd = raw.slice(0, c);
 sessIdAdd = raw.slice(c + 1);
 }
 const addPool = _collectSessioniAggiungiTabs(prenotazioni, sessioniAggiungibili);
 const sessAdd = addPool.find(s =>
 String(s._addEvId || "") === String(evIdAdd || "") &&
 _normSessUser(s.sessioneId) === _normSessUser(sessIdAdd)
 );
 const bloc = sessioniAggiungibili && sessioniAggiungibili[evIdAdd] ? sessioniAggiungibili[evIdAdd] : null;
 if (sessAdd) {
 renderAddSessioneBlockInLista(
 evIdAdd,
 sessAdd.sessioneId,
 sessAdd.nome || sessAdd.sessioneNome || "Sessione",
 sessAdd.orario || "",
 bloc?.ev || { eventId: evIdAdd, nome: sessAdd._addEvNome || evIdAdd }
 );
 renderAggiungiSessioni(sessioniAggiungibili);
 return;
 }
 }
 const baseUrl = window.location.origin + window.location.pathname;
 const isUtenteLoggato = typeof UUID !== "undefined" && UUID && datiUtente;
 const btnPrenota = isUtenteLoggato
 ? `<button type="button" class="btn btn-s" onclick="avviaPrenotaDaUtente()">Nuova prenotazione →</button>`
 : `<a href="${baseUrl}" class="btn btn-s">Nuova prenotazione →</a>`;
 lista.innerHTML = `
 <div class="empty-state user-empty-state">
 <span class="empty-icon">🎲</span>
 <p style="margin:0 0 16px">Nessuna prenotazione attiva al momento.</p>
 <p style="font-size:14px;margin:0 0 18px;font-style:normal;color:var(--smoke)">Vuoi iscriverti a un nuovo evento?${isUtenteLoggato ? " I tuoi dati saranno inseriti automaticamente." : ""}</p>
 ${btnPrenota}
 </div>`;
 renderAggiungiSessioni(sessioniAggiungibili);
 return;
 }

 const bySess = {};
 pren.forEach(p => {
 const sid = _normSessUser(p.sessioneId);
 if (!bySess[sid]) bySess[sid] = { sessioneId: p.sessioneId, sessioneNome: p.sessioneNome || "Sessione unica", pren: [] };
 if (!bySess[sid].sessioneOrario && p.sessioneOrario) bySess[sid].sessioneOrario = p.sessioneOrario;
 bySess[sid].pren.push(p);
 });
 const sessioni = Object.values(bySess);

 // Ordina sempre per orario (HH:mm) per coerenza UI (es. Pomeriggio 15 prima di Sera 21).
 sessioni.sort((a, b) => {
 const ta = orarioToMinuti(a.sessioneOrario || "");
 const tb = orarioToMinuti(b.sessioneOrario || "");
 if (ta !== tb) return ta - tb;
 return String(a.sessioneNome||"").localeCompare(String(b.sessioneNome||""));
 });
 let aggiungibili = null;
 let addSessioni = [];
 if (filtroEvAttivo && evIdSel && sessioniAggiungibili && sessioniAggiungibili[evIdSel]) {
 const sampleEv = pren.find(p => p.eventId === evIdSel) || pren[0];
 const eventDataPren = sampleEv?.eventData || "";
 const eventoNonPassato = !eventDataPren || !isDataPassata(eventDataPren);
 if (eventoNonPassato) {
 aggiungibili = sessioniAggiungibili[evIdSel];
 addSessioni = (aggiungibili.sessioni || []).map(s => Object.assign({}, s, { _addEvId: evIdSel, _addEvNome: sampleEv?.eventNome || aggiungibili.ev?.nome || evIdSel }));
 }
 }
 const prenDaMostrare = pren.slice().sort((a, b) => {
 const ta = orarioToMinuti(a.sessioneOrario || "");
 const tb = orarioToMinuti(b.sessioneOrario || "");
 if (ta !== tb) return ta - tb;
 return String(a.sessioneNome||"").localeCompare(String(b.sessioneNome||""));
 });

 lista.innerHTML = "";
 const gruppi = {};
 const ordineGruppi = [];
 const normS = s => String(s||"").trim().toLowerCase();

 prenDaMostrare.forEach((p) => {
 const key = `${p.eventId || ""}__${normS(p.sessioneId)}`;
 if (!gruppi[key]) {
 gruppi[key] = { key, items: [], head: p };
 ordineGruppi.push(key);
 }
 gruppi[key].items.push(p);
 });

 let bkbIdx = 0;
 ordineGruppi.forEach((key, gi) => {
 const g = gruppi[key];
 const head = g.head || (g.items[0] || {});
 const sessNome = head.sessioneNome || head.sessioneId || "";
 const showEvNameInGroup = !filtroEvAttivo;

 const allAttesa = g.items.length && g.items.every(x => x.isListaAttesa);
 const groupClass = "u-hier-card" + (allAttesa ? " bk-card-attesa" : "");
 const sessOrario = head.sessioneOrario ? String(head.sessioneOrario) : "";
 const sessTitle = `🧭 ${escapeHtml(sessNome)}${sessOrario ? " | 🕑 " + escapeHtml(sessOrario) : ""}`;

 const itemsHtml = g.items.map((p, ti) => {
 const id = "bkb-" + (bkbIdx++);
 const tavEsc = (p.tavolo||"").replace(/"/g,"&quot;");
 const evIdEsc = (p.eventId||"").replace(/"/g,"&quot;");
 const sidEsc2 = (p.sessioneId||"").replace(/"/g,"&quot;");
 const tavOpen = ti === 0;
 const isOwnerBooking = !!p.isOwnerBooking;
 const badge = p.isListaAttesa
 ? `<span class="badge b-att">⏳ Lista d'attesa</span>`
 : (isOwnerBooking
 ? `<span class="badge b-ok">✅ Confermato</span>`
 : `<span class="badge b-co">👥 Partecipante</span>`);
 const nomeTavVis = p.isListaAttesa
 ? "Lista d'attesa"
 : escapeHtml(String(p.tavolo?.includes(" – ") ? p.tavolo.split(" – ").slice(1).join(" – ") : (p.tavolo || "–")));
 const lblK = p.isListaAttesa ? "Lista d'attesa" : "🎲 Tavolo";
 const tavLine = p.isListaAttesa ? `⏳ ${nomeTavVis}` : `🎲 ${nomeTavVis}`;
 const chevT = tavOpen ? "▾" : "▸";
 return `
 <div class="u-hier-tavolo">
 <button type="button" class="u-hier-tavolo__head" onclick="toggleUserTavoloAccordion(this)" aria-expanded="${tavOpen ? "true" : "false"}">
 <span class="u-hier-session__chev" aria-hidden="true">${chevT}</span>
 <div class="u-hier-tavolo__head-text">
 <span class="u-hier-session__k">${lblK}</span>
 <span class="u-hier-tavolo__name">${tavLine}</span>
 </div>
 ${badge}
 </button>
 <div class="u-hier-tavolo__body${tavOpen ? "" : " hidden"}">
 <div class="u-hier-booking u-pren-group-body" id="${id}" data-event-id="${evIdEsc}" data-sess-id="${sidEsc2}" data-tavolo="${tavEsc}">
 ${viewPren(p, { hideTavoloTitle: true })}
 </div>
 </div>
 </div>`;
 }).join("");

 const sessOpen = gi === 0;
 const chevS = sessOpen ? "▾" : "▸";
 const sessionBlock = `
 <div class="u-hier-session">
 <button type="button" class="u-hier-session__head" onclick="toggleUserSessAccordion(this)" aria-expanded="${sessOpen ? "true" : "false"}">
 <span class="u-hier-session__chev" aria-hidden="true">${chevS}</span>
 <div class="u-hier-session__head-text">
 <span class="u-hier-session__k">🧭 Area</span>
 <span class="u-hier-session__v">${sessTitle}</span>
 </div>
 </button>
 <div class="u-hier-session__body${sessOpen ? "" : " hidden"}">${itemsHtml}</div>
 </div>`;

 const groupWrap = document.createElement("div");
 groupWrap.className = groupClass + (gi === 0 ? "" : "");
 groupWrap.style.animationDelay = (gi * 0.08) + "s";
 groupWrap.innerHTML = sessionBlock;
 lista.appendChild(groupWrap);
 });

 renderAggiungiSessioni(sessioniAggiungibili, evIdSel);
}

function sistemaGiocoDaPrenotazione(p) {
 if (!p || p.isListaAttesa) return "";
 const direct = String(p.sistemaGioco || "").trim();
 if (direct) return direct;
 const id = String(p.idTavoloAttuale || "").trim();
 if (!id) return "";
 const list = p.tavoliDisponibili || [];
 let t = list.find(x => String(x.id) === String(id));
 if (!t) t = list.find(x => String(x.id).toLowerCase() === id.toLowerCase());
 if (!t && p.tavolo && String(p.tavolo).includes(" – ")) {
 const nomeTav = String(p.tavolo).split(" – ").slice(1).join(" – ").trim();
 if (nomeTav) {
 t = list.find(x => {
 const g = String(x.gioco || x.titoloAvventura || "").trim();
 return g && nomeTav === g;
 });
 }
 }
 return String(t?.sistemaGioco || "").trim();
}

function renderPartecipantiBookingHtml(p, opts) {
 if (!PARTECIPANTI_MULTI_ENABLED) return "";
 opts = opts || {};
 const bookingId = String(p?.bookingId || "").trim();
 const ownerPart = (typeof opts.prenotantePartecipa === "boolean")
 ? opts.prenotantePartecipa
 : _ownerPartecipaBooking(p);
 const maxInvite = _maxPartecipantiBooking(p, ownerPart);
 if (!bookingId || maxInvite <= 0) return "";
 const isOwnerBooking = !!p?.isOwnerBooking;
 const canManagePartecipanti = !!p?.canManagePartecipanti;
 if (!canManagePartecipanti) return "";
 const partecipanti = _partecipantiAttiviBooking(p);
 const myParticipant = partecipanti.find(x => String(x?.participantUuid || "").trim().toLowerCase() === String(UUID || "").trim().toLowerCase());
 const rows = partecipanti.length
 ? partecipanti.map(x => {
 const stato = String(x?.statoInvito || "pending").toLowerCase();
 const nome = escapeHtml(x?.nome || "—");
 const emailRaw = String(x?.email || "").trim();
 const hasEmail = emailRaw.indexOf("@") > 0;
 const emailLine = hasEmail ? escapeHtml(emailRaw) : `<span style="color:var(--ash)">Nessuna email</span>`;
 let badge = "";
 if (stato === "accepted") badge = "✅ accettato";
 else if (hasEmail) badge = "⏳ in attesa invito";
 else badge = "📝 solo elenco (nessun invito)";
 const pid = String(x?.participantId || "").replace(/'/g, "\\'");
 const pUuid = String(x.participantUuid || "").replace(/'/g, "\\'");
 const btns = [];
 if (isOwnerBooking && stato === "accepted" && x?.participantUuid) {
 btns.push(`<button type="button" class="btn btn-o btn-sm" onclick="trasferisciProprietaBooking('${bookingId}','${pUuid}')">Trasferisci proprietà</button>`);
 }
 if (isOwnerBooking && stato === "pending" && hasEmail) {
 btns.push(`<button type="button" class="btn btn-o btn-sm" onclick="reinviaInvitoBooking('${bookingId}','${pid}')">Reinvia invito</button>`);
 }
 if (isOwnerBooking) {
 btns.push(`<button type="button" class="btn btn-d btn-sm" onclick="rimuoviPartecipanteBooking('${bookingId}','${pid}')">Rimuovi</button>`);
 }
 const actions = btns.length ? btns.join("") : "";
 return `<div class="bk-partecipanti-row">
 <div><strong>${nome}</strong> · ${emailLine}<br><span style="font-size:12px;color:var(--ash)">${badge}</span></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
 </div>`;
 }).join("")
 : (ownerPart
 ? `<div class="bk-partecipanti-empty">Nessun altro giocatore indicato. Aggiungi nome (e facoltativamente email) qui sotto.</div>`
 : `<div class="bk-partecipanti-empty">Indica chi siede al tavolo al posto tuo (nome obbligatorio).</div>`);
 const amici = Array.isArray(datiUtente?.amicizie) ? datiUtente.amicizie : [];
 const keysGiaAlTavolo = new Set(partecipanti.map(p => _partKeyPartecipante(p.nome, p.email)));
 const amiciDisponibili = amici.filter(a => !keysGiaAlTavolo.has(_partKeyPartecipante(a.nome, a.email)));
 const amiciOptions = amiciDisponibili.map(a => {
 const label = `${a.nome || a.email} — ${a.email || ""}`;
 return `<option value="${escapeHtml(String(a.friendId || ""))}">${escapeHtml(label)}</option>`;
 }).join("");
 const addByFriendHtml = amiciDisponibili.length
 ? `<div style="margin:0 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
 <select id="part-friend-${bookingId}" style="flex:1;min-width:180px">
 <option value="">Seleziona amico dalla rubrica</option>
 ${amiciOptions}
 </select>
 <button type="button" class="btn btn-o btn-sm" onclick="aggiungiAmicoACampoPartecipanti('${bookingId}')">Compila da rubrica</button>
 </div>`
 : "";
 const removeMeBtn = (!isOwnerBooking && myParticipant)
 ? `<div style="display:flex;justify-content:flex-end;margin-top:8px">
 <button type="button" class="btn btn-d btn-sm" onclick="rimuoviMeDaBooking('${bookingId}')">Rimuovimi da questa prenotazione</button>
 </div>`
 : "";
 const subCo = isOwnerBooking ? "" : " · gestione co-prenotante";
 const cardTitle = ownerPart ? "Altri giocatori al tavolo" : "Partecipanti al tavolo";
 const cardSub = ownerPart
 ? "Oltre al titolare: indica come riconoscere ogni persona (nome, nickname o come preferisci); l'email serve solo per l'invito digitale (gestito automaticamente dal sistema)."
 : "Tu non partecipi: indica chi occupa i posti prenotati (nome obbligatorio; email solo se vuoi inviare l'invito).";
 return `
 <div class="bk-partecipanti-card">
 <div class="bk-partecipanti-card__head">
 <span class="bk-partecipanti-card__title">${cardTitle}${subCo}</span>
 <span class="bk-partecipanti-card__count" title="Indicati rispetto al massimo consentito">${partecipanti.length}/${maxInvite}</span>
 </div>
 <p class="bk-partecipanti-card__sub">${cardSub}</p>
 ${rows}
 ${partecipanti.length < maxInvite ? `
 <div class="bk-partecipanti-add">
 ${addByFriendHtml}
 <p class="hint" style="font-size:12px;margin:0 0 10px;line-height:1.45">Come nella prenotazione: nome o nickname; tocca ➕✉️ per compilare l’email se serve l’invio.</p>
 <div id="part-add-fields-${bookingId}">
 <div class="bk-part-form-line">
 <input type="text" id="part-nome-${bookingId}" autocomplete="nickname" placeholder="Nome o nickname" aria-label="Nome o nickname" />
 <button type="button" class="btn btn-o btn-sm" id="part-email-toggle-${bookingId}" title="Aggiungi email per invito" onclick="toggleEmailPartecipanteBooking('${bookingId}')">➕✉️</button>
 </div>
 <div id="part-email-wrap-${bookingId}" class="field hidden" style="margin-top:10px">
 <label class="lbl" for="part-email-${bookingId}">Email <span class="lbl-note">per invito</span></label>
 <input type="email" id="part-email-${bookingId}" autocomplete="email" placeholder="nome.cognome@email.it" />
 </div>
 <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
 <button type="button" class="btn btn-o btn-sm" id="part-btn-add-${bookingId}" onclick="aggiungiPartecipanteBooking('${bookingId}')">Aggiungi persona</button>
 </div>
 </div>
 </div>` : ""}
 ${removeMeBtn}
 </div>
 `;
}

function viewPren(p, opts) {
 opts = opts || {};
 const hideTavoloTitle = !!opts.hideTavoloTitle;
 const nomeTav = p.tavolo?.includes(" – ") ? p.tavolo.split(" – ").slice(1).join(" – ") : (p.tavolo || "–");
 const isAttesa = p.isListaAttesa;
 const numP = p.numPersone || 1;
 const fascia = labelsFasciaCsv(p.fasciaEta) || "–";
 const sistemaGioco = sistemaGiocoDaPrenotazione(p);
 const sistemaInPanel = sistemaGioco
 ? `<div class="bk-tav-sistema" role="status">
 <span aria-hidden="true">📘</span>
 <strong>Sistema di gioco:</strong>
 <span>${escapeHtml(sistemaGioco)}</span>
 </div>`
 : "";
 const calUrl = buildGoogleCalendarUrlForPren(p);
 const calBlock = calUrl
 ? `<div style="margin-top:12px;display:flex;justify-content:flex-end">
 <a href="${calUrl}" target="_blank" rel="noopener" style="color:var(--ember);font-weight:750;text-decoration:underline;font-size:12.5px">📅 Aggiungi al calendario</a>
 </div>`
 : "";
 const modificabile = puoModificarePrenotazione(p);
 const canManagePrenotazione = !!p?.canManagePrenotazione;
 const bloccoAzioniNonDisponibile = !modificabile
 ? `<div class="bk-non-modificabile" style="margin-top:14px;padding:10px 14px;background:var(--parch3);border-radius:var(--radius);font-size:13px;color:var(--ash);font-style:italic">📅 Evento passato – modifica e cancellazione non più disponibili.</div>`
 : "";

 if (isAttesa) {
 const pJson = JSON.stringify(p).replace(/'/g, "&#39;");
 const bid = _jsArg(p.bookingId || "");
 const eid = _jsArg(p.eventId || "");
 const sid = _jsArg(p.sessioneId || "");
 const btnsAttesa = modificabile
 ? `<div class="act-bar bk-act-bar" style="margin-top:14px">
 <button type="button" class="btn btn-p btn-sm" aria-label="Modifica dati lista d'attesa" onclick='apriFormModifica(${pJson})'>✏️ Modifica</button>
 ${canManagePrenotazione ? `<button type="button" class="btn btn-d btn-sm" aria-label="Esci dalla lista d'attesa" onclick='esciListaAttesaUtente(${bid}, ${eid}, ${sid})'>🗑 Esci dalla lista</button>` : ""}
 </div>`
 : bloccoAzioniNonDisponibile;

 const info = p.waitlistInfo || {};
 const inAuto = !!info.inAutoPool;
 const personeDavanti = (info.personeDavanti === null || info.personeDavanti === undefined) ? "—" : String(info.personeDavanti);
 const totInLista = (info.totInLista === null || info.totInLista === undefined) ? "" : ` su ${info.totInLista}`;
 const poolTxt = inAuto
 ? "Sei nel <strong>pool automatico</strong>: quando si libera un posto compatibile, ti assegneremo automaticamente (e riceverai una email)."
 : "Sei <strong>fuori dal pool automatico</strong>: quando si libera un posto compatibile, l'organizzatore gestirà l'assegnazione (e riceverai una email quando avverrà).";

 return `
 <div class="bk-attesa-msg">
 <div style="font-size:13px;color:var(--smoke);margin-bottom:8px">⏳ Stai aspettando un posto per questa sessione.</div>
 <div style="font-size:14px;color:var(--ink2);line-height:1.55">
 ${poolTxt}
 </div>
 <div class="bk-attesa-dati" style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(192,90,30,.25)">
 <div style="margin-bottom:6px">
 👥 <strong>${personeDavanti}</strong> persone davanti${totInLista}
 </div>
 <div style="font-size:12.5px;color:var(--ash);font-style:italic">
 Appena si libera un posto compatibile con le tue preferenze, verrai contattato e l'assegnazione verrà effettuata secondo le regole della lista.
 </div>
 </div>
 </div>
 ${hideTavoloTitle
 ? `<div class="bk-tav-row bk-tav-row--inline-stats">
 <span class="bk-tav-num">👥 ${numP} person${parseInt(numP)===1?"a":"e"}</span>
 <span class="bk-tav-fascia">🎯 Fasce età: ${fascia}</span>
 </div>`
 : `<div class="bk-tav-row">
 <span class="bk-tav-nome">⏳ Lista d'attesa</span>
 <span class="bk-tav-num">👥 ${numP} person${parseInt(numP)===1?"a":"e"}</span>
 <span class="bk-tav-fascia">🎯 Fasce età: ${fascia}</span>
 </div>`}
 ${calBlock}
 ${btnsAttesa}`;
 }

 const pJson = JSON.stringify(p).replace(/'/g, "&#39;");
 const bid = _jsArg(p.bookingId || "");
 const eid = _jsArg(p.eventId || "");
 const sid = _jsArg(p.sessioneId || "");
 const btnsConfermato = modificabile
 ? `<div class="act-bar bk-act-bar" style="margin-top:14px">
 <button type="button" class="btn btn-p btn-sm" aria-label="Modifica prenotazione" onclick='apriFormModifica(${pJson})'>✏️ Modifica</button>
 ${canManagePrenotazione ? `<button type="button" class="btn btn-d btn-sm" aria-label="Cancella prenotazione" onclick='cancellaPrenotazioneUtente(${bid}, ${eid}, ${sid})'>🗑 Cancella</button>` : ""}
 </div>`
 : bloccoAzioniNonDisponibile;

 const nomeTavEsc = escapeHtml(String(nomeTav || "–"));
 const np = parseInt(numP, 10) || 1;
 const fasciaEsc = escapeHtml(String(fascia || "–"));
 const ownerPartView = _ownerPartecipaBooking(p);
 const maxPartView = _maxPartecipantiBooking(p);
 const partHtmlRaw = maxPartView > 0 ? renderPartecipantiBookingHtml(p) : "";
 const partAccordionTitle = ownerPartView ? "Altri al tavolo" : "Partecipanti al tavolo";
 const partAccordionHint = ownerPartView
 ? `Puoi indicare fino a <strong>${maxPartView}</strong> altro/i giocatore/i oltre a te (su <strong>${np}</strong> posti prenotati).`
 : (maxPartView === 1
 ? `Indica chi siede al posto prenotato: tu sei solo il prenotante.`
 : `Indica fino a <strong>${maxPartView}</strong> partecipanti: tu non siedi al tavolo.`);
 const partBlock = partHtmlRaw
 ? `<div class="bk-pren-altri-accordion u-hier-session">
 <button type="button" class="u-hier-session__head" onclick="toggleBkAltriGiocatori(this)" aria-expanded="false">
 <span class="u-hier-session__chev" aria-hidden="true">▸</span>
 <div class="u-hier-session__head-text">
 <span class="u-hier-session__k">${partAccordionTitle}</span>
 <span class="u-hier-session__v">Apri per vedere o modificare</span>
 <span class="bk-pren-altri-hint">${partAccordionHint}</span>
 </div>
 </button>
 <div class="u-hier-session__body hidden" role="region">${partHtmlRaw}</div>
 </div>`
 : "";

 return `
 <div class="bk-pren-tavolo${hideTavoloTitle ? " bk-pren-tavolo--no-title" : ""}">
 <div class="bk-pren-tavolo__head${hideTavoloTitle ? " bk-pren-tavolo__head--compact" : ""}">
 ${hideTavoloTitle ? "" : `
 <div class="bk-pren-tavolo__title-row">
 <span class="bk-pren-tavolo__ico" aria-hidden="true">🎲</span>
 <span class="bk-pren-tavolo__name">${nomeTavEsc}</span>
 </div>`}
 <div class="bk-pren-meta" role="group" aria-label="Dettagli prenotazione al tavolo">
 <div class="bk-meta-tile" title="Persone coperte da questa prenotazione">
 <span class="bk-meta-tile__k">Posti prenotati</span>
 <span class="bk-meta-tile__v">${np}</span>
 </div>
 <div class="bk-meta-tile" title="Fasce d'età dichiarate">
 <span class="bk-meta-tile__k">Fasce d'età</span>
 <span class="bk-meta-tile__v">${fasciaEsc}</span>
 </div>
 </div>
 </div>
 ${sistemaInPanel}
 </div>
 ${partBlock}
 ${calBlock}
 ${btnsConfermato}`;
}

function toggleBkAltriGiocatori(btn) {
 if (!btn || typeof btn.closest !== "function") return;
 const acc = btn.closest(".bk-pren-altri-accordion");
 if (!acc) return;
 const panel = acc.querySelector(".u-hier-session__body");
 if (!panel) return;
 panel.classList.toggle("hidden");
 const isOpen = !panel.classList.contains("hidden");
 btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (chev) chev.textContent = isOpen ? "▾" : "▸";
}

/** Accordion livello sessione (lista tavoli / prenotazioni) */
function toggleUserSessAccordion(btn) {
 if (!btn || typeof btn.closest !== "function") return;
 const wrap = btn.closest(".u-hier-session");
 if (!wrap) return;
 const body = wrap.querySelector(".u-hier-session__body");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (!body) return;
 body.classList.toggle("hidden");
 const open = !body.classList.contains("hidden");
 btn.setAttribute("aria-expanded", open ? "true" : "false");
 if (chev) chev.textContent = open ? "▾" : "▸";
}

/** Accordion evento selezionato (filtro pill): nasconde sessioni + lista */
function toggleUserEventAccordion(btn) {
 if (!btn) return;
 const slot = document.getElementById("u-ev-body-slot");
 const wrap = document.getElementById("u-ev-wrap");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (!slot) return;
 slot.classList.toggle("hidden");
 const open = !slot.classList.contains("hidden");
 _uEvAccCollapsed = !open;
 btn.setAttribute("aria-expanded", open ? "true" : "false");
 if (chev) chev.textContent = open ? "▾" : "▸";
 if (wrap) wrap.classList.toggle("u-ev-wrap--collapsed", !open);
}

/** Accordion evento dentro la lista (vista tutti gli eventi) */
function toggleUserEventNestedAccordion(btn) {
 if (!btn || typeof btn.closest !== "function") return;
 const nested = btn.closest(".u-hier-event-nested");
 if (!nested) return;
 const body = nested.querySelector(".u-hier-event-nested__body");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (!body) return;
 body.classList.toggle("hidden");
 const open = !body.classList.contains("hidden");
 btn.setAttribute("aria-expanded", open ? "true" : "false");
 if (chev) chev.textContent = open ? "▾" : "▸";
}

/** Accordion singolo tavolo / lista d'attesa */
function toggleUserTavoloAccordion(btn) {
 if (!btn || typeof btn.closest !== "function") return;
 const wrap = btn.closest(".u-hier-tavolo");
 if (!wrap) return;
 const body = wrap.querySelector(".u-hier-tavolo__body");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (!body) return;
 body.classList.toggle("hidden");
 const open = !body.classList.contains("hidden");
 btn.setAttribute("aria-expanded", open ? "true" : "false");
 if (chev) chev.textContent = open ? "▾" : "▸";
}

function toggleUserAddSessionAccordion(btn) {
 if (!btn || typeof btn.closest !== "function") return;
 const wrap = btn.closest(".u-hier-session");
 if (!wrap) return;
 const body = wrap.querySelector(".u-hier-session__body");
 const chev = btn.querySelector(".u-hier-session__chev");
 if (!body) return;
 body.classList.toggle("hidden");
 const open = !body.classList.contains("hidden");
 btn.setAttribute("aria-expanded", open ? "true" : "false");
 if (chev) chev.textContent = open ? "▾" : "▸";
}

function initModPartecipantiState(p, sKey) {
 window._modPartecipanti = window._modPartecipanti || {};
 window._modPartecipantiSource = window._modPartecipantiSource || {};
 window._modPartecipantiSource[sKey] = p;
 window._modPartecipanti[sKey] = _partecipantiAttiviBooking(p).map(x => ({
 nome: String(x?.nome || "").trim(),
 email: String(x?.email || "").trim().toLowerCase(),
 emailEnabled: !!(String(x?.email || "").trim())
 }));
}

function renderModPartecipantiForm(p, sKey) {
 const wrap = document.getElementById("mod-partecipanti-wrap-" + sKey);
 if (!wrap) return;
 if (!PARTECIPANTI_MULTI_ENABLED || p?.isListaAttesa) {
 wrap.classList.add("hidden");
 wrap.innerHTML = "";
 return;
 }
 const ownerCb = document.getElementById("mod-owner-partecipa-" + sKey);
 const prenotantePartecipa = !(ownerCb && ownerCb.checked);
 const numP = Math.max(1, parseInt(document.getElementById("num-" + sKey)?.value || p?.numPersone || 1, 10) || 1);
 const max = Math.max(0, numP - (prenotantePartecipa ? 1 : 0));
 if (max <= 0) {
 wrap.classList.add("hidden");
 wrap.innerHTML = "";
 return;
 }
 wrap.classList.remove("hidden");
 if (!window._modPartecipanti?.[sKey]) initModPartecipantiState(p, sKey);
 let arr = window._modPartecipanti[sKey];
 while (arr.length < max) arr.push({ nome: "", email: "", emailEnabled: false });
 if (arr.length > max) arr = arr.slice(0, max);
 window._modPartecipanti[sKey] = arr;

 const lbl = prenotantePartecipa ? "Partecipanti al tavolo" : "Altri giocatori al tavolo";
 const hint = prenotantePartecipa
 ? (max === 1
 ? "Indica chi siede al posto prenotato (obbligatorio se non partecipi)."
 : `Indica fino a ${max} partecipanti (obbligatorio almeno uno se non partecipi).`)
 : `Facoltativo: fino a ${max} co-prenotante/i oltre a te. Nome o nickname; ➕✉️ per l'email d'invito.`;

 wrap.innerHTML = `
 <label class="lbl">${lbl}${prenotantePartecipa ? ' <span style="color:var(--err)">*</span>' : ""}</label>
 <p class="hint" style="margin-bottom:10px">${hint}</p>
 <div id="mod-part-list-${sKey}" style="display:grid;gap:8px"></div>
 `;
 const listEl = document.getElementById("mod-part-list-" + sKey);
 if (!listEl) return;
 arr.forEach((part, idx) => {
 const row = document.createElement("div");
 row.style.cssText = "display:grid;grid-template-columns:" + (part.emailEnabled ? "1.15fr 1fr auto" : "1fr auto") + ";gap:8px;align-items:center";
 row.innerHTML = `
 <input type="text" placeholder="Nome o nickname ${idx + 1}" autocomplete="nickname" value="${escapeHtml(part.nome || "")}" oninput="window._modPartecipanti['${sKey}'][${idx}].nome=this.value">
 ${part.emailEnabled
 ? `<input type="email" placeholder="Email (facoltativa)" autocomplete="email" value="${escapeHtml(part.email || "")}" oninput="window._modPartecipanti['${sKey}'][${idx}].email=this.value">`
 : ""}
 <button type="button" class="btn btn-o btn-sm" onclick="toggleModPartEmail('${sKey}',${idx})">${part.emailEnabled ? "✉️" : "➕✉️"}</button>
 `;
 listEl.appendChild(row);
 });
}

function toggleModPartEmail(sKey, idx) {
 const arr = window._modPartecipanti?.[sKey];
 if (!arr || !arr[idx]) return;
 arr[idx].emailEnabled = !arr[idx].emailEnabled;
 if (!arr[idx].emailEnabled) arr[idx].email = "";
 const p = window._modPartecipantiSource?.[sKey];
 if (p) renderModPartecipantiForm(p, sKey);
}

function raccogliModPartecipanti(sKey, prenotantePartecipa) {
 const numP = Math.max(1, parseInt(document.getElementById("num-" + sKey)?.value || 1, 10) || 1);
 const max = Math.max(0, numP - (prenotantePartecipa ? 1 : 0));
 const arr = window._modPartecipanti?.[sKey] || [];
 return arr.slice(0, max)
 .map(x => ({
 nome: String(x?.nome || "").trim(),
 email: x?.emailEnabled ? String(x?.email || "").trim().toLowerCase() : ""
 }))
 .filter(x => x.nome);
}

function apriFormModifica(p) {
 if (!puoModificarePrenotazione(p)) {
 flash("user-fa", "📅 Modifica non disponibile per eventi passati.", "err");
 return;
 }
 const eid = sl(p.eventId), sid = sl(p.sessioneId);
 const bidKey = sl(String(p.bookingId || "").trim());
 const sKey = "u_"+eid+"_"+sid+"_"+(bidKey || sl(p.tavolo||""));
 const waitlistPrefIds = p.isListaAttesa ? _parsePrefIdsFromTavolo(p.tavolo) : [];
 const waitlistLastH = p.isListaAttesa ? _parseLastHFromTavolo(p.tavolo) : null;

 let idAttUi = p.isListaAttesa ? _inferWaitlistOptionIdAttesa(p.tavolo) : (p.idTavoloAttuale || null);
 if (p.isListaAttesa) {
 // Migliora inferenza GDR/GDT usando le preferenze tavolo già salvate.
 const tipi = (waitlistPrefIds || [])
 .map(id => p.tavoliDisponibili?.find(t => t.id === id)?.tipo)
 .filter(Boolean);
 if (tipi.includes("GDT")) idAttUi = "Lista d'attesa - Giochi da Tavolo";
 else if (tipi.includes("GDR")) idAttUi = "Lista d'attesa - Giochi di Ruolo";
 }
 selTav[sKey] = idAttUi;
 const nomeTavCompleto = p.tavolo || "";
 let nomeTav = p.isListaAttesa ? "Lista d'attesa" : (nomeTavCompleto.includes(" – ") ? nomeTavCompleto.split(" – ").slice(1).join(" – ") : (nomeTavCompleto || "–"));
 const sistemaMod = sistemaGiocoDaPrenotazione(p);
 const numPersoneMod = Math.max(1, parseInt(p.numPersone, 10) || 1);
 const partecipantiAttiviMod = (Array.isArray(p?.partecipanti) ? p.partecipanti : [])
 .filter(x => {
 const st = String(x?.statoInvito || "").toLowerCase();
 return st !== "revoked" && st !== "declined";
 }).length;
 // Se disponibile usa il flag persistito; fallback a euristica sui partecipanti attivi.
 const ownerPartecipaDefault = (typeof p?.prenotantePartecipa === "boolean")
 ? p.prenotantePartecipa
 : (partecipantiAttiviMod < numPersoneMod);

 const titoloModale = "✏️ Modifica – " + (p.eventNome || "") + (p.sessioneNome ? " / " + p.sessioneNome : "");
 const introTxt = p.isListaAttesa
 ? "Stai modificando la tua <strong>iscrizione in lista d'attesa</strong>. Puoi cambiare <strong>numero persone</strong> e <strong>fasce età</strong> (e, se vuoi, le preferenze)."
 : "Stai modificando la tua <strong>prenotazione</strong>. Puoi cambiare <strong>tavolo</strong>, <strong>numero persone</strong>, <strong>fasce età</strong> e i <strong>partecipanti al tavolo</strong>.";

 const formHtml = `
 <div class="form-sec">
 <p class="bk-edit-intro">${introTxt}</p>
 <div class="bk-edit-summary" aria-label="Riepilogo prenotazione in modifica">
 <span class="bk-edit-summary-label">🕐 ${p.sessioneNome || "Sessione unica"}</span>
 <span>${p.isListaAttesa ? "⏳" : "🎲"} <strong>${escapeHtml(nomeTav)}</strong></span>
 <span>· 👥 <strong>${p.numPersone||1}</strong> person${parseInt(p.numPersone)===1?"a":"e"}</span>
 <span>· 🎯 ${labelsFasciaCsv(p.fasciaEta)||"–"}</span>
 ${!p.isListaAttesa && sistemaMod ? `<span>· 📘 ${escapeHtml(sistemaMod)}</span>` : ""}
 </div>
 ${p.isListaAttesa ? "" : `
 <div class="field first">
 <label class="lbl">🎲 Tavolo</label>
 ${tavoliHtml(sKey, p.tavoliDisponibili, idAttUi, { hideWaitlistOptions: true })}
 </div>
 `}
 ${p.isListaAttesa ? `
 <div class="field first">
 <label class="lbl">Preferenze dei tavoli</label>
 <div id="u-wl-pref-${sKey}" class="fasce-grid" style="margin-top:10px"></div>
 <div id="u-wl-pref-req-${sKey}" class="hint" style="display:none;margin-top:10px">⚠ Seleziona almeno un tavolo preferito per la lista d'attesa.</div>

 <div class="bk-edit-wl-last">
 <label class="bk-edit-check-label">
 <input type="checkbox" id="u-wl-last-chk-${sKey}">
 <span style="line-height:1.35">
 <strong>⏰ Avviso nelle ultime ore</strong><br>
 <span class="bk-edit-check-note">Se attivo, indicare entro quante ore prima sei disponibile ad essere assegnato</span>
 </span>
 </label>
 <div class="bk-edit-wl-last-row">
 <input type="number" id="u-wl-last-ore-${sKey}" min="1" max="24" value="${waitlistLastH !== null && waitlistLastH !== undefined ? String(waitlistLastH) : "6"}" style="width:92px;padding:6px 8px;font-size:13px" />
 <span style="font-size:12.5px;color:var(--ash)">ore</span>
 </div>
 </div>
 </div>
 ` : ""}
 <div class="row2">
 <div class="field first">
 <label class="lbl">Numero persone</label>
 <input type="number" id="num-${sKey}" min="1" max="10" value="${p.numPersone||1}" aria-describedby="num-hint-${sKey}">
 <p class="hint" id="num-hint-${sKey}">Massimo 10 persone per tavolo.</p>
 </div>
 </div>
 <div class="bk-edit-check">
 <label>
 <input type="checkbox" id="mod-owner-partecipa-${sKey}" ${ownerPartecipaDefault ? "" : "checked"}>
 <span>
 <strong>Prenoto per altri e non partecipo personalmente</strong><br>
 <span class="bk-edit-check-note">
 Se attivo, i posti prenotati sono considerati tutti per altri partecipanti.
 </span>
 </span>
 </label>
 </div>
 <div id="mod-partecipanti-wrap-${sKey}" class="field hidden" style="margin-top:4px"></div>
 <div class="field">
 <label class="lbl">Fascia età</label>
 <div class="fasce-grid" id="fe-${sKey}"></div>
 </div>
 </div>`;

 const footerHtml = `
 <div class="act-bar">
 <button type="button" class="btn btn-s btn-sm" onclick='salvaModifica(${JSON.stringify(p).replace(/'/g,"&#39;")}, "${sKey}")'>💾 Salva modifiche</button>
 <button type="button" class="btn btn-o btn-sm" onclick="hide('modifica-overlay')">✕ Annulla</button>
 </div>`;

 const content = document.getElementById("modifica-content");
 const titleEl = document.getElementById("modifica-dialog-title");
 const footerEl = document.getElementById("modifica-dialog-footer");
 if (!content) return;
 if (titleEl) titleEl.textContent = titoloModale;
 content.innerHTML = formHtml;
 if (footerEl) footerEl.innerHTML = footerHtml;
 renderFasceIn(document.getElementById("fe-"+sKey), p.fasciaEta);
 initModPartecipantiState(p, sKey);
 renderModPartecipantiForm(p, sKey);
 const ownerCbMod = document.getElementById("mod-owner-partecipa-" + sKey);
 const numInpMod = document.getElementById("num-" + sKey);
 if (ownerCbMod) ownerCbMod.addEventListener("change", () => renderModPartecipantiForm(p, sKey));
 if (numInpMod) numInpMod.addEventListener("input", () => renderModPartecipantiForm(p, sKey));

 if (p.isListaAttesa) {
 // Imposta la selezione attuale sul chip "Lista d'attesa"
 if (idAttUi) selTavolo(sKey, idAttUi, 999, 999);

 // UI preferenze tavoli + LastH per lista d'attesa
 const wrap = document.getElementById("u-wl-pref-"+sKey);
 const reqEl = document.getElementById("u-wl-pref-req-"+sKey);
 const chkLast = document.getElementById("u-wl-last-chk-"+sKey);
 const inpLast = document.getElementById("u-wl-last-ore-"+sKey);

 if (chkLast && inpLast) {
 const on = (waitlistLastH !== null && waitlistLastH !== undefined);
 chkLast.checked = !!on;
 inpLast.disabled = !chkLast.checked;
 if (!inpLast.value) inpLast.value = "6";
 chkLast.addEventListener("change", () => { inpLast.disabled = !chkLast.checked; });
 }

 // Possibili tavoli: quelli pieni ora + quelli già preferiti (anche se oggi non sono pieni).
 const prefSet = new Set(waitlistPrefIds || []);
 let cand = (p.tavoliDisponibili || []).filter(t => (parseInt(t.liberi, 10) || 0) <= 0 || prefSet.has(t.id));

 cand.sort((a, b) => {
 const ta = a.tipo || "";
 const tb = b.tipo || "";
 const d = ta.localeCompare(tb);
 if (d !== 0) return d;
 return String(a.gioco || "").localeCompare(String(b.gioco || ""));
 });

 const usePriority = !!WAITLIST_PRIORITY_ENABLED;
 const selectedOrdered = [...(waitlistPrefIds || [])];
 window._uWlPrefOrder = window._uWlPrefOrder || {};
 window._uWlPrefOrder[sKey] = selectedOrdered;

 const updateReq = () => {
 if (!reqEl) return;
 const show = selectedOrdered.length === 0;
 reqEl.style.display = show ? "block" : "none";
 };
 const updateRanks = () => {
 if (!wrap) return;
 if (!usePriority) return;
 const spans = wrap.querySelectorAll(".pref-rank[data-id]");
 spans.forEach(sp => {
 const id = sp.getAttribute("data-id");
 const idx = selectedOrdered.indexOf(id);
 sp.textContent = idx >= 0 ? `#${idx + 1}` : "";
 });
 };

 if (wrap) wrap.innerHTML = "";

 if (!cand.length) {
 if (wrap) wrap.innerHTML = `<span style="font-size:12.5px;color:var(--ash);font-style:italic">Nessun tavolo candidato per le preferenze.</span>`;
 } else if (wrap) {
 cand.forEach(t => {
 const lbl = document.createElement("label");
 lbl.className = "fchip" + (selectedOrdered.includes(t.id) ? " on" : "");

 const selected = selectedOrdered.includes(t.id);
 const prefRank = usePriority
 ? `<span class="pref-rank" data-id="${t.id}"></span>`
 : "";

 lbl.innerHTML = `
 <input type="checkbox" value="${t.id}" ${selected ? "checked" : ""}>
 <span class="cdot"></span>
 ${escapeHtml(t.gioco || t.id)}${prefRank}
 `;

 lbl.addEventListener("click", () => {
 const cb = lbl.querySelector("input[type=checkbox]");
 if (!cb) return;
 lbl.classList.toggle("on", cb.checked);
 const id = t.id;
 if (cb.checked) {
 if (!selectedOrdered.includes(id)) selectedOrdered.push(id);
 } else {
 const idx = selectedOrdered.indexOf(id);
 if (idx >= 0) selectedOrdered.splice(idx, 1);
 }
 window._uWlPrefOrder[sKey] = selectedOrdered;
 updateReq();
 updateRanks();
 });

 wrap.appendChild(lbl);
 });
 }

 updateReq();
 updateRanks();
 } else {
 const att = p.tavoliDisponibili.find(t => t.id===p.idTavoloAttuale);
 if (att) selTavolo(sKey, att.id, att.liberi, att.max);
 }
 show("modifica-overlay");
}

/** Costruisce la stringa tavolo per l'azione "aggiungi" (da id selezionato + contesto) */
function buildTavoloStringAggiungi(sKey, idSel, evNome, sessNome) {
 if (!idSel) return "";
 if (idSel.startsWith("Lista")) return "Lista d'attesa – " + (evNome || "") + " – " + (sessNome || "");
 const card = document.getElementById("tc-"+sKey+"-"+idSel);
 return `${idSel} – ${card ? (card.querySelector(".tc-nome")?.textContent?.trim() || idSel) : idSel}`;
}

function salvaModifica(p, sKey) {
 if (!sKey) {
 const bidKey = sl(String(p.bookingId || "").trim());
 sKey = "u_"+sl(p.eventId)+"_"+sl(p.sessioneId)+"_"+(bidKey || sl(p.tavolo||""));
 }
 const idSel = selTav[sKey];

 let tavolo = idSel;
 if (p.isListaAttesa) {
 const baseTav = `Lista d'attesa – ${p.eventNome || p.eventId || ""} – ${p.sessioneNome || p.sessioneId || ""}`.trim();

 const ordered = window._uWlPrefOrder?.[sKey] || _parsePrefIdsFromTavolo(p.tavolo);
 const prefStr = (ordered || []).map(x => String(x).trim()).filter(Boolean).join(", ");
 if (!prefStr) {
 flash("user-fa","Seleziona almeno un tavolo preferito per la lista d'attesa.", "err");
 return;
 }

 tavolo = `${baseTav} | Pref: ${prefStr}`;
 const chkLast = document.getElementById("u-wl-last-chk-"+sKey);
 const inpLast = document.getElementById("u-wl-last-ore-"+sKey);
 if (chkLast && inpLast && chkLast.checked) {
 const ore = Math.max(1, Math.min(24, parseInt(inpLast.value || "6", 10) || 6));
 tavolo += ` | LastH: ${ore}`;
 }
 } else {
 if (!idSel) { flash("user-fa","⚠️ Seleziona un tavolo.","err"); return; }
 tavolo = idSel;
 if (String(idSel).startsWith("Lista")) {
 tavolo = buildTavoloStringAggiungi(sKey, idSel, p.eventNome, p.sessioneNome);
 } else {
 const t = p.tavoliDisponibili.find(t => t.id===idSel);
 if (t) tavolo = `${t.id} – ${t.gioco}`;
 if (t && !_confermaAvventureGiaGiocate([t.gioco])) return;
 }
 }

 const ownerCb = document.getElementById("mod-owner-partecipa-"+sKey);
 const prenotantePartecipa = !(ownerCb && ownerCb.checked);
 const numPersone = parseInt(document.getElementById("num-"+sKey).value, 10) || 1;
 const fasciaEta = getFasce(document.getElementById("fe-"+sKey));
 const maxPart = Math.max(0, numPersone - (prenotantePartecipa ? 1 : 0));
 const partList = (PARTECIPANTI_MULTI_ENABLED && maxPart > 0 && !p.isListaAttesa)
 ? raccogliModPartecipanti(sKey, prenotantePartecipa)
 : [];

 if (PARTECIPANTI_MULTI_ENABLED && !p.isListaAttesa && !prenotantePartecipa && partList.length === 0) {
 flash("user-fa", "Indica almeno un partecipante: hai scelto di non partecipare personalmente.", "err");
 return;
 }
 for (let i = 0; i < partList.length; i++) {
 if (!_etichettaPartecipanteOk(partList[i].nome)) {
 flash("user-fa", "Ogni partecipante deve avere un nome o nickname (max 120 caratteri).", "err");
 return;
 }
 if (partList[i].email && partList[i].email.indexOf("@") <= 0) {
 flash("user-fa", "Controlla le email inserite.", "err");
 return;
 }
 }

 const payloadMod = {
 tavolo,
 numPersone,
 fasciaEta,
 prenotantePartecipa,
 vecchioTavolo: p.tavolo,
 bookingId: p.bookingId || ""
 };

 const tavoloChanged = p.isListaAttesa
 ? (tavolo !== p.tavolo)
 : (String(idSel || "") !== String(p.idTavoloAttuale || ""));
 const needsCambio = tavoloChanged
 || numPersone !== (parseInt(p.numPersone, 10) || 1)
 || fasciaEta !== String(p.fasciaEta || "").trim()
 || prenotantePartecipa !== _ownerPartecipaBooking(p);

 const finalizeOk = () => {
 hide("modifica-overlay");
 flash("user-fa", "✅ Modifiche salvate.", "ok");
 caricaUtente();
 };

 const doCambio = () => {
 if (!needsCambio) {
 finalizeOk();
 return;
 }
 inviaModifica(p.eventId, p.sessioneId, "cambia_tavolo", payloadMod);
 };

 if (PARTECIPANTI_MULTI_ENABLED && maxPart > 0 && !p.isListaAttesa && p.bookingId) {
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore salvataggio partecipanti."), "err");
 return;
 }
 doCambio();
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .salvaPartecipantiPrenotazione(UUID, p.bookingId, partList, true);
 } else {
 doCambio();
 }
}

/** Blocco "Aggiungi sessione" quando si seleziona una tab sessione aggiungibile (nella lista utente) */
function renderAddSessioneBlockInLista(evId, sessioneId, sessioneNome, orario, ev, targetId) {
 const lista = document.getElementById(targetId || "u-lista");
 if (!lista) return;
 const eid = sl(evId);
 const sid = sl(sessioneId);
 const sKey = "addtab_"+eid+"_"+sid;
 const label = `🧭 ${sessioneNome || "Sessione"}${orario ? " | 🕑 " + orario : ""}`;
 const evNome = (ev && ev.nome) ? ev.nome : evId;
 const isEmbedded = !!targetId;
 const innerBody = `
 <div class="bk-body">
 <p class="bk-add-sess-desc">Sei già prenotato in un altro orario di questo evento. Qui puoi aggiungere un tavolo (o la lista d'attesa) per <strong>questa</strong> sessione.</p>
 <div class="field first">
 <label class="lbl">🎲 Tavolo</label>
 <div id="addtab-tav-${eid}-${sid}" class="addtab-loading">Caricamento tavoli…</div>
 </div>
 <div class="row2" style="margin-top:12px">
 <div class="field first">
 <label class="lbl">Numero persone</label>
 <input type="number" id="num-${sKey}" aria-describedby="addtab-num-hint-${eid}-${sid}" min="1" max="10" value="1">
 <p class="hint" id="addtab-num-hint-${eid}-${sid}">Il massimo dipende dal tavolo scelto.</p>
 </div>
 </div>
 <div class="field">
 <label class="lbl">Fascia età</label>
 <div class="fasce-grid" id="addtab-fe-${eid}-${sid}"></div>
 </div>
 <div class="act-bar" style="margin-top:14px">
 <button type="button" class="btn btn-s btn-sm" onclick="inviaAddSessioneFromTab('${(evId||"").replace(/'/g,"\\'")}', '${(sessioneId||"").replace(/'/g,"\\'")}', '${eid}', '${sid}', '${(evNome||"").replace(/'/g,"\\'").replace(/"/g,"&quot;")}', '${(sessioneNome||"").replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">✅ Aggiungi questa sessione</button>
 </div>
 </div>`;

 if (isEmbedded) {
 lista.innerHTML = `
 <div class="u-hier-session" id="addtab-wrap-${eid}-${sid}" style="border:1px solid var(--line);border-radius:12px;background:var(--card)">
 <button type="button" class="u-hier-session__head" onclick="toggleUserSessAccordion(this)" aria-expanded="false">
 <span class="u-hier-session__chev" aria-hidden="true">▸</span>
 <div class="u-hier-session__head-text">
 <span class="u-hier-session__k">🧭 Aggiungi sessione</span>
 <span class="u-hier-session__v">${escapeHtml(label)}</span>
 </div>
 </button>
 <div class="u-hier-session__body hidden">${innerBody}</div>
 </div>`;
 } else {
 lista.innerHTML = `
 <div class="bk-card bk-add-sess-block" id="addtab-wrap-${eid}-${sid}">
 <div class="bk-head">
 <div>
 <div class="bk-event">➕ Aggiungi sessione</div>
 <div class="bk-sub">🕐 ${escapeHtml(label)}</div>
 </div>
 </div>
 ${innerBody}
 </div>`;
 }
 renderFasceIn(document.getElementById("addtab-fe-"+eid+"-"+sid), "");
 selTav[sKey] = null;
 google.script.run
 .withSuccessHandler(tavoli => {
 const container = document.getElementById("addtab-tav-"+eid+"-"+sid);
 if (!container) return;
 container.classList.remove("addtab-loading");
 container.innerHTML = tavoliHtml(sKey, tavoli || [], null);
 const primo = (tavoli||[]).find(t => t.liberi > 0);
 if (primo) selTavolo(sKey, primo.id, primo.liberi, primo.max);
 })
 .withFailureHandler(() => {
 const container = document.getElementById("addtab-tav-"+eid+"-"+sid);
 if (container) {
 container.classList.remove("addtab-loading");
 container.innerHTML = "<p style='color:var(--err)'>Impossibile caricare i tavoli. Riprova.</p>";
 }
 })
 .getTavoliPerSessione(evId, sessioneId);
}

function inviaAddSessioneFromTab(evId, sessId, eid, sid, evNome, sessioneNome) {
 const sKey = "addtab_"+eid+"_"+sid;
 const idSel = selTav[sKey];
 if (!idSel) { flash("user-fa", "⚠️ Seleziona un tavolo.", "err"); return; }
 const card = document.getElementById("tc-"+sKey+"-"+String(idSel || "").trim());
 const nomeAvventura = String(card?.querySelector(".tc-nome")?.textContent || "").trim();
 if (idSel && !String(idSel).startsWith("Lista") && !_confermaAvventureGiaGiocate([nomeAvventura])) return;
 const tavolo = buildTavoloStringAggiungi(sKey, idSel, evNome || evId, sessioneNome || sessId);
 const numEl = document.getElementById("num-"+sKey);
 const feEl = document.getElementById("addtab-fe-"+eid+"-"+sid);
 inviaModifica(evId, sessId, "aggiungi", {
 tavolo,
 numPersone: parseInt(numEl?.value) || 1,
 fasciaEta: getFasce(feEl)
 });
}

/** Non mostrare più la sezione standalone: l'aggiunta di un'altra sessione è nel form di modifica e nelle tab */
function renderAggiungiSessioni(aggiungibili, evIdSelezionato) {
 const sec = document.getElementById("u-aggiungi");
 if (!sec) return;
 const evId = String(evIdSelezionato || window._uSelectedEventId || "").trim();
 const bloc = evId && aggiungibili && aggiungibili[evId] ? aggiungibili[evId] : null;
 const sessioni = Array.isArray(bloc?.sessioni) ? bloc.sessioni : [];
 if (!evId || !sessioni.length) {
 sec.innerHTML = "";
 return;
 }
 const evNome = String(bloc?.ev?.nome || (datiUtente?.prenotazioniAttive || []).find(p => p.eventId === evId)?.eventNome || evId);
 sec.innerHTML = "";
 sessioni.forEach((s, i) => {
 const sid = String(s.sessioneId || "");
 const sNome = String(s.nome || s.sessioneNome || "Sessione");
 const sOra = String(s.orario || s.sessioneOrario || "");
 const slotId = `u-addsess-slot-${evId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${sid.replace(/[^a-zA-Z0-9_-]/g, "_")}-${i}`;
 sec.insertAdjacentHTML("beforeend", `<div id="${slotId}" style="margin-top:${i ? "10px" : "0"}"></div>`);
 renderAddSessioneBlockInLista(
 evId,
 sid,
 sNome,
 sOra,
 { eventId: evId, nome: evNome },
 slotId
 );
 });
}

function inviaModifica(evId, sessId, azione, payload) {
 if (!(typeof UUID !== "undefined" && UUID && String(UUID).trim())) {
 flash("user-fa", "⚠️ Link non valido: impossibile identificare l'utente. Apri di nuovo il link dalla email.", "err");
 return;
 }
 payload = payload || {};
 if (azione === "cancella" || azione === "cambia_tavolo") {
 const bid = String(payload.bookingId || "").trim();
 if (!bid) {
 flash("user-fa", "⚠️ Identificativo prenotazione (bookingId) mancante.", "err");
 return;
 }
 }
 document.querySelectorAll(".btn").forEach(b => b.disabled=true);
 beginActionOverlay("Salvataggio in corso…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 document.querySelectorAll(".btn").forEach(b => b.disabled=false);
 if (res && res.ok) {
 hide("modifica-overlay");
 flash("user-fa","✅ "+(res.messaggio || "Operazione completata."),"ok");
 caricaUtente();
 } else {
 flash("user-fa","⚠️ "+(res?.errore || "Operazione non riuscita."),"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 document.querySelectorAll(".btn").forEach(b => b.disabled=false);
 flash("user-fa","⚠️ "+(err?.message || err || "Operazione non riuscita. Riprova."),"err");
 })
 .modificaPrenotazione(UUID, evId, sessId, azione, payload);
}

/** Controlli su bookingId / eventId / sessioneId (non sul nome tavolo). */
function cancellaPrenotazioneUtente(bookingId, eventId, sessioneId) {
 const bid = String(bookingId || "").trim();
 const evId = String(eventId || "").trim();
 const sessId = String(sessioneId || "").trim();
 if (!bid || !evId) {
 flash("user-fa", "⚠️ Identificativo prenotazione mancante.", "err");
 return;
 }
 const p = _trovaPrenotazioneUtenteByBookingId(bid);
 const label = _labelPrenotazionePerId(p, bid);
 chiediConferma(`Cancellare la prenotazione (${label})?`, () =>
 inviaModifica(evId, sessId, "cancella", { bookingId: bid })
 );
}

function esciListaAttesaUtente(bookingId, eventId, sessioneId) {
 const bid = String(bookingId || "").trim();
 const evId = String(eventId || "").trim();
 const sessId = String(sessioneId || "").trim();
 if (!bid || !evId) {
 flash("user-fa", "⚠️ Identificativo prenotazione mancante.", "err");
 return;
 }
 chiediConferma("Vuoi uscire dalla lista d'attesa? Non riceverai più avvisi per questo evento.", () =>
 inviaModifica(evId, sessId, "cancella", { bookingId: bid })
 );
}

function persistPartecipantiLista(bookingId, list, onOk) {
 for (let i = 0; i < list.length; i++) {
 if (!_etichettaPartecipanteOk(list[i].nome)) {
 flash("user-fa", "Ogni partecipante deve avere un nome o nickname (max 120 caratteri).", "err");
 return;
 }
 if (list[i].email && list[i].email.indexOf("@") <= 0) {
 flash("user-fa", "Controlla le email inserite.", "err");
 return;
 }
 }
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 if (typeof onOk === "function") onOk();
 flash("user-fa", "✅ Salvato. Inviti e notifiche gestiti dal sistema.", "ok");
 caricaUtente();
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore salvataggio."), "err");
 }
 })
 .withFailureHandler(err => {
 flash("user-fa", "❌ " + (err.message || err), "err");
 })
 .salvaPartecipantiPrenotazione(UUID, bookingId, list, true);
}

function reinviaInvitoBooking(bookingId, participantId) {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) { flash("user-fa", "✅ Invito reinviato.", "ok"); caricaUtente(); }
 else flash("user-fa", "⚠️ " + (res?.errore || "Errore reinvio invito."), "err");
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .reinviaInvitoPartecipante(UUID, bookingId, participantId);
}

function rimuoviPartecipanteBooking(bookingId, participantId) {
 chiediConferma("Rimuovere questa persona dall'elenco co-prenotanti? Il numero di posti prenotati al tavolo resta invariato.", () => {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) { flash("user-fa", "✅ Partecipante rimosso dall'elenco.", "ok"); caricaUtente(); }
 else flash("user-fa", "⚠️ " + (res?.errore || "Operazione non riuscita."), "err");
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .rimuoviPartecipanteDaPrenotazione(UUID, bookingId, participantId);
 });
}

function trasferisciProprietaBooking(bookingId, newOwnerUuid) {
 chiediConferma("Trasferire la proprietà della prenotazione a questo partecipante?", () => {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 flash("user-fa", "✅ Proprietà trasferita. Aggiorna il tuo link personale.", "ok");
 caricaUtente();
 } else {
 flash("user-fa", "⚠️ " + (res?.errore || "Errore trasferimento proprietà."), "err");
 }
 })
 .withFailureHandler(err => flash("user-fa", "❌ " + (err.message || err), "err"))
 .trasferisciProprietaPrenotazione(UUID, bookingId, newOwnerUuid);
 });
}

// ═══════════════════════════════════════════
// ORGANIZZATORE
// ═══════════════════════════════════════════
/** Segnala errore all'organizzatore via email (contesto, dati, log, messaggio). Non blocca l'UI. */
function segnalaErroreOrgClient(contesto, datiInseriti, log, messaggioErrore) {
 const dati = datiInseriti != null ? (typeof datiInseriti === "string" ? datiInseriti : JSON.stringify(datiInseriti)) : null;
 google.script.run.withFailureHandler(() => {}).segnalaErroreOrg(contesto, dati, log || "Errore lato client.", messaggioErrore || "Errore sconosciuto.");
}

async function verificaOrg() {
 const pwd = document.getElementById("org-pwd").value;
 const err = document.getElementById("org-err");
 if (!pwd) { err.textContent = "Inserisci la password."; return; }

 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
 const h = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");

 err.textContent = "…";
 document.getElementById("org-pwd").disabled = true;

 google.script.run
 .withSuccessHandler(res => {
 document.getElementById("org-pwd").disabled = false;
 if (res && res.ok) {
 ORG_HASH_CLIENT = h;
 hide("org-login");
 err.textContent = "";
 setOrgDashboardHeader(true);
 // default macro-tab dopo login
 setHSub("📊 Statistiche");
 caricaOrg("stats");
 } else {
 err.textContent = "❌ Password errata.";
 document.getElementById("org-pwd").value = "";
 document.getElementById("org-pwd").focus();
 }
 })
 .withFailureHandler(err => {
 document.getElementById("org-pwd").disabled = false;
 err.textContent = "❌ Errore di connessione. Riprova.";
 segnalaErroreOrgClient("verificaPasswordOrg", null, "Verifica password: connessione/eccezione server fallita.", err.message || String(err));
 })
 .verificaPasswordOrg(h);
}

function logoutOrg() {
 stopLiveSync();
 ORG_HASH_CLIENT = null;
 datiOrg = null;
 ORG_LAZY = { tavoli: false, anagrafiche: false };
 hide("org-main");
 setOrgDashboardHeader(false);
 const pwd = document.getElementById("org-pwd");
 const err = document.getElementById("org-err");
 if (pwd) {
 pwd.value = "";
 }
 if (err) {
 err.textContent = "";
 }
 show("org-login");
 setHSub("Pannello Organizzatore");
 setTimeout(() => document.getElementById("org-pwd")?.focus(), 150);
}

// ═══════════════════════════════════════════
// ACCOGLIENZA (vista standalone con login)
// ═══════════════════════════════════════════
let ACC_HASH_CLIENT = null;
let ACC_DATI = null;

async function verificaAccoglienza() {
 const pwd = document.getElementById("acc-pwd").value;
 const err = document.getElementById("acc-err");
 if (!pwd) { err.textContent = "Inserisci la password."; return; }

 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
 const h = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");

 err.textContent = "…";
 document.getElementById("acc-pwd").disabled = true;

 google.script.run
 .withSuccessHandler(res => {
 document.getElementById("acc-pwd").disabled = false;
 if (res && res.ok) {
 ACC_HASH_CLIENT = h;
 hide("accoglienza-login");
 show("accoglienza-main");
 setAppTitle("Accoglienza");
 setHSub("Check-in e gestione arrivi");
 accCaricaDati();
 } else {
 err.textContent = "⚠️ " + (res?.errore || "Password non valida.");
 }
 })
 .withFailureHandler(err => {
 document.getElementById("acc-pwd").disabled = false;
 err.textContent = "❌ Errore di connessione. Riprova.";
 })
 .verificaPasswordOrg(h);
}

function accLogout() {
 ACC_HASH_CLIENT = null;
 ACC_DATI = null;
 hide("accoglienza-main");
 show("accoglienza-login");
 const pwd = document.getElementById("acc-pwd");
 const err = document.getElementById("acc-err");
 if (pwd) pwd.value = "";
 if (err) err.textContent = "";
 setHSub("Check-in e gestione arrivi");
 setTimeout(() => document.getElementById("acc-pwd")?.focus(), 150);
}

function accRicarica() {
 if (!ACC_HASH_CLIENT) return;
 accCaricaDati();
}

/** Carica i dati organizzatore dopo il login e disegna la mappa accoglienza. */
function accCaricaDati() {
 if (!ACC_HASH_CLIENT) return;
 setLdr("Caricamento dati…"); show("loader"); hide("accoglienza-main");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (!res || !res.ok) {
 show("accoglienza-main");
 flash("acc-fa", "Caricamento dati non riuscito.", "err");
 return;
 }
 ACC_DATI = res;
 show("accoglienza-main");
 caricaMappaAccoglienza();
 })
 .withFailureHandler(err => {
 hide("loader"); show("accoglienza-main");
 flash("acc-fa", "Operazione non riuscita. Riprova.", "err");
 })
 .getDatiOrganizzatore("full");
}

// ── Vista staff accoglienza: scelta evento, lista arrivi con ricerca e check-in (stile mappa eventi/tavoli) ──
let ACC_UI = { evId: "", filtro: "da_arrivare", q: "" };
let ACC_LISTA = [];

function _accTavoloInfo(tavolo) {
 const s = String(tavolo || "").trim();
 if (!s || s.indexOf("Lista d'attesa") >= 0) return null;
 if (s.indexOf("SESSIONE_LIBERA") >= 0) return { libero: true };
 const parti = s.split(/\s+[–-]\s+/);
 return { id: parti[0] || "", gioco: parti.slice(1).join(" – ") };
}

function _accSessNome(evId, sessId) {
 const ev = (ACC_DATI?.eventiConSessioni || []).find(e => e.eventId === evId);
 const s = (ev?.sessioni || []).find(x => String(x.sessioneId) === String(sessId));
 return s?.nome || sessId || "";
}

function _accPrenotazioniEvento(evId) {
 return (ACC_DATI?.prenotazioni || []).filter(p => p.eventId === evId && !p.isListaAttesa);
}

function _accEventiConPrenotazioni() {
 return (ACC_DATI?.eventi || []).filter(ev => _accPrenotazioniEvento(ev.eventId).length > 0);
}

function accSelEvento(evId) {
 ACC_UI.evId = evId;
 ACC_UI.q = "";
 caricaMappaAccoglienza();
}

function accTornaEventi() {
 ACC_UI.evId = "";
 caricaMappaAccoglienza();
}

function accSetFiltro(f) {
 ACC_UI.filtro = f;
 caricaMappaAccoglienza();
}

function accCerca(q) {
 ACC_UI.q = String(q || "");
 _accRenderLista();
}

function caricaMappaAccoglienza() {
 if (!ACC_DATI) return;
 const container = document.getElementById("acc-mappa-container");
 if (!container) return;

 const eventi = _accEventiConPrenotazioni();
 if (!eventi.length) {
  container.innerHTML = `<div class="mev-empty"><span class="empty-icon">🎲</span>Nessun evento con prenotazioni.</div>`;
  return;
 }
 if (eventi.length === 1 && !ACC_UI.evId) ACC_UI.evId = eventi[0].eventId;

 if (!ACC_UI.evId || !eventi.some(ev => ev.eventId === ACC_UI.evId)) {
  ACC_UI.evId = "";
  container.innerHTML = `
   <div class="acc-titolo">Scegli l'evento</div>
   <div class="mappa-ev-grid">${eventi.map((ev, i) => _accEventoCardHtml(ev, i)).join("")}</div>`;
  return;
 }

 const ev = eventi.find(e => e.eventId === ACC_UI.evId);
 const dataLabel = ev.data ? formatDataItaliana(ev.data) : "";
 container.innerHTML = `
  <div class="acc-head">
   <button type="button" class="btn btn-o btn-sm" onclick="accTornaEventi()">← Eventi</button>
   <div class="acc-head-testo">
    <div class="mev-nome">${escapeHtml(ev.nome || ev.eventId)}</div>
    <div class="mev-data">${[dataLabel, ev.luogo].filter(Boolean).map(escapeHtml).join(" · ")}</div>
   </div>
  </div>
  <div class="mev-stats" id="acc-stats"></div>
  <div class="acc-filtri">
   <button type="button" class="mappa-sess-btn" data-f="da_arrivare" onclick="accSetFiltro('da_arrivare')">Da far arrivare</button>
   <button type="button" class="mappa-sess-btn" data-f="arrivati" onclick="accSetFiltro('arrivati')">Arrivati</button>
   <button type="button" class="mappa-sess-btn" data-f="tutti" onclick="accSetFiltro('tutti')">Tutti</button>
  </div>
  <input type="search" class="acc-cerca" placeholder="Cerca per nome, email o cellulare" value="${escapeHtml(ACC_UI.q)}" oninput="accCerca(this.value)" aria-label="Cerca">
  <div id="acc-lista" class="acc-lista"></div>`;

 container.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("active", b.dataset.f === ACC_UI.filtro));
 _accRenderLista();
}

function _accEventoCardHtml(ev, i) {
 const pren = _accPrenotazioniEvento(ev.eventId);
 const arrivati = pren.filter(p => p.checkin).length;
 const persone = pren.reduce((s, p) => s + (parseInt(p.numPersone, 10) || 1), 0);
 const dataLabel = ev.data ? formatDataItaliana(ev.data) : "";
 return `
  <div class="mappa-ev-card" onclick="accSelEvento('${String(ev.eventId).replace(/'/g, "\\'")}')" style="animation-delay:${i * 0.05}s">
   <div class="mev-nome">${escapeHtml(ev.nome || ev.eventId)}</div>
   <div class="mev-data">${[dataLabel, ev.luogo].filter(Boolean).map(escapeHtml).join(" · ")}</div>
   <div class="mev-stats">
    <div class="mev-stat"><div class="mev-stat-n">${pren.length}</div><div class="mev-stat-l">Prenotaz.</div></div>
    <div class="mev-stat"><div class="mev-stat-n">${persone}</div><div class="mev-stat-l">Persone</div></div>
    <div class="mev-stat"><div class="mev-stat-n">${arrivati}/${pren.length}</div><div class="mev-stat-l">Arrivati</div></div>
   </div>
   <div class="mev-cta">Apri accoglienza <span style="font-size:14px">→</span></div>
  </div>`;
}

function _accRenderLista() {
 const lista = document.getElementById("acc-lista");
 if (!lista) return;
 const tutte = _accPrenotazioniEvento(ACC_UI.evId);
 const arrivati = tutte.filter(p => p.checkin);
 const persArrivate = arrivati.reduce((s, p) => s + (parseInt(p.numPersone, 10) || 1), 0);
 const stats = document.getElementById("acc-stats");
 if (stats) stats.innerHTML = `
  <div class="mev-stat"><div class="mev-stat-n">${arrivati.length}/${tutte.length}</div><div class="mev-stat-l">Arrivati</div></div>
  <div class="mev-stat"><div class="mev-stat-n">${tutte.length - arrivati.length}</div><div class="mev-stat-l">Da arrivare</div></div>
  <div class="mev-stat"><div class="mev-stat-n">${persArrivate}</div><div class="mev-stat-l">Persone arrivate</div></div>`;

 const q = ACC_UI.q.trim().toLowerCase();
 ACC_LISTA = tutte.filter(p => {
  if (ACC_UI.filtro === "da_arrivare" && p.checkin) return false;
  if (ACC_UI.filtro === "arrivati" && !p.checkin) return false;
  if (!q) return true;
  const campi = [p.nome, p.email, p.cellulare, ...(p.partecipanti || []).map(x => x.nome)];
  return campi.some(c => String(c || "").toLowerCase().includes(q));
 });

 lista.innerHTML = ACC_LISTA.length
  ? ACC_LISTA.map((p, i) => _accCardHtml(p, i)).join("")
  : `<div class="mev-empty"><span class="empty-icon">🎲</span>Nessuna prenotazione da mostrare.</div>`;
}

function _accCardHtml(p, i) {
 const tav = _accTavoloInfo(p.tavolo);
 const isGdt = !tav || tav.libero;
 const sess = _accSessNome(p.eventId, p.sessione);
 const membri = (p.partecipanti || []).map(x => x.nome).filter(Boolean);
 const persone = parseInt(p.numPersone, 10) || 1;
 const posto = isGdt
  ? "Gioco libero"
  : `Tavolo <strong>${escapeHtml(tav.id)}</strong>${tav.gioco ? " · " + escapeHtml(tav.gioco) : ""}`;
 const meta = [posto, `👥 ${persone}`, sess ? escapeHtml(sess) : ""].filter(Boolean).join(" · ");
 return `
  <div class="acc-row ${p.checkin ? "acc-arrivato" : ""}">
   <div class="acc-row-info">
    <div class="acc-row-nome">${escapeHtml(p.nome || "—")}</div>
    <div class="acc-row-mail">${escapeHtml(p.email || "nessuna email")}</div>
    <div class="acc-row-meta">${meta} <span class="tipo-badge ${isGdt ? "t-gdt" : "t-gdr"}">${isGdt ? "GDT" : "GDR"}</span></div>
    ${membri.length > 1 ? `<div class="acc-row-meta">${membri.map(escapeHtml).join(", ")}</div>` : ""}
   </div>
   <button type="button" class="btn ${p.checkin ? "btn-o" : "btn-s"} btn-sm acc-row-btn" onclick="accToggleArrivo(${i})">
    ${p.checkin ? "✅ Arrivato" : "🚪 Arrivo"}
   </button>
  </div>`;
}

function accToggleArrivo(i) {
 const p = ACC_LISTA[i];
 if (!p) return;
 const wanted = !p.checkin;
 const prev = p.checkin;
 p.checkin = wanted;
 _accRenderLista();
 google.script.run
  .withSuccessHandler(res => {
   if (!res || !res.ok) {
    p.checkin = prev;
    _accRenderLista();
    flash("acc-fa", "⚠️ " + (res?.errore || "Aggiornamento non riuscito."), "err");
   }
  })
  .withFailureHandler(() => {
   p.checkin = prev;
   _accRenderLista();
   flash("acc-fa", "❌ Connessione non riuscita. Riprova.", "err");
  })
  .orgConfermaPresenza(String(p.eventId || ""), String(p.sessione || ""), "", String(p.bookingId || ""), String(p.uuid || ""), wanted);
}


function caricaOrg(scope) {
 const sc = scope === undefined || scope === null ? "full" : String(scope);
 setLdr(sc === "stats" ? "Caricamento panoramica…" : "Caricamento dati organizzatore…"); show("loader"); hide("org-main");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (!res.ok) {
 segnalaErroreOrgClient("getDatiOrganizzatore", null, "Risposta server: dati dashboard non caricati.", res.errore);
 flash("org-fa","⚠️ "+res.errore,"err"); show("org-main"); return;
 }
 datiOrg = res;
 if (sc === "stats") {
 ORG_LAZY.tavoli = false;
 ORG_LAZY.anagrafiche = false;
 if (!Array.isArray(datiOrg.utenti)) datiOrg.utenti = [];
 if (!Array.isArray(datiOrg.masters)) datiOrg.masters = [];
 if (!Array.isArray(datiOrg.partecipantiNonPrenotanti)) datiOrg.partecipantiNonPrenotanti = [];
 if (!datiOrg.tavoliPerEvento || typeof datiOrg.tavoliPerEvento !== "object") datiOrg.tavoliPerEvento = {};
 } else {
 ORG_LAZY.tavoli = true;
 ORG_LAZY.anagrafiche = true;
 }
 if (Array.isArray(res.fasceEta)) {
 applyFasceEtaConfig(res.fasceEta);
 }
 ORG_SISTEMI_GIOCO = Array.isArray(res.sistemiGioco) ? res.sistemiGioco : [];
 if (!ORG_SISTEMI_GIOCO.length && typeof google !== "undefined" && google.script && google.script.run) {
 google.script.run
 .withSuccessHandler(list => {
 ORG_SISTEMI_GIOCO = Array.isArray(list) ? list : [];
 })
 .withFailureHandler(() => {})
 .getSistemiGiocoConfig();
 }
 if (datiOrg.eventiConSessioni) sortEventiPerDataEOra(datiOrg.eventiConSessioni);
 renderOrgDash();
 setOrgDashboardHeader(true);
 show("org-main");
 if (res.revision != null) noteLiveRevision(res.revision);
 startLiveSync("org");
 aggiornaStatoTriggerSchedulati();
 aggiornaStatoMailOrg();
 })
 .withFailureHandler(err => {
 hide("loader"); show("org-main");
 segnalaErroreOrgClient("getDatiOrganizzatore", null, "Chiamata getDatiOrganizzatore fallita (connessione/eccezione).", err.message || String(err));
 flash("org-fa","Operazione non riuscita. Riprova o controlla la connessione.","err");
 })
 .getDatiOrganizzatore(sc);
}

/** Aggiorna solo la panoramica (prenotazioni, eventi, health, fasce…) senza toccare tavoli/anagrafiche già in memoria. */
function mergeOrgStatsIntoDatiOrg(res) {
 if (!res || !datiOrg) return;
 if (Array.isArray(res.prenotazioni)) datiOrg.prenotazioni = res.prenotazioni;
 if (Array.isArray(res.eventi)) datiOrg.eventi = res.eventi;
 if (res.eventiConSessioni) datiOrg.eventiConSessioni = res.eventiConSessioni;
 if (res.eventiPerGestione) datiOrg.eventiPerGestione = res.eventiPerGestione;
 if (res.healthCheckFogliUltimo !== undefined) datiOrg.healthCheckFogliUltimo = res.healthCheckFogliUltimo;
 if (Array.isArray(res.fasceEta)) datiOrg.fasceEta = res.fasceEta;
 if (Array.isArray(res.sistemiGioco)) datiOrg.sistemiGioco = res.sistemiGioco;
 if (datiOrg.eventiConSessioni) sortEventiPerDataEOra(datiOrg.eventiConSessioni);
}

function ensureOrgStatsData() {
 if (!datiOrg) return;
 beginActionOverlay("Aggiornamento dati…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res && res.errore ? res.errore : "Aggiornamento non riuscito."), "err");
 return;
 }
 mergeOrgStatsIntoDatiOrg(res);
 if (res.revision != null) noteLiveRevision(res.revision);
 if (Array.isArray(res.fasceEta)) {
 applyFasceEtaConfig(res.fasceEta);
 }
 ORG_SISTEMI_GIOCO = Array.isArray(res.sistemiGioco) ? res.sistemiGioco : ORG_SISTEMI_GIOCO;
 if (!ORG_SISTEMI_GIOCO.length && typeof google !== "undefined" && google.script && google.script.run) {
 google.script.run
 .withSuccessHandler(list => {
 ORG_SISTEMI_GIOCO = Array.isArray(list) ? list : [];
 })
 .withFailureHandler(() => {})
 .getSistemiGiocoConfig();
 }
 renderOrgDash();
 const logPanel = document.getElementById("t-log");
 if (logPanel && logPanel.classList.contains("active") && typeof renderLogAzioni === "function") renderLogAzioni();
 const mailPanel = document.getElementById("t-mail");
 if (mailPanel && mailPanel.classList.contains("active")) aggiornaStatoMailOrg();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 segnalaErroreOrgClient("getDatiOrganizzatore:stats", null, "Refresh stats organizzatore.", err.message || String(err));
 flash("org-fa", "Aggiornamento non riuscito.", "err");
 })
 .getDatiOrganizzatore("stats");
}

function ensureOrgTavoliData() {
 if (!datiOrg) return;
 beginActionOverlay("Aggiornamento tavoli e capacità…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res && res.errore ? res.errore : "Caricamento tavoli non riuscito."), "err");
 return;
 }
 datiOrg.tavoliPerEvento = res.tavoliPerEvento || {};
 ORG_LAZY.tavoli = true;
 if (res.revision != null) noteLiveRevision(res.revision);
 renderEventiList();
 renderMappaEventi();
 const te = document.getElementById("tav-ev");
 if (te) renderTavoli();
 ripristinaVistaMappaSelezionata();
 if (typeof _renderMappaActionPanel === "function") _renderMappaActionPanel();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 segnalaErroreOrgClient("getDatiOrganizzatore:eventi", null, "Slice tavoli organizzatore.", err.message || String(err));
 flash("org-fa", "Caricamento tavoli non riuscito.", "err");
 })
 .getDatiOrganizzatore("eventi");
}

function ensureOrgAnagraficheData(opts) {
 if (!datiOrg) return;
 const silent = !!(opts && opts.silent);
 if (ORG_LAZY.anagrafiche && Array.isArray(datiOrg.utenti) && datiOrg.utenti.length) {
 if (!silent) {
 renderUtentiOrg();
 renderPartecipantiOrg();
 renderMastersOrg();
 } else {
 // Aggiorna badge "prima volta" se siamo sulla mappa
 ripristinaVistaMappaSelezionata();
 }
 return;
 }
 if (!silent) beginActionOverlay("Aggiornamento anagrafiche…");
 google.script.run
 .withSuccessHandler(res => {
 if (!silent) endActionOverlay();
 if (!res || !res.ok) {
 if (!silent) flash("org-fa", "⚠️ " + (res && res.errore ? res.errore : "Caricamento anagrafiche non riuscito."), "err");
 return;
 }
 datiOrg.utenti = res.utenti || [];
 datiOrg.masters = res.masters || [];
 datiOrg.partecipantiNonPrenotanti = res.partecipantiNonPrenotanti || [];
 ORG_LAZY.anagrafiche = true;
 if (res.revision != null) noteLiveRevision(res.revision);
 renderUtentiOrg();
 renderPartecipantiOrg();
 renderMastersOrg();
 ripristinaVistaMappaSelezionata();
 })
 .withFailureHandler(err => {
 if (!silent) endActionOverlay();
 segnalaErroreOrgClient("getDatiOrganizzatore:anagrafiche", null, "Slice anagrafiche organizzatore.", err.message || String(err));
 if (!silent) flash("org-fa", "Caricamento anagrafiche non riuscito.", "err");
 })
 .getDatiOrganizzatore("anagrafiche");
}

function noteLiveRevision(rev) {
 if (rev == null || rev === "") return;
 LIVE_SYNC.rev = String(rev);
}

function stopLiveSync() {
 if (LIVE_SYNC.timer) {
 clearInterval(LIVE_SYNC.timer);
 LIVE_SYNC.timer = null;
 }
 LIVE_SYNC.mode = null;
 LIVE_SYNC.busy = false;
 document.removeEventListener("visibilitychange", _onLiveSyncVisibility);
}

function startLiveSync(mode) {
 stopLiveSync();
 const m = String(mode || "");
 LIVE_SYNC.mode = m === "sede" ? "sede" : "org";
 document.addEventListener("visibilitychange", _onLiveSyncVisibility);
 LIVE_SYNC.timer = setInterval(pollLiveSync, LIVE_SYNC.intervalMsOrg);
 // Prima lettura subito (senza attendere il primo tick)
 setTimeout(pollLiveSync, 300);
}

function _onLiveSyncVisibility() {
 if (document.visibilityState === "visible") pollLiveSync();
}

function _liveSyncBlockedByUi() {
 if (document.visibilityState === "hidden") return true;
 if (LIVE_SYNC.busy) return true;
 const actionOv = document.getElementById("action-overlay");
 if (actionOv && !actionOv.classList.contains("hidden")) return true;
 const loader = document.getElementById("loader");
 if (loader && !loader.classList.contains("hidden")) return true;
 const sedeIsc = document.getElementById("sede-iscrivi-overlay");
 if (sedeIsc && !sedeIsc.classList.contains("hidden")) return true;
 return false;
}

function pollLiveSync() {
 if (_liveSyncBlockedByUi()) return;
 if (typeof google === "undefined" || !google.script || !google.script.run) return;
 if (LIVE_SYNC.mode === "org") {
 if (!ORG_HASH_CLIENT || !datiOrg) return;
 if (document.getElementById("org-main")?.classList.contains("hidden")) return;
 } else if (LIVE_SYNC.mode === "sede") {
 const cred = typeof _sedeCredential === "function" ? _sedeCredential() : null;
 if (!cred?.sedeId || !cred?.sessionToken || !window._sedeDati) return;
 if (document.getElementById("sede-main")?.classList.contains("hidden")) return;
 } else {
 return;
 }
 LIVE_SYNC.busy = true;
 google.script.run
 .withSuccessHandler(res => {
 LIVE_SYNC.busy = false;
 if (!res || !res.ok) return;
 const rev = String(res.revision || "0");
 if (LIVE_SYNC.rev == null) {
 LIVE_SYNC.rev = rev;
 return;
 }
 if (rev === LIVE_SYNC.rev) return;
 LIVE_SYNC.rev = rev;
 if (LIVE_SYNC.mode === "org") refreshOrgLiveSilent();
 else if (LIVE_SYNC.mode === "sede") refreshSedeLiveSilent();
 })
 .withFailureHandler(() => { LIVE_SYNC.busy = false; })
 .getDatiRevision();
}

function _flashLiveUpdate(targetId) {
 const now = Date.now();
 if (now - (LIVE_SYNC.lastFlashAt || 0) < 8000) return;
 LIVE_SYNC.lastFlashAt = now;
 flash(targetId, "↻ Aggiornato in tempo reale", "info");
}

/** Refresh silenzioso dashboard org (senza loader a schermo intero). */
function refreshOrgLiveSilent() {
 if (!datiOrg || !ORG_HASH_CLIENT) return;
 if (_liveSyncBlockedByUi()) return;
 LIVE_SYNC.busy = true;
 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok || !datiOrg) {
 LIVE_SYNC.busy = false;
 return;
 }
 mergeOrgStatsIntoDatiOrg(res);
 if (res.revision != null) noteLiveRevision(res.revision);
 const needTavoli = !!ORG_LAZY.tavoli;
 const needAna = !!ORG_LAZY.anagrafiche;
 const afterSlices = () => {
 LIVE_SYNC.busy = false;
 try {
 renderOrgDash();
 if (needTavoli) {
 renderEventiList();
 renderMappaEventi();
 const te = document.getElementById("tav-ev");
 if (te) renderTavoli();
 }
 if (needAna) {
 renderUtentiOrg();
 renderPartecipantiOrg();
 renderMastersOrg();
 }
 const logPanel = document.getElementById("t-log");
 if (logPanel && logPanel.classList.contains("active") && typeof renderLogAzioni === "function") {
 renderLogAzioni();
 }
 if (mappaEvSelezionato && typeof refreshMappaContesto === "function") {
 refreshMappaContesto(true);
 }
 _flashLiveUpdate("org-fa");
 } catch (_e) {}
 };
 let pending = (needTavoli ? 1 : 0) + (needAna ? 1 : 0);
 if (!pending) {
 afterSlices();
 return;
 }
 const doneOne = () => {
 pending -= 1;
 if (pending <= 0) afterSlices();
 };
 if (needTavoli) {
 google.script.run
 .withSuccessHandler(r2 => {
 if (r2 && r2.ok && datiOrg) {
 datiOrg.tavoliPerEvento = r2.tavoliPerEvento || {};
 if (r2.revision != null) noteLiveRevision(r2.revision);
 }
 doneOne();
 })
 .withFailureHandler(doneOne)
 .getDatiOrganizzatore("eventi");
 }
 if (needAna) {
 google.script.run
 .withSuccessHandler(r3 => {
 if (r3 && r3.ok && datiOrg) {
 datiOrg.utenti = r3.utenti || [];
 datiOrg.masters = r3.masters || [];
 datiOrg.partecipantiNonPrenotanti = r3.partecipantiNonPrenotanti || [];
 if (r3.revision != null) noteLiveRevision(r3.revision);
 }
 doneOne();
 })
 .withFailureHandler(doneOne)
 .getDatiOrganizzatore("anagrafiche");
 }
 })
 .withFailureHandler(() => { LIVE_SYNC.busy = false; })
 .getDatiOrganizzatore("stats");
}

/** Refresh silenzioso area co-organizzatore. */
function refreshSedeLiveSilent() {
 const cred = typeof _sedeCredential === "function" ? _sedeCredential() : null;
 if (!cred?.sedeId || !cred?.sessionToken || !window._sedeDati) return;
 if (document.getElementById("sede-main")?.classList.contains("hidden")) return;
 if (_liveSyncBlockedByUi()) return;
 LIVE_SYNC.busy = true;
 google.script.run
 .withSuccessHandler(res => {
 LIVE_SYNC.busy = false;
 if (!res || !res.ok) return;
 try {
 if (res.revision != null) noteLiveRevision(res.revision);
 _applicaDatiSedeArea(res, { keepSelection: true });
 _flashLiveUpdate("sede-fa");
 } catch (_e) {}
 })
 .withFailureHandler(() => { LIVE_SYNC.busy = false; })
 .getDatiSedeArea(cred);
}

function renderOrgDash() {
 const { prenotazioni, eventi } = datiOrg;
 ORG_UTENTI_INDEX = buildOrgUtentiIndex(prenotazioni || []);
 const totRegistrati = Object.keys(ORG_UTENTI_INDEX || {}).length;
 const totUtentiUnici = contaUtentiUniciConPartecipanti(prenotazioni || []);
 const totP = prenotazioni.length;
 const totAtt = prenotazioni.filter(p => p.isListaAttesa).length;
 const evTot = eventi.length;
 const evPass = eventi.filter(e => isDataPassata(e.data)).length;
 const evFut = Math.max(evTot - evPass, 0);

 const hc = datiOrg.healthCheckFogliUltimo || null;
 const hcWhen = hc?.eseguitoAlle || "—";
 const hcMismatch = hc && typeof hc.mismatchCount === "number" ? hc.mismatchCount : "—";
 const hcAnomalie = hc && typeof hc.anomalieCount === "number" ? hc.anomalieCount : "—";

 document.getElementById("org-stats").innerHTML = [
 {n:totUtentiUnici, l:"PARTECIPANTI", s:`utenti registrati: ${totRegistrati}`},
 {n:evFut, l:"Eventi da fare", s:evPass ? `${evPass} già svolti` : "nessun evento passato"},
 {n:evPass, l:"Eventi passati", s:evTot ? `su ${evTot} eventi totali` : "nessun evento configurato"},
 {n:totP, l:"Prenotazioni", s:totAtt ? `${totAtt} in lista d'attesa` : "0 in lista d'attesa"},
 ].map((x,i) => `
 <div class="stat-c" style="animation-delay:${i*.07}s">
 <div class="stat-n">${x.n}</div>
 <div class="stat-l">${x.l}</div>
 <div class="stat-s">${x.s}</div>
 </div>`).join("");

 const hcStatsEl = document.getElementById("org-hc-stats");
 if (hcStatsEl) {
 const hcReportInviato = hc ? (hc.reportInviato ? "Report inviato" : "Report non inviato") : "—";
 hcStatsEl.innerHTML = [
 { n: hcMismatch, l: "Mismatch occupati", s: "Tavoli.occupati vs Risposte" },
 { n: hcAnomalie, l: "Prenotazioni anomale", s: "Righe con dati strani / mancanti", id: "org-hc-anomalie-n" },
 { n: "⏱", l: "Ultima esecuzione", s: `${hcWhen} · ${hcReportInviato}` }
 ].map((x, i) => `
 <div class="stat-c" style="animation-delay:${i*.07}s">
 <div class="stat-n"${x.id ? ` id="${x.id}"` : ""}>${x.n}</div>
 <div class="stat-l">${x.l}</div>
 <div class="stat-s">${x.s}</div>
 </div>
 `).join("");
 }

 const hcMeta = document.getElementById("org-hc-meta");
 if (hcMeta) {
 if (!hc) hcMeta.textContent = "Health check: nessuna esecuzione registrata (Setup/Job non eseguito).";
 else hcMeta.textContent = `Ultima esecuzione: ${hcWhen}`;
 }

 const sf = document.getElementById("f-evento");
 const te = document.getElementById("tav-ev");
 const fe = document.getElementById("fasce-ev");
 sf.innerHTML = `<option value="">— Tutti gli eventi —</option>`;
 if (te) { te.innerHTML = ""; }
 fe.innerHTML = `<option value="">— Tutti gli eventi —</option>`;
 eventi.forEach(e => {
 [sf,fe].forEach(s => {
 if (s) s.insertAdjacentHTML("beforeend",`<option value="${e.eventId}">${e.nome}</option>`);
 });
 if (te) te.insertAdjacentHTML("beforeend",`<option value="${e.eventId}">${e.nome}</option>`);
 });
 if (te) aggiornaSessTav();
 renderTabella();
 renderFasce();
 renderGestioneFasceEtaOrg();
 if (ORG_LAZY.tavoli) {
 if (te) renderTavoli();
 renderEventiList();
 renderMappaEventi();
 ripristinaVistaMappaSelezionata();
 }
 renderUtentiOrg();
 if (ORG_LAZY.anagrafiche) {
 renderPartecipantiOrg();
 renderMastersOrg();
 } else {
 const mt = document.getElementById("org-masters-tbody");
 const mc = document.getElementById("masters-cnt");
 if (mt) {
 mt.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">⏳</span>Apri la scheda <strong>Anagrafiche</strong> per caricare l’elenco master (una tantum per sessione).</div></td></tr>`;
 }
 if (mc) mc.textContent = "";
 }
}

function renderGestioneFasceEtaOrg() {
 const listEl = document.getElementById("org-fasce-eta-list");
 if (!listEl) return;
 const list = Array.isArray(datiOrg?.fasceEta) && datiOrg.fasceEta.length
 ? datiOrg.fasceEta
 : (Array.isArray(FASCE_ETA) ? FASCE_ETA : []);
 if (!list.length) {
 listEl.innerHTML = `<span style="font-size:12px;color:var(--ash);font-style:italic">Nessuna fascia età configurata.</span>`;
 return;
 }
 listEl.innerHTML = normalizeFasceEtaList(list).map(f =>
 `<span class="badge b-ok" title="${escapeHtml(f.id)}">${escapeHtml(f.label)}</span>`
 ).join("");
}

function aggiungiFasciaEtaOrg() {
 const inp = document.getElementById("org-fasce-eta-input");
 const val = String(inp?.value || "").trim();
 if (!val) {
 flash("org-fa", "Inserisci una fascia età valida.", "err");
 return;
 }
 beginActionOverlay("Salvataggio fascia età…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 if (!datiOrg) datiOrg = {};
 if (Array.isArray(res.fasceEta)) {
 datiOrg.fasceEta = res.fasceEta.slice();
 applyFasceEtaConfig(res.fasceEta);
 }
 if (inp) inp.value = "";
 renderGestioneFasceEtaOrg();
 flash("org-fa", "✅ " + (res.messaggio || "Fascia età salvata."), "ok");
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Errore salvataggio fascia età."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .aggiungiFasciaEtaConfig(val);
}

function buildOrgUtentiIndex(prenotazioni) {
 const byKey = {};
 (prenotazioni || []).forEach(p => {
 const nome = String(p?.nome || "").trim();
 const email = String(p?.email || "").trim().toLowerCase();
 const cellulare = String(p?.cellulare || "").trim();
 if (!nome && !email) return;
 const key = email || ("nome:" + nome.toLowerCase());
 if (!byKey[key]) byKey[key] = { nome, email, cellulare };
 if (!byKey[key].nome && nome) byKey[key].nome = nome;
 if (!byKey[key].email && email) byKey[key].email = email;
 if (!byKey[key].cellulare && cellulare) byKey[key].cellulare = cellulare;
 });
 return byKey;
}

function contaUtentiUniciConPartecipanti(prenotazioni) {
 const seen = {};
 const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
 const addPersona = (nome, email) => {
 const em = String(email || "").trim().toLowerCase();
 const nm = norm(nome);
 if (!em && !nm) return;
 const key = em && em.indexOf("@") > 0 ? ("email:" + em) : ("nome:" + nm);
 seen[key] = true;
 };

 (prenotazioni || []).forEach(p => {
 addPersona(p?.nome, p?.email);
 const arr = Array.isArray(p?.partecipanti) ? p.partecipanti : [];
 arr.forEach(x => addPersona(x?.nome, x?.email));
 });

 return Object.keys(seen).length;
}

function popolaUtentiIscrizioneManuale() {
 const listEl = document.getElementById("org-manual-user-list");
 const searchEl = document.getElementById("org-manual-user-search");
 if (!listEl || !searchEl) return;
 listEl.innerHTML = "";
 searchEl.value = "";
 const entries = Object.values(ORG_UTENTI_INDEX || {});
 const seen = {};
 entries.forEach(u => {
 const nome = String(u?.nome || "").trim();
 const email = String(u?.email || "").trim().toLowerCase();
 const cellulare = String(u?.cellulare || "").trim();
 const value = [nome, email].filter(Boolean).join(" — ");
 if (!value || seen[value]) return;
 seen[value] = true;
 const opt = document.createElement("option");
 opt.value = value;
 opt.dataset.nome = nome;
 opt.dataset.email = email;
 opt.dataset.cellulare = cellulare;
 listEl.appendChild(opt);
 });
}

function onSelectUtenteIscrizioneManuale() {
 const searchEl = document.getElementById("org-manual-user-search");
 if (!searchEl) return;
 const val = String(searchEl.value || "").trim();
 if (!val) return;
 const listEl = document.getElementById("org-manual-user-list");
 const opts = Array.from(listEl?.options || []);
 const hit = opts.find(o => String(o.value || "").trim().toLowerCase() === val.toLowerCase());
 if (!hit) return;
 const nome = String(hit.dataset.nome || "").trim();
 const email = String(hit.dataset.email || "").trim();
 const cellulare = String(hit.dataset.cellulare || "").trim();
 if (nome) document.getElementById("org-manual-nome").value = nome;
 if (email) document.getElementById("org-manual-email").value = email;
 if (cellulare) document.getElementById("org-manual-cell").value = cellulare;
}

function ripristinaVistaMappaSelezionata() {
 if (!datiOrg || !mappaEvSelezionato) return;
 const ev = (datiOrg.eventiConSessioni || []).find(e => e.eventId === mappaEvSelezionato);
 if (!ev) {
 mappaEvSelezionato = null;
 mappaSessSelezionata = null;
 return;
 }

 // Ricostruisce sempre la vista evento aperto usando i dati appena ricaricati.
 const sessPreferita = mappaSessSelezionata;
 apriMappaEvento(mappaEvSelezionato);
 if (!sessPreferita) return;

 const sessioni = (ev.sessioni || []).slice().sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 const sess = sessioni.find(s => String(s.sessioneId) === String(sessPreferita));
 if (!sess) return;

 const tabs = Array.from(document.querySelectorAll("#mappa-sess-tabs .mappa-sess-btn"));
 const idxSess = sessioni.findIndex(s => String(s.sessioneId) === String(sess.sessioneId));
 const btn = (idxSess >= 0 && tabs[idxSess]) ? tabs[idxSess] : null;
 if (btn) {
 selezionaMappaSess(mappaEvSelezionato, sess.sessioneId, sess.nome || sess.sessioneId, btn);
 } else {
 // Fallback: aggiorna comunque i dati della sessione selezionata.
 mappaSessSelezionata = sess.sessioneId;
 renderMappaTavoli(mappaEvSelezionato, sess.sessioneId, sess.nome || sess.sessioneId);
 }
}

function renderUtentiOrg() {
 if (!datiOrg) return;
 const tbody = document.getElementById("org-utenti-tbody");
 const cntEl = document.getElementById("utenti-cnt");
 const detEl = document.getElementById("org-utenti-detail");
 if (!tbody) return;

 const qEl = document.getElementById("f-utenti");
 const q = qEl ? qEl.value.toLowerCase().trim() : "";

 const map = new Map();
 const keyFor = (u) => {
 const email = String(u?.email || "").trim().toLowerCase();
 const uuid = String(u?.uuid || "").trim().toLowerCase();
 const cell = String(u?.cellulare || "").trim();
 const nome = String(u?.nome || "").trim().toLowerCase();
 return email || uuid || cell || ("nome:" + nome);
 };

 // Base: foglio Utenti (include anche utenti inseriti manualmente)
 (datiOrg.utenti || []).forEach(u => {
 const key = keyFor(u);
 if (!key) return;
 map.set(key, {
 uuid: String(u.uuid || "").trim(),
 nome: u.nome || "",
 email: u.email || "",
 cellulare: u.cellulare || "",
 prenotazioni: 0,
 eventi: new Set(),
 _fallbackPren: parseInt(u.totPrenotazioni || 0, 10) || 0,
 _fallbackEventi: parseInt(u.eventiDiversi || 0, 10) || 0
 });
 });

 // Enrich: dati reali da prenotazioni (eventi e conteggi vivi)
 (datiOrg.prenotazioni || []).forEach(p => {
 const key = keyFor(p);
 if (!key) return;
 let u = map.get(key);
 if (!u) {
 u = {
 uuid: (p.uuid || "").trim(),
 nome: p.nome || "",
 email: p.email || "",
 cellulare: p.cellulare || "",
 prenotazioni: 0,
 eventi: new Set()
 };
 map.set(key, u);
 }
 u.prenotazioni += 1;
 if (p.eventNome || p.eventId) u.eventi.add(p.eventNome || p.eventId);
 });

 let list = Array.from(map.values());
 list = list.map(u => {
 if ((u.prenotazioni || 0) > 0) return u;
 if (u._fallbackPren || u._fallbackEventi) {
 u.prenotazioni = u._fallbackPren || 0;
 if (u.eventi.size === 0 && u._fallbackEventi > 0) {
 for (let i = 0; i < u._fallbackEventi; i++) u.eventi.add("cfg_" + i);
 }
 }
 return u;
 });
 if (q) {
 list = list.filter(u =>
 (u.nome || "").toLowerCase().includes(q) ||
 (u.email || "").toLowerCase().includes(q) ||
 (u.cellulare || "").toLowerCase().includes(q)
 );
 }

 list.sort((a,b) => (a.nome || a.email || "").localeCompare(b.nome || b.email || ""));

 if (cntEl) {
 const tot = list.length;
 cntEl.textContent = `${tot} utent${tot===1?"e":"i"} unici`;
 }

 if (!list.length) {
 tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">👤</span>Nessun utente trovato per questi filtri.</div></td></tr>`;
 if (detEl) detEl.innerHTML = "";
 return;
 }

 function highlight(text) {
 const raw = String(text || "").trim();
 if (!raw) return `<span class="td-muted">—</span>`;
 if (!q) return escapeHtml(raw);
 const s = raw;
 const idx = s.toLowerCase().indexOf(q);
 if (idx === -1) return escapeHtml(s);
 return escapeHtml(s.slice(0, idx)) + "<mark>" + escapeHtml(s.slice(idx, idx + q.length)) + "</mark>" + escapeHtml(s.slice(idx + q.length));
 }

 tbody.innerHTML = list.map(u => {
 const uuid = String(u.uuid || "").replace(/'/g, "\\'");
 return `<tr>
 <td><div class="td-n">${highlight(u.nome)}</div></td>
 <td><div class="td-l">${highlight(u.email)}</div></td>
 <td class="org-col-optional"><div class="td-l">${highlight(u.cellulare)}</div></td>
 <td class="td-num"><span class="td-num-pill">${u.prenotazioni || 0}</span></td>
 <td class="td-num"><span class="td-num-pill">${u.eventi.size || 0}</span></td>
 <td class="td-actions">
 <div class="td-actions-row">
 <button type="button" class="btn btn-o btn-xs" onclick="renderUtenteOrgDettaglio('${uuid}')">Dettagli</button>
 ${uuid ? `<button type="button" class="btn btn-s btn-xs" onclick="loginAsUtente('${uuid}')">Login as</button>` : ""}
 </div>
 </td>
 </tr>`;
 }).join("");
}

function renderPartecipantiOrg() {
 if (!datiOrg) return;
 const tbody = document.getElementById("org-partecipanti-tbody");
 const cntEl = document.getElementById("partecipanti-cnt");
 if (!tbody) return;

 const qEl = document.getElementById("f-partecipanti");
 const q = qEl ? qEl.value.toLowerCase().trim() : "";
 let list = Array.isArray(datiOrg.partecipantiNonPrenotanti) ? datiOrg.partecipantiNonPrenotanti.slice() : [];

 if (q) {
 list = list.filter(p =>
 (p.nome || "").toLowerCase().includes(q) ||
 (p.nomeCompleto || "").toLowerCase().includes(q) ||
 (p.email || "").toLowerCase().includes(q)
 );
 }

 list.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

 if (cntEl) {
 const tot = list.length;
 cntEl.textContent = `${tot} partecipant${tot === 1 ? "e" : "i"} (non prenotanti)`;
 }

 if (!list.length) {
 tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🎯</span>Nessun partecipante trovato. Compaiono qui quando un prenotante indica altri giocatori al tavolo.</div></td></tr>`;
 return;
 }

 function highlight(text) {
 if (!q) return escapeHtml(String(text || "–"));
 const s = String(text || "");
 const idx = s.toLowerCase().indexOf(q);
 if (idx === -1) return escapeHtml(s || "–");
 return escapeHtml(s.slice(0, idx)) + "<mark>" + escapeHtml(s.slice(idx, idx + q.length)) + "</mark>" + escapeHtml(s.slice(idx + q.length));
 }

 function statoLabel(stati) {
 const s = stati || {};
 const parts = [];
 if (s.accepted) parts.push(`✅ ${s.accepted}`);
 if (s.pending) parts.push(`⏳ ${s.pending}`);
 if (s.altro) parts.push(`· ${s.altro}`);
 return parts.length ? parts.join(" ") : "—";
 }

 tbody.innerHTML = list.map(p => {
 const uuid = String(p.participantUuid || "").replace(/'/g, "\\'");
 const emailLine = p.email
 ? highlight(p.email)
 : `<span style="color:var(--ash);font-style:italic">Nessuna email</span>`;
 const accountBadge = p.haAccount
 ? `<span class="tipo-badge t-gdt" style="margin-left:6px" title="Ha account collegato">Account</span>`
 : `<span class="tipo-badge" style="margin-left:6px;opacity:.75" title="Solo elenco, senza invito digitale">Solo nome</span>`;
 const evShort = String(p.eventiLabel || "").length > 48
 ? escapeHtml(String(p.eventiLabel).slice(0, 45) + "…")
 : escapeHtml(String(p.eventiLabel || "–"));
 return `<tr>
 <td><div class="td-n">${highlight(p.nome)}${accountBadge}</div></td>
 <td><div class="td-l">${emailLine}</div></td>
 <td class="td-num"><span class="td-num-pill">${p.partecipazioni || 0}</span></td>
 <td class="td-num"><span class="td-num-pill">${p.prenotazioniDistinte || 0}</span></td>
 <td><div class="td-l" title="${escapeHtml(String(p.eventiLabel || ""))}">${evShort}</div></td>
 <td class="org-col-optional"><div class="td-l">${statoLabel(p.stati)}</div></td>
 <td class="td-actions">
 <div class="td-actions-row">
 ${p.participantUuid ? `<button type="button" class="btn btn-s btn-xs" onclick="loginAsUtente('${uuid}')">Login as</button>` : `<span class="td-muted">—</span>`}
 </div>
 </td>
 </tr>`;
 }).join("");
}

function renderMastersOrg() {
 if (!datiOrg) return;
 const tbody = document.getElementById("org-masters-tbody");
 const cntEl = document.getElementById("masters-cnt");
 if (!tbody) return;
 const qEl = document.getElementById("f-masters");
 const q = qEl ? String(qEl.value || "").toLowerCase().trim() : "";
 let list = Array.isArray(datiOrg.masters) ? datiOrg.masters.slice() : [];
 if (q) {
 list = list.filter(m =>
 String(m.nome || "").toLowerCase().includes(q) ||
 String(m.nick || "").toLowerCase().includes(q) ||
 String(m.email || "").toLowerCase().includes(q) ||
 String(m.cellulare || "").toLowerCase().includes(q)
 );
 }
 list.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "it"));
 if (cntEl) {
 const tot = list.length;
 cntEl.textContent = `${tot} master`;
 }
 if (!list.length) {
 tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">🧙</span>Nessun master trovato per questi filtri.</div></td></tr>`;
 return;
 }
 tbody.innerHTML = list.map(m => `
 <tr>
 <td><div class="td-n">${escapeHtml(m.nome || "—")}</div></td>
 <td><div class="td-l">${escapeHtml(m.nick || m.nome || "—")}</div></td>
 <td><div class="td-l">${m.email ? escapeHtml(m.email) : `<span class="td-muted">—</span>`}</div></td>
 <td class="org-col-optional"><div class="td-l">${m.cellulare ? escapeHtml(m.cellulare) : `<span class="td-muted">—</span>`}</div></td>
 <td class="td-num"><span class="td-num-pill">${parseInt(m.totTavoli || 0, 10) || 0}</span></td>
 <td class="td-num"><span class="td-num-pill">${parseInt(m.eventiDiversi || 0, 10) || 0}</span></td>
 <td class="td-num org-col-optional"><span class="td-num-pill">${parseInt(m.sessioniDiverse || 0, 10) || 0}</span></td>
 <td class="td-actions">
 <div class="td-actions-row">
 ${String(m.masterId || "").trim()
 ? `<button type="button" class="btn btn-o btn-xs" onclick='orgMostraLinkMaster(${JSON.stringify(String(m.masterId).trim())})' title="Mostra link area master">🔗 Link</button>`
 : `<span class="td-muted">—</span>`}
 </div>
 </td>
 </tr>
 `).join("");
}

function orgAggiungiUtenteForm() {
 const nomeEl = document.getElementById("org-utente-nome");
 const emailEl = document.getElementById("org-utente-email");
 const cellEl = document.getElementById("org-utente-cell");
 const nome = String(nomeEl?.value || "").trim();
 const email = String(emailEl?.value || "").trim();
 const cellulare = String(cellEl?.value || "").trim();
 if (!nome) {
 flash("org-fa", "Inserisci il nome utente.", "err");
 return;
 }
 if (!email && !cellulare) {
 flash("org-fa", "Inserisci almeno email o cellulare.", "err");
 return;
 }

 beginActionOverlay("Salvataggio utente…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 if (nomeEl) nomeEl.value = "";
 if (emailEl) emailEl.value = "";
 if (cellEl) cellEl.value = "";
 toggleOrgDisclose("org-utente-form", false);
 flash("org-fa", "✅ " + (res.messaggio || "Utente salvato."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Impossibile salvare utente."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgAggiungiUtente({ nome, email, cellulare });
}

function orgAggiungiMasterForm() {
 const nomeEl = document.getElementById("org-master-nome");
 const nickEl = document.getElementById("org-master-nick");
 const emailEl = document.getElementById("org-master-email");
 const cellEl = document.getElementById("org-master-cell");
 const nome = String(nomeEl?.value || "").trim();
 const nick = String(nickEl?.value || "").trim();
 const email = String(emailEl?.value || "").trim();
 const cellulare = String(cellEl?.value || "").trim();
 if (!nome) {
 flash("org-fa", "Inserisci il nome master.", "err");
 return;
 }
 if (!nick) {
 flash("org-fa", "Inserisci il nick del master.", "err");
 return;
 }
 if (!email && !cellulare) {
 flash("org-fa", "Inserisci almeno email o cellulare per il master.", "err");
 return;
 }

 beginActionOverlay("Salvataggio master…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 if (nomeEl) nomeEl.value = "";
 if (nickEl) nickEl.value = "";
 if (emailEl) emailEl.value = "";
 if (cellEl) cellEl.value = "";
 toggleOrgDisclose("org-master-form", false);
 flash("org-fa", "✅ " + (res.messaggio || "Master salvato."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Impossibile salvare master."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgAggiungiMaster({ nome, nick, email, cellulare });
}

function _buildUrlAreaSede(sedeId) {
 const base = String(WEBAPP_URL_SEDE || "").trim() || String(WEBAPP_URL_UTENTE || "").replace(/utente\/?$/i, "partner/");
 const id = String(sedeId || "").trim();
 if (!base || !id) return "";
 const sep = base.indexOf("?") >= 0 ? "&" : "?";
 return base + sep + "uuid=" + encodeURIComponent(id);
}

function orgMostraLinkSede(sedeId) {
 const url = _buildUrlAreaSede(sedeId);
 if (!url) {
 flash("org-fa", "Link co-organizzatore non disponibile.", "err");
 return;
 }
 const msg = "Link area co-organizzatore:\n\n" + url;
 if (navigator.clipboard && navigator.clipboard.writeText) {
 navigator.clipboard.writeText(url).then(() => {
 flash("org-fa", "✅ Link co-organizzatore copiato negli appunti.", "ok");
 }).catch(() => alert(msg));
 } else {
 alert(msg);
 }
}

function orgResetSedeForm() {
 const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? "" : String(v); };
 set("org-sede-id", "");
 set("org-sede-nome", "");
 set("org-sede-indirizzo", "");
 set("org-sede-referente", "");
 set("org-sede-email", "");
 set("org-sede-cell", "");
 set("org-sede-note", "");
 const att = document.getElementById("org-sede-attivo");
 if (att) att.checked = true;
 const cc = document.getElementById("org-sede-cc-email");
 if (cc) cc.checked = false;
 const title = document.getElementById("org-sede-form-title");
 if (title) title.textContent = "Nuovo co-organizzatore";
}

function orgNuovaSedeForm() {
 orgResetSedeForm();
 toggleOrgDisclose("org-sede-form", true);
}

function orgModificaSedeForm(sedeId) {
 const id = String(sedeId || "").trim().toLowerCase();
 const s = (datiOrg?.sedi || []).find(x => String(x.sedeId || "").toLowerCase() === id);
 if (!s) {
 flash("org-fa", "Co-organizzatore non trovato.", "err");
 return;
 }
 const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v == null ? "" : String(v); };
 set("org-sede-id", s.sedeId || "");
 set("org-sede-nome", s.nomeSede || "");
 set("org-sede-indirizzo", s.indirizzo || "");
 set("org-sede-referente", s.referente || "");
 set("org-sede-email", s.email || "");
 set("org-sede-cell", s.cellulare || "");
 set("org-sede-note", s.note || "");
 const att = document.getElementById("org-sede-attivo");
 if (att) att.checked = s.attivo !== false;
 const cc = document.getElementById("org-sede-cc-email");
 if (cc) cc.checked = !!s.ccEmailPrenotazioni;
 const title = document.getElementById("org-sede-form-title");
 if (title) title.textContent = "Modifica co-organizzatore";
 toggleOrgDisclose("org-sede-form", true);
}

function orgToggleSedeAttiva(sedeId, attivo) {
 const id = String(sedeId || "").trim();
 if (!id) return;
 beginActionOverlay(attivo ? "Riattivazione…" : "Disattivazione…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 flash("org-fa", "✅ " + (res.messaggio || "Aggiornato."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Operazione non riuscita."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgImpostaAttivoSede(id, !!attivo);
}

function renderSediOrg() {
 if (!datiOrg) return;
 const tbody = document.getElementById("org-sedi-tbody");
 const cntEl = document.getElementById("sedi-cnt");
 if (!tbody) return;
 const qEl = document.getElementById("f-sedi");
 const q = qEl ? String(qEl.value || "").toLowerCase().trim() : "";
 let list = Array.isArray(datiOrg.sedi) ? datiOrg.sedi.slice() : [];
 if (q) {
 list = list.filter(s =>
 String(s.nomeSede || "").toLowerCase().includes(q) ||
 String(s.referente || "").toLowerCase().includes(q) ||
 String(s.email || "").toLowerCase().includes(q) ||
 String(s.indirizzo || "").toLowerCase().includes(q)
 );
 }
 list.sort((a, b) => String(a.nomeSede || "").localeCompare(String(b.nomeSede || ""), "it"));
 if (cntEl) {
 const attive = list.filter(s => s.attivo !== false).length;
 cntEl.textContent = `${list.length} · ${attive} attivi`;
 }
 if (!list.length) {
 tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">🤝</span>Nessun co-organizzatore. Creane uno e usalo come Luogo o Co-organizzatore sugli eventi.</div></td></tr>`;
 return;
 }
 tbody.innerHTML = list.map(s => {
 const sid = String(s.sedeId || "").trim();
 const sidJs = JSON.stringify(sid);
 const attiva = s.attivo !== false;
 return `
 <tr style="${attiva ? "" : "opacity:.72"}">
 <td><div class="td-n">${escapeHtml(s.nomeSede || "—")}</div>
 <div class="td-l" style="font-size:11px;color:var(--ash)">${escapeHtml(s.indirizzo || "")}</div></td>
 <td><div class="td-l">${escapeHtml(s.referente || "—")}</div></td>
 <td><div class="td-l">${s.email ? escapeHtml(s.email) : `<span class="td-muted">—</span>`}
 ${s.hasPassword ? `<div class="td-l" style="font-size:11px;color:var(--ash)">🔑 password</div>` : ""}
 ${s.ccEmailPrenotazioni ? `<div class="td-l" style="font-size:11px;color:var(--ash)">✉ CC prenotazioni</div>` : ""}
 </div></td>
 <td class="org-col-optional"><span class="tipo-badge${attiva ? " t-gdr" : ""}">${attiva ? "Attivo" : "Off"}</span></td>
 <td class="td-actions">
 <div class="td-actions-row">
 ${sid
 ? `<button type="button" class="btn btn-o btn-xs" onclick='orgModificaSedeForm(${sidJs})' title="Modifica co-organizzatore">✏️</button>
 <button type="button" class="btn btn-o btn-xs" onclick='orgMostraLinkSede(${sidJs})' title="Copia link area co-organizzatore">🔗</button>
 <button type="button" class="btn btn-s btn-xs" onclick='orgImpostaPasswordSedePrompt(${sidJs})' title="Imposta password">🔑</button>
 <button type="button" class="btn btn-o btn-xs" onclick='orgToggleSedeAttiva(${sidJs},${attiva ? "false" : "true"})' title="${attiva ? "Disattiva" : "Riattiva"}">${attiva ? "⏸" : "▶"}</button>`
 : `<span class="td-muted">—</span>`}
 </div>
 </td>
 </tr>`;
 }).join("");
}

async function orgImpostaPasswordSedePrompt(sedeId) {
 const id = String(sedeId || "").trim();
 if (!id) return;
 const pwd = window.prompt("Nuova password per l'accesso co-organizzatore (min. 6 caratteri):", "");
 if (pwd == null) return;
 if (String(pwd).length < 6) {
 flash("org-fa", "Password troppo corta (minimo 6 caratteri).", "err");
 return;
 }
 beginActionOverlay("Salvataggio password co-organizzatore…");
 try {
 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(pwd)));
 const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) flash("org-fa", "✅ " + (res.messaggio || "Password aggiornata."), "ok");
 else flash("org-fa", "⚠️ " + (res?.errore || "Impossibile salvare password."), "err");
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgImpostaPasswordSede({ sedeId: id, passwordHash: hash });
 } catch (e) {
 endActionOverlay();
 flash("org-fa", "❌ " + (e.message || e), "err");
 }
}

function orgAggiungiSedeForm() {
 const nomeEl = document.getElementById("org-sede-nome");
 const indEl = document.getElementById("org-sede-indirizzo");
 const refEl = document.getElementById("org-sede-referente");
 const emailEl = document.getElementById("org-sede-email");
 const cellEl = document.getElementById("org-sede-cell");
 const noteEl = document.getElementById("org-sede-note");
 const idEl = document.getElementById("org-sede-id");
 const attEl = document.getElementById("org-sede-attivo");
 const ccEl = document.getElementById("org-sede-cc-email");
 const nomeSede = String(nomeEl?.value || "").trim();
 const emailSede = String(emailEl?.value || "").trim();
 const ccEmailPrenotazioni = !!(ccEl && ccEl.checked);
 if (!nomeSede) {
 flash("org-fa", "Inserisci il nome.", "err");
 return;
 }
 if (ccEmailPrenotazioni && !emailSede) {
 flash("org-fa", "Per il CC sulle email di prenotazione serve un'email.", "err");
 return;
 }
 beginActionOverlay("Salvataggio sede…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 orgResetSedeForm();
 toggleOrgDisclose("org-sede-form", false);
 flash("org-fa", "✅ " + (res.messaggio || "Co-organizzatore salvato."), "ok");
 if (res.sedeId && !res.aggiornato) orgMostraLinkSede(res.sedeId);
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Impossibile salvare."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgAggiungiSede({
 sedeId: String(idEl?.value || "").trim(),
 nomeSede,
 indirizzo: String(indEl?.value || "").trim(),
 referente: String(refEl?.value || "").trim(),
 email: emailSede,
 cellulare: String(cellEl?.value || "").trim(),
 note: String(noteEl?.value || "").trim(),
 attivo: !(attEl && !attEl.checked),
 ccEmailPrenotazioni
 });
}

function renderUtenteOrgDettaglio(uuid) {
 const detEl = document.getElementById("org-utenti-detail"); // fallback (legacy)
 const ovEl = document.getElementById("utente-detail-overlay");
 const contentEl = document.getElementById("utente-detail-content");
 if (!datiOrg) return;
 const cleanUuid = (uuid || "").trim();

 // toggle: se clicco di nuovo sullo stesso utente, chiudi il dettaglio
 if (orgDettaglioUtenteUuid && orgDettaglioUtenteUuid === cleanUuid) {
 closeUtenteDetailOverlay();
 return;
 }

 orgDettaglioUtenteUuid = cleanUuid;
 const pren = (datiOrg.prenotazioni || []).filter(p => (p.uuid || "").trim() === cleanUuid);
 if (!pren.length) {
 if (ovEl && contentEl) {
 contentEl.innerHTML = `<div class="empty-state"><span class="empty-icon">👤</span>Nessuna prenotazione trovata per questo utente.</div>`;
 show("utente-detail-overlay");
 return;
 }
 if (detEl) {
 detEl.innerHTML = `<div class="empty-state"><span class="empty-icon">👤</span>Nessuna prenotazione trovata per questo utente.</div>`;
 }
 return;
 }
 const base = pren[0];
 const eventiSet = new Set(pren.map(p => p.eventNome || p.eventId));
 const totPren = pren.length;

 const rows = pren.map(p => `
 <tr>
 <td><div class="td-n">${p.eventNome || p.eventId}</div><div class="td-l">${formatDataItaliana(p.eventData || "")}</div></td>
 <td>${p.sessione || "–"}</td>
 <td>${p.tavolo || "–"}</td>
 <td style="text-align:center;font-family:'DM Mono',monospace;font-size:12px">${p.numPersone || "–"}</td>
 <td style="font-size:12px;color:var(--smoke);font-style:italic">${labelsFasciaCsv(p.fasciaEta) || "–"}</td>
 <td>${p.isListaAttesa ? "<span class='badge b-att'>⏳</span>" : "<span class='badge b-ok'>✅</span>"}</td>
 </tr>
 `).join("");

 // Preferisci overlay: migliora l'esperienza in area organizzatore.
 if (ovEl && contentEl) {
 if (detEl) detEl.innerHTML = "";
 contentEl.innerHTML = `
 <div class="card-body" style="padding:18px 22px 20px">
 <div class="card-meta-row" style="margin-bottom:12px">
 <div><strong>Nome</strong><div>${base.nome || "–"}</div></div>
 <div><strong>Email</strong><div>${base.email || "–"}</div></div>
 <div><strong>Cellulare</strong><div>${base.cellulare || "–"}</div></div>
 <div><strong>Prenotazioni</strong><div>${totPren}</div></div>
 <div><strong>Eventi diversi</strong><div>${eventiSet.size}</div></div>
 </div>
 <div class="tbl-wrap">
 <table class="pren">
 <thead><tr>
 <th>📜 Evento</th>
 <th>🧭 Sessione</th>
 <th>🎲 Tavolo</th>
 <th>P.</th>
 <th>Fasce</th>
 <th>Stato</th>
 </tr></thead>
 <tbody>
 ${rows}
 </tbody>
 </table>
 </div>
 </div>
 `;
 show("utente-detail-overlay");
 return;
 }

 // Fallback: se per qualche ragione l'overlay non è disponibile.
 if (detEl) {
 detEl.innerHTML = `
 <div class="card" style="margin-top:10px">
 <div class="card-body">
 <div class="card-meta-row" style="margin-bottom:12px">
 <div><strong>Nome</strong><div>${base.nome || "–"}</div></div>
 <div><strong>Email</strong><div>${base.email || "–"}</div></div>
 <div><strong>Cellulare</strong><div>${base.cellulare || "–"}</div></div>
 <div><strong>Prenotazioni</strong><div>${totPren}</div></div>
 <div><strong>Eventi diversi</strong><div>${eventiSet.size}</div></div>
 </div>
 <div class="tbl-wrap">
 <table class="pren">
 <thead><tr>
 <th>📜 Evento</th>
 <th>🧭 Sessione</th>
 <th>🎲 Tavolo</th>
 <th>P.</th>
 <th>Fasce</th>
 <th>Stato</th>
 </tr></thead>
 <tbody>
 ${rows}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 `;
 }
}

function closeUtenteDetailOverlay() {
 orgDettaglioUtenteUuid = null;
 const ovEl = document.getElementById("utente-detail-overlay");
 const contentEl = document.getElementById("utente-detail-content");
 const detEl = document.getElementById("org-utenti-detail");
 const headEl = document.querySelector("#utente-detail-overlay .user-detail-head h2");
 if (headEl) headEl.textContent = "Dettagli utente";

 if (detEl) detEl.innerHTML = "";
 if (contentEl) contentEl.innerHTML = "";
 if (ovEl) hide("utente-detail-overlay");
}

function orgAssegnaDaListaAttesa(evId, sessId, idTav, uuid) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) return;
 beginActionOverlay("Assegnazione posto dalla lista d'attesa…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 flash("org-fa","✅ Posto assegnato dalla lista d'attesa.","ok");
 caricaOrg();
 } else {
 flash("org-fa","⚠️ " + (res?.errore || "Errore durante l'assegnazione."),"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa","❌ Errore: " + (err.message || err),"err");
 })
 .assegnaDaListaAttesa(evId, sessId, idTav, uuid);
}

function _orgTavoloMetaById(tavoli, tavoloIdOrRef) {
 const id = _estraiIdTavoloDaStringa(tavoloIdOrRef);
 const hit = (tavoli || []).find(t => String(t?.id || "").trim() === id);
 const nome = hit
 ? String(hit.gioco || hit.titoloAvventura || id).trim()
 : (_estraiNomeTavoloDaStringa(tavoloIdOrRef) || id || "—");
 return {
 id,
 nome,
 sistemaGioco: String(hit?.sistemaGioco || "").trim()
 };
}

function _orgLabelTavoloMoveOption(t, liberi) {
 const gioco = String(t?.gioco || t?.titoloAvventura || t?.id || "").trim() || "Tavolo";
 const sis = String(t?.sistemaGioco || "").trim();
 const libTxt = liberi <= 0 ? "pieno" : liberi === 1 ? "1 posto libero" : `${liberi} posti liberi`;
 return sis ? `${gioco} · ${sis} (${libTxt})` : `${gioco} (${libTxt})`;
}

function _orgBuildMotivoTemplateMasterAssente(metaDa, metaA) {
 const avvDa = metaDa.nome || "la tua avventura";
 const avvA = metaA.nome || "un'altra avventura";
 let testo =
 "Per problemi organizzativi il master non potra essere presente in questa sessione.\n\n" +
 `L'avventura «${avvDa}» non si terra; abbiamo spostato la tua prenotazione sull'avventura «${avvA}».`;
 const sisA = metaA.sistemaGioco || "";
 if (sisA) testo += `\n\nNuovo tavolo: stesso sistema di gioco (${sisA}).`;
 testo += "\n\nCi scusiamo per il disagio.";
 return testo.slice(0, 500);
}

function orgMoveApplicaTemplateMaster() {
 const ctx = window._orgMoveCtx;
 const noteEl = document.getElementById("org-move-motivo");
 const target = document.getElementById("org-move-target");
 if (!ctx || !noteEl || !target) return;
 const metaDa = _orgTavoloMetaById(ctx.tavoli, ctx.tavoloAttuale);
 const metaA = _orgTavoloMetaById(ctx.tavoli, target.value);
 noteEl.value = _orgBuildMotivoTemplateMasterAssente(metaDa, metaA);
 const notifyEl = document.getElementById("org-move-notify");
 if (notifyEl) notifyEl.checked = true;
}

function orgMoveOnTargetChange() {
 /* riservato per hint futuri sul tavolo selezionato */
}

function _orgJsArg(v) {
 return String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Cancella una prenotazione dalla mappa org (stesso backend dell'area utente). */
function orgCancellaPrenotazione(evId, sessId, uuid, tavoloAttuale, bookingId, nomePartecipante) {
 const u = String(uuid || "").trim();
 if (!u) {
 flash("org-fa", "Impossibile cancellare: UUID prenotazione mancante.", "err");
 return;
 }
 const nome = String(nomePartecipante || "partecipante").trim() || "partecipante";
 const labelTav = String(tavoloAttuale || "").trim();
 const msg = labelTav
 ? `Cancellare la partecipazione di ${nome} (${labelTav})?`
 : `Cancellare la partecipazione di ${nome}?`;
 chiediConferma(msg, (notificaUtente) => {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 flash("org-fa", "Ambiente non collegato al server.", "err");
 return;
 }
 beginActionOverlay("Cancellazione partecipazione…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 hide("org-move-overlay");
 flash("org-fa", "✅ " + (res.messaggio || "Partecipazione cancellata."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Cancellazione non riuscita."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .modificaPrenotazione(u, String(evId || "").trim(), String(sessId || "").trim(), "cancella", {
 bookingId: String(bookingId || "").trim(),
 vecchioTavolo: String(tavoloAttuale || "").trim(),
 sorgente: "organizzatore",
 notificaUtente: notificaUtente !== false
 });
 }, null, { notifyOptional: true, notifyDefault: true });
}

function orgCancellaDaOverlaySposta() {
 const uuid = String(document.getElementById("org-move-uuid")?.value || "").trim();
 const evId = String(document.getElementById("org-move-ev")?.value || "").trim();
 const sessId = String(document.getElementById("org-move-sess")?.value || "").trim();
 const tavolo = String(document.getElementById("org-move-old")?.value || "").trim();
 const titolo = String(document.getElementById("org-move-title")?.textContent || "");
 const nome = titolo.replace(/^Sposta prenotazione\s*[—–-]\s*/i, "").trim() || "partecipante";
 const bookingId = String(window._orgMoveCtx?.bookingId || "").trim();
 orgCancellaPrenotazione(evId, sessId, uuid, tavolo, bookingId, nome);
}

function apriOrgSpostaPrenotazione(evId, sessId, uuid, tavoloAttuale, numPersone, fasciaEta, nomePartecipante, bookingId) {
 if (!uuid) {
 flash("org-fa", "Impossibile spostare: UUID prenotazione mancante.", "err");
 return;
 }
 if (!datiOrg || !datiOrg.tavoliPerEvento) return;
 const tavoli = (datiOrg.tavoliPerEvento[evId] || {})[sessId] || [];
 const oldId = _estraiIdTavoloDaStringa(tavoloAttuale);
 const num = Math.max(1, parseInt(numPersone, 10) || 1);
 const target = document.getElementById("org-move-target");
 const errEl = document.getElementById("org-move-err");
 if (!target || !errEl) return;

 const candidati = tavoli.filter(t => {
 const tid = String(t?.id || "").trim();
 if (!tid || tid === oldId) return false;
 const liberi = Math.max(0, (parseInt(t?.max, 10) || 0) - (parseInt(t?.occupati, 10) || 0));
 return liberi >= num;
 });

 target.innerHTML = "";
 window._orgMoveCtx = { evId, sessId, tavoli, tavoloAttuale, uuid, num, bookingId: String(bookingId || "").trim() };

 candidati.forEach(t => {
 const tid = String(t.id || "").trim();
 const gioco = String(t.gioco || t.titoloAvventura || tid).trim();
 const liberi = Math.max(0, (parseInt(t.max, 10) || 0) - (parseInt(t.occupati, 10) || 0));
 const o = document.createElement("option");
 o.value = `${tid} – ${gioco}`;
 o.textContent = _orgLabelTavoloMoveOption(t, liberi);
 target.appendChild(o);
 });

 const metaAtt = _orgTavoloMetaById(tavoli, tavoloAttuale);
 const fasceLbl = labelsFasciaCsv(fasciaEta) || "—";
 const summaryEl = document.getElementById("org-move-summary");
 if (summaryEl) {
 summaryEl.innerHTML = `
 <ul class="invite-detail-list">
 <li><span class="invite-detail-key">Tavolo attuale</span><span class="invite-detail-value">${escapeHtml(metaAtt.nome)}</span></li>
 <li><span class="invite-detail-key">Posti</span><span class="invite-detail-value">×${num}</span></li>
 <li><span class="invite-detail-key">Fasce d'età</span><span class="invite-detail-value">${escapeHtml(fasceLbl)}</span></li>
 </ul>`;
 }

 document.getElementById("org-move-title").textContent = `Sposta prenotazione — ${nomePartecipante || "partecipante"}`;
 document.getElementById("org-move-ev").value = evId;
 document.getElementById("org-move-sess").value = sessId;
 document.getElementById("org-move-uuid").value = uuid;
 document.getElementById("org-move-old").value = tavoloAttuale || "";
 document.getElementById("org-move-num").value = String(num);
 document.getElementById("org-move-fascia").value = String(fasciaEta || "").trim();
 const noteEl = document.getElementById("org-move-motivo");
 if (noteEl) noteEl.value = "";
 const notifyEl = document.getElementById("org-move-notify");
 if (notifyEl) {
 const ev = (datiOrg?.eventiConSessioni || []).find(e => String(e?.eventId || "") === String(evId || ""));
 const isPast = !!(ev && isDataPassata(ev.dataIso || ev.data));
 notifyEl.checked = !isPast;
 }
 errEl.textContent = "";

 const btn = document.getElementById("org-move-submit");
 if (btn) btn.disabled = candidati.length === 0;
 if (!candidati.length) {
 errEl.textContent = "Nessun tavolo con posti sufficienti disponibile per lo spostamento.";
 }
 show("org-move-overlay");
}

function orgConfermaSpostaPrenotazione() {
 const errEl = document.getElementById("org-move-err");
 if (errEl) errEl.textContent = "";
 const uuid = String(document.getElementById("org-move-uuid")?.value || "").trim();
 const evId = String(document.getElementById("org-move-ev")?.value || "").trim();
 const sessId = String(document.getElementById("org-move-sess")?.value || "").trim();
 const tavoloNuovo = String(document.getElementById("org-move-target")?.value || "").trim();
 const tavoloVecchio = String(document.getElementById("org-move-old")?.value || "").trim();
 const numPersone = Math.max(1, parseInt(document.getElementById("org-move-num")?.value, 10) || 1);
 const fasciaEta = String(document.getElementById("org-move-fascia")?.value || "").trim();
 const notificaUtente = !!document.getElementById("org-move-notify")?.checked;
 const motivoSpostamento = String(document.getElementById("org-move-motivo")?.value || "").trim().slice(0, 500);

 if (!uuid || !evId || !sessId || !tavoloNuovo) {
 if (errEl) errEl.textContent = "Dati incompleti per lo spostamento.";
 return;
 }
 if (notificaUtente && !motivoSpostamento) {
 if (errEl) errEl.textContent = "Scrivi il messaggio per il prenotante (o usa il pulsante «Master assente»).";
 document.getElementById("org-move-motivo")?.focus();
 return;
 }
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 if (errEl) errEl.textContent = "Ambiente non collegato al server.";
 return;
 }

 const btn = document.getElementById("org-move-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Spostamento prenotazione…");
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 endActionOverlay();
 if (res && res.ok) {
 hide("org-move-overlay");
 flash("org-fa", "✅ " + (res.messaggio || "Prenotazione spostata."), "ok");
 caricaOrg();
 } else if (errEl) {
 errEl.textContent = res?.errore || "Operazione non riuscita.";
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 endActionOverlay();
 if (errEl) errEl.textContent = err.message || String(err);
 })
 .modificaPrenotazione(uuid, evId, sessId, "cambia_tavolo", {
 tavolo: tavoloNuovo,
 numPersone: numPersone,
 fasciaEta: fasciaEta,
 vecchioTavolo: tavoloVecchio,
 notificaUtente: notificaUtente,
 motivoSpostamento: motivoSpostamento,
 sorgente: "organizzatore"
 });
}

function apriOrgAggiungiIscritto(evId, sessId, idTavolo) {
 if (!datiOrg || !datiOrg.tavoliPerEvento) return;
 const tavoli = (datiOrg.tavoliPerEvento[evId] || {})[sessId] || [];
 const t = tavoli.find(x => String(x.id) === String(idTavolo));
 if (!t) {
 flash("org-fa", "Tavolo non trovato.", "err");
 return;
 }
 document.getElementById("org-manual-title").textContent = "Aggiungi iscritto — " + (t.gioco || t.id);
 document.getElementById("org-manual-ev").value = evId;
 document.getElementById("org-manual-sess").value = sessId;
 document.getElementById("org-manual-tav-id").value = idTavolo;
 document.getElementById("org-manual-nome").value = "";
 document.getElementById("org-manual-email").value = "";
 document.getElementById("org-manual-cell").value = "";
 document.getElementById("org-manual-num").value = "1";
 document.getElementById("org-manual-invia-email").checked = false;
 document.getElementById("org-manual-err").textContent = "";
 popolaUtentiIscrizioneManuale();
 const userSearch = document.getElementById("org-manual-user-search");
 if (userSearch) {
 userSearch.onchange = onSelectUtenteIscrizioneManuale;
 userSearch.oninput = onSelectUtenteIscrizioneManuale;
 }
 const pwdEl = document.getElementById("org-manual-pwd");
 if (pwdEl) pwdEl.value = "";

 const tipo = String(t.tipo || "").trim().toUpperCase();
 const richiedeFascia = !(tipo === "PANEL" || tipo === "GIOCO_LIBERO");
 const fasceRaw = Array.isArray(t.fasce) ? t.fasce.filter(Boolean) : [];
 const fasceOpts = fasceRaw.map(f => {
 const id = fasciaId(typeof f === "object" ? (f.id || f.label) : f);
 return id ? { id, label: labelFascia(id) } : null;
 }).filter(Boolean);
 const fasciaWrap = document.getElementById("org-manual-fascia-wrap");
 const sel = document.getElementById("org-manual-fascia-select");
 const txt = document.getElementById("org-manual-fascia-text");
 sel.innerHTML = "";
 sel.classList.add("hidden");
 txt.classList.add("hidden");
 if (!richiedeFascia) {
 fasciaWrap.classList.add("hidden");
 } else {
 fasciaWrap.classList.remove("hidden");
 if (fasceOpts.length > 1) {
 sel.classList.remove("hidden");
 fasceOpts.forEach(f => {
 const o = document.createElement("option");
 o.value = f.id;
 o.textContent = f.label;
 sel.appendChild(o);
 });
 } else if (fasceOpts.length === 1) {
 txt.classList.remove("hidden");
 txt.value = fasceOpts[0].label;
 txt.dataset.fasciaId = fasceOpts[0].id;
 txt.readOnly = true;
 } else {
 txt.classList.remove("hidden");
 txt.value = "";
 delete txt.dataset.fasciaId;
 txt.readOnly = false;
 }
 }

 const pwdRow = document.getElementById("org-manual-pwd-row");
 if (pwdRow) pwdRow.classList.toggle("hidden", !!ORG_HASH_CLIENT);

 show("org-manual-overlay");
 setTimeout(() => document.getElementById("org-manual-nome")?.focus(), 100);
}

async function orgInviaIscrizioneManuale() {
 const errEl = document.getElementById("org-manual-err");
 errEl.textContent = "";
 let hash = ORG_HASH_CLIENT;
 if (!hash) {
 const pwd = document.getElementById("org-manual-pwd")?.value || "";
 if (!pwd) {
 errEl.textContent = "Inserisci la password organizzatore oppure effettua di nuovo l’accesso al pannello.";
 return;
 }
 if (!window.crypto || !crypto.subtle) {
 errEl.textContent = "Il browser non supporta la crittografia necessaria. Usa HTTPS o un browser aggiornato.";
 return;
 }
 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
 hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
 }

 const evId = document.getElementById("org-manual-ev").value;
 const sessId = document.getElementById("org-manual-sess").value;
 const idTavolo = document.getElementById("org-manual-tav-id").value;
 const nome = document.getElementById("org-manual-nome").value.trim();
 const email = document.getElementById("org-manual-email").value.trim();
 const cellulare = document.getElementById("org-manual-cell").value.trim();
 const numPersone = Math.max(1, parseInt(document.getElementById("org-manual-num").value, 10) || 1);

 const fasciaWrap = document.getElementById("org-manual-fascia-wrap");
 let fasciaEta = "";
 if (!fasciaWrap.classList.contains("hidden")) {
 const sel = document.getElementById("org-manual-fascia-select");
 const txt = document.getElementById("org-manual-fascia-text");
 if (!sel.classList.contains("hidden")) fasciaEta = (sel.value || "").trim();
 else fasciaEta = (txt.dataset.fasciaId || fasciaId(txt.value || "")).trim();
 }

 const inviaEmail = document.getElementById("org-manual-invia-email").checked;
 const payload = {
 eventId: evId,
 sessioneId: sessId,
 idTavolo,
 nome,
 email,
 cellulare,
 numPersone,
 fasciaEta,
 inviaEmail
 };

 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 errEl.textContent = "Ambiente non collegato al server.";
 return;
 }

 const btn = document.getElementById("org-manual-submit");
 btn.disabled = true;
 google.script.run
 .withSuccessHandler(res => {
 btn.disabled = false;
 if (res && res.ok) {
 if (!ORG_HASH_CLIENT && hash) ORG_HASH_CLIENT = hash;
 hide("org-manual-overlay");
 flash("org-fa", "✅ " + (res.messaggio || "Iscrizione registrata."), "ok");
 caricaOrg();
 } else {
 errEl.textContent = res?.errore || "Operazione non riuscita.";
 }
 })
 .withFailureHandler(err => {
 btn.disabled = false;
 errEl.textContent = err.message || String(err);
 })
 .orgAggiungiIscrittoTavolo(hash, payload);
}

function annullaListeAttesaPerTavolo(evId, sessId, idTavolo) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) return;
 const tavKey = String(idTavolo).replace(/[^a-z0-9_]/gi, "_");
 const msg = `Rimuovere la preferenza "${idTavolo}" da tutti gli utenti in lista d'attesa per questa sessione?\n\nSe un utente rimane senza preferenze, uscirà dalla lista.`;
 chiediConferma(msg, () => {
 beginActionOverlay("Aggiornamento liste d'attesa…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 flash("org-fa", "✅ " + (res.messaggio || "Preferenze aggiornate."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Errore durante l'operazione."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ Errore: " + (err.message || err), "err");
 })
 .annullaListeAttesaPerTavolo(evId, sessId, idTavolo);
 });
}

function inviaPromemoriaListaAttesa(evId, sessId, idTavolo) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) return;
 const tavKey = String(idTavolo).replace(/[^a-z0-9_]/gi, "_");
 const inp = document.getElementById("mtav-rem-n-" + tavKey);
 let N = inp ? parseInt(inp.value || "5", 10) : 5;
 if (!N || N < 1) N = 5;
 if (N > 50) N = 50;

 const msg = `Inviare un promemoria agli utenti in lista d'attesa per questo tavolo (primi ${N})?`;
 chiediConferma(msg, () => {
 beginActionOverlay("Invio promemoria…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 flash("org-fa", "✅ " + (res.messaggio || "Promemoria inviati."), "ok");
 caricaOrg();
 } else {
 flash("org-fa", "⚠️ " + (res?.errore || "Errore durante l'invio."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ Errore: " + (err.message || err), "err");
 })
 .inviaPromemoriaListaAttesa(evId, sessId, idTavolo, N);
 });
}

function loginAsUtente(uuid) {
 const id = String(uuid || "").trim();
 if (!id) return;
 // Dentro l'iframe Apps Script location è il pannello sandbox, non l'area utente.
 const url = _buildPublicUtenteUrl(id);
 const win = window.open(url, "_blank", "noopener,noreferrer");
 if (!win) flash("org-fa", "Il browser ha bloccato la finestra. Consenti i popup e riprova.", "err");
}

// ═══════════════════════════════════════════
// MAPPA EVENTI
// ═══════════════════════════════════════════
let mappaEvSelezionato = null;
let mappaSessSelezionata = null;
let mappaSearchTerm = "";
let _evFormOriginMappa = null;

function apriMappaVistaAvanzata() {
 document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
 document.querySelectorAll("#org-tabs .tab-btn").forEach(b => b.classList.remove("active"));
 document.getElementById("t-eventi")?.classList.add("active");
 document.getElementById("org-stats-page")?.classList.add("hidden");
 document.getElementById("org-eventi-page")?.classList.add("hidden");
 document.querySelectorAll(".org-macro-btn").forEach(b => {
 b.classList.toggle("active", b.dataset.macro === "macro-eventi");
 });
 if (typeof MODE !== "undefined" && MODE === "org") setHSub("📌 Eventi e Tavoli");
 ensureOrgTavoliData();
 const evAttiviBtn = document.querySelector('.eventi-subtab[data-eventi-panel="eventi-panel-attivi"]');
 if (evAttiviBtn) switchEventiSubtab("eventi-panel-attivi", evAttiviBtn);
}

function _mappaEventoCorrente() {
 if (!datiOrg || !mappaEvSelezionato) return null;
 return (datiOrg.eventiConSessioni || []).find(e => e.eventId === mappaEvSelezionato) || null;
}

function _mappaSessioneCorrente(ev) {
 if (!ev || !mappaSessSelezionata) return null;
 return (ev.sessioni || []).find(s => _normSessJS(s.sessioneId) === _normSessJS(mappaSessSelezionata)) || null;
}

/** Adatta etichette mappa in base al tipo della sessione selezionata. */
function _applyMappaModeForSessione(sess) {
 const senzaTav = sessioneSenzaTavoli(sess);
 const tabMain = document.getElementById("sess-subtab-main");
 const tabPren = document.getElementById("sess-subtab-pren");
 if (tabMain) tabMain.textContent = senzaTav ? "Iscrizioni" : "Tavoli";
 if (tabPren) tabPren.textContent = senzaTav ? "Elenco" : "Prenotazioni";
 const legend = document.querySelector("#mappa-lv2 .mappa-legend") || document.querySelector(".mappa-legend");
 if (legend) {
 legend.style.display = senzaTav ? "none" : "";
 if (!senzaTav) {
 legend.innerHTML = `<span><span class="dot"></span> Barra = posti occupati / totali</span><span><span class="dot dot-att"></span> Attesa = in lista d'attesa</span>`;
 }
 }
}

function apriModificaSessioniDaMappa(evId, sessId) {
 const sid = String(sessId || "").trim();
 _evFormOriginMappa = { evId: String(evId || "").trim(), sessId: sid };
 apriMappaVistaAvanzata();
 modificaEvento(evId, "sessioni", true);
 if (!sid) return;
 const items = Array.from(document.querySelectorAll("#sessioni-list .sess-item"));
 items.forEach(item => {
 const curId = String(item.querySelector(".sess-id")?.value || "").trim();
 const headBtn = item.querySelector(".ev-acc-head");
 if (!headBtn) return;
 toggleEvAccordion(headBtn, _normSessJS(curId) === _normSessJS(sid));
 });
 const active = items.find(item => {
 const curId = String(item.querySelector(".sess-id")?.value || "").trim();
 return _normSessJS(curId) === _normSessJS(sid);
 });
 if (active) active.scrollIntoView({ behavior: "smooth", block: "center" });
}

function _renderMappaDetailHead() {
 const titleEl = document.getElementById("mappa-ev-title");
 const metaEl = document.getElementById("mappa-ev-meta");
 const ev = _mappaEventoCorrente();
 if (!titleEl) return;
 if (!ev) {
 titleEl.textContent = "–";
 if (metaEl) metaEl.textContent = "";
 return;
 }
 titleEl.textContent = (ev.nome || ev.eventId) + (ev.data ? " · " + formatDataItaliana(ev.data) : "");
 if (metaEl) {
 const bits = [ev.luogo || "", ev.attivo === false ? "Inattivo" : ""].filter(Boolean);
 metaEl.textContent = bits.join(" · ");
 metaEl.classList.toggle("hidden", !bits.length);
 }
}

/** Solo bottoni azione (niente ripetizione nome/sessione/capienza). */
function _renderMappaActionPanel() {
 const actionsEl = document.getElementById("mappa-action-actions");
 if (!actionsEl) return;
 if (!mappaEvSelezionato) {
 actionsEl.innerHTML = "";
 return;
 }

 const ev = _mappaEventoCorrente();
 if (!ev) {
 actionsEl.innerHTML = `<button type="button" class="btn btn-o btn-sm" onclick="caricaOrg()">↺ Aggiorna dati</button>`;
 return;
 }
 const nomeEvEsc = String(ev.nome || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
 const sess = _mappaSessioneCorrente(ev);
 const btnStatoEv = ev.attivo === false
 ? `<button type="button" class="btn btn-o btn-sm" onclick="attivaEv('${ev.eventId}')">Attiva</button>`
 : `<button type="button" class="btn btn-d btn-sm" onclick="disattivaEv('${ev.eventId}')">Disattiva</button>`;

 if (!sess) {
 actionsEl.innerHTML = `
 <button type="button" class="btn btn-o btn-sm" onclick="modificaEvento('${ev.eventId}')">Modifica</button>
 <button type="button" class="btn btn-o btn-sm" onclick="apriAvvisoEventoPopup('${ev.eventId}', '${nomeEvEsc}')">Avviso</button>
 ${btnStatoEv}
 ${EXPORT_CSV_EVENTO_ENABLED ? `<button type="button" class="btn btn-o btn-sm" onclick="esportaCsvEvento('${ev.eventId}')">CSV</button>` : ""}
 `;
 return;
 }

 const senzaTav = sessioneSenzaTavoli(sess);
 const btnAggiungiTavolo = senzaTav
 ? ""
 : `<button type="button" class="btn btn-s btn-sm" onclick="apriAggiungiTavoloDaMappa('${ev.eventId}','${String(sess.sessioneId || "").replace(/'/g, "\\'")}')">+ Tavolo</button>`;
 const btnAggiungiIscritto = senzaTav
 ? `<button type="button" class="btn btn-s btn-sm" onclick="apriOrgAggiungiIscritto('${String(ev.eventId || "").replace(/'/g,"\\'")}','${String(sess.sessioneId || "").replace(/'/g,"\\'")}','SESSIONE_LIBERA')">+ Iscrizione</button>`
 : "";
 actionsEl.innerHTML = `
 <button type="button" class="btn btn-o btn-sm" onclick="apriModificaSessioniDaMappa('${ev.eventId}','${String(sess.sessioneId || "").replace(/'/g, "\\'")}')">Sessioni</button>
 ${btnAggiungiTavolo}
 ${btnAggiungiIscritto}
 <button type="button" class="btn btn-o btn-sm" onclick="apriAvvisoEventoPopup('${ev.eventId}', '${nomeEvEsc}')">Avviso</button>
 ${btnStatoEv}
 `;
}

function _syncMappaShellState() {
 const shell = document.getElementById("mappa-shell");
 const lv1 = document.getElementById("mappa-lv1");
 const step2 = document.getElementById("mappa-step2");
 if (!shell) return;
 const has = !!mappaEvSelezionato;
 shell.classList.toggle("has-event", has);
 if (lv1) lv1.classList.toggle("hidden", has);
 if (step2) step2.classList.toggle("hidden", !has);
}

function renderMappaEventi() {
 if (!datiOrg) return;
 const { prenotazioni, eventi, tavoliPerEvento } = datiOrg;
 const grid = document.getElementById("mappa-eventi-grid");
 const gridInattivi = document.getElementById("mappa-eventi-grid-inattivi");
 const gridPassati = document.getElementById("mappa-eventi-grid-passati");
 if (!grid || !gridInattivi || !gridPassati) return;

 const searchFixed = document.getElementById("mappa-search-input-fixed");
 if (searchFixed && document.activeElement !== searchFixed) searchFixed.value = mappaSearchTerm || "";

 const term = String(mappaSearchTerm || "").trim().toLowerCase();
 const eventiFiltrati = (eventi || []).filter(ev => {
 if (!term) return true;
 const nome = String(ev.nome || "").toLowerCase();
 const luogo = String(ev.luogo || "").toLowerCase();
 const data = String(ev.data || "").toLowerCase();
 return nome.includes(term) || luogo.includes(term) || data.includes(term);
 });
 const futuri = eventiFiltrati.filter(ev => !isDataPassata(ev.data));
 const attivi = futuri.filter(ev => ev.attivo !== false);
 const inattivi = futuri.filter(ev => ev.attivo === false);
 const passati = eventiFiltrati.filter(ev => isDataPassata(ev.data));

 const emptyHtml = (msg) => `<div class="mev-empty"><span class="empty-icon">🎲</span>${msg}</div>`;

 if (!eventiFiltrati.length) {
 grid.innerHTML = emptyHtml("Nessun evento attivo al momento.");
 gridInattivi.innerHTML = term ? emptyHtml("Nessun evento trovato con questi filtri.") : "";
 gridPassati.innerHTML = term ? emptyHtml("Nessun evento trovato con questi filtri.") : "";
 _syncMappaShellState();
 return;
 }

 const fillGrid = (list, target) => {
 if (!list.length) {
 if (target === gridPassati) target.innerHTML = emptyHtml("Nessun evento passato.");
 else if (target === gridInattivi) target.innerHTML = emptyHtml("Nessun evento inattivo con data odierna o futura.");
 else target.innerHTML = emptyHtml("Nessun evento attivo con data odierna o futura.");
 return;
 }
 target.innerHTML = list.map((ev, i) => mappaEvCardHtml(ev, i, prenotazioni, tavoliPerEvento)).join("");
 };

 fillGrid(attivi, grid);
 fillGrid(inattivi, gridInattivi);
 fillGrid(passati, gridPassati);
 _syncMappaShellState();
 if (mappaEvSelezionato) {
 _renderMappaDetailHead();
 _renderMappaActionPanel();
 refreshMappaContesto(false);
 }
}

function mappaEvCardHtml(ev, i, prenotazioni, tavoliPerEvento) {
 const pren = prenotazioni.filter(p => p.eventId === ev.eventId);
 const totP = pren.length;
 const totPer = pren.reduce((s,p) => s + parseInt(p.numPersone||1), 0);
 const attesa = pren.filter(p => p.isListaAttesa).length;
 const sessioni = datiOrg.eventiConSessioni?.find(e => e.eventId === ev.eventId)?.sessioni || [];

 let totMax = 0, totOcc = 0;
 const tavData = tavoliPerEvento[ev.eventId] || {};
 Object.values(tavData).forEach(tavoli => {
 tavoli.forEach(t => { totMax += t.max; totOcc += Math.min(t.occupati, t.max); });
 });
 const pct = totMax > 0 ? Math.round(totOcc / totMax * 100) : 0;

 return `
 <div class="mappa-ev-card" data-evid="${escapeHtml(ev.eventId)}" onclick="apriMappaEvento('${String(ev.eventId).replace(/'/g, "\\'")}')" style="animation-delay:${i*.06}s">
 <div class="mev-nome">${escapeHtml(ev.nome || ev.eventId)}</div>
 <div class="mev-data">${[ev.data ? formatDataItaliana(ev.data) : "", ev.luogo].filter(Boolean).map(escapeHtml).join(' · ')}</div>
 <div class="mev-stats">
 <div class="mev-stat"><div class="mev-stat-n">${totP}</div><div class="mev-stat-l">Prenotaz.</div></div>
 <div class="mev-stat"><div class="mev-stat-n">${totPer}</div><div class="mev-stat-l">Persone</div></div>
 <div class="mev-stat"><div class="mev-stat-n">${sessioni.length}</div><div class="mev-stat-l">Session${sessioni.length===1?'e':'i'}</div></div>
 <div class="mev-stat" style="${attesa > 0 ? 'border-color:rgba(201,146,42,.3);background:#fffbf0' : ''}">
 <div class="mev-stat-n" style="${attesa > 0 ? 'color:var(--gold)' : ''}">${attesa}</div>
 <div class="mev-stat-l">Attesa</div>
 </div>
 </div>
 ${totMax > 0 ? `
 <div class="mev-progress"><div class="mev-progress-fill" style="width:${pct}%"></div></div>
 <div style="font-family:var(--font-m);font-size:10px;color:var(--ash);margin-bottom:12px">${totOcc}/${totMax} posti occupati · ${pct}% pieno</div>
 ` : ''}
 <div class="mev-cta">Vedi tavoli <span style="font-size:14px">→</span></div>
 </div>`;
}

function apriMappaEvento(evId) {
 mappaEvSelezionato = evId;
 const ev = datiOrg.eventiConSessioni?.find(e => e.eventId === evId);
 if (!ev) return;

 const sessioni = (ev.sessioni || []).slice().sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""));
 const tabsEl = document.getElementById("mappa-sess-tabs");
 if (tabsEl) {
 tabsEl.innerHTML = sessioni.map((s, i) =>
 `<button class="mappa-sess-btn${i===0?' active':''}"
 onclick="selezionaMappaSess('${evId}','${s.sessioneId}','${(s.nome||s.sessioneId).replace(/'/g,"\\'")}',this)">
 ${escapeHtml(s.nome || s.sessioneId)}${s.orario ? '<span class="mappa-sess-orario">'+escapeHtml(s.orario)+'</span>' : ''}
 </button>`
 ).join('');
 }

 _syncMappaShellState();
 _renderMappaDetailHead();

 if (sessioni.length > 0) {
 mappaSessSelezionata = sessioni[0].sessioneId;
 _applyMappaModeForSessione(sessioni[0]);
 renderMappaTavoli(evId, sessioni[0].sessioneId, sessioni[0].nome || sessioni[0].sessioneId);
 } else {
 mappaSessSelezionata = null;
 }
 _renderMappaActionPanel();
 refreshMappaContesto(true);
 window.scrollTo({ top: 0, behavior: "smooth" });
}

function selezionaMappaSess(evId, sessId, sessNome, btn) {
 mappaSessSelezionata = sessId;
 document.querySelectorAll("#mappa-sess-tabs .mappa-sess-btn").forEach(b => b.classList.remove("active"));
 btn.classList.add("active");

 const ev = (datiOrg?.eventiConSessioni || []).find(e => e.eventId === evId);
 const sess = (ev?.sessioni || []).find(s => _normSessJS(s.sessioneId) === _normSessJS(sessId));
 _applyMappaModeForSessione(sess);
 renderMappaTavoli(evId, sessId, sessNome);
 _renderMappaActionPanel();
 refreshMappaContesto(false);
}

function _parseLastHFromTavolo(tavoloStr) {
 const s = String(tavoloStr || "");
 const idx = s.indexOf("| LastH:");
 if (idx < 0) return null;
 const m = s.substring(idx + 8).trim().match(/(\d+)/);
 return m ? Math.max(1, Math.min(24, parseInt(m[1], 10))) : null;
}

function _oreAllaSessione(evId, sessId) {
 const ev = datiOrg?.eventiConSessioni?.find(e => e.eventId === evId);
 if (!ev) return null;
 const dateStr = ev.dataIso || (ev.data && typeof dataItalianaToYYYYMMDD === "function" ? dataItalianaToYYYYMMDD(ev.data) : "");
 if (!dateStr) return null;
 const sess = (ev.sessioni || []).find(s => _normSessJS(s.sessioneId) === _normSessJS(sessId));
 const orarioStr = (sess?.orario || "00:00").trim();
 const parts = orarioStr.split(":").map(x => parseInt(x, 10) || 0);
 const h = parts[0], m = parts[1] || 0;
 const sessStart = new Date(dateStr + "T" + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":00");
 const diffMs = sessStart.getTime() - Date.now();
 return diffMs <= 0 ? 0 : diffMs / (60 * 60 * 1000);
}

/** Partecipanti foglio: senza email = solo etichetta; con email = co-prenotanti (utenti/inviti). Vista org: anagrafica + nick se noti. */
function mtavSplitPartecipantiExtra(partecipantiArr) {
 const partecipantiNomi = [];
 const coPrenotantiNomi = [];
 const seenPartecipanti = {};
 const seenCoPrenotanti = {};
 const normLabel = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
 (Array.isArray(partecipantiArr) ? partecipantiArr : []).forEach(x => {
 const label = _formatPartecipanteOrgDisplay(x);
 if (!label || label === "—") return;
 const key = normLabel(label);
 if (!key) return;
 const em = String(x?.email || "").trim().toLowerCase();
 if (em && em.indexOf("@") > 0) {
 if (seenCoPrenotanti[key]) return;
 seenCoPrenotanti[key] = true;
 coPrenotantiNomi.push(label);
 } else {
 if (seenPartecipanti[key]) return;
 seenPartecipanti[key] = true;
 partecipantiNomi.push(label);
 }
 });
 return { partecipantiNomi, coPrenotantiNomi };
}

function mtavNomiPartecipantiEffettivi(p) {
 const { partecipantiNomi, coPrenotantiNomi } = mtavSplitPartecipantiExtra(p?.partecipanti);
 return partecipantiNomi.concat(coPrenotantiNomi).filter(Boolean);
}

function mtavBuildExtraPartHtml(p) {
 const { partecipantiNomi, coPrenotantiNomi } = mtavSplitPartecipantiExtra(p?.partecipanti);
 const coPrenotantiDettaglio = (Array.isArray(p?.partecipanti) ? p.partecipanti : [])
 .filter(x => {
 const em = String(x?.email || "").trim();
 return !!em && em.indexOf("@") > 0;
 })
 .map(x => {
 const label = _formatPartecipanteOrgDisplay(x);
 const em = String(x?.email || "").trim();
 return (label && label !== "—") ? `${label} · ${em}` : em;
 })
 .filter(Boolean);
 if (!PARTECIPANTI_MULTI_ENABLED || (!partecipantiNomi.length && !coPrenotantiNomi.length)) return "";
 return `<div class="mtav-pdetail-stack">${partecipantiNomi.length
 ? `<div class="mtav-pdetail-parti"><span class="mtav-plabel">Partecipanti</span>${mtavRenderNomiChips(partecipantiNomi)}</div>`
 : ""}${coPrenotantiNomi.length
 ? `<div class="mtav-pdetail-copren"><span class="mtav-plabel">Co-prenotanti</span>${mtavRenderNomiChips(coPrenotantiDettaglio.length ? coPrenotantiDettaglio : coPrenotantiNomi)}</div>`
 : ""}</div>`;
}

/** Card mappa org: se prenotante non partecipa, mostra i partecipanti effettivi in evidenza. */
/** True se è la prima (o unica) partecipazione Gilda nota. */
function _orgIsPrimaVoltaGiocatore(uuid, email) {
 const uid = String(uuid || "").trim().toLowerCase();
 const em = String(email || "").trim().toLowerCase();
 const utenti = Array.isArray(datiOrg?.utenti) ? datiOrg.utenti : [];
 const u = utenti.find(x => {
 const xu = String(x?.uuid || "").trim().toLowerCase();
 const xe = String(x?.email || "").trim().toLowerCase();
 return (uid && xu === uid) || (em && xe === em);
 });
 if (u) {
 const evDiv = parseInt(u.eventiDiversi || 0, 10) || 0;
 const tot = parseInt(u.totPrenotazioni || 0, 10) || 0;
 if (evDiv > 0) return evDiv <= 1;
 if (tot > 0) return tot <= 1;
 }
 const pren = Array.isArray(datiOrg?.prenotazioni) ? datiOrg.prenotazioni : [];
 const eventi = new Set();
 pren.forEach(p => {
 if (p?.isListaAttesa) return;
 const pu = String(p?.uuid || "").trim().toLowerCase();
 const pe = String(p?.email || "").trim().toLowerCase();
 if ((uid && pu === uid) || (em && pe === em)) {
 const id = String(p.eventId || p.eventNome || "").trim();
 if (id) eventi.add(id);
 }
 });
 if (eventi.size > 0) return eventi.size <= 1;
 // Nessuno storico: trattalo come debuttante
 return true;
}

function _orgBadgePrimaVoltaHtml(uuid, email) {
 if (!_orgIsPrimaVoltaGiocatore(uuid, email)) return "";
 return `<span class="mtav-badge-prima" title="Prima volta alla Gilda">1ª</span>`;
}

function _orgNomeClickableHtml(nome, uuid, email) {
 const label = escapeHtml(String(nome || "–").trim() || "–");
 const jsU = _orgJsArg(uuid);
 const jsE = _orgJsArg(email);
 return `<button type="button" class="mtav-pnome mtav-pnome-btn" onclick="event.stopPropagation();apriProfiloGiocatoreOrg('${jsU}','${jsE}')" title="Apri profilo">${label}</button>`;
}

function apriProfiloGiocatoreOrg(uuid, email) {
 const ovEl = document.getElementById("utente-detail-overlay");
 const contentEl = document.getElementById("utente-detail-content");
 const headEl = document.querySelector("#utente-detail-overlay .user-detail-head h2");
 if (!ovEl || !contentEl) return;
 if (headEl) headEl.textContent = "Profilo giocatore";
 contentEl.innerHTML = `<div class="card-body" style="padding:18px 22px"><div class="empty-state"><span class="empty-icon">⏳</span>Caricamento profilo…</div></div>`;
 show("utente-detail-overlay");
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 contentEl.innerHTML = `<div class="card-body" style="padding:18px 22px"><div class="empty-state"><span class="empty-icon">⚠️</span>Ambiente non collegato al server.</div></div>`;
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 if (!(res && res.ok)) {
 contentEl.innerHTML = `<div class="card-body" style="padding:18px 22px"><div class="empty-state"><span class="empty-icon">⚠️</span>${escapeHtml(res?.errore || "Profilo non disponibile.")}</div></div>`;
 return;
 }
 contentEl.innerHTML = _orgRenderProfiloGiocatoreHtml(res);
 })
 .withFailureHandler(err => {
 contentEl.innerHTML = `<div class="card-body" style="padding:18px 22px"><div class="empty-state"><span class="empty-icon">❌</span>${escapeHtml(err.message || String(err))}</div></div>`;
 })
 .getProfiloGiocatoreOrg(String(uuid || "").trim(), String(email || "").trim());
}

function _orgRenderProfiloGiocatoreHtml(res) {
 const p = res.persona || {};
 const tip = res.tipologiEventi || {};
 const nEv = parseInt(res.eventiTotali || 0, 10) || 0;
 const tipiParts = [];
 if (tip.GDR) tipiParts.push(`${tip.GDR} GDR`);
 if (tip.GDT) tipiParts.push(`${tip.GDT} GDT`);
 if (tip.altro) tipiParts.push(`${tip.altro} altro`);
 const tipiLbl = tipiParts.length ? tipiParts.join(" · ") : "—";
 const ultima = res.ultimaGdr;
 const ultimaHtml = ultima
 ? `<div class="org-profilo-block">
 <h4>Ultima avventura GDR</h4>
 <div style="font-size:14px;font-weight:600;color:var(--ink2)">${escapeHtml(ultima.avventura || "—")}</div>
 <div class="meta" style="font-size:12px;color:var(--ash);margin-top:4px">
 ${escapeHtml(ultima.eventNome || "")}${ultima.eventData ? " · " + escapeHtml(formatDataItaliana(ultima.eventData) || ultima.eventData) : ""}
 </div>
 <div style="margin-top:6px;font-size:13px">🧙 Master: <strong>${escapeHtml(ultima.master || "—")}</strong>${ultima.sistemaGioco ? ` · ${escapeHtml(ultima.sistemaGioco)}` : ""}</div>
 </div>`
 : `<div class="org-profilo-block"><h4>Ultima avventura GDR</h4><div style="font-size:13px;color:var(--ash);font-style:italic">Nessuna partecipazione GDR registrata.</div></div>`;
 const lista = Array.isArray(res.eventi) ? res.eventi : [];
 const listHtml = lista.length
 ? `<ul class="org-profilo-list">${lista.map(e => {
 const data = e.eventData ? (formatDataItaliana(e.eventData) || e.eventData) : "";
 const extra = [e.tipo, e.avventura, e.master ? "master " + e.master : ""].filter(Boolean).join(" · ");
 return `<li><strong>${escapeHtml(e.eventNome || e.eventId || "Evento")}</strong>${data ? ` <span class="meta">${escapeHtml(data)}</span>` : ""}${extra ? `<div class="meta">${escapeHtml(extra)}</div>` : ""}</li>`;
 }).join("")}</ul>`
 : `<div style="font-size:13px;color:var(--ash);font-style:italic">Nessun evento confermato.</div>`;
 const primaBadge = res.isPrimaVolta
 ? `<span class="mtav-badge-prima" style="margin:0 0 12px">✨ Prima volta alla Gilda</span>`
 : "";
 return `
 <div class="card-body" style="padding:18px 22px 20px">
 ${primaBadge}
 <div class="card-meta-row" style="margin-bottom:14px">
 <div><strong>Nome</strong><div>${escapeHtml(p.nome || "—")}</div></div>
 <div><strong>Email</strong><div>${escapeHtml(p.email || "—")}</div></div>
 <div><strong>Cellulare</strong><div>${escapeHtml(p.cellulare || "—")}</div></div>
 </div>
 <div class="org-profilo-stats">
 <div class="org-profilo-stat"><div class="org-profilo-stat-n">${nEv}</div><div class="org-profilo-stat-l">Eventi</div></div>
 <div class="org-profilo-stat"><div class="org-profilo-stat-n">${tip.GDR || 0}</div><div class="org-profilo-stat-l">GDR</div></div>
 <div class="org-profilo-stat"><div class="org-profilo-stat-n">${tip.GDT || 0}</div><div class="org-profilo-stat-l">GDT</div></div>
 </div>
 <div style="font-size:13px;color:var(--smoke);margin-bottom:4px">Tipi di eventi: <strong>${escapeHtml(tipiLbl)}</strong></div>
 ${ultimaHtml}
 <div class="org-profilo-block">
 <h4>Storico recente</h4>
 ${listHtml}
 </div>
 </div>`;
}

function mtavPersonaCardDisplay(p) {
 const ownerPart = p?.prenotantePartecipa !== false;
 const nomeBooker = String(p?.nome || "–").trim() || "–";
 const email = String(p?.email || "").trim();
 const uuid = String(p?.uuid || "").trim();
 const fascia = labelsFasciaCsv(p?.fasciaEta) || "";
 const nomiEff = mtavNomiPartecipantiEffettivi(p);
 const badgePrima = _orgBadgePrimaVoltaHtml(uuid, email);

 if (!ownerPart) {
 if (nomiEff.length) {
 return {
 iniziale: nomiEff[0][0].toUpperCase(),
 nome: nomiEff.join(", "),
 nomeHtml: _orgNomeClickableHtml(nomiEff.join(", "), uuid, email),
 badgePrima,
 pinfoHtml: [
 `<div class="mtav-pdetail mtav-prenotante-ref">Prenotato da: ${escapeHtml(nomeBooker)}</div>`,
 email ? `<div class="mtav-pdetail">${escapeHtml(email)}</div>` : "",
 fascia ? `<div class="mtav-pdetail">${escapeHtml(fascia)}</div>` : ""
 ].filter(Boolean).join(""),
 extraPartHtml: ""
 };
 }
 return {
 iniziale: "?",
 nome: "Partecipante non registrato",
 nomeHtml: escapeHtml("Partecipante non registrato"),
 badgePrima: "",
 pinfoHtml: [
 `<div class="mtav-pdetail mtav-prenotante-ref">Prenotante: ${escapeHtml(nomeBooker)}</div>`,
 email ? `<div class="mtav-pdetail">${escapeHtml(email)}</div>` : "",
 `<div class="mtav-pdetail mtav-pdetail-warn">Il prenotante non partecipa al tavolo. Aggiorna la prenotazione dall'area utente per indicare chi siede qui.</div>`,
 fascia ? `<div class="mtav-pdetail">${escapeHtml(fascia)}</div>` : ""
 ].filter(Boolean).join(""),
 extraPartHtml: ""
 };
 }

 return {
 iniziale: (nomeBooker || "?")[0].toUpperCase(),
 nome: nomeBooker,
 nomeHtml: _orgNomeClickableHtml(nomeBooker, uuid, email),
 badgePrima,
 pinfoHtml: [
 email ? `<div class="mtav-pdetail">${escapeHtml(email)}</div>` : "",
 fascia ? `<div class="mtav-pdetail">${escapeHtml(fascia)}</div>` : ""
 ].filter(Boolean).join(""),
 extraPartHtml: mtavBuildExtraPartHtml(p)
 };
}

function mtavRenderNomiChips(nomiArr) {
 const arr = Array.isArray(nomiArr) ? nomiArr : [];
 if (!arr.length) return "";
 return `<span class="mtav-pnames">${arr.map(n => `<span class="mtav-pchip">${escapeHtml(String(n || ""))}</span>`).join("")}</span>`;
}

/** Riepilogo partecipanti/co-prenotanti per riga elenco mappa. */
function _mappaPrenExtraSummary(p) {
 const ownerPart = p?.prenotantePartecipa !== false;
 const nomiEff = mtavNomiPartecipantiEffettivi(p);
 if (!ownerPart && nomiEff.length) {
 return { label: "Al tavolo", text: nomiEff.join(", ") };
 }
 if (!PARTECIPANTI_MULTI_ENABLED) return { label: "", text: "" };
 const arr = Array.isArray(p?.partecipanti) ? p.partecipanti : [];
 const { partecipantiNomi, coPrenotantiNomi } = mtavSplitPartecipantiExtra(arr);
 const parts = [];
 if (partecipantiNomi.length) parts.push(partecipantiNomi.join(", "));
 if (coPrenotantiNomi.length) parts.push("co: " + coPrenotantiNomi.join(", "));
 if (!ownerPart) parts.unshift("prenotante non partecipa");
 return { label: parts.length ? "Extra" : "", text: parts.join(" · ") };
}

/** Bottone check-in condiviso dalle viste accoglienza (tavoli, iscrizioni, dettaglio). */
function _orgCheckinBtnHtml(p, ctx) {
 const c = ctx || {};
 const bid = String(p?.bookingId || "").trim();
 const uid = String(p?.uuid || "").trim();
 const checked = !!p?.checkin;
 if (!bid && !uid) {
  return `<button type="button" class="btn btn-o btn-sm" disabled title="Dati prenotazione mancanti">🚪 Segna arrivo</button>`;
 }
 const jsEv = _orgJsArg(c.evId || p?.eventId);
 const jsSess = _orgJsArg(c.sessId || p?.sessione);
 const jsTav = _orgJsArg(c.tavoloId || "");
 const jsBid = _orgJsArg(bid);
 const jsUuid = _orgJsArg(uid);
 const label = checked ? "✅ Presente" : "🚪 Segna arrivo";
 const cls = checked ? "btn btn-s btn-sm" : "btn btn-o btn-sm";
 const title = checked ? "Annulla conferma presenza" : "Conferma presenza (check-in)";
 return `<button type="button" class="${cls}" title="${title}" onclick="event.stopPropagation();orgAggiornaCheckin('${jsEv}','${jsSess}','${jsTav}','${jsBid}','${jsUuid}',${checked ? "false" : "true"})">${label}</button>`;
}

function _orgRerenderCheckin(evId, sessId) {
 try {
  const ev = (datiOrg?.eventiConSessioni || []).find(e => String(e.eventId) === String(evId));
  const sess = (ev?.sessioni || []).find(s => _normSessJS(s.sessioneId) === _normSessJS(sessId));
  const nomeSess = sess?.nome || sessId;
  if (String(mappaEvSelezionato || "") === String(evId) &&
      _normSessJS(mappaSessSelezionata || "") === _normSessJS(sessId) &&
      typeof renderMappaTavoli === "function") {
   renderMappaTavoli(evId, sessId, nomeSess);
  }
  if (typeof refreshMappaContesto === "function") refreshMappaContesto(true);
  const ov = document.getElementById("org-mappa-pren-detail-overlay");
  if (ov && !ov.classList.contains("hidden") && window._mappaPrenDettaglioIdx != null) {
   apriDettaglioPrenMappa(window._mappaPrenDettaglioIdx);
  }
 } catch (_e) {}
}

/** Conferma/annulla la presenza di una prenotazione o iscrizione (check-in). */
function orgAggiornaCheckin(evId, sessId, tavoloId, bookingId, uuid, checkin) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
  flash("org-fa", "Ambiente non collegato al server.", "err");
  return;
 }
 const bid = String(bookingId || "").trim();
 const uid = String(uuid || "").trim().toLowerCase();
 const wanted = !!checkin;
 const prev = [];
 (datiOrg?.prenotazioni || []).forEach(p => {
  if (String(p.eventId) !== String(evId)) return;
  if (_normSessJS(p.sessione) !== _normSessJS(sessId)) return;
  const same = bid
   ? String(p.bookingId || "").trim().toLowerCase() === bid.toLowerCase()
   : String(p.uuid || "").trim().toLowerCase() === uid;
  if (!same) return;
  prev.push({ p, checkin: !!p.checkin });
  p.checkin = wanted;
 });
 _orgRerenderCheckin(evId, sessId);
 google.script.run
  .withSuccessHandler(res => {
   if (res && res.ok) {
    flash("org-fa", "✅ " + (res.messaggio || (wanted ? "Presenza confermata." : "Presenza annullata.")), "ok");
   } else {
    prev.forEach(x => { x.p.checkin = x.checkin; });
    flash("org-fa", "⚠️ " + (res?.errore || "Aggiornamento presenza non riuscito."), "err");
   }
   _orgRerenderCheckin(evId, sessId);
  })
  .withFailureHandler(err => {
   prev.forEach(x => { x.p.checkin = x.checkin; });
   _orgRerenderCheckin(evId, sessId);
   flash("org-fa", "❌ " + (err?.message || err), "err");
  })
  .orgConfermaPresenza(String(evId || ""), String(sessId || ""), String(tavoloId || ""), bid, String(uuid || ""), wanted);
}

/** Riga tabella elenco prenotazioni mappa (GDR/GDT). */
function _mappaPrenRowHtml(p, idx, opts) {
 const o = opts || {};
 const nomeRaw = String(p?.nome || "").trim();
 const email = String(p?.email || "").trim();
 const cell = String(p?.cellulare || "").trim();
 const uuid = String(p?.uuid || "").trim();
 const anon = !email && (!nomeRaw || /^ospite$/i.test(nomeRaw));
 const nomeShow = anon ? (o.anonLabel || "Anonimo") : (nomeRaw || "–");
 const badgePrima = anon ? "" : _orgBadgePrimaVoltaHtml(uuid, email);
 const nomeHtml = anon
 ? `<div class="td-n">${escapeHtml(nomeShow)}</div>`
 : `<div class="td-n mtav-pnome-wrap">${_orgNomeClickableHtml(nomeShow, uuid, email)}${badgePrima}</div>`;
 const tavoloLbl = o.tavoloLabel != null
 ? String(o.tavoloLabel)
 : (_estraiNomeTavoloDaStringa(p?.tavolo) || String(p?.tavolo || "–") || "–");
 const fasce = labelsFasciaCsv(p?.fasciaEta) || "–";
 const quando = formatDateTimeShort(p?.timestamp) || "–";
 const fonte = String(p?.fonte || "").trim();
 const extra = _mappaPrenExtraSummary(p);
 const extraHtml = extra.text
 ? `<div class="td-l"><span style="color:var(--ash)">${escapeHtml(extra.label || "Extra")}:</span> ${escapeHtml(extra.text)}</div>`
 : `<div class="td-l" style="color:var(--ash)">–</div>`;
 const stato = p?.isListaAttesa
 ? `<span class="badge b-att">⏳</span>`
 : `<span class="badge b-ok">✅</span>${p?.checkin ? `<div class="td-l" style="color:#2e7d32;margin-top:4px">🚪 presente</div>` : ""}`;
 return `<tr>
 <td>${nomeHtml}${fonte ? `<div class="td-l">fonte: ${escapeHtml(fonte)}</div>` : ""}</td>
 <td><div class="td-l">${escapeHtml(email || "–")}</div>${cell ? `<div class="td-l">${escapeHtml(cell)}</div>` : ""}</td>
 <td style="max-width:200px">${escapeHtml(tavoloLbl)}</td>
 <td style="text-align:center;font-family:'DM Mono',monospace;font-size:12px">${escapeHtml(String(p?.numPersone != null ? p.numPersone : "–"))}</td>
 <td style="font-size:12px;color:var(--smoke)">${escapeHtml(fasce)}</td>
 <td style="font-size:12px;max-width:220px">${extraHtml}</td>
 <td style="font-size:12px;color:var(--ash)">${escapeHtml(quando)}</td>
 <td style="text-align:center;white-space:nowrap"><button type="button" class="btn btn-o btn-sm" onclick="apriDettaglioPrenMappa(${idx})">Dettagli</button></td>
 <td>${stato}</td>
 </tr>`;
}

function apriDettaglioPrenMappa(idx) {
 const list = window._mappaPrenDettaglioList;
 if (!list || list[idx] === undefined) return;
 const p = list[idx];
 window._mappaPrenDettaglioIdx = idx;
 const sub = document.getElementById("org-mappa-pren-detail-sub");
 const body = document.getElementById("org-mappa-pren-detail-body");
 if (!body) return;

 const tav = escapeHtml(String(p.tavolo || "–"));
 const quando = formatDateTimeShort(p.timestamp) || "–";
 const badgePrima = _orgBadgePrimaVoltaHtml(p.uuid, p.email);
 if (sub) {
 sub.innerHTML = `<strong>${escapeHtml(p.nome || "–")}</strong>${badgePrima ? " " + badgePrima : ""} · ${tav}<br><span style="font-size:12px;color:var(--ash)">${escapeHtml(quando)}</span>`;
 }

 const arr = Array.isArray(p.partecipanti) ? p.partecipanti : [];
 const { partecipantiNomi } = mtavSplitPartecipantiExtra(arr);
 const coPrenDettaglio = arr
 .filter(x => {
 const em = String(x?.email || "").trim().toLowerCase();
 return em && em.indexOf("@") > 0;
 })
 .map(x => {
 const line = _formatPartecipanteOrgDisplay(x);
 const em = String(x?.email || "").trim();
 return line && line !== "—" ? `${line} (${em})` : em;
 })
 .filter(Boolean);

 const blocco = (label, classMod, testo, vuotoMsg) => {
 const inner = testo
 ? "<div class=\"mappa-pren-det-txt\">" + escapeHtml(testo) + "</div>"
 : "<div class=\"mappa-pren-det-muted\">" + vuotoMsg + "</div>";
 return "<div class=\"mappa-pren-det-block\">" +
 "<div class=\"mappa-pren-det-label " + classMod + "\">" + label + "</div>" +
 inner +
 "</div>";
 };

 const titCell = escapeHtml(String(p.cellulare || "").trim());
 const titEmail = escapeHtml(String(p.email || "").trim());
 const titNome = escapeHtml(String(p.nome || "").trim());
 const ownerPart = p.prenotantePartecipa !== false;
 const nomiEff = mtavNomiPartecipantiEffettivi(p);
 const uuid = escapeHtml(String(p.uuid || "").trim());
 const bookingId = escapeHtml(String(p.bookingId || "").trim());
 const fonte = escapeHtml(String(p.fonte || "").trim());

 let extraHtml = "";
 if (PARTECIPANTI_MULTI_ENABLED) {
 if (!ownerPart && nomiEff.length) {
 extraHtml = blocco("Partecipante/i al tavolo", "parti", nomiEff.join(", "), "—");
 } else {
 extraHtml =
 blocco("Partecipanti", "parti", partecipantiNomi.join(", "), "Nessun partecipante aggiunto senza email.") +
 blocco("Co-prenotanti", "copren", coPrenDettaglio.join(", "), "Nessun co-prenotante con email.");
 }
 } else {
 extraHtml = "<div class=\"mappa-pren-det-block\"><div class=\"mappa-pren-det-muted\">Elenco partecipanti extra non disponibile: co-prenotanti disattivati.</div></div>";
 }

 const titLabel = ownerPart ? "Titolare" : "Prenotante (non partecipa)";
 const titNota = !ownerPart && !nomiEff.length
 ? "<div class=\"mappa-pren-det-muted\" style=\"margin-top:6px\">Partecipante non indicato nel foglio Partecipanti.</div>"
 : "";
 const accoglienzaHtml = p.isListaAttesa
 ? "<div class=\"mappa-pren-det-block\"><div class=\"mappa-pren-det-label\">Accoglienza</div><div class=\"mappa-pren-det-muted\">In lista d'attesa: nessun check-in.</div></div>"
 : "<div class=\"mappa-pren-det-block\">" +
   "<div class=\"mappa-pren-det-label\">Accoglienza</div>" +
   "<div class=\"mappa-pren-det-txt\">" + (p.checkin ? "✅ Presenza confermata" : "⏳ Arrivo non ancora confermato") + "</div>" +
   "<div style=\"margin-top:8px\">" + _orgCheckinBtnHtml(p, { evId: p.eventId, sessId: p.sessione, tavoloId: _estraiIdTavoloDaStringa(p.tavolo) }) + "</div>" +
   "</div>";
 const metaBits = [
 "Persone: <strong>" + escapeHtml(String(p.numPersone || "–")) + "</strong>",
 "Fasce: " + escapeHtml(labelsFasciaCsv(p.fasciaEta) || "–"),
 fonte ? ("Fonte: " + fonte) : "",
 uuid ? ("UUID: <code style=\"font-size:11px\">" + uuid + "</code>") : "",
 bookingId ? ("Booking: <code style=\"font-size:11px\">" + bookingId + "</code>") : ""
 ].filter(Boolean).join("<br>");

 body.innerHTML =
 "<div class=\"mappa-pren-det-block\">" +
 "<div class=\"mappa-pren-det-label\">" + titLabel + "</div>" +
 "<div class=\"mappa-pren-det-txt\">" + titNome + (badgePrima ? " " + badgePrima : "") + "</div>" +
 "<div class=\"mappa-pren-det-txt\" style=\"margin-top:4px;font-size:12px\">📧 " + (titEmail || "—") + (titCell ? "<br>📱 " + titCell : "") + "</div>" +
 titNota +
 "</div>" +
 "<div class=\"mappa-pren-det-block\">" +
 "<div class=\"mappa-pren-det-label\">Prenotazione</div>" +
 "<div class=\"mappa-pren-det-txt\">" + metaBits + "</div>" +
 "</div>" +
 accoglienzaHtml +
 extraHtml;

 show("org-mappa-pren-detail-overlay");
}

/** Vista org per sessioni senza tavoli: solo elenco iscrizioni (posti), niente card tavolo. */
function renderMappaIscrizioniSessione(evId, sessId, sessNome, sessMeta) {
 const { prenotazioni } = datiOrg;
 const grid = document.getElementById("mappa-tavoli-grid");
 const prenSess = (prenotazioni || []).filter(
 p => p.eventId === evId && _normSessJS(p.sessione) === _normSessJS(sessId) && !p.isListaAttesa
 );
 const totPersone = prenSess.reduce((s, p) => s + (parseInt(p.numPersone || 1, 10) || 1), 0);
 const tipoLabel = labelTipoSessione(sessMeta?.tipoSessione || "GDT");

 const personeHtml = prenSess.length
 ? prenSess.map(p => {
 const numP = parseInt(p.numPersone || 1, 10) || 1;
 const nomeRaw = String(p.nome || "").trim();
 const email = String(p.email || "").trim();
 const uuid = String(p.uuid || "").trim();
 const anon = !email && (!nomeRaw || /^ospite$/i.test(nomeRaw));
 const nomeShow = anon ? "Iscrizione anonima" : (nomeRaw || "—");
 const iniziale = anon ? "?" : (nomeShow[0] || "?").toUpperCase();
 const quando = formatDateTimeShort(p.timestamp);
 const badgePrima = anon ? "" : _orgBadgePrimaVoltaHtml(uuid, email);
 const nomeHtml = anon
 ? `<div class="mtav-pnome">${escapeHtml(nomeShow)}</div>`
 : `<div class="mtav-pnome-wrap">${_orgNomeClickableHtml(nomeShow, uuid, email)}</div>`;
 return `<div class="mtav-persona">
 <div class="mtav-persona-top">
 <div class="mtav-avatar">${escapeHtml(iniziale)}</div>
 <div class="mtav-pinfo">
 ${nomeHtml}
 ${email ? `<div class="mtav-pdetail">${escapeHtml(email)}</div>` : `<div class="mtav-pdetail" style="font-style:italic;color:var(--ash)">Nessuna email</div>`}
 ${quando ? `<div class="mtav-pdetail">${escapeHtml(quando)}</div>` : ""}
 </div>
 <div class="mtav-pbadges">${badgePrima}<div class="mtav-pnum">×${numP}</div></div>
 </div>
 <div class="mtav-persona-actions">${_orgCheckinBtnHtml(p, { evId, sessId, tavoloId: "" })}</div>
 </div>`;
 }).join("")
 : `<div style="font-size:13px;color:var(--ash);font-style:italic;padding:10px 4px">Nessuna iscrizione ancora</div>`;

 if (grid) {
 grid.innerHTML = `
 <div class="mtav-card" style="grid-column:1/-1">
 <div class="mtav-head">
 <div>
 <div class="mtav-nome">Iscrizioni · ${escapeHtml(sessNome || sessId || "Sessione")}</div>
 <div class="mtav-id"><span class="tipo-badge t-gdt">${escapeHtml(tipoLabel)}</span>
 <span style="margin-left:8px;font-size:12px;color:var(--ash)">Sessione senza tavoli</span>
 </div>
 </div>
 <div style="text-align:right">
 <div class="mtav-count">${totPersone}</div>
 <div class="mtav-count-sub">persone</div>
 </div>
 </div>
 <div class="mtav-body">
 <div class="mtav-partecipanti">${personeHtml}</div>
 <div style="margin-top:12px;font-size:12px;color:var(--ash)">${prenSess.length} iscrizion${prenSess.length === 1 ? "e" : "i"}</div>
 <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">${_orgFeedbackBtnHtml(evId, sessId, "GDT")}
 <button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();apriOrgAggiungiIscritto('${String(evId || "").replace(/'/g,"\\'")}','${String(sessId || "").replace(/'/g,"\\'")}','SESSIONE_LIBERA')">➕ Aggiungi iscrizione</button>
 </div>
 </div>
 </div>`;
 }

 // Tabella elenco (ingresso: tavolo = Ingresso)
 const prenSection = document.getElementById("mappa-pren-section");
 const prenTbody = document.getElementById("mappa-pren-tbody");
 if (prenSection && prenTbody) {
 prenSection.classList.remove("hidden");
 window._mappaPrenDettaglioList = prenSess.slice();
 if (prenSess.length) {
 prenTbody.innerHTML = prenSess.map((p, idx) =>
 _mappaPrenRowHtml(p, idx, { tavoloLabel: "Ingresso", anonLabel: "Anonimo" })
 ).join("");
 } else {
 prenTbody.innerHTML = `<tr><td colspan="9"><div style="font-size:13px;color:var(--ash);font-style:italic;padding:8px 0">Nessuna iscrizione per questa sessione.</div></td></tr>`;
 }
 }

 const attesaGrid = document.getElementById("mappa-attesa-grid");
 const attesaEmpty = document.getElementById("mappa-attesa-empty");
 const prenAttesa = (prenotazioni || []).filter(
 p => p.eventId === evId && _normSessJS(p.sessione) === _normSessJS(sessId) && p.isListaAttesa
 ).slice().sort((a, b) => {
 const da = new Date(a.timestamp || 0).getTime();
 const db = new Date(b.timestamp || 0).getTime();
 return da - db;
 });
 // Posti liberi in sessione (maxPosti 0/assente = capienza illimitata)
 const maxPostiSess = parseInt(sessMeta?.maxPosti || 0, 10) || 0;
 const sessIllimitata = maxPostiSess < 1;
 const libSess = sessIllimitata ? Infinity : Math.max(0, maxPostiSess - totPersone);
 if (attesaGrid && attesaEmpty) {
 if (prenAttesa.length) {
 attesaGrid.classList.remove("hidden");
 attesaEmpty.classList.add("hidden");
 attesaGrid.innerHTML = prenAttesa.map((p, idx) => {
 const nomeRaw = String(p.nome || "").trim();
 const email = String(p.email || "").trim();
 const anon = !email && (!nomeRaw || /^ospite$/i.test(nomeRaw));
 const nomeShow = anon ? "Iscrizione anonima" : (nomeRaw || "—");
 const iniziale = anon ? "?" : (nomeShow[0] || "?").toUpperCase();
 const numP = parseInt(p.numPersone || 1, 10) || 1;
 const quando = formatDateTimeShort(p.timestamp);
 const det = [p.fasciaEta, "×" + numP].filter(Boolean).join(" · ");
 const canAct = !!String(p.uuid || "").trim();
 const jsEv = _orgJsArg(evId);
 const jsSess = _orgJsArg(sessId);
 const jsUuid = _orgJsArg(p.uuid);
 const jsTav = _orgJsArg(p.tavolo);
 const jsBid = _orgJsArg(p.bookingId);
 const jsNome = _orgJsArg(p.nome);
 let btnAssign = "";
 if (canAct && libSess >= numP) {
 btnAssign = `<button type="button" class="btn btn-s btn-sm" onclick="event.stopPropagation();orgAssegnaDaListaAttesa('${jsEv}','${jsSess}','SESSIONE_LIBERA','${jsUuid}')">✔ Assegna posto</button>`;
 } else if (canAct) {
 btnAssign = `<span class="mtav-attesa-warn" title="Richiede ${numP} posti, liberi ${libSess}">${libSess > 0 ? `Posti insufficienti (${numP} richiesti, ${libSess} liberi)` : "Sessione piena: aumenta i posti massimi per assegnare"}</span>`;
 }
 const btnCanc = canAct
 ? `<button type="button" class="btn btn-d btn-sm" onclick="event.stopPropagation();orgCancellaPrenotazione('${jsEv}','${jsSess}','${jsUuid}','${jsTav}','${jsBid}','${jsNome}')">Cancella</button>`
 : `<button type="button" class="btn btn-d btn-sm" disabled title="UUID non disponibile">Cancella</button>`;
 const azioniHtml = `<div class="mtav-attesa-actions" style="margin-top:8px">${btnAssign}${btnCanc}</div>`;
 return `<div class="mattesa-card">
 <div class="mattesa-avatar">${escapeHtml(iniziale)}</div>
 <div class="mattesa-info">
 <div class="mattesa-nome">#${idx + 1} · ${escapeHtml(nomeShow)}</div>
 ${email ? `<div class="mattesa-det">${escapeHtml(email)}</div>` : ""}
 ${det ? `<div class="mattesa-det">${escapeHtml(det)}</div>` : ""}
 ${quando ? `<div class="mattesa-det" style="margin-top:2px;font-size:11px">${escapeHtml(quando)}</div>` : ""}
 ${azioniHtml}
 </div>
 </div>`;
 }).join("");
 } else {
 attesaGrid.classList.add("hidden");
 attesaGrid.innerHTML = "";
 attesaEmpty.classList.remove("hidden");
 attesaEmpty.textContent = "Nessuno in lista d'attesa per questa sessione.";
 }
 }
}

function renderMappaTavoli(evId, sessId, sessNome) {
 const { prenotazioni, tavoliPerEvento } = datiOrg;
 const evMeta = (datiOrg.eventiConSessioni || []).find(e => e.eventId === evId);
 const sessMeta = (evMeta?.sessioni || []).find(s => _normSessJS(s.sessioneId) === _normSessJS(sessId));
 if (sessioneSenzaTavoli(sessMeta)) {
 renderMappaIscrizioniSessione(evId, sessId, sessNome, sessMeta);
 return;
 }
 const tavoli = (tavoliPerEvento[evId] || {})[sessId] || [];
 const grid = document.getElementById("mappa-tavoli-grid");

 const prenSess = prenotazioni.filter(p => p.eventId === evId && _normSessJS(p.sessione) === _normSessJS(sessId));
 const prenConfermate = prenSess.filter(p => !p.isListaAttesa);
 const prenAttesa = prenSess.filter(p => p.isListaAttesa);
 const prenAttesaOrd = prenAttesa.slice().sort((a,b) => {
 const da = new Date(a.timestamp || 0).getTime();
 const db = new Date(b.timestamp || 0).getTime();
 return da - db;
 }).map((p, idx) => ({ ...p, _pos: idx + 1 }));

 if (!tavoli.length) {
 grid.innerHTML = `<div class="mev-empty" style="grid-column:1/-1"><span class="empty-icon">🎲</span>Nessun tavolo configurato per questa sessione.</div>`;
 } else {
 grid.innerHTML = `<div style="grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:6px">${_orgFeedbackBtnHtml(evId, sessId, "GDR")}</div>` + tavoli.map((t, i) => {
 const prenTav = prenSess.filter(p => {
 const idTav = _resolveTavoloIdPerMappa(p.tavolo, tavoli);
 return idTav === t.id && !p.isListaAttesa;
 });
 const occFromPren = prenTav.reduce((sum, p) => sum + (parseInt(p.numPersone || 1, 10) || 1), 0);
 const occCfg = parseInt(t.occupati, 10) || 0;
 const occ = Math.min(Math.max(occFromPren, occCfg), parseInt(t.max, 10) || 0);
 const pct = t.max > 0 ? Math.round(occ / t.max * 100) : 0;
 const lib = Math.max(0, t.max - occ);
 const barColor = pct >= 100 ? '#c62828' : pct >= 70 ? '#e65100' : '#2e7d32';
 const libCls = lib === 0 ? 'zero' : lib <= 2 ? 'pochi' : 'ok';
 const libTxt = lib === 0 ? '🔴 Tavolo pieno' : lib === 1 ? '🟠 1 posto libero' : `🟢 ${lib} posti liberi`;
 const tavIdFull = String(t.id || "");
 const attesaTav = prenAttesaOrd.filter(p => {
 const prefIds = _parsePrefIdsFromTavolo(p.tavolo);
 if (!prefIds.length) return false;
 return prefIds.some(pid => {
 const resolved = _resolveTavoloIdPerMappa(pid, tavoli);
 return resolved === t.id;
 });
 });

 const tavKey = String(t.id).replace(/[^a-z0-9_]/gi, "_");
 const promDefault = Math.min(attesaTav.length, 5) || 3;
 const annullaBtnHtml = WAITLIST_ACTIONS_ENABLED
 ? `<button class="btn btn-d btn-sm" onclick="event.stopPropagation();annullaListeAttesaPerTavolo('${evId}','${sessId}','${t.id}')">🚫 Annulla liste</button>`
 : "";
 const promemoriaHtml = WAITLIST_PROMEMORIA_ENABLED
 ? `
 <span style="font-size:12px;color:var(--smoke);white-space:nowrap">📣 primi</span>
 <input type="number" min="1" max="50" value="${promDefault}" id="mtav-rem-n-${tavKey}" style="width:64px;padding:4px 6px;font-size:13px">
 <button class="btn btn-s btn-sm" onclick="event.stopPropagation();inviaPromemoriaListaAttesa('${evId}','${sessId}','${t.id}')">📧 Invia</button>
 `
 : "";

 const azioniListaAttesa = annullaBtnHtml && promemoriaHtml
 ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
 <div style="display:flex;align-items:center;gap:10px">${annullaBtnHtml}</div>
 <div style="display:flex;align-items:center;gap:8px">${promemoriaHtml}</div>
 </div>`
 : annullaBtnHtml
 ? `<div style="display:flex;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:10px">${annullaBtnHtml}</div>`
 : promemoriaHtml
 ? `<div style="display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-bottom:10px">${promemoriaHtml}</div>`
 : "";

 const personeHtml = prenTav.length
 ? prenTav.map(p => {
 const numP = parseInt(p.numPersone||1);
 const card = mtavPersonaCardDisplay(p);
 const canAct = !!String(p.uuid || "").trim();
 const jsEv = _orgJsArg(evId);
 const jsSess = _orgJsArg(sessId);
 const jsUuid = _orgJsArg(p.uuid);
 const jsTav = _orgJsArg(p.tavolo);
 const jsNum = String(parseInt(p.numPersone || 1, 10) || 1);
 const jsFascia = _orgJsArg(p.fasciaEta);
 const jsNome = _orgJsArg(p.nome);
 const jsBid = _orgJsArg(p.bookingId);
 const btnMove = canAct
 ? `<button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();apriOrgSpostaPrenotazione('${jsEv}','${jsSess}','${jsUuid}','${jsTav}','${jsNum}','${jsFascia}','${jsNome}','${jsBid}')">Sposta</button>`
 : `<button type="button" class="btn btn-o btn-sm" disabled title="UUID non disponibile">Sposta</button>`;
 const btnCanc = canAct
 ? `<button type="button" class="btn btn-d btn-sm" onclick="event.stopPropagation();orgCancellaPrenotazione('${jsEv}','${jsSess}','${jsUuid}','${jsTav}','${jsBid}','${jsNome}')">Cancella</button>`
 : `<button type="button" class="btn btn-d btn-sm" disabled title="UUID non disponibile">Cancella</button>`;
 return `<div class="mtav-persona">
 <div class="mtav-persona-top">
 <div class="mtav-avatar">${card.iniziale}</div>
 <div class="mtav-pinfo">
 <div class="mtav-pnome-wrap">${card.nomeHtml || `<span class="mtav-pnome">${escapeHtml(card.nome)}</span>`}</div>
 ${card.pinfoHtml}
 ${card.extraPartHtml}
 </div>
 <div class="mtav-pbadges">${card.badgePrima || ""}<div class="mtav-pnum">×${numP}</div></div>
 </div>
 <div class="mtav-persona-actions">${_orgCheckinBtnHtml(p, { evId, sessId, tavoloId: t.id })}${btnMove}${btnCanc}</div>
 </div>`;
 }).join('')
 : `<div style="font-size:12px;color:var(--ash);font-style:italic;padding:8px 4px">Nessun partecipante ancora</div>`;

 const attesaHtml = attesaTav.length
 ? `<div class="mtav-attesa-list">
 <div class="mtav-attesa-title">⏳ Lista d'attesa per questo tavolo (${attesaTav.length})</div>
 ${azioniListaAttesa}
 ${attesaTav.map(p => {
 const iniziale = (p.nome||'?')[0].toUpperCase();
 const numP = parseInt(p.numPersone||1);
 const fascia = labelsFasciaCsv(p.fasciaEta) || '';
 const email = String(p.email || '').trim();
 const pos = p._pos || "?";
 const quando = formatDateTimeShort(p.timestamp);
 const canAssignManual = lib > 0 && numP <= lib;
 const btnAssign = canAssignManual
 ? `<button type="button" class="btn btn-s btn-sm" onclick="event.stopPropagation();orgAssegnaDaListaAttesa('${evId}','${sessId}','${t.id}','${(p.uuid||'').replace(/\"/g,'&quot;')}')">✔ Assegna posto</button>`
 : (lib > 0 && numP > lib
 ? `<span class="mtav-attesa-warn" title="Richiede ${numP} posti, liberi ${lib}">Posti insufficienti (${numP} richiesti, ${lib} liberi)</span>`
 : '');
 const canMoveWait = !!String(p.uuid || "").trim();
 const jsEvW = _orgJsArg(evId);
 const jsSessW = _orgJsArg(sessId);
 const jsUuidW = _orgJsArg(p.uuid);
 const jsTavW = _orgJsArg(p.tavolo);
 const jsNumW = String(parseInt(p.numPersone || 1, 10) || 1);
 const jsFasciaW = _orgJsArg(p.fasciaEta);
 const jsNomeW = _orgJsArg(p.nome);
 const jsBidW = _orgJsArg(p.bookingId);
 const btnMoveWait = canMoveWait
 ? `<button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();apriOrgSpostaPrenotazione('${jsEvW}','${jsSessW}','${jsUuidW}','${jsTavW}','${jsNumW}','${jsFasciaW}','${jsNomeW}','${jsBidW}')">Sposta</button>`
 : `<button type="button" class="btn btn-o btn-sm" disabled title="UUID non disponibile">Sposta</button>`;
 const btnCancWait = canMoveWait
 ? `<button type="button" class="btn btn-d btn-sm" onclick="event.stopPropagation();orgCancellaPrenotazione('${jsEvW}','${jsSessW}','${jsUuidW}','${jsTavW}','${jsBidW}','${jsNomeW}')">Cancella</button>`
 : `<button type="button" class="btn btn-d btn-sm" disabled title="UUID non disponibile">Cancella</button>`;
 const azioniWaitHtml = (btnAssign || btnMoveWait || btnCancWait)
 ? `<div class="mtav-attesa-actions">${btnAssign}${btnMoveWait}${btnCancWait}</div>`
 : "";
 const { partecipantiNomi: waPart, coPrenotantiNomi: waCop } = mtavSplitPartecipantiExtra(p.partecipanti);
 const waCoPrenDettaglio = (Array.isArray(p.partecipanti) ? p.partecipanti : [])
 .filter(x => {
 const em = String(x?.email || "").trim();
 return !!em && em.indexOf("@") > 0;
 })
 .map(x => {
 const label = _formatPartecipanteOrgDisplay(x);
 const em = String(x?.email || "").trim();
 return (label && label !== "—") ? `${label} · ${em}` : em;
 })
 .filter(Boolean);
 const extraWaitPartHtml = PARTECIPANTI_MULTI_ENABLED && (waPart.length || waCop.length)
 ? `<div class="mtav-pdetail-stack">${waPart.length
 ? `<div class="mtav-pdetail-parti"><span class="mtav-plabel">Partecipanti</span>${mtavRenderNomiChips(waPart)}</div>`
 : ""}${waCop.length
 ? `<div class="mtav-pdetail-copren"><span class="mtav-plabel">Co-prenotanti</span>${mtavRenderNomiChips(waCoPrenDettaglio.length ? waCoPrenDettaglio : waCop)}</div>`
 : ""}</div>`
 : "";
 const badgeWait = _orgBadgePrimaVoltaHtml(p.uuid, email);
 const nomeWaitHtml = _orgNomeClickableHtml((p.nome || "–"), p.uuid, email);
 return `<div class="mtav-persona mtav-attesa">
 <div class="mtav-attesa-top">
 <div class="mtav-avatar">${iniziale}</div>
 <div class="mtav-pinfo">
 <div class="mtav-pnome-wrap"><span style="font-family:var(--font-m);font-size:11px;color:var(--ash);margin-right:4px">#${pos}</span>${nomeWaitHtml}</div>
 ${email ? `<div class="mtav-pdetail">${escapeHtml(email)}</div>` : ''}
 ${fascia || quando ? `<div class="mtav-pdetail">${[fascia ? escapeHtml(fascia) : "", quando ? escapeHtml(quando) : ""].filter(Boolean).join(" · ")}</div>` : ''}
 ${extraWaitPartHtml}
 </div>
 <div class="mtav-pbadges">${badgeWait}<div class="mtav-pnum">×${numP}</div></div>
 </div>
 ${azioniWaitHtml}
 </div>`;
 }).join('')}
 </div>`
 : '';

 return `
 <div class="mtav-card" style="animation-delay:${i*.05}s" title="${escapeHtml(tavIdFull)}">
 <div class="mtav-head">
 <div>
 <div class="mtav-nome">${escapeHtml(t.gioco || t.id || "Tavolo")}</div>
 <div class="mtav-id"><span class="tipo-badge ${t.tipo==='GDR'?'t-gdr':'t-gdt'}">${escapeHtml(t.tipo||'GDR')}</span></div>
 <label class="mtav-vis" onclick="event.stopPropagation()">
 <input type="checkbox" ${t.attivo === false ? "" : "checked"} onchange="orgToggleTavoloVisibilitaPrenotazioni('${String(evId || "").replace(/'/g,"\\'")}','${String(sessId || "").replace(/'/g,"\\'")}','${String(t.id || "").replace(/'/g,"\\'")}', this.checked, this)">
 Visibile nelle prenotazioni
 </label>
 </div>
 <div style="text-align:right">
 <div class="mtav-count">${occ}/${t.max}</div>
 <div class="mtav-count-sub">posti</div>
 </div>
 </div>
 <div class="mtav-bar-wrap"><div class="mtav-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
 <div class="mtav-body">
 <div class="mtav-partecipanti">${personeHtml}</div>
 ${attesaHtml}
 <div class="mtav-liberi ${libCls}">${libTxt}</div>
 <div class="mtav-card-actions">
 <button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();apriOrgModificaTavolo('${String(evId || "").replace(/'/g,"\\'")}','${String(sessId || "").replace(/'/g,"\\'")}','${String(t.id || "").replace(/'/g,"\\'")}')">Modifica</button>
 <button type="button" class="btn btn-o btn-sm" onclick="event.stopPropagation();apriOrgAggiungiIscritto('${String(evId || "").replace(/'/g,"\\'")}','${String(sessId || "").replace(/'/g,"\\'")}','${String(t.id || "").replace(/'/g,"\\'")}')">+ Iscritto</button>
 </div>
 </div>
 </div>`;
 }).join('');
 }

 // Tabella prenotazioni sessione (tutte le info)
 const prenSection = document.getElementById("mappa-pren-section");
 const prenTbody = document.getElementById("mappa-pren-tbody");
 if (prenSection && prenTbody) {
 prenSection.classList.remove("hidden");
 if (prenConfermate.length) {
 window._mappaPrenDettaglioList = prenConfermate.slice();
 prenTbody.innerHTML = prenConfermate.map((p, idx) => _mappaPrenRowHtml(p, idx)).join("");
 } else {
 window._mappaPrenDettaglioList = [];
 prenTbody.innerHTML = `<tr><td colspan="9"><div style="font-size:13px;color:var(--ash);font-style:italic;padding:8px 0">Nessuna prenotazione confermata per questa sessione.</div></td></tr>`;
 }
 }

 // Lista d'attesa (sempre visibile, con contatti)
 const attesaGrid = document.getElementById("mappa-attesa-grid");
 const attesaEmpty = document.getElementById("mappa-attesa-empty");
 if (attesaGrid && attesaEmpty) {
 if (prenAttesaOrd.length) {
 attesaGrid.classList.remove("hidden");
 attesaEmpty.classList.add("hidden");
 attesaGrid.innerHTML = prenAttesaOrd.map((p, idx) => {
 const iniziale = (p.nome||'?')[0].toUpperCase();
 const numP = parseInt(p.numPersone||1);
 const detParts = [p.fasciaEta, '×' + numP].filter(Boolean).join(' · ');
 const prefIds = _parsePrefIdsFromTavolo(p.tavolo);
 const prefText = prefIds.length ? ('Tavoli preferiti: ' + prefIds.join(', ')) : '';
 const pos = p._pos || (idx + 1);
 const quando = formatDateTimeShort(p.timestamp);
 return `<div class="mattesa-card">
 <div class="mattesa-avatar">${iniziale}</div>
 <div class="mattesa-info">
 <div class="mattesa-nome">#${pos} · ${(p.nome||'–').replace(/</g,'&lt;')}</div>
 <div class="mattesa-det">${detParts.replace(/</g,'&lt;')}</div>
 ${quando ? `<div class="mattesa-det" style="margin-top:2px;font-size:11px">${quando.replace(/</g,'&lt;')}</div>` : ''}
 ${prefText ? `<div class="mattesa-det" style="margin-top:2px;font-size:11px;color:var(--smoke)">${prefText.replace(/</g,'&lt;')}</div>` : ''}
 </div>
 </div>`;
 }).join('');
 } else {
 attesaGrid.classList.add("hidden");
 attesaGrid.innerHTML = '';
 attesaEmpty.classList.remove("hidden");
 }
 }
 _renderMappaActionPanel();
}

function orgToggleTavoloVisibilitaPrenotazioni(evId, sessId, tavoloId, checked, inputEl) {
 const visibile = !!checked;
 if (inputEl) inputEl.disabled = true;
 beginActionOverlay("Aggiornamento visibilità tavolo…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (inputEl) inputEl.disabled = false;
 if (res && res.ok) {
 try {
 const tavoliSess = (((datiOrg || {}).tavoliPerEvento || {})[evId] || {})[sessId] || [];
 const tav = tavoliSess.find(t => String(t.id || "") === String(tavoloId || ""));
 if (tav) tav.attivo = visibile;
 } catch (_e) {}
 flash("org-fa", "✅ " + (res.messaggio || "Visibilità aggiornata."), "ok");
 } else {
 if (inputEl) inputEl.checked = !visibile;
 flash("org-fa", "⚠️ " + (res?.errore || "Impossibile aggiornare la visibilità."), "err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (inputEl) {
 inputEl.disabled = false;
 inputEl.checked = !visibile;
 }
 flash("org-fa", "❌ " + (err.message || err), "err");
 })
 .orgSetTavoloVisibilePrenotazioni(evId, sessId, tavoloId, visibile);
}

let ORG_TAV_EDIT_AVV_CACHE = {};
function _normOrgMasterKey(v) {
 return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function _cleanOrgMasterLegacyLabel(v) {
 const raw = String(v || "").trim();
 if (!raw) return "";
 return raw
 .replace(/\s*\(non in anagrafica\)\s*$/i, "")
 .replace(/\s+[—-]\s+.*/g, "")
 .trim();
}
function _orgMasterDisplayName(m) {
 const nick = String(m?.nick || "").trim();
 const nome = String(m?.nome || "").trim();
 return nick || nome;
}
function _isUuidLike(v) {
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || "").trim());
}
function _orgMasterOptionValue(m, fallbackLabel) {
 const id = String(m?.masterId || "").trim();
 return id ? `id:${id}` : "";
}
function populateOrgTavEditMasterSelect(masterCorrente) {
 const sel = document.getElementById("org-tav-edit-master-select");
 if (!sel) return null;
 const list = Array.isArray(datiOrg?.masters) ? datiOrg.masters.slice() : [];
 list.sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "it"));
 const cur = String(masterCorrente || "").trim();
 const curId = cur.startsWith("id:") ? cur.slice(3) : cur;
 let matched = null;
 let html = `<option value="">Seleziona master</option>`;
 list.forEach((m) => {
 const nome = String(m?.nome || "").trim();
 const nick = String(m?.nick || "").trim();
 const labelRaw = _orgMasterDisplayName(m);
 const id = String(m?.masterId || "").trim();
 const label = String(labelRaw || "").trim();
 const friendlyLabel = (() => {
 if (nick && nome && _normOrgMasterKey(nick) !== _normOrgMasterKey(nome)) return `${nick} — ${nome}`;
 if (label && !_isUuidLike(label)) return label;
 if (nick && !_isUuidLike(nick)) return nick;
 if (nome && !_isUuidLike(nome)) return nome;
 if (id && !_isUuidLike(id)) return id;
 return label || id || "Master";
 })();
 if (!friendlyLabel) return;
 const optValue = _orgMasterOptionValue(m, friendlyLabel);
 if (!optValue) return;
 if (!matched && id && curId && id === curId) matched = optValue;
 html += `<option value="${escapeHtml(optValue)}" data-master-label="${escapeHtml(friendlyLabel)}">${escapeHtml(friendlyLabel)}</option>`;
 });
 sel.innerHTML = html;
 sel.value = matched || "";
 return sel.value;
}
function _buildOrgTavEditAvventuraOptions(list, selectedId) {
 const cur = String(selectedId || "").trim().toLowerCase();
 const base = [`<option value="">Seleziona avventura</option>`];
 (Array.isArray(list) ? list : []).forEach((a) => {
 const id = String(a?.avventuraId || "").trim();
 const titolo = String(a?.titoloAvventura || "").trim();
 const sistema = String(a?.sistemaGioco || "").trim();
 const label = titolo || sistema || id || "Avventura";
 const extra = titolo && sistema ? ` · ${sistema}` : "";
 base.push(`<option value="${escapeHtml(id)}"${id.toLowerCase()===cur ? " selected" : ""}>${escapeHtml(label + extra)}</option>`);
 });
 return base.join("");
}
function orgApplyAvventuraToTavoloEdit(avv) {
 if (!avv || typeof avv !== "object") return;
 const titolo = document.getElementById("org-tav-edit-titolo");
 const sistemaSel = document.getElementById("org-tav-edit-sistema");
 const desc = document.getElementById("org-tav-edit-desc");
 const livello = document.getElementById("org-tav-edit-livello");
 const tema = document.getElementById("org-tav-edit-tema");
 const tono = document.getElementById("org-tav-edit-tono");
 const tematiche = document.getElementById("org-tav-edit-tematiche");
 const ambientazione = document.getElementById("org-tav-edit-ambientazione");
 const mostraMaster = document.getElementById("org-tav-edit-show-master");
 if (titolo && String(avv.titoloAvventura || "").trim()) titolo.value = String(avv.titoloAvventura || "").trim();
 if (sistemaSel && String(avv.sistemaGioco || "").trim()) {
 const val = String(avv.sistemaGioco || "").trim();
 const found = Array.from(sistemaSel.options || []).some(o => String(o.value || "").toLowerCase() === val.toLowerCase());
 if (!found) sistemaSel.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`);
 sistemaSel.value = val;
 }
 if (desc && String(avv.descrizione || "").trim()) desc.value = String(avv.descrizione || "").trim();
 if (livello && String(avv.livello || "").trim()) livello.value = String(avv.livello || "").trim();
 if (tema && String(avv.tema || "").trim()) tema.value = String(avv.tema || "").trim();
 if (tono && String(avv.tono || "").trim()) tono.value = String(avv.tono || "").trim();
 if (tematiche && String(avv.tematicheSensibili || "").trim()) tematiche.value = String(avv.tematicheSensibili || "").trim();
 if (ambientazione && String(avv.ambientazione || "").trim()) ambientazione.value = String(avv.ambientazione || "").trim();
 if (mostraMaster) mostraMaster.checked = !!avv.mostraMaster;
}
function onOrgTavEditAvventuraChange() {
 const masterSel = document.getElementById("org-tav-edit-master-select");
 const avvSel = document.getElementById("org-tav-edit-avventura-select");
 if (!masterSel || !avvSel) return;
 const masterKey = String(masterSel.value || "").trim();
 const avvId = String(avvSel.value || "").trim().toLowerCase();
 const list = ORG_TAV_EDIT_AVV_CACHE[masterKey] || [];
 const avv = list.find(a => String(a?.avventuraId || "").trim().toLowerCase() === avvId);
 if (avv) orgApplyAvventuraToTavoloEdit(avv);
}
function _resolvePreferredOrgTavEditAvventuraId(list, selectedAvventuraId, tavoloSeed) {
 const explicit = String(selectedAvventuraId || "").trim().toLowerCase();
 if (explicit) return explicit;
 const titoloSeed = String(tavoloSeed?.titoloAvventura || tavoloSeed?.gioco || "").trim().toLowerCase();
 const sistemaSeed = String(tavoloSeed?.sistemaGioco || "").trim().toLowerCase();
 if (!titoloSeed && !sistemaSeed) return "";
 const match = (Array.isArray(list) ? list : []).find((a) => {
 const t = String(a?.titoloAvventura || "").trim().toLowerCase();
 const s = String(a?.sistemaGioco || "").trim().toLowerCase();
 if (titoloSeed && sistemaSeed) return t === titoloSeed || (t === titoloSeed && s === sistemaSeed);
 if (titoloSeed) return t === titoloSeed;
 return sistemaSeed && s === sistemaSeed;
 });
 return String(match?.avventuraId || "").trim().toLowerCase();
}
function _setOrgTavEditAvventureEmptyState(avvSel) {
 if (!avvSel) return;
 avvSel.innerHTML = `<option value="">Nessuna avventura disponibile per questo master</option>`;
}
function loadOrgTavEditAvventure(masterKey, selectedAvventuraId, tavoloSeed) {
 const avvSel = document.getElementById("org-tav-edit-avventura-select");
 if (!avvSel) return;
 const key = String(masterKey || "").trim();
 if (!key || key === "__custom__") {
 avvSel.innerHTML = `<option value="">Seleziona avventura</option>`;
 return;
 }
 if (Array.isArray(ORG_TAV_EDIT_AVV_CACHE[key])) {
 const list = ORG_TAV_EDIT_AVV_CACHE[key];
 if (!list.length) {
 _setOrgTavEditAvventureEmptyState(avvSel);
 return;
 }
 const preferred = _resolvePreferredOrgTavEditAvventuraId(list, selectedAvventuraId, tavoloSeed);
 avvSel.innerHTML = _buildOrgTavEditAvventuraOptions(list, preferred);
 if (preferred) {
 const avv = list.find(a => String(a?.avventuraId || "").trim().toLowerCase() === preferred);
 if (avv) orgApplyAvventuraToTavoloEdit(avv);
 }
 return;
 }
 avvSel.innerHTML = `<option value="">Caricamento avventure…</option>`;
 google.script.run
 .withSuccessHandler((res) => {
 const list = (res && res.ok && Array.isArray(res.avventure)) ? res.avventure : [];
 ORG_TAV_EDIT_AVV_CACHE[key] = list;
 if (!list.length) {
 _setOrgTavEditAvventureEmptyState(avvSel);
 return;
 }
 const preferred = _resolvePreferredOrgTavEditAvventuraId(list, selectedAvventuraId, tavoloSeed);
 avvSel.innerHTML = _buildOrgTavEditAvventuraOptions(list, preferred);
 if (preferred) {
 const avv = list.find(a => String(a?.avventuraId || "").trim().toLowerCase() === preferred);
 if (avv) orgApplyAvventuraToTavoloEdit(avv);
 }
 })
 .withFailureHandler(() => {
 ORG_TAV_EDIT_AVV_CACHE[key] = [];
 _setOrgTavEditAvventureEmptyState(avvSel);
 })
 .orgGetAvventurePerMaster(key);
}
function onOrgTavEditMasterChange() {
 const sel = document.getElementById("org-tav-edit-master-select");
 if (!sel) return;
 loadOrgTavEditAvventure(sel.value || "", "", null);
}
function ensureOrgTavEditComboHandlers() {
 const masterSel = document.getElementById("org-tav-edit-master-select");
 if (masterSel && !masterSel.dataset.bound) {
 masterSel.addEventListener("change", onOrgTavEditMasterChange);
 masterSel.dataset.bound = "1";
 }
 const avvSel = document.getElementById("org-tav-edit-avventura-select");
 if (avvSel && !avvSel.dataset.bound) {
 avvSel.addEventListener("change", onOrgTavEditAvventuraChange);
 avvSel.dataset.bound = "1";
 }
}

function apriOrgModificaTavolo(evId, sessId, tavoloId) {
 const doOpen = () => {
 const tavoli = (((datiOrg || {}).tavoliPerEvento || {})[evId] || {})[sessId] || [];
 const t = tavoli.find(x => String(x.id || "") === String(tavoloId || ""));
 if (!t) {
 flash("org-fa", "Tavolo non trovato.", "err");
 return;
 }
 ensureOrgTavEditComboHandlers();
 const masterKey = populateOrgTavEditMasterSelect(String(t.masterId || t.master || ""));
 const initialMasterKey = String(masterKey || "");
 loadOrgTavEditAvventure(masterKey || "", String(t.avventuraId || ""), t);
 document.getElementById("org-tav-edit-title").textContent = "Modifica tavolo — " + (t.gioco || t.id || "tavolo");
 document.getElementById("org-tav-edit-ev").value = evId;
 document.getElementById("org-tav-edit-sess").value = sessId;
 document.getElementById("org-tav-edit-id").value = String(t.id || "");
 document.getElementById("org-tav-edit-id-view").value = String(t.id || "");
 const sessSel = document.getElementById("org-tav-edit-sess-target");
 if (sessSel) {
 const normSess = (s) => {
 const v = String(s || "").trim().toLowerCase();
 return (v === "unica" ? "" : v);
 };
 const evObj = (datiOrg?.eventiConSessioni || []).find(e => String(e.eventId || "") === String(evId || ""));
 const sessioni = Array.isArray(evObj?.sessioni) ? evObj.sessioni : [];
 sessSel.innerHTML = sessioni.length
 ? sessioni.map(s => {
 const sid = String(s.sessioneId || "");
 const lblBase = String(s.nome || sid || "Sessione");
 const lbl = s.orario ? `${lblBase} · ${s.orario}` : lblBase;
 return `<option value="${escapeHtml(sid)}"${normSess(sid)===normSess(sessId) ? " selected" : ""}>${escapeHtml(lbl)}</option>`;
 }).join("")
 : `<option value="${escapeHtml(String(sessId || ""))}">Sessione corrente</option>`;
 }
 const sistemaSel = document.getElementById("org-tav-edit-sistema");
 if (sistemaSel) {
 const sistemaCur = String(t.sistemaGioco || "").trim();
 const list = Array.isArray(ORG_SISTEMI_GIOCO) ? ORG_SISTEMI_GIOCO.slice() : [];
 const hasCur = sistemaCur && list.some(x => String(x || "").trim().toLowerCase() === sistemaCur.toLowerCase());
 const merged = hasCur || !sistemaCur ? list : list.concat([sistemaCur]);
 merged.sort((a, b) => String(a).localeCompare(String(b)));
 sistemaSel.innerHTML = [`<option value="">Seleziona sistema</option>`]
 .concat(merged.map(s => {
 const val = String(s || "").trim();
 return `<option value="${escapeHtml(val)}"${val.toLowerCase()===sistemaCur.toLowerCase() ? " selected" : ""}>${escapeHtml(val)}</option>`;
 }))
 .join("");
 if (!sistemaCur) sistemaSel.value = "";
 }
 populateFasciaEtaSelect(document.getElementById("org-tav-edit-fascia-min"), t.fasciaEtaMinima);
 document.getElementById("org-tav-edit-titolo").value = String(t.titoloAvventura || t.gioco || "");
 document.getElementById("org-tav-edit-desc").value = String(t.descrizione || "");
 const lvEl = document.getElementById("org-tav-edit-livello");
 if (lvEl) lvEl.value = String(t.livello || "");
 const teEl = document.getElementById("org-tav-edit-tema");
 if (teEl) teEl.value = String(t.tema || "");
 const toEl = document.getElementById("org-tav-edit-tono");
 if (toEl) toEl.value = String(t.tono || "");
 const tsEl = document.getElementById("org-tav-edit-tematiche");
 if (tsEl) tsEl.value = String(t.tematicheSensibili || "");
 const amEl = document.getElementById("org-tav-edit-ambientazione");
 if (amEl) amEl.value = String(t.ambientazione || "");
 const dtEl = document.getElementById("org-tav-edit-desc-tavolo");
 if (dtEl) dtEl.value = String(t.descrizioneTavolo || "");
 document.getElementById("org-tav-edit-tipo").value = String(t.tipo || "GDR").toUpperCase();
 document.getElementById("org-tav-edit-max").value = String(parseInt(t.max || 5, 10) || 5);
 document.getElementById("org-tav-edit-show-master").checked = !!t.mostraMaster;
 document.getElementById("org-tav-edit-attivo").checked = (t.attivo !== false);
 const extraDet = document.getElementById("org-tav-edit-avv-extra");
 if (extraDet) {
 const hasAdvancedData = !!(
 String(t.descrizione || "").trim() ||
 String(t.livello || "").trim() ||
 String(t.tema || "").trim() ||
 String(t.tono || "").trim() ||
 String(t.tematicheSensibili || "").trim() ||
 String(t.ambientazione || "").trim()
 );
 extraDet.open = hasAdvancedData;
 }
 document.getElementById("org-tav-edit-err").textContent = "";
 show("org-tav-edit-overlay");

 // Priorita: link tavolo->avventura; da avventura risaliamo al master affidabile.
 google.script.run
 .withSuccessHandler((res) => {
 if (!res || !res.ok || !res.avventuraId) return;
 const masterSelEl = document.getElementById("org-tav-edit-master-select");
 const currentMasterKey = String(masterSelEl?.value || "").trim();
 // Non sovrascrivere una scelta già cambiata manualmente dall'utente.
 if (currentMasterKey && initialMasterKey && currentMasterKey !== initialMasterKey) return;
 const masterResolved = String(res.masterId || "").trim();
 const avvResolved = String(res.avventuraId || "").trim();
 if (masterResolved) {
 const mk = populateOrgTavEditMasterSelect(masterResolved);
 if (mk) {
 loadOrgTavEditAvventure(mk, avvResolved, {
 titoloAvventura: String(res.titoloAvventura || t.titoloAvventura || ""),
 sistemaGioco: String(res.sistemaGioco || t.sistemaGioco || "")
 });
 return;
 }
 }
 if (avvResolved) {
 const avvSel = document.getElementById("org-tav-edit-avventura-select");
 if (avvSel) {
 const lbl = String(res.titoloAvventura || res.sistemaGioco || avvResolved).trim();
 avvSel.innerHTML = `<option value="${escapeHtml(avvResolved)}" selected>${escapeHtml(lbl)}</option>`;
 }
 }
 })
 .withFailureHandler(() => {})
 .orgResolveTavoloAdventureMaster(evId, sessId, tavoloId);
 };

 const masters = Array.isArray(datiOrg?.masters) ? datiOrg.masters : [];
 if (masters.length) {
 doOpen();
 return;
 }

 beginActionOverlay("Caricamento anagrafiche master…");
 google.script.run
 .withSuccessHandler((res) => {
 endActionOverlay();
 if (res && res.ok) {
 if (!datiOrg || typeof datiOrg !== "object") datiOrg = {};
 datiOrg.utenti = Array.isArray(res.utenti) ? res.utenti : [];
 datiOrg.masters = Array.isArray(res.masters) ? res.masters : [];
 datiOrg.partecipantiNonPrenotanti = Array.isArray(res.partecipantiNonPrenotanti) ? res.partecipantiNonPrenotanti : [];
 ORG_LAZY.anagrafiche = true;
 }
 doOpen();
 })
 .withFailureHandler(() => {
 endActionOverlay();
 doOpen();
 })
 .getDatiOrganizzatore("anagrafiche");
}

function orgConfermaModificaTavolo() {
 const evId = String(document.getElementById("org-tav-edit-ev")?.value || "").trim();
 const sessId = String(document.getElementById("org-tav-edit-sess")?.value || "").trim();
 const sessIdNuova = String(document.getElementById("org-tav-edit-sess-target")?.value || sessId).trim();
 const tavoloId = String(document.getElementById("org-tav-edit-id")?.value || "").trim();
 const errEl = document.getElementById("org-tav-edit-err");
 if (errEl) errEl.textContent = "";
 if (!evId || !tavoloId) {
 if (errEl) errEl.textContent = "Dati tavolo non validi.";
 return;
 }
 const payload = {
 eventId: evId,
 sessioneId: sessId,
 sessioneIdNuova: sessIdNuova,
 tavoloId: tavoloId,
 sistemaGioco: String(document.getElementById("org-tav-edit-sistema")?.value || "").trim(),
 titoloAvventura: String(document.getElementById("org-tav-edit-titolo")?.value || "").trim(),
 descrizione: String(document.getElementById("org-tav-edit-desc")?.value || "").trim(),
 livello: String(document.getElementById("org-tav-edit-livello")?.value || "").trim(),
 tema: String(document.getElementById("org-tav-edit-tema")?.value || "").trim(),
 tono: String(document.getElementById("org-tav-edit-tono")?.value || "").trim(),
 tematicheSensibili: String(document.getElementById("org-tav-edit-tematiche")?.value || "").trim(),
 ambientazione: String(document.getElementById("org-tav-edit-ambientazione")?.value || "").trim(),
 descrizioneTavolo: String(document.getElementById("org-tav-edit-desc-tavolo")?.value || "").trim(),
 tipo: String(document.getElementById("org-tav-edit-tipo")?.value || "GDR").trim().toUpperCase(),
 max: Math.max(1, parseInt(document.getElementById("org-tav-edit-max")?.value || 5, 10) || 5),
 fasciaEtaMinima: String(document.getElementById("org-tav-edit-fascia-min")?.value || "").trim(),
 master: (() => {
 const sel = document.getElementById("org-tav-edit-master-select");
 if (!sel) return "";
 const val = String(sel.value || "").trim();
 if (!val) return "";
 const idVal = val.startsWith("id:") ? val.slice(3) : "";
 if (!idVal) return "";
 const m = (Array.isArray(datiOrg?.masters) ? datiOrg.masters : []).find(x => {
 const mid = String(x?.masterId || "").trim();
 return mid === idVal;
 });
 const label = _orgMasterDisplayName(m);
 if (label && !_isUuidLike(label)) return label;
 const opt = sel.options[sel.selectedIndex];
 const optLabel = String(opt?.getAttribute("data-master-label") || opt?.textContent || "").trim();
 if (optLabel && !_isUuidLike(optLabel)) return optLabel;
 return "";
 })(),
 masterId: (() => {
 const sel = document.getElementById("org-tav-edit-master-select");
 if (!sel) return "";
 const val = String(sel.value || "").trim();
 return val.startsWith("id:") ? String(val.slice(3) || "").trim() : "";
 })(),
 mostraMaster: !!document.getElementById("org-tav-edit-show-master")?.checked,
 attivo: !!document.getElementById("org-tav-edit-attivo")?.checked
 };

 const btn = document.getElementById("org-tav-edit-submit");
 if (btn) btn.disabled = true;
 beginActionOverlay("Salvataggio tavolo…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 hide("org-tav-edit-overlay");
 flash("org-fa", "✅ " + (res.messaggio || "Tavolo aggiornato."), "ok");
 caricaOrg();
 } else if (errEl) {
 errEl.textContent = res?.errore || "Operazione non riuscita.";
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 if (btn) btn.disabled = false;
 if (errEl) errEl.textContent = err.message || String(err);
 })
 .orgAggiornaTavoloInfo(payload);
}

function switchSessView(panelId, btn) {
 document.querySelectorAll(".sess-panel").forEach(p => p.classList.add("hidden"));
 document.getElementById(panelId)?.classList.remove("hidden");
 document.querySelectorAll(".sess-subtab").forEach(b => b.classList.remove("active"));
 if (btn) btn.classList.add("active");
}

function tornaEventi() {
 mappaEvSelezionato = null;
 mappaSessSelezionata = null;
 _syncMappaShellState();
 renderMappaEventi();
 window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Pannello destro: KPI + mail filtrate + attività per evento selezionato. */
function refreshMappaContesto(forceFetch) {
 const kpiEl = document.getElementById("mappa-ctx-kpi");
 const mailEl = document.getElementById("mappa-ctx-mail");
 const logEl = document.getElementById("mappa-ctx-log");
 if (!kpiEl || !mailEl || !logEl) return;

 if (!mappaEvSelezionato || !datiOrg) {
 kpiEl.innerHTML = `<p class="mappa-ctx-placeholder">Seleziona un evento per vedere riepilogo, mail e attività.</p>`;
 mailEl.innerHTML = `<p class="mappa-ctx-placeholder">Nessun evento selezionato.</p>`;
 logEl.innerHTML = `<p class="mappa-ctx-placeholder">Nessun evento selezionato.</p>`;
 return;
 }

 const ev = _mappaEventoCorrente();
 const evId = String(mappaEvSelezionato);
 const sess = _mappaSessioneCorrente(ev);
 const prenEv = (datiOrg.prenotazioni || []).filter(p => String(p.eventId) === evId);
 const pren = sess
 ? prenEv.filter(p => _normSessJS(p.sessione) === _normSessJS(sess.sessioneId))
 : prenEv;
 const prenOk = pren.filter(p => !p.isListaAttesa);
 const attesa = pren.filter(p => p.isListaAttesa).length;
 const persone = prenOk.reduce((s, p) => s + (parseInt(p.numPersone || 1, 10) || 1), 0);
 let fillHtml = "";
 if (sess && !sessioneSenzaTavoli(sess)) {
 const tavoliSess = ((((datiOrg || {}).tavoliPerEvento || {})[evId] || {})[sess.sessioneId] || []);
 const totMax = tavoliSess.reduce((s, t) => s + (parseInt(t.max, 10) || 0), 0);
 const totOcc = tavoliSess.reduce((s, t) => s + Math.min(parseInt(t.occupati, 10) || 0, parseInt(t.max, 10) || 0), 0);
 if (totMax > 0) {
 const pct = Math.round((totOcc / totMax) * 100);
 fillHtml = `<div class="mappa-ctx-fill-label">${totOcc}/${totMax} posti · ${pct}%</div>
 <div class="mappa-ctx-fill" aria-hidden="true"><span style="width:${pct}%"></span></div>`;
 }
 }
 kpiEl.innerHTML = `
 ${fillHtml}
 <div class="mappa-ctx-kpi-grid">
 <div class="mappa-ctx-stat"><div class="n">${prenOk.length}</div><div class="l">Prenotazioni</div></div>
 <div class="mappa-ctx-stat"><div class="n">${persone}</div><div class="l">Persone</div></div>
 <div class="mappa-ctx-stat"><div class="n">${attesa}</div><div class="l">In attesa</div></div>
 </div>
 `;

 const emailsEv = {};
 prenEv.forEach(p => {
 const em = String(p.email || "").trim().toLowerCase();
 if (em) emailsEv[em] = true;
 });
 const nomeEv = String(ev?.nome || "").trim().toLowerCase();
 const idEvLow = evId.toLowerCase();

 const renderMailFromCache = () => {
 const items = Array.isArray(MAIL_STORICO_ITEMS) ? MAIL_STORICO_ITEMS : [];
 const filtered = items.filter(it => {
 const to = String(it.to || "").trim().toLowerCase();
 const subj = String(it.subject || "").toLowerCase();
 const ctx = String(it.context || "").toLowerCase();
 if (to && emailsEv[to]) return true;
 if (nomeEv && (subj.indexOf(nomeEv) >= 0 || ctx.indexOf(nomeEv) >= 0)) return true;
 if (idEvLow && (subj.indexOf(idEvLow) >= 0 || ctx.indexOf(idEvLow) >= 0)) return true;
 return false;
 }).slice(0, 12);
 if (!filtered.length) {
 mailEl.innerHTML = `<p class="mappa-ctx-placeholder">Nessuna mail collegata a questo evento nello storico recente.</p>`;
 return;
 }
 mailEl.innerHTML = `<div class="mail-log-list">${filtered.map(it => {
 const idx = MAIL_STORICO_ITEMS.indexOf(it);
 return `<button type="button" class="mail-log-item" onclick="apriMailDetailPopup(${idx})">
 <div class="mail-log-head">
 <strong>${_fmtDateTimeMail(it.timestamp)}</strong>
 <span class="mail-log-badge">${_escapeHtmlMail(it.status || "")}</span>
 </div>
 ${it.nome ? `<div class="mail-log-subject">${_escapeHtmlMail(it.nome)}</div>` : ""}
 <div class="mail-log-to">${_escapeHtmlMail(it.to || "")}</div>
 <div class="mail-log-subject">${_escapeHtmlMail(it.subject || it.context || "")}</div>
 </button>`;
 }).join("")}</div>`;
 };

 if (forceFetch || !MAIL_STORICO_ITEMS.length) {
 mailEl.innerHTML = `<p class="mappa-ctx-placeholder">Caricamento mail…</p>`;
 if (typeof google !== "undefined" && google.script && google.script.run) {
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok && Array.isArray(res.logInviate)) {
 MAIL_STORICO_ITEMS = res.logInviate.slice();
 }
 renderMailFromCache();
 })
 .withFailureHandler(() => {
 mailEl.innerHTML = `<p class="mappa-ctx-placeholder">Impossibile caricare le mail.</p>`;
 })
 .getStatoEmailOrganizzatore(8);
 } else {
 renderMailFromCache();
 }
 } else {
 renderMailFromCache();
 }

 logEl.innerHTML = `<p class="mappa-ctx-placeholder">Caricamento attività…</p>`;
 if (typeof google === "undefined" || !google.script || !google.script.run) {
 logEl.innerHTML = `<p class="mappa-ctx-placeholder">Attività non disponibili in locale senza backend.</p>`;
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 const voci = (res && res.ok && Array.isArray(res.voci)) ? res.voci : [];
 if (!voci.length) {
 logEl.innerHTML = `<p class="mappa-ctx-placeholder">Nessuna attività recente per questo evento.</p>`;
 return;
 }
 logEl.innerHTML = voci.slice(0, 15).map(v => `
 <div class="mappa-ctx-log-item">
 <div class="mappa-ctx-log-meta">${escapeHtml(formatDateTimeShort(v.timestamp))} · ${escapeHtml(v.tipo || "")}</div>
 <div>${escapeHtml(v.nome || v.email || "")}${v.dettaglio ? " — " + escapeHtml(v.dettaglio) : ""}</div>
 </div>
 `).join("");
 })
 .withFailureHandler(() => {
 logEl.innerHTML = `<p class="mappa-ctx-placeholder">Impossibile caricare le attività.</p>`;
 })
 .getLogAzioni(20, { categoria: "all", q: evId });
}

function aggiornaSessTav() {
 const evEl = document.getElementById("tav-ev");
 const ss = document.getElementById("tav-sess");
 if (!evEl || !ss) return;
 const evId = evEl.value;
 ss.innerHTML = `<option value="">— Sessione —</option>`;
 if (!evId || !datiOrg) return;
 const ev = datiOrg.eventiConSessioni?.find(e => e.eventId===evId);
 (ev?.sessioni||[]).slice()
 .sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""))
 .forEach(s =>
 ss.insertAdjacentHTML("beforeend",`<option value="${s.sessioneId}">${s.nome}${s.orario?" – "+s.orario:""}</option>`)
 );
}

function renderTabella() {
 if (!datiOrg) return;
 const q = document.getElementById("f-search").value.toLowerCase().trim();
 const fEv = document.getElementById("f-evento").value;
 const fT = document.getElementById("f-tipo").value;
 let r = datiOrg.prenotazioni;
 if (q) r = r.filter(p => (p.nome||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q)||(p.cellulare||"").includes(q));
 if (fEv) r = r.filter(p => p.eventId===fEv);
 if (fT==="ok") r = r.filter(p => !p.isListaAttesa);
 if (fT==="attesa") r = r.filter(p => p.isListaAttesa);

 const cnt = document.getElementById("cnt-lbl");
 cnt.textContent = `${r.length} prenotazion${r.length===1?"e":"i"} trovate`;

 const tb = document.getElementById("org-tbody");
 if (!r.length) {
 tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">🔍</span>Nessun risultato per questi filtri.</div></td></tr>`;
 return;
 }
 tb.innerHTML = r.map(p => `<tr>
 <td><div class="td-n">${p.nome||"–"}</div></td>
 <td><div class="td-l">${p.email||"–"}</div><div class="td-l">${p.cellulare||""}</div></td>
 <td style="white-space:nowrap">${p.eventNome||p.eventId}<div class="td-l">${formatDataItaliana(p.eventData||"")}</div></td>
 <td>${p.sessione||"–"}</td>
 <td style="max-width:180px">${p.isListaAttesa?"<em style='color:var(--ash)'>Lista d'attesa</em>":p.tavolo||"–"}</td>
 <td class="td-num"><span class="td-num-pill">${p.numPersone||"–"}</span></td>
 <td class="org-col-optional" style="font-size:12px;color:var(--smoke);font-style:italic">${labelsFasciaCsv(p.fasciaEta)||"–"}</td>
 <td>${p.isListaAttesa?`<span class="badge b-att">⏳</span>`:`<span class="badge b-ok">✅</span>`}</td>
 </tr>`).join("");
}

function renderTavoli() {
 if (!datiOrg) return;
 const grid = document.getElementById("tav-grid");
 if (!grid) return;
 const evEl = document.getElementById("tav-ev");
 const sessEl = document.getElementById("tav-sess");
 const evId = evEl ? evEl.value : "";
 const sessId = sessEl ? sessEl.value : "";
 if (!evId) { grid.innerHTML=emptyStateHtml("📋", "Seleziona un evento per vedere i tavoli."); return; }
 const evData = datiOrg.tavoliPerEvento[evId]||{};
 const key = sessId || Object.keys(evData)[0];
 const tavoli = evData[key] || [];
 if (!tavoli.length) { grid.innerHTML=emptyStateHtml("🎲", "Nessun tavolo configurato."); return; }
 grid.innerHTML = tavoli.map(t => {
 const occ = Math.min(t.occupati, t.max);
 const pct = t.max>0 ? Math.round(occ/t.max*100) : 0;
 const bcl = pct>=100 ? "bar-full" : pct>=70 ? "bar-few" : "bar-ok";
 const lib = Math.max(0, t.max-occ);
 const lcl = lib===0 ? "c-zero" : lib<=2 ? "c-few" : "c-ok";
 return `<div class="tvs">
 <div class="tvs-head">
 <div>
 <div class="tvs-nome">${t.gioco}</div>
 <div style="font-size:11px;color:var(--ash);margin-top:2px">
 <code>${t.id}</code>
 <span class="tipo-badge ${t.tipo==="GDR"?"t-gdr":"t-gdt"}" style="margin-left:6px">${t.tipo}</span>
 </div>
 </div>
 <span style="font-family:'Cinzel',serif;font-size:20px;font-weight:700;color:var(--ember)">${occ}/${t.max}</span>
 </div>
 <div class="bar-wrap"><div class="bar-fill ${bcl}" style="width:${pct}%"></div></div>
 <div class="tvs-meta">
 <span class="${lcl}" style="font-weight:600">${lib} liber${lib===1?"o":"i"}</span>
 <span>${pct}% pieno</span>
 </div>
 ${t.partecipanti&&t.partecipanti!=="-"
 ? `<div style="font-size:11px;color:var(--ash);margin-top:7px;border-top:1px solid var(--vellum);padding-top:7px;font-style:italic;line-height:1.5">${t.partecipanti}</div>`
 : ""}
 </div>`;
 }).join("");
}

/** Risolve la sessione di una prenotazione org (id o nome). */
function _orgLookupSessionePren(p) {
 const evId = String(p?.eventId || "").trim();
 const sessKey = String(p?.sessione || p?.sessioneId || "").trim();
 if (!evId || !sessKey) return null;
 const ev = (datiOrg?.eventiConSessioni || []).find(e => String(e.eventId || "").trim() === evId);
 if (!ev) return null;
 const list = Array.isArray(ev.sessioni) ? ev.sessioni : [];
 return list.find(s =>
 _normSessJS(s.sessioneId) === _normSessJS(sessKey) ||
 _normSessJS(s.nome) === _normSessJS(sessKey)
 ) || null;
}

/** Tipo sessione normalizzato per una prenotazione (fallback euristico su tavolo). */
function _orgTipoSessionePren(p) {
 const sess = _orgLookupSessionePren(p);
 if (sess) return normalizzaTipoSessione(sess.tipoSessione);
 const tav = String(p?.tavolo || "");
 if (/SESSIONE_LIBERA/i.test(tav) || /ingresso/i.test(tav)) return "GDT";
 return "PRENOTAZIONI_TAVOLI";
}

function _fasceCntVuoto() {
 const cnt = {};
 (FASCE_ETA || []).forEach(f => { cnt[f.id] = 0; });
 return cnt;
}

function _fasceAccumulaDaPren(righe, cnt) {
 (righe || []).forEach(p => {
 String(p.fasciaEta || "").split(",")
 .map(f => fasciaId(f.trim()))
 .filter(Boolean)
 .forEach(id => { if (cnt[id] !== undefined) cnt[id]++; });
 });
 return cnt;
}

function _fasceBarsHtml(cnt, tot) {
 const mx = Math.max(...Object.values(cnt), 1);
 const arr = (FASCE_ETA || []).map(f => ({ fascia: f.label, valore: cnt[f.id] || 0 }));
 const maxVal = Math.max(...arr.map(x => x.valore), 0);
 const top = arr.find(x => x.valore === maxVal && x.valore > 0);
 const bars = arr.map(x => {
 const v = x.valore;
 const pct = Math.round(v / mx * 100);
 const lbl = tot > 0 ? Math.round(v / tot * 100) + "%" : "0%";
 const isMain = top && x.fascia === top.fascia && v > 0;
 return `<div class="fascia-bar${isMain ? " is-main" : ""}">
 <div class="fb-lbl"><span>${escapeHtml(x.fascia)}</span><span>${v} presenze (${lbl})</span></div>
 <div class="fb-track" title="${v} presenze (${lbl})"><div class="fb-fill" style="width:${pct}%"></div></div>
 </div>`;
 }).join("");
 return { bars, top, tot };
}

function renderFasce() {
 if (!datiOrg) return;
 const fEv = document.getElementById("fasce-ev").value;
 let righe = fEv ? datiOrg.prenotazioni.filter(p => p.eventId === fEv) : datiOrg.prenotazioni;
 // Solo confermate: la lista d'attesa non è una presenza
 righe = (righe || []).filter(p => !p.isListaAttesa);

 const byTipo = {};
 righe.forEach(p => {
 const tipo = _orgTipoSessionePren(p);
 if (!byTipo[tipo]) byTipo[tipo] = [];
 byTipo[tipo].push(p);
 });

 const tipoOrder = ["PRENOTAZIONI_TAVOLI", "GDT", "PANEL"];
 const tipi = Object.keys(byTipo).sort((a, b) => {
 const ia = tipoOrder.indexOf(a);
 const ib = tipoOrder.indexOf(b);
 return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
 });

 const mainEl = document.getElementById("fasce-main");
 const totEl = document.getElementById("fasce-tot");
 const chartEl = document.getElementById("fasce-chart");

 const cntTot = _fasceAccumulaDaPren(righe, _fasceCntVuoto());
 const totGlobale = Object.values(cntTot).reduce((s, v) => s + v, 0);

 if (!totGlobale) {
 if (mainEl) mainEl.innerHTML = "";
 if (totEl) totEl.textContent = "";
 if (chartEl) chartEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span>Nessuna presenza registrata per questi filtri.</div>`;
 return;
 }

 const topGlob = _fasceBarsHtml(cntTot, totGlobale).top;
 if (mainEl && topGlob) {
 const percTop = Math.round((topGlob.valore / totGlobale) * 100);
 mainEl.innerHTML = `<span class="fasce-main-pill">${escapeHtml(topGlob.fascia)}</span> <span style="margin-left:4px">– fascia più presente · ${topGlob.valore} (${percTop}%)</span>`;
 } else if (mainEl) {
 mainEl.innerHTML = "";
 }
 if (totEl) {
 const nTipi = tipi.length;
 totEl.textContent = `Totale presenze: ${totGlobale} · ${nTipi} tip${nTipi === 1 ? "o" : "i"} sessione`;
 }

 if (!chartEl) return;
 chartEl.innerHTML = tipi.map(tipo => {
 const rows = byTipo[tipo] || [];
 const cnt = _fasceAccumulaDaPren(rows, _fasceCntVuoto());
 const tot = Object.values(cnt).reduce((s, v) => s + v, 0);
 if (!tot) return "";
 const { bars, top } = _fasceBarsHtml(cnt, tot);
 const titolo = labelTipoSessione(tipo);
 const topLine = top
 ? `<div class="fasce-tipo-main"><span class="fasce-main-pill">${escapeHtml(top.fascia)}</span> – ${top.valore} presenze (${Math.round((top.valore / tot) * 100)}%)</div>`
 : "";
 return `<div class="fasce-tipo-block">
 <div class="fasce-tipo-head">
 <div class="fasce-tipo-title">${escapeHtml(titolo)}</div>
 <div class="fasce-tipo-meta">${tot} presenz${tot === 1 ? "a" : "e"}</div>
 </div>
 ${topLine}
 ${bars}
 </div>`;
 }).join("");
}

function exportCSV() {
 if (!datiOrg) return;
 const h = ["Nome","Email","Cellulare","Evento","Data evento","Sessione","Tavolo","Persone","Fascia età","Fonte","Stato"];
 const r = datiOrg.prenotazioni.map(p => [
 p.nome||"",p.email||"",p.cellulare||"",p.eventNome||"",p.eventData||"",
 p.sessione||"",p.tavolo||"",p.numPersone||"",labelsFasciaCsv(p.fasciaEta)||"",p.fonte||"",
 p.isListaAttesa?"Attesa":"Confermato"
 ]);
 const csv = [h,...r].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
 const a = Object.assign(document.createElement("a"), {
 href: URL.createObjectURL(new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"})),
 download: `prenotazioni_${new Date().toISOString().slice(0,10)}.csv`
 });
 a.click();
}

function esportaCsvEvento(evId) {
 if (!evId) return;
 setLdr("Generazione CSV evento…");
 show("loader");
 google.script.run
 .withSuccessHandler(res => {
 hide("loader");
 if (!res || !res.ok || !res.csv) {
 flash("org-fa", "⚠️ " + (res?.errore || "Impossibile esportare il CSV."), "err");
 return;
 }
 const fileName = res.fileName || `evento_${evId}_${new Date().toISOString().slice(0,10)}.csv`;
 const a = Object.assign(document.createElement("a"), {
 href: URL.createObjectURL(new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8;" })),
 download: fileName
 });
 a.click();
 flash("org-fa", "✅ CSV evento generato.", "ok");
 })
 .withFailureHandler(err => {
 hide("loader");
 flash("org-fa", "❌ Errore export CSV: " + (err?.message || err), "err");
 })
 .esportaCsvEvento(evId);
}

// ═══════════════════════════════════════════
// GESTIONE EVENTI (admin)
// ═══════════════════════════════════════════
function renderEventiList() {
 if (!datiOrg) return;
 const eventi = datiOrg.eventiPerGestione || datiOrg.eventiConSessioni || [];
 const futuri = eventi.filter(ev => !isDataPassata(ev.data));
 const attivi = futuri.filter(ev => ev.attivo !== false);
 const inattivi = futuri.filter(ev => ev.attivo === false);
 const passati = eventi.filter(ev => isDataPassata(ev.data));

 const elAttivi = document.getElementById("eventi-list");
 const elInattivi = document.getElementById("eventi-list-inattivi");
 const elPassati = document.getElementById("eventi-list-passati");
 if (!elAttivi || !elInattivi || !elPassati) return;

 if (!eventi.length) {
 elAttivi.innerHTML = `<div class="flash f-info">ℹ️ Nessun evento configurato. Crea il primo con il bottone sopra.</div>`;
 elInattivi.innerHTML = "";
 elPassati.innerHTML = "";
 return;
 }

 elAttivi.innerHTML = attivi.length === 0
 ? `<div class="flash f-info">Nessun evento attivo con data odierna o futura.</div>`
 : attivi.map(ev => evCardHtml(ev, true)).join("");

 elInattivi.innerHTML = inattivi.length === 0
 ? `<div class="flash f-info">Nessun evento inattivo con data odierna o futura.</div>`
 : inattivi.map(ev => evCardHtml(ev, true)).join("");

 elPassati.innerHTML = passati.length === 0
 ? `<div class="flash f-info" style="background:var(--parch2);color:var(--ash)">Nessun evento passato.</div>`
 : passati.map(ev => evCardHtml(ev, true)).join("");
}

function orgRicostruisciAvventureLegacyDaTavoli() {
 chiediConferma(
 "Ricostruire Avventure e AvventureTavoli dai dati legacy del foglio Tavoli?",
 () => {
 beginActionOverlay("Ricostruzione Avventure in corso…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res?.errore || "Ricostruzione non completata."), "err");
 return;
 }
 const msg = [
 res.messaggio || "Ricostruzione completata.",
 `Nuove avventure: ${parseInt(res.avventureCreate || 0, 10) || 0}.`,
 `Nuovi collegamenti: ${parseInt(res.collegamentiCreati || 0, 10) || 0}.`,
 `Tavoli già collegati: ${parseInt(res.tavoliGiaCollegati || 0, 10) || 0}.`
 ].join(" ");
 flash("org-fa", "✅ " + msg, "ok");
 caricaOrg();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 segnalaErroreOrgClient(
 "orgRicostruisciAvventureDaTavoliLegacy",
 null,
 "Ricostruzione Avventure legacy da Tavoli fallita.",
 err?.message || String(err)
 );
 flash("org-fa", "❌ " + (err?.message || err), "err");
 })
 .orgRicostruisciAvventureDaTavoliLegacy();
 }
 );
}

function evCardHtml(ev, conAzioni) {
 const body = `
 <div class="row2">
 <div><div class="lbl" style="margin-bottom:4px">ID</div><code>${ev.eventId}</code></div>
 <div><div class="lbl" style="margin-bottom:4px">Luogo</div><span style="font-size:14px">${ev.luogo||"–"}</span></div>
 </div>
 <div style="margin-top:14px">
 <div class="lbl" style="margin-bottom:6px">Sessioni</div>
 ${(ev.sessioni||[]).map(s =>
 `<div style="font-size:14px;margin-bottom:4px;padding:6px 10px;background:var(--parch2);border-radius:6px;display:flex;gap:8px;align-items:center">
 <span style="font-weight:600">${s.nome}</span>
 ${s.orario?`<span style="color:var(--ash)">· ${s.orario}</span>`:""}
 <code style="font-size:10px;margin-left:auto">${s.sessioneId}</code>
 </div>`
 ).join("")||"<span style='color:var(--ash);font-style:italic;font-size:13px'>Nessuna sessione</span>"}
 </div>`;
 const pill = isDataPassata(ev.data)
 ? `<span class="ev-attivo-pill pill-past">Passato</span>`
 : (ev.attivo !== false
 ? `<span class="ev-attivo-pill pill-si">Attivo</span>`
 : `<span class="ev-attivo-pill pill-no">Inattivo</span>`);
 const btnStatoAvviso = conAzioni
 ? `<button class="btn btn-o btn-sm" onclick="event.stopPropagation();apriAvvisoEventoPopup('${ev.eventId}', '${ev.nome.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')">📬 Stato avviso</button>`
 : "";
 const btnAttivaDisattiva = conAzioni && (ev.attivo === false
 ? `<button class="btn btn-g btn-sm" onclick="event.stopPropagation();chiediConferma('Attivare l\\'evento &quot;${ev.nome.replace(/"/g, "&quot;")}&quot;?',()=>attivaEv('${ev.eventId}'))">▶ Attiva</button>`
 : `<button class="btn btn-d btn-sm" onclick="event.stopPropagation();chiediConferma('Disattivare l\\'evento &quot;${ev.nome.replace(/"/g, "&quot;")}&quot;?',()=>disattivaEv('${ev.eventId}'))">⏸ Disattiva</button>`);
 const azioni = conAzioni
 ? `${btnStatoAvviso}
 ${EXPORT_CSV_EVENTO_ENABLED ? `<button class="btn btn-g btn-sm" onclick="event.stopPropagation();esportaCsvEvento('${ev.eventId}')">📤 Esporta CSV evento</button>` : ""}
 <button class="btn btn-o btn-sm" onclick="event.stopPropagation();modificaEvento('${ev.eventId}')">✏️ Modifica</button>
 ${btnAttivaDisattiva}`
 : "";
 return `
 <div class="ev-card">
 <div class="ev-head" onclick="this.nextElementSibling.classList.toggle('hidden')">
 <h3>🎲 ${ev.nome} <span style="font-size:12px;color:var(--ash);font-weight:400;font-family:'Crimson Pro',serif;font-style:italic">${formatDataItaliana(ev.data||"")}</span></h3>
 <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
 ${pill}
 ${azioni}
 </div>
 </div>
 <div class="ev-body hidden">
 ${body}
 </div>
 </div>`;
}

// ═══════════════════════════════════════════
// AUTO-ID
// ═══════════════════════════════════════════
function toId(testo) {
 const raw = String(testo || "").trim()
 .toLowerCase()
 .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
 .replace(/[^a-z0-9\s_]/g, " ")
 .replace(/\s+/g, " ")
 .trim();
 if (!raw) return "";
 const words = raw.split(" ").filter(Boolean);
 const acr = words.length > 1
 ? words.map(w => w[0]).join("").slice(0, 4)
 : raw.replace(/\s+/g, "").slice(0, 4);
 let h = 0;
 for (let i = 0; i < raw.length; i++) h = ((h * 31) + raw.charCodeAt(i)) >>> 0;
 const hash = (h % 1679616).toString(36).padStart(4, "0"); // 36^4
 return `${acr}_${hash}`.replace(/[^a-z0-9_]/g, "").slice(0, 12);
}

function aggiornIdEvento(input) {
 const idField = document.getElementById("ev-id");
 if (idField.disabled) return;
 idField.value = toId(input.value);
 rigeneraIdTavoliProgressivi();
}

function _buildSessioneIdDaEventoENome(nomeSessione, esclusoEl) {
 const evId = String(document.getElementById("ev-id")?.value || "").trim() || "evento";
 const basePrefix = `${evId}_s`;
 const used = {};
 let maxN = 0;
 document.querySelectorAll(".sess-item .sess-id").forEach(el => {
 if (!el || el === esclusoEl) return;
 const v = String(el.value || "").trim();
 if (!v) return;
 used[v] = true;
 const m = v.match(new RegExp("^" + basePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$"));
 if (m) maxN = Math.max(maxN, parseInt(m[1], 10) || 0);
 });
 const nomeNorm = toId(String(nomeSessione || "").trim());
 if (!nomeNorm) {
 const n = maxN + 1;
 return `${basePrefix}${n}`;
 }
 let n = Math.max(1, maxN + 1);
 let cand = `${basePrefix}${n}`;
 while (used[cand]) {
 n++;
 cand = `${basePrefix}${n}`;
 }
 return cand;
}

function aggiornaIdSessione(input) {
 const sessItem = input.closest(".sess-item");
 if (!sessItem) return;
 const idField = sessItem.querySelector(".sess-id");
 if (!idField) return;
 // Evita riassegnazioni involontarie dei tavoli: l'ID sessione deve restare stabile
 // dopo la prima valorizzazione.
 const current = String(idField.value || "").trim();
 if (current) {
 sincronizzaSessNeiTavoli();
 return;
 }
 idField.value = _buildSessioneIdDaEventoENome(input.value, idField);
 idField.dataset.manuale = "1";
 sincronizzaSessNeiTavoli();
}

function _nextTavoloIdProgressivo(eventId, esclusoEl) {
 const evId = String(eventId || "").trim() || "evento";
 const prefix = evId + "_t";
 let maxN = 0;
 document.querySelectorAll(".tav-item .tav-id").forEach(el => {
 if (!el || el === esclusoEl) return;
 const id = String(el.value || "").trim();
 const m = id.match(new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$"));
 if (m) {
 maxN = Math.max(maxN, parseInt(m[1], 10) || 0);
 return;
 }
 // Compatibilità con vecchio formato: <eventId>_tavolo_<n>
 const oldPrefix = evId + "_tavolo_";
 const mOld = id.match(new RegExp("^" + oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$"));
 if (mOld) maxN = Math.max(maxN, parseInt(mOld[1], 10) || 0);
 });
 return prefix + String(maxN + 1);
}

function rigeneraIdTavoliProgressivi() {
 const evId = String(document.getElementById("ev-id")?.value || "").trim() || "evento";
 document.querySelectorAll(".tav-item").forEach(item => {
 if (item.dataset.idAuto !== "1") return;
 const idField = item.querySelector(".tav-id");
 if (!idField) return;
 idField.value = _nextTavoloIdProgressivo(evId, idField);
 });
}

function aggiornaIdTavolo(_input) {
 // Manteniamo ID progressivi stabili: il titolo non deve piu' influenzare l'ID del tavolo.
}

function sincronizzaSessNeiTavoli() {
 const sessioniEls = Array.from(document.getElementById("sessioni-list").querySelectorAll(".sess-item"))
 .map((el, idx) => ({ el, idx }));
 sessioniEls.sort((a, b) => {
 const ta = orarioToMinuti(a.el.querySelector(".sess-orario")?.value || "");
 const tb = orarioToMinuti(b.el.querySelector(".sess-orario")?.value || "");
 if (ta !== tb) return ta - tb;
 return a.idx - b.idx;
 });
 const nuoveOpts = sessioniEls.map(s => ({
 id: s.el.querySelector(".sess-id").value || "",
 nm: s.el.querySelector(".sess-nome").value || "Sessione"
 }));
 document.querySelectorAll(".tav-item .tav-sessione").forEach(sel => {
 const corrente = String(sel.value || "").trim();
 const corrNorm = _normSessJS(corrente);
 let hasMatch = false;
 const optsHtml = nuoveOpts.map(o => {
 const isSel = _normSessJS(o.id) === corrNorm;
 if (isSel) hasMatch = true;
 return `<option value="${o.id}"${isSel?" selected":""}>${o.nm}</option>`;
 });
 if (!hasMatch && corrente) {
 optsHtml.unshift(`<option value="${escapeHtml(corrente)}" selected>${escapeHtml(corrente)} (non trovata)</option>`);
 }
 sel.innerHTML = optsHtml.join("") || `<option value="">Unica</option>`;
 });
 document.querySelectorAll(".tav-item").forEach(item => _updateTavoloAccordionTitle(item));
}

function _isTipoSessioneFormSenzaTavoli(tipo) {
 const t = String(tipo || "").trim().toUpperCase();
 return t === "GDT" || t === "GIOCO_LIBERO" || t === "PANEL";
}

function _eventoFormHaSessioniConTavoli() {
 return Array.from(document.querySelectorAll("#sessioni-list .sess-item")).some(item => {
 const tipo = item.querySelector(".sess-tiposessione")?.value || "PRENOTAZIONI_TAVOLI";
 return !_isTipoSessioneFormSenzaTavoli(tipo);
 });
}

/** Aggiorna UI capienza / fascia minima / giochi in base al tipo sessione. */
function onSessTipoChange(sel) {
 const item = sel?.closest(".sess-item");
 if (!item) return;
 const senza = _isTipoSessioneFormSenzaTavoli(sel.value);
 const fasciaWrap = item.querySelector(".sess-fascia-min-wrap");
 const noMaxWrap = item.querySelector(".sess-nomax-wrap");
 const giochiWrap = item.querySelector(".sess-giochi-wrap");
 if (fasciaWrap) {
 fasciaWrap.classList.toggle("hidden", !senza);
 if (!senza) {
 const selFascia = fasciaWrap.querySelector(".sess-fascia-min");
 if (selFascia) selFascia.value = "";
 }
 }
 if (noMaxWrap) {
 noMaxWrap.classList.toggle("hidden", !senza);
 if (!senza) {
 const cb = noMaxWrap.querySelector(".sess-nomax");
 if (cb) cb.checked = false;
 }
 }
 if (giochiWrap) {
 giochiWrap.classList.toggle("hidden", !senza);
 if (!senza) {
 const ta = giochiWrap.querySelector(".sess-giochi");
 if (ta) ta.value = "";
 }
 }
 syncSessMaxPostiUI(item);
 syncTavoliSectionFromSessioni();
}

function onSessNoMaxChange(cb) {
 syncSessMaxPostiUI(cb?.closest(".sess-item"));
}

/** Mostra/nasconde e abilita il campo max posti (ingresso: opzionale via «nessun massimo»). */
function syncSessMaxPostiUI(item) {
 if (!item) return;
 const tipo = String(item.querySelector(".sess-tiposessione")?.value || "").trim().toUpperCase();
 const senza = _isTipoSessioneFormSenzaTavoli(tipo);
 const maxInp = item.querySelector(".sess-maxposti");
 const maxField = maxInp?.closest(".field");
 const maxLbl = maxField?.querySelector(".lbl");
 const maxHint = maxField?.querySelector(".hint");
 const noMaxCb = item.querySelector(".sess-nomax");
 const noMax = senza && !!(noMaxCb && noMaxCb.checked);
 if (!senza) {
 if (maxLbl) maxLbl.textContent = "Max posti sessione (opzionale)";
 if (maxHint) maxHint.textContent = "Opzionale. Usato solo se vuoi un tetto complessivo oltre ai posti dei tavoli.";
 if (maxField) maxField.classList.remove("hidden");
 if (maxInp) { maxInp.disabled = false; maxInp.removeAttribute("required"); }
 return;
 }
 if (maxLbl) maxLbl.textContent = noMax ? "Capienza massima" : "Capienza massima *";
 if (maxHint) {
 maxHint.textContent = noMax
 ? "Nessun tetto: chiunque può inviare le informazioni senza limite di posti."
 : "Numero massimo di persone per questa sessione. Se esauriti, non si accettano altri invii.";
 }
 if (maxField) maxField.classList.toggle("hidden", noMax);
 if (maxInp) {
 maxInp.disabled = noMax;
 if (noMax) maxInp.value = "0";
 else if (!(parseInt(maxInp.value || 0, 10) > 0)) maxInp.value = "40";
 }
}

/** Mostra/nasconde la sezione tavoli se esiste almeno una sessione a prenotazione tavoli. */
function syncTavoliSectionFromSessioni() {
 const hasTavoli = _eventoFormHaSessioniConTavoli();
 const tavSec = document.querySelector(".ev-tavoli-section");
 if (tavSec) tavSec.classList.toggle("hidden", !hasTavoli);
 if (!hasTavoli) {
 const list = document.getElementById("tavoli-form-list");
 if (list) list.innerHTML = "";
 } else if (!document.querySelectorAll("#tavoli-form-list .tav-item").length) {
 aggiungiTavolo();
 sincronizzaSessNeiTavoli();
 }
}

function apriNuovoEvento() {
 // Il form evento vive in t-eventi: se arrivo dalla Mappa, porto prima la UI su quel tab.
 apriMappaVistaAvanzata();
 _evFormOriginMappa = null;
 _setEvFormMode("full");
 document.getElementById("ev-id").value = "";
 document.getElementById("ev-nome").value = "";
 document.getElementById("ev-data").value = "";
 document.getElementById("ev-luogo").value = "";
 const evLuogoInd = document.getElementById("ev-luogo-indirizzo");
 if (evLuogoInd) evLuogoInd.value = "";
 const evCoorg = document.getElementById("ev-sede-coorg");
 if (evCoorg) evCoorg.value = "";
 document.getElementById("ev-desc").value = "";
 document.getElementById("ev-attivo").checked = true;
 const cbAvviso = document.getElementById("ev-avviso-nuovi-tavoli");
 if (cbAvviso) cbAvviso.checked = false;
 const cbGiochi = document.getElementById("ev-avviso-nuovi-giochi");
 if (cbGiochi) cbGiochi.checked = false;
 document.getElementById("ev-id").disabled = false;
 document.getElementById("ev-form-title").textContent = "Nuovo evento";
 document.getElementById("sessioni-list").innerHTML = "";
 document.getElementById("tavoli-form-list").innerHTML = "";
 aggiungiSessione();
 syncTavoliSectionFromSessioni();
 ensureOrgLuoghiLoaded(() => {
 populateEvLuogoSelect("", "");
 ensureOrgSediForEventForm(() => {
 populateEvSedeCoorgSelect("");
 show("ev-form-panel");
 });
 });
}

function _labelLuogo(nome, indirizzo) {
 const n = String(nome || "").trim();
 const a = String(indirizzo || "").trim();
 return n && a ? `${n} — ${a}` : (n || a);
}
function populateEvLuogoSelect(selectedNome, selectedIndirizzo) {
 const sel = document.getElementById("ev-luogo");
 if (!sel) return;
 const currNome = String(selectedNome || "").trim();
 const currAddr = String(selectedIndirizzo || "").trim();
 let html = `<option value="">Seleziona luogo</option>`;
 (Array.isArray(ORG_LUOGHI) ? ORG_LUOGHI : []).forEach((l) => {
 const nome = String(l?.nomeLuogo || "").trim();
 if (!nome) return;
 const indirizzo = String(l?.indirizzo || "").trim();
 html += `<option value="${escapeHtml(nome)}" data-indirizzo="${escapeHtml(indirizzo)}"${nome===currNome ? " selected" : ""}>${escapeHtml(_labelLuogo(nome, indirizzo))}</option>`;
 });
 if (currNome && !(ORG_LUOGHI || []).some(l => String(l?.nomeLuogo || "").trim() === currNome)) {
 html += `<option value="${escapeHtml(currNome)}" data-indirizzo="${escapeHtml(currAddr)}" selected>${escapeHtml(_labelLuogo(currNome, currAddr) + " (non in elenco)")}</option>`;
 }
 sel.innerHTML = html;
 const inpAddr = document.getElementById("ev-luogo-indirizzo");
 if (inpAddr) inpAddr.value = currAddr || String(sel.selectedOptions?.[0]?.getAttribute("data-indirizzo") || "");
}
function onEvLuogoChange() {
 const sel = document.getElementById("ev-luogo");
 const inpAddr = document.getElementById("ev-luogo-indirizzo");
 if (!sel || !inpAddr) return;
 const addr = String(sel.selectedOptions?.[0]?.getAttribute("data-indirizzo") || "").trim();
 inpAddr.value = addr;
}
function populateEvSedeCoorgSelect(selectedNome) {
 const sel = document.getElementById("ev-sede-coorg");
 if (!sel) return;
 const curr = String(selectedNome || "").trim();
 const sedi = Array.isArray(window._orgSediEventForm)
 ? window._orgSediEventForm
 : (Array.isArray(datiOrg?.sedi) ? datiOrg.sedi : []);
 let html = `<option value="">— Nessuna —</option>`;
 sedi
 .filter(s => s && s.attivo !== false && String(s.nomeSede || "").trim())
 .sort((a, b) => String(a.nomeSede).localeCompare(String(b.nomeSede), "it"))
 .forEach(s => {
 const nome = String(s.nomeSede || "").trim();
 html += `<option value="${escapeHtml(nome)}"${nome === curr ? " selected" : ""}>${escapeHtml(nome)}</option>`;
 });
 if (curr && !sedi.some(s => String(s?.nomeSede || "").trim() === curr)) {
 html += `<option value="${escapeHtml(curr)}" selected>${escapeHtml(curr + " (non in elenco)")}</option>`;
 }
 sel.innerHTML = html;
 if (curr) sel.value = curr;
}
function ensureOrgSediForEventForm(callback) {
 const done = (cb) => { try { if (typeof cb === "function") cb(); } catch (_e) {} };
 if (Array.isArray(datiOrg?.sedi) && datiOrg.sedi.length) {
 window._orgSediEventForm = datiOrg.sedi;
 return done(callback);
 }
 google.script.run
 .withSuccessHandler((res) => {
 window._orgSediEventForm = Array.isArray(res?.sedi) ? res.sedi : [];
 done(callback);
 })
 .withFailureHandler(() => {
 window._orgSediEventForm = [];
 done(callback);
 })
 .getSediAttivePubbliche();
}
function ensureOrgLuoghiLoaded(callback) {
 const done = (cb) => { try { if (typeof cb === "function") cb(); } catch (_e) {} };
 if (Array.isArray(ORG_LUOGHI) && ORG_LUOGHI.length) return done(callback);
 google.script.run
 .withSuccessHandler((list) => {
 ORG_LUOGHI = Array.isArray(list) ? list : [];
 done(callback);
 })
 .withFailureHandler(() => done(callback))
 .getLuoghiConfig();
}
function aggiungiNuovoLuogoEvento(btn) {
 const nome = String(window.prompt("Nome luogo (es. Biblioteca Comunale):", "") || "").trim();
 if (!nome) return;
 const indirizzo = String(window.prompt("Indirizzo luogo (opzionale):", "") || "").trim();
 const prev = btn ? btn.textContent : "+";
 if (btn) { btn.disabled = true; btn.textContent = "…"; }
 google.script.run
 .withSuccessHandler((res) => {
 if (btn) { btn.disabled = false; btn.textContent = prev || "+"; }
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res?.errore || "Errore durante il salvataggio del luogo."), "err");
 return;
 }
 const luogo = res.luogo || { nomeLuogo: nome, indirizzo: indirizzo };
 const nomeL = String(luogo.nomeLuogo || nome).trim();
 const indL = String(luogo.indirizzo || indirizzo).trim();
 const idx = (ORG_LUOGHI || []).findIndex(l => String(l?.nomeLuogo || "").trim().toLowerCase() === nomeL.toLowerCase());
 if (idx >= 0) ORG_LUOGHI[idx] = { nomeLuogo: nomeL, indirizzo: indL, label: _labelLuogo(nomeL, indL) };
 else ORG_LUOGHI.push({ nomeLuogo: nomeL, indirizzo: indL, label: _labelLuogo(nomeL, indL) });
 ORG_LUOGHI.sort((a, b) => String(a?.nomeLuogo || "").localeCompare(String(b?.nomeLuogo || ""), "it"));
 populateEvLuogoSelect(nomeL, indL);
 flash("org-fa", "✅ Luogo salvato: " + nomeL, "ok");
 })
 .withFailureHandler((err) => {
 if (btn) { btn.disabled = false; btn.textContent = prev || "+"; }
 flash("org-fa", "❌ Errore: " + (err.message || err), "err");
 })
 .salvaLuogoConfig(nome, indirizzo);
}

/** Restituisce minuti dall'inizio della giornata per il primo orario in una stringa (es. "14:00-18:00" -> 840, "20.30" -> 1230). */
function orarioToMinuti(str) {
 if (!str || typeof str !== "string") return 0;
 const s = str.trim();
 // HH:mm / H:mm
 let m = s.match(/(\d{1,2})[.:](\d{2})/);
 if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

 // Range orario: "14:00-18:00" oppure "14-17" -> prendiamo SEMPRE l'inizio
 m = s.match(/(\d{1,2})\s*(?::[0-5]\d)?\s*-\s*(\d{1,2})/);
 if (m) return parseInt(m[1], 10) * 60;

 // Numero singolo: "Sera 21" / "Pomeriggio 15" / "21"
 m = s.match(/(\d{1,2})\s*$/);
 if (m) return parseInt(m[1], 10) * 60;

 return 0;
}

/** Ordina un array di eventi per data (YYYY-MM-DD) e poi per orario della prima sessione. Modifica l'array in place. */
function sortEventiPerDataEOra(eventi) {
 if (!Array.isArray(eventi) || !eventi.length) return;
 const norm = (ev) => (dataItalianaToYYYYMMDD(ev.data) || ev.data || "").trim();
 const minuti = (ev) => {
 const sess = ev.sessioni && ev.sessioni[0];
 return sess && sess.orario ? orarioToMinuti(sess.orario) : 0;
 };
 eventi.sort((a, b) => {
 const d = norm(a).localeCompare(norm(b));
 if (d !== 0) return d;
 return minuti(a) - minuti(b);
 });
}

/** Formatta una data YYYY-MM-DD per la UI in italiano (es. "14 Marzo 2026"). Se non è YYYY-MM-DD restituisce la stringa invariata. */
function formatDataItaliana(str) {
 if (!str || typeof str !== "string") return "";
 const s = str.trim();
 const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if (!m) return s;
 const mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
 const giorno = parseInt(m[3], 10);
 const mese = mesi[parseInt(m[2], 10) - 1] || m[2];
 const anno = m[1];
 return `${giorno} ${mese} ${anno}`;
}

/** Converte una data in formato italiano (es. "Sabato 15 marzo 2026") in YYYY-MM-DD per input type="date" */
function dataItalianaToYYYYMMDD(str) {
 if (!str || typeof str !== "string") return "";
 const s = str.trim().split("·")[0].trim();
 const mesi = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
 const m = s.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
 if (!m) {
 const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
 if (iso) return iso[0];
 return "";
 }
 const giorno = m[1].padStart(2, "0");
 const meseIdx = mesi.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
 const meseNum = meseIdx >= 0 ? meseIdx + 1 : 1;
 const mese = String(meseNum).padStart(2, "0");
 const anno = m[3];
 return `${anno}-${mese}-${giorno}`;
}

/** True se la data (YYYY-MM-DD o italiano) è prima di oggi (evento passato). */
function isDataPassata(dataStr) {
 const iso = dataItalianaToYYYYMMDD(dataStr || "");
 if (!iso) return false;
 const oggi = new Date();
 const yy = oggi.getFullYear(), mm = String(oggi.getMonth() + 1).padStart(2, "0"), dd = String(oggi.getDate()).padStart(2, "0");
 const oggiStr = `${yy}-${mm}-${dd}`;
 return iso < oggiStr;
}

/** True se l'utente può modificare o cancellare la prenotazione (solo per eventi attivi e non passati). */
function puoModificarePrenotazione(p) {
 if (!p || !p.eventId) return false;
 if (isDataPassata(p.eventData)) return false;
 return true;
}

function _setEvFormMode(mode) {
 const panel = document.getElementById("ev-form-panel");
 const saveBtn = document.getElementById("ev-form-save-btn");
 const m = String(mode || "full").toLowerCase();
 const onlySessioni = m === "sessioni";
 const onlyTavoli = m === "tavoli";
 if (panel) {
 panel.classList.toggle("ev-form-mode-sessioni", onlySessioni);
 panel.classList.toggle("ev-form-mode-tavoli", onlyTavoli);
 }
 if (saveBtn) {
 saveBtn.textContent = onlySessioni
 ? "💾 Salva sessioni"
 : (onlyTavoli ? "💾 Salva tavoli" : "💾 Salva evento");
 }
}

function apriAggiungiTavoloDaMappa(evId, sessId) {
 const sid = String(sessId || "").trim();
 _evFormOriginMappa = { evId: String(evId || "").trim(), sessId: sid };
 apriMappaVistaAvanzata();
 modificaEvento(evId, "tavoli", true);
 if (!sid) return;
 aggiungiTavolo({ sessioneId: sid });
 const list = document.getElementById("tavoli-form-list");
 const last = list ? list.querySelector(".tav-item:last-child") : null;
 if (last) {
 const headBtn = last.querySelector(".ev-acc-head");
 if (headBtn) toggleEvAccordion(headBtn, true);
 last.scrollIntoView({ behavior: "smooth", block: "center" });
 }
}

function _restoreMappaAfterEvFormIfNeeded() {
 if (!_evFormOriginMappa) return;
 const origin = _evFormOriginMappa;
 _evFormOriginMappa = null;
 const mappaBtn = document.querySelector('.tab-btn[data-tab="t-mappa"]');
 if (mappaBtn) switchTab("t-mappa", mappaBtn);
 if (origin.evId) {
 mappaEvSelezionato = origin.evId;
 mappaSessSelezionata = origin.sessId || null;
 if (typeof ripristinaVistaMappaSelezionata === "function") {
 ripristinaVistaMappaSelezionata();
 }
 }
}

function modificaEvento(evId, mode, preserveMappaOrigin) {
 if (!preserveMappaOrigin) _evFormOriginMappa = null;
 _setEvFormMode(mode || "full");
 const ev = datiOrg.eventiConSessioni.find(e => e.eventId===evId)
 || (datiOrg.eventi || []).find(e => e.eventId === evId);
 if (!ev) return;
 document.getElementById("ev-id").value = ev.eventId;
 document.getElementById("ev-id").disabled = true;
 document.getElementById("ev-nome").value = ev.nome||"";
 document.getElementById("ev-data").value = dataItalianaToYYYYMMDD(ev.data) || ev.data || "";
 const luogoNome = String(ev.luogoNome || ev.luogo || "").trim();
 const luogoInd = String(ev.luogoIndirizzo || "").trim();
 document.getElementById("ev-luogo").value = luogoNome;
 const evLuogoInd = document.getElementById("ev-luogo-indirizzo");
 if (evLuogoInd) evLuogoInd.value = luogoInd;
 const coorgNome = String(ev.sedeCoorganizzatore || "").trim();
 document.getElementById("ev-desc").value = ev.descrizione||"";
 document.getElementById("ev-attivo").checked = (ev.attivo !== false);
 const cbAvviso = document.getElementById("ev-avviso-nuovi-tavoli");
 if (cbAvviso) cbAvviso.checked = false;
 const cbGiochi = document.getElementById("ev-avviso-nuovi-giochi");
 if (cbGiochi) cbGiochi.checked = false;
 document.getElementById("ev-form-title").textContent =
 String(mode || "").toLowerCase() === "sessioni"
 ? "Modifica sessioni: " + ev.nome
 : (String(mode || "").toLowerCase() === "tavoli"
 ? "Gestione tavoli: " + ev.nome
 : "Modifica: " + ev.nome);
 document.getElementById("sessioni-list").innerHTML = "";
 (ev.sessioni||[]).slice()
 .sort((a, b) => orarioToMinuti(a.orario || "") - orarioToMinuti(b.orario || ""))
 .forEach(s => aggiungiSessione(s.sessioneId, s.nome, s.orario, s.maxPosti, s.tipoSessione, s.fasciaEtaMinima, s.giochiDisponibili));
 if (!ev.sessioni?.length) aggiungiSessione();
 document.getElementById("tavoli-form-list").innerHTML = "";
 const hasSessTavoli = (ev.sessioni || []).some(s => !_isTipoSessioneFormSenzaTavoli(s.tipoSessione));
 if (hasSessTavoli) {
 const tavoliEv = Object.entries(datiOrg.tavoliPerEvento?.[evId] || {})
 .flatMap(([sid, arr]) => (arr || []).map(t => Object.assign({}, t, { sessioneId: String(t?.sessioneId || sid || "") })));
 tavoliEv.forEach(t => aggiungiTavolo(t));
 if (!tavoliEv.length) aggiungiTavolo();
 sincronizzaSessNeiTavoli();
 }
 syncTavoliSectionFromSessioni();
 ensureOrgLuoghiLoaded(() => {
 populateEvLuogoSelect(luogoNome, luogoInd);
 ensureOrgSediForEventForm(() => {
 populateEvSedeCoorgSelect(coorgNome);
 show("ev-form-panel");
 });
 });
}

function chiudiFormEvento() {
 hide("ev-form-panel");
 _restoreMappaAfterEvFormIfNeeded();
}
function chiudiFormEventoBackdrop(evt) {
 if (!evt) return;
 if (evt.target && evt.target.id === "ev-form-panel") chiudiFormEvento();
}

function toggleEvAccordion(btn, forceOpen) {
 const item = btn?.closest(".ev-acc-item");
 if (!item) return;
 const body = item.querySelector(".ev-acc-body");
 if (!body) return;
 const willOpen = (typeof forceOpen === "boolean") ? forceOpen : body.classList.contains("hidden");
 body.classList.toggle("hidden", !willOpen);
 item.classList.toggle("is-open", willOpen);
 btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function _setEvAccordionTitle(item, text) {
 const titleEl = item?.querySelector(".ev-acc-title");
 if (titleEl) titleEl.textContent = String(text || "").trim() || "Dettaglio";
}

function _updateSessioneAccordionTitle(sessItem) {
 if (!sessItem) return;
 const nome = String(sessItem.querySelector(".sess-nome")?.value || "").trim();
 const id = String(sessItem.querySelector(".sess-id")?.value || "").trim();
 const orario = String(sessItem.querySelector(".sess-orario")?.value || "").trim();
 const label = nome || id || "Nuova sessione";
 _setEvAccordionTitle(sessItem, `🧭 ${label}${orario ? " · " + orario : ""}`);
}

function _updateTavoloAccordionTitle(tavItem) {
 if (!tavItem) return;
 const id = String(tavItem.querySelector(".tav-id")?.value || "").trim();
 const sess = String(tavItem.querySelector(".tav-sessione")?.selectedOptions?.[0]?.textContent || "").trim();
 const label = id || "Nuovo tavolo";
 _setEvAccordionTitle(tavItem, `🪑 ${label}${sess ? " · " + sess : ""}`);
}

function removeSessione(btn) {
 const item = btn?.closest(".sess-item");
 if (!item) return;
 item.remove();
 sincronizzaSessNeiTavoli();
 syncTavoliSectionFromSessioni();
}

function removeTavolo(btn) {
 const item = btn?.closest(".tav-item");
 if (!item) return;
 item.remove();
}

function _giochiDisponibiliToTextarea(val) {
 if (Array.isArray(val)) return val.map(g => String(g || "").trim()).filter(Boolean).join("\n");
 return String(val || "").trim();
}

function _parseGiochiDisponibiliUI(raw) {
 return String(raw || "")
 .split(/[\n\r;|,]+/)
 .map(s => String(s || "").trim())
 .filter(Boolean);
}

function aggiungiSessione(id, nome, orario, maxPosti, tipoSessione, fasciaEtaMinima, giochiDisponibili) {
 const div = document.createElement("div");
 div.className = "ev-acc-item sess-item";
 const maxPostiNum = parseInt(maxPosti || 0, 10) || 0;
 // GIOCO_LIBERO legacy → selezionato come Gioco Libero (GDT)
 const tipoSess = normalizzaTipoSessione(tipoSessione);
 const senzaTav = _isTipoSessioneFormSenzaTavoli(tipoSess);
 const noMax = senzaTav && maxPostiNum < 1 && !!id;
 const isOpen = !id;
 const giochiTxt = escapeHtml(_giochiDisponibiliToTextarea(giochiDisponibili));
 div.classList.toggle("is-open", isOpen);
 div.innerHTML = `
 <button type="button" class="ev-acc-head" onclick="toggleEvAccordion(this)" aria-expanded="${isOpen ? "true" : "false"}">
 <span class="ev-acc-title">🧭 Nuova sessione</span>
 <span class="ev-acc-chevron">⌄</span>
 </button>
 <div class="ev-acc-body${isOpen ? "" : " hidden"}">
 <div class="ev-acc-actions">
 <button class="rm-btn" type="button" onclick="removeSessione(this)" title="Rimuovi sessione">🗑 Rimuovi sessione</button>
 </div>
 <div class="row2">
 <div class="field first">
 <label class="lbl">Nome sessione</label>
 <input type="text" class="sess-nome" placeholder="Turno unico / Pomeriggio" value="${nome||""}"
 oninput="aggiornaIdSessione(this);_updateSessioneAccordionTitle(this.closest('.sess-item'))">
 </div>
 <div class="field first">
 <label class="lbl">ID sessione <span class="id-auto-badge">auto</span></label>
 <input type="text" class="sess-id id-auto-field" placeholder="turno_unico" value="${id||""}" readonly data-manuale="${id ? "1" : "0"}">
 </div>
 </div>
 <div class="field" style="margin-top:10px">
 <label class="lbl">Orario</label>
 <input type="text" class="sess-orario" placeholder="es. 14:30 – 18:00" value="${orario||""}"
 oninput="sincronizzaSessNeiTavoli();_updateSessioneAccordionTitle(this.closest('.sess-item'))">
 </div>
 <div class="row2" style="margin-top:10px">
 <div class="field first">
 <label class="lbl">Capienza massima</label>
 <input type="number" class="sess-maxposti" min="0" max="500" value="${noMax ? 0 : (maxPostiNum || (senzaTav ? 40 : 0))}">
 <div class="hint">Numero massimo di persone per questa sessione.</div>
 </div>
 <div class="field first">
 <label class="lbl">Tipo sessione</label>
 <select class="sess-tiposessione" onchange="onSessTipoChange(this)">
 <option value="PRENOTAZIONI_TAVOLI"${tipoSess==="PRENOTAZIONI_TAVOLI"?" selected":""}>Prenotazioni Tavoli</option>
 <option value="GDT"${tipoSess==="GDT"?" selected":""}>Gioco Libero (GDT)</option>
 <option value="PANEL"${tipoSess==="PANEL"?" selected":""}>Panel</option>
 </select>
 </div>
 </div>
 <label class="sess-nomax-wrap${senzaTav ? "" : " hidden"}" style="display:flex;align-items:flex-start;gap:10px;margin-top:12px;cursor:pointer;font-size:13px;color:var(--smoke)">
 <input type="checkbox" class="sess-nomax" style="margin-top:3px"${noMax ? " checked" : ""} onchange="onSessNoMaxChange(this)">
 <span><strong>Nessun numero massimo di posti</strong><br><span class="hint" style="margin:0">Nessun tetto di capienza: chiunque può inviare le informazioni.</span></span>
 </label>
 <div class="field sess-fascia-min-wrap${senzaTav ? "" : " hidden"}" style="margin-top:10px">
 <label class="lbl">Fascia età minima</label>
 <select class="sess-fascia-min" style="width:100%;max-width:360px"></select>
 <div class="hint">Come sui tavoli GDR: restano selezionabili solo questa fascia e quelle superiori.</div>
 </div>
 <div class="field sess-giochi-wrap${senzaTav ? "" : " hidden"}" style="margin-top:10px">
 <label class="lbl">Giochi presenti</label>
 <textarea class="sess-giochi" rows="5" placeholder="Uno per riga, es.&#10;Catan&#10;Ticket to Ride&#10;Azul" style="width:100%;resize:vertical">${giochiTxt}</textarea>
 <div class="hint">Visibile ai partecipanti nella prenotazione Gioco Libero / Panel. Un gioco per riga (oppure separati da ;).</div>
 </div>
 </div>`;
 document.getElementById("sessioni-list").appendChild(div);
 if (!id && nome) {
 const idInput = div.querySelector(".sess-id");
 idInput.value = _buildSessioneIdDaEventoENome(nome, idInput);
 idInput.dataset.manuale = "1";
 }
 const selFascia = div.querySelector(".sess-fascia-min");
 const fillFascia = () => populateFasciaEtaSelect(selFascia, fasciaEtaMinima || "");
 if (FASCE_ETA.length) fillFascia();
 else syncFasceEtaDaFoglio(fillFascia);
 syncSessMaxPostiUI(div);
 _updateSessioneAccordionTitle(div);
 syncTavoliSectionFromSessioni();
}

function aggiungiTavolo(t) {
 const sessioniEls = Array.from(document.getElementById("sessioni-list").querySelectorAll(".sess-item"))
 .map((el, idx) => ({ el, idx }));
 sessioniEls.sort((a, b) => {
 const ta = orarioToMinuti(a.el.querySelector(".sess-orario")?.value || "");
 const tb = orarioToMinuti(b.el.querySelector(".sess-orario")?.value || "");
 if (ta !== tb) return ta - tb;
 return a.idx - b.idx;
 });
 const tavSess = String(t?.sessioneId || "").trim();
 const tavSessNorm = _normSessJS(tavSess);
 let hasSessMatch = false;
 const sesOptsBase = sessioniEls.map(s => {
 const id = s.el.querySelector(".sess-id").value || "";
 const nm = s.el.querySelector(".sess-nome").value || id;
 const isSel = _normSessJS(id) === tavSessNorm;
 if (isSel) hasSessMatch = true;
 return `<option value="${id}"${isSel?" selected":""}>${nm}</option>`;
 });
 // Preserva sessioni legacy/non presenti per evitare riassegnazioni involontarie al primo elemento.
 const sesOpts = (!hasSessMatch && tavSess)
 ? [`<option value="${escapeHtml(tavSess)}" selected>${escapeHtml(tavSess)} (non trovata)</option>`].concat(sesOptsBase).join("")
 : sesOptsBase.join("");

 const div = document.createElement("div");
 div.className = "ev-acc-item tav-item";
 const meta = {
 sistemaGioco: String(t?.sistemaGioco || "").trim(),
 titoloAvventura: String(t?.titoloAvventura || "").trim(),
 descrizione: String(t?.descrizione || "").trim(),
 descrizioneTavolo: String(t?.descrizioneTavolo || "").trim(),
 fasciaEtaMinima: String(t?.fasciaEtaMinima || "").trim(),
 master: String(t?.master || "").trim(),
 mostraMaster: !!t?.mostraMaster,
 gioco: String(t?.gioco || t?.titoloAvventura || t?.sistemaGioco || "").trim(),
 max: parseInt(t?.max || 5, 10) || 5,
 tipo: String(t?.tipo || "GDR").trim().toUpperCase() || "GDR",
 attivo: t?.attivo === false ? false : true
 };
 const isNuovo = !(t && t.id);
 const pillVis = meta.attivo
 ? `<span class="tav-state-pill ok">Visibile in prenotazioni</span>`
 : `<span class="tav-state-pill warn">Non visibile in prenotazioni</span>`;
 const pillTipo = isNuovo
 ? `<span class="tav-state-pill warn">Nuovo tavolo</span>`
 : `<span class="tav-state-pill ok">Tavolo esistente</span>`;
 const isOpen = isNuovo;
 div.classList.toggle("is-open", isOpen);
 div.dataset.tavMeta = JSON.stringify(meta);
 div.innerHTML = `
 <button type="button" class="ev-acc-head" onclick="toggleEvAccordion(this)" aria-expanded="${isOpen ? "true" : "false"}">
 <span class="ev-acc-title">🪑 Nuovo tavolo</span>
 <span class="ev-acc-chevron">⌄</span>
 </button>
 <div class="ev-acc-body${isOpen ? "" : " hidden"}">
 <div class="ev-acc-actions">
 <button class="rm-btn" type="button" onclick="removeTavolo(this)" title="Rimuovi tavolo">🗑 Rimuovi tavolo</button>
 </div>
 <div class="tav-row-main">
 <div>
 <div class="lbl" style="margin-bottom:4px">🧭 Sessione</div>
 <select class="tav-sessione" onchange="_updateTavoloAccordionTitle(this.closest('.tav-item'))">${sesOpts||`<option value="">Unica</option>`}</select>
 </div>
 <div>
 <div class="lbl" style="margin-bottom:4px">ID tavolo <span class="id-auto-badge">auto</span></div>
 <input type="text" class="tav-id" placeholder="evento_tavolo_1" value="${t?.id||""}" readonly>
 </div>
 <div>
 <div class="lbl tav-hint-title" style="margin-bottom:4px">
 <span>Dettagli tavolo</span>
 ${pillTipo}
 ${pillVis}
 </div>
 <div class="hint" style="font-size:12px;line-height:1.4">
 Qui puoi creare il tavolo e assegnarlo alla sessione.
 Dati completi (sistema, descrizione, capienza, master, visibilita) dal popup <strong>"Modifica tavolo"</strong> in Mappa eventi.
 </div>
 </div>
 </div>
 </div>`;
 document.getElementById("tavoli-form-list").appendChild(div);

 if (t && t.id) {
 div.dataset.idAuto = "0";
 } else {
 div.dataset.idAuto = "1";
 const idInput = div.querySelector(".tav-id");
 const evId = String(document.getElementById("ev-id")?.value || "").trim() || "evento";
 if (idInput) {
 idInput.value = _nextTavoloIdProgressivo(evId, idInput);
 const m = JSON.parse(div.dataset.tavMeta || "{}");
 m.gioco = String(idInput.value || "").trim();
 m.attivo = false;
 m.mostraMaster = false;
 div.dataset.tavMeta = JSON.stringify(m);
 }
 }
 _updateTavoloAccordionTitle(div);
}

function aggiungiNuovoSistemaGioco(btn, targetSelectId) {
 const nome = window.prompt("Nuovo sistema di gioco:");
 if (nome == null) return;
 const sistema = String(nome || "").trim();
 if (!sistema) {
 flash("org-fa", "⚠️ Inserisci un nome valido per il sistema.", "err");
 return;
 }
 const prev = btn?.textContent;
 if (btn) { btn.disabled = true; btn.textContent = "…"; }
 google.script.run
 .withSuccessHandler(res => {
 if (btn) { btn.disabled = false; btn.textContent = prev || "+"; }
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res?.errore || "Errore durante il salvataggio del sistema."), "err");
 return;
 }
 const nuovo = String(res.sistema || sistema).trim();
 if (!ORG_SISTEMI_GIOCO.some(x => String(x).toLowerCase() === nuovo.toLowerCase())) {
 ORG_SISTEMI_GIOCO.push(nuovo);
 }
 ORG_SISTEMI_GIOCO.sort((a, b) => String(a).localeCompare(String(b)));
 document.querySelectorAll(".tav-item .tav-sistema").forEach(sel => {
 const current = sel.value;
 const opts = [`<option value="">Seleziona sistema</option>`]
 .concat(ORG_SISTEMI_GIOCO.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
 sel.innerHTML = opts.join("");
 sel.value = current || nuovo;
 });
 const targetSel = document.getElementById(String(targetSelectId || ""));
 if (targetSel) {
 const current = String(targetSel.value || "").trim();
 const opts = [`<option value="">Seleziona sistema</option>`]
 .concat(ORG_SISTEMI_GIOCO.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
 targetSel.innerHTML = opts.join("");
 targetSel.value = current || nuovo;
 }
 flash("org-fa", "✅ Sistema aggiunto: " + nuovo, "ok");
 })
 .withFailureHandler(err => {
 if (btn) { btn.disabled = false; btn.textContent = prev || "+"; }
 flash("org-fa", "❌ Errore: " + (err.message || err), "err");
 })
 .aggiungiSistemaGiocoConfig(sistema);
}

function salvaEventoForm() {
 const evId = document.getElementById("ev-id").value.trim();
 const evNome = document.getElementById("ev-nome").value.trim();

 if (!evId || !evNome) {
 flash("org-fa","⚠️ ID e Nome evento sono obbligatori.","err");
 const btnEv = document.querySelector('.tab-btn[data-tab="t-eventi"]');
 if (btnEv) switchTab("t-eventi", btnEv);
 else if (typeof apriMappaVistaAvanzata === "function") apriMappaVistaAvanzata();
 return;
 }
 if (!/^[a-z0-9_]+$/.test(evId)) {
 flash("org-fa","⚠️ ID evento: usa solo lettere minuscole, numeri e underscore.","err");
 return;
 }

 const sessioni = Array.from(document.getElementById("sessioni-list").querySelectorAll(".sess-item")).map(s => {
 const tipoSessione = normalizzaTipoSessione(s.querySelector(".sess-tiposessione")?.value || "PRENOTAZIONI_TAVOLI");
 const senza = _isTipoSessioneFormSenzaTavoli(tipoSessione);
 const noMax = senza && !!s.querySelector(".sess-nomax")?.checked;
 const maxRaw = parseInt(s.querySelector(".sess-maxposti")?.value || 0, 10) || 0;
 return {
 sessioneId: s.querySelector(".sess-id").value.trim() || "",
 nome: s.querySelector(".sess-nome").value.trim() || "Turno unico",
 orario: s.querySelector(".sess-orario").value.trim(),
 attivo: true,
 maxPosti: (senza && noMax) ? 0 : maxRaw,
 tipoSessione,
 fasciaEtaMinima: senza
 ? String(s.querySelector(".sess-fascia-min")?.value || "").trim()
 : "",
 giochiDisponibili: senza
 ? _parseGiochiDisponibiliUI(s.querySelector(".sess-giochi")?.value || "")
 : []
 };
 }).filter(s => s.sessioneId);

 const tavoli = Array.from(document.getElementById("tavoli-form-list").querySelectorAll(".tav-item")).map(t => {
 const id = t.querySelector(".tav-id")?.value.trim() || "";
 const sessioneId = t.querySelector(".tav-sessione")?.value || "";
 const meta = (() => {
 try { return JSON.parse(t.dataset.tavMeta || "{}"); }
 catch (_e) { return {}; }
 })();
 return {
 sessioneId,
 id,
 sistemaGioco: String(meta.sistemaGioco || "").trim(),
 titoloAvventura: String(meta.titoloAvventura || "").trim(),
 descrizione: String(meta.descrizione || "").trim(),
 descrizioneTavolo: String(meta.descrizioneTavolo || "").trim(),
 fasciaEtaMinima: String(meta.fasciaEtaMinima || "").trim(),
 master: String(meta.master || "").trim(),
 mostraMaster: !!meta.mostraMaster,
 gioco: String(meta.gioco || id || "").trim(),
 max: Math.max(1, parseInt(meta.max || 5, 10) || 5),
 tipo: String(meta.tipo || "GDR").trim().toUpperCase() || "GDR",
 attivo: meta.attivo === true
 };
 }).filter(t => t.id);

 if (!sessioni.length) { flash("org-fa","⚠️ Aggiungi almeno una sessione.","err"); return; }
 const sessioniTavoli = sessioni.filter(s => !_isTipoSessioneFormSenzaTavoli(s.tipoSessione));
 // Ingresso: o «nessun massimo» oppure capienza ≥ 1.
 const ingressoConTettoInvalido = Array.from(document.getElementById("sessioni-list").querySelectorAll(".sess-item")).some(el => {
 const tipo = String(el.querySelector(".sess-tiposessione")?.value || "").trim().toUpperCase();
 if (!_isTipoSessioneFormSenzaTavoli(tipo)) return false;
 if (el.querySelector(".sess-nomax")?.checked) return false;
 return !(parseInt(el.querySelector(".sess-maxposti")?.value || 0, 10) > 0);
 });
 if (ingressoConTettoInvalido) {
 flash("org-fa","⚠️ Indica la capienza massima, oppure seleziona «Nessun numero massimo di posti».","err");
 return;
 }
 if (sessioniTavoli.length && !tavoli.length) {
 flash("org-fa","⚠️ Aggiungi almeno un tavolo per le sessioni a prenotazione tavoli.","err");
 return;
 }
 const tavoliFiltrati = sessioniTavoli.length ? tavoli : [];

 const payload = {
 eventId: evId,
 nome: evNome,
 data: document.getElementById("ev-data").value.trim(),
 luogo: document.getElementById("ev-luogo").value.trim(),
 luogoIndirizzo: String(document.getElementById("ev-luogo-indirizzo")?.value || "").trim(),
 sedeCoorganizzatore: String(document.getElementById("ev-sede-coorg")?.value || "").trim(),
 descrizione: document.getElementById("ev-desc").value.trim(),
 attivo: document.getElementById("ev-attivo").checked,
 inviaAvvisoNuoviTavoli: !!document.getElementById("ev-avviso-nuovi-tavoli")?.checked,
 inviaAvvisoNuoviGiochi: !!document.getElementById("ev-avviso-nuovi-giochi")?.checked,
 sessioni,
 tavoli: tavoliFiltrati
 };

 if (payload.inviaAvvisoNuoviTavoli) {
 google.script.run
 .withSuccessHandler(pre => {
 if (!pre || !pre.ok) {
 flash("org-fa","⚠️ " + (pre?.errore || "Impossibile calcolare anteprima destinatari."), "err");
 return;
 }
 if ((pre.totaleNuoviTavoli || 0) === 0) {
 flash("org-fa","ℹ️ Nessun nuovo tavolo rilevato: non verrà inviato alcun avviso.", "info");
 _continuaSalvaEvento(payload);
 return;
 }
 apriSelezioneAvvisoNuoviTavoli(pre, payload);
 })
 .withFailureHandler(err => {
 flash("org-fa","❌ Errore anteprima avvisi: " + (err.message || err), "err");
 })
 .anteprimaAvvisoNuoviTavoli(payload);
 return;
 }

 _continuaSalvaEvento(payload);
}

function apriSelezioneAvvisoNuoviTavoli(preview, payload) {
 ORG_SALVA_EVENTO_PENDING = { preview, payload };
 const summary = document.getElementById("org-avviso-tavoli-summary");
 const list = document.getElementById("org-avviso-tavoli-list");
 if (!summary || !list) {
 _continuaSalvaEvento(payload);
 return;
 }
 summary.textContent = `Nuovi tavoli: ${preview.totaleNuoviTavoli || 0} · Utenti candidati: ${preview.totaleCandidati || 0} · Invio stimato: ${preview.totaleInvioStimato || 0}`;
 const items = Array.isArray(preview.nuoviTavoliDettaglio) ? preview.nuoviTavoliDettaglio : [];
 list.innerHTML = items.length
 ? items.map((t, i) => `
 <label style="display:flex;align-items:flex-start;gap:8px;border:1px solid var(--vellum);border-radius:8px;padding:8px 10px;background:var(--parch3)">
 <input type="checkbox" class="org-avviso-tavolo-chk" data-tav-id="${escapeHtml(String(t.id || ""))}" checked style="width:auto;margin-top:2px">
 <span style="font-size:13px">
 <strong>${escapeHtml(String(t.gioco || t.id || "Tavolo"))}</strong>
 <span style="color:var(--ash)">(${escapeHtml(String(t.id || ""))})</span><br>
 <span style="color:var(--smoke)">Sessione: ${escapeHtml(String(t.sessioneNome || t.sessioneId || ""))}</span>
 </span>
 </label>
 `).join("")
 : `<div class="hint">Nessun tavolo selezionabile.</div>`;
 show("org-avviso-tavoli-overlay");
 _nascondiEventoPerAvviso();
}

function confermaSelezioneAvvisoNuoviTavoli() {
 const pending = ORG_SALVA_EVENTO_PENDING;
 if (!pending || !pending.payload) {
 chiudiAvvisoNuoviTavoli();
 return;
 }
 const selected = Array.from(document.querySelectorAll(".org-avviso-tavolo-chk:checked"))
 .map(el => String(el.getAttribute("data-tav-id") || "").trim())
 .filter(Boolean);
 const payload = { ...pending.payload, avvisoNuoviTavoliIds: selected };
 hide("org-avviso-tavoli-overlay");
 ORG_SALVA_EVENTO_PENDING = null;
 _continuaSalvaEvento(payload);
}

function _continuaSalvaEvento(payload) {
 if (payload && payload.inviaAvvisoNuoviGiochi && !payload._giochiAvvisoGestito) {
 google.script.run
 .withSuccessHandler(pre => {
 if (!pre || !pre.ok) {
 flash("org-fa","⚠️ " + (pre?.errore || "Impossibile calcolare l'anteprima dei giochi."), "err");
 _riapriEventoDopoAvviso();
 return;
 }
 if ((pre.totaleNuoviGiochi || 0) === 0) {
 flash("org-fa","ℹ️ Nessun gioco nuovo: non verrà inviato alcun avviso.", "info");
 payload.inviaAvvisoNuoviGiochi = false;
 eseguiSalvataggioEvento(payload);
 return;
 }
 apriSelezioneAvvisoNuoviGiochi(pre, payload);
 })
 .withFailureHandler(err => {
 flash("org-fa","❌ Errore anteprima giochi: " + (err.message || err), "err");
 _riapriEventoDopoAvviso();
 })
 .anteprimaAvvisoNuoviGiochi(payload);
 return;
 }
 eseguiSalvataggioEvento(payload);
}

function apriSelezioneAvvisoNuoviGiochi(preview, payload) {
 ORG_SALVA_EVENTO_PENDING = { preview, payload };
 const summary = document.getElementById("org-avviso-giochi-summary");
 const list = document.getElementById("org-avviso-giochi-list");
 if (!summary || !list) {
 payload._giochiAvvisoGestito = true;
 eseguiSalvataggioEvento(payload);
 return;
 }
 summary.textContent = `Giochi nuovi: ${preview.totaleNuoviGiochi || 0} · Iscritti con email: ${preview.totaleCandidati || 0} · Invio stimato: ${preview.totaleInvioStimato || 0}`;
 const items = Array.isArray(preview.nuoviGiochiDettaglio) ? preview.nuoviGiochiDettaglio : [];
 list.innerHTML = items.length
 ? items.map(g => `
 <label style="display:flex;align-items:flex-start;gap:8px;border:1px solid var(--vellum);border-radius:8px;padding:8px 10px;background:var(--parch3)">
 <input type="checkbox" class="org-avviso-gioco-chk" data-sess="${escapeHtml(String(g.sessioneId || ""))}" data-nome="${escapeHtml(String(g.nome || ""))}" checked style="width:auto;margin-top:2px">
 <span style="font-size:13px">
 <strong>${escapeHtml(String(g.nome || "Gioco"))}</strong><br>
 <span style="color:var(--smoke)">Sessione: ${escapeHtml(String(g.sessioneNome || g.sessioneId || ""))}</span>
 </span>
 </label>
 `).join("")
 : `<div class="hint">Nessun gioco selezionabile.</div>`;
 show("org-avviso-giochi-overlay");
 _nascondiEventoPerAvviso();
}

function _nascondiEventoPerAvviso() {
 const panel = document.getElementById("ev-form-panel");
 if (!panel || panel.classList.contains("hidden")) return;
 panel.dataset.riapriDopoAvviso = "1";
 hide("ev-form-panel");
}

function _riapriEventoDopoAvviso() {
 const panel = document.getElementById("ev-form-panel");
 if (!panel || panel.dataset.riapriDopoAvviso !== "1") return;
 delete panel.dataset.riapriDopoAvviso;
 show("ev-form-panel");
}

function chiudiAvvisoNuoviGiochi() {
 hide("org-avviso-giochi-overlay");
 _riapriEventoDopoAvviso();
}

function chiudiAvvisoNuoviTavoli() {
 hide("org-avviso-tavoli-overlay");
 _riapriEventoDopoAvviso();
}

function confermaSelezioneAvvisoNuoviGiochi() {
 const pending = ORG_SALVA_EVENTO_PENDING;
 if (!pending || !pending.payload) {
 chiudiAvvisoNuoviGiochi();
 return;
 }
 const selected = Array.from(document.querySelectorAll(".org-avviso-gioco-chk:checked")).map(el => ({
 sessioneId: String(el.getAttribute("data-sess") || "").trim(),
 nome: String(el.getAttribute("data-nome") || "").trim()
 })).filter(g => g.sessioneId && g.nome);
 const payload = { ...pending.payload, avvisoNuoviGiochi: selected, _giochiAvvisoGestito: true };
 const panel = document.getElementById("ev-form-panel");
 if (panel) delete panel.dataset.riapriDopoAvviso;
 hide("org-avviso-giochi-overlay");
 ORG_SALVA_EVENTO_PENDING = null;
 eseguiSalvataggioEvento(payload);
}

function eseguiSalvataggioEvento(payload) {
 const panelAvviso = document.getElementById("ev-form-panel");
 if (panelAvviso) delete panelAvviso.dataset.riapriDopoAvviso;
 document.querySelectorAll(".btn").forEach(b => b.disabled=true);
 beginActionOverlay("Salvataggio evento…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 document.querySelectorAll(".btn").forEach(b => b.disabled=false);
 if (res.ok) {
 flash("org-fa","✅ "+res.messaggio,"ok");
 const shouldRestoreMappa = !!_evFormOriginMappa;
 hide("ev-form-panel");
 caricaOrg();
 if (shouldRestoreMappa) {
 setTimeout(() => _restoreMappaAfterEvFormIfNeeded(), 120);
 }
 }
 else {
 segnalaErroreOrgClient("salvaEvento", payload, "Salvataggio evento: risposta server non ok.", res.errore);
 flash("org-fa","⚠️ "+res.errore,"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 document.querySelectorAll(".btn").forEach(b => b.disabled=false);
 segnalaErroreOrgClient("salvaEvento", payload, "Chiamata salvaEvento fallita (connessione/eccezione).", err.message || String(err));
 flash("org-fa","Operazione non riuscita. Riprova o controlla la connessione.","err");
 })
 .salvaEvento(payload);
}

function disattivaEv(evId) {
 beginActionOverlay("Disattivazione evento…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) { flash("org-fa","✅ "+res.messaggio,"ok"); caricaOrg(); }
 else {
 segnalaErroreOrgClient("disattivaEvento", { eventId: evId }, "Disattivazione evento: risposta server non ok.", res?.errore);
 flash("org-fa","⚠️ "+res.errore,"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 segnalaErroreOrgClient("disattivaEvento", { eventId: evId }, "Chiamata disattivaEvento fallita (connessione/eccezione).", err.message || String(err));
 flash("org-fa","Operazione non riuscita. Riprova o controlla la connessione.","err");
 })
 .disattivaEvento(evId);
}

function attivaEv(evId) {
 beginActionOverlay("Attivazione evento…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) { flash("org-fa","✅ "+res.messaggio,"ok"); caricaOrg(); }
 else {
 segnalaErroreOrgClient("attivaEvento", { eventId: evId }, "Attivazione evento: risposta server non ok.", res?.errore);
 flash("org-fa","⚠️ "+res.errore,"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 segnalaErroreOrgClient("attivaEvento", { eventId: evId }, "Chiamata attivaEvento fallita (connessione/eccezione).", err.message || String(err));
 flash("org-fa","Operazione non riuscita. Riprova o controlla la connessione.","err");
 })
 .attivaEvento(evId);
}

function inviaNotificaNuovoEvento(eventId, nomeEv) {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 flash("org-fa","⚠️ Invio notifica disponibile solo nella versione pubblicata della web app.","err");
 return;
 }
 NOTIFICA_EVENTO_CORRENTE_ID = eventId;
 document.getElementById("notifica-dialog-title").textContent = `📣 Invia notifica: ${nomeEv}`;
 const modeUtenti = document.getElementById("notifica-mode-utenti");
 const modeTest = document.getElementById("notifica-mode-test");
 if (modeUtenti) modeUtenti.checked = true;
 if (modeTest) modeTest.checked = false;
 show("notifica-overlay");
}

function confermaInviaNotificaNuovoEvento() {
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 flash("org-fa","⚠️ Invio notifica disponibile solo nella versione pubblicata della web app.","err");
 return;
 }
 const modeUtenti = document.getElementById("notifica-mode-utenti");
 const modeTest = document.getElementById("notifica-mode-test");
 const mode = (modeTest && modeTest.checked) ? "test" : "utenti";
 hide("notifica-overlay");
 beginActionOverlay("Invio notifica nuovo evento…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (res && res.ok) {
 const msg = String(res.messaggio || "").trim();
 if (msg) flash("org-fa","✅ " + msg,"ok");
 else {
 const target = mode === "test" ? "indirizzi di test" : "tutti gli utenti";
 flash("org-fa","✅ Notifica inviata a " + target + ".","ok");
 }
 caricaOrg();
 } else {
 flash("org-fa","⚠️ " + (res?.errore || "Errore durante l'invio della notifica."),"err");
 }
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa","❌ Errore: " + (err.message || err),"err");
 })
 .inviaNotificaNuovoEvento(NOTIFICA_EVENTO_CORRENTE_ID, mode);
}

let AVVISO_EVENTO_POPUP_DATA = null;
let AVVISO_EVENTO_POPUP_TAB = "mancanti";
let AVVISO_EVENTO_POPUP_EVENT_ID = "";
let AVVISO_EVENTO_POPUP_EVENT_NOME = "";

function chiudiAvvisoEventoPopup() {
 hide("avviso-evento-overlay");
}

function _renderAvvisoEventoPopupTab() {
 const listEl = document.getElementById("avviso-evento-list");
 if (!listEl) return;
 const data = AVVISO_EVENTO_POPUP_DATA;
 if (!data || !data.ok) {
 listEl.innerHTML = `<div class="avviso-evento-muted">Nessun dato disponibile.</div>`;
 return;
 }
 const arr = AVVISO_EVENTO_POPUP_TAB === "attesa"
 ? (Array.isArray(data.inAttesa) ? data.inAttesa : [])
 : (AVVISO_EVENTO_POPUP_TAB === "mancanti"
 ? (Array.isArray(data.mancanti) ? data.mancanti : [])
 : (Array.isArray(data.ricevuto) ? data.ricevuto : []));
 if (!arr.length) {
 listEl.innerHTML = `<div class="avviso-evento-muted">Nessun nominativo in questa sezione.</div>`;
 return;
 }
 listEl.innerHTML = arr.map(u => `
 <div class="avviso-evento-row">
 <strong>${_escapeHtmlMail(u.nome || "Senza nome")}</strong>
 <span style="color:var(--ash)"> · ${_escapeHtmlMail(u.email || "senza email")}</span>
 </div>
 `).join("");
}

function switchAvvisoEventoTab(tabId, btn) {
 AVVISO_EVENTO_POPUP_TAB = (tabId === "attesa" || tabId === "mancanti") ? tabId : "ricevuto";
 document.querySelectorAll(".avviso-evento-tab").forEach(b => b.classList.remove("active"));
 if (btn) btn.classList.add("active");
 _renderAvvisoEventoPopupTab();
}

function apriAvvisoEventoPopup(eventId, nomeEvento) {
 const titleEl = document.getElementById("avviso-evento-title");
 const subtitleEl = document.getElementById("avviso-evento-subtitle");
 const listEl = document.getElementById("avviso-evento-list");
 if (titleEl) titleEl.textContent = `📬 Stato avviso: ${nomeEvento || eventId}`;
 if (subtitleEl) subtitleEl.textContent = "Caricamento dati…";
 if (listEl) listEl.innerHTML = `<div class="avviso-evento-muted">Attendi, sto calcolando ricevuto / in attesa / mancanti…</div>`;
 AVVISO_EVENTO_POPUP_TAB = "mancanti";
 AVVISO_EVENTO_POPUP_DATA = null;
 AVVISO_EVENTO_POPUP_EVENT_ID = String(eventId || "").trim();
 AVVISO_EVENTO_POPUP_EVENT_NOME = String(nomeEvento || "").trim();
 document.querySelectorAll(".avviso-evento-tab").forEach(b => b.classList.remove("active"));
 const firstTabBtn = document.querySelector('.avviso-evento-tab[data-avv-tab="mancanti"]');
 if (firstTabBtn) firstTabBtn.classList.add("active");
 show("avviso-evento-overlay");

 google.script.run
 .withSuccessHandler(res => {
 if (!res || !res.ok) {
 if (subtitleEl) subtitleEl.textContent = "Errore caricamento";
 if (listEl) listEl.innerHTML = `<div class="avviso-evento-muted" style="color:#b71c1c">❌ ${_escapeHtmlMail(res?.errore || "Errore nel caricamento stato avviso.")}</div>`;
 return;
 }
 AVVISO_EVENTO_POPUP_DATA = res;
 if (subtitleEl) {
 subtitleEl.innerHTML = `
 Candidati: <strong>${res.totaleCandidati || 0}</strong>
 · Già prenotati a questo evento (esclusi): <strong>${res.esclusiPrenotati || 0}</strong>
 · Ricevuto: <strong>${(res.ricevuto || []).length}</strong>
 · In attesa: <strong>${(res.inAttesa || []).length}</strong>
 · Mancanti: <strong>${(res.mancanti || []).length}</strong>
 `;
 }
 _renderAvvisoEventoPopupTab();
 })
 .withFailureHandler(err => {
 if (subtitleEl) subtitleEl.textContent = "Errore caricamento";
 if (listEl) listEl.innerHTML = `<div class="avviso-evento-muted" style="color:#b71c1c">❌ ${_escapeHtmlMail(err?.message || err || "Errore di connessione.")}</div>`;
 })
 .getDettaglioAvvisoEvento(eventId);
}

function apriInvioNotificaDaPopupAvviso() {
 const eventId = String(AVVISO_EVENTO_POPUP_EVENT_ID || "").trim();
 if (!eventId) {
 showNotifyPopup("⚠️ Evento non selezionato.", "err");
 return;
 }
 chiudiAvvisoEventoPopup();
 inviaNotificaNuovoEvento(eventId, AVVISO_EVENTO_POPUP_EVENT_NOME || eventId);
}

// ═══════════════════════════════════════════
// SETUP INIZIALE
// ═══════════════════════════════════════════
const SETUP_CHECKS = ["chk-config","chk-eventi","chk-sessioni","chk-tavoli","chk-avventure","chk-avventure-tavoli","chk-fasce-eta","chk-sistemi-gioco","chk-luoghi","chk-utenti","chk-avvisi-eventi","chk-masters","chk-partecipanti","chk-amicizie","chk-migrazioni","chk-risposte"];
const SETUP_LABELS = {
 "chk-config": ["Config", "Foglio <strong>Config</strong> (chiave / valore / descrizione)"],
 "chk-eventi": ["Eventi", "Foglio <strong>Eventi</strong> (eventId / nome / data / luogo / indirizzoLuogo / descrizione / attivo)"],
 "chk-sessioni": ["Sessioni", "Foglio <strong>Sessioni</strong> (eventId / sessioneId / nome / orario / attivo / maxPosti / tipoSessione / fasciaEtaMinima)"],
 "chk-tavoli": ["Tavoli", "Foglio <strong>Tavoli</strong> (eventId / sessioneId / id / gioco / tipo / max / occupati / fasce / partecipanti / attivo / sistemaGioco / titoloAvventura / descrizione / fasciaEtaMinima / master / mostraMaster / descrizioneTavolo)"],
 "chk-avventure": ["Avventure", "Foglio <strong>Avventure</strong> (avventuraId / masterId / masterNick / titoloAvventura / sistemaGioco / livello / tipo / max / occupati / descrizione / tema / ambientazione / fasciaEtaMinima / mostraMaster / attivo / createdAt / updatedAt / tono / tematicheSensibili)"],
 "chk-avventure-tavoli": ["AvventureTavoli", "Foglio <strong>AvventureTavoli</strong> (linkId / avventuraId / tavoloId / createdAt – FK verso tavolo; evento/sessione sul foglio Tavoli)"],
 "chk-fasce-eta": ["FasceEta", "Foglio <strong>FasceEta</strong> (fasciaId / fascia / ordine / attivo / note)"],
 "chk-sistemi-gioco": ["SistemiGioco", "Foglio <strong>SistemiGioco</strong> (sistema / attivo / ordine / note)"],
 "chk-luoghi": ["Luoghi", "Foglio <strong>Luoghi</strong> (nomeLuogo / indirizzo / attivo / createdAt / updatedAt / note)"],
 "chk-utenti": ["Utenti", "Foglio <strong>Utenti</strong> (uuid / email / nome / cellulare / primaPrenotazione / ultimaPrenotazione / totPrenotazioni / eventiDiversi / note)"],
 "chk-avvisi-eventi": ["AvvisiEventi", "Foglio <strong>AvvisiEventi</strong> (storico invii evento/utente – avvisoId / eventId / uuid / email / nome / destinatarioTipo / stato / sentAt / errore / note)"],
 "chk-masters": ["Masters", "Foglio <strong>Masters</strong> (masterId / nome / nick / email / cellulare / primaAssegnazione / ultimaAssegnazione / totTavoli / eventiDiversi / sessioniDiverse / note)"],
 "chk-partecipanti": ["Partecipanti", "Foglio <strong>Partecipanti</strong> (co-prenotanti / inviti – participantId / bookingId / eventId / sessioneId / ownerUuid / participantUuid / nome / email / statoInvito / ruolo / inviteToken / tokenScadenzaIso / createdAt / updatedAt / nomeCompleto)"],
 "chk-amicizie": ["Amicizie", "Foglio <strong>Amicizie</strong> (rubrica utente – friendId / ownerUuid / nome / email / cellulare / note / createdAt / updatedAt / stato)"],
 "chk-migrazioni": ["Migrazioni", "Foglio <strong>Migrazioni</strong> (id / descrizione / data_esecuzione – log migrazioni schema)"],
 "chk-risposte": ["_ESEMPIO", "Foglio <strong>_ESEMPIO</strong> nel file Risposte (intestazioni)"],
};

function setCheckStatus(id, stato) {
 const el = document.getElementById(id);
 if (!el) return;
 const [, label] = SETUP_LABELS[id];
 const icon = stato==="done" ? "✅" : stato==="fail" ? "❌" : "⬜";
 el.innerHTML = `${icon} ${label}`;
 el.className = "setup-check" + (stato==="done"?" done":stato==="fail"?" fail":"");
}

function setSetupStatus(msg, tipo) {
 const el = document.getElementById("setup-status");
 const t = tipo || "info";
 if (t === "ok" || t === "err") {
 if (el) {
 el.style.display = "none";
 el.innerHTML = "";
 }
 showNotifyPopup(msg, t);
 return;
 }
 if (!el) return;
 el.style.display = "block";
 el.innerHTML = `<div class="flash f-${t}" style="margin-bottom:0">${msg}</div>`;
}

function eseguiSetup() {
 const btn = document.getElementById("setup-btn");
 const vbtn = document.getElementById("setup-verify-btn");
 btn.disabled = true; vbtn.disabled = true;
 setSetupStatus("⏳ Esecuzione setup in corso…", "info");
 SETUP_CHECKS.forEach(id => setCheckStatus(id, "pending"));

 google.script.run
 .withSuccessHandler(res => {
 btn.disabled = false; vbtn.disabled = false;
 if (res && res.ok) {
 SETUP_CHECKS.forEach((id, i) => {
 setTimeout(() => setCheckStatus(id, "done"), i * 220);
 });
 setTimeout(() => {
 setSetupStatus("✅ " + (res.messaggio || "Setup completato con successo!"), "ok");
 }, SETUP_CHECKS.length * 220 + 100);
 } else {
 segnalaErroreOrgClient("setupFogliConfig", null, "Setup iniziale: risposta server non ok.", res?.errore || "Errore durante il setup.");
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante il setup."), "err");
 }
 })
 .withFailureHandler(err => {
 btn.disabled = false; vbtn.disabled = false;
 SETUP_CHECKS.forEach(id => setCheckStatus(id, "fail"));
 segnalaErroreOrgClient("setupFogliConfig", null, "Chiamata setupFogliConfig fallita (connessione/eccezione).", err.message || String(err));
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .setupFogliConfig();
}

function eseguiMigrazioniSetup() {
 const btn = document.getElementById("setup-mig-btn");
 if (btn) btn.disabled = true;
 setSetupStatus("📦 Esecuzione migrazioni in corso…", "info");

 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (!res) {
 setSetupStatus("⚠️ Nessuna risposta dal server.", "err");
 return;
 }
 if (res.applicate && res.applicate.length) {
 const dettaglio = res.applicate.join(" · ");
 setSetupStatus("✅ " + (res.messaggio || "Migrazioni applicate.") + " " + dettaglio, "ok");
 } else if (res.errori && res.errori.length) {
 setSetupStatus("⚠️ " + res.messaggio + " " + res.errori.join("; "), "err");
 } else {
 setSetupStatus("✅ " + (res.messaggio || "Nessuna migrazione pendente. Fogli già aggiornati."), "ok");
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 segnalaErroreOrgClient("eseguiMigrazioni", null, "Migrazioni fallite.", err.message || String(err));
 setSetupStatus("❌ Errore migrazioni: " + (err.message || err), "err");
 })
 .eseguiMigrazioni();
}

function inviaEmailTestSetup() {
 const sel = document.getElementById("test-email-tipo");
 const tipo = sel ? sel.value : "tutte";
 setSetupStatus("✉️ Invio email di prova in corso…", "info");

 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 setSetupStatus("✅ " + (res.messaggio || "Email di prova inviate."), "ok");
 const cbEmailTestOk = document.getElementById("cfg-email-test-ok");
 if (cbEmailTestOk) cbEmailTestOk.checked = false;
 const lastProof = document.getElementById("email-test-last-proof");
 if (lastProof) lastProof.textContent = res.emailTestUltimaProva || res.EMAIL_TEST_ULTIMA_PROVA || "—";
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante l'invio delle email di prova."), "err");
 }
 })
 .withFailureHandler(err => {
 segnalaErroreOrgClient("inviaEmailTest", { tipo }, "Invio email di prova fallito.", err.message || String(err));
 setSetupStatus("❌ Errore invio email di prova: " + (err.message || err), "err");
 })
 .inviaEmailTest(tipo);
}

function verificaSetup() {
 const btn = document.getElementById("setup-btn");
 const vbtn = document.getElementById("setup-verify-btn");
 btn.disabled = true; vbtn.disabled = true;
 setSetupStatus("🔍 Verifica struttura fogli in corso…", "info");

 google.script.run
 .withSuccessHandler(res => {
 btn.disabled = false; vbtn.disabled = false;
 if (!res || !res.ok) {
 segnalaErroreOrgClient("verificaStruttura", null, "Verifica struttura: risposta server non ok.", res?.errore || "Impossibile verificare.");
 setSetupStatus("⚠️ " + (res?.errore || "Impossibile verificare."), "err");
 return;
 }
 const fogli = res.fogli || {};
 let tuttiOk = true;
 SETUP_CHECKS.forEach(id => {
 const nome = SETUP_LABELS[id][0];
 const stato = fogli[nome] ? "done" : "fail";
 if (stato === "fail") tuttiOk = false;
 setCheckStatus(id, stato);
 });
 setSetupStatus(
 tuttiOk
 ? "✅ Struttura completa! Tutti i fogli necessari sono presenti."
 : "⚠️ Alcuni fogli mancanti. Esegui il Setup iniziale per crearli.",
 tuttiOk ? "ok" : "err"
 );
 })
 .withFailureHandler(err => {
 btn.disabled = false; vbtn.disabled = false;
 segnalaErroreOrgClient("verificaStruttura", null, "Chiamata verificaStruttura fallita (connessione/eccezione).", err.message || String(err));
 setSetupStatus("❌ Errore verifica: " + (err.message || err), "err");
 })
 .verificaStruttura();
}

function _renderStatoTriggerSchedulati(res) {
 const panel = document.getElementById("trigger-status-panel");
 if (!panel) return;
 if (!res || !res.ok) {
 panel.innerHTML = `<div style="color:#b71c1c">❌ Errore lettura trigger: ${String(res?.errore || "risposta non valida")}</div>`;
 return;
 }
 const coda = res.processaCodaEmailSchedulato || { active: false, count: 0 };
 const health = res.healthCheckFogliSchedulato || { active: false, count: 0 };
 const backup = res.backupFogliSchedulato || { active: false, count: 0 };
 const row = (label, d, hint) =>
 `<div style="margin:6px 0"><strong>${label}</strong>: ${d.active ? "✅ attivo" : "⚠️ non attivo"} (totale: ${d.count || 0})` +
 (hint ? ` <span style="color:var(--ash);font-style:italic">${hint}</span>` : "") +
 `</div>`;
 panel.innerHTML =
 row("Coda email (processaCodaEmailSchedulato)", coda, "consigliato ogni 30 minuti") +
 row("Health check (healthCheckFogliSchedulato)", health, "tipicamente notturno") +
 row("Backup fogli (backupFogliSchedulato)", backup, "consigliato ogni giorno alle 3:00");
 aggiornaStatoBackupFogli();
}

function _renderStatoBackupFogli(res) {
 const panel = document.getElementById("backup-status-panel");
 if (!panel) return;
 if (!res || !res.ok) {
 panel.innerHTML = `<div style="color:#b71c1c">❌ Stato backup: ${String(res?.errore || "non disponibile")}</div>`;
 return;
 }
 const when = res.lastIso ? _fmtDateTimeMail(res.lastIso) : "mai";
 const stato = res.lastIso
 ? (res.lastOk ? "✅ ultimo OK" : "⚠️ ultimo con errore")
 : "— nessun backup registrato";
 const folder = res.folderUrl
 ? `<a href="${escapeHtml(res.folderUrl)}" target="_blank" rel="noopener">Apri cartella Drive</a>`
 : (res.folderId ? `folderId=${escapeHtml(res.folderId)}` : "cartella non ancora creata");
 panel.innerHTML =
 `<div><strong>Backup fogli</strong>: ${stato}</div>` +
 `<div style="margin-top:4px">Ultimo: ${escapeHtml(when)} · retention: ${res.keep || 14} run · ${folder}</div>`;
}

function aggiornaStatoBackupFogli() {
 const panel = document.getElementById("backup-status-panel");
 if (!panel) return;
 panel.textContent = "Caricamento stato backup...";
 google.script.run
 .withSuccessHandler(res => _renderStatoBackupFogli(res))
 .withFailureHandler(err => _renderStatoBackupFogli({ ok: false, errore: err?.message || String(err || "") }))
 .getStatoBackupFogli();
}

function aggiornaStatoTriggerSchedulati() {
 const panel = document.getElementById("trigger-status-panel");
 const btn = document.getElementById("trigger-refresh-btn");
 if (panel) panel.textContent = "Caricamento stato trigger...";
 if (btn) btn.disabled = true;
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 _renderStatoTriggerSchedulati(res);
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 _renderStatoTriggerSchedulati({ ok: false, errore: err?.message || String(err || "") });
 })
 .getStatoTriggerSchedulati();
}

function installaTriggerCodaEmailDaUI() {
 const btn = document.getElementById("trigger-install-email-btn");
 if (btn) btn.disabled = true;
 setSetupStatus("⏱ Configurazione trigger coda email in corso…", "info");
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 setSetupStatus("✅ " + (res.messaggio || "Trigger coda email configurato."), "ok");
 aggiornaStatoTriggerSchedulati();
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Impossibile configurare il trigger."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 setSetupStatus("❌ Errore configurazione trigger: " + (err?.message || err), "err");
 })
 .installaTriggerCodaEmailOgni30Min();
}

function installaTriggerBackupDaUI() {
 const btn = document.getElementById("trigger-install-backup-btn");
 if (btn) btn.disabled = true;
 setSetupStatus("💾 Configurazione trigger backup in corso…", "info");
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 setSetupStatus("✅ " + (res.messaggio || "Trigger backup configurato."), "ok");
 aggiornaStatoTriggerSchedulati();
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Impossibile configurare il trigger backup."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 setSetupStatus("❌ Errore configurazione trigger backup: " + (err?.message || err), "err");
 })
 .installaTriggerBackupGiornaliero();
}

function eseguiBackupFogliDaUI() {
 const btn = document.getElementById("backup-run-btn");
 if (btn) btn.disabled = true;
 setSetupStatus("💾 Backup fogli in corso…", "info");
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 setSetupStatus("✅ Backup completato: copie Config e Risposte su Drive.", "ok");
 aggiornaStatoBackupFogli();
 } else {
 setSetupStatus("⚠️ Backup non riuscito: " + (res?.errore || "errore sconosciuto"), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 setSetupStatus("❌ Errore backup: " + (err?.message || err), "err");
 })
 .eseguiBackupFogliManuale();
}

function _fmtDateTimeMail(iso) {
 if (!iso) return "—";
 try {
 const d = new Date(iso);
 if (isNaN(d.getTime())) return "—";
 return d.toLocaleString("it-IT");
 } catch (_e) {
 return "—";
 }
}

function _escapeHtmlMail(s) {
 return String(s || "")
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;");
}

function _escapeHtmlAttrMail(s) {
 return String(s || "")
 .replace(/&/g, "&amp;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
}

let MAIL_STORICO_ITEMS = [];

function _descrizioneMailPerContesto(context) {
 const c = String(context || "").trim().toLowerCase();
 if (!c) return "Invio email senza contesto specifico.";
 if (c === "invianotificaorg") return "Log operativo interno verso organizzatore (nuova prenotazione, modifica o cancellazione).";
 if (c.indexOf("avvisi_notifica:destinatario") === 0) return "Notifica evento inviata al destinatario finale.";
 if (c.indexOf("avvisi_notifica:archivio") === 0) return "Copia archivio monitor per notifiche di massa.";
 if (c.indexOf("_inviaemailconarchivio:destinatario") === 0) return "Email principale inviata al destinatario (conferma/modifica/promemoria).";
 if (c.indexOf("_inviaemailconarchivio:archivio") === 0) return "Seconda copia archivio inviata al monitor.";
 if (c.indexOf("healthcheckfoglischedulato:report") === 0) return "Report automatico health check fogli per monitoraggio anomalie.";
 if (c.indexOf("email_test") === 0) return "Invio di test template email dall'area setup.";
 return "Invio tecnico registrato dalla coda email.";
}

function apriMailDetailPopup(index) {
 const item = MAIL_STORICO_ITEMS[index];
 const content = document.getElementById("mail-detail-content");
 if (!item || !content) return;
 const desc = _descrizioneMailPerContesto(item.context || "");
 const bodyText = String(item.body || "");
 const htmlBody = String(item.htmlBody || "");
 const htmlRicostruito = !!item.htmlRicostruito;
 const bodyRendered = bodyText
 ? _escapeHtmlMail(bodyText).replace(/\n/g, "<br>")
 : "<em style='color:var(--ash)'>Contenuto testuale non disponibile.</em>";
 const htmlRendered = htmlBody
 ? `<iframe
 title="Anteprima template email"
 sandbox=""
 style="width:100%;min-height:420px;border:1px solid #dbc8aa;border-radius:10px;background:#fff"
 srcdoc="${_escapeHtmlAttrMail(htmlBody)}"></iframe>`
 : "<em style='color:var(--ash)'>Template HTML non disponibile nello storico per questa email.</em>";
 content.innerHTML = `
 <div class="mail-detail-grid">
 <div class="mail-detail-kv"><span class="k">Quando</span><span class="v">${_escapeHtmlMail(_fmtDateTimeMail(item.timestamp))}</span></div>
 <div class="mail-detail-kv"><span class="k">Stato</span><span class="v">${_escapeHtmlMail(item.status || "—")}</span></div>
 <div class="mail-detail-kv"><span class="k">Nome destinatario</span><span class="v">${_escapeHtmlMail(item.nome || "—")}</span></div>
 <div class="mail-detail-kv"><span class="k">Destinatario</span><span class="v">${_escapeHtmlMail(item.to || "—")}</span></div>
 <div class="mail-detail-kv"><span class="k">Source</span><span class="v">${_escapeHtmlMail(item.source || "—")}</span></div>
 <div class="mail-detail-kv"><span class="k">Contesto</span><span class="v">${_escapeHtmlMail(item.context || "—")}</span></div>
 <div class="mail-detail-kv"><span class="k">Descrizione</span><span class="v">${_escapeHtmlMail(desc)}</span></div>
 </div>
 <div class="mail-detail-box"><strong>Oggetto</strong><br>${_escapeHtmlMail(item.subject || "—")}</div>
 <details class="mail-detail-box">
 <summary style="cursor:pointer;font-weight:700">Contenuto testo</summary>
 <div style="margin-top:8px">${bodyRendered}</div>
 </details>
 <details class="mail-detail-box" open>
 <summary style="cursor:pointer;font-weight:700">Template HTML completo${htmlRicostruito ? " (ricostruito)" : ""}</summary>
 <div style="margin-top:8px">${htmlRendered}</div>
 </details>
 ${item.errore ? `<div class="mail-detail-box" style="border-color:#ef9a9a;background:#fff7f7"><strong>Nota / errore</strong><br>${_escapeHtmlMail(item.errore)}</div>` : ""}
 `;
 show("mail-detail-overlay");
}

function chiudiMailDetailPopup() {
 hide("mail-detail-overlay");
}

function _renderMailOrgStatus(res) {
 const panel = document.getElementById("mail-status-panel");
 const preview = document.getElementById("mail-queue-preview");
 const sentLogEl = document.getElementById("mail-sent-log");
 if (!panel) return;
 if (!res || !res.ok) {
 panel.innerHTML = `<div style="color:#b71c1c">❌ Errore lettura stato email: ${_escapeHtmlMail(res?.errore || "risposta non valida")}</div>`;
 if (preview) preview.innerHTML = "";
 if (sentLogEl) sentLogEl.innerHTML = "";
 return;
 }
 const q = res.queue || {};
 const quota = (typeof res.quota === "number") ? res.quota : "—";
 const soglia = (typeof res.bufferSicurezza === "number") ? res.bufferSicurezza : "—";
 panel.innerHTML = [
 `<div><strong>Quota giornaliera residua</strong>: ${quota} (soglia sicurezza: ${soglia})</div>`,
 `<div class="mail-status-grid">
 <div class="mail-stat-chip"><strong>Pending</strong>: ${q.queued || 0}</div>
 <div class="mail-stat-chip"><strong>Pronti ora</strong>: ${q.dueNow || 0}</div>
 <div class="mail-stat-chip"><strong>Inviati</strong>: ${q.sent || 0}</div>
 <div class="mail-stat-chip"><strong>Dead</strong>: ${q.dead || 0}</div>
 </div>`,
 `<div style="margin-top:8px"><strong>Prossimo invio pianificato</strong>: ${_fmtDateTimeMail(q.prossimaEsecuzione)}</div>`
 ].join("");
 if (!preview) return;
 const items = Array.isArray(q.anteprima) ? q.anteprima : [];
 if (!items.length) {
 preview.innerHTML = `<div style="font-style:italic;color:var(--ash)">Nessuna email in coda da mostrare.</div>`;
 } else {
 preview.innerHTML = `
 <div class="mail-mini-list-title">Anteprima coda</div>
 <div class="mail-log-list">
 ${items.map(it => `
 <div class="mail-log-item" style="cursor:default">
 <div class="mail-log-head">
 <span class="mail-log-badge">${_escapeHtmlMail(it.status || "queued")}</span>
 <span>${_escapeHtmlMail(it.context || "email")}</span>
 </div>
 <div class="mail-log-to">${_escapeHtmlMail(it.to || "destinatario sconosciuto")}</div>
 <div class="mail-log-subject">Next tentativo: ${_fmtDateTimeMail(it.nextAttemptAt)}</div>
 ${it.errore ? `<div class="mail-log-err">Nota: ${_escapeHtmlMail(it.errore)}</div>` : ""}
 </div>
 `).join("")}
 </div>
 `;
 }

 if (!sentLogEl) return;
 const sentItems = Array.isArray(res.logInviate) ? res.logInviate : [];
 if (!sentItems.length) {
 sentLogEl.innerHTML = `<div style="font-style:italic;color:var(--ash)">Nessuna email inviata registrata nella coda.</div>`;
 return;
 }
 MAIL_STORICO_ITEMS = sentItems.slice();
 sentLogEl.innerHTML = `
 <div class="mail-mini-list-title">Storico mail (inviate + in attesa, ultime ${sentItems.length}) · clicca una voce per il dettaglio</div>
 <div class="mail-log-list">
 ${sentItems.map((it, idx) => `
 <button type="button" class="mail-log-item" onclick="apriMailDetailPopup(${idx})">
 <div class="mail-log-head">
 <strong>${_fmtDateTimeMail(it.timestamp)}</strong>
 <span class="mail-log-badge">${_escapeHtmlMail(it.status || "stato")}</span>
 <span>${_escapeHtmlMail(it.context || "email")}</span>
 </div>
 ${it.nome ? `<div class="mail-log-subject">${_escapeHtmlMail(it.nome)}</div>` : ""}
 <div class="mail-log-to">${_escapeHtmlMail(it.to || "destinatario sconosciuto")}</div>
 ${it.subject ? `<div class="mail-log-subject">${_escapeHtmlMail(it.subject)}</div>` : ""}
 ${it.errore ? `<div class="mail-log-err">Nota: ${_escapeHtmlMail(it.errore)}</div>` : ""}
 </button>
 `).join("")}
 </div>
 `;
}

function aggiornaStatoMailOrg() {
 const btn = document.getElementById("mail-refresh-btn");
 const panel = document.getElementById("mail-status-panel");
 if (btn) btn.disabled = true;
 if (panel) panel.textContent = "Caricamento stato email...";
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 _renderMailOrgStatus(res);
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 _renderMailOrgStatus({ ok: false, errore: err?.message || String(err || "") });
 })
 .getStatoEmailOrganizzatore(8);
}

function processaCodaEmailOraDaUI() {
 const btn = document.getElementById("mail-run-queue-btn");
 if (btn) btn.disabled = true;
 google.script.run
 .withSuccessHandler(res => {
 if (btn) btn.disabled = false;
 if (res && res.ok) {
 showNotifyPopup(`✅ Coda processata. Inviate: ${res.inviate || 0}, residue: ${res.residue || 0}.`, "ok");
 } else {
 showNotifyPopup(`⚠️ Processamento coda completato con avviso: ${res?.errore || "errore non specificato"}`, "err");
 }
 aggiornaStatoMailOrg();
 aggiornaStatoTriggerSchedulati();
 })
 .withFailureHandler(err => {
 if (btn) btn.disabled = false;
 showNotifyPopup("❌ Errore durante il processamento coda: " + (err?.message || err), "err");
 })
 .processaCodaEmailSchedulato(30);
}

async function generaHash() {
 const p1 = document.getElementById("hash-pwd").value;
 const p2 = document.getElementById("hash-pwd2").value;
 if (!p1) { alert("Inserisci una password."); return; }
 if (p1 !== p2) { alert("Le password non coincidono."); return; }
 if (p1.length < 6) { alert("La password deve essere di almeno 6 caratteri."); return; }
 const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p1));
 const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
 document.getElementById("hash-value").textContent = hash;
 show("hash-result");
}

function copiaHash() {
 const h = document.getElementById("hash-value").textContent;
 if (!h) return;
 navigator.clipboard.writeText(h).then(() => {
 const btn = document.querySelector("#hash-result .btn");
 if (btn) { btn.textContent = "✅ Copiato!"; setTimeout(() => btn.textContent = "📋 Copia", 2000); }
 });
}

function salvaHashSuSheet() {
 const h = document.getElementById("hash-value").textContent;
 if (!h) return;
 const btn = document.getElementById("btn-salva-hash");
 btn.disabled = true;
 btn.textContent = "⏳ Salvataggio…";
 google.script.run
 .withSuccessHandler(res => {
 btn.disabled = false;
 if (res && res.ok) {
 btn.textContent = "✅ Salvato!";
 btn.className = btn.className.replace("btn-s","btn-o");
 setSetupStatus("✅ Hash password salvato nel foglio Config.", "ok");
 setTimeout(() => { btn.textContent = "💾 Salva nel foglio Config"; btn.className = btn.className.replace("btn-o","btn-s"); }, 4000);
 } else {
 segnalaErroreOrgClient("salvaHashPassword", { hashPresente: true }, "Salvataggio hash password: risposta server non ok (hash non inviato).", res?.errore || "Errore nel salvataggio.");
 btn.textContent = "💾 Salva nel foglio Config";
 setSetupStatus("⚠️ " + (res?.errore || "Errore nel salvataggio."), "err");
 }
 })
 .withFailureHandler(err => {
 btn.disabled = false;
 segnalaErroreOrgClient("salvaHashPassword", { hashPresente: true }, "Chiamata salvaHashPassword fallita (connessione/eccezione). Hash non inviato.", err.message || String(err));
 btn.textContent = "💾 Salva nel foglio Config";
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .salvaHashPassword(h);
}

function salvaEmailTestOk() {
 const cb = document.getElementById("cfg-email-test-ok");
 if (!cb) return;
 const enabled = !!cb.checked;
 setSetupStatus("⏳ Salvataggio conferma email di test…", "info");
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) setSetupStatus("✅ Conferma email di test salvata.", "ok");
 else setSetupStatus("⚠️ " + (res?.errore || "Errore nel salvataggio."), "err");
 })
 .withFailureHandler(err => {
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .salvaOpzioniConfig({ EMAIL_TEST_FUNZIONANO: enabled });
}

function syncCopiaArchivioCheckboxes() {
 const main = document.getElementById("cfg-email-copia-archivio");
 const avvisi = document.getElementById("cfg-email-copia-archivio-avvisi");
 if (!avvisi) return;
 if (main && !main.checked) {
 avvisi.checked = false;
 avvisi.disabled = true;
 } else {
 avvisi.disabled = false;
 }
}

function salvaOpzioniConfig() {
 const cb = document.getElementById("cfg-waitlist-priority");
 const cbActions = document.getElementById("cfg-waitlist-actions");
 const cbPromemoria = document.getElementById("cfg-waitlist-promemoria");
 const cbExportCsvEvento = document.getElementById("cfg-export-csv-evento");
 const cbEmailCopiaArchivio = document.getElementById("cfg-email-copia-archivio");
 const cbEmailCopiaArchivioAvvisi = document.getElementById("cfg-email-copia-archivio-avvisi");
 const cbEmailLogOrg = document.getElementById("cfg-email-log-org");
 const cbEmailTestOk = document.getElementById("cfg-email-test-ok");
 if (!cb) return;
 const enabled = !!cb.checked;
 const enabledActions = !!cbActions?.checked;
 const enabledPromemoria = !!cbPromemoria?.checked;
 const enabledExportCsvEvento = !!cbExportCsvEvento?.checked;
 const enabledEmailCopiaArchivio = cbEmailCopiaArchivio ? !!cbEmailCopiaArchivio.checked : true;
 const enabledEmailCopiaArchivioAvvisi = cbEmailCopiaArchivioAvvisi ? !!cbEmailCopiaArchivioAvvisi.checked : true;
 const enabledEmailLogOrg = cbEmailLogOrg ? !!cbEmailLogOrg.checked : true;
 const emailTestOk = !!cbEmailTestOk?.checked;
 const btn = event?.currentTarget || document.querySelector('button[onclick*="salvaOpzioniConfig"]');
 if (btn) {
 btn.disabled = true;
 btn.textContent = "⏳ Salvataggio…";
 }
 google.script.run
 .withSuccessHandler(res => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "💾 Salva opzioni in Config";
 }
 if (res && res.ok) {
 WAITLIST_ACTIONS_ENABLED = enabledActions;
 WAITLIST_PROMEMORIA_ENABLED = enabledPromemoria;
 EXPORT_CSV_EVENTO_ENABLED = enabledExportCsvEvento;
 setSetupStatus("✅ Opzioni Config aggiornate.", "ok");
 if (typeof renderEventiList === "function") renderEventiList();
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore nel salvataggio delle opzioni."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "💾 Salva opzioni in Config";
 }
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .salvaOpzioniConfig({
 USE_WAITLIST_PRIORITY: enabled,
 ENABLE_WAITLIST_ACTIONS: enabledActions,
 ENABLE_WAITLIST_PROMEMORIA: enabledPromemoria,
 ENABLE_EXPORT_CSV_EVENTO: enabledExportCsvEvento,
 ENABLE_EMAIL_COPIA_ARCHIVIO: enabledEmailCopiaArchivio,
 ENABLE_EMAIL_COPIA_ARCHIVIO_AVVISI: enabledEmailCopiaArchivio && enabledEmailCopiaArchivioAvvisi,
 ENABLE_EMAIL_LOG_ORG: enabledEmailLogOrg,
 EMAIL_TEST_FUNZIONANO: emailTestOk
 });
}

function runRicostruisciUtenti() {
 const btn = event?.currentTarget || document.querySelector('button[onclick*="runRicostruisciUtenti"]');
 if (btn) {
 btn.disabled = true;
 btn.textContent = "⏳ Ricostruzione in corso…";
 }
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧮 Ricostruisci elenco utenti da Risposte";
 }
 setSetupStatus("⚠️ Ricostruzione disponibile solo nell'ambiente Apps Script.", "err");
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧮 Ricostruisci elenco utenti da Risposte";
 }
 if (res && res.ok) {
 setSetupStatus("✅ Foglio Utenti ricostruito a partire dal file Risposte.", "ok");
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante la ricostruzione del foglio Utenti."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧮 Ricostruisci elenco utenti da Risposte";
 }
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .ricostruisciFoglioUtentiJob();
}

function runRicostruisciMasters() {
 const btn = event?.currentTarget || document.querySelector('button[onclick*="runRicostruisciMasters"]');
 if (btn) {
 btn.disabled = true;
 btn.textContent = "⏳ Ricostruzione master in corso…";
 }
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧙 Ricostruisci elenco master da Tavoli";
 }
 setSetupStatus("⚠️ Ricostruzione disponibile solo nell'ambiente Apps Script.", "err");
 return;
 }
 google.script.run
 .withSuccessHandler(res => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧙 Ricostruisci elenco master da Tavoli";
 }
 if (res && res.ok) {
 const n = parseInt(res.totaleMasters || 0, 10) || 0;
 setSetupStatus(`✅ Foglio Masters ricostruito. Totale master: ${n}.`, "ok");
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante la ricostruzione del foglio Masters."), "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧙 Ricostruisci elenco master da Tavoli";
 }
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .ricostruisciFoglioMastersJob();
}

function runRipristinoStoricoSicuro() {
 const btn = event?.currentTarget || document.querySelector('button[onclick*="runRipristinoStoricoSicuro"]');
 const labelIdle = "🩹 Ripristino storico sicuro";
 const setBtnBusy = (busy, text) => {
 if (!btn) return;
 btn.disabled = !!busy;
 btn.textContent = text || labelIdle;
 };

 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 setSetupStatus("⚠️ Ripristino disponibile solo nell'ambiente Apps Script.", "err");
 return;
 }

 setBtnBusy(true, "🔎 Analisi storico…");
 google.script.run
 .withSuccessHandler(pre => {
 if (!pre || !pre.ok) {
 setBtnBusy(false, labelIdle);
 setSetupStatus("⚠️ " + (pre?.errore || "Errore durante l'analisi dello storico."), "err");
 return;
 }

 const candidati = parseInt(pre.candidati || 0, 10) || 0;
 const saltati = parseInt(pre.saltati || 0, 10) || 0;
 if (candidati <= 0) {
 setBtnBusy(false, labelIdle);
 setSetupStatus(`ℹ️ Nessuna riga da ripristinare (saltate ${saltati}).`, "info");
 return;
 }

 const ok = window.confirm(
 `Trovate ${candidati} righe ripristinabili (saltate ${saltati}).\n` +
 "Verranno riattivate solo prenotazioni su eventi passati con dati validi.\n\n" +
 "Procedere con il ripristino?"
 );
 if (!ok) {
 setBtnBusy(false, labelIdle);
 setSetupStatus("Operazione annullata: nessuna modifica applicata.", "info");
 return;
 }

 const conferma = window.prompt("Digita RIPRISTINA STORICO per confermare:", "");
 if (!conferma || conferma.trim().toUpperCase() !== "RIPRISTINA STORICO") {
 setBtnBusy(false, labelIdle);
 setSetupStatus("Operazione annullata: conferma testuale non valida.", "err");
 return;
 }

 setBtnBusy(true, "🩹 Ripristino in corso…");
 google.script.run
 .withSuccessHandler(res => {
 setBtnBusy(false, labelIdle);
 if (res && res.ok) {
 const n = parseInt(res.ripristinati || 0, 10) || 0;
 const lim = res.limiteRaggiunto ? " (raggiunto limite sicurezza)" : "";
 setSetupStatus(`✅ Ripristino completato: ${n} righe riattivate${lim}.`, "ok");
 caricaOrg();
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante il ripristino."), "err");
 }
 })
 .withFailureHandler(err => {
 setBtnBusy(false, labelIdle);
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .ripristinaPrenotazioniStoricheCancellate({ dryRun: false, maxRipristini: 1500 });
 })
 .withFailureHandler(err => {
 setBtnBusy(false, labelIdle);
 setSetupStatus("❌ Errore: " + (err.message || err), "err");
 })
 .ripristinaPrenotazioniStoricheCancellate({ dryRun: true, maxRipristini: 1500 });
}

function _etichettaIssueAnomalia(code) {
 const map = {
 "numPersone<=0": "Posti a zero",
 "email non valida": "Email mancante o non valida",
 "nome vuoto": "Nome vuoto",
 "sessione vuota": "Sessione mancante",
 "tavolo vuoto": "Tavolo mancante"
 };
 return map[code] || code;
}

function _renderAnomaliePrenotazioni(res) {
 const box = document.getElementById("org-hc-anomalie");
 if (!box) return;
 if (!res || !res.ok) {
 box.innerHTML = `<div class="flash f-err">⚠️ ${escapeHtml(res?.errore || "Impossibile leggere le anomalie.")}</div>`;
 return;
 }
 const list = Array.isArray(res.anomalie) ? res.anomalie : [];
 const nEl = document.getElementById("org-hc-anomalie-n");
 if (nEl && !res.troncato) nEl.textContent = String(list.length);
 if (!list.length) {
 box.innerHTML = `<div class="flash f-ok">Nessuna prenotazione anomala.</div>`;
 return;
 }
 const rows = list.map(a => {
 const issues = (a.issues || []).map(_etichettaIssueAnomalia).join(", ");
 const ev = escapeHtml(a.eventId || "");
 const riga = parseInt(a.riga, 10) || 0;
 const fixBtn = a.correggibile
 ? `<button type="button" class="btn btn-s btn-xs" data-hc-act="correggi" data-ev="${ev}" data-riga="${riga}">Correggi</button>`
 : "";
 return `<tr>
 <td><div class="td-n">${escapeHtml(a.evento || a.eventId || "")}</div><div class="td-l">riga ${riga}</div></td>
 <td><div class="td-n">${escapeHtml(a.nome || "—")}</div><div class="td-l">${escapeHtml(a.email || "—")}</div></td>
 <td class="td-l">${escapeHtml(a.sessione || "—")} · ${escapeHtml(a.tavolo || "—")}</td>
 <td>${escapeHtml(issues)}</td>
 <td class="td-actions"><div class="td-actions-row">
 ${fixBtn}
 <button type="button" class="btn btn-o btn-xs" data-hc-act="cancella" data-ev="${ev}" data-riga="${riga}">Cancella</button>
 </div></td>
 </tr>`;
 }).join("");
 const nota = res.troncato ? `<p class="org-tab-desc">Mostro le prime ${list.length}. Rilancia dopo le correzioni per vedere il resto.</p>` : "";
 box.innerHTML = `${nota}<div style="overflow:auto;max-height:420px"><table class="pren">
 <thead><tr><th>Evento</th><th>Persona</th><th>Sessione · tavolo</th><th>Problema</th><th></th></tr></thead>
 <tbody>${rows}</tbody></table></div>`;
}

function caricaAnomaliePrenotazioni() {
 const btn = document.getElementById("hc-list-btn");
 const box = document.getElementById("org-hc-anomalie");
 if (btn) { btn.disabled = true; btn.textContent = "Lettura…"; }
 if (box) box.innerHTML = `<p class="org-tab-desc">Lettura delle prenotazioni anomale…</p>`;
 google.script.run
 .withSuccessHandler(res => {
 if (btn) { btn.disabled = false; btn.textContent = "Vedi anomalie"; }
 _renderAnomaliePrenotazioni(res);
 })
 .withFailureHandler(err => {
 if (btn) { btn.disabled = false; btn.textContent = "Vedi anomalie"; }
 _renderAnomaliePrenotazioni({ ok: false, errore: err?.message || String(err) });
 })
 .elencaAnomaliePrenotazioni();
}

function risolviAnomaliaDaUI(azione, eventId, riga, label) {
 const msg = azione === "cancella"
 ? `Segnare come cancellata la prenotazione di ${label}, riga ${riga}?`
 : `Applicare la correzione automatica a ${label}, riga ${riga}? I posti a zero diventano 1, il nome vuoto viene compilato e, se manca sessione o tavolo, la riga viene cancellata.`;
 chiediConferma(msg, () => {
 beginActionOverlay(azione === "cancella" ? "Cancellazione…" : "Correzione…");
 google.script.run
 .withSuccessHandler(res => {
 endActionOverlay();
 if (!res || !res.ok) {
 flash("org-fa", "⚠️ " + (res?.errore || "Operazione non riuscita."), "err");
 return;
 }
 flash("org-fa", (res.risolta ? "✅ " : "⚠️ ") + (res.messaggio || "Fatto."), res.risolta ? "ok" : "err");
 caricaAnomaliePrenotazioni();
 })
 .withFailureHandler(err => {
 endActionOverlay();
 flash("org-fa", "❌ " + (err?.message || err), "err");
 })
 .risolviAnomaliaPrenotazione(eventId, riga, azione);
 });
}

if (!window._hcAnomalieBound) {
 window._hcAnomalieBound = true;
 document.addEventListener("click", ev => {
 const btn = ev.target && ev.target.closest ? ev.target.closest("#org-hc-anomalie [data-hc-act]") : null;
 if (!btn) return;
 const nome = btn.closest("tr")?.querySelector(".td-n")?.textContent || btn.dataset.ev || "questa prenotazione";
 risolviAnomaliaDaUI(btn.dataset.hcAct, btn.dataset.ev, parseInt(btn.dataset.riga, 10), String(nome).trim());
 });
}

function runHealthCheckFogliNow() {
 const btn = event?.currentTarget || document.getElementById("hc-run-btn");
 const hcMeta = document.getElementById("org-hc-meta");
 if (btn) {
 btn.disabled = true;
 btn.textContent = "⏳ Health check in corso…";
 }
 if (hcMeta) hcMeta.textContent = "Esecuzione health check in corso…";

 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧪 Esegui health check ora";
 }
 if (hcMeta) hcMeta.textContent = "Health check disponibile solo nell'ambiente Apps Script.";
 setSetupStatus("⚠️ Health check disponibile solo nell'ambiente Apps Script.", "err");
 return;
 }

 google.script.run
 .withSuccessHandler(res => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧪 Esegui health check ora";
 }
 const health = (res && res.healthCheck) ? res.healthCheck : res;
 const bonifica = (res && res.bonificaUuid) ? res.bonificaUuid : null;
 if (health && health.ok) {
 const mismatch = Array.isArray(health.mismatchOccupati) ? health.mismatchOccupati.length : 0;
 const anomalie = Array.isArray(health.anomalie) ? health.anomalie.length : 0;
 const corr = health.correzioni || {};
 const allineati = parseInt(corr.occupatiAllineati || 0, 10) || 0;
 const righeFix = parseInt(corr.righeCorrette || 0, 10) || 0;
 const righeCanc = parseInt(corr.righeCancellate || 0, 10) || 0;
 const bonificaTxt = bonifica && bonifica.ok
 ? ` Bonifica UUID: ${parseInt(bonifica.totalEmailConUuidDuplicati || 0, 10) || 0} email duplicate trovate, ${parseInt(bonifica.totalEmailBonificate || 0, 10) || 0} bonificate.`
 : "";
 const msg = `✅ Health check completato: ${mismatch} mismatch, ${anomalie} anomalie residue. Correzioni: occupati ${allineati}, righe ${righeFix}, cancellate ${righeCanc}.${bonificaTxt}`;
 if (hcMeta) hcMeta.textContent = msg;
 setSetupStatus(msg, "ok");
 caricaOrg();
 } else {
 const errMsg = "⚠️ " + (health?.errore || res?.errore || "Errore durante l'esecuzione del health check.");
 if (hcMeta) hcMeta.textContent = errMsg;
 setSetupStatus(errMsg, "err");
 }
 })
 .withFailureHandler(err => {
 if (btn) {
 btn.disabled = false;
 btn.textContent = "🧪 Esegui health check ora";
 }
 const errMsg = "❌ Errore health check: " + (err.message || err);
 if (hcMeta) hcMeta.textContent = errMsg;
 setSetupStatus(errMsg, "err");
 })
 .healthCheckFogliSchedulato();
}

function runResetFogliSetup(mode) {
 const m = String(mode || "").toLowerCase().trim();
 if (m !== "soft" && m !== "hard") return;
 if (!(typeof google !== "undefined" && google.script && google.script.run)) {
 setSetupStatus("⚠️ Reset disponibile solo nell'ambiente Apps Script.", "err");
 return;
 }

 const labels = {
 soft: "RESET SOFT",
 hard: "RESET HARD"
 };
 const warning = m === "hard"
 ? "Questa operazione eliminerà i dati e ricreerà la struttura base dei fogli. Continuare?"
 : "Questa operazione svuoterà i dati operativi mantenendo le intestazioni. Continuare?";

 const ok = window.confirm("⚠️ " + warning);
 if (!ok) return;

 const confirmText = window.prompt(`Digita ${labels[m]} per confermare:`, "");
 if (!confirmText || confirmText.trim().toUpperCase() !== labels[m]) {
 setSetupStatus("Operazione annullata: conferma testuale non valida.", "err");
 return;
 }

 setSetupStatus(`⏳ Esecuzione ${m === "hard" ? "reset hard" : "reset soft"} in corso…`, "info");
 google.script.run
 .withSuccessHandler(res => {
 if (res && res.ok) {
 setSetupStatus("✅ " + (res.messaggio || "Reset completato."), "ok");
 verificaSetup();
 } else {
 setSetupStatus("⚠️ " + (res?.errore || "Errore durante il reset."), "err");
 }
 })
 .withFailureHandler(err => {
 setSetupStatus("❌ Errore reset: " + (err.message || err), "err");
 })
 .resetFogliSetup(m, "RESET_CONFERMATO");
}
