"use client";
import { useEffect, useRef, useState } from "react";
import { CHANNEL_WIRING, MIIA_CHANNEL_COPY } from "@/lib/channelWiring";

// "Lab HQ blueprint" is deliberately generic here (not brand-specific) so
// it reads correctly regardless of which product a tenant is under.
function launchSteps(assistantName) {
  return [
    "Generating your configuration",
    "Creating your system from your blueprint",
    `Personalising ${assistantName}, your AI receptionist`,
    "Activating pipelines and follow-up sequences",
  ];
}

// Required for Australian compliance, shown separately on the review screen.
const COMPLIANCE_KEYS = ["greeting_line", "sms_compliance_footer", "privacy_policy_snippet"];

// mia_guardrails is shared with the GHL snapshot's {{ custom_values.mia_guardrails }}
// template reference, so the key itself can't be renamed - but its label on
// this customer-facing review screen still needs to read "Miia".
const FIELD_LABEL_OVERRIDES = { mia_guardrails: "Miia guardrails" };
function fieldLabel(key) {
  return FIELD_LABEL_OVERRIDES[key] || key.replaceAll("_", " ");
}

// Total messages (user + assistant) before we force a wrap-up to review,
// so a rambling or looping interview can't run forever.
const MAX_TURNS = 40;

// Miia's opening line is scripted, not AI-generated, for product:"miia"
// tenants specifically - camera-ready wording needs to be identical take
// after take, not whatever Claude improvises this time. Every other
// tenant (LabHQ-style, product unset) keeps the existing AI-written
// opener via app/api/chat's system prompt - unchanged.
function scriptedOpener(tenant) {
  if (tenant.product !== "miia") return null;
  return `Hi, I'm ${tenant.assistantName}. I'm going to be your new front desk. Tell me about your business and I'll take it from there. What's the business called?`;
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Never instant, never sluggish: the typing indicator holds for this long
// even if the API responds faster, and never adds delay on top of a
// response that's already slower than this.
function typingDelayMs() {
  return 600 + Math.random() * 300;
}

function loadStoredChat(slug) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`labhq:chat:${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredChat(slug, messages, answers) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`labhq:chat:${slug}`, JSON.stringify({ messages, answers }));
  } catch {
    // Private browsing / quota exceeded - this is a resilience nicety, skip silently.
  }
}

function clearStoredChat(slug) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`labhq:chat:${slug}`);
  } catch {
    // Nothing to do if storage isn't available.
  }
}

export default function Chat({ tenant }) {
  const LAUNCH_STEPS = launchSteps(tenant.assistantName);
  const [messages, setMessages] = useState([]);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(tenant.deployedAt ? "locked" : "chat"); // locked | chat | review | deploying | done
  const [config, setConfig] = useState(null);
  const [deployResult, setDeployResult] = useState(null);
  const [launchStep, setLaunchStep] = useState(0);
  const [error, setError] = useState(null);
  const [complianceConfirmed, setComplianceConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [isOperator, setIsOperator] = useState(false);
  const bottomRef = useRef(null);
  const startedRef = useRef(false);
  const deployingRef = useRef(false);
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  const progress = Math.min(Object.keys(answers).length / 12, 1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    setIsOperator(new URLSearchParams(window.location.search).get("operator") === "1");
  }, []);

  // Miia direct-customer tenants: the old detailed success screen (compliance
  // pack, channel checklist, go-live steps) is now redundant with the
  // dashboard's own Channels/Billing pages, so it's agency-only below. This
  // is a brief (~4s) transitional moment before auto-continuing into the
  // dashboard - the "Go to your dashboard" button lets them skip the wait.
  useEffect(() => {
    if (phase !== "done" || tenant.product !== "miia") return;
    const t = setTimeout(() => {
      window.location.href = `/${tenant.slug}`;
    }, 4000);
    return () => clearTimeout(t);
  }, [phase, tenant.product, tenant.slug]);

  useEffect(() => {
    if (startedRef.current || tenant.deployedAt) return;
    startedRef.current = true;
    const stored = loadStoredChat(tenant.slug);
    if (stored?.messages?.length) {
      setMessages([
        ...stored.messages,
        { role: "assistant", content: "Welcome back, picking up where you left off.", time: timeNow() },
      ]);
      setAnswers(stored.answers || {});
    } else {
      const opener = scriptedOpener(tenant);
      if (opener) {
        // Scripted path: no API call, just the same typing-delay choreography
        // a real reply gets, so it looks identical to everything after it.
        setBusy(true);
        setTimeout(() => {
          setMessages([{ role: "assistant", content: opener, time: timeNow() }]);
          setBusy(false);
        }, typingDelayMs());
      } else {
        send(null); // non-Miia tenants: AI-generated opener, unchanged
      }
    }
  }, []);

  // Persist as the conversation progresses, so a reload can restore it.
  useEffect(() => {
    if (messages.length === 0) return;
    saveStoredChat(tenant.slug, messages, answers);
  }, [messages, answers]);

  async function send(userText) {
    setError(null);
    const nextMessages = userText
      ? [...messages, { role: "user", content: userText, time: timeNow() }]
      : messages;
    if (userText) {
      setMessages(nextMessages);
      setInput("");
    }

    if (nextMessages.length >= MAX_TURNS) {
      const wrapUp = [
        ...nextMessages,
        { role: "assistant", content: "We've covered a lot, let's get you to review with what we've got so far.", time: timeNow() },
      ];
      setMessages(wrapUp);
      await generateConfig(answers);
      return;
    }

    setBusy(true);
    const requestStart = performance.now();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: tenant.slug, messages: nextMessages, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      // Hold the typing indicator for a natural minimum, without adding
      // extra wait on top of a response that already took longer than that.
      const elapsed = performance.now() - requestStart;
      const remaining = typingDelayMs() - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setMessages([...nextMessages, { role: "assistant", content: data.reply, time: timeNow() }]);
      if (data.answers) setAnswers(data.answers);
      if (data.done) await generateConfig(data.answers || answers);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateConfig(finalAnswers) {
    setBusy(true);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: tenant.slug, answers: finalAnswers, action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Every generation layer failed server-side (rare - see
        // app/api/deploy/route.js's retry + deterministic-fallback chain).
        // The customer never sees a raw error here: ops has already been
        // alerted with the captured answers preserved.
        if (data.pending) {
          setPhase("pending");
          return;
        }
        throw new Error(data.error || "Config generation failed");
      }
      setConfig(data.customValues);
      setComplianceConfirmed(false);
      setPhase("review");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    // Guards the double-click race: two rapid clicks can both fire this
    // handler before React re-renders and removes the button.
    if (deployingRef.current) return;
    deployingRef.current = true;
    setPhase("deploying");
    setError(null);
    setLaunchStep(0);
    const ticker = setInterval(
      () => setLaunchStep((s) => Math.min(s + 1, LAUNCH_STEPS.length - 1)),
      2500
    );
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant: tenant.slug,
          answers,
          customValues: config,
          action: "deploy",
          sessionId: sessionIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deployment failed");
      setDeployResult(data);
      setLaunchStep(LAUNCH_STEPS.length);
      clearStoredChat(tenant.slug);
      setTimeout(() => setPhase("done"), 600);
    } catch (e) {
      setError(e.message);
      setPhase("review");
      deployingRef.current = false; // allow a real retry after a genuine failure
    } finally {
      clearInterval(ticker);
    }
  }

  function updateConfigKey(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function copyText(text, key) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

  function copyAllValues() {
    if (!config) return;
    const text = Object.entries(config)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    copyText(text, "all-values");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          {tenant.logoUrl ? <img src={tenant.logoUrl} alt={tenant.name} /> : tenant.logoText}
        </div>
        {tenant.product !== "miia" && (
          <div className="powered">
            powered by <b>Launchpad</b>
          </div>
        )}
      </header>

      {phase === "locked" && (
        <section className="success">
          <h2>This business is already set up.</h2>
          <p>
            {tenant.name || "This business"}&apos;s system has already been deployed. If something needs to
            change, reach out and we&apos;ll sort it.
          </p>
          <p>
            <a href="mailto:hello@growthlabco.com.au">hello@growthlabco.com.au</a>
          </p>
        </section>
      )}

      {phase === "pending" && (
        <section className="success">
          <h2>{tenant.assistantName} is finishing your setup.</h2>
          <p>
            We&apos;ve got everything you told us. Your system is being finished on our end, and
            we&apos;ll email you within the hour once it&apos;s ready.
          </p>
          <p>
            <a href="mailto:hello@growthlabco.com.au">hello@growthlabco.com.au</a>
          </p>
        </section>
      )}

      {phase === "chat" && (
        <>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="chat" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`bubble-group ${m.role}`}>
                <div className={`bubble ${m.role}`}>{m.content}</div>
                {m.time && <div className="bubble-time">{m.time}</div>}
              </div>
            ))}
            {busy && (
              <div className="typing-dots" aria-label={`${tenant.assistantName} is typing`}>
                <span />
                <span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {error && <div className="error-note">{error}. Try sending that again.</div>}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !busy) send(input.trim());
            }}
          >
            <textarea
              value={input}
              placeholder="Type your answer…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !busy) send(input.trim());
                }
              }}
              aria-label="Your answer"
            />
            <button className="btn" disabled={busy || !input.trim()} type="submit">
              Send
            </button>
          </form>
        </>
      )}

      {phase === "review" && config && (
        <section className="review">
          <h2>Review your setup</h2>
          <p className="sub">
            This is everything {tenant.assistantName} will know about the business. Edit anything
            that doesn&apos;t sound right, then deploy.
          </p>
          <div style={{ marginBottom: 16 }}>
            <button className="btn ghost" onClick={copyAllValues}>
              {copiedKey === "all-values" ? "Copied ✓" : "Copy all values"}
            </button>
          </div>
          <div className="cv-grid" style={{ marginBottom: 20 }}>
            <p className="sub" style={{ marginBottom: 0 }}>
              Compliance: these are required for Australian compliance and are included in every
              deployment.
            </p>
            {COMPLIANCE_KEYS.map((key) => (
              <div className="cv-item" key={key}>
                <label htmlFor={`cv-${key}`}>{fieldLabel(key)}</label>
                <textarea
                  id={`cv-${key}`}
                  value={config[key] ?? ""}
                  readOnly={key !== "privacy_policy_snippet"}
                  rows={Math.min(6, Math.max(1, Math.ceil(String(config[key] ?? "").length / 70)))}
                  onChange={(e) => updateConfigKey(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="cv-grid">
            {Object.entries(config)
              .filter(([key]) => !COMPLIANCE_KEYS.includes(key))
              .map(([key, value]) => (
                <div className="cv-item" key={key}>
                  <label htmlFor={`cv-${key}`}>{fieldLabel(key)}</label>
                  <textarea
                    id={`cv-${key}`}
                    value={value}
                    rows={Math.min(6, Math.max(1, Math.ceil(String(value).length / 70)))}
                    onChange={(e) => updateConfigKey(key, e.target.value)}
                  />
                </div>
              ))}
          </div>
          {error && <div className="error-note">{error}</div>}
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, margin: "20px 0" }}>
            <input
              type="checkbox"
              checked={complianceConfirmed}
              onChange={(e) => setComplianceConfirmed(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            I confirm I&apos;m authorised to set this up for this business and accept the Terms
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn" onClick={deploy} disabled={!complianceConfirmed}>Deploy my system</button>
            <button className="btn ghost" onClick={() => setPhase("chat")}>Back to chat</button>
          </div>
        </section>
      )}

      {phase === "deploying" && (
        <section className="review">
          <h2>Launching…</h2>
          <ul className="launch-seq">
            {LAUNCH_STEPS.map((step, i) => (
              <li key={step} className={i < launchStep ? "done" : i === launchStep ? "active" : ""}>
                <span className="dot" /> {step}
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "done" && deployResult && tenant.product === "miia" && (
        <section className="success">
          <h2>Your system is deployed.</h2>
          <p>
            {answers.business_name || "Your business"} is live. {tenant.assistantName} is trained on your
            business and ready to answer every enquiry.
          </p>
          <p>Taking you to your dashboard…</p>
          <a className="btn" href={`/${tenant.slug}`}>Go to your dashboard</a>
        </section>
      )}

      {phase === "done" && deployResult && tenant.product !== "miia" && (
        <section className="success">
          <h2>Your system is deployed.</h2>
          <p>
            {answers.business_name || "Your business"} now has its onboarding engine built —
            CRM, pipelines, follow-up sequences and {tenant.assistantName}, your AI receptionist.
          </p>
          <p>
            The {tenant.name} team will connect your calendar and phone number next, run a test
            call, and confirm your go-live — usually within one business day.
          </p>
          {isOperator && deployResult.locationId && <div className="loc">system id: {deployResult.locationId}</div>}
          {deployResult.demo && (
            <div className="badge-demo">Demo mode — no live system was created</div>
          )}
          {deployResult.locationAuthNeeded && (
            <div className="warning-note" style={{ textAlign: "left" }}>
              One step remaining: your agency will authorise data sync for this account — your
              setup details and go-live workflow complete automatically after that. Nothing is
              needed from you.
            </div>
          )}
          {config?.privacy_policy_snippet && (
            <div
              style={{
                marginTop: 28,
                textAlign: "left",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  marginBottom: 8,
                }}
              >
                Your compliance pack
              </div>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
                Add this to {answers.business_name || "their"} privacy policy before go-live.
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, whiteSpace: "pre-wrap" }}>
                {config.privacy_policy_snippet}
              </p>
              <button className="btn ghost" onClick={() => copyText(config.privacy_policy_snippet, "privacy")}>
                {copiedKey === "privacy" ? "Copied ✓" : "Copy privacy policy text"}
              </button>
            </div>
          )}
          {deployResult.formEmbed && (
            <div className="code-block">
              <div className="code-block-head">
                <span className="code-block-title">Website embed</span>
                <button className="btn ghost" onClick={() => copyText(deployResult.formEmbed.snippet, "embed")}>
                  {copiedKey === "embed" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="code-block-body">
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
                  Send this to whoever manages your website, or paste it in yourself.
                </p>
                <pre>{deployResult.formEmbed.snippet}</pre>
              </div>
            </div>
          )}
          <div
            style={{
              marginTop: 16,
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 8,
              }}
            >
              Connect the channels
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
              {tenant.product === "miia"
                ? `Each channel is a couple of clicks from your dashboard before ${tenant.assistantName} can answer on it.`
                : `Each channel needs its normal GHL connection before ${tenant.assistantName} can answer on it.`}
            </p>
            {CHANNEL_WIRING.map((c) => (
              <div key={c.id} className="channel-row">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, lineHeight: 1.5 }}>
                    {tenant.product === "miia" ? MIIA_CHANNEL_COPY[c.id] || c.detail : c.detail}
                  </div>
                  {tenant.product !== "miia" && (
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--muted)" }}>{c.path}</div>
                  )}
                </div>
                {tenant.product === "miia" && <span className="channel-state not-started">Not started</span>}
              </div>
            ))}
            {tenant.product !== "miia" && (
              <button
                className="btn ghost"
                onClick={() =>
                  copyText(CHANNEL_WIRING.map((c) => `${c.label}: ${c.path}`).join("\n"), "channels")
                }
              >
                {copiedKey === "channels" ? "Copied ✓" : "Copy connection steps"}
              </button>
            )}
          </div>
          {isOperator && (
            <details className="checklist">
              <summary>Go-live checklist</summary>
              <ol>
                <li>Assign the client as a calendar staff member.</li>
                <li>Connect their Google or Outlook calendar.</li>
                <li>Tune calendar availability — days ahead, buffers, slot length.</li>
                <li>Attach or forward their phone number.</li>
                <li>
                  Swap {tenant.assistantName}&apos;s transfer number to{" "}
                  {config?.escalation_contact || "the client's escalation contact"}.
                </li>
                <li>Connect Facebook Lead Ads, if they use it.</li>
                <li>
                  Run the four-question test call: are you a robot? a known FAQ? an unknown
                  question? ask for a human?
                </li>
              </ol>
            </details>
          )}
          {isOperator && (
            <div style={{ marginTop: 24, fontSize: 12, color: "var(--muted)" }}>
              <a href={`/${tenant.slug}/missioncontrol`}>Mission Control →</a>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
