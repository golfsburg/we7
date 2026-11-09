/*!
 * RIEMER Toolbox – Lizenz-Gate für den PV Tracker
 * Copyright (c) 2026 Peter Riemer – Alle Rechte vorbehalten.
 *
 * Prüft vor dem Start der App den Lizenzschlüssel über den Lizenzserver
 * der RIEMER Toolbox (Supabase-Projekt „RIEMER-Lizenzen“).
 * Erst bei gültiger Lizenz wird APP gestartet und die Datenbank verbunden.
 *
 * Verwendung:  LIZENZ.gate(function () { … App starten … });
 * Abmelden:    pv.riemer.co/?abmelden
 */
var LIZENZ = (function () {
  "use strict";

  var API = "https://hcluxhlvshydnncprpbl.supabase.co/functions/v1/license-check";
  var TOOLBOX_API = "https://hcluxhlvshydnncprpbl.supabase.co/functions/v1/toolbox";
  var TOOLBOX_URL = "https://golfsburg.github.io/riemer-toolbox/";
  function tbLogo(px) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 48 48" aria-hidden="true">' +
      '<rect x="4" y="4" width="18" height="18" rx="5" fill="#C9DAF5"/><rect x="26" y="4" width="18" height="18" rx="5" fill="#8FB0E3"/>' +
      '<rect x="4" y="26" width="18" height="18" rx="5" fill="#8FB0E3"/><rect x="26" y="26" width="18" height="18" rx="5" fill="#1F5FC2"/>' +
      '<rect x="31" y="33.5" width="8" height="3" rx="1.5" fill="#FFFFFF"/><rect x="33.5" y="31" width="3" height="8" rx="1.5" fill="#FFFFFF"/></svg>';
  }
  var TOOL = "pv-tracker";
  var NAME = "PV Tracker";
  var KEY_STORE = "riemer-lizenz:" + TOOL;
  var EMAIL_STORE = "riemer-email";
  var DEVICE_STORE = "riemer-geraet";

  var MESSAGES = {
    invalid_key: "Dieser Lizenzschlüssel ist ungültig.",
    invalid_login: "Lizenzschlüssel und E-Mail-Adresse passen nicht zusammen.",
    email_required: "Bitte gib die E-Mail-Adresse ein, auf die diese Lizenz ausgestellt ist.",
    revoked: "Diese Lizenz wurde deaktiviert.",
    expired: "Diese Lizenz ist abgelaufen.",
    tool_not_licensed: "Diese Lizenz gilt nicht für den " + NAME + ".",
    tool_not_found: "Der " + NAME + " ist derzeit nicht verfügbar.",
    device_limit: "Die maximale Anzahl an Geräten für diese Lizenz ist erreicht.",
    server_error: "Serverfehler – bitte später erneut versuchen.",
    network: "Keine Verbindung zum Lizenzserver. Bitte Internetverbindung prüfen."
  };

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  function deviceId() {
    var id = store(DEVICE_STORE);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
         : "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      store(DEVICE_STORE, id);
    }
    return id;
  }

  /* Schlüsselformat RITL-XXXX-XXXX-XXXX-XXXX (alte Schlüssel RT-… werden umgeschrieben) */
  function formatKey(v) {
    var raw = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.indexOf("RITL") === 0) raw = raw.slice(4);
    else if (raw.indexOf("RT") === 0) raw = raw.slice(2);
    var parts = raw.slice(0, 16).match(/.{1,4}/g) || [];
    return parts.length ? "RITL-" + parts.join("-") : "";
  }

  /* Passwortmanager (Chrome/Edge): Speichern anbieten */
  function offerSave(email, key) {
    try {
      if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
        var c = new PasswordCredential({ id: email, password: key, name: "RIEMER Tools – " + NAME });
        return Promise.race([navigator.credentials.store(c).catch(function () {}), new Promise(function (r) { setTimeout(r, 1500); })]);
      }
    } catch (e) {}
    return Promise.resolve();
  }

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  var overlay, onUnlock;

  function css() {
    var s = document.createElement("style");
    s.textContent =
      "#lz-gate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:1rem;" +
      "background:var(--bg,#08090a);color:var(--tx,#f5f5f2);font-family:var(--fd,system-ui,sans-serif)}" +
      "#lz-gate .lz-card{width:100%;max-width:420px;padding:2rem;border-radius:var(--rl,16px);" +
      "background:var(--bg2,#111314);border:1px solid var(--b1,rgba(255,255,255,.08));border-top:4px solid var(--ac,#f5c842)}" +
      "#lz-gate h1{margin:0 0 .25rem;font-size:1.35rem;font-weight:700}" +
      "#lz-gate .lz-sub{margin:0 0 1.5rem;color:var(--tx2,#a8acb5);font-size:.9rem}" +
      "#lz-gate label{display:block;font-size:.78rem;font-weight:600;margin-bottom:.35rem;color:var(--tx2,#a8acb5)}" +
      "#lz-gate input{width:100%;box-sizing:border-box;padding:.75rem .9rem;font:500 1.05rem var(--fm,ui-monospace,monospace);" +
      "letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--b2,rgba(255,255,255,.16));" +
      "border-radius:var(--r,10px);background:var(--bg3,#1a1d20);color:inherit}" +
      "#lz-gate #lz-em{text-transform:none;letter-spacing:0;font:400 1rem var(--fd,system-ui,sans-serif)}" +
      "#lz-gate input:focus{outline:2px solid var(--ac,#f5c842);outline-offset:1px}" +
      "#lz-gate .lz-field{position:relative}#lz-gate .lz-field input{padding-right:52px}" +
      "#lz-gate .lz-eye{position:absolute;top:50%;right:6px;transform:translateY(-50%);margin:0;width:40px;height:40px;padding:0;" +
      "border:0;border-radius:6px;background:transparent;color:var(--tx3,#6b7080);display:flex;align-items:center;justify-content:center;cursor:pointer}" +
      "#lz-gate .lz-eye:hover{color:var(--tx,#f5f5f2)}#lz-gate .lz-eye svg{width:20px;height:20px}" +
      "#lz-gate .lz-vh{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}" +
      "#lz-gate button{margin-top:1rem;width:100%;padding:.8rem;border:0;border-radius:var(--r,10px);" +
      "background:var(--ac,#f5c842);color:#111;font:700 1rem var(--fd,system-ui,sans-serif);cursor:pointer}" +
      "#lz-gate button:disabled{opacity:.6;cursor:wait}" +
      "#lz-gate .lz-err{margin-top:1rem;padding:.7rem .9rem;border-radius:var(--r,10px);" +
      "background:rgba(242,92,92,.15);color:var(--rd,#f25c5c);font-size:.9rem}" +
      "#lz-gate .lz-foot{margin-top:1.5rem;font-size:.78rem;color:var(--tx3,#6b7080);text-align:center}" +
      "#lz-gate .lz-foot a{color:inherit}" +
      "#lz-gate .lz-tb{display:inline-flex;line-height:0;border-radius:10px;margin-bottom:16px}" +
      "#lz-gate .lz-tb:focus-visible{outline:2px solid var(--ac,#f5c842);outline-offset:2px}" +
      "#lz-gate .lz-wait{color:var(--tx3,#6b7080)}";
    document.head.appendChild(s);
  }

  function show(html) {
    if (!overlay) {
      css();
      overlay = document.createElement("div");
      overlay.id = "lz-gate";
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = html;
  }

  function renderForm(msg, typed, typedEmail) {
    show(
      '<form class="lz-card" id="lz-f" method="post" action="#">' +
      '<a class="lz-tb" href="' + TOOLBOX_URL + '" title="RIEMER Toolbox – alle Tools" aria-label="Zur RIEMER Toolbox">' + tbLogo(44) + '</a>' +
      "<h1>🔒 " + NAME + "</h1>" +
      '<p class="lz-sub">Für dieses Tool ist eine gültige Lizenz erforderlich.</p>' +
      '<label for="lz-em">E-Mail-Adresse</label>' +
      '<input id="lz-em" type="email" name="email" autocomplete="username" placeholder="name@firma.at" spellcheck="false" autocapitalize="off" required>' +
      '<label for="lz-k" style="margin-top:14px">Lizenzschlüssel</label>' +
      '<div class="lz-field"><input id="lz-k" type="password" name="password" autocomplete="current-password" placeholder="RITL-XXXX-XXXX-XXXX-XXXX" spellcheck="false" autocapitalize="characters" required>' +
      '<button class="lz-eye" id="lz-eye" type="button" aria-label="Lizenzschlüssel anzeigen" aria-pressed="false" title="Anzeigen">' + EYE + '</button></div>' +
      '<button id="lz-b" type="submit">Freischalten</button>' +
      (msg ? '<div class="lz-err">' + msg + "</div>" : "") +
      '<div class="lz-foot">Lizenz anfragen: <a href="mailto:toolbox@riemer.co">toolbox@riemer.co</a> · ' +
      '<a href="https://golfsburg.github.io/riemer-toolbox/">RIEMER Toolbox</a></div></form>'
    );
    var input = document.getElementById("lz-k");
    var em = document.getElementById("lz-em");
    input.value = formatKey(typed || "");
    em.value = typedEmail || store(EMAIL_STORE) || "";
    input.addEventListener("input", function () { input.value = formatKey(input.value); });
    var eye = document.getElementById("lz-eye");
    eye.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      eye.innerHTML = show ? EYE_OFF : EYE;
      eye.setAttribute("aria-pressed", show ? "true" : "false");
      eye.setAttribute("aria-label", show ? "Lizenzschlüssel verbergen" : "Lizenzschlüssel anzeigen");
      eye.title = show ? "Verbergen" : "Anzeigen";
      input.focus();
    });
    document.getElementById("lz-f").addEventListener("submit", function (e) {
      e.preventDefault();
      check(formatKey(input.value), em.value.trim(), true);
    });
    (em.value ? input : em).focus();
  }

  function check(key, email, fromForm) {
    var btn = document.getElementById("lz-b");
    if (btn) { btn.disabled = true; btn.textContent = "Prüfe Lizenz …"; }
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, tool: TOOL, device: deviceId(), email: email || null })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          store(KEY_STORE, key);
          if (email) store(EMAIL_STORE, email);
          if (fromForm && email) offerSave(email, key);
          if (overlay) { overlay.remove(); overlay = null; }
          var fn = onUnlock; onUnlock = null;
          // App-Start außerhalb der Promise-Kette: Fehler der App sollen nicht
          // als Verbindungsfehler der Lizenzprüfung erscheinen.
          if (fn) setTimeout(function () { mountLogout(); fn(res); }, 0);
        } else {
          var code = (res && res.error) || "server_error";
          if (["invalid_key", "revoked", "expired", "tool_not_licensed"].indexOf(code) >= 0) store(KEY_STORE, null);
          var keep = fromForm || code === "email_required" || code === "invalid_login" || code === "device_limit";
          renderForm(MESSAGES[code] || MESSAGES.server_error, keep ? key : "", email);
        }
      })
      .catch(function () { renderForm(MESSAGES.network, key, email); });
  }

  function gate(callback) {
    onUnlock = callback;
    if (/[?&]abmelden\b/.test(location.search)) {
      store(KEY_STORE, null);
      history.replaceState(null, "", location.pathname + location.hash);
    }
    var saved = store(KEY_STORE);
    if (saved && formatKey(saved) !== saved) { saved = formatKey(saved); store(KEY_STORE, saved); }
    if (saved) {
      show('<div class="lz-wait">Lizenz wird geprüft …</div>');
      check(saved, store(EMAIL_STORE), false);
    } else {
      renderForm("", "");
    }
  }

  /* Abmelden: Schlüssel entfernen, Geräteplatz freigeben, Abfrage wieder zeigen */
  function logout() {
    var email = store(EMAIL_STORE) || "";
    if (!window.confirm("Abmelden" + (email ? " (" + email + ")" : "") + "?\n\nDer Lizenzschlüssel wird aus diesem Browser entfernt und der Geräteplatz freigegeben.")) return;
    var key = store(KEY_STORE), finished = false;
    var done = function () {
      if (finished) return; finished = true;
      store(KEY_STORE, null);
      location.reload();
    };
    try {
      fetch(TOOLBOX_API, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ action: "logout", key: key, email: email, device: deviceId(), tool: TOOL }) }).then(done, done);
    } catch (e) { done(); }
    setTimeout(done, 2500);
  }

  function mountLogout() {
    if (document.getElementById("lz-logout")) return;
    var email = store(EMAIL_STORE) || "";
    var b = document.createElement("button");
    b.type = "button"; b.id = "lz-logout"; b.onclick = logout;
    b.title = "Abmelden" + (email ? " – angemeldet als " + email : "");
    b.setAttribute("aria-label", "Abmelden");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg><span>Abmelden</span>';
    var st = document.createElement("style");
    st.textContent =
      "#lz-logout{display:flex;align-items:center;gap:8px;width:100%;margin-top:10px;padding:9px 12px;border-radius:var(--r,10px);" +
      "border:1px solid var(--b1,rgba(255,255,255,.08));background:transparent;color:var(--tx2,#a8acb5);" +
      "font:600 13px var(--fd,system-ui,sans-serif);cursor:pointer;text-align:left}" +
      "#lz-logout:hover{color:var(--tx,#f5f5f2);border-color:var(--b2,rgba(255,255,255,.16))}" +
      "#lz-logout:focus-visible{outline:2px solid var(--ac,#f5c842);outline-offset:2px}" +
      "#lz-logout svg{width:16px;height:16px;flex:none}" +
      "#lz-logout.lz-float{position:fixed;left:14px;bottom:14px;width:auto;z-index:9999;background:var(--bg2,#111314)}";
    document.head.appendChild(st);
    var tb = document.createElement("a");
    tb.id = "lz-toolbox"; tb.href = TOOLBOX_URL; tb.title = "RIEMER Toolbox – alle Tools";
    tb.innerHTML = tbLogo(22) + "<span>RIEMER Toolbox</span>";
    st.textContent +=
      "#lz-toolbox{display:flex;align-items:center;gap:8px;margin-top:14px;padding:7px 12px;border-radius:var(--r,10px);" +
      "color:var(--tx2,#a8acb5);font:600 13px var(--fd,system-ui,sans-serif);text-decoration:none}" +
      "#lz-toolbox:hover{color:var(--tx,#f5f5f2);background:var(--bg3,rgba(255,255,255,.05))}" +
      "#lz-toolbox:focus-visible{outline:2px solid var(--ac,#f5c842);outline-offset:2px}" +
      "#lz-toolbox svg{flex:none}#lz-toolbox+#lz-logout{margin-top:6px}";
    var slot = document.querySelector(".sidebar .sb-bottom") || document.querySelector(".sidebar");
    if (slot) { slot.appendChild(tb); slot.appendChild(b); }
    else { b.className = "lz-float"; document.body.appendChild(b); }
  }

  return { gate: gate, logout: logout };
})();
