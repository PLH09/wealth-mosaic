import React from "react";

/* ============================================================================
   i18n module for Wealth Mosaic
   - LOCALES: the language switcher list (English is the default elsewhere)
   - VOICE:   per-locale Web Speech config + number parser (ja/ko are typing-only)
   - STRINGS: every UI string + story/insight/questions/sample per locale
   ========================================================================== */

export const LOCALES = [
  { code: "en", label: "EN", native: "English" },
  { code: "zh-TW", label: "繁", native: "繁體中文" },
  { code: "zh-CN", label: "简", native: "简体中文" },
  { code: "ja", label: "日", native: "日本語" },
  { code: "ko", label: "한", native: "한국어" },
];

/* small helpers (kept local so sample data can be built here) */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ym = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const b = (x) => <b>{x}</b>;

/* ----------------------------- number parsers ----------------------------- */
/* Chinese spoken-number parser (shared by zh-TW & zh-CN, also works for digits). */
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
function zhParseSpoken(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase()
    .replace(/[,，\s]/g, "")
    .replace(/(新?臺幣|新?台幣|塊錢|元整|元|塊|圓|nt\$?|ntd|usd|\$)/g, "")
    .replace(/大約|大概|差不多|左右|約|是|有|這個月|每月|每個月/g, "")
    .replace(/點/g, ".");
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  let m = s.match(/^(\d+(?:\.\d+)?)(萬|万|億|亿|k|w)$/);
  if (m) {
    const mult = m[2] === "k" ? 1e3 : m[2] === "w" ? 1e4 : CN_BIG[m[2]];
    return parseFloat(m[1]) * mult;
  }
  m = s.match(/^([\d.]+)(萬|万|億|亿)$/);
  if (m) return parseFloat(m[1]) * CN_BIG[m[2]];
  if (/[零〇一壹二兩倆贰貳三參叁四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万億亿]/.test(s)) {
    const v = cnSectionToNum(s);
    return v > 0 ? v : NaN;
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
function zhSplitLabelAmount(raw) {
  const t = String(raw || "").trim();
  const m = t.match(/^(.*?)[\s:：]*([\d零〇一壹二兩倆贰貳三參叁四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万億亿.點,，]+(?:元|塊|塊錢|k|w)?)$/);
  if (m) {
    const amount = zhParseSpoken(m[2]);
    let label = m[1].replace(/(是|有|大約|大概|每月|每個月|的)/g, "").trim();
    return { label, amount };
  }
  return { label: t, amount: NaN };
}
function zhSplitMultiLabelAmount(raw) {
  let t = String(raw || "").trim();
  if (!t) return [];
  const SEP = "";
  const NUM = "零〇一壹二兩倆贰貳三參叁四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万億亿";
  t = t
    .replace(/還有|以及|加上|另外再|另外|接著|然後|再來|再加|還包括|包括|跟|和|及/g, SEP)
    .replace(/[、,，;；/]+/g, SEP);
  t = t.replace(
    new RegExp("([萬万億亿千仟百佰拾kw元圓塊])\\s*(?=[\\u4e00-\\u9fa5A-Za-z])(?![" + NUM + "kw])", "g"),
    "$1" + SEP
  );
  return t
    .split(new RegExp(SEP + "+"))
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => zhSplitLabelAmount(seg))
    .filter((x) => !isNaN(x.amount) && x.amount > 0)
    .map((x) => ({ label: x.label || "", value: Math.round(x.amount) }));
}
function zhIsNoneAnswer(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  const v = zhParseSpoken(s);
  if (!isNaN(v) && v > 0) return false;
  return /(沒有|没有|沒|無|无|不用|不需要|都沒|沒什麼|沒啥|不會|沒囉|無啦|沒啦|不知道|跳過|略過|none|nope|no|zero|nothing)/i.test(s);
}
const zhParser = { parseSpoken: zhParseSpoken, splitLabelAmount: zhSplitLabelAmount, splitMultiLabelAmount: zhSplitMultiLabelAmount, isNoneAnswer: zhIsNoneAnswer };

/* English spoken-number parser. */
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
    w = w.replace(/s$/, "");
    if (w in EN_SMALL) { current += EN_SMALL[w]; seen = true; }
    else if (w === "hundred") { current = (current || 1) * 100; seen = true; }
    else if (w in EN_MAG) { total += (current || 1) * EN_MAG[w]; current = 0; seen = true; }
    else if (/^\d+(\.\d+)?$/.test(w)) { current += parseFloat(w); seen = true; }
    else if (w === "and" || w === "a") { /* skip filler */ }
  }
  return seen ? total + current : NaN;
}
function enParseSpoken(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase()
    .replace(/[,$]/g, "")
    .replace(/\b(dollars?|bucks?|usd|nt\$?|ntd|per month|a month|monthly|about|around|roughly|approximately|approx|please)\b/g, "")
    .replace(/\s+/g, " ").trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(k|grand|thousand|m|mil|million|b|bil|billion)$/);
  if (m) {
    const u = m[2];
    const mult = (u === "k" || u === "grand" || u === "thousand") ? 1e3
      : (u === "m" || u === "mil" || u === "million") ? 1e6 : 1e9;
    return parseFloat(m[1]) * mult;
  }
  if (/[a-z]/.test(s)) {
    const v = enWordsToNum(s.split(" "));
    if (!isNaN(v) && v > 0) return v;
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
function enIsNumWord(w) {
  w = String(w || "").toLowerCase().replace(/[.,$]/g, "").replace(/s$/, "");
  if (!w) return false;
  return w in EN_SMALL || w in EN_MAG || w === "and" || w === "point" || w === "a"
    || /^\d+(?:\.\d+)?(?:k|m|b|mil|bil|grand)?$/.test(w);
}
function enSplitLabelAmount(raw) {
  const t = String(raw || "").trim();
  const tokens = t.split(/\s+/).filter(Boolean);
  let i = tokens.length;
  while (i > 0 && enIsNumWord(tokens[i - 1])) i--;
  const tail = tokens.slice(i).join(" ");
  const amount = enParseSpoken(tail);
  if (!isNaN(amount) && amount > 0) {
    const label = tokens.slice(0, i).join(" ")
      .replace(/\b(is|are|of|the|my|a|about|around|currently|worth|value|valued|at)\b/gi, "")
      .trim();
    return { label, amount };
  }
  return { label: t, amount: NaN };
}
function enSplitMultiLabelAmount(raw) {
  let t = String(raw || "").trim();
  if (!t) return [];
  const SEP = " ||| ";
  const MAG = /^(?:hundred|thousand|grand|k|million|mil|m|billion|bil|b|\d+(?:\.\d+)?(?:k|m|b|mil|bil|grand))$/i;
  t = t.replace(/[,;]+/g, SEP).replace(/\band\b|\bplus\b/gi, SEP);
  const words = t.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    const clean = words[i].toLowerCase().replace(/[.,$]/g, "");
    const next = words[i + 1];
    if (next && next !== "|||" && MAG.test(clean) && !enIsNumWord(next)) out.push("|||");
  }
  return out.join(" ").split("|||")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => enSplitLabelAmount(seg))
    .filter((x) => !isNaN(x.amount) && x.amount > 0)
    .map((x) => ({ label: x.label || "", value: Math.round(x.amount) }));
}
function enIsNoneAnswer(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  const v = enParseSpoken(s);
  if (!isNaN(v) && v > 0) return false;
  return /\b(none|no|nope|nothing|nah|zero|skip|nada|don'?t have|do not have|haven'?t got|n\/a)\b/i.test(s);
}
const enParser = { parseSpoken: enParseSpoken, splitLabelAmount: enSplitLabelAmount, splitMultiLabelAmount: enSplitMultiLabelAmount, isNoneAnswer: enIsNoneAnswer };

/* per-locale voice config; null means typing-only (ja / ko) */
export const VOICE = {
  en: { lang: "en-US", parser: enParser },
  "zh-TW": { lang: "zh-TW", parser: zhParser },
  "zh-CN": { lang: "zh-CN", parser: zhParser },
  ja: null,
  ko: null,
};

/* ----------------------------- shortMoney variants ----------------------------- */
const shortWestern = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return Math.round(v).toLocaleString("en-US");
};
const shortCJK = (yi, wan) => (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + yi;
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + wan;
  return Math.round(v).toLocaleString("en-US");
};

/* ----------------------------- font stacks ----------------------------- */
const FONTS = {
  en: {
    import: "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@300;400;500;600;700",
    serif: "'Fraunces',Georgia,serif",
    sans: "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  },
  "zh-TW": {
    import: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Sans+TC:wght@300;400;500;600;700",
    serif: "'Fraunces','Noto Serif TC',Georgia,serif",
    sans: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',-apple-system,sans-serif",
  },
  "zh-CN": {
    import: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Sans+SC:wght@300;400;500;600;700",
    serif: "'Fraunces','Noto Serif SC',Georgia,serif",
    sans: "'Noto Sans SC','PingFang SC','Microsoft YaHei',-apple-system,sans-serif",
  },
  ja: {
    import: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Sans+JP:wght@300;400;500;600;700",
    serif: "'Fraunces','Noto Serif JP',Georgia,serif",
    sans: "'Noto Sans JP','Hiragino Sans','Yu Gothic',-apple-system,sans-serif",
  },
  ko: {
    import: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Sans+KR:wght@300;400;500;600;700",
    serif: "'Fraunces','Noto Serif KR',Georgia,serif",
    sans: "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',-apple-system,sans-serif",
  },
};
export const fonts = (code) => FONTS[code] || FONTS.en;

/* ============================================================================
   STRINGS — one object per locale.
   Dynamic strings are functions; H = { cur, money, short } helpers.
   ========================================================================== */
export const STRINGS = {
  en: {
    voiceLang: "en-US",
    short: shortWestern,
    cats: {
      expense: ["Housing", "Food", "Transport", "Insurance", "Leisure", "Subscriptions", "Other"],
      asset: ["Cash", "Savings", "Investments", "Property", "Other"],
      invest: ["US Stocks", "Intl Stocks", "ETF", "Bonds", "Crypto", "Cash", "Other"],
    },
    brand: "Wealth Mosaic",
    eyebrow: "Personal Wealth",
    privacy: "🔒 Your data stays in your browser — nothing is uploaded. Use “Export” to back up anytime.",
    netLabel: "Current net worth",
    btnGuided: "✦ Guided fill",
    btnRecap: "🔊 Voice recap",
    btnSample: "Load sample",
    btnExport: "Export",
    btnImport: "Import",
    btnClear: "Clear",
    btnEdit: "✎ Edit",
    btnDone: "✓ Done",
    btnMore: "⋯ More",
    editingHint: "Edit mode — change a name or amount inline, add new items, or remove them. Press Done when finished.",
    clearConfirm: "Clear all data?",
    importOk: "Import successful — your data has been restored.",
    importErr: "Invalid file — import failed. Please pick a backup you exported earlier.",
    loading: "Loading…",
    speechUnsupported: "This browser doesn't support speech playback. Try Chrome or Safari.",
    tabs: { overview: "Overview", cashflow: "Cash Flow", invest: "Investments", retire: "Retirement" },
    tour: {
      menu: "Replay tour", next: "Next", back: "Back", skip: "Skip", done: "Got it",
      stepOf: (a, b) => `Step ${a} of ${b}`,
      steps: [
        { title: "Welcome to your finance dashboard", body: "A 30-second tour of the essentials. Everything stays on your device — nothing is uploaded." },
        { title: "Four focused sections", body: "Switch between Overview, Cash Flow, Investments and Retirement here. Each gives a clear, plain-language read on your money." },
        { title: "Your live net worth", body: "This figure updates instantly as you edit your assets and debts, so you always know where you stand." },
        { title: "Fill in your numbers fast", body: "Tap the ✦ button to answer a few simple questions and your dashboard fills itself in — no spreadsheets needed." },
        { title: "Sample data & more", body: "Open this menu to load sample data, import or export a backup, clear everything, or replay this tour anytime." },
        { title: "Five languages", body: "Switch the interface between English, 繁體中文, 简体中文, 日本語 and 한국어 whenever you like." },
        { title: "You're all set", body: "Explore freely — your data is saved automatically in this browser. Enjoy taking charge of your finances!" },
      ],
    },
    tabIntro: {
      overview: "A snapshot of your whole financial picture in one place.",
      cashflow: "How much comes in vs. goes out each month — your saving power.",
      invest: "Where your money is invested.",
      retire: "Estimate when your savings could cover life without working.",
    },
    list: { empty: "No items yet", name: "Name", amount: "Amount", add: "Add" },
    kNetWorth: "Net Worth",
    netWorthSub: (a, d) => `Assets ${a} − Debt ${d}`,
    srExcellent: "Excellent ✦", srHealthy: "Healthy", srImprove: "Could improve", srOver: "Spending over income",
    kInvestments: "Investments",
    holdingsCount: (n) => `${n} holdings`,
    secNetWorthTrend: "Net Worth Trend",
    secAutoRecorded: "Auto-recorded on each update",
    secGoalProgress: "Goal Progress",
    noGoals: 'No goals yet → tap "✎ Edit" at the top right to add one',
    goalTarget: (v) => `Target ${v}`,
    secSavingsRate: "Savings Rate",
    savingsRateSub: (m) => `${m} · Share of income you keep after spending`,
    secIncomeFlow: "Where your income goes", incomeFlowSub: "How this month's income splits across spending and savings",
    flowDeficit: "Deficit",
    secExpenseMix: "Spending breakdown", expenseMixSub: "All spending (recurring + variable), grouped by category",
    monthLabel: "Month",
    totalIncome: "Total income", totalSpending: "Total spending", monthlySurplus: "Monthly surplus",
    secRecurring: "Recurring Items", recurringSub: "Set once, auto-applied every month",
    recurringIncome: "Recurring income", recurringExpenses: "Recurring expenses",
    secThisMonth: (m) => `This Month · ${m}`, thisMonthSub: "One-off income/spending for this month",
    extraIncome: "Extra income", variableSpending: "Variable spending", variableMix: "Variable spending mix",
    totalAssets: "Total Assets", totalDebt: "Total Debt",
    secAssets: "Assets", secLiabilities: "Liabilities",
    secAllocation: "Allocation", secHoldings: "Holdings",
    invKpiTotal: "Total invested", invKpiShare: "Share of assets", invKpiShareSub: (a) => `of ${a} total assets`,
    invKpiTop: "Largest holding", invKpiTopNone: "—",
    topSpendInsight: (cat, pct) => `Your biggest spending category is “${cat}”, at ${pct}% of total spending.`,
    secFinancialGoals: "Financial Goals", goalsSub: "ETA assumes your full monthly surplus goes to that one goal",
    goalReached: "Reached ✦",
    goalEta: (months, eta) => `~${months} mo · by ${eta}`,
    goalNoSurplus: "No surplus this month",
    investNote: "Note: holdings here are a current snapshot you update manually. They are tracked separately from the balance sheet in Overview — if you also list these investments as assets there, avoid double-counting. This tool only tracks; investment decisions are your own or for a professional to advise on.",
    etaMonthYear: (d) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    chartNeedTwo: "Need at least two months of history to draw a trend",
    chartNetWorthName: "Net worth",
    allocEmpty: "Add holdings on the right to see the allocation",
    goalName: "Goal name", goalTargetPH: "Target amount", goalSavedPH: "Saved so far", addGoal: "Add goal",
    defaultMilestone: { label: "First $100K", target: 100000 },
    insight: (v, H) => v.empty ? (
      <>Nothing here yet. Tap {b("✦ Guided fill")} to answer a few quick questions, or open {b("⋯ More → Load sample")} to explore with example numbers. Your data stays in this browser.</>
    ) : v.stalled ? (
      <>Your spending is at or above your income, so the wealth engine has stalled. Start by cutting one or two {b("recurring expenses")} — that keeps saving you money every month.</>
    ) : (
      <>At your current surplus of {b(H.money(v.net, H.cur))}/mo (a {b(v.rate.toFixed(0) + "%")} savings rate), "{v.milestoneLabel}" is about {b(v.m1 === 1 ? "1 month" : v.m1 + " months")} away.{v.saved > 0 && <> Push your savings rate up another 10% and you’d get there {b(v.saved === 1 ? "1 month sooner" : v.saved + " months sooner")} — that’s the power of the savings rate.</>}</>
    ),
    guidedTitle: "Guided fill",
    qDone: "Done!",
    namePH: "Name (e.g. Car loan)",
    amountPH: "Type or say the amount",
    addThis: "Add this one",
    quickSubtitle: "Fill in the blanks — type, or say them all aloud",
    quickStart: "🎤 Start talking", quickListening: "Listening… tap to stop",
    quickHint: "Keep talking — read each line’s amount and I’ll fill the highlighted blank, then move to the next.",
    quickOptional: "optional",
    heard: (t) => `Heard: "${t}"`,
    finish: "Finish",
    allSet: "All set ✦",
    allSetHint: "Here’s what you added this round. Everything is saved automatically.",
    noNewItems: "No new items added this round.",
    fillAgain: "Fill again", viewDashboard: "View dashboard",
    fallbackItem: "Item",
    speechNoSupport: "This browser does not support voice input — please type instead. Chrome or Safari work best.",
    speechCantStart: "Could not start voice — please type instead.",
    speechBlocked: "Microphone is blocked — allow mic access in your browser, or type instead.",
    speechNoHear: "Didn’t hear anything — try again?",
    speechStopped: "Voice recognition stopped — please type instead.",
    speechNothing: "Got it - nothing here. Just press Next.",
    speechMultiFail: (t) => `Didn’t catch "${t}" — try one at a time like "insurance 300, phone 80", or type it in.`,
    speechSingleFail: (t) => `Didn’t catch "${t}" — try again or type it in.`,
    recapEyebrow: "Voice recap", recapTitle: "Your financial story",
    playVoice: "🔊 Play voice", speakingStop: "Speaking… tap to stop", close: "Close",
    recapHint: "Speech playback needs browser support (Chrome / Safari); the recap updates live with your data.",
    retInputs: "Retirement Inputs",
    yrsLeft: (n) => `${n} years until retirement`,
    checkAge: "Check your age inputs",
    useCurrentNumbers: "Use current numbers",
    retNote: "Compound growth uses your annual return; the amount needed is derived from the safe withdrawal rate (the 4% rule), with monthly spending inflated to your retirement year. These are planning assumptions, not investment advice.",
    retStartInsight: (hasData) => <>Fill in {b("age")}, {b("retirement age")} and {b("monthly spending in retirement")} to begin.{hasData && <> Or tap {b("Use current numbers")} at the top right for a quick estimate from your existing data.</>}</>,
    retFields: (cur) => [
      { k: "currentAge", label: "Current age", suffix: "yrs" },
      { k: "retireAge", label: "Target retire age", suffix: "yrs" },
      { k: "currentSavings", label: "Current retirement assets", suffix: cur },
      { k: "monthlyContribution", label: "Monthly contribution", suffix: cur },
      { k: "annualReturn", label: "Annual return", suffix: "%" },
      { k: "inflation", label: "Inflation", suffix: "%" },
      { k: "monthlySpend", label: "Monthly spend in retirement", suffix: cur },
      { k: "withdrawalRate", label: "Safe withdrawal rate", suffix: "%" },
    ],
    retAdvancedHint: "Return, inflation, withdrawal rate & balances",
    secBalanceSheet: "Balance sheet",
    secNetWorthMix: "Net worth at a glance", netWorthMixSub: "How much of what you own is truly yours after debt", debtRatio: "Debt ratio", netWorthNegative: "Underwater", assetMixLabel: "Asset mix",
    kProjected: "Projected at retirement", kNeeded: "Needed to retire", neededSub: "4% rule + inflation",
    kSurplus: "Surplus", kShortfall: "Shortfall",
    kFreedom: "Financial freedom", freedomAdjust: "Adjust",
    freedomAgeVal: (age) => `Age ${age}`, freedomAhead: (yrs) => yrs > 0 ? `${yrs} yrs before target` : "right on target", freedomNotReached: "not reached by retirement",
    ageSuffixKpi: "yrs",
    secAssetsVsNeeded: "Assets vs Amount needed", crossover: "Where the lines cross = financial freedom",
    projectedName: "Projected assets", neededName: "Amount needed",
    chartAgeTick: (a) => a + "y", chartAgeLabel: (a) => "Age " + a,
    retInsightSurplus: (r, m, H) => <>At {b(H.money(r.monthlyContribution, H.cur))}/mo and a {b(r.annualReturn + "%")} annual return, you are projected to have {b(H.money(m.projAtRetire, H.cur))} by age {b(m.rage)} — above the {H.money(m.needAtRetire, H.cur)} you need.{m.fiAge && m.fiAge < m.rage && <> On this track you could reach financial freedom as early as age {b(m.fiAge)} — you might retire earlier or contribute less.</>}</>,
    retInsightShortfall: (r, m, H) => <>On the current track you would have about {b(H.money(m.projAtRetire, H.cur))} at retirement, {b(H.money(Math.abs(m.gap), H.cur))} short of the {H.money(m.needAtRetire, H.cur)} needed. To close the gap, raise contributions to about {b(H.money(r.monthlyContribution + m.extra, H.cur))}/mo (an extra {H.money(m.extra, H.cur)}) — or retire later, raise returns, or lower retirement spending.</>,
    questions: (cur, cats) => [
      { q: "Let’s start with you — how old are you?", hint: "Used to estimate years until retirement", suffix: "yrs", placeholder: "Type or say your age", target: { type: "retire", key: "currentAge" } },
      { q: "What’s your monthly take-home income?", hint: "What actually lands in your account", suffix: cur, target: { type: "recurring_income", label: "Salary" } },
      { q: "Monthly rent or mortgage?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "Rent/Mortgage", category: cats.expense[0] } },
      { q: "Roughly how much on living costs each month?", hint: "Food, transport, everyday spending combined", optional: true, suffix: cur, target: { type: "recurring_expense", label: "Living costs", category: cats.expense[1] } },
      { q: "Any other recurring expenses?", hint: "Say several at once, e.g. “insurance 300, phone 80, Netflix 15”; or type each and tap “Add this one”", optional: true, withLabel: true, multi: true, fallbackLabel: "Recurring expense", suffix: cur, target: { type: "recurring_expense", category: cats.expense[6] } },
      { q: "How much in bank savings / cash?", optional: true, suffix: cur, target: { type: "asset", label: "Savings", assetType: cats.asset[1] } },
      { q: "Current market value of your investments?", hint: "Say several at once, e.g. “Apple 50k, VOO 20k”; or type each and tap “Add this one”", optional: true, withLabel: true, multi: true, fallbackLabel: "Investments", suffix: cur, target: { type: "portfolio", category: cats.invest[2] } },
      { q: "Any debts?", hint: "Say several at once, e.g. “car loan 20k, credit card 5k”; skip if none", optional: true, withLabel: true, multi: true, fallbackLabel: "Debt", suffix: cur, target: { type: "liability" } },
      { q: "At what age do you want to retire?", suffix: "yrs", placeholder: "Type or say your age", target: { type: "retire", key: "retireAge" } },
      { q: "How much will you spend per month in retirement?", hint: "In today’s prices — inflation is added automatically", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
      { q: "How much can you invest toward retirement monthly?", hint: "Your monthly surplus is a good starting estimate", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
    ],
    sample: () => ({
      recurring: {
        income: [{ id: uid(), label: "Salary", value: 6000 }],
        expenses: [
          { id: uid(), label: "Rent", value: 1800, category: "Housing" },
          { id: uid(), label: "Insurance", value: 250, category: "Insurance" },
          { id: uid(), label: "Streaming", value: 45, category: "Subscriptions" },
        ],
      },
      months: { [ym()]: { income: [{ id: uid(), label: "Freelance", value: 600 }], expenses: [
        { id: uid(), label: "Groceries", value: 700, category: "Food" },
        { id: uid(), label: "Transport", value: 180, category: "Transport" },
        { id: uid(), label: "Leisure", value: 300, category: "Leisure" },
      ] } },
      assets: [
        { id: uid(), label: "Checking account", value: 9000, category: "Savings" },
        { id: uid(), label: "Brokerage", value: 17000, category: "Investments" },
        { id: uid(), label: "Emergency fund", value: 5000, category: "Cash" },
      ],
      liabilities: [
        { id: uid(), label: "Credit card", value: 700 },
        { id: uid(), label: "Student loan", value: 6000 },
      ],
      netWorthHistory: (() => { const h = {}; const base = 28000; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); h[ym(d)] = base + (5 - i) * 1400 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 400)); } return h; })(),
      portfolio: [
        { id: uid(), label: "VOO S&P 500", value: 7000, category: "ETF" },
        { id: uid(), label: "Apple", value: 5000, category: "US Stocks" },
        { id: uid(), label: "VXUS", value: 3000, category: "ETF" },
        { id: uid(), label: "Bitcoin", value: 2000, category: "Crypto" },
      ],
      goals: [
        { id: uid(), label: "First $100K", target: 100000, current: 74800 },
        { id: uid(), label: "Travel fund", target: 4000, current: 1500 },
      ],
      retire: { currentAge: 30, retireAge: 60, monthlySpend: 3000, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 60000, monthlyContribution: 3000 },
    }),
    story: (c, data, H) => {
      const sayNum = (n) => H.money(n, H.cur);
      const parts = [];
      const hour = new Date().getHours();
      parts.push(hour < 5 ? "It's late, yet here you are caring about your money — that says a lot about you." : hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening, you've earned some rest.");
      if (c.netWorth > 0) parts.push(`First, some good news — your net worth right now stands at ${sayNum(c.netWorth)}. That's ${sayNum(c.assets)} in assets, holding up ${sayNum(c.liab)} in debt, and what's left is truly yours. Every dollar is proof of your effort.`);
      else if (c.assets > 0 || c.liab > 0) parts.push(`Your net worth is still below the surface, but don't lose heart. Debt is just a stretch of road you haven't finished — not the destination. By facing it today, you've already beaten yesterday's you.`);
      else parts.push(`Our story is still a blank page, and that's the exciting part. Tap Guided fill or Load sample, and let me help you write the first line.`);
      if (c.income > 0 || c.expense > 0) {
        let verdict;
        if (c.rate >= 30) verdict = `A savings rate of ${c.rate.toFixed(0)} percent — that's beautiful. Most people only dream of this, and you did it.`;
        else if (c.rate >= 20) verdict = `A savings rate of ${c.rate.toFixed(0)} percent keeps you steady on a healthy track. Keep it up.`;
        else if (c.rate >= 0) verdict = `A savings rate of ${c.rate.toFixed(0)} percent isn't huge, but saving anything is a win. Let's nudge it higher together.`;
        else verdict = `You spent more than you earned this month — don't be hard on yourself. Life has its ups and downs; seeing it clearly means next month is a fresh chance.`;
        parts.push(`This month, ${sayNum(c.income)} came in, ${sayNum(c.expense)} went out, and ${sayNum(c.net)} stayed. ${verdict}`);
      }
      const cats = {};
      [...data.recurring.expenses, ...c.m.expenses].forEach((e) => { const k = e.category || "Other"; cats[k] = (cats[k] || 0) + (Number(e.value) || 0); });
      const topCat = Object.entries(cats).sort((a, b2) => b2[1] - a[1])[0];
      if (topCat && topCat[1] > 0) parts.push(`Your money runs out fastest on ${topCat[0]}, at ${sayNum(topCat[1])} a month. Seeing where it goes is the key to changing it.`);
      if (c.invest > 0) {
        const top = [...data.portfolio].sort((a, b2) => (b2.value || 0) - (a.value || 0))[0];
        parts.push(`You also have ${sayNum(c.invest)} out there working for you, spread across ${data.portfolio.length} holdings${top ? `, with ${top.label} as your biggest ally` : ""}. That money quietly grows while you sleep.`);
      }
      const g = (data.goals || [])[0];
      if (g && Number(g.target) > 0) {
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        const remain = Math.max(0, Number(g.target) - Number(g.current));
        let line = `And your dreams — "${g.label}" is already ${pct} percent of the way there`;
        if (c.net > 0 && remain > 0) { const months = Math.ceil(remain / c.net); const d = new Date(); d.setMonth(d.getMonth() + months); line += `. At this pace, in about ${months} months — around ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })} — you'll make it real. The finish line is in sight`; }
        else if (pct >= 100) line += `, and you've reached it — take a moment to celebrate!`;
        parts.push(line + ".");
      }
      const r = data.retire || {};
      const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
      if (spend > 0 && wr > 0) { const fi = (spend * 12) / (wr / 100); parts.push(`And the furthest dream of all — retirement. To spend ${sayNum(spend)} a month with peace of mind, you'd need about ${sayNum(fi)} to buy back your freedom from money worries. It sounds like a lot, but every step you take today paves the road for your future self.`); }
      parts.push(`Wealth is never built overnight — it's the quiet sum of small, repeated choices. You're already on your way, and I'll be right here with you.`);
      return parts.join(" ");
    },
  },

  "zh-TW": {
    voiceLang: "zh-TW",
    short: shortCJK("億", "萬"),
    cats: {
      expense: ["居住", "飲食", "交通", "保險", "娛樂", "訂閱", "其他"],
      asset: ["現金", "存款", "投資", "不動產", "其他"],
      invest: ["台股", "美股", "ETF", "債券", "加密貨幣", "現金", "其他"],
    },
    brand: "財富拼圖",
    eyebrow: "Personal Wealth",
    privacy: "🔒 資料只存在你的瀏覽器,不會上傳。可隨時「匯出」備份。",
    netLabel: "目前淨資產",
    btnGuided: "✦ 引導填寫",
    btnRecap: "🔊 語音總結",
    btnSample: "載入範例",
    btnExport: "匯出",
    btnImport: "匯入",
    btnClear: "清空",
    btnEdit: "✎ 編輯",
    btnDone: "✓ 完成",
    btnMore: "⋯ 更多",
    editingHint: "編輯模式 — 可直接修改名稱或金額,也能新增或刪除項目,完成後按「完成」。",
    clearConfirm: "確定清空所有資料?",
    importOk: "匯入成功 —— 你的資料已還原。",
    importErr: "檔案格式不正確,匯入失敗。請選擇先前匯出的備份檔。",
    loading: "載入中…",
    speechUnsupported: "這個瀏覽器不支援語音朗讀,建議改用 Chrome 或 Safari。",
    tabs: { overview: "總覽", cashflow: "現金流", invest: "投資", retire: "退休" },
    tour: {
      menu: "重看導覽", next: "下一步", back: "上一步", skip: "略過", done: "開始使用",
      stepOf: (a, b) => `第 ${a} / ${b} 步`,
      steps: [
        { title: "歡迎使用你的財務儀表板", body: "30 秒快速導覽重點功能。所有資料只留在你的裝置上,不會上傳。" },
        { title: "四個重點分頁", body: "在這裡切換總覽、現金流、投資與退休。每個分頁都用白話幫你看懂自己的財務狀況。" },
        { title: "即時淨值", body: "當你編輯資產與負債時,這個數字會立即更新,讓你隨時掌握現況。" },
        { title: "快速填入你的數字", body: "點這顆 ✦ 按鈕回答幾個簡單問題,儀表板就會自動幫你填好,不必碰試算表。" },
        { title: "範例資料與更多功能", body: "打開這個選單可載入範例資料、匯入或匯出備份、清除全部,或隨時重看本導覽。" },
        { title: "五種語言", body: "隨時可把介面切換成 English、繁體中文、简体中文、日本語 或 한국어。" },
        { title: "一切就緒", body: "盡情探索吧 —— 你的資料會自動存在這個瀏覽器裡。祝你掌握理財、輕鬆自在!" },
      ],
    },
    tabIntro: {
      overview: "一頁看懂你的整體財務狀況。",
      cashflow: "每月收入減去支出,看你能存下多少。",
      invest: "你的錢投資在哪。",
      retire: "試算存款大約能在何時支撐你不工作的生活。",
    },
    list: { empty: "還沒有項目", name: "名稱", amount: "金額", add: "新增" },
    kNetWorth: "淨資產",
    netWorthSub: (a, d) => `資產 ${a} − 負債 ${d}`,
    srExcellent: "極佳 ✦", srHealthy: "健康", srImprove: "可加強", srOver: "入不敷出",
    kInvestments: "投資總額",
    holdingsCount: (n) => `${n} 項持倉`,
    secNetWorthTrend: "淨資產走勢",
    secAutoRecorded: "每次更新自動記錄",
    secGoalProgress: "目標進度",
    noGoals: "還沒有設定目標 → 點右上「✎ 編輯」即可新增",
    goalTarget: (v) => `目標 ${v}`,
    secSavingsRate: "儲蓄率",
    savingsRateSub: (m) => `${m} · 收入扣掉支出後存下的比例`,
    secIncomeFlow: "收入流向", incomeFlowSub: "這個月的收入,分別流向支出與儲蓄",
    flowDeficit: "透支",
    secExpenseMix: "支出分布", expenseMixSub: "固定＋變動的全部支出,依分類看錢花在哪",
    monthLabel: "月份",
    totalIncome: "總收入", totalSpending: "總支出", monthlySurplus: "本月結餘",
    secRecurring: "固定項目", recurringSub: "設定一次,每月自動帶入",
    recurringIncome: "固定收入", recurringExpenses: "固定支出",
    secThisMonth: (m) => `本月變動 · ${m}`, thisMonthSub: "這個月才有的收支",
    extraIncome: "額外收入", variableSpending: "變動支出", variableMix: "變動支出占比",
    totalAssets: "總資產", totalDebt: "總負債",
    secAssets: "資產", secLiabilities: "負債",
    secAllocation: "資產配置", secHoldings: "持倉",
    invKpiTotal: "總投資額", invKpiShare: "佔總資產", invKpiShareSub: (a) => `總資產 ${a}`,
    invKpiTop: "最大持股", invKpiTopNone: "—",
    topSpendInsight: (cat, pct) => `你最大的支出類別是「${cat}」,佔總支出 ${pct}%。`,
    secFinancialGoals: "財務目標", goalsSub: "達成時間假設每月結餘全部投入該目標",
    goalReached: "已達成 ✦",
    goalEta: (months, eta) => `約 ${months} 個月 · ${eta}達成`,
    goalNoSurplus: "本月無結餘",
    investNote: "提醒:這裡的投資金額是「現況快照」,你需要手動更新市值。它和「總覽」裡的資產負債表是分開記錄的,如果你在那邊的資產也填了同一筆投資,記得別重複計算。投資相關決策請自行評估或諮詢專業人士,這個工具只負責追蹤。",
    etaMonthYear: (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`,
    chartNeedTwo: "至少需要兩個月的紀錄才會出現走勢線",
    chartNetWorthName: "淨資產",
    allocEmpty: "在右側新增持倉就會出現配置圖",
    goalName: "目標名稱", goalTargetPH: "目標金額", goalSavedPH: "已存金額", addGoal: "新增目標",
    defaultMilestone: { label: "第一桶金", target: 1000000 },
    insight: (v, H) => v.empty ? (
      <>目前還沒有資料。點 {b("✦ 引導填寫")} 回答幾個簡單問題,或從 {b("⋯ 更多 → 載入範例")} 用示範數字先逛逛。你的資料只會留在這個瀏覽器。</>
    ) : v.stalled ? (
      <>本月支出大於或等於收入,財富累積的引擎停住了。先從砍掉一兩項{b("固定支出")}開始 —— 那會每個月持續幫你存下錢。</>
    ) : (
      <>以目前每月結餘 {b(H.money(v.net, H.cur))}(儲蓄率 {b(v.rate.toFixed(0) + "%")}),距離「{v.milestoneLabel}」還需要約 {b(v.m1 + " 個月")}。{v.saved > 0 && <> 若把儲蓄率再拉高 10%,可以{b("提早 " + v.saved + " 個月")}達標 —— 這就是儲蓄率的威力。</>}</>
    ),
    guidedTitle: "引導填寫",
    qDone: "完成!",
    namePH: "名稱(例如:車貸)",
    amountPH: "輸入或說出金額",
    addThis: "新增此筆",
    quickSubtitle: "填空就好 — 可打字,或一次唸出全部",
    quickStart: "🎤 開始說", quickListening: "聆聽中…點此停止",
    quickHint: "持續說下去 — 依序唸出每一格的金額,我會自動填入反白的那格,再跳到下一格。",
    quickOptional: "可略過",
    heard: (t) => `聽到:「${t}」`,
    finish: "完成",
    allSet: "都填好了 ✦",
    allSetHint: "以下是這次填入的項目,資料已自動儲存。",
    noNewItems: "這次沒有填入新項目。",
    fillAgain: "再填一輪", viewDashboard: "看儀表板",
    fallbackItem: "項目",
    speechNoSupport: "這個瀏覽器不支援語音輸入,請改用打字。建議用 Chrome 或 Safari。",
    speechCantStart: "無法啟動語音,請改用打字。",
    speechBlocked: "麥克風被封鎖了,請在瀏覽器允許麥克風權限,或改用打字。",
    speechNoHear: "沒有聽到聲音,再試一次?",
    speechStopped: "語音辨識中斷了,請改用打字。",
    speechNothing: "好,這題沒有,按「下一題」就行。",
    speechMultiFail: (t) => `沒聽清楚「${t}」—— 可以一筆一筆說,例如「保險三千、手機八百」,或直接打字。`,
    speechSingleFail: (t) => `沒聽清楚「${t}」—— 再試一次或直接打字。`,
    recapEyebrow: "語音總結", recapTitle: "你的財務故事",
    playVoice: "🔊 播放語音", speakingStop: "朗讀中…點此停止", close: "關閉",
    recapHint: "語音朗讀需瀏覽器支援(建議 Chrome / Safari);內容會隨你的資料即時更新。",
    retInputs: "退休參數",
    yrsLeft: (n) => `距離退休還有 ${n} 年`,
    checkAge: "請確認年齡設定",
    useCurrentNumbers: "帶入目前數字",
    retNote: "用「年化報酬率」估算複利成長,用「安全提領率」(4% 法則)反推退休需要的金額,並把月支出按通膨膨脹到退休那年。這些是規劃假設,不是投資建議。",
    retStartInsight: (hasData) => <>填好{b("年齡")}、{b("退休年齡")}與{b("退休後月支出")}就會開始計算。{hasData && <> 也可以直接按右上角{b("帶入目前數字")},用儀表板現有的資料快速試算。</>}</>,
    retFields: (cur) => [
      { k: "currentAge", label: "目前年齡", suffix: "歲" },
      { k: "retireAge", label: "預計退休年齡", suffix: "歲" },
      { k: "currentSavings", label: "目前退休資產", suffix: cur },
      { k: "monthlyContribution", label: "每月投入", suffix: cur },
      { k: "annualReturn", label: "年化報酬率", suffix: "%" },
      { k: "inflation", label: "通膨率", suffix: "%" },
      { k: "monthlySpend", label: "退休後月支出", suffix: cur },
      { k: "withdrawalRate", label: "安全提領率", suffix: "%" },
    ],
    retAdvancedHint: "報酬率、通膨、提領率與現有資產",
    secBalanceSheet: "資產負債表",
    secNetWorthMix: "淨資產一覽", netWorthMixSub: "扣掉負債後,有多少資產真正屬於你", debtRatio: "負債比", netWorthNegative: "負債超過資產", assetMixLabel: "資產分布",
    kProjected: "退休時預計資產", kNeeded: "退休所需資產", neededSub: "4% 法則 + 通膨",
    kSurplus: "超前", kShortfall: "缺口",
    kFreedom: "預估財務自由", freedomAdjust: "需調整",
    freedomAgeVal: (age) => `${age} 歲`, freedomAhead: (yrs) => yrs > 0 ? `比目標早 ${yrs} 年` : "正好在目標年齡", freedomNotReached: "退休前未達標",
    ageSuffixKpi: "歲",
    secAssetsVsNeeded: "資產 vs 所需金額", crossover: "兩線交會 = 財務自由",
    projectedName: "累積資產", neededName: "所需金額",
    chartAgeTick: (a) => a + "歲", chartAgeLabel: (a) => a + " 歲",
    retInsightSurplus: (r, m, H) => <>以目前每月投入 {b(H.money(r.monthlyContribution, H.cur))} 與 {b(r.annualReturn + "%")} 年化報酬,你在 {b(m.rage + " 歲")} 退休時預計累積 {b(H.money(m.projAtRetire, H.cur))},已超過所需的 {H.money(m.needAtRetire, H.cur)}。{m.fiAge && m.fiAge < m.rage && <> 照這條軌跡,你最快 {b(m.fiAge + " 歲")} 就能達到財務自由 —— 可以考慮提早退休或調低投入。</>}</>,
    retInsightShortfall: (r, m, H) => <>目前軌跡退休時約有 {b(H.money(m.projAtRetire, H.cur))},距離所需的 {H.money(m.needAtRetire, H.cur)} 還差 {b(H.money(Math.abs(m.gap), H.cur))}。要補上缺口,每月需投入到約 {b(H.money(r.monthlyContribution + m.extra, H.cur))}(再多存 {H.money(m.extra, H.cur)});或是延後退休年齡、提高報酬率、降低退休後支出。</>,
    questions: (cur, cats) => [
      { q: "先從你開始 — 你今年幾歲?", hint: "用來估算到退休還有多少年", suffix: "歲", placeholder: "輸入或說出年齡", target: { type: "retire", key: "currentAge" } },
      { q: "你每月稅後收入大約多少?", hint: "薪水實際入帳的金額", suffix: cur, target: { type: "recurring_income", label: "月薪" } },
      { q: "每月房租或房貸繳多少?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "房租/房貸", category: cats.expense[0] } },
      { q: "每月生活開銷大約多少?", hint: "飲食、交通、日用品加總抓個概數", optional: true, suffix: cur, target: { type: "recurring_expense", label: "生活費", category: cats.expense[1] } },
      { q: "其他固定支出?", hint: "可一次說多筆,例如「保險三千、手機八百、Netflix兩百九」;或逐筆輸入後按「新增此筆」", optional: true, withLabel: true, multi: true, fallbackLabel: "固定支出", suffix: cur, target: { type: "recurring_expense", category: cats.expense[6] } },
      { q: "銀行存款 / 現金大約多少?", optional: true, suffix: cur, target: { type: "asset", label: "存款", assetType: cats.asset[1] } },
      { q: "投資部位目前市值多少?", hint: "可一次說多筆,例如「台積電五十萬、0050二十萬」;或逐筆輸入後按「新增此筆」", optional: true, withLabel: true, multi: true, fallbackLabel: "投資", suffix: cur, target: { type: "portfolio", category: cats.invest[2] } },
      { q: "有沒有負債?", hint: "可一次說多筆,例如「車貸二十萬、信用卡五萬」;沒有就略過", optional: true, withLabel: true, multi: true, fallbackLabel: "負債", suffix: cur, target: { type: "liability" } },
      { q: "你希望幾歲退休?", suffix: "歲", placeholder: "輸入或說出年齡", target: { type: "retire", key: "retireAge" } },
      { q: "退休後每月想花多少?", hint: "用今天的物價估,系統會自動計入通膨", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
      { q: "每月能投入多少做退休準備?", hint: "可先用每月結餘估", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
    ],
    sample: () => ({
      recurring: {
        income: [{ id: uid(), label: "月薪", value: 65000 }],
        expenses: [
          { id: uid(), label: "房租", value: 18000, category: "居住" },
          { id: uid(), label: "保險", value: 4000, category: "保險" },
          { id: uid(), label: "串流訂閱", value: 800, category: "訂閱" },
        ],
      },
      months: { [ym()]: { income: [{ id: uid(), label: "接案", value: 8000 }], expenses: [
        { id: uid(), label: "伙食", value: 12000, category: "飲食" },
        { id: uid(), label: "交通", value: 2500, category: "交通" },
        { id: uid(), label: "娛樂", value: 4000, category: "娛樂" },
      ] } },
      assets: [
        { id: uid(), label: "活存帳戶", value: 280000, category: "存款" },
        { id: uid(), label: "證券戶投資", value: 520000, category: "投資" },
        { id: uid(), label: "緊急預備金", value: 150000, category: "現金" },
      ],
      liabilities: [
        { id: uid(), label: "信用卡", value: 22000 },
        { id: uid(), label: "學貸", value: 180000 },
      ],
      netWorthHistory: (() => { const h = {}; const base = 600000; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); h[ym(d)] = base + (5 - i) * 28000 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 9000)); } return h; })(),
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
    }),
    story: (c, data, H) => {
      const sayNum = (n) => H.short(n) + "元";
      const parts = [];
      const hour = new Date().getHours();
      parts.push(hour < 5 ? "夜深了,還在關心自己的錢,這份用心很難得。" : hour < 12 ? "早安。" : hour < 18 ? "午安。" : "晚安,辛苦一天了。");
      if (c.netWorth > 0) parts.push(`先給你一個好消息——此刻你的淨資產來到 ${sayNum(c.netWorth)}。這是你用 ${sayNum(c.assets)} 的資產,一點一滴扛起 ${sayNum(c.liab)} 的負債後,真正屬於你的數字。每一塊,都是你努力的證明。`);
      else if (c.assets > 0 || c.liab > 0) parts.push(`現在的淨資產還在水面下,但別灰心。負債只是還沒走完的一段路,不是終點。你願意打開這個畫面面對它,就已經贏過昨天的自己了。`);
      else parts.push(`我們的故事還是一張白紙,而這正是最令人期待的地方。點一下「引導填寫」或「載入範例」,讓我陪你寫下第一頁。`);
      if (c.income > 0 || c.expense > 0) {
        let verdict;
        if (c.rate >= 30) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,太漂亮了!這是很多人想都不敢想的數字,你做到了。`;
        else if (c.rate >= 20) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,穩穩地走在健康的軌道上,繼續保持。`;
        else if (c.rate >= 0) verdict = `儲蓄率 ${c.rate.toFixed(0)} 趴,雖然不多,但有存下來就是勝利,我們再一起往上推一點。`;
        else verdict = `這個月花得比賺的多,別自責——日子有起有落,看清楚了,下個月就有機會調整回來。`;
        parts.push(`這個月,收入 ${sayNum(c.income)} 進了口袋,支出 ${sayNum(c.expense)} 流了出去,最後留下 ${sayNum(c.net)}。${verdict}`);
      }
      const cats = {};
      [...data.recurring.expenses, ...c.m.expenses].forEach((e) => { const k = e.category || "其他"; cats[k] = (cats[k] || 0) + (Number(e.value) || 0); });
      const topCat = Object.entries(cats).sort((a, b2) => b2[1] - a[1])[0];
      if (topCat && topCat[1] > 0) parts.push(`錢花得最兇的地方是「${topCat[0]}」,一個月 ${sayNum(topCat[1])}。看見它在哪,你就握住了改變的鑰匙。`);
      if (c.invest > 0) {
        const top = [...data.portfolio].sort((a, b2) => (b2.value || 0) - (a.value || 0))[0];
        parts.push(`你還讓 ${sayNum(c.invest)} 的資金替你工作,分散在 ${data.portfolio.length} 項持倉裡${top ? `,其中 ${top.label} 是你最大的夥伴` : ""}。這些錢,正在你睡覺的時候默默長大。`);
      }
      const g = (data.goals || [])[0];
      if (g && Number(g.target) > 0) {
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        const remain = Math.max(0, Number(g.target) - Number(g.current));
        let line = `說到夢想——「${g.label}」你已經走完 ${pct} 趴`;
        if (c.net > 0 && remain > 0) { const months = Math.ceil(remain / c.net); const d = new Date(); d.setMonth(d.getMonth() + months); line += `。照現在的步調,大約再 ${months} 個月,也就是 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月,你就能親手把它實現。終點線,已經看得見了`; }
        else if (pct >= 100) line += `,你已經達標了,好好為自己慶祝一下!`;
        parts.push(line + "。");
      }
      const r = data.retire || {};
      const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
      if (spend > 0 && wr > 0) { const fi = (spend * 12) / (wr / 100); parts.push(`而那個最遠的夢——退休。若你想往後每月安穩花用 ${sayNum(spend)},大約準備 ${sayNum(fi)},就能換來不再為錢焦慮的自由。聽起來很大,但你今天的每一步,都在替未來的自己鋪路。`); }
      parts.push(`財富從來不是一夜之間,而是一次次小小的堅持累積而成。你已經在路上了,而我會一直陪著你。`);
      return parts.join("");
    },
  },

  "zh-CN": {
    voiceLang: "zh-CN",
    short: shortCJK("亿", "万"),
    cats: {
      expense: ["居住", "饮食", "交通", "保险", "娱乐", "订阅", "其他"],
      asset: ["现金", "存款", "投资", "不动产", "其他"],
      invest: ["A股", "美股", "ETF", "债券", "加密货币", "现金", "其他"],
    },
    brand: "财富拼图",
    eyebrow: "Personal Wealth",
    privacy: "🔒 数据只存在你的浏览器,不会上传。可随时「导出」备份。",
    netLabel: "目前净资产",
    btnGuided: "✦ 引导填写",
    btnRecap: "🔊 语音总结",
    btnSample: "载入示例",
    btnExport: "导出",
    btnImport: "导入",
    btnClear: "清空",
    btnEdit: "✎ 编辑",
    btnDone: "✓ 完成",
    btnMore: "⋯ 更多",
    editingHint: "编辑模式 — 可直接修改名称或金额,也能新增或删除项目,完成后按「完成」。",
    clearConfirm: "确定清空所有数据?",
    importOk: "导入成功 —— 你的数据已恢复。",
    importErr: "文件格式不正确,导入失败。请选择此前导出的备份文件。",
    loading: "载入中…",
    speechUnsupported: "这个浏览器不支持语音朗读,建议改用 Chrome 或 Safari。",
    tabs: { overview: "总览", cashflow: "现金流", invest: "投资", retire: "退休" },
    tour: {
      menu: "重看导览", next: "下一步", back: "上一步", skip: "跳过", done: "开始使用",
      stepOf: (a, b) => `第 ${a} / ${b} 步`,
      steps: [
        { title: "欢迎使用你的财务仪表板", body: "30 秒快速导览重点功能。所有数据只留在你的设备上,不会上传。" },
        { title: "四个重点分页", body: "在这里切换总览、现金流、投资与退休。每个分页都用大白话帮你看懂自己的财务状况。" },
        { title: "实时净值", body: "当你编辑资产与负债时,这个数字会立即更新,让你随时掌握现状。" },
        { title: "快速填入你的数字", body: "点这颗 ✦ 按钮回答几个简单问题,仪表板就会自动帮你填好,不必碰电子表格。" },
        { title: "示例数据与更多功能", body: "打开这个菜单可载入示例数据、导入或导出备份、清除全部,或随时重看本导览。" },
        { title: "五种语言", body: "随时可把界面切换成 English、繁體中文、简体中文、日本語 或 한국어。" },
        { title: "一切就绪", body: "尽情探索吧 —— 你的数据会自动存在这个浏览器里。祝你轻松掌握理财!" },
      ],
    },
    tabIntro: {
      overview: "一页看懂你的整体财务状况。",
      cashflow: "每月收入减去支出,看你能存下多少。",
      invest: "你的钱投资在哪。",
      retire: "试算存款大约能在何时支撑你不工作的生活。",
    },
    list: { empty: "还没有项目", name: "名称", amount: "金额", add: "新增" },
    kNetWorth: "净资产",
    netWorthSub: (a, d) => `资产 ${a} − 负债 ${d}`,
    srExcellent: "极佳 ✦", srHealthy: "健康", srImprove: "可加强", srOver: "入不敷出",
    kInvestments: "投资总额",
    holdingsCount: (n) => `${n} 项持仓`,
    secNetWorthTrend: "净资产走势",
    secAutoRecorded: "每次更新自动记录",
    secGoalProgress: "目标进度",
    noGoals: "还没有设定目标 → 点右上「✎ 编辑」即可新增",
    goalTarget: (v) => `目标 ${v}`,
    secSavingsRate: "储蓄率",
    savingsRateSub: (m) => `${m} · 收入扣掉支出后存下的比例`,
    secIncomeFlow: "收入流向", incomeFlowSub: "这个月的收入,分别流向支出与储蓄",
    flowDeficit: "透支",
    secExpenseMix: "支出分布", expenseMixSub: "固定＋变动的全部支出,按分类看钱花在哪",
    monthLabel: "月份",
    totalIncome: "总收入", totalSpending: "总支出", monthlySurplus: "本月结余",
    secRecurring: "固定项目", recurringSub: "设定一次,每月自动带入",
    recurringIncome: "固定收入", recurringExpenses: "固定支出",
    secThisMonth: (m) => `本月变动 · ${m}`, thisMonthSub: "这个月才有的收支",
    extraIncome: "额外收入", variableSpending: "变动支出", variableMix: "变动支出占比",
    totalAssets: "总资产", totalDebt: "总负债",
    secAssets: "资产", secLiabilities: "负债",
    secAllocation: "资产配置", secHoldings: "持仓",
    invKpiTotal: "总投资额", invKpiShare: "占总资产", invKpiShareSub: (a) => `总资产 ${a}`,
    invKpiTop: "最大持股", invKpiTopNone: "—",
    topSpendInsight: (cat, pct) => `你最大的支出类别是「${cat}」,占总支出 ${pct}%。`,
    secFinancialGoals: "财务目标", goalsSub: "达成时间假设每月结余全部投入该目标",
    goalReached: "已达成 ✦",
    goalEta: (months, eta) => `约 ${months} 个月 · ${eta}达成`,
    goalNoSurplus: "本月无结余",
    investNote: "提醒:这里的投资金额是「现况快照」,你需要手动更新市值。它和「总览」里的资产负债表是分开记录的,如果你在那边的资产也填了同一笔投资,记得别重复计算。投资相关决策请自行评估或咨询专业人士,这个工具只负责追踪。",
    etaMonthYear: (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`,
    chartNeedTwo: "至少需要两个月的记录才会出现走势线",
    chartNetWorthName: "净资产",
    allocEmpty: "在右侧新增持仓就会出现配置图",
    goalName: "目标名称", goalTargetPH: "目标金额", goalSavedPH: "已存金额", addGoal: "新增目标",
    defaultMilestone: { label: "第一桶金", target: 1000000 },
    insight: (v, H) => v.empty ? (
      <>目前还没有数据。点 {b("✦ 引导填写")} 回答几个简单问题,或从 {b("⋯ 更多 → 载入示例")} 用示范数字先逛逛。你的数据只会留在这个浏览器。</>
    ) : v.stalled ? (
      <>本月支出大于或等于收入,财富累积的引擎停住了。先从砍掉一两项{b("固定支出")}开始 —— 那会每个月持续帮你存下钱。</>
    ) : (
      <>以目前每月结余 {b(H.money(v.net, H.cur))}(储蓄率 {b(v.rate.toFixed(0) + "%")}),距离「{v.milestoneLabel}」还需要约 {b(v.m1 + " 个月")}。{v.saved > 0 && <> 若把储蓄率再拉高 10%,可以{b("提早 " + v.saved + " 个月")}达标 —— 这就是储蓄率的威力。</>}</>
    ),
    guidedTitle: "引导填写",
    qDone: "完成!",
    namePH: "名称(例如:车贷)",
    amountPH: "输入或说出金额",
    addThis: "新增此笔",
    quickSubtitle: "填空就好 — 可打字,或一次念出全部",
    quickStart: "🎤 开始说", quickListening: "聆听中…点此停止",
    quickHint: "持续说下去 — 依序念出每一格的金额,我会自动填入高亮的那格,再跳到下一格。",
    quickOptional: "可略过",
    heard: (t) => `听到:「${t}」`,
    finish: "完成",
    allSet: "都填好了 ✦",
    allSetHint: "以下是这次填入的项目,数据已自动保存。",
    noNewItems: "这次没有填入新项目。",
    fillAgain: "再填一轮", viewDashboard: "看仪表板",
    fallbackItem: "项目",
    speechNoSupport: "这个浏览器不支持语音输入,请改用打字。建议用 Chrome 或 Safari。",
    speechCantStart: "无法启动语音,请改用打字。",
    speechBlocked: "麦克风被封锁了,请在浏览器允许麦克风权限,或改用打字。",
    speechNoHear: "没有听到声音,再试一次?",
    speechStopped: "语音识别中断了,请改用打字。",
    speechNothing: "好,这题没有,按「下一题」就行。",
    speechMultiFail: (t) => `没听清楚「${t}」—— 可以一笔一笔说,例如「保险三千、手机八百」,或直接打字。`,
    speechSingleFail: (t) => `没听清楚「${t}」—— 再试一次或直接打字。`,
    recapEyebrow: "语音总结", recapTitle: "你的财务故事",
    playVoice: "🔊 播放语音", speakingStop: "朗读中…点此停止", close: "关闭",
    recapHint: "语音朗读需浏览器支持(建议 Chrome / Safari);内容会随你的数据实时更新。",
    retInputs: "退休参数",
    yrsLeft: (n) => `距离退休还有 ${n} 年`,
    checkAge: "请确认年龄设定",
    useCurrentNumbers: "带入目前数字",
    retNote: "用「年化收益率」估算复利成长,用「安全提取率」(4% 法则)反推退休需要的金额,并把月支出按通胀膨胀到退休那年。这些是规划假设,不是投资建议。",
    retStartInsight: (hasData) => <>填好{b("年龄")}、{b("退休年龄")}与{b("退休后月支出")}就会开始计算。{hasData && <> 也可以直接按右上角{b("带入目前数字")},用仪表板现有的数据快速试算。</>}</>,
    retFields: (cur) => [
      { k: "currentAge", label: "目前年龄", suffix: "岁" },
      { k: "retireAge", label: "预计退休年龄", suffix: "岁" },
      { k: "currentSavings", label: "目前退休资产", suffix: cur },
      { k: "monthlyContribution", label: "每月投入", suffix: cur },
      { k: "annualReturn", label: "年化收益率", suffix: "%" },
      { k: "inflation", label: "通胀率", suffix: "%" },
      { k: "monthlySpend", label: "退休后月支出", suffix: cur },
      { k: "withdrawalRate", label: "安全提取率", suffix: "%" },
    ],
    retAdvancedHint: "报酬率、通胀、提领率与现有资产",
    secBalanceSheet: "资产负债表",
    secNetWorthMix: "净资产一览", netWorthMixSub: "扣掉负债后,有多少资产真正属于你", debtRatio: "负债比", netWorthNegative: "负债超过资产", assetMixLabel: "资产分布",
    kProjected: "退休时预计资产", kNeeded: "退休所需资产", neededSub: "4% 法则 + 通胀",
    kSurplus: "超前", kShortfall: "缺口",
    kFreedom: "预估财务自由", freedomAdjust: "需调整",
    freedomAgeVal: (age) => `${age} 岁`, freedomAhead: (yrs) => yrs > 0 ? `比目标早 ${yrs} 年` : "正好在目标年龄", freedomNotReached: "退休前未达标",
    ageSuffixKpi: "岁",
    secAssetsVsNeeded: "资产 vs 所需金额", crossover: "两线交会 = 财务自由",
    projectedName: "累积资产", neededName: "所需金额",
    chartAgeTick: (a) => a + "岁", chartAgeLabel: (a) => a + " 岁",
    retInsightSurplus: (r, m, H) => <>以目前每月投入 {b(H.money(r.monthlyContribution, H.cur))} 与 {b(r.annualReturn + "%")} 年化收益,你在 {b(m.rage + " 岁")} 退休时预计累积 {b(H.money(m.projAtRetire, H.cur))},已超过所需的 {H.money(m.needAtRetire, H.cur)}。{m.fiAge && m.fiAge < m.rage && <> 照这条轨迹,你最快 {b(m.fiAge + " 岁")} 就能达到财务自由 —— 可以考虑提早退休或调低投入。</>}</>,
    retInsightShortfall: (r, m, H) => <>目前轨迹退休时约有 {b(H.money(m.projAtRetire, H.cur))},距离所需的 {H.money(m.needAtRetire, H.cur)} 还差 {b(H.money(Math.abs(m.gap), H.cur))}。要补上缺口,每月需投入到约 {b(H.money(r.monthlyContribution + m.extra, H.cur))}(再多存 {H.money(m.extra, H.cur)});或是延后退休年龄、提高收益率、降低退休后支出。</>,
    questions: (cur, cats) => [
      { q: "先从你开始 — 你今年几岁?", hint: "用来估算到退休还有多少年", suffix: "岁", placeholder: "输入或说出年龄", target: { type: "retire", key: "currentAge" } },
      { q: "你每月税后收入大约多少?", hint: "工资实际到账的金额", suffix: cur, target: { type: "recurring_income", label: "月薪" } },
      { q: "每月房租或房贷缴多少?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "房租/房贷", category: cats.expense[0] } },
      { q: "每月生活开销大约多少?", hint: "饮食、交通、日用品加总抓个概数", optional: true, suffix: cur, target: { type: "recurring_expense", label: "生活费", category: cats.expense[1] } },
      { q: "其他固定支出?", hint: "可一次说多笔,例如「保险三千、手机八百、Netflix两百九」;或逐笔输入后按「新增此笔」", optional: true, withLabel: true, multi: true, fallbackLabel: "固定支出", suffix: cur, target: { type: "recurring_expense", category: cats.expense[6] } },
      { q: "银行存款 / 现金大约多少?", optional: true, suffix: cur, target: { type: "asset", label: "存款", assetType: cats.asset[1] } },
      { q: "投资仓位目前市值多少?", hint: "可一次说多笔,例如「贵州茅台五十万、沪深300二十万」;或逐笔输入后按「新增此笔」", optional: true, withLabel: true, multi: true, fallbackLabel: "投资", suffix: cur, target: { type: "portfolio", category: cats.invest[2] } },
      { q: "有没有负债?", hint: "可一次说多笔,例如「车贷二十万、信用卡五万」;没有就跳过", optional: true, withLabel: true, multi: true, fallbackLabel: "负债", suffix: cur, target: { type: "liability" } },
      { q: "你希望几岁退休?", suffix: "岁", placeholder: "输入或说出年龄", target: { type: "retire", key: "retireAge" } },
      { q: "退休后每月想花多少?", hint: "用今天的物价估,系统会自动计入通胀", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
      { q: "每月能投入多少做退休准备?", hint: "可先用每月结余估", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
    ],
    sample: () => ({
      recurring: {
        income: [{ id: uid(), label: "月薪", value: 18000 }],
        expenses: [
          { id: uid(), label: "房租", value: 5000, category: "居住" },
          { id: uid(), label: "保险", value: 1200, category: "保险" },
          { id: uid(), label: "视频会员", value: 50, category: "订阅" },
        ],
      },
      months: { [ym()]: { income: [{ id: uid(), label: "兼职", value: 2000 }], expenses: [
        { id: uid(), label: "伙食", value: 3000, category: "饮食" },
        { id: uid(), label: "交通", value: 600, category: "交通" },
        { id: uid(), label: "娱乐", value: 1000, category: "娱乐" },
      ] } },
      assets: [
        { id: uid(), label: "活期账户", value: 80000, category: "存款" },
        { id: uid(), label: "证券账户", value: 150000, category: "投资" },
        { id: uid(), label: "应急金", value: 40000, category: "现金" },
      ],
      liabilities: [
        { id: uid(), label: "信用卡", value: 6000 },
        { id: uid(), label: "助学贷款", value: 50000 },
      ],
      netWorthHistory: (() => { const h = {}; const base = 170000; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); h[ym(d)] = base + (5 - i) * 8000 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 2500)); } return h; })(),
      portfolio: [
        { id: uid(), label: "沪深300 ETF", value: 60000, category: "ETF" },
        { id: uid(), label: "贵州茅台", value: 45000, category: "A股" },
        { id: uid(), label: "标普500", value: 30000, category: "美股" },
        { id: uid(), label: "比特币", value: 15000, category: "加密货币" },
      ],
      goals: [
        { id: uid(), label: "第一桶金", target: 300000, current: 210000 },
        { id: uid(), label: "旅游基金", target: 30000, current: 12000 },
      ],
      retire: { currentAge: 30, retireAge: 60, monthlySpend: 12000, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 190000, monthlyContribution: 8000 },
    }),
    story: (c, data, H) => {
      const sayNum = (n) => H.short(n) + "元";
      const parts = [];
      const hour = new Date().getHours();
      parts.push(hour < 5 ? "夜深了,还在关心自己的钱,这份用心很难得。" : hour < 12 ? "早安。" : hour < 18 ? "午安。" : "晚安,辛苦一天了。");
      if (c.netWorth > 0) parts.push(`先给你一个好消息——此刻你的净资产来到 ${sayNum(c.netWorth)}。这是你用 ${sayNum(c.assets)} 的资产,一点一滴扛起 ${sayNum(c.liab)} 的负债后,真正属于你的数字。每一块,都是你努力的证明。`);
      else if (c.assets > 0 || c.liab > 0) parts.push(`现在的净资产还在水面下,但别灰心。负债只是还没走完的一段路,不是终点。你愿意打开这个画面面对它,就已经赢过昨天的自己了。`);
      else parts.push(`我们的故事还是一张白纸,而这正是最令人期待的地方。点一下「引导填写」或「载入示例」,让我陪你写下第一页。`);
      if (c.income > 0 || c.expense > 0) {
        let verdict;
        if (c.rate >= 30) verdict = `储蓄率 ${c.rate.toFixed(0)}%,太漂亮了!这是很多人想都不敢想的数字,你做到了。`;
        else if (c.rate >= 20) verdict = `储蓄率 ${c.rate.toFixed(0)}%,稳稳地走在健康的轨道上,继续保持。`;
        else if (c.rate >= 0) verdict = `储蓄率 ${c.rate.toFixed(0)}%,虽然不多,但有存下来就是胜利,我们再一起往上推一点。`;
        else verdict = `这个月花得比赚的多,别自责——日子有起有落,看清楚了,下个月就有机会调整回来。`;
        parts.push(`这个月,收入 ${sayNum(c.income)} 进了口袋,支出 ${sayNum(c.expense)} 流了出去,最后留下 ${sayNum(c.net)}。${verdict}`);
      }
      const cats = {};
      [...data.recurring.expenses, ...c.m.expenses].forEach((e) => { const k = e.category || "其他"; cats[k] = (cats[k] || 0) + (Number(e.value) || 0); });
      const topCat = Object.entries(cats).sort((a, b2) => b2[1] - a[1])[0];
      if (topCat && topCat[1] > 0) parts.push(`钱花得最凶的地方是「${topCat[0]}」,一个月 ${sayNum(topCat[1])}。看见它在哪,你就握住了改变的钥匙。`);
      if (c.invest > 0) {
        const top = [...data.portfolio].sort((a, b2) => (b2.value || 0) - (a.value || 0))[0];
        parts.push(`你还让 ${sayNum(c.invest)} 的资金替你工作,分散在 ${data.portfolio.length} 项持仓里${top ? `,其中 ${top.label} 是你最大的伙伴` : ""}。这些钱,正在你睡觉的时候默默长大。`);
      }
      const g = (data.goals || [])[0];
      if (g && Number(g.target) > 0) {
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        const remain = Math.max(0, Number(g.target) - Number(g.current));
        let line = `说到梦想——「${g.label}」你已经走完 ${pct}%`;
        if (c.net > 0 && remain > 0) { const months = Math.ceil(remain / c.net); const d = new Date(); d.setMonth(d.getMonth() + months); line += `。照现在的步调,大约再 ${months} 个月,也就是 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月,你就能亲手把它实现。终点线,已经看得见了`; }
        else if (pct >= 100) line += `,你已经达标了,好好为自己庆祝一下!`;
        parts.push(line + "。");
      }
      const r = data.retire || {};
      const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
      if (spend > 0 && wr > 0) { const fi = (spend * 12) / (wr / 100); parts.push(`而那个最远的梦——退休。若你想往后每月安稳花用 ${sayNum(spend)},大约准备 ${sayNum(fi)},就能换来不再为钱焦虑的自由。听起来很大,但你今天的每一步,都在替未来的自己铺路。`); }
      parts.push(`财富从来不是一夜之间,而是一次次小小的坚持累积而成。你已经在路上了,而我会一直陪着你。`);
      return parts.join("");
    },
  },

  ja: {
    voiceLang: "ja-JP",
    short: shortCJK("億", "万"),
    cats: {
      expense: ["住居", "食費", "交通", "保険", "娯楽", "サブスク", "その他"],
      asset: ["現金", "預金", "投資", "不動産", "その他"],
      invest: ["日本株", "米国株", "ETF", "債券", "暗号資産", "現金", "その他"],
    },
    brand: "ウェルス・モザイク",
    eyebrow: "Personal Wealth",
    privacy: "🔒 データはブラウザ内にのみ保存され、アップロードされません。「エクスポート」でいつでもバックアップできます。",
    netLabel: "現在の純資産",
    btnGuided: "✦ ガイド入力",
    btnRecap: "🔊 音声まとめ",
    btnSample: "サンプル読込",
    btnExport: "エクスポート",
    btnImport: "インポート",
    btnClear: "クリア",
    btnEdit: "✎ 編集",
    btnDone: "✓ 完了",
    btnMore: "⋯ その他",
    editingHint: "編集モード — 名前や金額を直接編集でき、項目の追加・削除も可能です。終わったら「完了」を押してください。",
    clearConfirm: "すべてのデータを消去しますか?",
    importOk: "インポート成功 —— データを復元しました。",
    importErr: "ファイル形式が正しくありません。以前エクスポートしたバックアップを選んでください。",
    loading: "読み込み中…",
    speechUnsupported: "このブラウザは音声読み上げに対応していません。Chrome か Safari をお試しください。",
    tabs: { overview: "概要", cashflow: "収支", invest: "投資", retire: "退職" },
    tour: {
      menu: "ツアーを再生", next: "次へ", back: "戻る", skip: "スキップ", done: "はじめる",
      stepOf: (a, b) => `${a} / ${b}`,
      steps: [
        { title: "ファイナンスダッシュボードへようこそ", body: "30秒で要点をご案内します。データはすべて端末内に保存され、アップロードされません。" },
        { title: "4つのセクション", body: "ここで概要・収支・投資・退職を切り替えます。それぞれが分かりやすい言葉でお金の状況を示します。" },
        { title: "リアルタイムの純資産", body: "資産と負債を編集すると、この数字が即座に更新され、いつでも現状を把握できます。" },
        { title: "数字をすばやく入力", body: "✦ ボタンを押していくつかの質問に答えるだけで、ダッシュボードが自動で入力されます。" },
        { title: "サンプルデータとその他", body: "このメニューからサンプル読み込み、バックアップの入出力、全消去、ツアーの再生ができます。" },
        { title: "5つの言語", body: "English・繁體中文・简体中文・日本語・한국어 にいつでも切り替えられます。" },
        { title: "準備完了", body: "自由に操作してください。データはこのブラウザに自動保存されます。お金の管理を楽しんで！" },
      ],
    },
    tabIntro: {
      overview: "あなたの財務全体を一目で確認できます。",
      cashflow: "毎月の収入から支出を引いて、貯蓄できる力を見ます。",
      invest: "お金がどこに投資されているか。",
      retire: "貯蓄でいつ働かずに生活できそうかを試算します。",
    },
    list: { empty: "まだ項目がありません", name: "名称", amount: "金額", add: "追加" },
    kNetWorth: "純資産",
    netWorthSub: (a, d) => `資産 ${a} − 負債 ${d}`,
    srExcellent: "とても良い ✦", srHealthy: "健全", srImprove: "改善の余地あり", srOver: "支出が収入超過",
    kInvestments: "投資総額",
    holdingsCount: (n) => `${n} 銘柄`,
    secNetWorthTrend: "純資産の推移",
    secAutoRecorded: "更新ごとに自動記録",
    secGoalProgress: "目標の進捗",
    noGoals: "まだ目標がありません → 右上の「✎ 編集」から追加できます",
    goalTarget: (v) => `目標 ${v}`,
    secSavingsRate: "貯蓄率",
    savingsRateSub: (m) => `${m} · 収入から支出を引いて残る割合`,
    secIncomeFlow: "収入の流れ", incomeFlowSub: "今月の収入が支出と貯蓄にどう分かれるか",
    flowDeficit: "赤字",
    secExpenseMix: "支出の内訳", expenseMixSub: "固定＋変動のすべての支出をカテゴリ別に表示",
    monthLabel: "月",
    totalIncome: "総収入", totalSpending: "総支出", monthlySurplus: "今月の収支",
    secRecurring: "固定項目", recurringSub: "一度設定すれば毎月自動反映",
    recurringIncome: "固定収入", recurringExpenses: "固定支出",
    secThisMonth: (m) => `今月の変動 · ${m}`, thisMonthSub: "今月だけの収支",
    extraIncome: "臨時収入", variableSpending: "変動支出", variableMix: "変動支出の割合",
    totalAssets: "総資産", totalDebt: "総負債",
    secAssets: "資産", secLiabilities: "負債",
    secAllocation: "資産配分", secHoldings: "保有銘柄",
    invKpiTotal: "投資総額", invKpiShare: "総資産に占める割合", invKpiShareSub: (a) => `総資産 ${a}`,
    invKpiTop: "最大の保有", invKpiTopNone: "—",
    topSpendInsight: (cat, pct) => `最大の支出カテゴリは「${cat}」で、総支出の ${pct}% です。`,
    secFinancialGoals: "資産目標", goalsSub: "達成時期は毎月の収支をすべてその目標に充てた場合の試算",
    goalReached: "達成 ✦",
    goalEta: (months, eta) => `約 ${months} か月 · ${eta}達成`,
    goalNoSurplus: "今月は収支なし",
    investNote: "ご注意:ここの投資額は手動更新する「現時点のスナップショット」です。「概要」のバランスシートとは別に記録されるため、そちらの資産にも同じ投資を入れている場合は二重計上に注意してください。投資判断はご自身で、または専門家にご相談ください。このツールは記録のみを行います。",
    etaMonthYear: (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`,
    chartNeedTwo: "推移を描くには少なくとも2か月分の記録が必要です",
    chartNetWorthName: "純資産",
    allocEmpty: "右側に保有銘柄を追加すると配分が表示されます",
    goalName: "目標名", goalTargetPH: "目標金額", goalSavedPH: "現在の額", addGoal: "目標を追加",
    defaultMilestone: { label: "最初の1000万", target: 10000000 },
    insight: (v, H) => v.empty ? (
      <>まだデータがありません。{b("✦ ガイド入力")} でいくつかの質問に答えるか、{b("⋯ その他 → サンプル読み込み")} で例の数字を試してみましょう。データはこのブラウザ内に保存されます。</>
    ) : v.stalled ? (
      <>今月は支出が収入以上で、資産形成のエンジンが止まっています。まずは{b("固定支出")}を1〜2件減らすことから —— それが毎月の貯蓄につながります。</>
    ) : (
      <>現在の月間収支 {b(H.money(v.net, H.cur))}(貯蓄率 {b(v.rate.toFixed(0) + "%")})なら、「{v.milestoneLabel}」まで約 {b(v.m1 + " か月")}です。{v.saved > 0 && <> 貯蓄率をさらに10%上げれば{b(v.saved + " か月早く")}達成できます —— これが貯蓄率の力です。</>}</>
    ),
    guidedTitle: "ガイド入力",
    qDone: "完了!",
    namePH: "名称(例:自動車ローン)",
    amountPH: "金額を入力または発話",
    addThis: "この項目を追加",
    quickSubtitle: "空欄を埋めるだけ — 入力でも、まとめて読み上げてもOK",
    quickStart: "🎤 話しはじめる", quickListening: "認識中…タップで停止",
    quickHint: "そのまま話し続けてください — 各行の金額を順に読み上げると、ハイライト中の欄に入力し、次へ進みます。",
    quickOptional: "任意",
    heard: (t) => `認識:「${t}」`,
    finish: "完了",
    allSet: "すべて完了 ✦",
    allSetHint: "今回追加した項目です。すべて自動保存されています。",
    noNewItems: "今回は新しい項目はありませんでした。",
    fillAgain: "もう一度入力", viewDashboard: "ダッシュボードを見る",
    fallbackItem: "項目",
    speechNoSupport: "このブラウザは音声入力に対応していません。入力してください。Chrome か Safari を推奨します。",
    speechCantStart: "音声を開始できませんでした。入力してください。",
    speechBlocked: "マイクがブロックされています。ブラウザでマイクを許可するか、入力してください。",
    speechNoHear: "何も聞き取れませんでした。もう一度お試しください。",
    speechStopped: "音声認識が停止しました。入力してください。",
    speechNothing: "了解です。この項目はなしですね。「次へ」を押してください。",
    speechMultiFail: (t) => `「${t}」を聞き取れませんでした —— 1件ずつ、または入力してください。`,
    speechSingleFail: (t) => `「${t}」を聞き取れませんでした —— もう一度か、入力してください。`,
    recapEyebrow: "音声まとめ", recapTitle: "あなたの家計ストーリー",
    playVoice: "🔊 音声を再生", speakingStop: "再生中…タップで停止", close: "閉じる",
    recapHint: "音声読み上げにはブラウザ対応が必要です(Chrome / Safari 推奨)。内容はデータに合わせて随時更新されます。",
    retInputs: "退職プラン入力",
    yrsLeft: (n) => `退職まであと ${n} 年`,
    checkAge: "年齢の入力をご確認ください",
    useCurrentNumbers: "現在の数字を使う",
    retNote: "「年率リターン」で複利成長を試算し、「安全引出率」(4%ルール)から必要額を逆算、月支出は退職年までインフレを反映します。これらは計画上の前提であり、投資助言ではありません。",
    retStartInsight: (hasData) => <>{b("年齢")}・{b("退職年齢")}・{b("退職後の月支出")}を入力すると計算が始まります。{hasData && <> 右上の{b("現在の数字を使う")}で、既存データから素早く試算することもできます。</>}</>,
    retFields: (cur) => [
      { k: "currentAge", label: "現在の年齢", suffix: "歳" },
      { k: "retireAge", label: "退職予定年齢", suffix: "歳" },
      { k: "currentSavings", label: "現在の退職資産", suffix: cur },
      { k: "monthlyContribution", label: "毎月の積立", suffix: cur },
      { k: "annualReturn", label: "年率リターン", suffix: "%" },
      { k: "inflation", label: "インフレ率", suffix: "%" },
      { k: "monthlySpend", label: "退職後の月支出", suffix: cur },
      { k: "withdrawalRate", label: "安全引出率", suffix: "%" },
    ],
    retAdvancedHint: "利回り・インフレ・取崩率・現有資産",
    secBalanceSheet: "バランスシート",
    secNetWorthMix: "純資産ひと目で", netWorthMixSub: "借金を引いて,資産のうち本当にあなたのものはどれだけか", debtRatio: "負債比率", netWorthNegative: "債務超過", assetMixLabel: "資産の内訳",
    kProjected: "退職時の予想資産", kNeeded: "退職に必要な額", neededSub: "4%ルール + インフレ",
    kSurplus: "余裕", kShortfall: "不足",
    kFreedom: "経済的自由の予想", freedomAdjust: "要調整",
    freedomAgeVal: (age) => `${age} 歳`, freedomAhead: (yrs) => yrs > 0 ? `目標より ${yrs} 年早い` : "目標年齢ちょうど", freedomNotReached: "退職までに未達成",
    ageSuffixKpi: "歳",
    secAssetsVsNeeded: "資産 vs 必要額", crossover: "2本の線が交わる点 = 経済的自由",
    projectedName: "予想資産", neededName: "必要額",
    chartAgeTick: (a) => a + "歳", chartAgeLabel: (a) => a + " 歳",
    retInsightSurplus: (r, m, H) => <>毎月 {b(H.money(r.monthlyContribution, H.cur))} の積立と年率 {b(r.annualReturn + "%")} のリターンなら、{b(m.rage + " 歳")} の退職時に {b(H.money(m.projAtRetire, H.cur))} に達する見込みで、必要な {H.money(m.needAtRetire, H.cur)} を上回ります。{m.fiAge && m.fiAge < m.rage && <> このペースなら最短 {b(m.fiAge + " 歳")} で経済的自由に到達できます —— 早期退職や積立減額も検討できます。</>}</>,
    retInsightShortfall: (r, m, H) => <>現在のペースでは退職時に約 {b(H.money(m.projAtRetire, H.cur))} となり、必要な {H.money(m.needAtRetire, H.cur)} に {b(H.money(Math.abs(m.gap), H.cur))} 不足します。差を埋めるには、毎月の積立を約 {b(H.money(r.monthlyContribution + m.extra, H.cur))}(あと {H.money(m.extra, H.cur)})まで増やす —— または退職を遅らせる、リターンを上げる、退職後支出を抑える方法があります。</>,
    questions: (cur, cats) => [
      { q: "まずあなたのことから — 今おいくつですか?", hint: "退職までの年数を見積もるために使います", suffix: "歳", placeholder: "年齢を入力または発話", target: { type: "retire", key: "currentAge" } },
      { q: "毎月の手取り収入はどのくらいですか?", hint: "実際に口座に入る金額", suffix: cur, target: { type: "recurring_income", label: "給与" } },
      { q: "毎月の家賃または住宅ローンは?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "家賃/住宅ローン", category: cats.expense[0] } },
      { q: "毎月の生活費はだいたいいくら?", hint: "食費・交通・日用品をまとめて概算で", optional: true, suffix: cur, target: { type: "recurring_expense", label: "生活費", category: cats.expense[1] } },
      { q: "その他の固定支出はありますか?", hint: "まとめて入力後「この項目を追加」を押してください", optional: true, withLabel: true, multi: true, fallbackLabel: "固定支出", suffix: cur, target: { type: "recurring_expense", category: cats.expense[6] } },
      { q: "銀行預金 / 現金はどのくらい?", optional: true, suffix: cur, target: { type: "asset", label: "預金", assetType: cats.asset[1] } },
      { q: "投資の現在の時価総額は?", hint: "1件ずつ入力後「この項目を追加」を押してください", optional: true, withLabel: true, multi: true, fallbackLabel: "投資", suffix: cur, target: { type: "portfolio", category: cats.invest[2] } },
      { q: "負債はありますか?", hint: "1件ずつ入力、なければスキップ", optional: true, withLabel: true, multi: true, fallbackLabel: "負債", suffix: cur, target: { type: "liability" } },
      { q: "何歳で退職したいですか?", suffix: "歳", placeholder: "年齢を入力または発話", target: { type: "retire", key: "retireAge" } },
      { q: "退職後は毎月いくら使う予定ですか?", hint: "現在の物価で — インフレは自動で加味されます", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
      { q: "退職に向けて毎月いくら投資できますか?", hint: "毎月の収支が目安になります", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
    ],
    sample: () => ({
      recurring: {
        income: [{ id: uid(), label: "給与", value: 320000 }],
        expenses: [
          { id: uid(), label: "家賃", value: 90000, category: "住居" },
          { id: uid(), label: "保険", value: 15000, category: "保険" },
          { id: uid(), label: "サブスク", value: 2000, category: "サブスク" },
        ],
      },
      months: { [ym()]: { income: [{ id: uid(), label: "副業", value: 40000 }], expenses: [
        { id: uid(), label: "食費", value: 60000, category: "食費" },
        { id: uid(), label: "交通", value: 12000, category: "交通" },
        { id: uid(), label: "娯楽", value: 20000, category: "娯楽" },
      ] } },
      assets: [
        { id: uid(), label: "普通預金", value: 1400000, category: "預金" },
        { id: uid(), label: "証券口座", value: 2600000, category: "投資" },
        { id: uid(), label: "緊急資金", value: 750000, category: "現金" },
      ],
      liabilities: [
        { id: uid(), label: "クレジットカード", value: 110000 },
        { id: uid(), label: "奨学金", value: 900000 },
      ],
      netWorthHistory: (() => { const h = {}; const base = 3000000; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); h[ym(d)] = base + (5 - i) * 140000 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 45000)); } return h; })(),
      portfolio: [
        { id: uid(), label: "eMAXIS Slim 米国株", value: 1000000, category: "ETF" },
        { id: uid(), label: "トヨタ", value: 700000, category: "日本株" },
        { id: uid(), label: "S&P500", value: 600000, category: "米国株" },
        { id: uid(), label: "ビットコイン", value: 300000, category: "暗号資産" },
      ],
      goals: [
        { id: uid(), label: "最初の1000万", target: 10000000, current: 7480000 },
        { id: uid(), label: "旅行資金", target: 600000, current: 220000 },
      ],
      retire: { currentAge: 30, retireAge: 60, monthlySpend: 200000, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 3300000, monthlyContribution: 140000 },
    }),
    story: (c, data, H) => {
      const sayNum = (n) => H.short(n) + "円";
      const parts = [];
      const hour = new Date().getHours();
      parts.push(hour < 5 ? "夜遅くまで、自分のお金に向き合っている —— その心がけは本当に立派です。" : hour < 12 ? "おはようございます。" : hour < 18 ? "こんにちは。" : "こんばんは、今日もお疲れさまでした。");
      if (c.netWorth > 0) parts.push(`まず良い知らせを —— 今のあなたの純資産は ${sayNum(c.netWorth)} です。${sayNum(c.assets)} の資産で ${sayNum(c.liab)} の負債を支え、残ったのは本当にあなたのもの。一円一円が努力の証です。`);
      else if (c.assets > 0 || c.liab > 0) parts.push(`今の純資産はまだ水面下ですが、気を落とさないで。負債はまだ走り切っていない道であって、ゴールではありません。今日それと向き合えた時点で、昨日の自分を超えています。`);
      else parts.push(`私たちの物語はまだ白紙、そこが一番わくわくするところです。「ガイド入力」か「サンプル読込」を押して、最初の一行を一緒に書きましょう。`);
      if (c.income > 0 || c.expense > 0) {
        let verdict;
        if (c.rate >= 30) verdict = `貯蓄率 ${c.rate.toFixed(0)}% —— 見事です。多くの人が夢見るだけの数字を、あなたは実現しました。`;
        else if (c.rate >= 20) verdict = `貯蓄率 ${c.rate.toFixed(0)}%、健全な軌道をしっかり進んでいます。この調子で。`;
        else if (c.rate >= 0) verdict = `貯蓄率 ${c.rate.toFixed(0)}%、多くはなくても、貯められたこと自体が勝利です。一緒に少しずつ上げていきましょう。`;
        else verdict = `今月は収入より支出が多めでした —— 自分を責めないで。生活には波があり、見えていれば来月は立て直せます。`;
        parts.push(`今月は ${sayNum(c.income)} が入り、${sayNum(c.expense)} が出て、${sayNum(c.net)} が残りました。${verdict}`);
      }
      const cats = {};
      [...data.recurring.expenses, ...c.m.expenses].forEach((e) => { const k = e.category || "その他"; cats[k] = (cats[k] || 0) + (Number(e.value) || 0); });
      const topCat = Object.entries(cats).sort((a, b2) => b2[1] - a[1])[0];
      if (topCat && topCat[1] > 0) parts.push(`お金が一番出ていくのは「${topCat[0]}」で、月に ${sayNum(topCat[1])}。どこに消えるか見えれば、それが変化の鍵になります。`);
      if (c.invest > 0) {
        const top = [...data.portfolio].sort((a, b2) => (b2.value || 0) - (a.value || 0))[0];
        parts.push(`さらに ${sayNum(c.invest)} があなたのために働いていて、${data.portfolio.length} 銘柄に分散${top ? `、なかでも ${top.label} が最大の味方です` : ""}。そのお金は、あなたが眠る間も静かに育っています。`);
      }
      const g = (data.goals || [])[0];
      if (g && Number(g.target) > 0) {
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        const remain = Math.max(0, Number(g.target) - Number(g.current));
        let line = `そして夢のこと —— 「${g.label}」はすでに ${pct}% まで来ています`;
        if (c.net > 0 && remain > 0) { const months = Math.ceil(remain / c.net); const d = new Date(); d.setMonth(d.getMonth() + months); line += `。このペースなら約 ${months} か月後、${d.getFullYear()} 年 ${d.getMonth() + 1} 月ごろに実現できます。ゴールはもう見えています`; }
        else if (pct >= 100) line += `、そして達成しました —— 自分をしっかり祝ってあげてください!`;
        parts.push(line + "。");
      }
      const r = data.retire || {};
      const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
      if (spend > 0 && wr > 0) { const fi = (spend * 12) / (wr / 100); parts.push(`そして一番遠い夢 —— 退職。これから毎月 ${sayNum(spend)} を安心して使うには、およそ ${sayNum(fi)} あれば、お金の不安から自由になれます。大きく聞こえても、今日の一歩一歩が未来の自分への道を作ります。`); }
      parts.push(`富は一夜にして築かれるものではなく、小さな選択の積み重ねです。あなたはもう歩み始めています。私はずっとそばにいます。`);
      return parts.join("");
    },
  },

  ko: {
    voiceLang: "ko-KR",
    short: shortCJK("억", "만"),
    cats: {
      expense: ["주거", "식비", "교통", "보험", "여가", "구독", "기타"],
      asset: ["현금", "예금", "투자", "부동산", "기타"],
      invest: ["국내주식", "미국주식", "ETF", "채권", "암호화폐", "현금", "기타"],
    },
    brand: "웰스 모자이크",
    eyebrow: "Personal Wealth",
    privacy: "🔒 데이터는 브라우저에만 저장되며 업로드되지 않습니다. 「내보내기」로 언제든 백업하세요.",
    netLabel: "현재 순자산",
    btnGuided: "✦ 가이드 입력",
    btnRecap: "🔊 음성 요약",
    btnSample: "샘플 불러오기",
    btnExport: "내보내기",
    btnImport: "가져오기",
    btnClear: "초기화",
    btnEdit: "✎ 편집",
    btnDone: "✓ 완료",
    btnMore: "⋯ 더보기",
    editingHint: "편집 모드 — 이름이나 금액을 바로 수정하고, 항목을 추가하거나 삭제할 수 있습니다. 끝나면 완료를 누르세요.",
    clearConfirm: "모든 데이터를 지울까요?",
    importOk: "가져오기 성공 —— 데이터가 복원되었습니다.",
    importErr: "파일 형식이 올바르지 않아 가져오기에 실패했습니다. 이전에 내보낸 백업을 선택하세요.",
    loading: "불러오는 중…",
    speechUnsupported: "이 브라우저는 음성 읽기를 지원하지 않습니다. Chrome 또는 Safari를 사용해 보세요.",
    tabs: { overview: "개요", cashflow: "현금 흐름", invest: "투자", retire: "은퇴" },
    tour: {
      menu: "둘러보기 다시 보기", next: "다음", back: "이전", skip: "건너뛰기", done: "시작하기",
      stepOf: (a, b) => `${a} / ${b}`,
      steps: [
        { title: "금융 대시보드에 오신 것을 환영합니다", body: "30초 동안 핵심 기능을 안내합니다. 모든 데이터는 기기에만 저장되며 업로드되지 않습니다." },
        { title: "네 가지 핵심 탭", body: "여기에서 개요·현금 흐름·투자·은퇴를 전환합니다. 각 탭이 쉬운 말로 자산 상황을 보여줍니다." },
        { title: "실시간 순자산", body: "자산과 부채를 수정하면 이 숫자가 즉시 갱신되어 언제든 현재 상태를 알 수 있습니다." },
        { title: "숫자를 빠르게 입력", body: "✦ 버튼을 눌러 몇 가지 간단한 질문에 답하면 대시보드가 자동으로 채워집니다." },
        { title: "샘플 데이터와 그 외 기능", body: "이 메뉴에서 샘플 불러오기, 백업 가져오기·내보내기, 전체 삭제, 둘러보기 다시 보기를 할 수 있습니다." },
        { title: "다섯 가지 언어", body: "English·繁體中文·简体中文·日本語·한국어 로 언제든지 전환할 수 있습니다." },
        { title: "준비 완료", body: "자유롭게 둘러보세요. 데이터는 이 브라우저에 자동 저장됩니다. 즐겁게 자산을 관리하세요!" },
      ],
    },
    tabIntro: {
      overview: "당신의 전체 재무 상황을 한눈에 봅니다.",
      cashflow: "매달 수입에서 지출을 빼서 저축 여력을 봅니다.",
      invest: "돈이 어디에 투자되어 있는지.",
      retire: "저축으로 언제쯤 일하지 않고 살 수 있을지 추산합니다.",
    },
    list: { empty: "아직 항목이 없습니다", name: "이름", amount: "금액", add: "추가" },
    kNetWorth: "순자산",
    netWorthSub: (a, d) => `자산 ${a} − 부채 ${d}`,
    srExcellent: "훌륭함 ✦", srHealthy: "건전", srImprove: "개선 여지", srOver: "지출이 수입 초과",
    kInvestments: "투자 총액",
    holdingsCount: (n) => `${n} 종목`,
    secNetWorthTrend: "순자산 추이",
    secAutoRecorded: "업데이트마다 자동 기록",
    secGoalProgress: "목표 진행률",
    noGoals: "아직 목표가 없습니다 → 오른쪽 위 「✎ 편집」에서 추가하세요",
    goalTarget: (v) => `목표 ${v}`,
    secSavingsRate: "저축률",
    savingsRateSub: (m) => `${m} · 수입에서 지출을 뺀 후 남기는 비율`,
    secIncomeFlow: "수입의 흐름", incomeFlowSub: "이번 달 수입이 지출과 저축으로 나뉘는 비율",
    flowDeficit: "적자",
    secExpenseMix: "지출 분포", expenseMixSub: "고정＋변동 전체 지출을 카테고리별로 표시",
    monthLabel: "월",
    totalIncome: "총수입", totalSpending: "총지출", monthlySurplus: "이번 달 잔여",
    secRecurring: "고정 항목", recurringSub: "한 번 설정하면 매월 자동 반영",
    recurringIncome: "고정 수입", recurringExpenses: "고정 지출",
    secThisMonth: (m) => `이번 달 변동 · ${m}`, thisMonthSub: "이번 달에만 있는 수입/지출",
    extraIncome: "추가 수입", variableSpending: "변동 지출", variableMix: "변동 지출 비중",
    totalAssets: "총자산", totalDebt: "총부채",
    secAssets: "자산", secLiabilities: "부채",
    secAllocation: "자산 배분", secHoldings: "보유 종목",
    invKpiTotal: "총 투자액", invKpiShare: "총자산 대비 비중", invKpiShareSub: (a) => `총자산 ${a}`,
    invKpiTop: "최대 보유", invKpiTopNone: "—",
    topSpendInsight: (cat, pct) => `가장 큰 지출 카테고리는 「${cat}」로, 전체 지출의 ${pct}%입니다.`,
    secFinancialGoals: "재무 목표", goalsSub: "달성 시점은 매월 잔여를 모두 해당 목표에 넣는다고 가정",
    goalReached: "달성 ✦",
    goalEta: (months, eta) => `약 ${months}개월 · ${eta} 달성`,
    goalNoSurplus: "이번 달 잔여 없음",
    investNote: "참고: 여기의 투자 금액은 직접 갱신하는 「현재 스냅샷」입니다. 「개요」의 재무상태표와 별도로 기록되므로, 그곳 자산에도 같은 투자를 입력했다면 중복 계산에 주의하세요. 투자 판단은 본인 또는 전문가와 상의하세요. 이 도구는 기록만 합니다.",
    etaMonthYear: (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
    chartNeedTwo: "추이를 그리려면 최소 2개월치 기록이 필요합니다",
    chartNetWorthName: "순자산",
    allocEmpty: "오른쪽에 보유 종목을 추가하면 배분이 표시됩니다",
    goalName: "목표 이름", goalTargetPH: "목표 금액", goalSavedPH: "현재 모은 금액", addGoal: "목표 추가",
    defaultMilestone: { label: "첫 1억", target: 100000000 },
    insight: (v, H) => v.empty ? (
      <>아직 데이터가 없습니다. {b("✦ 가이드 입력")} 으로 몇 가지 질문에 답하거나, {b("⋯ 더 보기 → 샘플 불러오기")} 로 예시 숫자를 둘러보세요. 데이터는 이 브라우저에만 저장됩니다.</>
    ) : v.stalled ? (
      <>이번 달은 지출이 수입 이상이라 자산 형성 엔진이 멈췄습니다. 우선 {b("고정 지출")} 한두 개를 줄이는 것부터 —— 매달 꾸준히 저축에 도움이 됩니다.</>
    ) : (
      <>현재 월 잔여 {b(H.money(v.net, H.cur))}(저축률 {b(v.rate.toFixed(0) + "%")})이면 "{v.milestoneLabel}"까지 약 {b(v.m1 + "개월")} 남았습니다.{v.saved > 0 && <> 저축률을 10% 더 올리면 {b(v.saved + "개월 빨리")} 도달합니다 —— 이것이 저축률의 힘입니다.</>}</>
    ),
    guidedTitle: "가이드 입력",
    qDone: "완료!",
    namePH: "이름(예: 자동차 대출)",
    amountPH: "금액 입력 또는 말하기",
    addThis: "이 항목 추가",
    quickSubtitle: "빈칸만 채우면 끝 — 입력하거나 한 번에 말해도 됩니다",
    quickStart: "🎤 말하기 시작", quickListening: "인식 중…탭하여 중지",
    quickHint: "계속 말씀하세요 — 각 줄의 금액을 차례로 말하면 강조된 칸에 입력하고 다음으로 넘어갑니다.",
    quickOptional: "선택",
    heard: (t) => `인식: 「${t}」`,
    finish: "완료",
    allSet: "모두 완료 ✦",
    allSetHint: "이번에 추가한 항목입니다. 모두 자동 저장되었습니다.",
    noNewItems: "이번에는 새 항목이 없습니다.",
    fillAgain: "다시 입력", viewDashboard: "대시보드 보기",
    fallbackItem: "항목",
    speechNoSupport: "이 브라우저는 음성 입력을 지원하지 않습니다. 직접 입력해 주세요. Chrome 또는 Safari를 권장합니다.",
    speechCantStart: "음성을 시작할 수 없습니다. 직접 입력해 주세요.",
    speechBlocked: "마이크가 차단되었습니다. 브라우저에서 마이크를 허용하거나 직접 입력하세요.",
    speechNoHear: "아무것도 들리지 않았습니다. 다시 시도할까요?",
    speechStopped: "음성 인식이 중단되었습니다. 직접 입력해 주세요.",
    speechNothing: "알겠습니다. 이 항목은 없네요. 「다음」을 누르세요.",
    speechMultiFail: (t) => `「${t}」을(를) 알아듣지 못했습니다 —— 하나씩 말하거나 입력해 주세요.`,
    speechSingleFail: (t) => `「${t}」을(를) 알아듣지 못했습니다 —— 다시 시도하거나 입력해 주세요.`,
    recapEyebrow: "음성 요약", recapTitle: "당신의 재무 이야기",
    playVoice: "🔊 음성 재생", speakingStop: "재생 중…탭하여 중지", close: "닫기",
    recapHint: "음성 읽기는 브라우저 지원이 필요합니다(Chrome / Safari 권장). 내용은 데이터에 맞춰 실시간 업데이트됩니다.",
    retInputs: "은퇴 설정 입력",
    yrsLeft: (n) => `은퇴까지 ${n}년`,
    checkAge: "나이 입력을 확인하세요",
    useCurrentNumbers: "현재 숫자 가져오기",
    retNote: "「연 수익률」로 복리 성장을 추정하고, 「안전 인출률」(4% 규칙)로 필요 금액을 역산하며, 월 지출은 은퇴 시점까지 인플레이션을 반영합니다. 이는 계획 가정이며 투자 조언이 아닙니다.",
    retStartInsight: (hasData) => <>{b("나이")}, {b("은퇴 나이")}, {b("은퇴 후 월 지출")}을 입력하면 계산이 시작됩니다.{hasData && <> 오른쪽 위 {b("현재 숫자 가져오기")}로 기존 데이터에서 빠르게 추정할 수도 있습니다.</>}</>,
    retFields: (cur) => [
      { k: "currentAge", label: "현재 나이", suffix: "세" },
      { k: "retireAge", label: "목표 은퇴 나이", suffix: "세" },
      { k: "currentSavings", label: "현재 은퇴 자산", suffix: cur },
      { k: "monthlyContribution", label: "매월 적립", suffix: cur },
      { k: "annualReturn", label: "연 수익률", suffix: "%" },
      { k: "inflation", label: "인플레이션", suffix: "%" },
      { k: "monthlySpend", label: "은퇴 후 월 지출", suffix: cur },
      { k: "withdrawalRate", label: "안전 인출률", suffix: "%" },
    ],
    retAdvancedHint: "수익률·인플레이션·인출률·보유 자산",
    secBalanceSheet: "대차대조표",
    secNetWorthMix: "순자산 한눈에", netWorthMixSub: "빚을 빼고 나면 자산 중 진짜 내 것은 얼마인지", debtRatio: "부채 비율", netWorthNegative: "부채 초과", assetMixLabel: "자산 구성",
    kProjected: "은퇴 시 예상 자산", kNeeded: "은퇴에 필요한 금액", neededSub: "4% 규칙 + 인플레이션",
    kSurplus: "여유", kShortfall: "부족",
    kFreedom: "예상 경제적 자유", freedomAdjust: "조정 필요",
    freedomAgeVal: (age) => `${age}세`, freedomAhead: (yrs) => yrs > 0 ? `목표보다 ${yrs}년 빠름` : "목표 나이와 동일", freedomNotReached: "은퇴 전 미달성",
    ageSuffixKpi: "세",
    secAssetsVsNeeded: "자산 vs 필요 금액", crossover: "두 선이 만나는 지점 = 경제적 자유",
    projectedName: "예상 자산", neededName: "필요 금액",
    chartAgeTick: (a) => a + "세", chartAgeLabel: (a) => a + " 세",
    retInsightSurplus: (r, m, H) => <>매월 {b(H.money(r.monthlyContribution, H.cur))} 적립과 연 {b(r.annualReturn + "%")} 수익률이면, {b(m.rage + "세")} 은퇴 시 {b(H.money(m.projAtRetire, H.cur))}에 도달할 전망으로 필요한 {H.money(m.needAtRetire, H.cur)}을(를) 웃돕니다.{m.fiAge && m.fiAge < m.rage && <> 이 추세라면 빠르면 {b(m.fiAge + "세")}에 경제적 자유에 도달할 수 있습니다 —— 조기 은퇴나 적립 축소도 고려할 수 있습니다.</>}</>,
    retInsightShortfall: (r, m, H) => <>현재 추세로는 은퇴 시 약 {b(H.money(m.projAtRetire, H.cur))}이 되어, 필요한 {H.money(m.needAtRetire, H.cur)}에서 {b(H.money(Math.abs(m.gap), H.cur))} 부족합니다. 격차를 메우려면 매월 적립을 약 {b(H.money(r.monthlyContribution + m.extra, H.cur))}(추가 {H.money(m.extra, H.cur)})까지 늘리거나 —— 은퇴를 늦추거나, 수익률을 높이거나, 은퇴 후 지출을 줄이세요.</>,
    questions: (cur, cats) => [
      { q: "당신부터 시작해요 — 올해 몇 살인가요?", hint: "은퇴까지 남은 햇수를 추정하는 데 사용됩니다", suffix: "세", placeholder: "나이 입력 또는 말하기", target: { type: "retire", key: "currentAge" } },
      { q: "매월 실수령 수입은 얼마인가요?", hint: "실제로 계좌에 들어오는 금액", suffix: cur, target: { type: "recurring_income", label: "급여" } },
      { q: "매월 월세 또는 주택담보대출은?", optional: true, suffix: cur, target: { type: "recurring_expense", label: "월세/대출", category: cats.expense[0] } },
      { q: "매월 생활비는 대략 얼마인가요?", hint: "식비, 교통, 생필품을 합쳐 대략", optional: true, suffix: cur, target: { type: "recurring_expense", label: "생활비", category: cats.expense[1] } },
      { q: "다른 고정 지출이 있나요?", hint: "하나씩 입력 후 「이 항목 추가」를 누르세요", optional: true, withLabel: true, multi: true, fallbackLabel: "고정 지출", suffix: cur, target: { type: "recurring_expense", category: cats.expense[6] } },
      { q: "은행 예금 / 현금은 얼마인가요?", optional: true, suffix: cur, target: { type: "asset", label: "예금", assetType: cats.asset[1] } },
      { q: "투자의 현재 평가액은?", hint: "하나씩 입력 후 「이 항목 추가」를 누르세요", optional: true, withLabel: true, multi: true, fallbackLabel: "투자", suffix: cur, target: { type: "portfolio", category: cats.invest[2] } },
      { q: "부채가 있나요?", hint: "하나씩 입력, 없으면 건너뛰기", optional: true, withLabel: true, multi: true, fallbackLabel: "부채", suffix: cur, target: { type: "liability" } },
      { q: "몇 살에 은퇴하고 싶나요?", suffix: "세", placeholder: "나이 입력 또는 말하기", target: { type: "retire", key: "retireAge" } },
      { q: "은퇴 후 매월 얼마를 쓸 계획인가요?", hint: "현재 물가 기준 — 인플레이션은 자동 반영됩니다", suffix: cur, target: { type: "retire", key: "monthlySpend" } },
      { q: "은퇴를 위해 매월 얼마를 투자할 수 있나요?", hint: "매월 잔여가 좋은 기준이 됩니다", optional: true, suffix: cur, target: { type: "retire", key: "monthlyContribution" } },
    ],
    sample: () => ({
      recurring: {
        income: [{ id: uid(), label: "급여", value: 3500000 }],
        expenses: [
          { id: uid(), label: "월세", value: 800000, category: "주거" },
          { id: uid(), label: "보험", value: 150000, category: "보험" },
          { id: uid(), label: "구독", value: 20000, category: "구독" },
        ],
      },
      months: { [ym()]: { income: [{ id: uid(), label: "부업", value: 400000 }], expenses: [
        { id: uid(), label: "식비", value: 600000, category: "식비" },
        { id: uid(), label: "교통", value: 120000, category: "교통" },
        { id: uid(), label: "여가", value: 200000, category: "여가" },
      ] } },
      assets: [
        { id: uid(), label: "입출금 계좌", value: 15000000, category: "예금" },
        { id: uid(), label: "증권 계좌", value: 28000000, category: "투자" },
        { id: uid(), label: "비상금", value: 8000000, category: "현금" },
      ],
      liabilities: [
        { id: uid(), label: "신용카드", value: 1200000 },
        { id: uid(), label: "학자금 대출", value: 10000000 },
      ],
      netWorthHistory: (() => { const h = {}; const base = 32000000; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); h[ym(d)] = base + (5 - i) * 1500000 + (i === 0 ? 0 : Math.round((Math.random() - 0.3) * 500000)); } return h; })(),
      portfolio: [
        { id: uid(), label: "KODEX 200", value: 11000000, category: "ETF" },
        { id: uid(), label: "삼성전자", value: 8000000, category: "국내주식" },
        { id: uid(), label: "S&P500", value: 6000000, category: "미국주식" },
        { id: uid(), label: "비트코인", value: 3000000, category: "암호화폐" },
      ],
      goals: [
        { id: uid(), label: "첫 1억", target: 100000000, current: 74800000 },
        { id: uid(), label: "여행 자금", target: 6000000, current: 2200000 },
      ],
      retire: { currentAge: 30, retireAge: 60, monthlySpend: 2500000, withdrawalRate: 4, annualReturn: 6, inflation: 2, currentSavings: 35000000, monthlyContribution: 1500000 },
    }),
    story: (c, data, H) => {
      const sayNum = (n) => H.short(n) + "원";
      const parts = [];
      const hour = new Date().getHours();
      parts.push(hour < 5 ? "밤이 깊었는데도 자신의 돈을 챙기고 있군요 —— 그 마음가짐이 참 대단합니다." : hour < 12 ? "좋은 아침입니다." : hour < 18 ? "안녕하세요." : "수고하셨어요, 좋은 저녁입니다.");
      if (c.netWorth > 0) parts.push(`먼저 좋은 소식 —— 지금 당신의 순자산은 ${sayNum(c.netWorth)}입니다. ${sayNum(c.assets)}의 자산으로 ${sayNum(c.liab)}의 부채를 떠받치고 남은, 진짜 당신의 몫이죠. 한 푼 한 푼이 당신 노력의 증거입니다.`);
      else if (c.assets > 0 || c.liab > 0) parts.push(`지금 순자산은 아직 수면 아래지만 낙심하지 마세요. 부채는 아직 다 걷지 못한 길일 뿐, 종착지가 아닙니다. 오늘 마주한 것만으로도 어제의 자신을 이겼습니다.`);
      else parts.push(`우리의 이야기는 아직 백지이고, 그래서 가장 설레는 부분입니다. 「가이드 입력」이나 「샘플 불러오기」를 눌러 첫 줄을 함께 써봐요.`);
      if (c.income > 0 || c.expense > 0) {
        let verdict;
        if (c.rate >= 30) verdict = `저축률 ${c.rate.toFixed(0)}% —— 정말 멋집니다. 많은 사람이 꿈만 꾸는 숫자를 당신은 해냈어요.`;
        else if (c.rate >= 20) verdict = `저축률 ${c.rate.toFixed(0)}%, 건전한 궤도를 꾸준히 가고 있습니다. 계속 유지하세요.`;
        else if (c.rate >= 0) verdict = `저축률 ${c.rate.toFixed(0)}%, 많지 않아도 모았다는 것 자체가 승리입니다. 함께 조금씩 올려봐요.`;
        else verdict = `이번 달은 번 것보다 더 썼네요 —— 자책하지 마세요. 삶에는 기복이 있고, 분명히 보았으니 다음 달엔 되돌릴 기회가 있습니다.`;
        parts.push(`이번 달은 ${sayNum(c.income)}이 들어오고, ${sayNum(c.expense)}이 나가, ${sayNum(c.net)}이 남았습니다. ${verdict}`);
      }
      const cats = {};
      [...data.recurring.expenses, ...c.m.expenses].forEach((e) => { const k = e.category || "기타"; cats[k] = (cats[k] || 0) + (Number(e.value) || 0); });
      const topCat = Object.entries(cats).sort((a, b2) => b2[1] - a[1])[0];
      if (topCat && topCat[1] > 0) parts.push(`돈이 가장 빨리 빠져나가는 곳은 「${topCat[0]}」로 한 달에 ${sayNum(topCat[1])}입니다. 어디로 가는지 보이면 그것이 변화의 열쇠입니다.`);
      if (c.invest > 0) {
        const top = [...data.portfolio].sort((a, b2) => (b2.value || 0) - (a.value || 0))[0];
        parts.push(`또한 ${sayNum(c.invest)}이 당신을 위해 일하고 있고, ${data.portfolio.length}개 종목에 분산되어 있습니다${top ? `, 그중 ${top.label}이(가) 가장 든든한 동료죠` : ""}. 그 돈은 당신이 잠든 사이에도 조용히 자랍니다.`);
      }
      const g = (data.goals || [])[0];
      if (g && Number(g.target) > 0) {
        const pct = Math.round((Number(g.current) / Number(g.target)) * 100);
        const remain = Math.max(0, Number(g.target) - Number(g.current));
        let line = `그리고 꿈 이야기 —— 「${g.label}」은(는) 이미 ${pct}%까지 왔습니다`;
        if (c.net > 0 && remain > 0) { const months = Math.ceil(remain / c.net); const d = new Date(); d.setMonth(d.getMonth() + months); line += `. 이 속도라면 약 ${months}개월 뒤, ${d.getFullYear()}년 ${d.getMonth() + 1}월쯤 직접 이뤄낼 수 있어요. 결승선이 보입니다`; }
        else if (pct >= 100) line += `, 그리고 달성했습니다 —— 잠시 자신을 축하해 주세요!`;
        parts.push(line + ".");
      }
      const r = data.retire || {};
      const spend = Number(r.monthlySpend), wr = Number(r.withdrawalRate);
      if (spend > 0 && wr > 0) { const fi = (spend * 12) / (wr / 100); parts.push(`그리고 가장 먼 꿈 —— 은퇴. 앞으로 매월 ${sayNum(spend)}을 마음 편히 쓰려면 약 ${sayNum(fi)}이 있으면 돈 걱정에서 자유로워집니다. 크게 들리지만, 오늘의 한 걸음 한 걸음이 미래의 당신을 위한 길을 닦습니다.`); }
      parts.push(`부는 하룻밤에 이뤄지지 않고, 작은 선택의 반복이 쌓여 만들어집니다. 당신은 이미 길 위에 있고, 저는 늘 곁에 있겠습니다.`);
      return parts.join("");
    },
  },
};
