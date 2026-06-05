# Finance Dashboard — AI Handoff / 交接說明

A privacy-first, **local-only** personal finance dashboard. All data lives in the
browser's `localStorage` — nothing is sent to a server. UI is fully translated
into **5 languages** (English, 繁體中文, 简体中文, 日本語, 한국어).

> 本文件供其他 AI 接手時快速理解專案。程式碼為唯一事實來源 (source of truth)。

---

## 1. Stack & Commands

- **React 18 + Vite 5**, charts via **recharts** (LineChart, PieChart/Pie/Cell).
- No backend, no router, no state library — single component tree + `localStorage`.

```bash
npm install      # install deps (react, react-dom, recharts, vite, @vitejs/plugin-react)
npm run dev      # local dev server (Vite)
npm run build    # production build -> dist/
npm run preview  # preview the built dist/
```

Deploy: pushed to GitHub `main` → **Vercel** auto-deploys. `vercel.json` present.

---

## 2. File map

```
index.html                       # Vite entry
src/main.jsx                     # ReactDOM root -> <App/>
src/App.jsx                      # language picker (bottom-left), persists `finance:lang`,
                                 #   renders <FinanceDashboard locale={lang} key={lang} />
src/i18n.jsx        (~1420 ln)   # LOCALES + per-locale STRINGS (en, zh-TW, zh-CN, ja, ko),
                                 #   guided-fill QUESTIONS, fonts
src/components/FinanceDashboard.jsx (~1360 ln)  # the entire app: CSS-in-JS, calc, all tabs,
                                 #   sub-components (Kpi, MoneyList, NetWorthChart, AllocChart,
                                 #   CategoryDonut, GoalAdder, RetirementView)
public/                          # static assets (data.js demo, video/)
```

Most edits happen in **`FinanceDashboard.jsx`** (UI/logic) and **`i18n.jsx`** (all
user-facing text). When you add a UI string, add it to **all 5 locales**.

---

## 3. Architecture notes

- `App.jsx` holds `lang`; `<FinanceDashboard locale={lang} key={lang} />` — the `key`
  forces a full remount on language change. `t = STRINGS[locale]` is the translation bag.
- **Persistence keys** in `localStorage`: `finance:lang` (plain string e.g. `"zh-TW"`,
  NOT JSON), plus per-data keys like `finance:data:v3`. Import/export is JSON via the
  ⋯更多 (More) menu.
- **CSS** is a single template string injected via `<style>{CSS}</style>` inside the
  component. Theme tokens are CSS vars on `:root`:
  `--bg --surface --ink --line --line2 --gold --gold2 --text --muted --dim --green --red --serif --sans`.
- `PIE_COLORS = ["#c2972f","#3c8a5f","#c45c36","#9a8fd6","#6fb0c9","#d6b85a","#897c64"]`.
- **`calc`** (memoized) is the derived-state object used everywhere:
  `{ m, income, expense, net, rate, assets, liab, netWorth, invest, histArr, incFixed, expFixed }`.
  `calc.m = { income[], expenses[] }` for the selected month; `calc.expFixed = Σ recurring.expenses`.
- **Item shape**: `{ id, label, value, category? }`. Categories come from
  `t.cats.expense` / `t.cats.asset` / `t.cats.invest`. NOTE: assets use the **`category`**
  field (a previous bug stored them under `type` — now unified to `category`).

---

## 4. Tabs (current = 4)

1. **總覽 / Overview** — snapshot. 2 KPIs (savings rate, monthly surplus) → plain-language
   insight → **Net-worth card** (composition bar: net worth vs debt + debt-ratio %, with the
   net-worth trend line chart merged in) → **Balance sheet** (asset-mix donut + asset/liability
   lists) → **Financial goals** (progress + ETA, editable). Goals live ONLY here.
2. **現金流 / Cash Flow** — month picker; savings-rate meter (horizontal), income-flow bar,
   spending-breakdown donut, recurring lists, this-month variable lists + variable-spending donut.
3. **投資 / Investments** — allocation donut + holdings list.
4. **退休 / Retirement** — FIRE projection (`RetirementView`): current age, retire age, monthly
   spend, returns/inflation/withdrawal-rate; "fill from my data" helper.

(Net Worth was previously its own tab; it was merged into Overview. The `networth` i18n keys
still exist but are unused — harmless.)

Reusable chart components: `NetWorthChart` (line), `AllocChart` (portfolio donut),
`CategoryDonut({items, cur, t, fallback})` (generic category donut — used for expenses & assets).

---

## 5. Guided fill (引導填寫)

Bottom-right ✦ FAB opens a step-by-step Q&A modal driven by `QUESTIONS` (in i18n, per locale).
Each question has a `target` describing where the answer is written (e.g.
`{ type: "recurring_expense", category: cats.expense[0] }`, `{ type: "asset", assetType: cats.asset[1] }`,
`{ type: "retire", key: "currentAge" }`). The apply logic is in `FinanceDashboard.jsx`
(search `tg.type ===`). A previous conversational **voice-assistant** feature was fully removed,
but three lighter voice features remain: (1) the guided-fill **🎤 mic** (Web Speech
`SpeechRecognition`) that fills the highlighted blank from spoken numbers, (2) the header
**🔊 Voice recap** (Web Speech `speechSynthesis`) that reads the financial story aloud, and
(3) the **🎙️ global voice command** on the single bottom-right FAB. Both
degrade gracefully (no-op / alert) on browsers without Web Speech support.

**One FAB, two gestures.** There is a single floating action button (`.fab`, the element the tour
highlights). When voice is supported for the locale (en/zh-TW/zh-CN), a **short tap** starts voice
(`startVoice`) and a **long-press (≥500ms)** opens guided fill (`openQA`) — handled by
`fabPressStart/fabPressEnd/fabPressCancel` via pointer events (`fabHoldRef`/`fabLongRef`), with
`t.fabHint` as the tooltip. For typing-only locales (ja/ko, `voice === null`) the FAB falls back to
a plain `onClick={openQA}` (✦ icon). The old stacked ✦ + 🎙️ two-FAB layout (`.fab-cmd`) is gone.

### 5c. Global voice command (🎙️)

`VOICE[locale].parser.parseCommand(text)` (in `i18n.jsx`, only en / zh-TW / zh-CN; ja/ko are
typing-only) turns a free-form sentence into `{ action, bucket, items[] }` and the 🎙️ FAB applies
it WITHOUT opening edit mode, across any tab. One sentence can fill **multiple same-bucket items**
(via `splitMultiLabelAmount`). Buckets: `recurring_income`, `recurring_expense`, `month_income`,
`month_expense`, `asset`, `liability`, `portfolio`. Saying a **this-month / 本月 / variable** word
routes income/expense to the monthly ledger (`data.months[month]`) instead of fixed `recurring`;
otherwise it's a fixed recurring item. `applyVoiceCommand` in `FinanceDashboard.jsx` writes the
buckets and `setTab`s to the relevant tab; a `.vc-toast` shows what was heard/added. Gotchas the
parser handles: ASR thousands-separator commas are stripped before splitting (so "10,000" stays
10000), and bare-digit multi-items are broken on digit→CJK boundaries. All copy is per-locale
(`vcTitle, vcHint, vcListening, vcBuckets, vcAdded, vcNav, vcNoBucket, vcUnrecognized`).

**Single shared recognizer.** The guided-fill 🎤 mic and the global 🎙️ FAB are NOT two engines —
they share ONE `SpeechRecognition` (`startVoice()` / `stopVoice()` / `recogRef` / `listening`).
`onVoiceFinal(txt)` routes by context: if the guided-fill modal is open (`chatOpen && !qaDone`) it
calls `fillFromSpeech` (fill the active blank); otherwise it runs `parseCommand` → `applyVoiceCommand`.
Errors route via `voiceErr` (in-form `speechErr` when the modal is open, else a `.vc-toast`). This
avoids two recognizers fighting over the mic.

### 5b. Guided product tour (導覽)

Spotlight onboarding tour in `FinanceDashboard.jsx` (`Tour` component + `TOUR_SELECTORS`).
7 steps highlight chrome elements by CSS selector (`.fd-tabs`, `.fd-net`, `.fab`, `.more-wrap`,
`[data-tour='lang']` — the last lives in `App.jsx`). Auto-opens once on first visit
(localStorage `finance:tour:v1`), and is replayable from **⋯ More → Replay tour**. All copy is
in each locale's `t.tour` ({ menu, next, back, skip, done, stepOf, steps[] }).

---

## 6. Conventions / gotchas

- **Always add new UI strings to all 5 locales** in `i18n.jsx`.
- `localStorage.getItem("finance:lang")` is a **plain string**, do not `JSON.parse` it.
- CSS stacking: `animation: ... both` (fill-mode `both`) creates a permanent stacking context —
  it once trapped the ⋯更多 dropdown; `.fd-head` has `position:relative; z-index:30` to fix it.
- The bottom-right FAB is hidden while a modal is open.
- Run `npm run build` after edits to type-check the JSX compiles.
- **Header headline number is tab-contextual** (`headStat` in `FinanceDashboard.jsx`, just
  before the main `return`): net worth on Overview/Retirement, `calc.net` (monthly surplus)
  on Cash Flow, `calc.invest` (total invested) on Investments. Uses `.fd-net-label` /
  `.fd-net` (CSS uppercases the label).
- **Guided fill is append-only** (`applyUpdates` spreads `[...prev, ...new]`, never deletes;
  blank inputs are skipped). The modal shows `t.quickAppendNote` to make this explicit.
- **Investments "Share of assets"** = `calc.invest / calc.assets` (clamped to 100%). Holdings
  and balance-sheet assets are meant to be kept in sync (`t.investNote`), NOT separate ledgers.

---

## 7. Live / repo

- Repo: **public** GitHub `PLH09/wealth-mosaic` (branch `main`).
- Live: https://finance-dashboard-phi-gules.vercel.app
- Last shared commit baseline: `ed3b663`. Many UI changes after it (language selector
  restyle, removed budget block, cash-flow redesign, savings meter, tab consolidation,
  Overview visual redesign) are now committed & pushed — always `git log` for the latest.
- Recent UX passes (all committed/pushed): guided tour + 11 clarity fixes (`7323485`),
  cross-tab consistency in retirement sample & investments note (`1c0823c`), consistent
  empty-state CTAs + guided-fill append note + Export discoverability (`5ac7853`),
  tab-contextual header number (`7452ebd`). A second first-time-user re-check (incl. zh-TW)
  found the numbers internally consistent and the i18n changes rendering cleanly in all locales.
- **Sample data feature fully removed** (`906918e`): the "Load sample" ⋯ More action, the
  per-locale `sample()` data generator, and every mention of sample data (tour copy,
  empty-state insights, story blank-page text) are gone. Onboarding is now guided-fill only.
