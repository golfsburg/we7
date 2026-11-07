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
  var TOOL = "pv-tracker";
  var NAME = "PV Tracker";
  var KEY_STORE = "riemer-lizenz:" + TOOL;
  var DEVICE_STORE = "riemer-geraet";

  var MESSAGES = {
    invalid_key: "Dieser Lizenzschlüssel ist ungültig.",
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

  function formatKey(v) {
    var raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.indexOf("RT") === 0) raw = raw.slice(2);
    var parts = raw.slice(0, 16).match(/.{1,4}/g) || [];
    return parts.length ? "RT-" + parts.join("-") : "";
  }

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
      "#lz-gate input:focus{outline:2px solid var(--ac,#f5c842);outline-offset:1px}" +
      "#lz-gate button{margin-top:1rem;width:100%;padding:.8rem;border:0;border-radius:var(--r,10px);" +
      "background:var(--ac,#f5c842);color:#111;font:700 1rem var(--fd,system-ui,sans-serif);cursor:pointer}" +
      "#lz-gate button:disabled{opacity:.6;cursor:wait}" +
      "#lz-gate .lz-err{margin-top:1rem;padding:.7rem .9rem;border-radius:var(--r,10px);" +
      "background:rgba(242,92,92,.15);color:var(--rd,#f25c5c);font-size:.9rem}" +
      "#lz-gate .lz-foot{margin-top:1.5rem;font-size:.78rem;color:var(--tx3,#6b7080);text-align:center}" +
      "#lz-gate .lz-foot a{color:inherit}" +
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

  function renderForm(msg, typed) {
    show(
      '<form class="lz-card" id="lz-f" autocomplete="off">' +
      "<h1>🔒 " + NAME + "</h1>" +
      '<p class="lz-sub">Für dieses Tool ist eine gültige Lizenz erforderlich.</p>' +
      '<label for="lz-k">Lizenzschlüssel</label>' +
      '<input id="lz-k" placeholder="RT-XXXX-XXXX-XXXX-XXXX" spellcheck="false" required>' +
      '<button id="lz-b" type="submit">Freischalten</button>' +
      (msg ? '<div class="lz-err">' + msg + "</div>" : "") +
      '<div class="lz-foot">Lizenz anfragen: <a href="https://riemer.co">riemer.co</a> · ' +
      '<a href="https://tools.riemer.co/">RIEMER Toolbox</a></div></form>'
    );
    var input = document.getElementById("lz-k");
    input.value = typed || "";
    input.addEventListener("input", function () { input.value = formatKey(input.value); });
    document.getElementById("lz-f").addEventListener("submit", function (e) {
      e.preventDefault();
      check(formatKey(input.value), true);
    });
    input.focus();
  }

  function check(key, fromForm) {
    var btn = document.getElementById("lz-b");
    if (btn) { btn.disabled = true; btn.textContent = "Prüfe Lizenz …"; }
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, tool: TOOL, device: deviceId() })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          store(KEY_STORE, key);
          if (overlay) { overlay.remove(); overlay = null; }
          var fn = onUnlock; onUnlock = null;
          // App-Start außerhalb der Promise-Kette: Fehler der App sollen nicht
          // als Verbindungsfehler der Lizenzprüfung erscheinen.
          if (fn) setTimeout(function () { fn(res); }, 0);
        } else {
          var code = (res && res.error) || "server_error";
          if (code !== "device_limit" && code !== "server_error") store(KEY_STORE, null);
          renderForm(MESSAGES[code] || MESSAGES.server_error, fromForm ? key : "");
        }
      })
      .catch(function () { renderForm(MESSAGES.network, key); });
  }

  function gate(callback) {
    onUnlock = callback;
    if (/[?&]abmelden\b/.test(location.search)) {
      store(KEY_STORE, null);
      history.replaceState(null, "", location.pathname + location.hash);
    }
    var saved = store(KEY_STORE);
    if (saved) {
      show('<div class="lz-wait">Lizenz wird geprüft …</div>');
      check(saved, false);
    } else {
      renderForm("", "");
    }
  }

  function logout() {
    store(KEY_STORE, null);
    location.reload();
  }

  return { gate: gate, logout: logout };
})();
