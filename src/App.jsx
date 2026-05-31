import React, { useState } from "react";
import DashboardZH from "./components/FinanceDashboard.zh.jsx";
import DashboardEN from "./components/FinanceDashboard.en.jsx";

const LANG_KEY = "finance:lang";

export default function App() {
  const [lang, setLang] = useState(() => {
    try { return window.localStorage.getItem(LANG_KEY) || "zh"; } catch { return "zh"; }
  });

  const choose = (l) => {
    setLang(l);
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  return (
    <>
      {lang === "zh" ? <DashboardZH /> : <DashboardEN />}

      {/* language toggle (bottom-left; the dashboard's own FAB sits bottom-right) */}
      <div style={styles.wrap}>
        <button
          onClick={() => choose("zh")}
          style={{ ...styles.btn, ...(lang === "zh" ? styles.on : {}) }}
        >中文</button>
        <button
          onClick={() => choose("en")}
          style={{ ...styles.btn, ...(lang === "en" ? styles.on : {}) }}
        >EN</button>
      </div>
    </>
  );
}

const styles = {
  wrap: {
    position: "fixed", left: 22, bottom: 22, zIndex: 60,
    display: "flex", gap: 2, padding: 3,
    background: "rgba(31,26,20,.9)", border: "1px solid rgba(205,170,107,.28)",
    borderRadius: 999, backdropFilter: "blur(6px)",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  btn: {
    border: "none", background: "transparent", color: "#a89f8c",
    fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 999,
    cursor: "pointer", transition: ".15s",
  },
  on: { background: "#cdaa6b", color: "#1b1610" },
};
