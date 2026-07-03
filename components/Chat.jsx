"use client";
import { useEffect, useRef, useState } from "react";

const LAUNCH_STEPS = [
  "Generating your configuration",
  "Creating your system from the Lab HQ blueprint",
  "Personalising Mia, your AI receptionist",
  "Activating pipelines and follow-up sequences",
];

// Required for Australian compliance, shown separately on the review screen.
const COMPLIANCE_KEYS = ["greeting_line", "sms_compliance_footer", "privacy_policy_snippet"];

export default function Chat({ tenant }) {
  const [messages, setMessages] = useState([]);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("chat"); // chat | review | deploying | done
  const [config, setConfig] = useState(null);
  const [deployResult, setDeployResult] = useState(null);
  const [launchStep, setLaunchStep] = useState(0);
  const [error, setError] = useState(null);
  const [complianceConfirmed, setComplianceConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
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
    if (startedRef.current) return;
    startedRef.current = true;
    send(null); // kick off with Mia's opening message
  }, []);

  async function send(userText) {
    setError(null);
    const nextMessages = userText
      ? [...messages, { role: "user", content: userText }]
      : messages;
    if (userText) {
      setMessages(nextMessages);
      setInput("");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: tenant.slug, messages: nextMessages, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
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
      if (!res.ok) throw new Error(data.error || "Config generation failed");
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

  function copyPrivacySnippet() {
    if (!config?.privacy_policy_snippet) return;
    navigator.clipboard?.writeText(config.privacy_policy_snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          {tenant.logoUrl ? <img src={tenant.logoUrl} alt={tenant.name} /> : tenant.logoText}
        </div>
        <div className="powered">
          powered by <b>Launchpad</b>
        </div>
      </header>

      {phase === "chat" && (
        <>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="chat" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="bubble assistant typing">{tenant.assistantName} is typing…</div>}
            <div ref={bottomRef} />
          </div>
          {error && <div className="error-note">{error} — try sending that again.</div>}
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
          <div className="cv-grid" style={{ marginBottom: 20 }}>
            <p className="sub" style={{ marginBottom: 0 }}>
              Compliance — these are required for Australian compliance and are included in every
              deployment.
            </p>
            {COMPLIANCE_KEYS.map((key) => (
              <div className="cv-item" key={key}>
                <label htmlFor={`cv-${key}`}>{key.replaceAll("_", " ")}</label>
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
                  <label htmlFor={`cv-${key}`}>{key.replaceAll("_", " ")}</label>
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

      {phase === "done" && deployResult && (
        <section className="success">
          <h2>Your system is deployed 🎉</h2>
          <p>
            {answers.business_name || "Your business"} now has its onboarding engine built —
            CRM, pipelines, follow-up sequences and {tenant.assistantName}, your AI receptionist.
          </p>
          <p>
            The {tenant.name} team will connect your calendar and phone number next, run a test
            call, and confirm your go-live — usually within one business day.
          </p>
          {deployResult.locationId && <div className="loc">system id: {deployResult.locationId}</div>}
          {deployResult.demo && (
            <div className="badge-demo">Demo mode — no live system was created</div>
          )}
          {deployResult.contactWarning && (
            <div className="error-note" style={{ textAlign: "left" }}>
              Manual step needed: {deployResult.contactWarning}
            </div>
          )}
          {config?.privacy_policy_snippet && (
            <div
              style={{
                marginTop: 28,
                textAlign: "left",
                background: "var(--card)",
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
                  color: "var(--violet-soft)",
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
              <button className="btn ghost" onClick={copyPrivacySnippet}>
                {copied ? "Copied ✓" : "Copy privacy policy text"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
