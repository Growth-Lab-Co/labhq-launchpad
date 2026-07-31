/*!
 * Miia widget loader - job 1, 2026-07-29 build.
 * Vanilla JS, no dependencies, no build step - this file is served as-is
 * from an arbitrary customer's website, so it has to be self-contained.
 * Reads its own <script> tag's data-miia-key (real tenants) or
 * data-miia-preview (Meet Miia marketing preview) attribute.
 */
(function () {
  "use strict";

  var CURRENT_SCRIPT = document.currentScript;
  var API_BASE = (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-miia-api")) || "https://meetmiia.com";
  var WIDGET_KEY = CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-miia-key");
  var PREVIEW_ID = CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-miia-preview");
  if (!WIDGET_KEY && !PREVIEW_ID) return; // nothing to render without an identity

  var STORAGE_KEY = "miia_widget_conversation_" + (WIDGET_KEY || PREVIEW_ID);

  var css = "\n" +
    ".miia-widget-launcher{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:999px;border:none;background:#A070F8;box-shadow:0 8px 24px -8px rgba(160,112,248,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;z-index:2147483000;transition:transform .15s ease;}" +
    ".miia-widget-launcher:hover{transform:scale(1.06);}" +
    ".miia-widget-launcher .miia-dot{width:9px;height:9px;border-radius:999px;background:#fff;}" +
    ".miia-widget-panel{position:fixed;bottom:92px;right:20px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 140px);background:#F8F6F1;border-radius:18px;box-shadow:0 24px 60px -16px rgba(22,22,31,0.35);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
    ".miia-widget-panel.miia-open{display:flex;}" +
    ".miia-widget-head{background:#A070F8;color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}" +
    ".miia-widget-head-title{font-size:15px;font-weight:700;}" +
    ".miia-widget-head-sub{font-size:12px;opacity:.85;margin-top:2px;}" +
    ".miia-widget-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:4px;}" +
    ".miia-widget-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}" +
    ".miia-widget-bubble{max-width:80%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}" +
    ".miia-widget-bubble.miia-in{align-self:flex-end;background:#A070F8;color:#fff;border-radius:14px 14px 4px 14px;}" +
    ".miia-widget-bubble.miia-out{align-self:flex-start;background:#fff;color:#16161F;border:1px solid #E4E0D6;border-radius:14px 14px 14px 4px;}" +
    ".miia-widget-typing{align-self:flex-start;display:flex;gap:5px;padding:10px 13px;}" +
    ".miia-widget-typing span{width:7px;height:7px;border-radius:999px;background:#A070F8;animation:miiaPulse 1.4s ease-in-out infinite;}" +
    ".miia-widget-typing span:nth-child(2){animation-delay:.22s;}" +
    "@keyframes miiaPulse{0%,60%,100%{opacity:.3;transform:scale(0.85);}30%{opacity:1;transform:scale(1);}}" +
    ".miia-widget-foot{border-top:1px solid #E4E0D6;padding:10px;display:flex;gap:8px;flex-shrink:0;background:#fff;}" +
    ".miia-widget-input{flex:1;border:1px solid #E4E0D6;border-radius:999px;padding:0 14px;height:40px;font-size:13.5px;outline:none;}" +
    ".miia-widget-input:focus{border-color:#A070F8;}" +
    ".miia-widget-send{width:40px;height:40px;border-radius:999px;border:none;background:#A070F8;color:#fff;cursor:pointer;flex-shrink:0;font-size:16px;}" +
    ".miia-widget-send:disabled{opacity:.5;cursor:default;}" +
    ".miia-widget-note{font-size:11.5px;color:#5A5A66;text-align:center;padding:8px 12px 0;}" +
    ".miia-widget-cta{display:block;text-align:center;background:#A070F8;color:#fff;text-decoration:none;padding:10px;margin:8px 12px 12px;border-radius:10px;font-size:13.5px;font-weight:700;}" +
    ".miia-widget-email-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E4E0D6;background:#fff;}" +
    ".miia-widget-actions{align-self:flex-start;display:flex;flex-wrap:wrap;gap:6px;max-width:80%;}" +
    ".miia-widget-action{background:#fff;color:#A070F8;border:1px solid #A070F8;border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:700;text-decoration:none;cursor:pointer;}" +
    ".miia-widget-action:hover{background:#F5EFFF;}";
  var styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var launcher = document.createElement("button");
  launcher.className = "miia-widget-launcher";
  launcher.setAttribute("aria-label", "Chat with us");
  launcher.innerHTML = '<span class="miia-dot"></span><span class="miia-dot"></span>';
  document.body.appendChild(launcher);

  var panel = document.createElement("div");
  panel.className = "miia-widget-panel";
  panel.innerHTML =
    '<div class="miia-widget-head">' +
    '  <div><div class="miia-widget-head-title" data-miia-title>Miia</div><div class="miia-widget-head-sub" data-miia-sub></div></div>' +
    '  <button class="miia-widget-close" aria-label="Close">&times;</button>' +
    "</div>" +
    '<div class="miia-widget-body" data-miia-body></div>' +
    '<div data-miia-gate></div>' +
    '<form class="miia-widget-foot" data-miia-form>' +
    '  <input class="miia-widget-input" data-miia-input type="text" placeholder="Type a message..." autocomplete="off" />' +
    '  <button class="miia-widget-send" type="submit" aria-label="Send">&#10148;</button>' +
    "</form>";
  document.body.appendChild(panel);

  var body = panel.querySelector("[data-miia-body]");
  var form = panel.querySelector("[data-miia-form]");
  var input = panel.querySelector("[data-miia-input]");
  var gate = panel.querySelector("[data-miia-gate]");
  var titleEl = panel.querySelector("[data-miia-title]");
  var subEl = panel.querySelector("[data-miia-sub]");

  var conversationId = null;
  try { conversationId = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  var sending = false;
  var config = null;

  function open() {
    panel.classList.add("miia-open");
    if (!body.children.length && config) addBubble("out", config.welcome);
  }
  function close() { panel.classList.remove("miia-open"); }
  launcher.addEventListener("click", function () { panel.classList.contains("miia-open") ? close() : open(); });
  panel.querySelector(".miia-widget-close").addEventListener("click", close);

  function addBubble(kind, text) {
    var el = document.createElement("div");
    el.className = "miia-widget-bubble miia-" + kind;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "miia-widget-typing";
    el.innerHTML = "<span></span><span></span>";
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  // Suggested action buttons (job 1, 2026-07-31) - `actions` always comes
  // straight from the server's own fixed, resolved-URL list (see
  // lib/widgetActions.js and app/api/widget/message GET) - this file never
  // invents a label or href, only renders what it's given. New tab so
  // clicking one never loses the visitor's place in the conversation.
  function addActionButtons(actions) {
    if (!actions || !actions.length) return;
    var wrap = document.createElement("div");
    wrap.className = "miia-widget-actions";
    for (var i = 0; i < actions.length; i++) {
      var a = document.createElement("a");
      a.className = "miia-widget-action";
      a.href = actions[i].href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = actions[i].label;
      wrap.appendChild(a);
    }
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function renderGate() {
    gate.innerHTML = "";
    if (!config) return;
    if (config.mode === "preview") {
      var used = config.messageCount || 0;
      if (used >= config.cap) {
        var cta = document.createElement("a");
        cta.className = "miia-widget-cta";
        cta.href = API_BASE + "/pricing";
        cta.target = "_blank";
        cta.textContent = "Get started with your real Miia";
        gate.appendChild(cta);
        form.style.display = "none";
      } else if (used >= config.emailGateAt && !config.emailCaptured) {
        var f = document.createElement("form");
        f.className = "miia-widget-email-form";
        f.innerHTML = '<input class="miia-widget-input" type="email" placeholder="Your email to keep chatting" required /><button class="miia-widget-send" type="submit">&#10148;</button>';
        f.addEventListener("submit", function (e) {
          e.preventDefault();
          var email = f.querySelector("input").value;
          fetch(API_BASE + "/api/preview/email", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ previewId: PREVIEW_ID, email: email }),
          })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.ok) { config.emailCaptured = true; renderGate(); }
            });
        });
        gate.appendChild(f);
        var note = document.createElement("div");
        note.className = "miia-widget-note";
        note.textContent = "This is a preview of your Miia - enter your email to keep chatting.";
        gate.insertBefore(note, f);
        form.style.display = "none";
      } else {
        form.style.display = "flex";
      }
    }
  }

  function loadConfig() {
    var qs = WIDGET_KEY ? "key=" + encodeURIComponent(WIDGET_KEY) : "preview=" + encodeURIComponent(PREVIEW_ID);
    fetch(API_BASE + "/api/widget/config?" + qs)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { titleEl.textContent = "Miia"; subEl.textContent = data.error; return; }
        config = data;
        titleEl.textContent = data.assistantName || "Miia";
        subEl.textContent = data.mode === "preview" ? "Preview of your Miia" : "Replies in under a minute";
        renderGate();
      })
      .catch(function () {});
  }
  loadConfig();

  // Never a raw error, never "Something went wrong" - a visitor waited for
  // this, so the least the widget owes them is a calm human line. Kept in
  // sync in spirit with netlify/functions/widget-reply-background.mjs's own
  // CALM_FAILURE_TEXT (that one covers the background function giving up;
  // this one covers the poll itself never landing, e.g. a dropped network).
  var CALM_FALLBACK_TEXT = "Sorry, that's taking longer than it should. Please try sending that again in a moment.";
  var POLL_INTERVAL_MS = 1500;
  // ~2 minutes - comfortably above the background function's own worst
  // case (3 attempts x a ~30-36s reply + retry delays), so a client giving
  // up here means the background function itself is stuck, not just slow.
  var POLL_MAX_ATTEMPTS = 80;

  function pollForReply(query, typingEl) {
    var attempts = 0;
    function finish(text, actions) {
      typingEl.remove();
      addBubble("out", text);
      addActionButtons(actions);
      sending = false;
      if (config) { config.messageCount = (config.messageCount || 0) + 1; renderGate(); }
    }
    function tick() {
      attempts += 1;
      fetch(API_BASE + "/api/widget/message?" + query)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === "complete" || d.status === "failed") {
            finish(d.reply || CALM_FALLBACK_TEXT, d.actions);
            return;
          }
          if (attempts >= POLL_MAX_ATTEMPTS) { finish(CALM_FALLBACK_TEXT); return; }
          setTimeout(tick, POLL_INTERVAL_MS);
        })
        .catch(function () {
          if (attempts >= POLL_MAX_ATTEMPTS) { finish(CALM_FALLBACK_TEXT); return; }
          setTimeout(tick, POLL_INTERVAL_MS);
        });
    }
    tick();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    input.value = "";
    addBubble("in", text);
    var typingEl = showTyping();

    // Generic, pixel-agnostic signal for the first message of a conversation -
    // this script runs unmodified on arbitrary customer websites, so it must
    // never carry ad-tracking code itself. Only components/miia/MeetMiiaPage.jsx
    // (our own marketing page, mode:"preview" only) listens for this and turns
    // it into a Meta Pixel Lead event.
    if (!conversationId) {
      try {
        document.dispatchEvent(
          new CustomEvent("miia:first-message", { detail: { mode: WIDGET_KEY ? "tenant" : "preview" } })
        );
      } catch (e) {}
    }

    var payload = WIDGET_KEY
      ? { widgetKey: WIDGET_KEY, conversationId: conversationId, message: text }
      : { previewId: PREVIEW_ID, message: text };

    fetch(API_BASE + "/api/widget/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.d && r.d.error) || CALM_FALLBACK_TEXT);
        if (r.d.conversationId) {
          conversationId = r.d.conversationId;
          try { localStorage.setItem(STORAGE_KEY, conversationId); } catch (e) {}
        }
        if (r.d.immediate) {
          typingEl.remove();
          addBubble("out", r.d.immediate);
          sending = false;
          return;
        }
        var query = WIDGET_KEY
          ? "conversationId=" + encodeURIComponent(conversationId) + "&widgetKey=" + encodeURIComponent(WIDGET_KEY)
          : "previewId=" + encodeURIComponent(PREVIEW_ID);
        pollForReply(query, typingEl);
      })
      .catch(function (err) {
        typingEl.remove();
        addBubble("out", (err && err.message) || CALM_FALLBACK_TEXT);
        sending = false;
      });
  });
})();
