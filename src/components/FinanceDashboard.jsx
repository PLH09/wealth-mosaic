import React, { useState, useEffect, useMemo, useLayoutEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { STRINGS, VOICE, fonts } from "../i18n.jsx";

/* ----------------------------- persistent storage ----------------------------- */
const KEY = "finance:data:v3";
const TOUR_KEY = "finance:tour:v1";
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

/* ----------------------------- natural voice picker ----------------------------- */
/* Browser TTS sounds robotic with the default voice. We scan the installed
   voices and pick the most natural one for the locale (neural / premium /
   known-good named voices), so the recap sounds closer to a real person. */
const PREF_VOICE = {
  "en-US": ["Samantha", "Ava", "Allison", "Zoe", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Microsoft Ava"],
  "zh-TW": ["Mei-Jia", "Meijia", "美佳", "Google 國語（臺灣）", "Microsoft HsiaoChen", "Microsoft HanHan"],
  "zh-CN": ["Tingting", "Ting-Ting", "婷婷", "Google 普通话（中国大陆）", "Microsoft Xiaoxiao", "Microsoft Yaoyao"],
  "ja-JP": ["Kyoko", "O-ren", "Google 日本語", "Microsoft Nanami", "Microsoft Ayumi"],
  "ko-KR": ["Yuna", "Google 한국의", "Microsoft SunHi", "Microsoft Heami"],
};
const GOOD_VOICE = /natural|neural|premium|enhanced|google|siri/i;
const BAD_VOICE = /compact|eloquence|novelty|comedy|whisper|fred|albert|zarvox|trinoids|cellos|bells|bad|deranged|hysterical|bahh|boing|jester|organ|superstar|wobble/i;
function pickVoice(voices, lang) {
  if (!voices || !voices.length) return null;
  const base = (lang || "en-US").split("-")[0].toLowerCase();
  const prefs = PREF_VOICE[lang] || [];
  const score = (v) => {
    const name = v.name || "";
    const vlang = (v.lang || "").toLowerCase();
    let s;
    if (vlang === lang.toLowerCase()) s = 40;
    else if (vlang.startsWith(base)) s = 20;
    else return -Infinity; // wrong language — never use
    const idx = prefs.findIndex((p) => name.includes(p));
    if (idx >= 0) s += 30 - idx;          // earlier in the preference list = better
    if (GOOD_VOICE.test(name)) s += 15;
    if (BAD_VOICE.test(name)) s -= 60;
    if (v.localService === false) s += 5;  // network voices are usually higher quality
    if (v.default) s += 1;
    return s;
  };
  let best = null, bestScore = -Infinity;
  for (const v of voices) {
    const s = score(v);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}

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
.fd-wrap{max-width:1040px;margin:0 auto;padding:26px 18px 104px;}
.fd-tabnum{font-variant-numeric:tabular-nums;}
.fd-serif{font-family:var(--serif);}
.fd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;
  position:relative;z-index:30;animation:rise .6s ease both;}
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
.srate-top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start;}
.srate-num{font-family:var(--serif);font-size:48px;font-weight:600;line-height:1;}
.srate-word{font-size:13px;font-weight:600;margin-top:7px;}
.srate-rows{flex:1;min-width:230px;}
.srate-track{height:12px;border-radius:999px;background:rgba(42,32,19,.08);overflow:hidden;margin-top:22px;}
.srate-track > i{display:block;height:100%;border-radius:999px;transition:width .7s ease;}
.srate-scale{display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-top:6px;letter-spacing:.04em;}
.bar{height:9px;border-radius:999px;background:rgba(42,32,19,.08);overflow:hidden;margin-top:8px;}
.bar > i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .7s ease;}
.goal-meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-top:7px;}
.tag{font-size:11.5px;color:var(--green);}
.legend{display:flex;flex-direction:column;gap:9px;}
.legi{display:flex;align-items:center;gap:9px;font-size:13px;}
.dot{width:10px;height:10px;border-radius:3px;flex-shrink:0;}
.flowbar{display:flex;height:16px;border-radius:999px;overflow:hidden;background:rgba(42,32,19,.07);margin-top:14px;}
.flowbar > span{height:100%;transition:width .7s ease;min-width:0;}
.flowbar > span:not(:last-child){box-shadow:1px 0 0 rgba(255,254,251,.7);}
.flowleg{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;}
.flowleg .fl{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);}
.flowleg .fl .dot{width:11px;height:11px;border-radius:4px;}
.flowleg .fl .v{font-family:var(--serif);color:var(--ink);font-weight:600;}
.flowleg .fl .pct{color:var(--muted);font-size:12px;}
.nwmix-top{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;}
.nwmix-num{font-family:var(--serif);font-size:40px;font-weight:600;line-height:1;}
.nwmix-ratio{text-align:right;}
.nwmix-rnum{font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);line-height:1;}
.nwmix-cap{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px;}
.insight{border:1px solid var(--line2);background:linear-gradient(180deg,rgba(194,151,47,.07),transparent);
  border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.7;color:var(--text);}
.insight b{color:var(--gold2);font-family:var(--serif);}
.note{font-size:12px;color:var(--dim);line-height:1.6;margin-top:10px;}
.ret-divider{height:1px;background:var(--line);border:0;margin:18px 0 12px;}
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
.fab{touch-action:none;-webkit-user-select:none;user-select:none;}
/* listening state for the single FAB (tap = voice) */
.fab.on{background:rgba(196,92,54,.14);border-color:var(--red);color:var(--red);
  box-shadow:0 12px 30px -8px rgba(196,92,54,.5);animation:pulse 1.1s infinite;}
.vc-toast{position:fixed;right:22px;bottom:92px;z-index:41;max-width:min(320px,calc(100vw - 44px));
  display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none;}
.vc-listening{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--red);
  color:var(--text);border-radius:999px;padding:8px 14px;font-size:13px;box-shadow:0 10px 26px -10px rgba(0,0,0,.5);}
.vc-listening .mic-dot{width:9px;height:9px;border-radius:50%;background:var(--red);animation:pulse 1s infinite;}
.vc-result{background:var(--surface);border:1px solid var(--gold);color:var(--text);border-radius:12px;
  padding:9px 14px;font-size:13.5px;line-height:1.45;box-shadow:0 10px 26px -10px rgba(0,0,0,.5);animation:rise .3s ease both;}
.vc-examples{background:var(--surface);border:1px solid var(--line2);color:var(--muted);border-radius:12px;
  padding:8px 13px;font-size:12.5px;line-height:1.5;max-width:300px;box-shadow:0 10px 26px -10px rgba(0,0,0,.5);}
/* always-visible hint so the single FAB's tap vs long-press is discoverable (incl. on touch) */
.fab-cue{background:var(--surface);border:1px solid var(--line2);color:var(--muted);border-radius:999px;
  padding:7px 13px;font-size:12px;line-height:1.3;box-shadow:0 10px 26px -10px rgba(0,0,0,.5);
  animation:rise .4s ease both;white-space:nowrap;}
.fab-cue b{color:var(--text);font-weight:600;}
/* guided tour */
.tour-root{position:fixed;inset:0;z-index:9000;}
.tour-dim{position:absolute;inset:0;background:rgba(28,22,12,.62);backdrop-filter:blur(2px);animation:fade .25s ease both;}
.tour-spot{position:absolute;border-radius:12px;box-shadow:0 0 0 9999px rgba(28,22,12,.62);
  border:2px solid var(--gold);transition:top .3s cubic-bezier(.4,0,.2,1),left .3s cubic-bezier(.4,0,.2,1),width .3s cubic-bezier(.4,0,.2,1),height .3s cubic-bezier(.4,0,.2,1);pointer-events:none;}
.tour-tip{position:absolute;background:var(--surface);border:1px solid var(--line2);border-radius:14px;
  padding:16px 18px;box-shadow:0 24px 60px -20px rgba(40,30,10,.6);animation:tourPop .25s ease both;}
@keyframes tourPop{from{opacity:0;transform:translateY(6px) scale(.98);}to{opacity:1;transform:none;}}
.tour-no{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold2);font-weight:600;margin-bottom:6px;}
.tour-t{font-family:var(--serif);font-size:17px;font-weight:600;color:var(--ink);margin-bottom:6px;line-height:1.3;}
.tour-b{font-size:13.5px;line-height:1.55;color:var(--muted);}
.tour-dots{display:flex;gap:5px;margin:15px 0 13px;}
.tour-dot{width:6px;height:6px;border-radius:50%;background:var(--line2);transition:.2s;}
.tour-dot.on{background:var(--gold);width:18px;border-radius:3px;}
.tour-acts{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.tour-skip{background:none;border:none;color:var(--dim);font-size:12.5px;cursor:pointer;padding:6px 2px;font-family:var(--sans);}
.tour-skip:hover{color:var(--muted);}
.tour-btn{background:linear-gradient(160deg,var(--gold2),var(--gold));color:#1b1610;border:none;border-radius:9px;
  padding:8px 17px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:.15s;}
.tour-btn:hover{filter:brightness(1.06);}
.tour-btn.ghost{background:none;color:var(--muted);border:1px solid var(--line2);}
.tour-btn.ghost:hover{border-color:var(--gold);color:var(--ink);filter:none;}
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
.quick-mic-row{margin-bottom:18px;padding-bottom:18px;border-bottom:1px dashed var(--line);}
.quick-list{display:flex;flex-direction:column;gap:6px;}
.quick-row{padding:12px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);
  transition:border-color .18s,background .18s,box-shadow .18s;cursor:pointer;}
.quick-row:hover{border-color:var(--line2);}
.quick-row.active{border-color:var(--gold);background:rgba(194,151,47,.08);box-shadow:0 0 0 2px rgba(194,151,47,.18);}
.quick-q{font-size:13.5px;color:var(--text);font-weight:500;margin-bottom:9px;line-height:1.45;}
.quick-opt{font-size:10.5px;color:var(--dim);margin-left:7px;border:1px solid var(--line2);
  border-radius:20px;padding:1px 7px;vertical-align:middle;font-weight:400;}
.quick-fields{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.quick-fields .inp{font-size:15px;padding:10px 12px;}
.quick-fields .qa-num{padding-right:42px!important;}
.more-wrap{position:relative;display:inline-block;}
.more-menu{position:absolute;top:calc(100% + 6px);right:0;min-width:150px;z-index:55;
  display:flex;flex-direction:column;gap:2px;padding:6px;
  background:var(--surface);border:1px solid var(--line2);border-radius:13px;
  box-shadow:0 18px 40px -16px rgba(140,110,40,.5);animation:rise .18s ease both;}
.more-item{display:block;width:100%;text-align:left;background:transparent;border:none;
  color:var(--text);font-family:var(--sans);font-size:13px;font-weight:500;
  padding:9px 11px;border-radius:9px;cursor:pointer;transition:.12s;}
.more-item:hover{background:rgba(194,151,47,.12);color:var(--gold2);}
.more-item.danger{color:var(--red);}
.more-item.danger:hover{background:rgba(196,92,54,.12);color:var(--red);}
.tab-intro-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:-8px 0 18px;}
.tab-intro{font-size:13.5px;color:var(--muted);line-height:1.55;max-width:640px;margin:0;}
.recap-btn{flex:none;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
  font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--gold2);cursor:pointer;
  background:rgba(194,151,47,.1);border:1px solid rgba(194,151,47,.32);
  border-radius:999px;padding:7px 13px;transition:.14s;}
.recap-btn:hover{background:rgba(194,151,47,.18);border-color:rgba(194,151,47,.5);}
.recap-btn.on{color:var(--bg);background:var(--gold);border-color:var(--gold);
  animation:recapPulse 1.3s ease-in-out infinite;}
@keyframes recapPulse{0%,100%{box-shadow:0 0 0 0 rgba(194,151,47,.45);}50%{box-shadow:0 0 0 6px rgba(194,151,47,0);}}
.edit-hint{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gold2);
  background:rgba(194,151,47,.1);border:1px solid rgba(194,151,47,.28);
  border-radius:11px;padding:9px 14px;margin-bottom:16px;animation:rise .25s ease both;}
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

function MoneyList({ items, onChange, categories, valueKey = "value", accent, cur, t, editing }) {
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
  const editItem = (id, patch) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <div>
      {items.length === 0 && <div className="empty">{t.list.empty}</div>}
      {items.map((it) => (
        editing ? (
          <div className="addrow" key={it.id}>
            <input className="inp lbl-in" placeholder={t.list.name} value={it.label}
              onChange={(e) => editItem(it.id, { label: e.target.value })} />
            {categories && (
              <select className="sel" value={it.category || categories[0]}
                onChange={(e) => editItem(it.id, { category: e.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input className="inp num-in" type="number" placeholder={t.list.amount} value={it[valueKey]}
              onChange={(e) => editItem(it.id, { [valueKey]: e.target.value === "" ? "" : Number(e.target.value) })} />
            <button className="del" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
          </div>
        ) : (
          <div className="row" key={it.id}>
            <div className="lbl">
              {it.label}
              {it.category && it.category !== it.label && <span className="cat">{it.category}</span>}
            </div>
            <div className="amt" style={accent ? { color: accent } : null}>{money(it[valueKey], cur)}</div>
            <span />
          </div>
        )
      ))}
      {editing && (
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
      )}
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
  const [quickVals, setQuickVals] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = React.useRef(0);
  const [qaLog, setQaLog] = useState([]);
  const [qaDone, setQaDone] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [speechErr, setSpeechErr] = useState("");
  const recogRef = React.useRef(null);
  // global voice command shares the single recognizer above (recogRef / listening)
  const [vcMsg, setVcMsg] = useState("");
  const [vcHeard, setVcHeard] = useState("");
  const [fabCue, setFabCue] = useState(true); // brief hint explaining the FAB's tap vs long-press
  const vcMsgTimer = React.useRef(null);
  // single FAB: tap = voice, long-press = guided fill
  const fabHoldRef = React.useRef(null);
  const fabLongRef = React.useRef(false);
  const fileRef = React.useRef(null);
  const voicesRef = React.useRef([]);
  const speakCancelRef = React.useRef(false);

  // load installed TTS voices (async on most browsers) so we can pick a natural one
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() || []; };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => { try { window.speechSynthesis.removeEventListener?.("voiceschanged", load); } catch { /* noop */ } };
  }, []);
  const [speaking, setSpeaking] = useState(false);

  // stop any running narration when the section (tab) changes
  useEffect(() => {
    speakCancelRef.current = true;
    try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* noop */ }
    setSpeaking(false);
  }, [tab]);

  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = React.useRef(null);
  const [tourOpen, setTourOpen] = useState(false);

  // auto-open the guided tour on a visitor's first ever visit
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_KEY)) {
        const id = setTimeout(() => setTourOpen(true), 650);
        return () => clearTimeout(id);
      }
    } catch { /* ignore */ }
  }, []);
  const closeTour = () => {
    setTourOpen(false);
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch { /* ignore */ }
  };

  // close the "More" menu on outside click / Esc
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

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

  // auto-dismiss the FAB tap/hold hint after a few seconds
  useEffect(() => {
    if (!fabCue) return;
    const id = setTimeout(() => setFabCue(false), 9000);
    return () => clearTimeout(id);
  }, [fabCue]);

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

  // ---- guided fill (single fill-in-the-blank form) ----
  const blankQuick = () => QUESTIONS.map(() => ({ val: "", label: "", items: [] }));

  const setActive = (i) => { activeIdxRef.current = i; setActiveIdx(i); };

  const openQA = () => {
    stopVoice();
    setQuickVals(blankQuick());
    setActive(0); setQaLog([]); setQaDone(false);
    setHeard(""); setSpeechErr(""); setChatOpen(true);
  };

  const stopVoice = () => {
    try { recogRef.current && recogRef.current.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const setQuick = (i, patch) => {
    setQuickVals((prev) => {
      const base = prev.length ? prev : blankQuick();
      const next = base.slice();
      next[i] = { ...(next[i] || { val: "", label: "", items: [] }), ...patch };
      return next;
    });
  };

  // advance the active blank to the next question (or stop at the end)
  const advanceActive = (from) => {
    const nextIdx = from + 1;
    if (nextIdx < QUESTIONS.length) setActive(nextIdx);
    else { setActive(QUESTIONS.length - 1); stopVoice(); }
  };

  // parse one finalized utterance into the currently-active blank, then advance
  const fillFromSpeech = (txt) => {
    if (!voice) return;
    const P = voice.parser;
    const i = activeIdxRef.current;
    const q = QUESTIONS[i];
    if (!q) return;
    if (q.multi) {
      const items = P.splitMultiLabelAmount(txt);
      if (items.length) {
        const fb = q.fallbackLabel || t.fallbackItem;
        const mapped = items.map((it) => ({ label: it.label || fb, value: it.value }));
        setQuickVals((prev) => {
          const base = prev.length ? prev : blankQuick();
          const next = base.slice();
          const cur0 = next[i] || { val: "", label: "", items: [] };
          next[i] = { ...cur0, items: [...(cur0.items || []), ...mapped] };
          return next;
        });
        advanceActive(i);
      } else if (q.optional && P.isNoneAnswer(txt)) advanceActive(i);
      else setSpeechErr(t.speechMultiFail(txt));
    } else if (q.withLabel) {
      const { label, amount } = P.splitLabelAmount(txt);
      const patch = {};
      if (label) patch.label = label;
      if (!isNaN(amount)) patch.val = String(Math.round(amount));
      if (patch.label || patch.val) { setQuick(i, patch); advanceActive(i); }
      else if (q.optional && P.isNoneAnswer(txt)) advanceActive(i);
      else setSpeechErr(t.speechSingleFail(txt));
    } else {
      const n = P.parseSpoken(txt);
      if (!isNaN(n)) { setQuick(i, { val: String(Math.round(n)) }); advanceActive(i); }
      else if (q.optional && P.isNoneAnswer(txt)) advanceActive(i);
      else setSpeechErr(t.speechSingleFail(txt));
    }
  };

  const flashVcMsg = (msg) => {
    setVcMsg(msg);
    if (vcMsgTimer.current) clearTimeout(vcMsgTimer.current);
    vcMsgTimer.current = setTimeout(() => setVcMsg(""), 4200);
  };

  // route an error to wherever the mic was started from
  const voiceErr = (msg) => { if (chatOpen) setSpeechErr(msg); else flashVcMsg(msg); };

  // one finalized utterance: fill the active blank inside guided-fill,
  // otherwise treat it as a global voice command (works on any tab, no edit mode)
  const onVoiceFinal = (txt) => {
    if (chatOpen && !qaDone) { setSpeechErr(""); fillFromSpeech(txt); return; }
    const cmd = voice.parser.parseCommand(txt);
    if (cmd) { applyVoiceCommand(cmd); setVcHeard(""); }
    else flashVcMsg(t.vcUnrecognized(txt));
  };

  // single continuous mic shared by guided-fill and global commands
  const startVoice = () => {
    if (!voice) return;
    if (listening) { stopVoice(); return; }
    setSpeechErr("");
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { voiceErr(t.speechNoSupport); return; }
    let rec;
    try { rec = new SR(); } catch { voiceErr(t.speechCantStart); return; }
    rec.lang = voice.lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    recogRef.current = rec;
    setHeard(""); setVcHeard("");
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (chatOpen && !qaDone) setHeard(txt); else setVcHeard(txt);
        if (r.isFinal) onVoiceFinal(txt.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setListening(false); voiceErr(t.speechBlocked); }
      else if (e.error === "no-speech") { /* keep listening in continuous mode */ }
      else if (chatOpen) setSpeechErr(t.speechStopped);
    };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch { voiceErr(t.speechCantStart); }
  };

  // single FAB gesture: short tap starts voice, long-press opens guided fill
  const fabPressStart = () => {
    setFabCue(false);
    fabLongRef.current = false;
    fabHoldRef.current = setTimeout(() => {
      fabHoldRef.current = null;
      fabLongRef.current = true;
      openQA();
    }, 500);
  };
  const fabPressEnd = () => {
    if (fabHoldRef.current) { clearTimeout(fabHoldRef.current); fabHoldRef.current = null; }
    if (fabLongRef.current) { fabLongRef.current = false; return; }
    startVoice();
  };
  const fabPressCancel = () => {
    if (fabHoldRef.current) { clearTimeout(fabHoldRef.current); fabHoldRef.current = null; }
    fabLongRef.current = false;
  };

  // apply a parsed "add" command into the right data bucket
  const applyVoiceCommand = (cmd) => {
    if (cmd.action === "nav") {
      setTab(cmd.tab);
      flashVcMsg(t.vcNav((TABS.find((x) => x.key === cmd.tab) || {}).label || cmd.tab));
      return;
    }
    if (cmd.action === "unknown") { flashVcMsg(t.vcNoBucket); return; }
    if (cmd.action !== "add" || !cmd.items || !cmd.items.length) return;
    const mk = (it, cat) => ({ id: uid(), label: (it.label || "").trim() || t.fallbackItem, value: it.value, ...(cat ? { category: cat } : {}) });
    const n = cmd.items.length;
    update((prev) => {
      const d = { ...prev };
      if (cmd.bucket === "recurring_income") d.recurring = { ...d.recurring, income: [...d.recurring.income, ...cmd.items.map((it) => mk(it))] };
      else if (cmd.bucket === "recurring_expense") d.recurring = { ...d.recurring, expenses: [...d.recurring.expenses, ...cmd.items.map((it) => mk(it, EXPENSE_CATS[6]))] };
      else if (cmd.bucket === "month_income" || cmd.bucket === "month_expense") {
        const cur0 = d.months[month] || { income: [], expenses: [] };
        const m = { income: [...(cur0.income || [])], expenses: [...(cur0.expenses || [])] };
        if (cmd.bucket === "month_income") m.income.push(...cmd.items.map((it) => mk(it)));
        else m.expenses.push(...cmd.items.map((it) => mk(it, EXPENSE_CATS[6])));
        d.months = { ...d.months, [month]: m };
      }
      else if (cmd.bucket === "asset") d.assets = [...d.assets, ...cmd.items.map((it) => mk(it, ASSET_TYPES[4]))];
      else if (cmd.bucket === "liability") d.liabilities = [...d.liabilities, ...cmd.items.map((it) => mk(it))];
      else if (cmd.bucket === "portfolio") d.portfolio = [...d.portfolio, ...cmd.items.map((it) => mk(it, INVEST_CATS[6]))];
      return d;
    });
    // jump to the tab that shows what was just added, so the change is visible
    const tabFor = { recurring_income: "cashflow", recurring_expense: "cashflow", month_income: "cashflow", month_expense: "cashflow", asset: "overview", liability: "overview", portfolio: "invest" };
    if (tabFor[cmd.bucket]) setTab(tabFor[cmd.bucket]);
    flashVcMsg(t.vcAdded(t.vcBuckets[cmd.bucket] || "", n));
  };

  // commit every filled blank at once
  const applyQuick = () => {
    stopVoice();
    const upd = { recurring_income: [], recurring_expenses: [], assets: [], liabilities: [], portfolio: [], retire: {} };
    QUESTIONS.forEach((q, i) => {
      const qv = quickVals[i] || { val: "", label: "", items: [] };
      const tg = q.target;
      if (q.multi) {
        const items = [...(qv.items || [])];
        const typed = Number(qv.val);
        if (qv.val !== "" && !isNaN(typed) && typed > 0)
          items.push({ label: (qv.label || "").trim() || q.fallbackLabel || t.fallbackItem, value: Math.round(typed) });
        if (!items.length) return;
        if (tg.type === "recurring_income") upd.recurring_income.push(...items.map((it) => ({ label: it.label, value: it.value })));
        else if (tg.type === "recurring_expense") upd.recurring_expenses.push(...items.map((it) => ({ label: it.label, value: it.value, category: tg.category || EXPENSE_CATS[6] })));
        else if (tg.type === "asset") upd.assets.push(...items.map((it) => ({ label: it.label, value: it.value, category: tg.assetType || ASSET_TYPES[4] })));
        else if (tg.type === "portfolio") upd.portfolio.push(...items.map((it) => ({ label: it.label, value: it.value, category: tg.category || INVEST_CATS[6] })));
        else if (tg.type === "liability") upd.liabilities.push(...items.map((it) => ({ label: it.label, value: it.value })));
        return;
      }
      const val = Number(qv.val);
      if (qv.val === "" || isNaN(val) || val === 0) return;
      const label = tg.label || (qv.label || "").trim() || q.fallbackLabel || t.fallbackItem;
      if (tg.type === "retire") upd.retire[tg.key] = val;
      else if (tg.type === "recurring_income") upd.recurring_income.push({ label, value: val });
      else if (tg.type === "recurring_expense") upd.recurring_expenses.push({ label, value: val, category: tg.category || EXPENSE_CATS[6] });
      else if (tg.type === "asset") upd.assets.push({ label, value: val, category: tg.assetType || ASSET_TYPES[4] });
      else if (tg.type === "portfolio") upd.portfolio.push({ label, value: val, category: tg.category || INVEST_CATS[6] });
      else if (tg.type === "liability") upd.liabilities.push({ label, value: val });
    });
    const changed = applyUpdates(upd);
    setQaLog(changed);
    setQaDone(true);
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

  // ---- per-section voice summary ----
  // each tab speaks its own short recap (replaces the old global "voice recap")
  const recapText = t.recap ? t.recap(tab, calc, data, H) : "";

  const stopSpeak = () => {
    speakCancelRef.current = true; // guard so chained sentences don't keep playing
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* no-op */ }
    setSpeaking(false);
  };
  const speak = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      alert(t.speechUnsupported);
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    speakCancelRef.current = false;

    const voice = pickVoice(voicesRef.current, t.voiceLang);
    // Split into sentences so each gets a natural cadence + slight pause between
    // them. Latin "." only splits when followed by space, so decimals like "1.2"
    // and amounts stay intact; CJK enders 。！？ split directly.
    const chunks = String(text)
      .replace(/\s+/g, " ")
      .split(/(?<=[。！？])\s*|(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!chunks.length) chunks.push(String(text));

    setSpeaking(true);
    let i = 0;
    const speakNext = () => {
      if (speakCancelRef.current || i >= chunks.length) { setSpeaking(false); return; }
      const u = new window.SpeechSynthesisUtterance(chunks[i++]);
      u.lang = t.voiceLang;
      if (voice) u.voice = voice;
      u.rate = 0.95;   // a touch slower reads more human than the default 1.0
      u.pitch = 1.02;  // very slight lift avoids a flat, robotic tone
      u.onend = speakNext;
      u.onerror = () => { if (!speakCancelRef.current) setSpeaking(false); };
      synth.speak(u);
    };
    speakNext();
  };

  // wealth-velocity insight values
  const milestone = data.goals.length
    ? data.goals.reduce((a, b2) => (b2.target - b2.current < a.target - a.current && b2.target > b2.current ? b2 : a))
    : { label: t.defaultMilestone.label, target: t.defaultMilestone.target, current: calc.netWorth };
  const iRemain = Math.max(0, milestone.target - milestone.current);
  const iM1 = calc.net > 0 ? Math.ceil(iRemain / calc.net) : null;
  const iBoosted = calc.net + calc.income * 0.1;
  const iM2 = iBoosted > 0 ? Math.ceil(iRemain / iBoosted) : null;
  const iSaved = iM1 && iM2 ? iM1 - iM2 : 0;
  const isEmptyData = calc.income === 0 && calc.expense === 0 && calc.assets === 0 && calc.liab === 0 && data.goals.length === 0;
  const insightVals = { empty: isEmptyData, stalled: calc.net <= 0, net: calc.net, rate: calc.rate, milestoneLabel: milestone.label, m1: iM1, saved: iSaved };

  const TABS = [
    { key: "overview", label: t.tabs.overview },
    { key: "cashflow", label: t.tabs.cashflow },
    { key: "invest", label: t.tabs.invest },
    { key: "retire", label: t.tabs.retire },
  ];

  // header headline number is contextual to the active tab (avoids two
  // competing big figures on tabs that have their own headline metric)
  const headStat =
    tab === "cashflow" ? { label: t.monthlySurplus, value: calc.net } :
    tab === "invest" ? { label: t.invKpiTotal, value: calc.invest } :
    { label: t.netLabel, value: calc.netWorth };

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
            <div className="fd-net-label">{headStat.label}</div>
            <div className={"fd-net fd-tabnum " + (headStat.value >= 0 ? "" : "neg")}>{money(headStat.value, cur)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className={"fd-toolbtn" + (editing ? " gold" : "")} onClick={() => setEditing((v) => !v)}>{editing ? t.btnDone : t.btnEdit}</button>
              <div className="more-wrap" ref={moreRef}>
                <button className="fd-toolbtn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>{t.btnMore}</button>
                {moreOpen && (
                  <div className="more-menu" role="menu">
                    <button className="more-item" role="menuitem" onClick={() => { setMoreOpen(false); setTourOpen(true); }}>{t.tour.menu}</button>
                    <button className="more-item" role="menuitem" onClick={() => { exportData(); setMoreOpen(false); }}>{t.btnExport}</button>
                    <button className="more-item" role="menuitem" onClick={() => { fileRef.current && fileRef.current.click(); setMoreOpen(false); }}>{t.btnImport}</button>
                    <button className="more-item danger" role="menuitem" onClick={() => { setMoreOpen(false); if (confirm(t.clearConfirm)) update({ ...DEFAULT }); }}>{t.btnClear}</button>
                  </div>
                )}
              </div>
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

        {/* plain-language intro for the current tab + its voice summary */}
        <div className="tab-intro-row">
          {t.tabIntro && t.tabIntro[tab] && <div className="tab-intro">{t.tabIntro[tab]}</div>}
          {recapText && (
            <button
              className={"recap-btn " + (speaking ? "on" : "")}
              onClick={speaking ? stopSpeak : () => speak(recapText)}
              title={t.recapHint}
            >{speaking ? t.speakingStop : t.btnRecap}</button>
          )}
        </div>

        {/* edit-mode banner */}
        {editing && <div className="edit-hint">{t.editingHint}</div>}

        {/* ---------------- Overview ---------------- */}
        {tab === "overview" && (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-2">
              <Kpi label={t.kNetWorth} value={money(calc.netWorth, cur)} tone={calc.netWorth >= 0 ? "pos" : "neg"} sub={`${t.totalAssets} ${cur} ${t.short(calc.assets)}`} />
              {(() => {
                const dr = calc.assets > 0 ? Math.round((calc.liab / calc.assets) * 100) : 0;
                return <Kpi label={t.debtRatio} value={dr + "%"} tone={dr === 0 ? "pos" : dr <= 50 ? "" : "neg"} sub={`${t.totalDebt} ${cur} ${t.short(calc.liab)}`} />;
              })()}
            </div>

            {/* net worth: composition bar + trend, unified */}
            <div className="card glow">
              {(() => {
                const a = calc.assets, l = calc.liab, nw = calc.netWorth;
                const basis = Math.max(1, a, l);
                const segs = nw >= 0
                  ? [
                      { key: "nw", label: t.kNetWorth, val: nw, color: "#3c8a5f" },
                      { key: "liab", label: t.secLiabilities, val: l, color: "#c45c36" },
                    ]
                  : [
                      { key: "asset", label: t.secAssets, val: a, color: "#3c8a5f" },
                      { key: "neg", label: t.netWorthNegative, val: -nw, color: "#b03b2e" },
                    ];
                return (
                  <>
                    <div className="sec-h">
                      <div><div className="sec-t">{t.secNetWorthMix}</div><div className="sec-sub">{t.netWorthMixSub}</div></div>
                    </div>
                    <div className="flowbar">
                      {segs.filter((s) => s.val > 0).map((s) => (
                        <span key={s.key} title={s.label} style={{ width: (s.val / basis) * 100 + "%", background: s.color }} />
                      ))}
                    </div>
                    <div className="flowleg">
                      <div className="fl"><span className="dot" style={{ background: "#3c8a5f" }} /><span>{t.kNetWorth}</span><span className="v fd-tabnum">{money(nw, cur)}</span></div>
                      <div className="fl"><span className="dot" style={{ background: "#c45c36" }} /><span>{t.totalDebt}</span><span className="v fd-tabnum">{money(l, cur)}</span></div>
                      <div className="fl"><span className="dot" style={{ background: "rgba(42,32,19,.22)" }} /><span>{t.totalAssets}</span><span className="v fd-tabnum">{money(a, cur)}</span></div>
                    </div>
                  </>
                );
              })()}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
                <div className="kpi-l" style={{ marginBottom: 12 }}>{t.secNetWorthTrend}</div>
                <NetWorthChart hist={calc.histArr} cur={cur} t={t} />
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secBalanceSheet}</div></div>
              {(() => {
                const cats = new Set(data.assets.map((e) => e.category || ASSET_TYPES[ASSET_TYPES.length - 1]));
                if (data.assets.length === 0 || cats.size < 2) return null;
                return (
                  <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px dashed var(--line)" }}>
                    <div className="kpi-l" style={{ marginBottom: 12 }}>{t.assetMixLabel}</div>
                    <CategoryDonut items={data.assets} cur={cur} t={t} fallback={ASSET_TYPES[ASSET_TYPES.length - 1]} />
                  </div>
                );
              })()}
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.secAssets}</div>
                  <MoneyList items={data.assets} categories={ASSET_TYPES} accent="var(--green)" cur={cur} t={t} editing={editing}
                    onChange={(v) => setAssetsLiab("assets", v)} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.secLiabilities}</div>
                  <MoneyList items={data.liabilities} accent="var(--red)" cur={cur} t={t} editing={editing}
                    onChange={(v) => setAssetsLiab("liabilities", v)} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secFinancialGoals}</div><div className="sec-sub">{t.goalsSub}</div></div>
              {data.goals.length === 0 && <div className="empty">{t.noGoals}</div>}
              {data.goals.map((g) => {
                const p = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
                const remain = Math.max(0, g.target - g.current);
                const months = calc.net > 0 ? Math.ceil(remain / calc.net) : null;
                const eta = months ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return t.etaMonthYear(d); })() : null;
                const editGoal = (patch) => update({ goals: data.goals.map((x) => (x.id === g.id ? { ...x, ...patch } : x)) });
                return (
                  <div key={g.id} style={{ padding: "14px 0", borderBottom: "1px dashed var(--line)" }}>
                    {editing ? (
                      <>
                        <div className="addrow">
                          <input className="inp lbl-in" placeholder={t.list.name} value={g.label}
                            onChange={(e) => editGoal({ label: e.target.value })} />
                          <button className="del" onClick={() => update({ goals: data.goals.filter((x) => x.id !== g.id) })}>✕</button>
                        </div>
                        <div className="addrow" style={{ marginTop: 8 }}>
                          <input className="inp num-in" style={{ flex: 1 }} type="number" placeholder={t.goalSavedPH}
                            value={g.current} onChange={(e) => editGoal({ current: e.target.value === "" ? "" : Number(e.target.value) })} />
                          <span style={{ color: "var(--dim)", alignSelf: "center" }}>/</span>
                          <input className="inp num-in" style={{ flex: 1 }} type="number" placeholder={t.goalTargetPH}
                            value={g.target} onChange={(e) => editGoal({ target: e.target.value === "" ? "" : Number(e.target.value) })} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 15 }}>{g.label}</span>
                        </div>
                        <div className="bar"><i style={{ width: p + "%" }} /></div>
                        <div className="goal-meta">
                          <span>{money(g.current, cur)} / {money(g.target, cur)} ({p.toFixed(0)}%)</span>
                          <span className="tag">{remain === 0 ? t.goalReached : months ? t.goalEta(months, eta) : t.goalNoSurplus}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {editing && <GoalAdder onAdd={(g) => update({ goals: [...data.goals, g] })} t={t} />}
            </div>

            <div className="insight">{t.insight(insightVals, H)}</div>
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
              {(() => {
                const r = calc.rate;
                const tone = r < 0 ? "#c45c36" : r >= 20 ? "#3c8a5f" : "#c2972f";
                const word = r >= 30 ? t.srExcellent : r >= 20 ? t.srHealthy : r >= 0 ? t.srImprove : t.srOver;
                const fill = Math.max(0, Math.min(100, r));
                return (
                  <>
                    <div className="srate-top">
                      <div>
                        <div className="srate-num fd-tabnum" style={{ color: tone }}>{r.toFixed(0)}%</div>
                        <div className="srate-word" style={{ color: tone }}>{word}</div>
                      </div>
                      <div className="srate-rows">
                        <div className="row"><span className="lbl">{t.totalIncome}</span><span className="amt pos">{money(calc.income, cur)}</span><span /></div>
                        <div className="row"><span className="lbl">{t.totalSpending}</span><span className="amt neg">{money(calc.expense, cur)}</span><span /></div>
                        <div className="row"><span className="lbl" style={{ fontWeight: 700 }}>{t.monthlySurplus}</span><span className={"amt " + (calc.net >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>{money(calc.net, cur)}</span><span /></div>
                      </div>
                    </div>
                    <div className="srate-track"><i style={{ width: fill + "%", background: tone }} /></div>
                    <div className="srate-scale"><span>0%</span><span>50%</span><span>100%</span></div>
                  </>
                );
              })()}
            </div>

            {/* income-flow visualization: where this month's income goes */}
            <div className="card">
              <div className="sec-h"><div><div className="sec-t">{t.secIncomeFlow}</div><div className="sec-sub">{t.incomeFlowSub}</div></div></div>
              {(() => {
                const fixed = Math.max(0, calc.expFixed);
                const variable = Math.max(0, calc.expense - calc.expFixed);
                const saved = calc.net;
                const basis = Math.max(1, saved >= 0 ? calc.income : calc.expense);
                const segs = [
                  { key: "fixed", label: t.recurringExpenses, val: fixed, color: "#c45c36" },
                  { key: "var", label: t.variableSpending, val: variable, color: "#dba84e" },
                  saved >= 0
                    ? { key: "saved", label: t.monthlySurplus, val: saved, color: "#3c8a5f" }
                    : { key: "deficit", label: t.flowDeficit, val: -saved, color: "#b03b2e" },
                ];
                return (
                  <>
                    <div className="flowbar">
                      {segs.filter((s) => s.val > 0).map((s) => (
                        <span key={s.key} title={s.label} style={{ width: (s.val / basis) * 100 + "%", background: s.color }} />
                      ))}
                    </div>
                    <div className="flowleg">
                      {segs.map((s) => (
                        <div className="fl" key={s.key}>
                          <span className="dot" style={{ background: s.color }} />
                          <span>{s.label}</span>
                          <span className="v fd-tabnum">{money(s.val, cur)}</span>
                          <span className="pct fd-tabnum">{Math.round((s.val / basis) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* spending breakdown by category */}
            {(() => {
              const exp = [...data.recurring.expenses, ...calc.m.expenses];
              const cats = new Set(exp.map((e) => e.category || EXPENSE_CATS[6]));
              if (exp.length === 0 || cats.size < 2) return null;
              const byCat = {};
              exp.forEach((e) => { const k = e.category || EXPENSE_CATS[6]; byCat[k] = (byCat[k] || 0) + (Number(e.value) || 0); });
              const totalExp = Object.values(byCat).reduce((a, b) => a + b, 0);
              const topCat = Object.keys(byCat).reduce((a, b) => (byCat[b] > (byCat[a] || 0) ? b : a), null);
              const topCatPct = topCat && totalExp > 0 ? Math.round((byCat[topCat] / totalExp) * 100) : 0;
              return (
                <div className="card">
                  <div className="sec-h"><div><div className="sec-t">{t.secExpenseMix}</div><div className="sec-sub">{t.expenseMixSub}</div></div></div>
                  <CategoryDonut items={exp} cur={cur} t={t} />
                  {topCat && totalExp > 0 && (
                    <div className="insight" style={{ marginTop: 14 }}>{t.topSpendInsight(topCat, topCatPct)}</div>
                  )}
                </div>
              );
            })()}

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secRecurring}</div><div className="sec-sub">{t.recurringSub}</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.recurringIncome}</div>
                  <MoneyList items={data.recurring.income} accent="var(--green)" cur={cur} t={t} editing={editing}
                    onChange={(v) => update({ recurring: { ...data.recurring, income: v } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.recurringExpenses}</div>
                  <MoneyList items={data.recurring.expenses} categories={EXPENSE_CATS} accent="var(--red)" cur={cur} t={t} editing={editing}
                    onChange={(v) => update({ recurring: { ...data.recurring, expenses: v } })} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sec-h"><div className="sec-t">{t.secThisMonth(month)}</div><div className="sec-sub">{t.thisMonthSub}</div></div>
              <div className="fd-grid cols-2">
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.extraIncome}</div>
                  <MoneyList items={calc.m.income} accent="var(--green)" cur={cur} t={t} editing={editing}
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, income: v } } })} />
                </div>
                <div>
                  <div className="kpi-l" style={{ marginBottom: 6 }}>{t.variableSpending}</div>
                  <MoneyList items={calc.m.expenses} categories={EXPENSE_CATS} accent="var(--red)" cur={cur} t={t} editing={editing}
                    onChange={(v) => update({ months: { ...data.months, [month]: { ...calc.m, expenses: v } } })} />
                </div>
              </div>
              {(() => {
                const cats = new Set(calc.m.expenses.map((e) => e.category || EXPENSE_CATS[6]));
                if (calc.m.expenses.length === 0 || cats.size < 2) return null;
                return (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
                    <div className="kpi-l" style={{ marginBottom: 12 }}>{t.variableMix}</div>
                    <CategoryDonut items={calc.m.expenses} cur={cur} t={t} />
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ---------------- Investments & Goals ---------------- */}
        {tab === "invest" && (() => {
          const allocCats = new Set(data.portfolio.map((p) => p.category || INVEST_CATS[6])).size;
          const showAlloc = allocCats >= 2;
          const share = calc.assets > 0 ? Math.min(100, Math.round((calc.invest / calc.assets) * 100)) : 0;
          const top = data.portfolio.reduce((a, b) => ((Number(b.value) || 0) > (Number(a?.value) || 0) ? b : a), null);
          const topPct = top && calc.invest > 0 ? Math.round(((Number(top.value) || 0) / calc.invest) * 100) : 0;
          return (
          <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
            <div className="fd-grid cols-3">
              <Kpi label={t.invKpiTotal} value={money(calc.invest, cur)} tone="pos" />
              <Kpi label={t.invKpiShare} value={share + "%"} sub={t.invKpiShareSub(cur + " " + t.short(calc.assets))} />
              <Kpi label={t.invKpiTop} value={top ? topPct + "%" : t.invKpiTopNone}
                sub={top ? top.label : undefined} tone={topPct > 60 ? "neg" : ""} />
            </div>
            <div className={"fd-grid " + (showAlloc ? "cols-2" : "")}>
              {showAlloc && (
                <div className="card glow">
                  <div className="sec-h"><div className="sec-t">{t.secAllocation}</div><div className="sec-sub">{money(calc.invest, cur)}</div></div>
                  <AllocChart portfolio={data.portfolio} cur={cur} t={t} />
                </div>
              )}
              <div className="card">
                <div className="sec-h"><div className="sec-t">{t.secHoldings}</div><div className="sec-sub">{money(calc.invest, cur)}</div></div>
                <MoneyList items={data.portfolio} categories={INVEST_CATS} accent="var(--gold2)" cur={cur} t={t} editing={editing}
                  onChange={(v) => update({ portfolio: v })} />
              </div>
            </div>

            <div className="note">{t.investNote}</div>
          </div>
          );
        })()}

        {/* ---------------- Retirement ---------------- */}
        {tab === "retire" && (
          <RetirementView ret={data.retire} cur={cur} calc={calc} t={t} H={H}
            onChange={(r) => update({ retire: { ...data.retire, ...r } })} />
        )}
      </div>

      {/* single floating action button (kept visible during the tour so it can be highlighted).
          With voice: tap = speak a command, long-press = guided fill. Without voice: tap = guided fill. */}
      {!chatOpen && (
        voice ? (
          <button
            className={"fab " + (listening ? "on" : "")}
            onPointerDown={fabPressStart}
            onPointerUp={fabPressEnd}
            onPointerLeave={fabPressCancel}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t.vcTitle}
            title={t.fabHint}
          >🎙️</button>
        ) : (
          <button className="fab" onClick={openQA} aria-label={t.guidedTitle}>✦</button>
        )
      )}

      {/* voice-command live transcript + result toast, plus idle tap/hold cue */}
      {voice && (listening || vcMsg || fabCue) && !chatOpen && (
        <div className="vc-toast">
          {listening && <div className="vc-listening"><span className="mic-dot" />{vcHeard ? t.heard(vcHeard) : t.vcListening}</div>}
          {listening && !vcHeard && <div className="vc-examples">{t.vcExamples}</div>}
          {vcMsg && <div className="vc-result">{vcMsg}</div>}
          {!listening && !vcMsg && fabCue && (
            <div className="fab-cue" dangerouslySetInnerHTML={{ __html: t.fabCue }} />
          )}
        </div>
      )}

      {/* guided product tour (spotlight) */}
      {tourOpen && <Tour t={t} onClose={closeTour} />}

      {/* guided fill modal — single fill-in-the-blank form */}
      {chatOpen && (() => {
        const total = QUESTIONS.length;
        const isFilled = (q, v) => {
          if (!v) return false;
          if (q.multi) return (v.items && v.items.length > 0) || (v.val !== "" && Number(v.val) > 0);
          return v.val !== "" && !isNaN(Number(v.val)) && Number(v.val) !== 0;
        };
        const filledCount = QUESTIONS.reduce((n, q, i) => n + (isFilled(q, quickVals[i]) ? 1 : 0), 0);
        const pct = qaDone ? 100 : Math.round((filledCount / total) * 100);
        return (
          <div className="modal-bg" onClick={() => { stopVoice(); setChatOpen(false); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h">
                <div>
                  <div className="fd-eyebrow">{t.guidedTitle}</div>
                  <div className="sec-t" style={{ fontSize: 17 }}>{qaDone ? t.qDone : t.quickSubtitle}</div>
                </div>
                <button className="del" style={{ fontSize: 20 }} onClick={() => { stopVoice(); setChatOpen(false); }}>✕</button>
              </div>
              <div className="qa-prog"><i style={{ width: pct + "%" }} /></div>

              {!qaDone ? (
                <div className="qa-body">
                  <div className="qa-hint" style={{ marginBottom: 4 }}>{t.quickAppendNote}</div>
                  {voice && (
                    <div className="quick-mic-row">
                      <button className={"mic " + (listening ? "on" : "")} onClick={startVoice}>
                        <span className="mic-dot" />
                        {listening ? t.quickListening : t.quickStart}
                      </button>
                      <div className="qa-hint" style={{ marginTop: 8 }}>{t.quickHint}</div>
                      {heard && <div className="qa-heard">{t.heard(heard)}</div>}
                      {speechErr && <div className="qa-err">{speechErr}</div>}
                    </div>
                  )}
                  <div className="quick-list">
                    {QUESTIONS.map((q, i) => {
                      const qv = quickVals[i] || { val: "", label: "", items: [] };
                      const active = i === activeIdx && listening;
                      return (
                        <div key={i} className={"quick-row" + (active ? " active" : "")} onClick={() => setActive(i)}>
                          <div className="quick-q">{q.q}{q.optional && <span className="quick-opt">{t.quickOptional}</span>}</div>
                          <div className="quick-fields">
                            {q.withLabel && (
                              <input className="inp" placeholder={t.namePH} value={qv.label}
                                onFocus={() => setActive(i)}
                                onChange={(e) => setQuick(i, { label: e.target.value })} />
                            )}
                            <div className="qa-numwrap" style={{ flex: q.withLabel ? "0 0 132px" : 1 }}>
                              <input className="inp qa-num" type="number" inputMode="numeric"
                                placeholder={q.placeholder || t.amountPH} value={qv.val}
                                onFocus={() => setActive(i)}
                                onChange={(e) => setQuick(i, { val: e.target.value })} />
                              <span className="qa-suffix">{q.suffix}</span>
                            </div>
                            {q.multi && (
                              <button className="fd-toolbtn" onClick={(e) => {
                                e.stopPropagation();
                                const v = Number(qv.val);
                                if (qv.val === "" || isNaN(v) || v <= 0) return;
                                setQuick(i, { items: [...(qv.items || []), { label: (qv.label || "").trim() || q.fallbackLabel || t.fallbackItem, value: Math.round(v) }], val: "", label: "" });
                              }}>{t.addThis}</button>
                            )}
                          </div>
                          {q.multi && qv.items && qv.items.length > 0 && (
                            <div className="changed" style={{ marginTop: 8 }}>
                              {qv.items.map((it, j) => (
                                <span key={j} className="chip">
                                  {it.label} {money(it.value, cur)}
                                  <button className="del" style={{ marginLeft: 6 }}
                                    onClick={(e) => { e.stopPropagation(); setQuick(i, { items: qv.items.filter((_, k) => k !== j) }); }}>✕</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="qa-actions">
                    <div style={{ flex: 1 }} />
                    <button className="addbtn" onClick={applyQuick}>{t.finish}</button>
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

    </div>
  );
}

/* ----------------------------- charts & sub-views ----------------------------- */
function NetWorthChart({ hist, cur, t }) {
  if (!hist || hist.length < 2)
    return <div className="empty">{t.chartNeedTwo}</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={hist} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
        <defs>
          <linearGradient id="gld" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2972f" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#c2972f" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(42,32,19,.07)" vertical={false} />
        <XAxis dataKey="m" tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={t.short} tick={{ fill: "#897c64", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          cursor={{ fill: "rgba(194,151,47,.08)" }}
          contentStyle={{ background: "#fffefb", border: "1px solid rgba(194,151,47,.3)", borderRadius: 10, color: "#3d3322" }}
          formatter={(v) => [money(v, cur), t.chartNetWorthName]} labelStyle={{ color: "#897c64" }} />
        <Bar dataKey="v" fill="url(#gld)" radius={[5, 5, 0, 0]} maxBarSize={42} />
      </BarChart>
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

function CategoryDonut({ items, cur, t, fallback }) {
  const byCat = useMemo(() => {
    const fb = fallback || t.cats.expense[6];
    const m = {};
    items.forEach((e) => { const k = e.category || fb; m[k] = (m[k] || 0) + (Number(e.value) || 0); });
    return Object.keys(m).map((k) => ({ name: k, value: m[k] })).sort((a, b) => b.value - a.value);
  }, [items]);
  const total = sum(byCat);
  if (byCat.length === 0 || total <= 0) return <div className="empty">{t.allocEmpty}</div>;
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
      <div className="legend" style={{ flex: 1, minWidth: 160 }}>
        {byCat.map((e, i) => (
          <div className="legi" key={e.name}>
            <span className="dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span style={{ flex: 1 }}>{e.name}</span>
            <span className="fd-tabnum" style={{ color: "var(--ink)", fontWeight: 600 }}>{money(e.value, cur)}</span>
            <span className="fd-tabnum" style={{ color: "var(--muted)", minWidth: 34, textAlign: "right" }}>{((e.value / total) * 100).toFixed(0)}%</span>
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

/* ----------------------------- guided tour ----------------------------- */
// Selector for each step (null = centered card with no spotlight). Text comes
// from t.tour.steps[i], so this array must stay the same length as that list.
const TOUR_SELECTORS = [
  null,                 // welcome
  ".fd-tabs",           // section tabs
  ".fd-net",            // live net-worth figure
  ".fab",               // guided-fill button
  ".more-wrap",         // more menu (import / export / clear / replay tour)
  "[data-tour='lang']", // language switcher (rendered by App.jsx)
  null,                 // wrap-up
];

function Tour({ t, onClose }) {
  const steps = t.tour.steps;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const last = i === steps.length - 1;
  const next = () => { if (last) onClose(); else setI((v) => Math.min(steps.length - 1, v + 1)); };
  const back = () => setI((v) => Math.max(0, v - 1));

  // measure the highlighted element (re-measure on scroll / resize / step change)
  useLayoutEffect(() => {
    const sel = TOUR_SELECTORS[i];
    const el = sel ? document.querySelector(sel) : null;
    if (!el) { setRect(null); return; }
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom });
    };
    measure();
    const id = setTimeout(measure, 360); // settle after scroll
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(id); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [i, steps.length]);

  // keyboard: Esc closes, arrows navigate
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const PAD = 8, TW = 320, TH = 188;
  const spot = rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;

  let tipStyle;
  if (!rect) {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: TW };
  } else {
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = rect.bottom + 14 + TH <= vh;
    const top = below ? rect.bottom + 14 : Math.max(12, rect.top - 14 - TH);
    let left = rect.left + rect.width / 2 - TW / 2;
    left = Math.max(12, Math.min(left, vw - TW - 12));
    tipStyle = { top, left, width: TW };
  }

  return (
    <div className="tour-root">
      {spot
        ? <div className="tour-spot" style={spot} onClick={onClose} />
        : <div className="tour-dim" onClick={onClose} />}
      <div className="tour-tip" style={tipStyle}>
        <div className="tour-no">{t.tour.stepOf(i + 1, steps.length)}</div>
        <div className="tour-t">{steps[i].title}</div>
        <div className="tour-b">{steps[i].body}</div>
        <div className="tour-dots">
          {steps.map((_, k) => <span key={k} className={"tour-dot" + (k === i ? " on" : "")} />)}
        </div>
        <div className="tour-acts">
          <button className="tour-skip" onClick={onClose}>{last ? "" : t.tour.skip}</button>
          <div style={{ display: "flex", gap: 8 }}>
            {i > 0 && <button className="tour-btn ghost" onClick={back}>{t.tour.back}</button>}
            <button className="tour-btn" onClick={next}>{last ? t.tour.done : t.tour.next}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- retirement ----------------------------- */
function RetInput({ label, value, onChange, suffix, hint, placeholder }) {
  return (
    <div>
      <div className="kpi-l" style={{ marginBottom: 6 }}>
        {label}
        {hint && <span style={{ color: "var(--dim)", marginLeft: 6, letterSpacing: 0, textTransform: "none" }}>{hint}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input className="inp" type="number" placeholder={placeholder} value={value === undefined || value === null ? "" : value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "100%", paddingRight: suffix ? 34 : 11 }} />
        {suffix && <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "var(--dim)", fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

const RET_DEFAULTS = { annualReturn: 5, inflation: 2, withdrawalRate: 4 };
function RetirementView({ ret, onChange, calc, cur, t, H }) {
  const r = ret || {};
  const set = (k) => (v) => onChange({ [k]: v });
  const [panelOpen, setPanelOpen] = useState(true);
  const fillNow = () => onChange({
    currentSavings: Math.max(0, Math.round(calc.invest || calc.netWorth || 0)),
    monthlyContribution: Math.max(0, Math.round(calc.net || 0)),
    monthlySpend: Math.max(0, Math.round(calc.expense || 0)),
  });
  // only offer "use current numbers" when there is real data to pull from
  const hasUsableData = (calc.invest || 0) > 0 || (calc.netWorth || 0) > 0 || (calc.net || 0) > 0 || (calc.expense || 0) > 0;

  const m = useMemo(() => {
    // empty advanced fields fall back to sensible defaults so the basic 3 inputs
    // alone still produce a meaningful projection (explicit 0 is respected).
    const num = (v, d) => (v === "" || v == null || isNaN(Number(v)) ? d : Number(v));
    const age = Number(r.currentAge) || 0;
    const rage = Number(r.retireAge) || 0;
    const cs = num(r.currentSavings, 0);
    const pmt = num(r.monthlyContribution, 0);
    const ar = num(r.annualReturn, 5) / 100;
    const infl = num(r.inflation, 2) / 100;
    const spendYr = (Number(r.monthlySpend) || 0) * 12;
    const wr = num(r.withdrawalRate, 4) / 100;
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
  const byKey = Object.fromEntries(FIELDS.map((f) => [f.k, f]));
  const pick = (keys) => keys.map((k) => byKey[k]).filter(Boolean);
  const orderedFields = pick([
    "currentAge", "retireAge", "monthlySpend", "currentSavings",
    "monthlyContribution", "annualReturn", "inflation", "withdrawalRate",
  ]);
  const field = (f) => (
    <RetInput key={f.k} label={f.label} suffix={f.suffix} hint={f.hint}
      placeholder={RET_DEFAULTS[f.k] != null ? String(RET_DEFAULTS[f.k]) : undefined}
      value={r[f.k]} onChange={set(f.k)} />
  );

  return (
    <div className="grid stagger" style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="sec-h">
          <button onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1 }}>{panelOpen ? "▾" : "▸"}</span>
            <div>
              <div className="sec-t">{t.retInputs}</div>
              <div className="sec-sub">{m.yrsLeft > 0 ? t.yrsLeft(m.yrsLeft) : t.checkAge}</div>
            </div>
          </button>
          {panelOpen && hasUsableData && <button className="fd-toolbtn" onClick={fillNow}>{t.useCurrentNumbers}</button>}
        </div>
        {panelOpen && (
          <>
            <div className="fd-grid cols-4">{orderedFields.map(field)}</div>
            <div className="note">{t.retNote}</div>
          </>
        )}
      </div>

      {!m.valid ? (
        <div className="insight">{t.retStartInsight(hasUsableData)}</div>
      ) : (
        <>
          <div className="fd-grid cols-4">
            <Kpi label={t.kProjected} value={money(m.projAtRetire, cur)} />
            <Kpi label={t.kNeeded} value={money(m.needAtRetire, cur)} sub={t.neededSub} />
            <Kpi label={m.gap >= 0 ? t.kSurplus : t.kShortfall} value={money(Math.abs(m.gap), cur)} tone={m.gap >= 0 ? "pos" : "neg"} />
            <Kpi label={t.kFreedom} value={m.fiAge ? t.freedomAgeVal(m.fiAge) : t.freedomAdjust} tone={m.fiAge && m.fiAge <= m.rage ? "pos" : ""} sub={m.fiAge ? t.freedomAhead(m.rage - m.fiAge) : t.freedomNotReached} />
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
