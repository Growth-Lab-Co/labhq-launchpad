"use client";
import { useEffect, useRef, useState } from "react";

const LAUNCH_STEPS = [
  "Generating your configuration",
  "Creating your system from the Lab HQ blueprint",
  "Personalising Mia, your AI receptionist",
  "Activating pipelines and follow-up sequences",
];

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
  const bottomRef = useRef(null);
  const startedRef = useRef(false);

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
      setPhase("review");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
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
    } finally {
      clearInterval(ticker);
    }
  }

  function updateConfigKey(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
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
          <div className="cv-grid">
            {Object.entries(config).map(([key, value]) => (
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
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn" onClick={deploy}>Deploy my system</button>
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
        </section>
      )}
    </main>
  );
}
