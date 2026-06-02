/* ============ data, finance math, i18n ============ */
(function(){
  "use strict";

  // ---- formatting ----
  function fmt(n){
    n = Math.round(Number(n)||0);
    return n.toLocaleString('en-US');
  }
  function money(n){ return '$ ' + fmt(n); }
  function compact(n){
    n = Number(n)||0;
    var a = Math.abs(n);
    if(a>=1e6) return (n/1e6).toFixed(a>=1e7?0:1).replace(/\.0$/,'')+'M';
    if(a>=1e3) return (n/1e3).toFixed(a>=1e4?0:1).replace(/\.0$/,'')+'K';
    return String(Math.round(n));
  }

  // ---- option lists ----
  var EXPENSE_CATS = ['Housing','Insurance','Subscriptions','Food','Transport','Utilities','Health','Entertainment','Other'];
  var ASSET_TYPES  = ['Cash','Investment','Property','Vehicle','Other'];
  var HOLDING_CATS = ['US Stocks','ETF','Crypto','Bonds','Intl Stocks','Cash','Other'];

  // ---- sample (matches the screenshots) ----
  function sampleData(){
    return {
      month:'2026-06',
      assets:[
        {id:uid(),name:'Checking account',type:'Cash',amount:9000},
        {id:uid(),name:'Brokerage',type:'Investment',amount:17000},
        {id:uid(),name:'Emergency fund',type:'Cash',amount:5000},
      ],
      liabilities:[
        {id:uid(),name:'Credit card',amount:700},
        {id:uid(),name:'Student loan',amount:6000},
      ],
      recurringIncome:[ {id:uid(),name:'Salary',amount:6000} ],
      recurringExpenses:[
        {id:uid(),name:'Rent',cat:'Housing',amount:1800},
        {id:uid(),name:'Insurance',cat:'Insurance',amount:250},
        {id:uid(),name:'Streaming',cat:'Subscriptions',amount:45},
      ],
      extraIncome:[ {id:uid(),name:'Freelance',amount:600} ],
      variableSpending:[
        {id:uid(),name:'Groceries',cat:'Food',amount:700},
        {id:uid(),name:'Transport',cat:'Transport',amount:180},
        {id:uid(),name:'Dining out',cat:'Food',amount:300},
      ],
      holdings:[
        {id:uid(),name:'VOO S&P 500',cat:'ETF',amount:7000},
        {id:uid(),name:'Apple',cat:'US Stocks',amount:5300},
        {id:uid(),name:'VXUS',cat:'ETF',amount:3000},
        {id:uid(),name:'Bitcoin',cat:'Crypto',amount:2000},
      ],
      goals:[
        {id:uid(),name:'First $100K',target:100000,saved:74800},
        {id:uid(),name:'Travel fund',target:4000,saved:1500},
      ],
      retirement:{ age:30, retireAge:60, currentAssets:31000, monthly:1200, ret:6, infl:2, spend:3500, swr:4 },
    };
  }

  function emptyData(){
    return {
      month:'2026-06',
      assets:[], liabilities:[], recurringIncome:[], recurringExpenses:[],
      extraIncome:[], variableSpending:[], holdings:[], goals:[],
      retirement:{ age:30, retireAge:60, currentAssets:0, monthly:0, ret:6, infl:2, spend:3500, swr:4 },
    };
  }

  function uid(){ return 'i'+Math.random().toString(36).slice(2,9); }
  function sum(arr){ return (arr||[]).reduce(function(a,b){return a+(Number(b.amount)||0);},0); }

  // ---- derived model ----
  function compute(d){
    var totalAssets = sum(d.assets);
    var totalDebt   = sum(d.liabilities);
    var netWorth    = totalAssets - totalDebt;

    var income   = sum(d.recurringIncome) + sum(d.extraIncome);
    var spending = sum(d.recurringExpenses) + sum(d.variableSpending);
    var surplus  = income - spending;
    var savingsRate = income>0 ? Math.round((surplus/income)*100) : 0;

    var budget = sum(d.recurringExpenses);
    var investments = sum(d.holdings);

    // allocation by holding category
    var allocMap = {};
    (d.holdings||[]).forEach(function(h){ allocMap[h.cat]=(allocMap[h.cat]||0)+(Number(h.amount)||0); });
    var alloc = Object.keys(allocMap).map(function(k){ return {name:k,value:allocMap[k]}; })
      .sort(function(a,b){return b.value-a.value;});

    // net worth trend: 5 prior synthetic months ending at current netWorth
    var trend = [];
    var months = ['26-01','26-02','26-03','26-04','26-05','26-06'];
    var deltas = [5200,4300,3100,1900,1000,0];
    for(var i=0;i<6;i++){ trend.push({label:months[i], value: netWorth - deltas[i]}); }

    return {
      totalAssets:totalAssets, totalDebt:totalDebt, netWorth:netWorth,
      income:income, spending:spending, surplus:surplus, savingsRate:savingsRate,
      budget:budget, budgetOver:spending-budget, investments:investments,
      alloc:alloc, trend:trend,
    };
  }

  // goal eta in months from surplus
  function goalEta(goal, surplus){
    var remaining = Math.max(0, (Number(goal.target)||0) - (Number(goal.saved)||0));
    if(remaining<=0) return {months:0, done:true};
    if(surplus<=0) return {months:Infinity, done:false};
    return {months: Math.ceil(remaining/surplus), done:false};
  }
  function etaDate(months){
    if(!isFinite(months)) return null;
    var d = new Date(2026,5,1); // Jun 2026 base
    d.setMonth(d.getMonth()+months);
    return d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
  }

  // ---- retirement projection ----
  function retire(r){
    var years = Math.max(0,(Number(r.retireAge)||0)-(Number(r.age)||0));
    var rm = (Number(r.ret)||0)/100/12;
    var infl = (Number(r.infl)||0)/100;
    var swr = (Number(r.swr)||4)/100;
    var P = Number(r.currentAssets)||0;
    var c = Number(r.monthly)||0;
    var spend = Number(r.spend)||0;

    function fv(yrs){
      var m = yrs*12;
      var grow = Math.pow(1+rm,m);
      var fvP = P*grow;
      var fvC = rm>0 ? c*((grow-1)/rm) : c*m;
      return fvP+fvC;
    }
    function needed(yrs){
      var annual = spend*Math.pow(1+infl,yrs)*12;
      return swr>0 ? annual/swr : 0;
    }
    var projected = fv(years);
    var need = needed(years);
    var shortfall = need - projected;

    // build curves + find freedom age
    var assetsCurve=[], needCurve=[], freedomAge=null;
    for(var y=0;y<=years;y++){
      var a=fv(y), n=needed(y);
      assetsCurve.push(a); needCurve.push(n);
      if(freedomAge===null && a>=n) freedomAge=(Number(r.age)||0)+y;
    }
    return {
      years:years, projected:projected, needed:need, shortfall:shortfall,
      onTrack: projected>=need, freedomAge:freedomAge,
      assetsCurve:assetsCurve, needCurve:needCurve, startAge:Number(r.age)||0,
    };
  }

  // ---- i18n ----
  var ZH = {
    "PERSONAL WEALTH":"個人財富",
    "Wealth Mosaic":"財富拼圖",
    "Your data stays in your browser — nothing is uploaded. Use “Export” to back up anytime.":"您的資料保存在瀏覽器中——不會上傳。可隨時使用「匯出」進行備份。",
    "CURRENT NET WORTH":"目前淨資產",
    "Guided fill":"引導填寫","Voice recap":"語音回顧","Load sample":"載入範例","Export":"匯出","Import":"匯入","Clear":"清除",
    "Overview":"總覽","Cash Flow":"現金流","Net Worth":"淨資產","Investments & Goals":"投資與目標","Retirement":"退休規劃",
    "NET WORTH":"淨資產","SAVINGS RATE":"儲蓄率","MONTHLY SURPLUS":"每月結餘","INVESTMENTS":"投資",
    "Excellent":"優秀","Good":"良好","Fair":"普通","Low":"偏低",
    "holdings":"項持倉","Income":"收入","Spend":"支出","Assets":"資產","Debt":"負債","savings rate":"儲蓄率","is about":"大約還需",
    "At your current surplus of":"以目前每月結餘","Savings rate":"儲蓄率",
    "Net Worth Trend":"淨資產趨勢","Auto-recorded on each update":"每次更新自動記錄","Goal Progress":"目標進度",
    "Target":"目標","away":"後達成","months":"個月","month":"個月",
    "Savings Rate":"儲蓄率","Share of income you keep after spending":"支出後留存的收入比例","Month":"月份",
    "Total income":"總收入","Total spending":"總支出","Monthly surplus":"每月結餘",
    "Budget vs Actual":"預算 vs 實際","Recurring expenses as budget, vs this month's actual spend (incl. variable)":"以經常性支出為預算，對比本月實際支出（含變動支出）",
    "Actual":"實際","Budget":"預算","over":"超支","under":"結餘",
    "Recurring Items":"經常性項目","Set once, auto-applied every month":"設定一次，每月自動套用",
    "RECURRING INCOME":"經常性收入","RECURRING EXPENSES":"經常性支出",
    "This Month":"本月","One-off income/spending for this month":"本月一次性收支",
    "EXTRA INCOME":"額外收入","VARIABLE SPENDING":"變動支出",
    "Name":"名稱","Amount":"金額","Add":"新增",
    "TOTAL ASSETS":"總資產","TOTAL DEBT":"總負債","Assets":"資產","Liabilities":"負債",
    "Allocation":"資產配置","Holdings":"持倉","Financial Goals":"財務目標","ETA estimated from your monthly surplus":"依每月結餘估算達成時間",
    "Goal name":"目標名稱","Target amount":"目標金額","Saved so far":"已存金額","Add goal":"新增目標","by":"預計",
    "Retirement Inputs":"退休參數","years until retirement":"年後退休","Use current numbers":"使用目前數據",
    "CURRENT AGE":"目前年齡","TARGET RETIRE AGE":"目標退休年齡","CURRENT RETIREMENT ASSETS":"目前退休資產","MONTHLY CONTRIBUTION":"每月投入",
    "ANNUAL RETURN":"年化報酬","INFLATION":"通膨率","MONTHLY SPEND IN RETIREMENT":"退休後每月支出","SAFE WITHDRAWAL RATE":"安全提領率",
    "today's prices":"以今日價格","yrs":"歲",
    "Compound growth uses your annual return; the amount needed is derived from the safe withdrawal rate (the 4% rule), with monthly spending inflated to your retirement year. These are planning assumptions, not investment advice.":"複利成長基於年化報酬；所需金額依安全提領率（4% 法則）推算，每月支出依通膨折算至退休當年。以上為規劃假設，非投資建議。",
    "PROJECTED AT RETIREMENT":"退休時預計","NEEDED TO RETIRE":"退休所需","SHORTFALL":"缺口","SURPLUS":"盈餘","FINANCIAL FREEDOM":"財務自由",
    "4% rule + inflation":"4% 法則 + 通膨","Adjust":"需調整","On track":"達標","not reached by retirement":"退休時未達成","reached":"已達成",
    "Assets vs Amount needed":"資產 vs 所需金額","Where the lines cross = financial freedom":"兩線相交即財務自由","Projected assets":"預計資產","Amount needed":"所需金額",
    "Note: holdings here are a current snapshot you update manually. They are tracked separately from the Net Worth tab — if you also list investments there, avoid double-counting. This tool only tracks; investment decisions are your own or for a professional to advise on.":"注意：此處持倉為手動更新的目前快照，與「淨資產」分頁分開統計——若您在那裡也列出了投資，請避免重複計算。本工具僅供記錄；投資決策由您本人或專業人士負責。",
    // categories
    "Housing":"住房","Insurance":"保險","Subscriptions":"訂閱","Food":"餐飲","Transport":"交通","Utilities":"水電","Health":"醫療","Entertainment":"娛樂","Other":"其他",
    "Cash":"現金","Investment":"投資","Property":"房產","Vehicle":"車輛",
    "US Stocks":"美股","ETF":"ETF","Crypto":"加密貨幣","Bonds":"債券","Intl Stocks":"國際股票",
    // guided / recap / modals
    "Welcome to Personal Wealth":"歡迎使用個人財富",
    "Three steps to your first picture of your finances. Nothing leaves your browser.":"三步描繪您的財務全貌。所有資料都不離開瀏覽器。",
    "List what you own & owe":"列出您的資產與負債","Add accounts, then debts on the Net Worth tab.":"在「淨資產」分頁新增帳戶與債務。",
    "Set recurring income & bills":"設定經常性收支","On Cash Flow — they auto-apply every month.":"在「現金流」中設定——每月自動套用。",
    "Name a goal or two":"設定一兩個目標","Watch the ETA update from your surplus.":"依結餘即時估算達成時間。",
    "Start with sample data":"從範例資料開始","Start blank":"從空白開始",
    "Your money, spoken plainly":"用白話說清您的錢",
    "Close":"關閉","Clear everything?":"清除全部資料？","This removes all data from this browser. This can't be undone.":"這將刪除本瀏覽器中的全部資料，操作無法復原。","Cancel":"取消","Yes, clear":"確認清除",
    "Nothing here yet.":"尚無資料。",
    "Data exported":"資料已匯出","Sample loaded":"已載入範例","Data imported":"資料已匯入","Couldn't read that file":"無法讀取此檔案","All cleared":"已全部清除",
    "Ask anything about your money":"詢問任何關於您財務的問題",
    "Your net worth is":"您的淨資產為","up":"成長","over the last six months.":"較過去六個月。",
    "You keep":"您留存了","of every dollar you earn — that's":"的收入——這屬於",
    "Your biggest goal,":"您最大的目標","is":"已完成","funded.":"。",
    "of every dollar you earn.":"的收入。",
    "You are on track":"您已步上軌道","to reach financial freedom.":"，可實現財務自由。",
    "You fall short by":"您將短少","at retirement — adjust to close the gap.":"（退休時）——請調整以彌補缺口。",
  };

  function makeT(lang){
    return function(s){
      if(lang==='zh' && ZH[s]!=null) return ZH[s];
      return s;
    };
  }

  window.WD = {
    fmt:fmt, money:money, compact:compact, uid:uid, sum:sum,
    sampleData:sampleData, emptyData:emptyData, compute:compute,
    goalEta:goalEta, etaDate:etaDate, retire:retire, makeT:makeT,
    EXPENSE_CATS:EXPENSE_CATS, ASSET_TYPES:ASSET_TYPES, HOLDING_CATS:HOLDING_CATS,
  };
})();
