import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* ----------------------------- persistent storage ----------------------------- */
const KEY = "finance:data:v2";
// Persistence via localStorage. Swap this object for an API-backed store
// (fetch to your own backend) if you later want multi-device sync.
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
const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return Math.round(v).toLocaleString("en-US");
};

/* ---- spoken English number → numeric ---- */
const EN_SMALL = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const EN_MAG = { hundred: 100, thousand: 1e3, grand: 1e3, million: 1e6, billion: 1e9 };
function enWordsToNum(words) {
  let total = 0, current = 0, seen = false;
  for (let w of words) {
    w = w.replace(/s$/, ""); // millions -> million
    if (w in EN_SMALL) { current += EN_SMALL[w]; seen = true; }
    else if (w === "hundred") { current = (current || 1) * 100; seen = true; }
    else if (w in EN_MAG) { total += (current || 1) * EN_MAG[w]; current = 0; seen = true; }
    else if (/^\d+(\.\d+)?$/.test(w)) { current += parseFloat(w); seen = true; }
    else if (w === "and" || w === "a") { /* skip filler */ }
  }
  return seen ? total + current : NaN;
}
function parseSpoken(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase()
    .replace(/[,$]/g, "")
    .replace(/\b(dollars?|bucks?|usd|nt\$?|ntd|per month|a month|monthly|about|around|roughly|approximately|approx|please)\b/g, "")
    .replace(/\s+/g, " ").trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // hybrid digit + magnitude: "70k", "1.5 million", "3m", "2 billion", "1.2b"
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(k|grand|thousand|m|mil|million|b|bil|billion)$/);
  if (m) {
    const u = m[2];
    const mult = (u === "k" || u === "grand" || u === "thousand") ? 1e3
      : (u === "m" || u === "mil" || u === "million") ? 1e6 : 1e9;
    return parseFloat(m[1]) * mult;
  }
  // pure word form: "seventy thousand", "three hundred thousand"
  if (/[a-z]/.test(s)) {
    const v = enWordsToNum(s.split(" "));
    if (!isNaN(v) && v > 0) return v;
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
// split a spoken phrase into a label + trailing amount, e.g. "car loan twenty thousand"
function splitLabelAmount(raw) {
  const t = String(raw || "").trim();
  const tokens = t.split(/\s+/);
  // find the longest trailing run that parses to a number
  for (let i = 0; i < tokens.length; i++) {
    const tail = tokens.slice(i).join(" ");
    const amount = parseSpoken(tail);
    if (!isNaN(amount) && amount > 0) {
      let label = tokens.slice(0, i).join(" ")
        .replace(/\b(is|are|of|the|my|a|about|around)\b/gi, "").trim();
      return { label, amount };
    }
  }
  return { label: t, amount: NaN };
}
// split one spoken sentence into several label+amount items, e.g.
// "insurance three hundred, phone eighty, Netflix fifteen" -> 3 items.
function splitMultiLabelAmount(raw) {
  return String(raw || "").trim()
    .split(/[,;]+|\band\b|\bplus\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => splitLabelAmount(seg))
    .filter((x) => x.label && !isNaN(x.amount) && x.amount > 0)
    .map((x) => ({ label: x.label, value: Math.round(x.amount) }));
}

const EXPENSE_CATS = ["Housing", "Food", "Transport", "Insurance", "Leisure", "Subscriptions", "Other"];
const ASSET_TYPES = ["Cash", "Savings", "Investments", "Property", "Other"];
const INVEST_CATS = ["US Stocks", "Intl Stocks", "ETF", "Bonds", "Crypto", "Cash", "Other"];

const DEFAULT = {
  currency: "$",
  recurring: { income: [], expenses: [] },
  months: {},
  assets: [],
  liabilities: [],
  netWorthHistory: {},
  portfolio: [],
  goals: [],
  retire: { currentAge: "", retireAge: "", monthlySpend: "", withdrawalRate: "", annualReturn: "", inflation: "", currentSavings: "", monthlyContribution: "" },
};

const SAMPLE = {
  currency: "$",
  recurring: {
    income: [{ id: uid(), label: "Salary", value: 6000 }],
    expenses: [
      { id: uid(), label: "Rent", value: 1800, category: "Housing" },
      { id: uid(), label: "Insurance", value: 250, category: "Insurance" },
      { id: uid(), label: "Streaming", value: 45, category: "Subscriptions" },
    ],
  },
  months: {
    [ym()]: {
      income: [{ id: uid(), label: "Freelance", value: 600 }],
      expenses: [
        { id: uid(), label: "Groceries", value: 700, category: "Food" },
        { id: uid(), label: "Transport", value: 180, category: "Transport" },
        { id: uid(), label: "Leisure", value: 300, category: "Leisure" },
      ],
    },
  },
  assets: [
    { id: uid(), label: "Checking account", value: 9000, type: "Savings" },
    { id: uid(), label: "Brokerage", value: 17000, type: "Investments" },
    { id: uid(), label: "Emergency fund", value: 5000, type: "Cash" },
  ],
  liabilities: [
    { id: uid(), label: "Credit card", value: 700 },
    { id: uid(), label: "Student loan", value: 6000 },
  ],
  netWorthHistory: (() => {
    const h = {};
    const base = 28000;
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      h[ym(d)] = base + (5 - i) * 1400 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 400));
    }
    return h;
  })(),
  portfolio: [
    { id: uid(), label: "VOO S&P 500", value: 7000, category: "ETF" },
    { id: uid(), label: "Apple", value: 5300, category: "US Stocks" },
    { id: uid(), label: "VXUS", value: 3000, category: "ETF" },
    { id: uid(), label: "Bitcoin", value: 2000, category: "Crypto" },
  ],
  goals: [
    { id: uid(), label: "First $100K", target: 100000, current: 74800 },
    { id: uid(), label: "Travel fund", target: 4000, current: 1500 },
  ],
  retire: { currentAge: 30, retireAge: 60, monthlySpend: 3500, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 31000, monthlyContribution: 1200 },
};

/* ----------------------------- styles ----------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap');
:root{
  --bg:#13100c; --bg2:#181410; --surface:#1f1a14; --surface2:#272018;
  --line:rgba(205,170,107,.14); --line2:rgba(205,170,107,.28);
  --gold:#cdaa6b; --gold2:#e6cd96; --text:#f3ecdd; --muted:#a89f8c; --dim:#6f685a;
  --green:#85bb9c; --red:#d68a76;
  --serif:'Fraunces',Georgia,'Songti TC',serif;
  --sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
.fd-root{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;
  background-image:radial-gradient(900px 500px at 80% -10%,rgba(205,170,107,.10),transparent 60%),
  radial-gradient(700px 500px at -10% 10%,rgba(133,187,156,.06),transparent 55%);
  -webkit-font-smoothing:antialiased;}
.fd-wrap{max-width:1040px;margin:0 auto;padding:26px 18px 80px;}
.fd-tabnum{font-variant-numeric:tabular-nums;}
.fd-serif{font-family:var(--serif);}
.fd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;
  animation:rise .6s ease both;}
.fd-eyebrow{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:500;}
.fd-privacy{font-size:12px;color:var(--muted);margin-top:8px;max-width:380px;line-height:1.4;}
.fd-title{font-family:var(--serif);font-size:30px;font-weight:600;line-height:1.05;margin-top:6px;letter-spacing:.01em;}
.fd-net{font-family:var(--serif);font-size:34px;font-weight:600;letter-spacing:.01em;}
.fd-net-row{text-align:right;}
.fd-net-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);}
.fd-toolbtn{background:transparent;border:1px solid var(--line2);color:var(--muted);font-family:var(--sans);
  font-size:12px;padding:7px 12px;border-radius:999px;cursor:pointer;transition:.18s;}
.fd-toolbtn:hover{color:var(--text);border-color:var(--gold);background:rgba(205,170,107,.07);}
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
.card.glow{box-shadow:0 0 0 1px rgba(205,170,107,.08),0 24px 50px -30px rgba(0,0,0,.8);}
.kpi-l{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}
.kpi-v{font-family:var(--serif);font-size:25px;font-weight:600;margin-top:9px;}
.kpi-sub{font-size:12px;color:var(--dim);margin-top:4px;}
.pos{color:var(--green);} .neg{color:var(--red);}
.sec-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;}
.sec-t{font-family:var(--serif);font-size:18px;font-weight:600;}
.sec-sub{font-size:12px;color:var(--dim);}
.row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed var(--line);}
.row:last-of-type{border-bottom:none;}
.row .lbl{font-size:14px;color:var(--text);}
.row .cat{font-size:11px;color:var(--gold);background:rgba(205,170,107,.1);padding:2px 8px;border-radius:999px;margin-left:8px;}
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
  background:conic-gradient(var(--gold) calc(var(--p)*1%),rgba(255,255,255,.06) 0);
  display:flex;align-items:center;justify-content:center;position:relative;transition:.6s;}
.gauge::after{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--surface);}
.gauge .gv{position:relative;font-family:var(--serif);font-size:26px;font-weight:600;}
.bar{height:9px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:8px;}
.bar > i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .7s ease;}
.goal-meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-top:7px;}
.tag{font-size:11.5px;color:var(--green);}
.legend{display:flex;flex-direction:column;gap:9px;}
.legi{display:flex;align-items:center;gap:9px;font-size:13px;}
.dot{width:10px;height:10px;border-radius:3px;flex-shrink:0;}
.insight{border:1px solid var(--line2);background:linear-gradient(180deg,rgba(205,170,107,.07),transparent);
  border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.7;color:var(--text);}
.insight b{color:var(--gold2);font-family:var(--serif);}
.note{font-size:12px;color:var(--dim);line-height:1.6;margin-top:10px;}
.mselect{display:flex;align-items:center;gap:8px;}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.stagger>*{animation:rise .5s ease both;}
.stagger>*:nth-child(2){animation-delay:.05s}.stagger>*:nth-child(3){animation-delay:.1s}
.stagger>*:nth-child(4){animation-delay:.15s}.stagger>*:nth-child(5){animation-delay:.2s}
.fd-toolbtn.gold{border-color:var(--gold);color:var(--gold2);background:rgba(205,170,107,.1);}
.fd-toolbtn.gold:hover{background:rgba(205,170,107,.18);color:var(--gold2);}
.fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;border:1px solid var(--gold);
  background:linear-gradient(160deg,var(--gold2),var(--gold));color:#1b1610;font-size:22px;cursor:pointer;z-index:40;
  box-shadow:0 12px 30px -8px rgba(205,170,107,.5);transition:.2s;animation:rise .5s ease both;}
.fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 36px -8px rgba(205,170,107,.65);}
.modal-bg{position:fixed;inset:0;background:rgba(8,6,4,.66);backdrop-filter:blur(4px);z-index:50;
  display:flex;align-items:flex-end;justify-content:center;animation:fade .25s ease both;padding:0;}
@media(min-width:640px){.modal-bg{align-items:center;padding:20px;}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.modal{width:100%;max-width:480px;height:78vh;max-height:620px;background:linear-gradient(180deg,var(--surface),var(--bg2));
  border:1px solid var(--line2);border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 -20px 60px -20px rgba(0,0,0,.8);animation:slideup .3s cubic-bezier(.2,.8,.2,1) both;}
@media(min-width:640px){.modal{border-radius:20px;height:600px;}}
@keyframes slideup{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
.modal-h{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);}
.qa-prog{height:3px;background:rgba(255,255,255,.06);}
.qa-prog > i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .4s ease;}
.qa-body{flex:1;overflow-y:auto;padding:26px 22px;display:flex;flex-direction:column;}
.qa-q{font-family:var(--serif);font-size:22px;font-weight:600;line-height:1.3;animation:rise .35s ease both;}
.qa-hint{font-size:13px;color:var(--dim);margin-top:8px;line-height:1.6;}
.qa-inputs{display:flex;flex-direction:column;gap:10px;margin-top:22px;}
.qa-inputs .inp{font-size:16px;padding:13px 14px;}
.qa-numwrap{position:relative;}
.qa-num{width:100%;font-variant-numeric:tabular-nums;padding-right:46px!important;}
.qa-suffix{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--gold2);font-size:14px;}
.qa-actions{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:24px;}
.qa-actions .addbtn{padding:10px 22px;}
.changed{display:flex;flex-wrap:wrap;gap:5px;}
.chip{font-size:11.5px;color:var(--green);background:rgba(133,187,156,.12);border:1px solid rgba(133,187,156,.25);
  padding:3px 8px;border-radius:999px;}
.mic{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:2px;
  background:var(--surface2);border:1px solid var(--line2);color:var(--muted);font-family:var(--sans);
  font-size:14px;padding:11px;border-radius:10px;cursor:pointer;transition:.18s;}
.mic:hover{color:var(--text);border-color:var(--gold);}
.mic .mic-dot{width:9px;height:9px;border-radius:50%;background:var(--dim);transition:.18s;}
.mic.on{color:var(--red);border-color:var(--red);background:rgba(214,138,118,.1);}
.mic.on .mic-dot{background:var(--red);animation:pulse 1s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(214,138,118,.5)}70%{box-shadow:0 0 0 8px rgba(214,138,118,0)}100%{box-shadow:0 0 0 0 rgba(214,138,118,0)}}
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

function MoneyList({ items, onChange, categories, valueKey = "value", accent, addLabel }) {
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
      {items.length === 0 && <div className="empty">No items yet</div>}
      {items.map((it) => (
        <div className="row" key={it.id}>
          <div className="lbl">
            {it.label}
            {it.category && <span className="cat">{it.category}</span>}
          </div>
          <div className="amt" style={accent ? { color: accent } : null}>{money(it[valueKey])}</div>
          <button className="del" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
        </div>
      ))}
      <div className="addrow">
        <input className="inp lbl-in" placeholder="Name" value={lbl}
          onChange={(e) => setLbl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        {categories && (
          <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input className="inp num-in" type="number" placeholder="Amount" value={val}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="addbtn" onClick={add}>{addLabel || "Add"}</button>
      </div>
    </div>
  );
}

/* ----------------------------- main ----------------------------- */
export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("Overview");
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

  useEffect(() => {
    (async () => {
      const raw = await store.get(KEY);
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
        alert("Import successful — your data has been restored.");
      } catch {
        alert("Invalid file — import failed. Please pick a backup you exported earlier.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // record a net-worth snapshot for current month whenever assets/liabilities change
  const setAssetsLiab = (key, list) => {
    update((prev) => {
      const next = { ...prev, [key]: list };
      const nw = sum(next.assets) - sum(next.liabilities);
      next.netWorthHistory = { ...prev.netWorthHistory, [ym()]: nw };
      return next;
    });
  };

  // merge structured updates extracted from the conversation into state
  const applyUpdates = (u) => {
    if (!u) return [];
    const summary = [];
    const tag = (arr) => (arr || []).map((x) => ({ ...x, id: uid() }));
    update((prev) => {
      const next = { ...prev };
      next.recurring = { ...prev.recurring };
      if (u.recurring_income?.length) {
        next.recurring.income = [...prev.recurring.income, ...tag(u.recurring_income)];
        u.recurring_income.forEach((x) => summary.push(`Recurring income "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.recurring_expenses?.length) {
        next.recurring.expenses = [...prev.recurring.expenses, ...tag(u.recurring_expenses)];
        u.recurring_expenses.forEach((x) => summary.push(`Recurring expense "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.month_income?.length) {
        const m = prev.months[month] || { income: [], expenses: [] };
        next.months = { ...prev.months, [month]: { ...m, income: [...m.income, ...tag(u.month_income)] } };
        u.month_income.forEach((x) => summary.push(`This-month income "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.month_expenses?.length) {
        const m = next.months?.[month] || prev.months[month] || { income: [], expenses: [] };
        next.months = { ...(next.months || prev.months), [month]: { ...m, expenses: [...m.expenses, ...tag(u.month_expenses)] } };
        u.month_expenses.forEach((x) => summary.push(`This-month expense "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.assets?.length) {
        next.assets = [...prev.assets, ...tag(u.assets)];
        u.assets.forEach((x) => summary.push(`Asset "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.liabilities?.length) {
        next.liabilities = [...prev.liabilities, ...tag(u.liabilities)];
        u.liabilities.forEach((x) => summary.push(`Liability "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.portfolio?.length) {
        next.portfolio = [...prev.portfolio, ...tag(u.portfolio)];
        u.portfolio.forEach((x) => summary.push(`Holding "${x.label}" ${money(x.value, cur)}`));
      }
      if (u.goals?.length) {
        next.goals = [...prev.goals, ...tag(u.goals)];
        u.goals.forEach((x) => summary.push(`Goal "${x.label}" ${money(x.target, cur)}`));
      }
      if (u.retire && Object.keys(u.retire).length) {
        next.retire = { ...prev.retire, ...u.retire };
        summary.push("Retirement inputs updated");
      }
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
    const withLabel = q && q.withLabel;
    const multi = q && q.multi;
    setSpeechErr("");
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setSpeechErr("This browser does not support voice input — please type instead. Chrome or Safari work best."); return; }
    if (listening) { stopVoice(); return; }
    let rec;
    try { rec = new SR(); } catch { setSpeechErr("Could not start voice — please type instead."); return; }
    rec.lang = "en-US";
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
        if (multi) {
          const items = splitMultiLabelAmount(txt);
          if (items.length) setQaItems((prev) => [...prev, ...items]);
          else setSpeechErr(`Didn’t catch "${txt}" — try one at a time like "insurance 300, phone 80", or type it in.`);
        } else if (withLabel) {
          const { label, amount } = splitLabelAmount(txt);
          if (label) setQaLabel(label);
          if (!isNaN(amount)) setQaVal(String(Math.round(amount)));
        } else {
          const n = parseSpoken(txt);
          if (!isNaN(n)) setQaVal(String(Math.round(n)));
          else setSpeechErr(`Didn\u2019t catch "${txt}" — try again or type it in.`);
        }
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setSpeechErr("Microphone is blocked — allow mic access in your browser, or type instead.");
      else if (e.error === "no-speech") setSpeechErr("Didn\u2019t hear anything — try again?");
      else setSpeechErr("Voice recognition stopped — please type instead.");
    };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setSpeechErr("Could not start voice — please type instead."); }
  };

  const commitStep = (q) => {
    const t = q.target;
    if (q.multi) {
      const items = [...qaItems];
      const typedVal = Number(qaVal);
      if (qaVal !== "" && !isNaN(typedVal) && typedVal > 0)
        items.push({ label: qaLabel.trim() || q.fallbackLabel || "Item", value: Math.round(typedVal) });
      if (!items.length) return q.optional;
      let upd = {};
      if (t.type === "recurring_income") upd = { recurring_income: items.map((it) => ({ label: it.label, value: it.value })) };
      else if (t.type === "recurring_expense") upd = { recurring_expenses: items.map((it) => ({ label: it.label, value: it.value, category: t.category || "Other" })) };
      else if (t.type === "asset") upd = { assets: items.map((it) => ({ label: it.label, value: it.value, type: t.assetType || "Other" })) };
      else if (t.type === "portfolio") upd = { portfolio: items.map((it) => ({ label: it.label, value: it.value, category: t.category || "Other" })) };
      else if (t.type === "liability") upd = { liabilities: items.map((it) => ({ label: it.label, value: it.value })) };
      const changed = applyUpdates(upd);
      if (changed.length) setQaLog((prev) => [...prev, ...changed]);
      return true;
    }
    const val = Number(qaVal);
    if (!q.optional && (qaVal === "" || isNaN(val))) return false;
    if (qaVal === "" || isNaN(val) || val === 0) return true; // treated as skip
    const label = t.label || qaLabel.trim() || q.fallbackLabel || "Item";
    let upd = {};
    if (t.type === "retire") upd = { retire: { [t.key]: val } };
    else if (t.type === "recurring_income") upd = { recurring_income: [{ label, value: val }] };
    else if (t.type === "recurring_expense") upd = { recurring_expenses: [{ label, value: val, category: t.category || "Other" }] };
    else if (t.type === "asset") upd = { assets: [{ label, value: val, type: t.assetType || "Other" }] };
    else if (t.type === "portfolio") upd = { portfolio: [{ label, value: val, category: t.category || "Other" }] };
    else if (t.type === "liability") upd = { liabilities: [{ label, value: val }] };
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

  const cur = data?.currency || "$";

  // ordered interview script; each step maps to one dashboard field
  const QUESTIONS = [
    { q: "Let\u2019s start with you — how old are you?", hint: "Used to estimate years until retirement", suffix: "yrs", placeholder: "Type or say your age", target: { type: "retire", key: "currentAge" } },
    { q: "What\u2019s your monthly take-home income?", hint: "What actually lands in your account", suffix: cur, target: { type: "recurring_income", label: "Salary" } },
    { q: "Monthly rent or mortgage?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "Rent/Mortgage", category: "Housing" } },
    { q: "Roughly how much on living costs each month?", hint: "Food, transport, everyday spending combined", optional: true, suffix: cur, target: { type: "recurring_expense", label: "Living costs", category: "Food" } },
    { q: "Any other recurring expenses?", hint: "Say several at once, e.g. “insurance 300, phone 80, Netflix 15”; or type each and tap “Add this one”", optional: true, withLabel: true, multi: true, fallbackLabel: "Recurring expense", suffix: cur, target: { type: "recurring_expense", category: "Other" } },
    { q: "How much in bank savings / cash?", optional: true, suffix: cur, target: { type: "asset", label: "Savings", assetType: "Savings" } },
    { q: "Current market value of your investments?", hint: "Say several at once, e.g. “Apple 50k, VOO 20k”; or type each and tap “Add this one”", optional: true, withLabel: true, multi: true, fallbackLabel: "Investments", suffix: cur, target: { type: "portfolio", category: "ETF" } },
    { q: "Any debts?", hint: "Say several at once, e.g. “car loan 20k, credit card 5k”; skip if none", optional: true, withLabel: true, multi: true, fallbackLabel: "Debt", suffix: cur, target: { type: "liability" } },
    { q: "At what age do you want to retire?", suffix: "yrs", placeholder: "Type or say your age", target: { type: "retire", key: "retireAge" } },
    { q: "How much will you spend per month in retirement?", hint: "In today\u2019s prices — inflation is added automatically", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
    { q: "How much can you invest toward retirement monthly?", hint: "Your monthly surplus is a good starting estimate", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
  ];

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
        <div className="fd-wrap"><div className="empty">Loading…</div></div>
      </div>
    );
  }

  const tabs = ["Overview", "Cash Flow", "Net Worth", "Investments & Goals", "Retirement"];

  return (
    <div className="fd-root">
      <style>{CSS}</style>
      <div className="fd-wrap">
        {/* header */}
        <div className="fd-head">
          <div>
            <div className="fd-eyebrow">Personal Wealth</div>
            <h1 className="fd-title">Wealth Dashboard</h1>
            <div className="fd-privacy">🔒 Your data stays in your browser — nothing is uploaded. Use “Export” to back up anytime.</div>
          </div>
          <div className="fd-net-row">
            <div className="fd-net-label">Current net worth</div>
            <div className={"fd-net fd-tabnum " + (calc.netWorth >= 0 ? "" : "neg")}>{money(calc.netWorth, cur)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button className="fd-toolbtn gold" onClick={openQA}>✦ Guided fill</button>
              <button className="fd-toolbtn" onClick={() => update({ ...SAMPLE })}>Load sample</button>
              <button className="fd-toolbtn" onClick={exportData}>Export</button>
              <button className="fd-toolbtn" onClick={() => fileRef.current && fileRef.current.click()}>Import</button>
              <button className="fd-toolbtn" onClick={() => { if (confirm("Clear all data?")) update({ ...DEFAULT }); }}>Clear</button>
              <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importData} />
            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="fd-tabs">
          {tabs.map((t) => (
            <button key={t} className={"fd-tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {/* ---------------- Overview ---------------- */}
        {tab === "Overview" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-4">
              <Kpi label="Net Worth" value={money(calc.netWorth, cur)} sub={`Assets ${shortMoney(calc.assets)} − Debt ${shortMoney(calc.liab)}`} />
              <Kpi label="Savings Rate" value={calc.rate.toFixed(0) + "%"} tone={calc.rate >= 20 ? "pos" : calc.rate < 0 ? "neg" : ""} sub={calc.rate >= 30 ? "Excellent ✦" : calc.rate >= 20 ? "Healthy" : calc.rate >= 0 ? "Could improve" : "Spending over income"} />
              <Kpi label="Monthly Surplus" value={money(calc.net, cur)} tone={calc.net >= 0 ? "pos" : "neg"} sub={`Income ${shortMoney(calc.income)} / Spend ${shortMoney(calc.expense)}`} />
              <Kpi label="Investments" value={money(calc.invest, cur)} sub={data.portfolio.length + " holdings"} />
            </div>

            {/* wealth velocity insight */}
            <WealthInsight calc={calc} goals={data.goals} cur={cur} />

            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">Net Worth Trend</div><div className="sec-sub">Auto-recorded on each update</div></div>
                <NetWorthChart hist={calc.histArr} cur={cur} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">Goal Progress</div></div>
                {data.goals.length === 0 && <div className="empty">No goals yet → add them under "Investments & Goals"</div>}
                {data.goals.map((g) => {
                  const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                  return (
                    <div key={g.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span>{g.label}</span><span className="fd-tabnum" style={{ color: "var(--gold2)" }}>{p.toFixed(0)}%</span>
                      </div>
                      <div className="bar"><i style={{ width: p + "%" }} /></div>
                      <div className="goal-meta"><span>{money(g.current, cur)}</span><span>Target {money(g.target, cur)}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Cash Flow ---------------- */}
        {tab === "Cash Flow" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="card">
              <div className="sec-h">
                <div>
                  <div className="sec-t">Savings Rate</div>
                  <div className="sec-sub">{month} · Share of income you keep after spending</div>
                </div>
                <div className="mselect">
                  <label className="sec-sub">Month</label>
                  <input className="inp" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 150 }} />
                </div>
              </div>
              <div className="gauge-wrap">
                <div className="gauge" style={{ "--p": Math.max(0, Math.min(100, calc.rate)) }}>
                  <span className="gv fd-tabnum">{calc.rate.toFixed(0)}%</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="row"><span className="lbl">Total income</span><span className="amt pos">{money(calc.income, cur)}</span><span /></div>
                  <div className="row"><span className="lbl">Total spending</span><span className="amt neg">{money(calc.expense, cur)}</span><span /></div>
                  <div className="row"><span className="lbl" style={{ fontWeight: 700 }}>Monthly surplus</span><span className={"amt " + (calc.net >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>{money(calc.net, cur)}</span><span /></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">Budget vs Actual</div><div className="sec-sub">Recurring expenses as budget, vs this month's actual spend (incl. variable)</div></div>
              {(() => {
                const budget = calc.expFixed;
                const actual = calc.expense;
                const p = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
                const over = actual - budget;
                return (
                  <>
                    <div className="bar"><i style={{ width: p + "%", background: over > 0 ? "var(--red)" : undefined }} /></div>
                    <div className="goal-meta">
                      <span>Actual {money(actual, cur)} / Budget {money(budget, cur)}</span>
                      <span className="tag">{budget === 0 ? "No recurring expenses set" : over > 0 ? `${money(over, cur)} over` : `${money(-over, cur)} left`}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">Recurring Items</div><div className="sec-sub">Set once, auto-applied every month</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>Recurring income</div>
                  <MoneyList items={data.recurring.income} accent="var(--green)"
                    onChange={(v) => update({ recurring: { ...data.recurring, income: v } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>Recurring expenses</div>
                  <MoneyList items={data.recurring.expenses} categories={EXPENSE_CATS} accent="var(--red)"
                    onChange={(v) => update({ recurring: { ...data.recurring, expenses: v } })} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">This Month · {month}</div><div className="sec-sub">One-off income/spending for this month</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>Extra income</div>
                  <MoneyList items={calc.m.income} accent="var(--green)"
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, income: v } } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>Variable spending</div>
                  <MoneyList items={calc.m.expenses} categories={EXPENSE_CATS} accent="var(--red)"
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, expenses: v } } })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Net Worth ---------------- */}
        {tab === "Net Worth" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-3">
              <Kpi label="Total Assets" value={money(calc.assets, cur)} tone="pos" />
              <Kpi label="Total Debt" value={money(calc.liab, cur)} tone="neg" />
              <Kpi label="Net Worth" value={money(calc.netWorth, cur)} />
            </div>
            <div className="card glow">
              <div className="sec-h"><div className="sec-t">Net Worth Trend</div></div>
              <NetWorthChart hist={calc.histArr} cur={cur} />
            </div>
            <div className="fd-grid cols-2">
              <div className="card">
                <div className="sec-h"><div className="sec-t">Assets</div></div>
                <MoneyList items={data.assets} categories={ASSET_TYPES} accent="var(--green)"
                  onChange={(v) => setAssetsLiab("assets", v)} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">Liabilities</div></div>
                <MoneyList items={data.liabilities} accent="var(--red)"
                  onChange={(v) => setAssetsLiab("liabilities", v)} />
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Investments & Goals ---------------- */}
        {tab === "Investments & Goals" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">Allocation</div><div className="sec-sub">{money(calc.invest, cur)}</div></div>
                <AllocChart portfolio={data.portfolio} cur={cur} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">Holdings</div></div>
                <MoneyList items={data.portfolio} categories={INVEST_CATS} accent="var(--gold2)"
                  onChange={(v) => update({ portfolio: v })} />
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">Financial Goals</div><div className="sec-sub">ETA estimated from your monthly surplus</div></div>
              {data.goals.map((g) => {
                const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                const remain = Math.max(0, g.target - g.current);
                const months = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
                const eta = months ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); })() : null;
                return (
                  <div key={g.id} style={{ padding: "14px 0", borderBottom: "1px dashed var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 15 }}>{g.label}</span>
                      <button className="del" onClick={() => update({ goals: data.goals.filter((x) => x.id !== g.id) })}>✕</button>
                    </div>
                    <div className="bar"><i style={{ width: p + "%" }} /></div>
                    <div className="goal-meta">
                      <span>{money(g.current, cur)} / {money(g.target, cur)} ({p.toFixed(0)}%)</span>
                      <span className="tag">{remain === 0 ? "Reached ✦" : months ? `~${months} mo · by ${eta}` : "No surplus this month"}</span>
                    </div>
                  </div>
                );
              })}
              <GoalAdder onAdd={(g) => update({ goals: [...data.goals, g] })} />
            </div>
            <div className="note">
              Note: holdings here are a current snapshot you update manually. They are tracked separately from the Net Worth tab — if you also list investments there, avoid double-counting. This tool only tracks; investment decisions are your own or for a professional to advise on.
            </div>
          </div>
        )}

        {/* ---------------- Retirement ---------------- */}
        {tab === "Retirement" && (
          <RetirementView ret={data.retire} cur={cur} calc={calc}
            onChange={(r) => update({ retire: { ...data.retire, ...r } })} />
        )}
      </div>

      {/* floating conversational-fill button */}
      {!chatOpen && (
        <button className="fab" onClick={openQA} aria-label="Guided fill">✦</button>
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
                  <div className="fd-eyebrow">Guided fill</div>
                  <div className="sec-t" style={{ fontSize: 17 }}>{qaDone ? "Done!" : `Question ${qaStep + 1} / ${total}`}</div>
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
                        <input className="inp" placeholder="Name (e.g. Car loan)" value={qaLabel}
                          onChange={(e) => setQaLabel(e.target.value)} />
                      </div>
                    )}
                    <div className="qa-numwrap">
                      <input className="inp qa-num" type="number" inputMode="numeric" autoFocus
                        placeholder={q.placeholder || "Type or say the amount"} value={qaVal}
                        onChange={(e) => setQaVal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && nextStep(QUESTIONS)} />
                      <span className="qa-suffix">{q.suffix}</span>
                    </div>
                    {q.multi && (
                      <button className="fd-toolbtn" onClick={() => {
                        const v = Number(qaVal);
                        if (qaVal === "" || isNaN(v) || v <= 0) return;
                        setQaItems((prev) => [...prev, { label: qaLabel.trim() || q.fallbackLabel || "Item", value: Math.round(v) }]);
                        setQaVal(""); setQaLabel("");
                      }}>Add this one</button>
                    )}
                    <button className={"mic " + (listening ? "on" : "")} onClick={() => startVoice(q)}>
                      <span className="mic-dot" />
                      {listening ? "Listening… tap to stop" : "🎤 Say it"}
                    </button>
                  </div>
                  {heard && <div className="qa-heard">Heard: "{heard}"</div>}
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
                    {qaStep > 0 && <button className="fd-toolbtn" onClick={backStep}>Back</button>}
                    <div style={{ flex: 1 }} />
                    {q.optional && <button className="fd-toolbtn" onClick={() => skipStep(QUESTIONS)}>Skip</button>}
                    <button className="addbtn" onClick={() => nextStep(QUESTIONS)}>
                      {qaStep + 1 >= total ? "Finish" : "Next"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="qa-body">
                  <div className="qa-q">All set ✦</div>
                  <div className="qa-hint">Here\u2019s what you added this round. Everything is saved automatically.</div>
                  <div className="changed" style={{ marginTop: 14 }}>
                    {qaLog.length === 0
                      ? <span className="qa-hint">No new items added this round.</span>
                      : qaLog.map((c, j) => <span key={j} className="chip">✓ {c}</span>)}
                  </div>
                  <div className="qa-actions" style={{ marginTop: 22 }}>
                    <button className="fd-toolbtn" onClick={openQA}>Fill again</button>
                    <div style={{ flex: 1 }} />
                    <button className="addbtn" onClick={() => setChatOpen(false)}>View dashboard</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ----------------------------- charts & sub-views ----------------------------- */
function NetWorthChart({ hist, cur }) {
  if (!hist || hist.length < 2)
    return <div className="empty">Need at least two months of history to draw a trend</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={hist} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gld" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cdaa6b" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#cdaa6b" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
        <XAxis dataKey="m" tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={shortMoney} tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: "#1f1a14", border: "1px solid rgba(205,170,107,.3)", borderRadius: 10, color: "#f3ecdd" }}
          formatter={(v) => [money(v, cur), "Net worth"]} labelStyle={{ color: "#a89f8c" }} />
        <Line type="monotone" dataKey="v" stroke="url(#gld)" strokeWidth={2.5} dot={{ r: 3, fill: "#cdaa6b" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["#cdaa6b", "#85bb9c", "#d68a76", "#9a8fd6", "#6fb0c9", "#d6b85a", "#a89f8c"];
function AllocChart({ portfolio, cur }) {
  const byCat = useMemo(() => {
    const m = {};
    portfolio.forEach((p) => { m[p.category || "Other"] = (m[p.category || "Other"] || 0) + (Number(p.value) || 0); });
    return Object.keys(m).map((k) => ({ name: k, value: m[k] }));
  }, [portfolio]);
  const total = sum(byCat);
  if (byCat.length === 0) return <div className="empty">Add holdings on the right to see the allocation</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={byCat} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
            {byCat.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#1f1a14", border: "1px solid rgba(205,170,107,.3)", borderRadius: 10 }}
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

function WealthInsight({ calc, goals, cur }) {
  const milestone = goals.length
    ? goals.reduce((a, b) => (b.target - b.current < a.target - a.current && b.target > b.current ? b : a))
    : { label: "First $100K", target: 100000, current: calc.netWorth };
  const remain = Math.max(0, milestone.target - milestone.current);
  const m1 = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
  const boosted = calc.net + calc.income * 0.1;
  const m2 = boosted > 0 ? Math.ceil(remain / boosted) : null;
  const saved = m1 && m2 ? m1 - m2 : 0;
  return (
    <div className="insight">
      {calc.net <= 0 ? (
        <>Your spending is at or above your income, so the wealth engine has stalled. Start by cutting one or two <b>recurring expenses</b> — that keeps saving you money every month.</>
      ) : (
        <>
          At your current surplus of <b>{money(calc.net, cur)}</b>/mo (a <b>{calc.rate.toFixed(0)}%</b> savings rate), "{milestone.label}" is about <b>{m1} months</b> away.
          {saved > 0 && <> Push your savings rate up another 10% and you\u2019d get there <b>{saved} months sooner</b> — that\u2019s the power of the savings rate.</>}
        </>
      )}
    </div>
  );
}

function GoalAdder({ onAdd }) {
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
      <input className="inp lbl-in" placeholder="Goal name" value={lbl} onChange={(e) => setLbl(e.target.value)} />
      <input className="inp num-in" type="number" placeholder="Target amount" value={tgt} onChange={(e) => setTgt(e.target.value)} />
      <input className="inp num-in" type="number" placeholder="Saved so far" value={cur} onChange={(e) => setCur(e.target.value)} />
      <button className="addbtn" onClick={add}>Add goal</button>
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

function RetirementView({ ret, onChange, calc, cur }) {
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

  const FIELDS = [
    { k: "currentAge", label: "Current age", suffix: "yrs" },
    { k: "retireAge", label: "Target retire age", suffix: "yrs" },
    { k: "currentSavings", label: "Current retirement assets", suffix: cur },
    { k: "monthlyContribution", label: "Monthly contribution", suffix: cur },
    { k: "annualReturn", label: "Annual return", suffix: "%" },
    { k: "inflation", label: "Inflation", suffix: "%" },
    { k: "monthlySpend", label: "Monthly spend in retirement", suffix: cur, hint: "today\u2019s prices" },
    { k: "withdrawalRate", label: "Safe withdrawal rate", suffix: "%" },
  ];

  return (
    <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="sec-h">
          <div>
            <div className="sec-t">Retirement Inputs</div>
            <div className="sec-sub">{m.yrsLeft > 0 ? `${m.yrsLeft} years until retirement` : "Check your age inputs"}</div>
          </div>
          <button className="fd-toolbtn" onClick={fillNow}>Use current numbers</button>
        </div>
        <div className="fd-grid cols-4">
          {FIELDS.map((f) => (
            <RetInput key={f.k} label={f.label} suffix={f.suffix} hint={f.hint}
              value={r[f.k]} onChange={set(f.k)} />
          ))}
        </div>
        <div className="note">Compound growth uses your annual return; the amount needed is derived from the safe withdrawal rate (the 4% rule), with monthly spending inflated to your retirement year. These are planning assumptions, not investment advice.</div>
      </div>

      {!m.valid ? (
        <div className="insight">Fill in <b>age</b>, <b>retirement age</b> and <b>monthly spending in retirement</b> to begin — or tap "Use current numbers" at the top right for a quick estimate from your existing data.</div>
      ) : (
        <>
          <div className="fd-grid cols-4">
            <Kpi label="Projected at retirement" value={money(m.projAtRetire, cur)} />
            <Kpi label="Needed to retire" value={money(m.needAtRetire, cur)} sub="4% rule + inflation" />
            <Kpi label={m.gap >= 0 ? "Surplus" : "Shortfall"} value={money(Math.abs(m.gap), cur)} tone={m.gap >= 0 ? "pos" : "neg"} />
            <Kpi label="Financial freedom" value={m.fiAge ? m.fiAge + " yrs" : "Adjust"} tone={m.fiAge && m.fiAge <= m.rage ? "pos" : ""} sub={m.fiAge ? `by age ${m.fiAge}` : "not reached by retirement"} />
          </div>

          <div className="card glow">
            <div className="sec-h"><div className="sec-t">Assets vs Amount needed</div><div className="sec-sub">Where the lines cross = financial freedom</div></div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={m.series} margin={{ top: 8, right: 10, left: -2, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="age" tickFormatter={(a) => a + "y"} tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortMoney} tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: "#1f1a14", border: "1px solid rgba(205,170,107,.3)", borderRadius: 10, color: "#f3ecdd" }}
                  formatter={(v, n) => [money(v, cur), n]} labelFormatter={(a) => "Age " + a} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" name="Projected assets" dataKey="projected" stroke="#cdaa6b" strokeWidth={2.6} dot={false} />
                <Line type="monotone" name="Amount needed" dataKey="needed" stroke="#85bb9c" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="insight">
            {m.gap >= 0 ? (
              <>At <b>{money(r.monthlyContribution, cur)}</b>/mo and a <b>{r.annualReturn}%</b> annual return, you are projected to have <b>{money(m.projAtRetire, cur)}</b> by age <b>{m.rage}</b> — above the {money(m.needAtRetire, cur)} you need.{m.fiAge && m.fiAge < m.rage && <> On this track you could reach financial freedom as early as age <b>{m.fiAge}</b> — you might retire earlier or contribute less.</>}</>
            ) : (
              <>On the current track you would have about <b>{money(m.projAtRetire, cur)}</b> at retirement, <b>{money(Math.abs(m.gap), cur)}</b> short of the {money(m.needAtRetire, cur)} needed. To close the gap, raise contributions to about <b>{money(r.monthlyContribution + m.extra, cur)}</b>/mo (an extra {money(m.extra, cur)}) — or retire later, raise returns, or lower retirement spending.</>
            )}
          </div>
        </>
      )}
    </div>
  );
}
