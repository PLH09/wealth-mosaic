/* ============ Wealth Mosaic — demo video scenes ============ */
/* uses globals from animations.jsx (Sprite, useTime, useSprite, Easing, clamp, interpolate)
   and window.WD from data.js */

const SERIF = "'Playfair Display', Georgia, serif";
const SANS  = "'Hanken Grotesk', system-ui, sans-serif";
const COL = {
  bg:'#f1e8d7', panel:'#fffefb', panel2:'#f6efdf',
  border:'rgba(140,110,40,0.20)', hair:'rgba(61,51,34,0.12)',
  gold:'#c2972f', goldB:'#d6ab3e', goldSoft:'#a8842e',
  ivory:'#2a2013', text:'#3d3322', muted:'#897c64', muted2:'#9a8c72',
  green:'#3c8a5f', coral:'#c45c36', track:'#e7dbc4',
};
const TABS = ['Overview','Cash Flow','Net Worth','Investments & Goals','Retirement'];

// canvas + frame geometry (1920x1080)
const FX=210, FY=152, FW=1500, FH=796;
const CX=FX+54, CTOP=FY+248, CW=FW-108, CBOT=FY+FH-46;
const CH=CBOT-CTOP;

// shared data (consistent with the prototype)
const DATA = window.WD.sampleData();
const MOD  = window.WD.compute(DATA);
const RET  = window.WD.retire(DATA.retirement);
const fmt  = window.WD.fmt;

// ---------- primitives ----------
function In({ at, dur=0.6, y=22, x=0, ease=Easing.easeOutCubic, sc, children, style }){
  const time = useTime();
  const t = ease(clamp((time-at)/dur,0,1));
  let tr = `translate(${(1-t)*x}px, ${(1-t)*y}px)`;
  if(sc!=null) tr += ` scale(${sc+(1-sc)*t})`;
  return <div style={{ ...style, opacity:t, transform:tr, willChange:'transform,opacity' }}>{children}</div>;
}

function CountUp({ to, from=0, at, dur=1.4, ease=Easing.easeOutCubic, deci=0, prefix='', suffix='' }){
  const time = useTime();
  const t = ease(clamp((time-at)/dur,0,1));
  const v = from+(to-from)*t;
  const s = deci ? v.toFixed(deci) : Math.round(v).toLocaleString('en-US');
  return <span>{prefix}{s}{suffix}</span>;
}

function Scene({ start, end, fade=0.5, drift=0.022, children }){
  return (
    <Sprite start={start} end={end}>
      {({ localTime, duration })=>{
        const tin  = Easing.easeOutCubic(clamp(localTime/fade,0,1));
        const tout = Easing.easeInCubic(clamp((duration-localTime)/fade,0,1));
        const sc = 1 + drift*clamp(localTime/duration,0,1);
        return (
          <div style={{ position:'absolute', inset:0, opacity:Math.min(tin,tout),
            transform:`scale(${sc})`, transformOrigin:'center' }}>
            {children}
          </div>
        );
      }}
    </Sprite>
  );
}

// label / value helpers
const Label = ({children,style}) => <div style={{fontFamily:SANS,fontSize:18,letterSpacing:'0.18em',textTransform:'uppercase',color:COL.muted,fontWeight:600,...style}}>{children}</div>;

// ---------- charts ----------
function ChartLine({ box, values, minV=0, maxV, color, at, dur=1.6, dashed=false, width=3, dots=false, dotAt }){
  const time = useTime();
  const t = Easing.easeInOutCubic(clamp((time-at)/dur,0,1));
  const n = values.length;
  const mx = maxV!=null?maxV:Math.max(...values);
  const pts = values.map((v,i)=>({
    x: box.x + (n<=1?0:(i/(n-1))*box.w),
    y: box.y + box.h - ((v-minV)/((mx-minV)||1))*box.h,
  }));
  let d='';
  // smooth catmull-rom
  for(let i=0;i<pts.length;i++){
    if(i===0){ d+=`M${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`; continue; }
    const p0=pts[i-1], p1=pts[i];
    const pm1=pts[i-2]||p0, p2=pts[i+1]||p1;
    const c1x=p0.x+(p1.x-pm1.x)/6, c1y=p0.y+(p1.y-pm1.y)/6;
    const c2x=p1.x-(p2.x-p0.x)/6, c2y=p1.y-(p2.y-p0.y)/6;
    d+=` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
        pathLength="1" strokeDasharray={dashed?'0.012 0.014':'1'} strokeDashoffset={dashed?0:(1-t)}
        style={dashed?{opacity:t}:null}/>
      {dots && pts.map((p,i)=>{
        const da = (dotAt!=null?dotAt:at) + (i/(n-1))*dur*0.92;
        const dt = Easing.easeOutBack(clamp((time-da)/0.34,0,1));
        if(dt<=0) return null;
        return <circle key={i} cx={p.x} cy={p.y} r={7*dt} fill={COL.panel} stroke={color} strokeWidth="3.5"/>;
      })}
    </g>
  );
}

function Ring({ cx, cy, r, stroke, frac, color, at, dur=1.3, track=true }){
  const time = useTime();
  const t = Easing.easeInOutCubic(clamp((time-at)/dur,0,1));
  const C = 2*Math.PI*r;
  const len = frac*C*t;
  return (
    <g>
      {track && <circle cx={cx} cy={cy} r={r} fill="none" stroke={COL.track} strokeWidth={stroke}/>}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${len} ${C-len}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}/>
    </g>
  );
}

function DonutSegments({ cx, cy, r, stroke, segs, at, stagger=0.26, dur=0.7 }){
  // segs: [{frac,color}] in draw order
  const time = useTime();
  const C = 2*Math.PI*r;
  let acc = 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COL.track} strokeWidth={stroke}/>
      {segs.map((s,i)=>{
        const a0 = acc; acc += s.frac;
        const st = at + i*stagger;
        const t = Easing.easeOutCubic(clamp((time-st)/dur,0,1));
        const gap = 0.012;
        const segLen = Math.max(0,(s.frac-gap))*C*t;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${segLen} ${C}`} strokeDashoffset={-a0*C} strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}/>
        );
      })}
    </g>
  );
}

function GrowBar({ x, y, w, h, frac, color, at, dur=1.0 }){
  const time = useTime();
  const t = Easing.easeOutCubic(clamp((time-at)/dur,0,1));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h/2} fill={COL.track}/>
      <rect x={x} y={y} width={Math.max(0,w*frac*t)} height={h} rx={h/2} fill={color}/>
    </g>
  );
}

Object.assign(window, { In, CountUp, Scene, ChartLine, Ring, DonutSegments, GrowBar, Label,
  SERIF, SANS, COL, TABS, FX, FY, FW, FH, CX, CTOP, CW, CBOT, CH, DATA, MOD, RET, fmt });
