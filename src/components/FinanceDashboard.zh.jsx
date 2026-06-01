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
const money = (n, cur = "NT$") => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-" : "") + cur + " " + Math.abs(v).toLocaleString("en-US");
};
const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + "億";
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + "萬";
  return Math.round(v).toLocaleString("en-US");
};

/* ---- spoken Chinese number → numeric ---- */
const CN_DIGIT = { 零: 0, "〇": 0, 一: 1, 壹: 1, 二: 2, 兩: 2, 倆: 2, 贰: 2, 貳: 2, 三: 3, 參: 3, 叁: 3, 四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9 };
const CN_SMALL = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 };
const CN_BIG = { 萬: 1e4, 万: 1e4, 億: 1e8, 亿: 1e8 };
function cnSectionToNum(s) {
  let total = 0, section = 0, num = 0;
  for (const ch of s) {
    if (ch in CN_DIGIT) num = CN_DIGIT[ch];
    else if (/\d/.test(ch)) num = num * 10 + Number(ch);
    else if (ch in CN_SMALL) { if (num === 0) num = 1; section += num * CN_SMALL[ch]; num = 0; }
    else if (ch in CN_BIG) { section += num; total = (total + section) * CN_BIG[ch]; section = 0; num = 0; }
  }
  return total + section + num;
}
function parseSpoken(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase()
    .replace(/[,，\s]/g, "")
    .replace(/(新?臺幣|新?台幣|塊錢|元整|元|塊|圓|nt\$?|ntd|usd|\$)/g, "")
    .replace(/大約|大概|差不多|左右|約|是|有|這個月|每月|每個月/g, "")
    .replace(/點/g, ".");
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // hybrid: "7萬", "1.5萬", "70億", "5k", "3w"
  let m = s.match(/^(\d+(?:\.\d+)?)(萬|万|億|亿|k|w)$/);
  if (m) {
    const mult = m[2] === "k" ? 1e3 : m[2] === "w" ? 1e4 : CN_BIG[m[2]];
    return parseFloat(m[1]) * mult;
  }
  // chinese with decimal + big unit: "兩點五萬" already had 點→.
  m = s.match(/^([\d.]+)(萬|万|億|亿)$/);
  if (m) return parseFloat(m[1]) * CN_BIG[m[2]];
  if (/[零〇一壹二兩倆贰貳三參叁四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万億亿]/.test(s)) {
    const v = cnSectionToNum(s);
    return v > 0 ? v : NaN;
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
// split a spoken phrase into a label + trailing amount, e.g. "車貸二十萬"
function splitLabelAmount(raw) {
  const t = String(raw || "").trim();
  const m = t.match(/^(.*?)[\s:：]*([\d零〇一壹二兩倆贰貳三參叁四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万億亿.點,，]+(?:元|塊|塊錢|k|w)?)$/);
  if (m) {
    const amount = parseSpoken(m[2]);
    let label = m[1].replace(/(是|有|大約|大概|每月|每個月|的)/g, "").trim();
    return { label, amount };
  }
  return { label: t, amount: NaN };
}
// split one spoken sentence into several label+amount items, e.g.
// "保險三千、手機八百、Netflix兩百九" -> 3 items. Splits on list delimiters
// and common spoken connectors (還有、跟、和…); each segment runs splitLabelAmount.
function splitMultiLabelAmount(raw) {
  const t = String(raw || "").trim();
  if (!t) return [];
  return t
    .split(/[、,，;；/]+|還有|以及|加上|然後|再來|跟|和/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => splitLabelAmount(seg))
    .filter((x) => x.label && !isNaN(x.amount) && x.amount > 0)
    .map((x) => ({ label: x.label, value: Math.round(x.amount) }));
}

const EXPENSE_CATS = ["居住", "飲食", "交通", "保險", "娛樂", "訂閱", "其他"];
const ASSET_TYPES = ["現金", "存款", "投資", "不動產", "其他"];
const INVEST_CATS = ["台股", "美股", "ETF", "債券", "加密貨幣", "現金", "其他"];

const DEFAULT = {
  currency: "NT$",
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
  currency: "NT$",
  recurring: {
    income: [{ id: uid(), label: "月薪", value: 65000 }],
    expenses: [
      { id: uid(), label: "房租", value: 18000, category: "居住" },
      { id: uid(), label: "保險", value: 4000, category: "保險" },
      { id: uid(), label: "串流訂閱", value: 800, category: "訂閱" },
    ],
  },
  months: {
    [ym()]: {
      income: [{ id: uid(), label: "接案", value: 8000 }],
      expenses: [
        { id: uid(), label: "伙食", value: 12000, category: "飲食" },
        { id: uid(), label: "交通", value: 2500, category: "交通" },
        { id: uid(), label: "娛樂", value: 4000, category: "娛樂" },
      ],
    },
  },
  assets: [
    { id: uid(), label: "活存帳戶", value: 280000, type: "存款" },
    { id: uid(), label: "證券戶投資", value: 520000, type: "投資" },
    { id: uid(), label: "緊急預備金", value: 150000, type: "現金" },
  ],
  liabilities: [
    { id: uid(), label: "信用卡", value: 22000 },
    { id: uid(), label: "學貸", value: 180000 },
  ],
  netWorthHistory: (() => {
    const h = {};
    const base = 600000;
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      h[ym(d)] = base + (5 - i) * 28000 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 9000));
    }
    return h;
  })(),
  portfolio: [
    { id: uid(), label: "VOO 標普500", value: 210000, category: "ETF" },
    { id: uid(), label: "台積電", value: 160000, category: "台股" },
    { id: uid(), label: "0050", value: 90000, category: "ETF" },
    { id: uid(), label: "比特幣", value: 60000, category: "加密貨幣" },
  ],
  goals: [
    { id: uid(), label: "第一桶金", target: 1000000, current: 748000 },
    { id: uid(), label: "出國旅遊基金", target: 120000, current: 45000 },
  ],
  retire: { currentAge: 30, retireAge: 60, monthlySpend: 40000, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 670000, monthlyContribution: 28000 },
};

/* ----------------------------- styles ----------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
:root{
  --bg:#13100c; --bg2:#181410; --surface:#1f1a14; --surface2:#272018;
  --line:rgba(205,170,107,.14); --line2:rgba(205,170,107,.28);
  --gold:#cdaa6b; --gold2:#e6cd96; --text:#f3ecdd; --muted:#a89f8c; --dim:#6f685a;
  --green:#85bb9c; --red:#d68a76;
  --serif:'Fraunces',Georgia,'Songti TC',serif;
  --sans:'Noto Sans TC',-apple-system,BlinkMacSystemFont,'PingFang TC','Microsoft JhengHei',sans-serif;
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
.story-text{font-size:15px;line-height:1.85;color:var(--text);background:rgba(205,170,107,.06);border:1px solid rgba(205,170,107,.18);border-radius:14px;padding:16px 18px;letter-spacing:.01em;}
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
      {items.length === 0 && <div className="empty">尚未新增項目</div>}
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
        <input className="inp lbl-in" placeholder="名稱" value={lbl}
          onChange={(e) => setLbl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        {categories && (
          <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input className="inp num-in" type="number" placeholder="金額" value={val}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="addbtn" onClick={add}>{addLabel || "新增"}</button>
      </div>
    </div>
  );
}

/* ----------------------------- main ----------------------------- */
export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("總覽");
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
        alert("匯入成功,資料已還原。");
      } catch {
        alert("檔案格式不正確,匯入失敗。請選擇先前匯出的備份檔。");
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
        u.recurring_income.forEach((x) => summary.push(`固定收入「${x.label}」${money(x.value, cur)}`));
      }
      if (u.recurring_expenses?.length) {
        next.recurring.expenses = [...prev.recurring.expenses, ...tag(u.recurring_expenses)];
        u.recurring_expenses.forEach((x) => summary.push(`固定支出「${x.label}」${money(x.value, cur)}`));
      }
      if (u.month_income?.length) {
        const m = prev.months[month] || { income: [], expenses: [] };
        next.months = { ...prev.months, [month]: { ...m, income: [...m.income, ...tag(u.month_income)] } };
        u.month_income.forEach((x) => summary.push(`本月收入「${x.label}」${money(x.value, cur)}`));
      }
      if (u.month_expenses?.length) {
        const m = next.months?.[month] || prev.months[month] || { income: [], expenses: [] };
        next.months = { ...(next.months || prev.months), [month]: { ...m, expenses: [...m.expenses, ...tag(u.month_expenses)] } };
        u.month_expenses.forEach((x) => summary.push(`本月支出「${x.label}」${money(x.value, cur)}`));
      }
      if (u.assets?.length) {
        next.assets = [...prev.assets, ...tag(u.assets)];
        u.assets.forEach((x) => summary.push(`資產「${x.label}」${money(x.value, cur)}`));
      }
      if (u.liabilities?.length) {
        next.liabilities = [...prev.liabilities, ...tag(u.liabilities)];
        u.liabilities.forEach((x) => summary.push(`負債「${x.label}」${money(x.value, cur)}`));
      }
      if (u.portfolio?.length) {
        next.portfolio = [...prev.portfolio, ...tag(u.portfolio)];
        u.portfolio.forEach((x) => summary.push(`持倉「${x.label}」${money(x.value, cur)}`));
      }
      if (u.goals?.length) {
        next.goals = [...prev.goals, ...tag(u.goals)];
        u.goals.forEach((x) => summary.push(`目標「${x.label}」${money(x.target, cur)}`));
      }
      if (u.retire && Object.keys(u.retire).length) {
        next.retire = { ...prev.retire, ...u.retire };
        summary.push("退休參數已更新");
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
    if (!SR) { setSpeechErr("這個瀏覽器不支援語音輸入,請改用打字。建議用 Chrome 或 Safari。"); return; }
    if (listening) { stopVoice(); return; }
    let rec;
    try { rec = new SR(); } catch { setSpeechErr("無法啟動語音,請改用打字。"); return; }
    rec.lang = "zh-TW";
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
          else setSpeechErr(`沒聽懂「${txt}」,試試「保險三千、手機八百」這樣一筆一筆說,或直接打字。`);
        } else if (withLabel) {
          const { label, amount } = splitLabelAmount(txt);
          if (label) setQaLabel(label);
          if (!isNaN(amount)) setQaVal(String(Math.round(amount)));
        } else {
          const n = parseSpoken(txt);
          if (!isNaN(n)) setQaVal(String(Math.round(n)));
          else setSpeechErr(`沒聽懂「${txt}」,可以再說一次或直接打字。`);
        }
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setSpeechErr("麥克風權限被擋住了,請在瀏覽器允許麥克風,或改用打字。");
      else if (e.error === "no-speech") setSpeechErr("沒聽到聲音,再試一次?");
      else setSpeechErr("語音辨識中斷,請改用打字。");
    };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setSpeechErr("無法啟動語音,請改用打字。"); }
  };

  const commitStep = (q) => {
    const t = q.target;
    // multi-item step: collect everything gathered (voice list + a typed entry)
    if (q.multi) {
      const items = [...qaItems];
      const typedVal = Number(qaVal);
      if (qaVal !== "" && !isNaN(typedVal) && typedVal > 0)
        items.push({ label: qaLabel.trim() || q.fallbackLabel || "項目", value: Math.round(typedVal) });
      if (!items.length) return q.optional; // nothing captured: ok to skip if optional
      let upd = {};
      if (t.type === "recurring_income") upd = { recurring_income: items.map((it) => ({ label: it.label, value: it.value })) };
      else if (t.type === "recurring_expense") upd = { recurring_expenses: items.map((it) => ({ label: it.label, value: it.value, category: t.category || "其他" })) };
      else if (t.type === "asset") upd = { assets: items.map((it) => ({ label: it.label, value: it.value, type: t.assetType || "其他" })) };
      else if (t.type === "portfolio") upd = { portfolio: items.map((it) => ({ label: it.label, value: it.value, category: t.category || "其他" })) };
      else if (t.type === "liability") upd = { liabilities: items.map((it) => ({ label: it.label, value: it.value })) };
      const changed = applyUpdates(upd);
      if (changed.length) setQaLog((prev) => [...prev, ...changed]);
      return true;
    }
    const val = Number(qaVal);
    if (!q.optional && (qaVal === "" || isNaN(val))) return false;
    if (qaVal === "" || isNaN(val) || val === 0) return true; // treated as skip
    const label = t.label || qaLabel.trim() || q.fallbackLabel || "項目";
    let upd = {};
    if (t.type === "retire") upd = { retire: { [t.key]: val } };
    else if (t.type === "recurring_income") upd = { recurring_income: [{ label, value: val }] };
    else if (t.type === "recurring_expense") upd = { recurring_expenses: [{ label, value: val, category: t.category || "其他" }] };
    else if (t.type === "asset") upd = { assets: [{ label, value: val, type: t.assetType || "其他" }] };
    else if (t.type === "portfolio") upd = { portfolio: [{ label, value: val, category: t.category || "其他" }] };
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

  const cur = data?.currency || "NT$";

  // ordered interview script; each step maps to one dashboard field
  const QUESTIONS = [
    { q: "先從你開始 — 你今年幾歲?", hint: "用來估算到退休還有多少年", suffix: "歲", placeholder: "輸入或說出年齡", target: { type: "retire", key: "currentAge" } },
    { q: "你每月稅後收入大約多少?", hint: "薪水實際入帳的金額", suffix: cur, target: { type: "recurring_income", label: "月薪" } },
    { q: "每月房租或房貸繳多少?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "房租/房貸", category: "居住" } },
    { q: "每月生活開銷大約多少?", hint: "飲食、交通、日用品加總抓個概數", optional: true, suffix: cur, target: { type: "recurring_expense", label: "生活費", category: "飲食" } },
    { q: "其他固定支出?", hint: "可一次說多筆,例如「保險三千、手機八百、Netflix兩百九」;或逐筆輸入後按「新增此筆」", optional: true, withLabel: true, multi: true, fallbackLabel: "固定支出", suffix: cur, target: { type: "recurring_expense", category: "其他" } },
    { q: "銀行存款 / 現金大約多少?", optional: true, suffix: cur, target: { type: "asset", label: "存款", assetType: "存款" } },
    { q: "投資部位目前市值多少?", hint: "可一次說多筆,例如「台積電五十萬、0050二十萬」;或逐筆輸入後按「新增此筆」", optional: true, withLabel: true, multi: true, fallbackLabel: "投資", suffix: cur, target: { type: "portfolio", category: "ETF" } },
    { q: "有沒有負債?", hint: "可一次說多筆,例如「車貸二十萬、信用卡五萬」;沒有就略過", optional: true, withLabel: true, multi: true, fallbackLabel: "負債", suffix: cur, target: { type: "liability" } },
    { q: "你希望幾歲退休?", suffix: "歲", placeholder: "輸入或說出年齡", target: { type: "retire", key: "retireAge" } },
    { q: "退休後每月想花多少?", hint: "用今天的物價估,系統會自動計入通膨", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
    { q: "每月能投入多少做退休準備?", hint: "可先用每月結餘估", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
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
        <div className="fd-wrap"><div className="empty">載入中…</div></div>
      </div>
    );
  }

  const tabs = ["總覽", "現金流", "淨資產", "投資與目標", "退休"];

  // ---- spoken financial story (summary narrated via SpeechSynthesis) ----
  const sayNum = (n) => shortMoney(n) + "元";
  const buildStory = () => {
    const c = calc;
    const parts = [];
    const hour = new Date().getHours();
    const greet = hour < 5 ? "夜深了,還在關心自己的錢,這份用心很難得。" : hour < 12 ? "早安。" : hour < 18 ? "午安。" : "晚安,辛苦一天了。";
    parts.push(greet);

    if (c.netWorth > 0)
      parts.push(`先給你一個好消息——此刻你的淨資產來到 ${sayNum(c.netWorth)}。這是你用 ${sayNum(c.assets)} 的資產,一點一滴扛起 ${sayNum(c.liab)} 的負債後,真正屬於你的數字。每一塊,都是你努力的證明。`);
    else if (c.assets > 0 || c.liab > 0)
      parts.push(`現在的淨資產還在水面下,但別灰心。負債只是還沒走完的一段路,不是終點。你願意打開這個畫面面對它,就已經贏過昨天的自己了。`);
    else
      parts.push(`我們的故事還是一張白紙,而這正是最令人期待的地方。點一下「引導填寫」或「載入範例」,讓我陪你寫下第一頁。`);

    if (c.income > 0 || c.expense > 0) {
      let verdict;
      if (c.rate >= 30) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,太漂亮了!這是很多人想都不敢想的數字,你做到了。`;
      else if (c.rate >= 20) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,穩穩地走在健康的軌道上,繼續保持。`;
      else if (c.rate >= 0) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,雖然不多,但有存下來就是勝利,我們再一起往上推一點。`;
      else verdict = `這個月花得比賺的多,別自責——日子有起有落,看清楚了,下個月就有機會調整回來。`;
      parts.push(`這個月,收入 ${sayNum(c.income)} 進了口袋,支出 ${sayNum(c.expense)} 流了出去,最後留下 ${sayNum(c.net)}。${verdict}`);
    }

    const cats = {};
    [...data.recurring.expenses, ...c.m.expenses].forEach((e) => {
      const k = e.category || "其他";
      cats[k] = (cats[k] || 0) + (Number(e.value) || 0);
    });
    const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] > 0) parts.push(`錢花得最兇的地方是「${topCat[0]}」,一個月 ${sayNum(topCat[1])}。看見它在哪,你就握住了改變的鑰匙。`);

    if (c.invest > 0) {
      const top = [...data.portfolio].sort((a, b) => (b.value || 0) - (a.value || 0))[0];
      parts.push(`你還讓 ${sayNum(c.invest)} 的資金替你工作,分散在 ${data.portfolio.length} 項持倉裡${top ? `,其中 ${top.label} 是你最大的夥伴` : ""}。這些錢,正在你睡覺的時候默默長大。`);
    }

    const g = (data.goals || [])[0];
    if (g && Number(g.target) > 0) {
      const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
      const remain = Math.max(0, Number(g.target) - Number(g.current));
      let line = `說到夢想——「${g.label}」你已經走完 ${pct} 趴`;
      if (c.net > 0 && remain > 0) {
        const months = Math.ceil(remain / c.net);
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        line += `。照現在的步調,大約再 ${months} 個月,也就是 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月,你就能親手把它實現。終點線,已經看得見了`;
      } else if (pct >= 100) {
        line += `,你已經達標了,好好為自己慶祝一下!`;
      }
      parts.push(line + "。");
    }

    const r = data.retire || {};
    const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
    if (spend > 0 && wr > 0) {
      const fi = (spend * 12) / (wr / 100);
      parts.push(`而那個最遠的夢——退休。若你想往後每月安穩花用 ${sayNum(spend)},大約準備 ${sayNum(fi)},就能換來不再為錢焦慮的自由。聽起來很大,但你今天的每一步,都在替未來的自己鋪路。`);
    }

    parts.push(`財富從來不是一夜之間,而是一次次小小的堅持累積而成。你已經在路上了,而我會一直陪著你。`);
    return parts.join("");
  };
  const story = buildStory();

  const stopStory = () => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* no-op */ }
    setSpeaking(false);
  };
  const speakStory = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      alert("這個瀏覽器不支援語音朗讀,建議改用 Chrome 或 Safari。");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(story);
    u.lang = "zh-TW";
    u.rate = 1.0;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const openStory = () => { setStoryOpen(true); };
  const closeStory = () => { stopStory(); setStoryOpen(false); };

  return (
    <div className="fd-root">
      <style>{CSS}</style>
      <div className="fd-wrap">
        {/* header */}
        <div className="fd-head">
          <div>
            <div className="fd-eyebrow">Personal Wealth</div>
            <h1 className="fd-title">資產儀表板</h1>
            <div className="fd-privacy">🔒 資料只存在你的瀏覽器，不會上傳。可隨時「匯出」備份。</div>
          </div>
          <div className="fd-net-row">
            <div className="fd-net-label">目前淨資產</div>
            <div className={"fd-net fd-tabnum " + (calc.netWorth >= 0 ? "" : "neg")}>{money(calc.netWorth, cur)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button className="fd-toolbtn gold" onClick={openQA}>✦ 引導填寫</button>
              <button className="fd-toolbtn" onClick={openStory}>🔊 語音總結</button>
              <button className="fd-toolbtn" onClick={() => update({ ...SAMPLE })}>載入範例</button>
              <button className="fd-toolbtn" onClick={exportData}>匯出</button>
              <button className="fd-toolbtn" onClick={() => fileRef.current && fileRef.current.click()}>匯入</button>
              <button className="fd-toolbtn" onClick={() => { if (confirm("確定清空所有資料?")) update({ ...DEFAULT }); }}>清空</button>
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

        {/* ---------------- 總覽 ---------------- */}
        {tab === "總覽" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-4">
              <Kpi label="淨資產" value={money(calc.netWorth, cur)} sub={`資產 ${shortMoney(calc.assets)} − 負債 ${shortMoney(calc.liab)}`} />
              <Kpi label="本月儲蓄率" value={calc.rate.toFixed(0) + "%"} tone={calc.rate >= 20 ? "pos" : calc.rate < 0 ? "neg" : ""} sub={calc.rate >= 30 ? "極佳 ✦" : calc.rate >= 20 ? "健康" : calc.rate >= 0 ? "可加強" : "入不敷出"} />
              <Kpi label="本月結餘" value={money(calc.net, cur)} tone={calc.net >= 0 ? "pos" : "neg"} sub={`收入 ${shortMoney(calc.income)} / 支出 ${shortMoney(calc.expense)}`} />
              <Kpi label="投資總額" value={money(calc.invest, cur)} sub={data.portfolio.length + " 項持倉"} />
            </div>

            {/* wealth velocity insight */}
            <WealthInsight calc={calc} goals={data.goals} cur={cur} />

            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">淨資產走勢</div><div className="sec-sub">每次更新自動記錄</div></div>
                <NetWorthChart hist={calc.histArr} cur={cur} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">目標進度</div></div>
                {data.goals.length === 0 && <div className="empty">還沒有設定目標 → 到「投資與目標」新增</div>}
                {data.goals.map((g) => {
                  const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                  return (
                    <div key={g.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span>{g.label}</span><span className="fd-tabnum" style={{ color: "var(--gold2)" }}>{p.toFixed(0)}%</span>
                      </div>
                      <div className="bar"><i style={{ width: p + "%" }} /></div>
                      <div className="goal-meta"><span>{money(g.current, cur)}</span><span>目標 {money(g.target, cur)}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 現金流 ---------------- */}
        {tab === "現金流" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="card">
              <div className="sec-h">
                <div>
                  <div className="sec-t">儲蓄率</div>
                  <div className="sec-sub">{month} · 收入扣掉支出後存下的比例</div>
                </div>
                <div className="mselect">
                  <label className="sec-sub">月份</label>
                  <input className="inp" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 150 }} />
                </div>
              </div>
              <div className="gauge-wrap">
                <div className="gauge" style={{ "--p": Math.max(0, Math.min(100, calc.rate)) }}>
                  <span className="gv fd-tabnum">{calc.rate.toFixed(0)}%</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="row"><span className="lbl">總收入</span><span className="amt pos">{money(calc.income, cur)}</span><span /></div>
                  <div className="row"><span className="lbl">總支出</span><span className="amt neg">{money(calc.expense, cur)}</span><span /></div>
                  <div className="row"><span className="lbl" style={{ fontWeight: 700 }}>本月結餘</span><span className={"amt " + (calc.net >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>{money(calc.net, cur)}</span><span /></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">預算 vs 實際</div><div className="sec-sub">以固定支出當預算,對比本月實際支出(含變動)</div></div>
              {(() => {
                const budget = calc.expFixed;
                const actual = calc.expense;
                const p = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
                const over = actual - budget;
                return (
                  <>
                    <div className="bar"><i style={{ width: p + "%", background: over > 0 ? "var(--red)" : undefined }} /></div>
                    <div className="goal-meta">
                      <span>本月實際 {money(actual, cur)} / 預算 {money(budget, cur)}</span>
                      <span className="tag">{budget === 0 ? "尚未設定固定支出" : over > 0 ? `超支 ${money(over, cur)}` : `剩餘 ${money(-over, cur)}`}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">固定項目</div><div className="sec-sub">設定一次,每月自動帶入</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>固定收入</div>
                  <MoneyList items={data.recurring.income} accent="var(--green)"
                    onChange={(v) => update({ recurring: { ...data.recurring, income: v } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>固定支出</div>
                  <MoneyList items={data.recurring.expenses} categories={EXPENSE_CATS} accent="var(--red)"
                    onChange={(v) => update({ recurring: { ...data.recurring, expenses: v } })} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">本月變動 · {month}</div><div className="sec-sub">這個月才有的收支</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>額外收入</div>
                  <MoneyList items={calc.m.income} accent="var(--green)"
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, income: v } } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>變動支出</div>
                  <MoneyList items={calc.m.expenses} categories={EXPENSE_CATS} accent="var(--red)"
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, expenses: v } } })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 淨資產 ---------------- */}
        {tab === "淨資產" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-3">
              <Kpi label="總資產" value={money(calc.assets, cur)} tone="pos" />
              <Kpi label="總負債" value={money(calc.liab, cur)} tone="neg" />
              <Kpi label="淨資產" value={money(calc.netWorth, cur)} />
            </div>
            <div className="card glow">
              <div className="sec-h"><div className="sec-t">淨資產走勢</div></div>
              <NetWorthChart hist={calc.histArr} cur={cur} />
            </div>
            <div className="fd-grid cols-2">
              <div className="card">
                <div className="sec-h"><div className="sec-t">資產</div></div>
                <MoneyList items={data.assets} categories={ASSET_TYPES} accent="var(--green)"
                  onChange={(v) => setAssetsLiab("assets", v)} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">負債</div></div>
                <MoneyList items={data.liabilities} accent="var(--red)"
                  onChange={(v) => setAssetsLiab("liabilities", v)} />
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 投資與目標 ---------------- */}
        {tab === "投資與目標" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-2">
              <div className="card glow">
                <div className="sec-h"><div className="sec-t">資產配置</div><div className="sec-sub">{money(calc.invest, cur)}</div></div>
                <AllocChart portfolio={data.portfolio} cur={cur} />
              </div>
              <div className="card">
                <div className="sec-h"><div className="sec-t">持倉</div></div>
                <MoneyList items={data.portfolio} categories={INVEST_CATS} accent="var(--gold2)"
                  onChange={(v) => update({ portfolio: v })} />
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">財務目標</div><div className="sec-sub">依本月結餘自動估算達成時間</div></div>
              {data.goals.map((g) => {
                const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                const remain = Math.max(0, g.target - g.current);
                const months = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
                const eta = months ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return `${d.getFullYear()}年${d.getMonth() + 1}月`; })() : null;
                return (
                  <div key={g.id} style={{ padding: "14px 0", borderBottom: "1px dashed var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 15 }}>{g.label}</span>
                      <button className="del" onClick={() => update({ goals: data.goals.filter((x) => x.id !== g.id) })}>✕</button>
                    </div>
                    <div className="bar"><i style={{ width: p + "%" }} /></div>
                    <div className="goal-meta">
                      <span>{money(g.current, cur)} / {money(g.target, cur)} ({p.toFixed(0)}%)</span>
                      <span className="tag">{remain === 0 ? "已達成 ✦" : months ? `約 ${months} 個月 · ${eta}達成` : "本月無結餘"}</span>
                    </div>
                  </div>
                );
              })}
              <GoalAdder onAdd={(g) => update({ goals: [...data.goals, g] })} />
            </div>
            <div className="note">
              提醒:這裡的投資金額是「現況快照」,你需要手動更新市值。它和「淨資產」分頁是獨立記錄的,
              如果你在資產裡也填了投資,記得別重複計算。投資相關決策請自行評估或諮詢專業人士,這個工具只負責追蹤。
            </div>
          </div>
        )}

        {/* ---------------- 退休 ---------------- */}
        {tab === "退休" && (
          <RetirementView ret={data.retire} cur={cur} calc={calc}
            onChange={(r) => update({ retire: { ...data.retire, ...r } })} />
        )}
      </div>

      {/* floating conversational-fill button */}
      {!chatOpen && (
        <button className="fab" onClick={openQA} aria-label="引導填寫">✦</button>
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
                  <div className="fd-eyebrow">引導填寫</div>
                  <div className="sec-t" style={{ fontSize: 17 }}>{qaDone ? "完成!" : `第 ${qaStep + 1} / ${total} 題`}</div>
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
                        <input className="inp" placeholder="名稱(例如:車貸)" value={qaLabel}
                          onChange={(e) => setQaLabel(e.target.value)} />
                      </div>
                    )}
                    <div className="qa-numwrap">
                      <input className="inp qa-num" type="number" inputMode="numeric" autoFocus
                        placeholder={q.placeholder || "輸入或說出金額"} value={qaVal}
                        onChange={(e) => setQaVal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && nextStep(QUESTIONS)} />
                      <span className="qa-suffix">{q.suffix}</span>
                    </div>
                    {q.multi && (
                      <button className="fd-toolbtn" onClick={() => {
                        const v = Number(qaVal);
                        if (qaVal === "" || isNaN(v) || v <= 0) return;
                        setQaItems((prev) => [...prev, { label: qaLabel.trim() || q.fallbackLabel || "項目", value: Math.round(v) }]);
                        setQaVal(""); setQaLabel("");
                      }}>新增此筆</button>
                    )}
                    <button className={"mic " + (listening ? "on" : "")} onClick={() => startVoice(q)}>
                      <span className="mic-dot" />
                      {listening ? "聆聽中…點此停止" : "🎤 用說的"}
                    </button>
                  </div>
                  {heard && <div className="qa-heard">聽到:「{heard}」</div>}
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
                    {qaStep > 0 && <button className="fd-toolbtn" onClick={backStep}>上一題</button>}
                    <div style={{ flex: 1 }} />
                    {q.optional && <button className="fd-toolbtn" onClick={() => skipStep(QUESTIONS)}>略過</button>}
                    <button className="addbtn" onClick={() => nextStep(QUESTIONS)}>
                      {qaStep + 1 >= total ? "完成" : "下一題"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="qa-body">
                  <div className="qa-q">都填好了 ✦</div>
                  <div className="qa-hint">以下是這次填入的項目,資料已自動儲存。</div>
                  <div className="changed" style={{ marginTop: 14 }}>
                    {qaLog.length === 0
                      ? <span className="qa-hint">這次沒有填入新項目。</span>
                      : qaLog.map((c, j) => <span key={j} className="chip">✓ {c}</span>)}
                  </div>
                  <div className="qa-actions" style={{ marginTop: 22 }}>
                    <button className="fd-toolbtn" onClick={openQA}>再填一輪</button>
                    <div style={{ flex: 1 }} />
                    <button className="addbtn" onClick={() => setChatOpen(false)}>看儀表板</button>
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
                <div className="fd-eyebrow">語音總結</div>
                <div className="sec-t" style={{ fontSize: 17 }}>你的財務故事</div>
              </div>
              <button className="del" style={{ fontSize: 20 }} onClick={closeStory}>✕</button>
            </div>
            <div className="qa-body">
              <div className="story-text">{story}</div>
              <div className="qa-actions" style={{ marginTop: 22 }}>
                <button className={"mic " + (speaking ? "on" : "")} onClick={speaking ? stopStory : speakStory}>
                  <span className="mic-dot" />
                  {speaking ? "朗讀中…點此停止" : "🔊 播放語音"}
                </button>
                <div style={{ flex: 1 }} />
                <button className="addbtn" onClick={closeStory}>關閉</button>
              </div>
              <div className="qa-hint" style={{ marginTop: 12 }}>語音朗讀需瀏覽器支援(建議 Chrome / Safari);內容會隨你的資料即時更新。</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- charts & sub-views ----------------------------- */
function NetWorthChart({ hist, cur }) {
  if (!hist || hist.length < 2)
    return <div className="empty">至少需要兩個月的紀錄才會出現走勢線</div>;
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
          formatter={(v) => [money(v, cur), "淨資產"]} labelStyle={{ color: "#a89f8c" }} />
        <Line type="monotone" dataKey="v" stroke="url(#gld)" strokeWidth={2.5} dot={{ r: 3, fill: "#cdaa6b" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["#cdaa6b", "#85bb9c", "#d68a76", "#9a8fd6", "#6fb0c9", "#d6b85a", "#a89f8c"];
function AllocChart({ portfolio, cur }) {
  const byCat = useMemo(() => {
    const m = {};
    portfolio.forEach((p) => { m[p.category || "其他"] = (m[p.category || "其他"] || 0) + (Number(p.value) || 0); });
    return Object.keys(m).map((k) => ({ name: k, value: m[k] }));
  }, [portfolio]);
  const total = sum(byCat);
  if (byCat.length === 0) return <div className="empty">在右側新增持倉就會出現配置圖</div>;
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
    : { label: "第一桶金", target: 1000000, current: calc.netWorth };
  const remain = Math.max(0, milestone.target - milestone.current);
  const m1 = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
  const boosted = calc.net + calc.income * 0.1;
  const m2 = boosted > 0 ? Math.ceil(remain / boosted) : null;
  const saved = m1 && m2 ? m1 - m2 : 0;
  return (
    <div className="insight">
      {calc.net <= 0 ? (
        <>本月支出大於或等於收入,財富累積的引擎停住了。先從砍掉一兩項<b>固定支出</b>開始 —— 那會每個月持續幫你存下錢。</>
      ) : (
        <>
          以目前每月結餘 <b>{money(calc.net, cur)}</b>(儲蓄率 <b>{calc.rate.toFixed(0)}%</b>),
          距離「{milestone.label}」還需要約 <b>{m1} 個月</b>。
          {saved > 0 && <> 若把儲蓄率再拉高 10%,可以<b>提早 {saved} 個月</b>達標 —— 這就是儲蓄率的威力。</>}
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
      <input className="inp lbl-in" placeholder="目標名稱" value={lbl} onChange={(e) => setLbl(e.target.value)} />
      <input className="inp num-in" type="number" placeholder="目標金額" value={tgt} onChange={(e) => setTgt(e.target.value)} />
      <input className="inp num-in" type="number" placeholder="已存金額" value={cur} onChange={(e) => setCur(e.target.value)} />
      <button className="addbtn" onClick={add}>新增目標</button>
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
        series.push({ age: a, 累積資產: Math.round(proj), 所需金額: Math.round(need) });
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
    { k: "currentAge", label: "目前年齡", suffix: "歲" },
    { k: "retireAge", label: "預計退休年齡", suffix: "歲" },
    { k: "currentSavings", label: "目前退休資產", suffix: cur },
    { k: "monthlyContribution", label: "每月投入", suffix: cur },
    { k: "annualReturn", label: "年化報酬率", suffix: "%" },
    { k: "inflation", label: "通膨率", suffix: "%" },
    { k: "monthlySpend", label: "退休後月支出", suffix: cur, hint: "今日幣值" },
    { k: "withdrawalRate", label: "安全提領率", suffix: "%" },
  ];

  return (
    <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="sec-h">
          <div>
            <div className="sec-t">退休參數</div>
            <div className="sec-sub">{m.yrsLeft > 0 ? `距離退休還有 ${m.yrsLeft} 年` : "請確認年齡設定"}</div>
          </div>
          <button className="fd-toolbtn" onClick={fillNow}>帶入目前數字</button>
        </div>
        <div className="fd-grid cols-4">
          {FIELDS.map((f) => (
            <RetInput key={f.k} label={f.label} suffix={f.suffix} hint={f.hint}
              value={r[f.k]} onChange={set(f.k)} />
          ))}
        </div>
        <div className="note">用「年化報酬率」估算複利成長,用「安全提領率」(4% 法則)反推退休需要的金額,並把月支出按通膨膨脹到退休那年。這些是規劃假設,不是投資建議。</div>
      </div>

      {!m.valid ? (
        <div className="insight">填好<b>年齡</b>、<b>退休年齡</b>與<b>退休後月支出</b>就會開始計算 —— 也可以直接按右上角「帶入目前數字」,用儀表板現有的資料快速試算。</div>
      ) : (
        <>
          <div className="fd-grid cols-4">
            <Kpi label="退休時預計資產" value={money(m.projAtRetire, cur)} />
            <Kpi label="退休所需資產" value={money(m.needAtRetire, cur)} sub="4% 法則 + 通膨" />
            <Kpi label={m.gap >= 0 ? "超前" : "缺口"} value={money(Math.abs(m.gap), cur)} tone={m.gap >= 0 ? "pos" : "neg"} />
            <Kpi label="預估財務自由" value={m.fiAge ? m.fiAge + " 歲" : "需調整"} tone={m.fiAge && m.fiAge <= m.rage ? "pos" : ""} sub={m.fiAge ? `${m.fiAge}歲達標` : "退休前未達標"} />
          </div>

          <div className="card glow">
            <div className="sec-h"><div className="sec-t">資產 vs 所需金額</div><div className="sec-sub">兩線交會 = 財務自由</div></div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={m.series} margin={{ top: 8, right: 10, left: -2, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="age" tickFormatter={(a) => a + "歲"} tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortMoney} tick={{ fill: "#a89f8c", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: "#1f1a14", border: "1px solid rgba(205,170,107,.3)", borderRadius: 10, color: "#f3ecdd" }}
                  formatter={(v, n) => [money(v, cur), n]} labelFormatter={(a) => a + " 歲"} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="累積資產" stroke="#cdaa6b" strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="所需金額" stroke="#85bb9c" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="insight">
            {m.gap >= 0 ? (
              <>以目前每月投入 <b>{money(r.monthlyContribution, cur)}</b> 與 <b>{r.annualReturn}%</b> 年化報酬,你在 <b>{m.rage} 歲</b> 退休時預計累積 <b>{money(m.projAtRetire, cur)}</b>,已超過所需的 {money(m.needAtRetire, cur)}。{m.fiAge && m.fiAge < m.rage && <> 照這條軌跡,你最快 <b>{m.fiAge} 歲</b> 就能達到財務自由 —— 可以考慮提早退休或調低投入。</>}</>
            ) : (
              <>目前軌跡退休時約有 <b>{money(m.projAtRetire, cur)}</b>,距離所需的 {money(m.needAtRetire, cur)} 還差 <b>{money(Math.abs(m.gap), cur)}</b>。要補上缺口,每月需投入到約 <b>{money(r.monthlyContribution + m.extra, cur)}</b>(再多存 {money(m.extra, cur)});或是延後退休年齡、提高報酬率、降低退休後支出。</>
            )}
          </div>
        </>
      )}
    </div>
  );
}
