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

      {/* language dropdown (bottom-left) */}
      <div ref={ref} data-tour="lang" style={styles.wrap}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{ ...styles.trigger, ...(open ? styles.triggerOn : {}) }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = "rgba(194,151,47,.55)"; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = "rgba(140,110,40,.22)"; }}
        >
          <span style={styles.globe} aria-hidden>🌐</span>
          <span style={styles.label}>{current.label}</span>
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
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(194,151,47,.09)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={styles.itemNative}>{l.native}</span>
                  <span style={styles.check} aria-hidden>{active ? "✓" : ""}</span>
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
    position: "fixed", bottom: 20, left: 20, zIndex: 60,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  trigger: {
    display: "flex", alignItems: "center", gap: 7,
    padding: "6px 11px", borderRadius: 999, cursor: "pointer",
    background: "rgba(255,254,251,.85)", border: "1px solid rgba(140,110,40,.22)",
    backdropFilter: "blur(6px)",
    color: "#897c64", fontSize: 12.5, fontWeight: 500, letterSpacing: ".01em",
    transition: "border-color .15s, color .15s",
  },
  triggerOn: { borderColor: "rgba(194,151,47,.55)", color: "#3d3322" },
  globe: { fontSize: 13, lineHeight: 1, opacity: .85 },
  label: { whiteSpace: "nowrap" },
  caret: { fontSize: 9, color: "#a8842e", transition: "transform .15s" },
  menu: {
    position: "absolute", bottom: "calc(100% + 6px)", left: 0, minWidth: 132,
    padding: 4, display: "flex", flexDirection: "column", gap: 1,
    background: "rgba(255,254,251,.97)", border: "1px solid rgba(140,110,40,.20)",
    borderRadius: 12, backdropFilter: "blur(8px)",
    boxShadow: "0 14px 34px -18px rgba(140,110,40,.55)",
  },
  item: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    padding: "7px 10px", borderRadius: 8, cursor: "pointer",
    border: "none", background: "transparent", textAlign: "left",
    color: "#3d3322", fontSize: 13, fontWeight: 500, transition: "background .12s", width: "100%",
  },
  itemOn: { background: "rgba(194,151,47,.14)", color: "#a8842e", fontWeight: 600 },
  itemNative: { whiteSpace: "nowrap" },
  check: { color: "#c2972f", fontSize: 11, fontWeight: 700, width: 10, textAlign: "right" },
};
