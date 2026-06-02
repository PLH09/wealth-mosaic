import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { STRINGS, VOICE, fonts } from "../i18n.jsx";

/* ----------------------------- persistent storage ----------------------------- */
const KEY = "finance:data:v3";
const LEGACY_KEYS = ["finance:data:en:v2", "finance:data:v2"];
const store = {
  async get(k) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const v = window.localStorage.getItem(k);
      return v != null ? v : null;
    } catch { return null; }
  },
  async set(k, v) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(k, v);
    } catch { /* no-op (e.g. private mode quota) */ }
  },
};

/* ----------------------------- helpers ----------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ym = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const sum = (arr, f = (x) => x.value) => arr.reduce((a, b) => a + (Number(f(b)) || 0), 0);
const money = (n, cur = "$") => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-" : "") + cur + " " + Math.abs(v).toLocaleString("en-US");
};

/* ----------------------------- styles ----------------------------- */
const buildCSS = (f) => `
@import url('https://fonts.googleapis.com/css2?family=${f.import}&display=swap');
:root{
  --bg:#f1e8d7; --bg2:#f6efdf; --surface:#fffefb; --surface2:#f3ead5;
  --ink:#2a2013;
  --line:rgba(140,110,40,.16); --line2:rgba(140,110,40,.30);
  --gold:#c2972f; --gold2:#a8842e; --text:#3d3322; --muted:#897c64; --dim:#9a8c72;
  --green:#3c8a5f; --red:#c45c36;
  --serif:${f.serif};
  --sans:${f.sans};
}
*{box-sizing:border-box;margin:0;padding:0}
.fd-root{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;
  background-image:radial-gradient(900px 500px at 80% -10%,rgba(194,151,47,.12),transparent 60%),
  radial-gradient(700px 500px at -10% 10%,rgba(60,138,95,.07),transparent 55%),
  linear-gradient(160deg,#fdf8ee,#f1e8d7 52%,#e9dec9);
  -webkit-font-smoothing:antialiased;}
.fd-wrap{max-width:1040px;margin:0 auto;padding:26px 18px 80px;}
.fd-tabnum{font-variant-numeric:tabular-nums;}
.fd-serif{font-family:var(--serif);}
.fd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;
  animation:rise .6s ease both;}
.fd-eyebrow{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:500;}
.fd-privacy{font-size:12px;color:var(--muted);margin-top:8px;max-width:380px;line-height:1.4;}
.story-text{font-size:15px;line-height:1.85;color:var(--text);background:rgba(194,151,47,.06);border:1px solid rgba(194,151,47,.18);border-radius:14px;padding:16px 18px;letter-spacing:.01em;}
.fd-title{font-family:var(--serif);font-size:30px;font-weight:600;line-height:1.05;margin-top:6px;letter-spacing:.01em;color:var(--ink);}
.fd-net{font-family:var(--serif);font-size:34px;font-weight:600;letter-spacing:.01em;color:var(--ink);}
.fd-net-row{text-align:right;}
.fd-net-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);}
.fd-toolbtn{background:transparent;border:1px solid var(--line2);color:var(--muted);font-family:var(--sans);
  font-size:12px;padding:7px 12px;border-radius:999px;cursor:pointer;transition:.18s;}
.fd-toolbtn:hover{color:var(--text);border-color:var(--gold);background:rgba(194,151,47,.07);}
.fd-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:22px;overflow-x:auto;-ms-overflow-style:none;scrollbar-width:none;}
.fd-tabs::-webkit-scrollbar{display:none;}
.fd-tab{background:none;border:none;color:var(--dim);font-family:var(--sans);font-size:14.5px;font-weight:500;
  padding:11px 14px;cursor:pointer;position:relative;white-space:nowrap;transition:.18s;}
.fd-tab:hover{color:var(--muted);}
.fd-tab.on{color:var(--text);}
.fd-tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:2px;background:var(--gold);border-radius:2px;}
.fd-grid{display:grid;gap:14px;}
.cols-4{grid-template-columns:repeat(4,1fr);}
.cols-2{grid-template-columns:repeat(2,1fr);}
.cols-3{grid-template-columns:repeat(3,1fr);}
@media(max-width:760px){.cols-4{grid-template-columns:repeat(2,1fr);}.cols-3{grid-template-columns:1fr;}.cols-2{grid-template-columns:1fr;}}
.card{background:linear-gradient(180deg,var(--surface),var(--bg2));border:1px solid var(--line);
  border-radius:16px;padding:18px;animation:rise .55s ease both;}
.card.glow{box-shadow:0 0 0 1px rgba(194,151,47,.10),0 24px 50px -30px rgba(140,110,40,.22);}
.kpi-l{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}
.kpi-v{font-family:var(--serif);font-size:25px;font-weight:600;margin-top:9px;color:var(--ink);}
.kpi-sub{font-size:12px;color:var(--dim);margin-top:4px;}
.pos{color:var(--green);} .neg{color:var(--red);}
.sec-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;}
.sec-t{font-family:var(--serif);font-size:18px;font-weight:600;color:var(--ink);}
.sec-sub{font-size:12px;color:var(--dim);}
.row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed var(--line);}
.row:last-of-type{border-bottom:none;}
.row .lbl{font-size:14px;color:var(--text);}
.row .cat{font-size:11px;color:var(--gold);background:rgba(194,151,47,.1);padding:2px 8px;border-radius:999px;margin-left:8px;}
.row .amt{font-variant-numeric:tabular-nums;font-size:14px;color:var(--text);}
.del{background:none;border:none;color:var(--dim);cursor:pointer;font-size:15px;padding:0 4px;transition:.15s;}
.del:hover{color:var(--red);}
.addrow{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.inp,.sel{background:var(--surface2);border:1px solid var(--line);color:var(--text);font-family:var(--sans);
  font-size:13.5px;padding:9px 11px;border-radius:10px;outline:none;transition:.15s;}
.inp:focus,.sel:focus{border-color:var(--gold);}
.inp.lbl-in{flex:1;min-width:90px;} .inp.num-in{width:110px;font-variant-numeric:tabular-nums;}
.addbtn{background:var(--gold);color:#1b1610;border:none;font-family:var(--sans);font-weight:700;font-size:13px;
  padding:0 16px;border-radius:10px;cursor:pointer;transition:.15s;}
.addbtn:hover{background:var(--gold2);}
.empty{color:var(--dim);font-size:13px;padding:14px 0;text-align:center;}
.gauge-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}
.gauge{--p:0;width:120px;height:120px;border-radius:50%;flex-shrink:0;
  background:conic-gradient(var(--gold) calc(var(--p)*1%),rgba(42,32,19,.07) 0);
  display:flex;align-items:center;justify-content:center;position:relative;transition:.6s;}
.gauge::after{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--surface);}
.gauge .gv{position:relative;font-family:var(--serif);font-size:26px;font-weight:600;}
.bar{height:9px;border-radius:999px;background:rgba(42,32,19,.08);overflow:hidden;margin-top:8px;}
.bar > i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .7s ease;}
.goal-meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-top:7px;}
.tag{font-size:11.5px;color:var(--green);}
.legend{display:flex;flex-direction:column;gap:9px;}
.legi{display:flex;align-items:center;gap:9px;font-size:13px;}
.dot{width:10px;height:10px;border-radius:3px;flex-shrink:0;}
.insight{border:1px solid var(--line2);background:linear-gradient(180deg,rgba(194,151,47,.07),transparent);
  border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.7;color:var(--text);}
.insight b{color:var(--gold2);font-family:var(--serif);}
.note{font-size:12px;color:var(--dim);line-height:1.6;margin-top:10px;}
.mselect{display:flex;align-items:center;gap:8px;}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.stagger>*{animation:rise .5s ease both;}
.stagger>*:nth-child(2){animation-delay:.05s}.stagger>*:nth-child(3){animation-delay:.1s}
.stagger>*:nth-child(4){animation-delay:.15s}.stagger>*:nth-child(5){animation-delay:.2s}
.fd-toolbtn.gold{border-color:var(--gold);color:var(--gold2);background:rgba(194,151,47,.1);}
.fd-toolbtn.gold:hover{background:rgba(194,151,47,.18);color:var(--gold2);}
.fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;border:1px solid var(--gold);
  background:linear-gradient(160deg,var(--gold2),var(--gold));color:#1b1610;font-size:22px;cursor:pointer;z-index:40;
  box-shadow:0 12px 30px -8px rgba(194,151,47,.5);transition:.2s;animation:rise .5s ease both;}
.fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 36px -8px rgba(194,151,47,.65);}
.modal-bg{position:fixed;inset:0;background:rgba(42,32,19,.40);backdrop-filter:blur(4px);z-index:50;
  display:flex;align-items:flex-end;justify-content:center;animation:fade .25s ease both;padding:0;}
@media(min-width:640px){.modal-bg{align-items:center;padding:20px;}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.modal{width:100%;max-width:480px;height:78vh;max-height:620px;background:linear-gradient(180deg,var(--surface),var(--bg2));
  border:1px solid var(--line2);border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 -20px 60px -20px rgba(140,110,40,.28);animation:slideup .3s cubic-bezier(.2,.8,.2,1) both;}
@media(min-width:640px){.modal{border-radius:20px;height:600px;}}
@keyframes slideup{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
.modal-h{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);}
.qa-prog{height:3px;background:rgba(42,32,19,.07);}
.qa-prog > i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .4s ease;}
.qa-body{flex:1;overflow-y:auto;padding:26px 22px;display:flex;flex-direction:column;}
.qa-q{font-family:var(--serif);font-size:22px;font-weight:600;line-height:1.3;animation:rise .35s ease both;color:var(--ink);}
.qa-hint{font-size:13px;color:var(--dim);margin-top:8px;line-height:1.6;}
.qa-inputs{display:flex;flex-direction:column;gap:10px;margin-top:22px;}
.qa-inputs .inp{font-size:16px;padding:13px 14px;}
.qa-numwrap{position:relative;}
.qa-num{width:100%;font-variant-numeric:tabular-nums;padding-right:46px!important;}
.qa-suffix{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--gold2);font-size:14px;}
.qa-actions{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:24px;}
.qa-actions .addbtn{padding:10px 22px;}
.changed{display:flex;flex-wrap:wrap;gap:5px;}
.chip{font-size:11.5px;color:var(--green);background:rgba(60,138,95,.12);border:1px solid rgba(60,138,95,.25);
  padding:3px 8px;border-radius:999px;}
.mic{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:2px;
  background:var(--surface2);border:1px solid var(--line2);color:var(--muted);font-family:var(--sans);
  font-size:14px;padding:11px;border-radius:10px;cursor:pointer;transition:.18s;}
.mic:hover{color:var(--text);border-color:var(--gold);}
.mic .mic-dot{width:9px;height:9px;border-radius:50%;background:var(--dim);transition:.18s;}
.mic.on{color:var(--red);border-color:var(--red);background:rgba(196,92,54,.1);}
.mic.on .mic-dot{background:var(--red);animation:pulse 1s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(196,92,54,.5)}70%{box-shadow:0 0 0 8px rgba(196,92,54,0)}100%{box-shadow:0 0 0 0 rgba(196,92,54,0)}}
.qa-heard{font-size:13px;color:var(--gold2);margin-top:12px;font-style:italic;}
.qa-err{font-size:13px;color:var(--red);margin-top:10px;line-height:1.5;}
`;

/* ----------------------------- small components ----------------------------- */
function Kpi({ label, value, sub, tone }) {
  return (
    <div className="card">
      <div className="kpi-l">{label}</div>
      <div className={"kpi-v fd-tabnum " + (tone || "")}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function MoneyList({ items, onChange, categories, valueKey = "value", accent, cur, t }) {
  const [lbl, setLbl] = useState("");
  const [val, setVal] = useState("");
  const [cat, setCat] = useState(categories ? categories[0] : null);
  const add = () => {
    if (!lbl.trim() || !val) return;
    const it = { id: uid(), label: lbl.trim(), [valueKey]: Number(val) };
    if (categories) it.category = cat;
    onChange([...items, it]);
    setLbl(""); setVal("");
  };
  return (
    <div>
      {items.length === 0 && <div className="empty">{t.list.empty}</div>}
      {items.map((it) => (
        <div className="row" key={it.id}>
          <div className="lbl">
            {it.label}
            {it.category && <span className="cat">{it.category}</span>}
          </div>
          <div className="amt" style={accent ? { color: accent } : null}>{money(it[valueKey], cur)}</div>
          <button className="del" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
        </div>
      ))}
      <div className="addrow">
        <input className="inp lbl-in" placeholder={t.list.name} value={lbl}
          onChange={(e) => setLbl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        {categories && (
          <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input className="inp num-in" type="number" placeholder={t.list.amount} value={val}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="addbtn" onClick={add}>{t.list.add}</button>
      </div>
    </div>
  );
}

/* ----------------------------- main ----------------------------- */
export default function FinanceDashboard({ locale = "en" }) {
  const t = STRINGS[locale] || STRINGS.en;
  const voice = VOICE[locale] || null;
  const fontStack = fonts(locale);
  const CSS = useMemo(() => buildCSS(fontStack), [locale]);
  const EXPENSE_CATS = t.cats.expense, ASSET_TYPES = t.cats.asset, INVEST_CATS = t.cats.invest;

  const DEFAULT = useMemo(() => ({
    recurring: { income: [], expenses: [] },
    months: {},
    assets: [],
    liabilities: [],
    netWorthHistory: {},
    portfolio: [],
    goals: [],
    retire: { currentAge: "", retireAge: "", monthlySpend: "", withdrawalRate: "", annualReturn: "", inflation: "", currentSavings: "", monthlyContribution: "" },
  }), [locale]);

  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [month, setMonth] = useState(ym());
  const [chatOpen, setChatOpen] = useState(false);
  const [qaStep, setQaStep] = useState(0);
  const [qaVal, setQaVal] = useState("");
  const [qaLabel, setQaLabel] = useState("");
  const [qaItems, setQaItems] = useState([]);
  const [qaLog, setQaLog] = useState([]);
  const [qaDone, setQaDone] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [speechErr, setSpeechErr] = useState("");
  const recogRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    (async () => {
      let raw = await store.get(KEY);
      if (!raw) { for (const k of LEGACY_KEYS) { raw = await store.get(k); if (raw) break; } }
      if (raw) {
        try { setData({ ...DEFAULT, ...JSON.parse(raw) }); return; } catch { /* fall through */ }
      }
      setData(DEFAULT);
    })();
  }, []);

  const update = (patch) => {
    setData((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      store.set(KEY, JSON.stringify(next));
      return next;
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        update({ ...DEFAULT, ...parsed });
        alert(t.importOk);
      } catch {
        alert(t.importErr);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const setAssetsLiab = (key, list) => {
    update((prev) => {
      const next = { ...prev, [key]: list };
      const nw = sum(next.assets) - sum(next.liabilities);
      next.netWorthHistory = { ...prev.netWorthHistory, [ym()]: nw };
      return next;
    });
  };

  const cur = "$";

  const applyUpdates = (u) => {
    if (!u) return [];
    const summary = [];
    const tag = (arr) => (arr || []).map((x) => ({ ...x, id: uid() }));
    update((prev) => {
      const next = { ...prev };
      next.recurring = { ...prev.recurring };
      if (u.recurring_income?.length) { next.recurring.income = [...prev.recurring.income, ...tag(u.recurring_income)]; u.recurring_income.forEach((x) => summary.push(`${t.recurringIncome} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.recurring_expenses?.length) { next.recurring.expenses = [...prev.recurring.expenses, ...tag(u.recurring_expenses)]; u.recurring_expenses.forEach((x) => summary.push(`${t.recurringExpenses} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.month_income?.length) { const m = prev.months[month] || { income: [], expenses: [] }; next.months = { ...prev.months, [month]: { ...m, income: [...m.income, ...tag(u.month_income)] } }; u.month_income.forEach((x) => summary.push(`${t.extraIncome} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.month_expenses?.length) { const m = next.months?.[month] || prev.months[month] || { income: [], expenses: [] }; next.months = { ...(next.months || prev.months), [month]: { ...m, expenses: [...m.expenses, ...tag(u.month_expenses)] } }; u.month_expenses.forEach((x) => summary.push(`${t.variableSpending} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.assets?.length) { next.assets = [...prev.assets, ...tag(u.assets)]; u.assets.forEach((x) => summary.push(`${t.secAssets} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.liabilities?.length) { next.liabilities = [...prev.liabilities, ...tag(u.liabilities)]; u.liabilities.forEach((x) => summary.push(`${t.secLiabilities} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.portfolio?.length) { next.portfolio = [...prev.portfolio, ...tag(u.portfolio)]; u.portfolio.forEach((x) => summary.push(`${t.secHoldings} "${x.label}" ${money(x.value, cur)}`)); }
      if (u.goals?.length) { next.goals = [...prev.goals, ...tag(u.goals)]; u.goals.forEach((x) => summary.push(`${t.secFinancialGoals} "${x.label}" ${money(x.target, cur)}`)); }
      if (u.retire && Object.keys(u.retire).length) { next.retire = { ...prev.retire, ...u.retire }; summary.push(t.retInputs); }
      if (next.assets !== prev.assets || next.liabilities !== prev.liabilities) {
        next.netWorthHistory = { ...prev.netWorthHistory, [ym()]: sum(next.assets) - sum(next.liabilities) };
      }
      store.set(KEY, JSON.stringify(next));
      return next;
    });
    return summary;
  };

  // ---- guided Q&A handlers ----
  const openQA = () => {
    setQaStep(0); setQaVal(""); setQaLabel(""); setQaItems([]); setQaLog([]); setQaDone(false);
    setHeard(""); setSpeechErr(""); setChatOpen(true);
  };

  const stopVoice = () => {
    try { recogRef.current && recogRef.current.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const startVoice = (q) => {
    if (!voice) return;
    const withLabel = q && q.withLabel;
    const multi = q && q.multi;
    setSpeechErr("");
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setSpeechErr(t.speechNoSupport); return; }
    if (listening) { stopVoice(); return; }
    let rec;
    try { rec = new SR(); } catch { setSpeechErr(t.speechCantStart); return; }
    rec.lang = voice.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    recogRef.current = rec;
    setHeard("");
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setHeard(txt);
      const isFinal = e.results[e.results.length - 1].isFinal;
      if (isFinal) {
        const P = voice.parser;
        if (multi) {
          const items = P.splitMultiLabelAmount(txt);
          if (items.length) {
            const fb = (q && q.fallbackLabel) || t.fallbackItem;
            setQaItems((prev) => [...prev, ...items.map((it) => ({ label: it.label || fb, value: it.value }))]);
          } else if (q && q.optional && P.isNoneAnswer(txt)) {
            setSpeechErr(t.speechNothing);
          } else setSpeechErr(t.speechMultiFail(txt));
        } else if (withLabel) {
          const { label, amount } = P.splitLabelAmount(txt);
          if (label) setQaLabel(label);
          if (!isNaN(amount)) setQaVal(String(Math.round(amount)));
          else if (q && q.optional && P.isNoneAnswer(txt)) setSpeechErr(t.speechNothing);
        } else {
          const n = P.parseSpoken(txt);
          if (!isNaN(n)) setQaVal(String(Math.round(n)));
          else if (q && q.optional && P.isNoneAnswer(txt)) setSpeechErr(t.speechNothing);
          else setSpeechErr(t.speechSingleFail(txt));
        }
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setSpeechErr(t.speechBlocked);
      else if (e.error === "no-speech") setSpeechErr(t.speechNoHear);
      else setSpeechErr(t.speechStopped);
    };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setSpeechErr(t.speechCantStart); }
  };

  const commitStep = (q) => {
    const tg = q.target;
    if (q.multi) {
      const items = [...qaItems];
      const typedVal = Number(qaVal);
      if (qaVal !== "" && !isNaN(typedVal) && typedVal > 0)
        items.push({ label: qaLabel.trim() || q.fallbackLabel || t.fallbackItem, value: Math.round(typedVal) });
      if (!items.length) return q.optional;
      let upd = {};
      if (tg.type === "recurring_income") upd = { recurring_income: items.map((it) => ({ label: it.label, value: it.value })) };
      else if (tg.type === "recurring_expense") upd = { recurring_expenses: items.map((it) => ({ label: it.label, value: it.value, category: tg.category || EXPENSE_CATS[6] })) };
      else if (tg.type === "asset") upd = { assets: items.map((it) => ({ label: it.label, value: it.value, type: tg.assetType || ASSET_TYPES[4] })) };
      else if (tg.type === "portfolio") upd = { portfolio: items.map((it) => ({ label: it.label, value: it.value, category: tg.category || INVEST_CATS[6] })) };
      else if (tg.type === "liability") upd = { liabilities: items.map((it) => ({ label: it.label, value: it.value })) };
      const changed = applyUpdates(upd);
      if (changed.length) setQaLog((prev) => [...prev, ...changed]);
      return true;
    }
    const val = Number(qaVal);
    if (!q.optional && (qaVal === "" || isNaN(val))) return false;
    if (qaVal === "" || isNaN(val) || val === 0) return true;
    const label = tg.label || qaLabel.trim() || q.fallbackLabel || t.fallbackItem;
    let upd = {};
    if (tg.type === "retire") upd = { retire: { [tg.key]: val } };
    else if (tg.type === "recurring_income") upd = { recurring_income: [{ label, value: val }] };
    else if (tg.type === "recurring_expense") upd = { recurring_expenses: [{ label, value: val, category: tg.category || EXPENSE_CATS[6] }] };
    else if (tg.type === "asset") upd = { assets: [{ label, value: val, type: tg.assetType || ASSET_TYPES[4] }] };
    else if (tg.type === "portfolio") upd = { portfolio: [{ label, value: val, category: tg.category || INVEST_CATS[6] }] };
    else if (tg.type === "liability") upd = { liabilities: [{ label, value: val }] };
    const changed = applyUpdates(upd);
    if (changed.length) setQaLog((prev) => [...prev, ...changed]);
    return true;
  };

  const nextStep = (qList) => {
    const q = qList[qaStep];
    if (!commitStep(q)) return;
    stopVoice(); setHeard(""); setSpeechErr("");
    setQaVal(""); setQaLabel(""); setQaItems([]);
    if (qaStep + 1 >= qList.length) setQaDone(true);
    else setQaStep(qaStep + 1);
  };

  const skipStep = (qList) => {
    stopVoice(); setHeard(""); setSpeechErr("");
    setQaVal(""); setQaLabel(""); setQaItems([]);
    if (qaStep + 1 >= qList.length) setQaDone(true);
    else setQaStep(qaStep + 1);
  };

  const backStep = () => {
    stopVoice(); setHeard(""); setSpeechErr("");
    setQaVal(""); setQaLabel(""); setQaItems([]); setQaStep(Math.max(0, qaStep - 1));
  };

  const QUESTIONS = useMemo(() => t.questions(cur, t.cats), [locale, cur]);

  const calc = useMemo(() => {
    if (!data) return null;
    const m = data.months[month] || { income: [], expenses: [] };
    const incFixed = sum(data.recurring.income);
    const expFixed = sum(data.recurring.expenses);
    const income = incFixed + sum(m.income);
    const expense = expFixed + sum(m.expenses);
    const net = income - expense;
    const rate = income > 0 ? (net / income) * 100 : 0;
    const assets = sum(data.assets);
    const liab = sum(data.liabilities);
    const netWorth = assets - liab;
    const invest = sum(data.portfolio);
    const histArr = Object.keys(data.netWorthHistory).sort()
      .map((k) => ({ m: k.slice(2), v: data.netWorthHistory[k] }));
    return { m, income, expense, net, rate, assets, liab, netWorth, invest, histArr, incFixed, expFixed };
  }, [data, month]);

  if (!data || !calc) {
    return (
      <div className="fd-root"><style>{CSS}</style>
        <div className="fd-wrap"><div className="empty">{t.loading}</div></div>
      </div>
    );
  }

  const H = { cur, money, short: t.short };

  // ---- spoken financial story ----
  const story = t.story(calc, data, H);

  const stopStory = () => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* no-op */ }
    setSpeaking(false);
  };
  const speakStory = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      alert(t.speechUnsupported);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(story);
    u.lang = t.voiceLang;
    u.rate = 1.0;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const openStory = () => { setStoryOpen(true); };
  const closeStory = () => { stopStory(); setStoryOpen(false); };

  // wealth-velocity insight values
  const milestone = data.goals.length
    ? data.goals.reduce((a, b2) => (b2.target - b2.current < a.target - a.current && b2.target > b2.current ? b2 : a))
    : { label: t.defaultMilestone.label, target: t.defaultMilestone.target, current: calc.netWorth };
  const iRemain = Math.max(0, milestone.target - milestone.current);
  const iM1 = calc.net > 0 ? Math.ceil(iRemain / calc.net) : null;
  const iBoosted = calc.net + calc.income * 0.1;
  const iM2 = iBoosted > 0 ? Math.ceil(iRemain / iBoosted) : null;
  const iSaved = iM1 && iM2 ? iM1 - iM2 : 0;
  const insightVals = { stalled: calc.net <= 0, net: calc.net, rate: calc.rate, milestoneLabel: milestone.label, m1: iM1, saved: iSaved };

  const TABS = [
    { key: "overview", label: t.tabs.overview },
    { key: "cashflow", label: t.tabs.cashflow },
    { key: "networth", label: t.tabs.networth },
    { key: "invest", label: t.tabs.invest },
    { key: "retire", label: t.tabs.retire },
  ];

  return (
    <div className="fd-root">
      <style>{CSS}</style>
      <div className="fd-wrap">
        {/* header */}
        <div className="fd-head">
          <div>
            <div className="fd-eyebrow">{t.eyebrow}</div>
            <h1 className="fd-title">{t.brand}</h1>
            <div className="fd-privacy">{t.privacy}</div>
          </div>
          <div className="fd-net-row">
            <div className="fd-net-label">{t.netLabel}</div>
            <div className={"fd-net fd-tabnum " + (calc.netWorth >= 0 ? "" : "neg")}>{money(calc.netWorth, cur)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="fd-toolbtn gold" onClick={openQA}>{t.btnGuided}</button>
              <button className="fd-toolbtn" onClick={openStory}>{t.btnRecap}</button>
              <button className="fd-toolbtn" onClick={() => update({ ...t.sample() })}>{t.btnSample}</button>
              <button className="fd-toolbtn" onClick={exportData}>{t.btnExport}</button>
              <button className="fd-toolbtn" onClick={() => fileRef.current && fileRef.current.click()}>{t.btnImport}</button>
              <button className="fd-toolbtn" onClick={() => { if (confirm(t.clearConfirm)) update({ ...DEFAULT }); }}>{t.btnClear}</button>
              <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importData} />
            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="fd-tabs">
          {TABS.map((tt) => (
            <button key={tt.key} className={"fd-tab " + (tab === tt.key ? "on" : "")} onClick={() => setTab(tt.key)}>{tt.label}</button>
          ))}
        </div>

        {/* ---------------- Overview ---------------- */}
        {tab === "overview" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-4">
              <Kpi label={t.kNetWorth} value={money(calc.netWorth, cur)} sub={t.netWorthSub(t.short(calc.assets), t.short(calc.liab))} />
              <Kpi label={t.kSavingsRate} value={calc.rate.toFixed(0) + "%"} tone={calc.rate >= 20 ? "pos" : calc.rate < 0 ? "neg" : ""} sub={calc.rate >= 30 ? t.srExcellent : calc.rate >= 20 ? t.srHealthy : calc.rate >= 0 ? t.srImprove : t.srOver} />
              <Kpi label={t.kMonthlySurplus} value={money(calc.net, cur)} tone={calc.net >= 0 ? "pos" : "neg"} sub={t.surplusSub(t.short(calc.income), t.short(calc.expense))} />
              <Kpi label={t.kInvestments} value={money(calc.invest, cur)} sub={t.holdingsCount(data.portfolio.length)} />
            </div>

            <div className="insight">{t.insight(insightVals, H)}</div>

            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">{t.secNetWorthTrend}</div><div className="sec-sub">{t.secAutoRecorded}</div></div>
                <NetWorthChart hist={calc.histArr} cur={cur} t={t} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">{t.secGoalProgress}</div></div>
                {data.goals.length === 0 && <div className="empty">{t.noGoals}</div>}
                {data.goals.map((g) => {
                  const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                  return (
                    <div key={g.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span>{g.label}</span><span className="fd-tabnum" style={{ color: "var(--gold2)" }}>{p.toFixed(0)}%</span>
                      </div>
                      <div className="bar"><i style={{ width: p + "%" }} /></div>
                      <div className="goal-meta"><span>{money(g.current, cur)}</span><span>{t.goalTarget(money(g.target, cur))}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Cash Flow ---------------- */}
        {tab === "cashflow" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="card">
              <div className="sec-h">
                <div>
                  <div className="sec-t">{t.secSavingsRate}</div>
                  <div className="sec-sub">{t.savingsRateSub(month)}</div>
                </div>
                <div className="mselect">
                  <label className="sec-sub">{t.monthLabel}</label>
                  <input className="inp" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 150 }} />
                </div>
              </div>
              <div className="gauge-wrap">
                <div className="gauge" style={{ "--p": Math.max(0, Math.min(100, calc.rate)) }}>
                  <span className="gv fd-tabnum">{calc.rate.toFixed(0)}%</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="row"><span className="lbl">{t.totalIncome}</span><span className="amt pos">{money(calc.income, cur)}</span><span /></div>
                  <div className="row"><span className="lbl">{t.totalSpending}</span><span className="amt neg">{money(calc.expense, cur)}</span><span /></div>
                  <div className="row"><span className="lbl" style={{ fontWeight: 700 }}>{t.monthlySurplus}</span><span className={"amt " + (calc.net >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>{money(calc.net, cur)}</span><span /></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secBudgetActual}</div><div className="sec-sub">{t.budgetActualSub}</div></div>
              {(() => {
                const budget = calc.expFixed;
                const actual = calc.expense;
                const p = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
                const over = actual - budget;
                return (
                  <>
                    <div className="bar"><i style={{ width: p + "%", background: over > 0 ? "var(--red)" : undefined }} /></div>
                    <div className="goal-meta">
                      <span>{t.budgetActualMeta(money(actual, cur), money(budget, cur))}</span>
                      <span className="tag">{budget === 0 ? t.budgetNone : over > 0 ? t.over(money(over, cur)) : t.left(money(-over, cur))}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secRecurring}</div><div className="sec-sub">{t.recurringSub}</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.recurringIncome}</div>
                  <MoneyList items={data.recurring.income} accent="var(--green)" cur={cur} t={t}
                    onChange={(v) => update({ recurring: { ...data.recurring, income: v } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.recurringExpenses}</div>
                  <MoneyList items={data.recurring.expenses} categories={EXPENSE_CATS} accent="var(--red)" cur={cur} t={t}
                    onChange={(v) => update({ recurring: { ...data.recurring, expenses: v } })} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secThisMonth(month)}</div><div className="sec-sub">{t.thisMonthSub}</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.extraIncome}</div>
                  <MoneyList items={calc.m.income} accent="var(--green)" cur={cur} t={t}
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, income: v } } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.variableSpending}</div>
                  <MoneyList items={calc.m.expenses} categories={EXPENSE_CATS} accent="var(--red)" cur={cur} t={t}
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, expenses: v } } })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Net Worth ---------------- */}
        {tab === "networth" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-3">
              <Kpi label={t.totalAssets} value={money(calc.assets, cur)} tone="pos" />
              <Kpi label={t.totalDebt} value={money(calc.liab, cur)} tone="neg" />
              <Kpi label={t.kNetWorth} value={money(calc.netWorth, cur)} />
            </div>
            <div className="card glow">
              <div className="sec-h"><div className="sec-t">{t.secNetWorthTrend}</div></div>
              <NetWorthChart hist={calc.histArr} cur={cur} t={t} />
            </div>
            <div className="fd-grid cols-2">
              <div className="card">
                <div className="sec-h"><div className="sec-t">{t.secAssets}</div></div>
                <MoneyList items={data.assets} categories={ASSET_TYPES} accent="var(--green)" cur={cur} t={t}
                  onChange={(v) => setAssetsLiab("assets", v)} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">{t.secLiabilities}</div></div>
                <MoneyList items={data.liabilities} accent="var(--red)" cur={cur} t={t}
                  onChange={(v) => setAssetsLiab("liabilities", v)} />
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Investments & Goals ---------------- */}
        {tab === "invest" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">{t.secAllocation}</div><div className="sec-sub">{money(calc.invest, cur)}</div></div>
                <AllocChart portfolio={data.portfolio} cur={cur} t={t} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">{t.secHoldings}</div></div>
                <MoneyList items={data.portfolio} categories={INVEST_CATS} accent="var(--gold2)" cur={cur} t={t}
                  onChange={(v) => update({ portfolio: v })} />
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secFinancialGoals}</div><div className="sec-sub">{t.goalsSub}</div></div>
              {data.goals.map((g) => {
                const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                const remain = Math.max(0, g.target - g.current);
                const months = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
                const eta = months ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return t.etaMonthYear(d); })() : null;
                return (
                  <div key={g.id} style={{ padding: "14px 0", borderBottom: "1px dashed var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 15 }}>{g.label}</span>
                      <button className="del" onClick={() => update({ goals: data.goals.filter((x) => x.id !== g.id) })}>✕</button>
                    </div>
                    <div className="bar"><i style={{ width: p + "%" }} /></div>
                    <div className="goal-meta">
                      <span>{money(g.current, cur)} / {money(g.target, cur)} ({p.toFixed(0)}%)</span>
                      <span className="tag">{remain === 0 ? t.goalReached : months ? t.goalEta(months, eta) : t.goalNoSurplus}</span>
                    </div>
                  </div>
                );
              })}
              <GoalAdder onAdd={(g) => update({ goals: [...data.goals, g] })} t={t} />
            </div>
            <div className="note">{t.investNote}</div>
          </div>
        )}

        {/* ---------------- Retirement ---------------- */}
        {tab === "retire" && (
          <RetirementView ret={data.retire} cur={cur} calc={calc} t={t} H={H}
            onChange={(r) => update({ retire: { ...data.retire, ...r } })} />
        )}
      </div>

      {/* floating conversational-fill button */}
      {!chatOpen && (
        <button className="fab" onClick={openQA} aria-label={t.guidedTitle}>✦</button>
      )}

      {/* guided Q&A modal */}
      {chatOpen && (() => {
        const total = QUESTIONS.length;
        const q = QUESTIONS[qaStep];
        const pct = qaDone ? 100 : Math.round((qaStep / total) * 100);
        return (
          <div className="modal-bg" onClick={() => { stopVoice(); setChatOpen(false); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h">
                <div>
                  <div className="fd-eyebrow">{t.guidedTitle}</div>
                  <div className="sec-t" style={{ fontSize: 17 }}>{qaDone ? t.qDone : t.qProgress(qaStep + 1, total)}</div>
                </div>
                <button className="del" style={{ fontSize: 20 }} onClick={() => { stopVoice(); setChatOpen(false); }}>✕</button>
              </div>
              <div className="qa-prog"><i style={{ width: pct + "%" }} /></div>

              {!qaDone ? (
                <div className="qa-body">
                  <div className="qa-q">{q.q}</div>
                  {q.hint && <div className="qa-hint">{q.hint}</div>}
                  <div className="qa-inputs">
                    {q.withLabel && (
                      <div className="qa-numwrap">
                        <input className="inp" placeholder={t.namePH} value={qaLabel}
                          onChange={(e) => setQaLabel(e.target.value)} />
                      </div>
                    )}
                    <div className="qa-numwrap">
                      <input className="inp qa-num" type="number" inputMode="numeric" autoFocus
                        placeholder={q.placeholder || t.amountPH} value={qaVal}
                        onChange={(e) => setQaVal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && nextStep(QUESTIONS)} />
                      <span className="qa-suffix">{q.suffix}</span>
                    </div>
                    {q.multi && (
                      <button className="fd-toolbtn" onClick={() => {
                        const v = Number(qaVal);
                        if (qaVal === "" || isNaN(v) || v <= 0) return;
                        setQaItems((prev) => [...prev, { label: qaLabel.trim() || q.fallbackLabel || t.fallbackItem, value: Math.round(v) }]);
                        setQaVal(""); setQaLabel("");
                      }}>{t.addThis}</button>
                    )}
                    {voice && (
                      <button className={"mic " + (listening ? "on" : "")} onClick={() => startVoice(q)}>
                        <span className="mic-dot" />
                        {listening ? t.listening : t.micSay}
                      </button>
                    )}
                  </div>
                  {heard && <div className="qa-heard">{t.heard(heard)}</div>}
                  {speechErr && <div className="qa-err">{speechErr}</div>}
                  {q.multi && qaItems.length > 0 && (
                    <div className="changed" style={{ marginTop: 12 }}>
                      {qaItems.map((it, j) => (
                        <span key={j} className="chip">
                          {it.label} {money(it.value, cur)}
                          <button className="del" style={{ marginLeft: 6 }}
                            onClick={() => setQaItems((prev) => prev.filter((_, k) => k !== j))}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {qaLog.length > 0 && (
                    <div className="changed" style={{ marginTop: 16 }}>
                      {qaLog.slice(-4).map((c, j) => <span key={j} className="chip">✓ {c}</span>)}
                    </div>
                  )}
                  <div className="qa-actions">
                    {qaStep > 0 && <button className="fd-toolbtn" onClick={backStep}>{t.back}</button>}
                    <div style={{ flex: 1 }} />
                    {q.optional && <button className="fd-toolbtn" onClick={() => skipStep(QUESTIONS)}>{t.skip}</button>}
                    <button className="addbtn" onClick={() => nextStep(QUESTIONS)}>
                      {qaStep + 1 >= total ? t.finish : t.next}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="qa-body">
                  <div className="qa-q">{t.allSet}</div>
                  <div className="qa-hint">{t.allSetHint}</div>
                  <div className="changed" style={{ marginTop: 14 }}>
                    {qaLog.length === 0
                      ? <span className="qa-hint">{t.noNewItems}</span>
                      : qaLog.map((c, j) => <span key={j} className="chip">✓ {c}</span>)}
                  </div>
                  <div className="qa-actions" style={{ marginTop: 22 }}>
                    <button className="fd-toolbtn" onClick={openQA}>{t.fillAgain}</button>
                    <div style={{ flex: 1 }} />
                    <button className="addbtn" onClick={() => setChatOpen(false)}>{t.viewDashboard}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* spoken financial story modal */}
      {storyOpen && (
        <div className="modal-bg" onClick={closeStory}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <div>
                <div className="fd-eyebrow">{t.recapEyebrow}</div>
                <div className="sec-t" style={{ fontSize: 17 }}>{t.recapTitle}</div>
              </div>
              <button className="del" style={{ fontSize: 20 }} onClick={closeStory}>✕</button>
            </div>
            <div className="qa-body">
              <div className="story-text">{story}</div>
              <div className="qa-actions" style={{ marginTop: 22 }}>
                <button className={"mic " + (speaking ? "on" : "")} onClick={speaking ? stopStory : speakStory}>
                  <span className="mic-dot" />
                  {speaking ? t.speakingStop : t.playVoice}
                </button>
                <div style={{ flex: 1 }} />
                <button className="addbtn" onClick={closeStory}>{t.close}</button>
              </div>
              <div className="qa-hint" style={{ marginTop: 12 }}>{t.recapHint}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- charts & sub-views ----------------------------- */
function NetWorthChart({ hist, cur, t }) {
  if (!hist || hist.length < 2)
    return <div className="empty">{t.chartNeedTwo}</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={hist} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gld" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2972f" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#c2972f" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(42,32,19,.07)" vertical={false} />
        <XAxis dataKey="m" tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={t.short} tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: "#fffefb", border: "1px solid rgba(194,151,47,.3)", borderRadius: 10, color: "#3d3322" }}
          formatter={(v) => [money(v, cur), t.chartNetWorthName]} labelStyle={{ color: "#897c64" }} />
        <Line type="monotone" dataKey="v" stroke="url(#gld)" strokeWidth={2.5} dot={{ r: 3, fill: "#c2972f" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["#c2972f", "#3c8a5f", "#c45c36", "#9a8fd6", "#6fb0c9", "#d6b85a", "#897c64"];
function AllocChart({ portfolio, cur, t }) {
  const byCat = useMemo(() => {
    const m = {};
    portfolio.forEach((p) => { m[p.category || t.cats.invest[6]] = (m[p.category || t.cats.invest[6]] || 0) + (Number(p.value) || 0); });
    return Object.keys(m).map((k) => ({ name: k, value: m[k] }));
  }, [portfolio]);
  const total = sum(byCat);
  if (byCat.length === 0) return <div className="empty">{t.allocEmpty}</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={byCat} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
            {byCat.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#fffefb", border: "1px solid rgba(194,151,47,.3)", borderRadius: 10 }}
            formatter={(v) => money(v, cur)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend" style={{ flex: 1, minWidth: 140 }}>
        {byCat.map((e, i) => (
          <div className="legi" key={e.name}>
            <span className="dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span style={{ flex: 1 }}>{e.name}</span>
            <span className="fd-tabnum" style={{ color: "var(--muted)" }}>{total > 0 ? ((e.value / total) * 100).toFixed(0) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalAdder({ onAdd, t }) {
  const [lbl, setLbl] = useState("");
  const [tgt, setTgt] = useState("");
  const [cur, setCur] = useState("");
  const add = () => {
    if (!lbl.trim() || !tgt) return;
    onAdd({ id: uid(), label: lbl.trim(), target: Number(tgt), current: Number(cur) || 0 });
    setLbl(""); setTgt(""); setCur("");
  };
  return (
    <div className="addrow" style={{ marginTop: 16 }}>
      <input className="inp lbl-in" placeholder={t.goalName} value={lbl} onChange={(e) => setLbl(e.target.value)} />
      <input className="inp num-in" type="number" placeholder={t.goalTargetPH} value={tgt} onChange={(e) => setTgt(e.target.value)} />
      <input className="inp num-in" type="number" placeholder={t.goalSavedPH} value={cur} onChange={(e) => setCur(e.target.value)} />
      <button className="addbtn" onClick={add}>{t.addGoal}</button>
    </div>
  );
}

/* ----------------------------- retirement ----------------------------- */
function RetInput({ label, value, onChange, suffix, hint }) {
  return (
    <div>
      <div className="kpi-l" style={{ marginBottom: 6 }}>
        {label}
        {hint && <span style={{ color: "var(--dim)", marginLeft: 6, letterSpacing: 0, textTransform: "none" }}>{hint}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input className="inp" type="number" value={value === undefined || value === null ? "" : value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "100%", paddingRight: suffix ? 34 : 11 }} />
        {suffix && <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "var(--dim)", fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function RetirementView({ ret, onChange, calc, cur, t, H }) {
  const r = ret || {};
  const set = (k) => (v) => onChange({ [k]: v });
  const fillNow = () => onChange({
    currentSavings: Math.max(0, Math.round(calc.invest || calc.netWorth || 0)),
    monthlyContribution: Math.max(0, Math.round(calc.net || 0)),
    monthlySpend: Math.max(0, Math.round(calc.expense || 0)),
  });

  const m = useMemo(() => {
    const age = Number(r.currentAge) || 0;
    const rage = Number(r.retireAge) || 0;
    const cs = Number(r.currentSavings) || 0;
    const pmt = Number(r.monthlyContribution) || 0;
    const ar = (Number(r.annualReturn) || 0) / 100;
    const infl = (Number(r.inflation) || 0) / 100;
    const spendYr = (Number(r.monthlySpend) || 0) * 12;
    const wr = (Number(r.withdrawalRate) || 4) / 100;
    const valid = rage > age && spendYr > 0;
    const mr = ar / 12;
    const fv = (months) => mr === 0 ? cs + pmt * months
      : cs * Math.pow(1 + mr, months) + pmt * ((Math.pow(1 + mr, months) - 1) / mr);
    const neededAt = (yrs) => wr > 0 ? (spendYr * Math.pow(1 + infl, yrs)) / wr : 0;

    const series = [];
    let fiAge = null;
    if (valid) {
      for (let a = age; a <= rage; a++) {
        const yrs = a - age;
        const proj = fv(yrs * 12);
        const need = neededAt(yrs);
        if (fiAge === null && proj >= need) fiAge = a;
        series.push({ age: a, projected: Math.round(proj), needed: Math.round(need) });
      }
    }
    const n = (rage - age) * 12;
    const projAtRetire = valid ? fv(n) : 0;
    const needAtRetire = valid ? neededAt(rage - age) : 0;
    const gap = projAtRetire - needAtRetire;
    let reqPmt = 0;
    if (valid && n > 0) {
      reqPmt = mr === 0
        ? (needAtRetire - cs) / n
        : (needAtRetire - cs * Math.pow(1 + mr, n)) * mr / (Math.pow(1 + mr, n) - 1);
    }
    const extra = Math.max(0, reqPmt - pmt);
    return { valid, series, fiAge, projAtRetire, needAtRetire, gap, extra, rage, yrsLeft: rage - age };
  }, [r]);

  const FIELDS = t.retFields(cur);

  return (
    <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="sec-h">
          <div>
            <div className="sec-t">{t.retInputs}</div>
            <div className="sec-sub">{m.yrsLeft > 0 ? t.yrsLeft(m.yrsLeft) : t.checkAge}</div>
          </div>
          <button className="fd-toolbtn" onClick={fillNow}>{t.useCurrentNumbers}</button>
        </div>
        <div className="fd-grid cols-4">
          {FIELDS.map((f) => (
            <RetInput key={f.k} label={f.label} suffix={f.suffix} hint={f.hint}
              value={r[f.k]} onChange={set(f.k)} />
          ))}
        </div>
        <div className="note">{t.retNote}</div>
      </div>

      {!m.valid ? (
        <div className="insight">{t.retStartInsight()}</div>
      ) : (
        <>
          <div className="fd-grid cols-4">
            <Kpi label={t.kProjected} value={money(m.projAtRetire, cur)} />
            <Kpi label={t.kNeeded} value={money(m.needAtRetire, cur)} sub={t.neededSub} />
            <Kpi label={m.gap >= 0 ? t.kSurplus : t.kShortfall} value={money(Math.abs(m.gap), cur)} tone={m.gap >= 0 ? "pos" : "neg"} />
            <Kpi label={t.kFreedom} value={m.fiAge ? m.fiAge + " " + t.ageSuffixKpi : t.freedomAdjust} tone={m.fiAge && m.fiAge <= m.rage ? "pos" : ""} sub={m.fiAge ? t.freedomBy(m.fiAge) : t.freedomNotReached} />
          </div>

          <div className="card glow">
            <div className="sec-h"><div className="sec-t">{t.secAssetsVsNeeded}</div><div className="sec-sub">{t.crossover}</div></div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={m.series} margin={{ top: 8, right: 10, left: -2, bottom: 0 }}>
                <CartesianGrid stroke="rgba(42,32,19,.07)" vertical={false} />
                <XAxis dataKey="age" tickFormatter={t.chartAgeTick} tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={t.short} tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: "#fffefb", border: "1px solid rgba(194,151,47,.3)", borderRadius: 10, color: "#3d3322" }}
                  formatter={(v, n) => [money(v, cur), n]} labelFormatter={t.chartAgeLabel} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" name={t.projectedName} dataKey="projected" stroke="#c2972f" strokeWidth={2.6} dot={false} />
                <Line type="monotone" name={t.neededName} dataKey="needed" stroke="#3c8a5f" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="insight">
            {m.gap >= 0 ? t.retInsightSurplus(r, m, H) : t.retInsightShortfall(r, m, H)}
          </div>
        </>
      )}
    </div>
  );
}
