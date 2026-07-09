"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import s from "./branding.module.css";

const DEFAULT_ACCENT = "#7C4DFF";

const ACCENT_SWATCHES = [
  { hex: "#7C4DFF", label: "Violet" },
  { hex: "#2563EB", label: "Blue" },
  { hex: "#16A34A", label: "Green" },
  { hex: "#EA580C", label: "Orange" },
  { hex: "#DB2777", label: "Pink" },
  { hex: "#111827", label: "Slate" },
];

const WELCOME_MAX = 280;

function AssetUploadRow({ label, help, type, previewSize, value, tenant, mcKey, onUploaded, toast }) {
  const [status, setStatus] = useState(null); // "uploading" | "saved" | error string
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    try {
      const form = new FormData();
      form.append("tenant", tenant);
      form.append("type", type);
      form.append("file", file);
      const res = await fetch("/api/branding/asset", {
        method: "POST",
        headers: { "x-mc-key": mcKey },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Couldn't upload the ${type}.`);
      onUploaded(data);
      setStatus("saved");
      setTimeout(() => setStatus((cur) => (cur === "saved" ? null : cur)), 2000);
    } catch (err) {
      setStatus(null);
      toast.push(err.message, "error");
    }
  };

  return (
    <div className={s.row}>
      <div className={s.rowLabelWrap}>
        <p className={s.rowLabel}>{label}</p>
        <p className={s.rowHelp}>{help}</p>
      </div>
      <div className={s.uploadControl}>
        {value ? (
          <img src={value} alt={label} style={{ width: previewSize, height: previewSize }} className={s.assetPreview} />
        ) : (
          <div style={{ width: previewSize, height: previewSize }} className={s.assetPlaceholder}>
            <Upload size={14} />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className={s.hiddenInput} />
        <button onClick={() => inputRef.current?.click()} className={s.uploadButton}>
          {status === "uploading" ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {status === "saved" && <span className={s.savedText}>Saved</span>}
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const { slug, mcKey, toast } = useMissionControl();
  const [branding, setBrandingState] = useState(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [hexInput, setHexInput] = useState(DEFAULT_ACCENT);
  const [hexError, setHexError] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/branding?tenant=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        setBrandingState(data);
        setAccent(data.accent || DEFAULT_ACCENT);
        setHexInput(data.accent || DEFAULT_ACCENT);
        setWelcome(data.welcomeMessage || "");
      })
      .catch(() => setBrandingState({}));
  }, [slug]);

  const markDirty = () => {
    setDirty(true);
    setSaved(false);
  };

  const handleAccentSwatch = (hex) => {
    setAccent(hex);
    setHexInput(hex);
    setHexError(false);
    markDirty();
  };

  const handleHexInput = (val) => {
    setHexInput(val);
    const valid = /^#[0-9A-Fa-f]{6}$/.test(val);
    setHexError(!valid);
    if (valid) {
      setAccent(val);
      markDirty();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/branding", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-mc-key": mcKey },
        body: JSON.stringify({ tenant: slug, accent, welcomeMessage: welcome }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't save. Try again.");
      });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (branding === null) return <p className={s.muted}>Loading…</p>;

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.title}>Branding</h1>
        <p className={s.subtitle}>Customise how your workspace looks to clients.</p>
      </div>

      <div>
        <AssetUploadRow
          label="Logo"
          help="Shown in the client portal header. PNG or SVG, min 200×60px recommended."
          type="logo"
          previewSize={40}
          value={branding.logoUrl}
          tenant={slug}
          mcKey={mcKey}
          toast={toast}
          onUploaded={(data) => setBrandingState((b) => ({ ...b, ...data }))}
        />

        <AssetUploadRow
          label="Favicon"
          help="Browser tab icon. 32×32 or 64×64 PNG."
          type="favicon"
          previewSize={24}
          value={branding.faviconUrl}
          tenant={slug}
          mcKey={mcKey}
          toast={toast}
          onUploaded={(data) => setBrandingState((b) => ({ ...b, ...data }))}
        />

        <div className={s.row}>
          <div className={s.rowLabelWrap}>
            <p className={s.rowLabel}>Accent colour</p>
            <p className={s.rowHelp}>Used for buttons, links, and highlights across the portal.</p>
          </div>
          <div className={s.accentControl}>
            <div className={s.swatches}>
              {ACCENT_SWATCHES.map((sw) => (
                <button
                  key={sw.hex}
                  title={sw.label}
                  onClick={() => handleAccentSwatch(sw.hex)}
                  style={{ background: sw.hex }}
                  className={s.swatch}
                >
                  {accent === sw.hex && <Check size={11} strokeWidth={3} className={s.swatchCheck} />}
                </button>
              ))}
            </div>
            <div className={s.hexWrap}>
              <div className={s.hexDot} style={{ background: hexError ? "#EF4444" : accent }} />
              <input
                value={hexInput}
                onChange={(e) => handleHexInput(e.target.value)}
                className={`${s.hexInput} ${hexError ? s.hexInputError : ""}`}
              />
            </div>
          </div>
        </div>

        <div className={s.row}>
          <div className={s.rowLabelWrap} style={{ flexShrink: 0 }}>
            <p className={s.rowLabel}>Welcome message</p>
            <p className={s.rowHelp}>Shown to clients on their first login. Max {WELCOME_MAX} characters.</p>
          </div>
          <div className={s.welcomeControl}>
            <textarea
              value={welcome}
              onChange={(e) => {
                if (e.target.value.length <= WELCOME_MAX) {
                  setWelcome(e.target.value);
                  markDirty();
                }
              }}
              rows={4}
              className={s.textarea}
            />
            <div className={s.charCountWrap}>
              <span className={`${s.charCount} ${welcome.length > WELCOME_MAX * 0.9 ? s.charCountWarn : ""}`}>
                {welcome.length} / {WELCOME_MAX}
              </span>
            </div>
          </div>
        </div>
      </div>

      {dirty && (
        <div className={s.saveBar}>
          <div className={s.saveBarInner}>
            <span className={s.saveBarText}>Unsaved changes</span>
            <button onClick={handleSave} disabled={saving} className={s.saveButton}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
