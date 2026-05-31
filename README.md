# Wealth Dashboard · 資產儀表板

A personal finance dashboard built with React + Vite. Tracks cash flow, savings
rate, net worth, investment allocation, financial goals, and retirement
projection — with a guided question-and-answer fill (typing or voice).

繁中與英文雙版本,右下角可切換語言。

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 — it opens automatically.

To build for production:

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Project structure

```
finance-app/
├─ index.html
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.jsx                       # entry point
   ├─ App.jsx                        # language toggle (zh / en)
   ├─ index.css                      # global reset + body background
   └─ components/
      ├─ FinanceDashboard.zh.jsx     # 中文版
      └─ FinanceDashboard.en.jsx     # English version
```

If you only want one language, import a single component in `App.jsx` and
delete the toggle.

## Data persistence

All data is stored in the browser via **localStorage** (see the `store` object
near the top of each dashboard component). It persists across reloads on the
same browser/device but is not synced anywhere.

To enable multi-device sync, replace the `store.get` / `store.set` methods with
calls to your own backend API. The rest of the app does not need to change.

```js
const store = {
  async get(k) {
    const res = await fetch(`/api/state/${k}`);
    if (!res.ok) return null;
    return (await res.json()).value;
  },
  async set(k, v) {
    await fetch(`/api/state/${k}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: v }),
    });
  },
};
```

## Voice input

The guided fill supports voice via the browser's native Web Speech API
(`SpeechRecognition`). It works best in Chrome and Safari, and asks for
microphone permission the first time. The English build understands spoken
English numbers ("seventy thousand", "1.5 million", "70k"); the Chinese build
understands spoken Chinese numbers (七萬、三十五萬、1.5萬). Typing always works
as a fallback.

## Notes

- No backend, no accounts, no tracking — everything runs in the browser.
- This tool only **tracks** finances. It does not give investment advice; any
  financial decisions are your own or for a professional to advise on.
