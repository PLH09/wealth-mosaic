import React, { useState, useEffect, useRef } from "react";
import FinanceDashboard from "./components/FinanceDashboard.jsx";
import { LOCALES } from "./i18n.jsx";

const LANG_KEY = "finance:lang";
const VALID = new Set(LOCALES.map((l) => l.code));

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      return saved && VALID.has(saved) ? saved : "en";
    } catch {
      return "en";
    }
  });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const choose = (l) => {
    setLang(l);
    setOpen(false);
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.code === lang) || LOCALES[0];

  return (
    <>
      <FinanceDashboard locale={lang} key={lang} />

      {/* language dropdown (top-right) */}
      <div ref={ref} style={styles.wrap}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={styles.trigger}
        >
          <span style={styles.globe} aria-hidden>🌐</span>
          <span style={styles.label}>{current.native}</span>
          <span style={{ ...styles.caret, transform: open ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
        </button>

        {open && (
          <div role="listbox" style={styles.menu}>
            {LOCALES.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(l.code)}
                  style={{ ...styles.item, ...(active ? styles.itemOn : {}) }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(194,151,47,.10)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={styles.itemBadge}>{l.label}</span>
                  <span style={styles.itemNative}>{l.native}</span>
                  {active && <span style={styles.check} aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  wrap: {
    position: "fixed", top: 20, right: 22, zIndex: 60,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  trigger: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 14px", borderRadius: 999, cursor: "pointer",
    background: "rgba(255,254,251,.92)", border: "1px solid rgba(140,110,40,.30)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 8px 24px -12px rgba(140,110,40,.4)",
    color: "#5f553f", fontSize: 13, fontWeight: 600, transition: ".15s",
  },
  globe: { fontSize: 14, lineHeight: 1 },
  label: { whiteSpace: "nowrap" },
  caret: { fontSize: 10, color: "#a08a4e", transition: "transform .15s" },
  menu: {
    position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 180,
    padding: 6, display: "flex", flexDirection: "column", gap: 2,
    background: "rgba(255,254,251,.98)", border: "1px solid rgba(140,110,40,.30)",
    borderRadius: 16, backdropFilter: "blur(8px)",
    boxShadow: "0 18px 40px -16px rgba(140,110,40,.5)",
  },
  item: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 12px", borderRadius: 11, cursor: "pointer",
    border: "none", background: "transparent", textAlign: "left",
    color: "#5f553f", fontSize: 14, fontWeight: 600, transition: ".12s", width: "100%",
  },
  itemOn: { background: "rgba(194,151,47,.16)", color: "#8a6a17" },
  itemBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 26, height: 22, padding: "0 5px", borderRadius: 7,
    background: "rgba(140,110,40,.12)", color: "#8a6a17",
    fontSize: 12, fontWeight: 700,
  },
  itemNative: { flex: 1, whiteSpace: "nowrap" },
  check: { color: "#c2972f", fontSize: 13, fontWeight: 800 },
};
