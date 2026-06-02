/* ============ Wealth Mosaic — video composition ============ */

const ALLOC_COLORS = { 'ETF':COL.gold, 'US Stocks':COL.green, 'Crypto':COL.coral, 'Bonds':'#9a86c2', 'Intl Stocks':'#6fa8c2', 'Cash':'#c2b58f', 'Other':COL.muted };

function Svg({ children }){
  return <svg width="1920" height="1080" style={{position:'absolute',inset:0,overflow:'visible'}}>{children}</svg>;
}

/* ---------- background atmosphere ---------- */
function GlowBg(){
  const time = useTime();
  const dx = Math.sin(time*0.12)*40, dy = Math.cos(time*0.1)*26;
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',
      background:`radial-gradient(1300px 880px at ${20+dx/20}% ${-6+dy/20}%, rgba(194,151,47,0.12), transparent 60%),
                  radial-gradient(1000px 700px at 92% 8%, rgba(255,255,255,0.5), transparent 55%)`}}/>
  );
}
function Vignette(){
  return <div style={{position:'absolute',inset:0,pointerEvents:'none',
    background:'radial-gradient(120% 120% at 50% 46%, transparent 58%, rgba(140,110,40,0.14) 100%)'}}/>;
}

/* ---------- persistent app frame (scenes 2–6) ---------- */
function TabBar({ pos }){
  const refs = React.useRef([]);
  const [rects,setRects] = React.useState([]);
  React.useEffect(()=>{ setRects(refs.current.map(el=>el?{l:el.offsetLeft,w:el.offsetWidth}:null)); },[]);
  const lo=Math.max(0,Math.floor(pos)), hi=Math.min(TABS.length-1,Math.ceil(pos)), fr=pos-lo;
  const a=rects[lo], b=rects[hi];
  const ux = a&&b? a.l+(b.l-a.l)*fr : (a?a.l:0);
  const uw = a&&b? a.w+(b.w-a.w)*fr : (a?a.w:0);
  return (
    <div style={{position:'absolute', left:CX, top:FY+150, display:'flex', gap:46}}>
      {TABS.map((tb,i)=>{
        const active = Math.abs(pos-i)<0.5;
        return <div key={i} ref={el=>refs.current[i]=el}
          style={{fontFamily:SANS, fontSize:27, fontWeight:active?600:500, color:active?COL.ivory:COL.muted}}>{tb}</div>;
      })}
      {a && <div style={{position:'absolute', left:ux, top:48, width:uw, height:3, borderRadius:2,
        background:`linear-gradient(90deg,${COL.gold},${COL.goldSoft})`}}/>}
    </div>
  );
}

function Frame(){
  const time = useTime();
  const pos = interpolate([8.7,9.2, 12.9,13.4, 17.2,17.7, 21.5,22.0],[0,1, 1,2, 2,3, 3,4], Easing.easeInOutCubic)(time);
  return (
    <Scene start={4.3} end={26.2} fade={0.45} drift={0.01}>
      <div style={{position:'absolute',left:FX,top:FY,width:FW,height:FH,
        background:'linear-gradient(180deg,#fffefb,#f6efdf)', border:`1px solid ${COL.border}`,
        borderRadius:30, boxShadow:'0 60px 150px -50px rgba(140,110,40,.28)'}}/>
      <div style={{position:'absolute',left:CX,top:FY+40}}>
        <Label style={{fontSize:16,color:COL.goldSoft,letterSpacing:'0.3em'}}>PERSONAL WEALTH</Label>
        <div style={{fontFamily:SERIF,fontSize:42,fontWeight:700,color:COL.ivory,marginTop:8,whiteSpace:'nowrap'}}>Wealth Mosaic</div>
      </div>
      <div style={{position:'absolute',left:FX+FW-414,top:FY+48,width:360,textAlign:'right'}}>
        <Label style={{fontSize:15,letterSpacing:'0.22em'}}>CURRENT NET WORTH</Label>
        <div style={{fontFamily:SERIF,fontSize:46,fontWeight:700,color:COL.ivory,marginTop:6}}>
          <span style={{color:COL.gold,fontWeight:600}}>$ </span><CountUp to={MOD.netWorth} at={4.8} dur={1.5}/>
        </div>
      </div>
      <TabBar pos={pos}/>
      <div style={{position:'absolute',left:CX,top:FY+214,width:CW,height:1,background:COL.hair}}/>
    </Scene>
  );
}

/* ---------- stat card ---------- */
function StatV({ i, n=4, at, label, value, prefix='$', tone, sub }){
  const gap=22, w=(CW-(n-1)*gap)/n, x=CX+i*(w+gap), y=CTOP;
  return (
    <In at={at} dur={0.6} y={28} style={{position:'absolute',left:x,top:y,width:w,height:182}}>
      <div style={{width:'100%',height:'100%',boxSizing:'border-box',
        background:'linear-gradient(165deg,#fffefb,#f3ead5)', border:`1px solid ${COL.border}`,
        borderRadius:18, padding:'26px 28px', boxShadow:'0 18px 40px -28px rgba(140,110,40,.35)'}}>
        <Label style={{fontSize:15}}>{label}</Label>
        <div style={{fontFamily:SERIF,fontSize:46,fontWeight:700,marginTop:18,color:tone||COL.ivory,letterSpacing:'.5px'}}>
          {prefix?<span style={{fontSize:'0.78em',opacity:.9}}>{prefix} </span>:null}{value}
        </div>
        {sub?<div style={{fontFamily:SANS,fontSize:17,color:COL.muted2,marginTop:16}}>{sub}</div>:null}
      </div>
    </In>
  );
}

/* ---------- SCENE: Overview ---------- */
function SceneOverview(){
  const tv = MOD.trend.map(p=>p.value);
  return (
    <Scene start={4.6} end={9.05} fade={0.4}>
      <StatV i={0} at={4.9} label="NET WORTH" value={<CountUp to={MOD.netWorth} at={5.0} dur={1.3}/>}
        sub="Assets 31.0K – Debt 6.7K"/>
      <StatV i={1} at={5.05} label="SAVINGS RATE" prefix="" tone={COL.green}
        value={<CountUp to={MOD.savingsRate} at={5.15} dur={1.2} suffix="%"/>} sub="Excellent ✦"/>
      <StatV i={2} at={5.2} label="MONTHLY SURPLUS" tone={COL.green}
        value={<CountUp to={MOD.surplus} at={5.3} dur={1.3}/>} sub="Income 6.6K / Spend 3.3K"/>
      <StatV i={3} at={5.35} label="INVESTMENTS"
        value={<CountUp to={MOD.investments} at={5.45} dur={1.3}/>} sub="4 holdings"/>

      <In at={5.4} dur={0.6} style={{position:'absolute',left:CX,top:CTOP+212}}>
        <Label style={{fontSize:16}}>Net Worth Trend</Label>
      </In>
      <Svg>
        <ChartLine box={{x:CX+8,y:CTOP+256,w:CW-16,h:196}} values={tv}
          minV={MOD.netWorth-9500} maxV={MOD.netWorth+2200} color={COL.gold} at={5.6} dur={1.7} dots dotAt={5.7}/>
      </Svg>
    </Scene>
  );
}

/* ---------- SCENE: Cash Flow ---------- */
function SceneCashFlow(){
  const dcx=CX+180, dcy=CTOP+158, r=118;
  const rowsX=CX+430, rowsW=CW-430;
  const Row=({i,at,k,v,tone,bold})=>(
    <In at={at} dur={0.55} x={24} style={{position:'absolute',left:rowsX,top:CTOP+12+i*92,width:rowsW,
      display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px dashed ${COL.hair}`,paddingBottom:18}}>
      <span style={{fontFamily:SANS,fontSize:30,color:bold?COL.ivory:COL.text,fontWeight:bold?700:400}}>{k}</span>
      <span style={{fontFamily:SERIF,fontSize:34,color:tone||COL.ivory,fontWeight:bold?700:600}}>$ {v}</span>
    </In>
  );
  return (
    <Scene start={9.05} end={13.25} fade={0.4}>
      <Svg><Ring cx={dcx} cy={dcy} r={r} stroke={30} frac={0.5} color={COL.gold} at={9.4} dur={1.3}/></Svg>
      <In at={9.9} dur={0.5} style={{position:'absolute',left:dcx-110,top:dcy-46,width:220,textAlign:'center'}}>
        <div style={{fontFamily:SERIF,fontSize:62,fontWeight:700,color:COL.green}}>50%</div>
      </In>
      <In at={10.0} dur={0.5} style={{position:'absolute',left:dcx-130,top:dcy+88,width:260,textAlign:'center'}}>
        <Label style={{fontSize:15}}>Savings Rate</Label>
      </In>
      <Row i={0} at={9.6}  k="Total income"   v={<CountUp to={MOD.income} at={9.7} dur={1.1}/>} tone={COL.green}/>
      <Row i={1} at={9.78} k="Total spending" v={<CountUp to={MOD.spending} at={9.88} dur={1.1}/>} tone={COL.coral}/>
      <Row i={2} at={9.96} k="Monthly surplus" v={<CountUp to={MOD.surplus} at={10.06} dur={1.1}/>} bold/>

      <In at={10.6} dur={0.6} style={{position:'absolute',left:CX,top:CTOP+318}}>
        <Label style={{fontSize:16}}>Budget vs Actual</Label>
      </In>
      <Svg><GrowBar x={CX} y={CTOP+360} w={CW} h={16} frac={1} color={COL.coral} at={10.9} dur={1.0}/></Svg>
      <In at={11.2} dur={0.6} style={{position:'absolute',left:CX,top:CTOP+392,width:CW,display:'flex',justifyContent:'space-between'}}>
        <span style={{fontFamily:SANS,fontSize:22,color:COL.muted}}>Actual $ 3,275 / Budget $ 2,095</span>
        <span style={{fontFamily:SANS,fontSize:22,color:COL.coral}}>$ 1,180 over</span>
      </In>
    </Scene>
  );
}

/* ---------- SCENE: Net Worth ---------- */
function SceneNetWorth(){
  const tv = MOD.trend.map(p=>p.value);
  const Num=({i,at,label,value,tone})=>{
    const w=(CW-2*30)/3, x=CX+i*(w+30);
    return <In at={at} dur={0.6} y={24} style={{position:'absolute',left:x,top:CTOP,width:w}}>
      <Label style={{fontSize:15}}>{label}</Label>
      <div style={{fontFamily:SERIF,fontSize:54,fontWeight:700,color:tone||COL.ivory,marginTop:12}}>
        <span style={{fontSize:'0.74em',opacity:.9}}>$ </span>{value}</div>
    </In>;
  };
  return (
    <Scene start={13.25} end={17.55} fade={0.4}>
      <Num i={0} at={13.5} label="TOTAL ASSETS" tone={COL.green} value={<CountUp to={MOD.totalAssets} at={13.6} dur={1.2}/>}/>
      <Num i={1} at={13.62} label="TOTAL DEBT" tone={COL.coral} value={<CountUp to={MOD.totalDebt} at={13.72} dur={1.2}/>}/>
      <Num i={2} at={13.74} label="NET WORTH" value={<CountUp to={MOD.netWorth} at={13.84} dur={1.2}/>}/>
      <Svg>
        <ChartLine box={{x:CX+8,y:CTOP+168,w:CW-16,h:280}} values={tv}
          minV={MOD.netWorth-10500} maxV={MOD.netWorth+2500} color={COL.gold} at={13.9} dur={1.9} width={3.5} dots dotAt={14.0}/>
      </Svg>
    </Scene>
  );
}

/* ---------- SCENE: Investments ---------- */
function SceneInvest(){
  const dcx=CX+170, dcy=CTOP+170, r=120;
  const segs = MOD.alloc.map(a=>({frac:a.value/MOD.investments, color:ALLOC_COLORS[a.name]||COL.muted, name:a.name}));
  const legendX=CX+330;
  const holdX=CX+720, holdW=CW-720;
  return (
    <Scene start={17.55} end={21.85} fade={0.4}>
      <Svg><DonutSegments cx={dcx} cy={dcy} r={r} stroke={30} segs={segs} at={17.9} stagger={0.28} dur={0.7}/></Svg>
      <In at={17.95} dur={0.5} style={{position:'absolute',left:dcx-120,top:dcy-44,width:240,textAlign:'center'}}>
        <div style={{fontFamily:SERIF,fontSize:40,fontWeight:700,color:COL.ivory}}>$ 17.3K</div>
        <Label style={{fontSize:13,marginTop:4}}>Invested</Label>
      </In>
      {segs.map((s,i)=>(
        <In key={i} at={18.1+i*0.18} dur={0.5} x={20} style={{position:'absolute',left:legendX,top:CTOP+58+i*78,width:300,
          display:'flex',alignItems:'center',gap:16}}>
          <span style={{width:16,height:16,borderRadius:4,background:s.color}}/>
          <span style={{fontFamily:SANS,fontSize:28,color:COL.text,flex:1}}>{s.name}</span>
          <span style={{fontFamily:SANS,fontSize:28,color:COL.muted}}>{Math.round(s.frac*100)}%</span>
        </In>
      ))}
      <In at={18.05} dur={0.5} style={{position:'absolute',left:holdX,top:CTOP-2}}><Label style={{fontSize:16}}>Holdings</Label></In>
      {DATA.holdings.map((h,i)=>(
        <In key={h.id} at={18.3+i*0.16} dur={0.5} x={26} style={{position:'absolute',left:holdX,top:CTOP+46+i*86,width:holdW,
          display:'flex',alignItems:'center',gap:14,borderBottom:`1px dashed ${COL.hair}`,paddingBottom:18}}>
          <span style={{fontFamily:SANS,fontSize:28,color:COL.ivory}}>{h.name}</span>
          <span style={{fontFamily:SANS,fontSize:17,color:COL.goldSoft,background:'rgba(194,151,47,.12)',border:`1px solid rgba(194,151,47,.26)`,padding:'3px 11px',borderRadius:7}}>{h.cat}</span>
          <span style={{flex:1}}/>
          <span style={{fontFamily:SERIF,fontSize:32,color:COL.ivory}}>$ {fmt(h.amount)}</span>
        </In>
      ))}
    </Scene>
  );
}

/* ---------- SCENE: Retirement ---------- */
function SceneRetire(){
  const Num=({i,at,label,value,tone,sub})=>{
    const w=(CW-2*30)/3, x=CX+i*(w+30);
    return <In at={at} dur={0.6} y={24} style={{position:'absolute',left:x,top:CTOP,width:w}}>
      <Label style={{fontSize:15}}>{label}</Label>
      <div style={{fontFamily:SERIF,fontSize:50,fontWeight:700,color:tone||COL.ivory,marginTop:12}}>
        <span style={{fontSize:'0.74em',opacity:.9}}>$ </span>{value}</div>
      {sub?<div style={{fontFamily:SANS,fontSize:16,color:COL.muted2,marginTop:8}}>{sub}</div>:null}
    </In>;
  };
  return (
    <Scene start={21.85} end={26.15} fade={0.4}>
      <Num i={0} at={22.1} label="PROJECTED AT RETIREMENT" value={<CountUp to={RET.projected} at={22.2} dur={1.6}/>}/>
      <Num i={1} at={22.24} label="NEEDED TO RETIRE" value={<CountUp to={RET.needed} at={22.34} dur={1.6}/>} sub="4% rule + inflation"/>
      <Num i={2} at={22.38} label="SHORTFALL" tone={COL.coral} value={<CountUp to={RET.shortfall} at={22.48} dur={1.6}/>}/>
      <Svg>
        <ChartLine box={{x:CX+8,y:CTOP+168,w:CW-16,h:280}} values={RET.needCurve} minV={0} maxV={2.0e6}
          color={COL.green} at={22.7} dur={1.7} width={3} dashed/>
        <ChartLine box={{x:CX+8,y:CTOP+168,w:CW-16,h:280}} values={RET.assetsCurve} minV={0} maxV={2.0e6}
          color={COL.gold} at={22.9} dur={2.0} width={3.5}/>
      </Svg>
      <In at={24.0} dur={0.6} style={{position:'absolute',left:CX,top:CBOT-2,width:CW,display:'flex',gap:40,justifyContent:'center'}}>
        <span style={{fontFamily:SANS,fontSize:22,color:COL.muted,display:'flex',alignItems:'center',gap:10}}><span style={{width:26,height:0,borderTop:`3px solid ${COL.gold}`}}/>Projected assets</span>
        <span style={{fontFamily:SANS,fontSize:22,color:COL.muted,display:'flex',alignItems:'center',gap:10}}><span style={{width:26,height:0,borderTop:`3px dashed ${COL.green}`}}/>Amount needed</span>
      </In>
    </Scene>
  );
}

/* ---------- SCENE: Voice input (hero feature) ---------- */
function MicPulse({ cx, cy, r=46 }){
  const time = useTime();
  const rings = [0, 0.4, 0.8].map((ph,i)=>{
    const p = ((time*0.62 + ph) % 1);
    return <circle key={i} cx={cx} cy={cy} r={r + p*82} fill="none" stroke={COL.gold} strokeWidth="2" opacity={(1-p)*0.45}/>;
  });
  return (
    <g>
      {rings}
      <circle cx={cx} cy={cy} r={r} fill="url(#micg)" stroke={COL.goldB} strokeWidth="1.5"/>
      {/* mic glyph */}
      <rect x={cx-9} y={cy-20} width={18} height={28} rx={9} fill="#241c0e"/>
      <path d={`M${cx-15} ${cy-2} a15 15 0 0 0 30 0`} fill="none" stroke="#241c0e" strokeWidth="3.2" strokeLinecap="round"/>
      <line x1={cx} y1={cy+13} x2={cx} y2={cy+20} stroke="#241c0e" strokeWidth="3.2" strokeLinecap="round"/>
    </g>
  );
}
function Waveform({ cx, cy, at }){
  const time = useTime();
  const bars = 26, bw = 8, gap = 7, step = bw+gap;
  const x0 = cx - (bars*step - gap)/2;
  const items = [];
  for(let i=0;i<bars;i++){
    const on = clamp((time-at-0.2-i*0.012)/0.3,0,1);
    const speaking = time>at+0.3 && time<at+5.2;
    const amp = speaking ? (12 + Math.abs(Math.sin(time*6.5 + i*0.55))*(16 + (i%4)*9)) : 5;
    const h = 5 + amp*on;
    items.push(<rect key={i} x={x0+i*step} y={cy-h} width={bw} height={h*2} rx={bw/2} fill={COL.gold} opacity={0.35+0.55*on}/>);
  }
  return <g>{items}</g>;
}
function TypeLine({ text, at, dur, style }){
  const time = useTime();
  const t = clamp((time-at)/dur,0,1);
  const n = Math.floor(t*text.length);
  const caret = (time>at && time<at+dur+0.3);
  return <span style={style}>{text.slice(0,n)}<span style={{color:COL.gold,opacity:caret?0.7:0}}>|</span></span>;
}
function VChip({ at, sign, amt, label, color, signColor }){
  return (
    <In at={at} dur={0.5} y={22} sc={0.9} style={{display:'inline-flex'}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:13,background:'rgba(255,254,251,0.94)',
        border:`1px solid ${color}66`,borderRadius:14,padding:'13px 22px',whiteSpace:'nowrap',boxShadow:'0 14px 34px -22px rgba(140,110,40,.4)'}}>
        <span style={{width:22,height:22,borderRadius:'50%',background:color,display:'grid',placeItems:'center',color:'#1a1308',fontSize:14,fontWeight:800,flexShrink:0}}>✓</span>
        <span style={{fontFamily:SERIF,fontSize:30,fontWeight:700,color:signColor,whiteSpace:'nowrap'}}>{sign} $ {amt}</span>
        <span style={{fontFamily:SANS,fontSize:24,color:COL.text,marginLeft:5}}>{label}</span>
      </div>
    </In>
  );
}
function SceneVoice(){
  const card = { x:(1920-1000)/2, y:300, w:1000, h:438 };
  const micX = 960, micY = card.y+96;
  return (
    <Scene start={4.3} end={10.35} fade={0.5} drift={0.012}>
      <In at={4.45} dur={0.6} sc={0.97} style={{position:'absolute',left:card.x,top:card.y,width:card.w,height:card.h}}>
        <div style={{width:'100%',height:'100%',background:'linear-gradient(180deg,#fffefb,#f6efdf)',
          border:`1px solid ${COL.border}`,borderRadius:26,boxShadow:'0 60px 150px -50px rgba(140,110,40,.28)'}}/>
      </In>
      <Svg>
        <defs>
          <radialGradient id="micg" cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#f0d79a"/><stop offset="70%" stopColor="#caa45f"/><stop offset="100%" stopColor="#b08a48"/>
          </radialGradient>
        </defs>
        <MicPulse cx={micX} cy={micY}/>
        <Waveform cx={micX} cy={card.y+232} at={4.8}/>
      </Svg>
      <In at={4.9} dur={0.5} style={{position:'absolute',left:0,right:0,top:card.y+150,textAlign:'center'}}>
        <span style={{fontFamily:SANS,fontSize:21,letterSpacing:'0.26em',textTransform:'uppercase',color:COL.goldSoft,fontWeight:600}}>Listening…</span>
      </In>
      <div style={{position:'absolute',left:card.x+60,right:card.x+60,top:card.y+286,textAlign:'center'}}>
        <TypeLine text={'“Add $600 from freelance and $80 on groceries.”'} at={5.3} dur={2.3}
          style={{fontFamily:SERIF,fontStyle:'italic',fontSize:36,color:COL.ivory,lineHeight:1.3}}/>
      </div>
      <div style={{position:'absolute',left:card.x,top:card.y+352,width:card.w,display:'flex',gap:22,justifyContent:'center'}}>
        <VChip at={8.0} sign="+" amt="600" label="Freelance" color={COL.green} signColor={COL.green}/>
        <VChip at={8.35} sign="–" amt="80" label="Groceries" color={COL.coral} signColor={COL.coral}/>
      </div>
    </Scene>
  );
}

/* ---------- SCENE: Brand open ---------- */
function Hairline({ at, dur, w, top }){
  const time=useTime();
  const t=Easing.easeInOutCubic(clamp((time-at)/dur,0,1));
  return <div style={{position:'absolute',left:'50%',top,transform:'translateX(-50%)',width:w*t,height:2,
    background:`linear-gradient(90deg,transparent,${COL.gold},transparent)`}}/>;
}
function SceneBrand(){
  return (
    <Scene start={0} end={4.65} fade={0.5} drift={0.015}>
      <In at={0.5} dur={0.8} style={{position:'absolute',left:0,right:0,top:386,textAlign:'center'}}>
        <span style={{fontFamily:SANS,fontSize:30,letterSpacing:'0.42em',color:COL.goldSoft,fontWeight:600}}>PERSONAL&nbsp;&nbsp;WEALTH</span>
      </In>
      <In at={1.0} dur={1.0} y={26} style={{position:'absolute',left:0,right:0,top:444,textAlign:'center'}}>
        <span style={{fontFamily:SERIF,fontSize:118,fontWeight:700,color:COL.ivory,letterSpacing:'-1px'}}>Wealth Mosaic</span>
      </In>
      <Hairline at={2.0} dur={1.0} w={460} top={606}/>
      <In at={2.5} dur={0.9} style={{position:'absolute',left:0,right:0,top:648,textAlign:'center'}}>
        <span style={{fontFamily:SANS,fontSize:30,color:COL.muted}}>🔒&nbsp;&nbsp;Your data never leaves your browser.</span>
      </In>
    </Scene>
  );
}

/* ---------- SCENE: Close / bilingual ---------- */
function CrossTitle(){
  const time=useTime();
  const en = clamp((26.6-time)/0.5,0,1) * Easing.easeOutCubic(clamp((time-26.3)/0.6,0,1)) ;
  const enOut = time<27.7 ? Easing.easeOutCubic(clamp((time-26.3)/0.6,0,1)) : Easing.easeInCubic(clamp((28.2-time)/0.5,0,1));
  const zhIn = Easing.easeOutCubic(clamp((time-28.0)/0.6,0,1));
  return (
    <div style={{position:'absolute',left:0,right:0,top:430,textAlign:'center',height:160}}>
      <div style={{position:'absolute',left:0,right:0,opacity:enOut, transform:`translateY(${(1-enOut)*16}px)`}}>
        <span style={{fontFamily:SERIF,fontSize:104,fontWeight:700,color:COL.ivory}}>Wealth Mosaic</span>
      </div>
      <div style={{position:'absolute',left:0,right:0,opacity:zhIn, transform:`translateY(${(1-zhIn)*16}px)`}}>
        <span style={{fontFamily:SERIF,fontSize:104,fontWeight:700,color:COL.ivory}}>財富拼圖</span>
      </div>
    </div>
  );
}
function LangPill(){
  const time=useTime();
  const zh = time>=27.9;
  const seg=(label,on)=>(
    <span style={{padding:'8px 22px',borderRadius:999,fontFamily:SANS,fontSize:24,fontWeight:on?700:500,
      background:on?COL.gold:'transparent',color:on?'#241c0e':COL.muted}}>{label}</span>
  );
  return (
    <In at={26.8} dur={0.6} style={{position:'absolute',left:0,right:0,top:620,textAlign:'center'}}>
      <span style={{display:'inline-flex',gap:4,padding:5,border:`1px solid ${COL.border}`,borderRadius:999,background:'rgba(255,254,251,.7)'}}>
        {seg('中文',zh)}{seg('EN',!zh)}
      </span>
    </In>
  );
}
function SceneClose(){
  return (
    <Scene start={25.9} end={30} fade={0.5} drift={0.012}>
      <In at={26.2} dur={0.7} style={{position:'absolute',left:0,right:0,top:374,textAlign:'center'}}>
        <span style={{fontFamily:SANS,fontSize:26,letterSpacing:'0.42em',color:COL.goldSoft,fontWeight:600}}>PERSONAL&nbsp;&nbsp;WEALTH</span>
      </In>
      <CrossTitle/>
      <LangPill/>
      <In at={28.7} dur={0.9} style={{position:'absolute',left:0,right:0,top:716,textAlign:'center'}}>
        <span style={{fontFamily:SERIF,fontStyle:'italic',fontSize:38,color:COL.goldSoft}}>Private. Personal. Beautifully clear.</span>
      </In>
    </Scene>
  );
}

/* ---------- captions ---------- */
function Caption({ s, e, text }){
  return (
    <Sprite start={s} end={e}>
      {({localTime,duration})=>{
        const tin=Easing.easeOutCubic(clamp(localTime/0.6,0,1));
        const tout=Easing.easeInCubic(clamp((duration-localTime)/0.5,0,1));
        return <div style={{position:'absolute',left:0,right:0,top:998,textAlign:'center',
          opacity:Math.min(tin,tout),transform:`translateY(${(1-tin)*10}px)`}}>
          <span style={{fontFamily:SERIF,fontStyle:'italic',fontSize:32,color:COL.goldSoft}}>{text}</span>
        </div>;
      }}
    </Sprite>
  );
}
function TourCaptions(){
  return (<React.Fragment>
    <Caption s={5.4} e={9.0} text="Your whole financial life, at a glance."/>
    <Caption s={9.6} e={13.2} text="Every dollar in, every dollar out."/>
    <Caption s={13.7} e={17.5} text="Watch your net worth climb."/>
    <Caption s={18.0} e={21.8} text="Know exactly where your money lives."/>
    <Caption s={22.4} e={26.1} text="Chart your path to financial freedom."/>
  </React.Fragment>);
}

function ScreenLabel(){
  const time=useTime();
  const sec=Math.floor(time);
  React.useEffect(()=>{ const el=document.getElementById('root'); if(el) el.dataset.screenLabel=sec+'s'; },[sec]);
  return null;
}

function Seeker(){
  const tl = useTimeline();
  React.useEffect(()=>{
    window.__seek = (t)=>{ tl.setPlaying(false); tl.setTime(t); };
    window.__play = ()=>{ tl.setPlaying(true); };
  });
  return null;
}

/* shifts the timeline for its children by `by` seconds (children think the clock is earlier) */
function Shift({ by, children }){
  const tl = useTimeline();
  const value = React.useMemo(()=>({ ...tl, time: tl.time - by }), [tl.time, tl.duration, tl.playing, by]);
  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

const TOUR_OFFSET = 5.85;

function Video(){
  return (
    <Stage width={1920} height={1080} duration={36} background={'linear-gradient(160deg,#fdf8ee,#f1e8d7 52%,#e9dec9)'} persistKey="wealthvid" fps={60}>
      <GlowBg/>
      <SceneBrand/>
      <SceneVoice/>
      <Caption s={5.4} e={10.2} text="Just speak — your dashboard logs it."/>
      <Shift by={TOUR_OFFSET}>
        <Frame/>
        <SceneOverview/>
        <SceneCashFlow/>
        <SceneNetWorth/>
        <SceneInvest/>
        <SceneRetire/>
        <TourCaptions/>
        <SceneClose/>
      </Shift>
      <Vignette/>
      <ScreenLabel/>
      <Seeker/>
    </Stage>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Video/>);
