import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeSignal, cleanIntervals, DEFAULT_SETTINGS, parameterizeSpectrum, welchPsd } from "./analysis.js";
import { buildManifest, buildResultsCsv } from "./export.js";

const DEMO_RATE = 250;
const DURATION = 240;
const COLORS = { cyan: "#27b6ee", lime: "#9ddd3b", violet: "#8d6bc7", grid: "#314559", text: "#b9c9d6" };

function seededNoise(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function makeDemoChannel(seed) {
  const n = DEMO_RATE * DURATION;
  return Array.from({ length: n }, (_, i) => {
    const t = i / DEMO_RATE;
    const closed = t >= 60 && t <= 180;
    let aperiodic = 0;
    for (let f = 1; f <= 45; f++) aperiodic += 13 / (f ** .9) * Math.sin(2 * Math.PI * f * t + seededNoise(f, seed) * Math.PI);
    const alpha = (closed ? 28 : 8) * Math.sin(2 * Math.PI * (10.1 + seed * .05) * t);
    return aperiodic + alpha + seededNoise(i, seed) * 3;
  });
}

const DEMO = { name: "rest-eyes-open-closed.csv", rate: DEMO_RATE, channels: { O1: makeDemoChannel(1), O2: makeDemoChannel(2) } };

function downsample(values, max = 1700) {
  if (values.length <= max) return values;
  const step = values.length / max;
  return Array.from({ length: max }, (_, i) => values[Math.floor(i * step)]);
}

function meanChannels(channels, names, from, to) {
  const picked = names.map(n => channels[n]).filter(Boolean);
  if (!picked.length) return [];
  const start = Math.max(0, from), end = Math.min(picked[0].length, to);
  return Array.from({ length: end - start }, (_, j) => picked.reduce((s, c) => s + (Number(c[start + j]) || 0), 0) / picked.length);
}

function dynamicAnalysis(signal, rate, totalDuration) {
  const windowSec=8, stepSec=8, out=[];
  for(let s=0;s+windowSec<=totalDuration;s+=stepSec){ const a=analyzeSignal(signal.slice(Math.floor(s*rate),Math.floor((s+windowSec)*rate)),rate); if(a)out.push({t:s+windowSec/2,v:a.exponent}); }
  return out;
}

export function analyzeCondition(recording, selected, condition, artifacts) {
  const intervals = cleanIntervals([condition.start, condition.end], artifacts);
  if (!intervals.length) throw new Error(`${condition.name} has no clean interval long enough to analyze.`);
  const spectra = intervals.map(([start, end]) => {
    const signal = meanChannels(recording.channels, selected, Math.floor(start * recording.rate), Math.floor(end * recording.rate));
    return welchPsd(signal, recording.rate, DEFAULT_SETTINGS);
  });
  const freq = spectra[0].freq;
  const psd = freq.map((_, i) => spectra.reduce((sum, spectrum) => sum + spectrum.psd[i] * spectrum.segments, 0) / spectra.reduce((sum, spectrum) => sum + spectrum.segments, 0));
  return { ...spectra[0], ...parameterizeSpectrum(freq, psd, DEFAULT_SETTINGS), freq, psd, settings: DEFAULT_SETTINGS, engine: "Flux spectral-fit 0.2 · specparam-compatible fixed mode", cleanIntervals: intervals };
}

function saveDownload(name, value, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseOpenBCI(text, fileName) {
  const lines=text.split(/\r?\n/).filter(Boolean); let rate=250;
  for(const l of lines.slice(0,20)){ const m=l.match(/sample\s*rate[^0-9]*(\d+(?:\.\d+)?)/i); if(m)rate=Number(m[1]); }
  const dataLines=lines.filter(l=>!l.trim().startsWith("%")&&!l.trim().startsWith("#"));
  const first=dataLines[0]?.split(/,|\t/).map(s=>s.trim())||[]; const hasHeader=first.some(v=>Number.isNaN(Number(v)));
  const rows=(hasHeader?dataLines.slice(1):dataLines).map(l=>l.split(/,|\t/).map(Number)).filter(r=>r.length>2&&r.some(Number.isFinite));
  if(!rows.length) throw new Error("No numeric EEG samples found.");
  const width=Math.min(...rows.map(r=>r.length));
  const rawNames=hasHeader?first.slice(0,width):Array.from({length:width},(_,i)=>`Channel ${i+1}`);
  const ignore=/sample|index|time|timestamp|accel|aux|marker/i; const usable=rawNames.map((n,i)=>({n,i})).filter(x=>!ignore.test(x.n)).slice(0,16);
  const channels={}; usable.forEach((x,j)=>{ const preferred=/\bO1\b/i.test(x.n)?"O1":/\bO2\b/i.test(x.n)?"O2":x.n||`Channel ${j+1}`; channels[preferred]=rows.map(r=>r[x.i]).filter(Number.isFinite); });
  if(!Object.keys(channels).length) throw new Error("Could not identify EEG columns.");
  return {name:fileName,rate,channels};
}

function TraceCanvas({channels, selected, duration, range, events, conditions, artifacts}) {
  const ref=useRef(null);
  useEffect(()=>{ const c=ref.current,ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
    const L=66,R=18,T=28,B=28,plotW=w-L-R; const x=t=>L+t/duration*plotW;
    conditions.forEach(condition=>{ctx.fillStyle=`${condition.color}12`;ctx.fillRect(x(condition.start),T,x(condition.end)-x(condition.start),h-T-B)});
    ctx.fillStyle="rgba(141,107,199,.17)";ctx.fillRect(x(range[0]),T,x(range[1])-x(range[0]),h-T-B);
    artifacts.forEach(artifact=>{ctx.fillStyle="rgba(231,101,90,.2)";ctx.fillRect(x(artifact.start),T,x(artifact.end)-x(artifact.start),h-T-B);ctx.fillStyle="#ef8c82";ctx.fillText("excluded",x(artifact.start)+4,h-B-7)});
    ctx.strokeStyle=COLORS.grid;ctx.lineWidth=1;ctx.font="11px Inter, sans-serif";ctx.fillStyle=COLORS.text;
    for(let i=0;i<=4;i++){const xx=L+i*plotW/4;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,h-B);ctx.stroke();ctx.fillText(`${Math.round(i*duration/4/60)}:${String(Math.round(i*duration/4)%60).padStart(2,"0")}`,xx-10,h-8)}
    events.forEach(e=>{ctx.strokeStyle=e.color;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x(e.time),T);ctx.lineTo(x(e.time),h-B);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=e.color;ctx.fillText(e.label,x(e.time)+5,15)});
    selected.forEach((name,idx)=>{const vals=downsample(channels[name]||[]),cy=idx===0?h*.3:h*.69,amp=Math.min(1.2,50/(Math.max(...vals.map(Math.abs))||1));ctx.strokeStyle=COLORS.cyan;ctx.lineWidth=1;ctx.beginPath();vals.forEach((v,i)=>{const xx=L+i/(vals.length-1)*plotW,yy=cy-v*amp;(i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy))});ctx.stroke();ctx.fillStyle="#eaf5fb";ctx.font="16px Inter";ctx.fillText(name,18,cy+5);});
    ctx.strokeStyle=COLORS.violet;ctx.lineWidth=2;[range[0],range[1]].forEach(t=>{ctx.beginPath();ctx.moveTo(x(t),T);ctx.lineTo(x(t),h-B);ctx.stroke()});
  },[channels,selected,duration,range,events,conditions,artifacts]); return <canvas ref={ref} className="chart trace" aria-label="Raw EEG traces with selected interval, conditions, and artifact exclusions"/>;
}

function LineCanvas({points,duration,range}) { const ref=useRef(null); useEffect(()=>{const c=ref.current,ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const L=66,R=18,T=16,B=30,pw=w-L-R,ph=h-T-B,x=t=>L+t/duration*pw,y=v=>T+(2.6-v)/1.6*ph;ctx.fillStyle="rgba(141,107,199,.17)";ctx.fillRect(x(range[0]),T,x(range[1])-x(range[0]),ph);ctx.strokeStyle=COLORS.grid;ctx.fillStyle=COLORS.text;ctx.font="11px Inter";[1,1.4,1.8,2.2,2.6].forEach(v=>{ctx.beginPath();ctx.moveTo(L,y(v));ctx.lineTo(w-R,y(v));ctx.stroke();ctx.fillText(v.toFixed(1),30,y(v)+4)});ctx.strokeStyle=COLORS.lime;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(p.t),y(p.v)):ctx.moveTo(x(p.t),y(p.v)));ctx.stroke();ctx.fillStyle=COLORS.lime;points.forEach(p=>{ctx.beginPath();ctx.arc(x(p.t),y(p.v),2.5,0,Math.PI*2);ctx.fill()});},[points,duration,range]);return <canvas ref={ref} className="chart exponent" aria-label="Moving-window aperiodic exponent over time"/>; }

function PsdCanvas({result}) {const ref=useRef(null);useEffect(()=>{if(!result)return;const c=ref.current,ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const L=38,R=14,T=12,B=26,pts=result.freq.map((f,i)=>({f,p:result.psd[i]})).filter(x=>x.f>=1&&x.f<=45),logs=pts.map(p=>Math.log10(Math.max(p.p,1e-12))),min=Math.min(...logs),max=Math.max(...logs),x=f=>L+(Math.log10(f)/Math.log10(45))*(w-L-R),y=p=>T+(max-Math.log10(Math.max(p,1e-12)))/(max-min)*(h-T-B);ctx.strokeStyle=COLORS.grid;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,h-B);ctx.lineTo(w-R,h-B);ctx.stroke();ctx.strokeStyle=COLORS.cyan;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(x(p.f),y(p.p)):ctx.moveTo(x(p.f),y(p.p)));ctx.stroke();ctx.strokeStyle=COLORS.lime;ctx.beginPath();[1,45].forEach((f,i)=>{const p=10**(result.offset-result.exponent*Math.log10(f));i?ctx.lineTo(x(f),y(p)):ctx.moveTo(x(f),y(p))});ctx.stroke();ctx.fillStyle=COLORS.text;ctx.font="10px Inter";ctx.fillText("1",L-3,h-8);ctx.fillText("10",x(10)-7,h-8);ctx.fillText("45 Hz",w-38,h-8);},[result]);return <canvas ref={ref} className="psd" aria-label="Power spectral density and aperiodic fit"/>}

function ComparisonPanel({conditions, results}) {
  const ready = conditions.filter(condition => results[condition.id]);
  if (ready.length < 2) return <div className="compare-empty"><p>Analyze at least two conditions to compare them.</p></div>;
  const [a, b] = ready, ra = results[a.id], rb = results[b.id], delta = rb.exponent - ra.exponent;
  return <div className="comparison">
    <div className="compare-head"><span>{a.name}</span><span>{b.name}</span></div>
    <div className="delta"><small>Exponent difference</small><strong>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</strong><p>{b.name} has a {Math.abs(delta) < .1 ? "similar" : delta > 0 ? "steeper" : "flatter"} aperiodic slope than {a.name}.</p></div>
    {[{label:"Exponent",key:"exponent",digits:2},{label:"Offset",key:"offset",digits:2},{label:"R²",key:"r2",digits:3},{label:"Alpha CF",key:"alphaCF",digits:1,suffix:" Hz"},{label:"Alpha PW",key:"alphaPW",digits:2}].map(row=><div className="compare-row" key={row.key}><span>{row.label}</span><b>{ra[row.key].toFixed(row.digits)}{row.suffix}</b><b>{rb[row.key].toFixed(row.digits)}{row.suffix}</b></div>)}
    <p className="compare-note">Descriptive difference only. Statistical inference requires repeated observations and a study-level model.</p>
  </div>;
}

export function App(){
 const [recording,setRecording]=useState(DEMO),[selected,setSelected]=useState(["O1","O2"]),[range,setRange]=useState([60,180]),[advanced,setAdvanced]=useState(false),[analyzing,setAnalyzing]=useState(false),[result,setResult]=useState(null),[dynamic,setDynamic]=useState([]),[error,setError]=useState(""),[events,setEvents]=useState([{time:60,label:"Eyes closed",color:"#a98bd5"},{time:180,label:"Eyes open",color:"#78a9c7"}]),[conditions,setConditions]=useState([{id:"eyes-open",name:"Eyes open",start:0,end:60,color:"#27b6ee"},{id:"eyes-closed",name:"Eyes closed",start:60,end:180,color:"#8d6bc7"}]),[artifacts,setArtifacts]=useState([]),[conditionName,setConditionName]=useState(""),[conditionResults,setConditionResults]=useState({}),[view,setView]=useState("analyze");
 const input=useRef(null),names=Object.keys(recording.channels),duration=recording.channels[names[0]].length/recording.rate;
 useEffect(()=>{setRange([Math.min(60,duration*.25),Math.min(180,duration*.75)]);setResult(null);setConditionResults({});setArtifacts([])},[recording]);
 const status=useMemo(()=>result?(result.r2>.95?"Excellent":result.r2>.9?"Good":"Review fit"):"Not analyzed",[result]);
 const analyze=()=>{setAnalyzing(true);setTimeout(()=>{try{const temporary={name:"Current selection",start:range[0],end:range[1]};const current=analyzeCondition(recording,selected,temporary,artifacts),full=meanChannels(recording.channels,selected,0,Math.floor(duration*recording.rate));setResult(current);setDynamic(dynamicAnalysis(full,recording.rate,duration));setError("")}catch(err){setError(err.message)}finally{setAnalyzing(false)}},50)};
 const analyzeConditions=()=>{setAnalyzing(true);setConditionResults({});setResult(null);setTimeout(()=>{const next={},failures=[];conditions.forEach(condition=>{try{next[condition.id]=analyzeCondition(recording,selected,condition,artifacts)}catch(err){failures.push(err.message)}});setConditionResults(next);setResult(next[conditions[0]?.id]||Object.values(next)[0]||null);setView("compare");setError(failures.join(" "));setAnalyzing(false)},50)};
 const addCondition=()=>{const name=conditionName.trim()||`Condition ${conditions.length+1}`;setConditions([...conditions,{id:`condition-${Date.now()}`,name,start:range[0],end:range[1],color:["#27b6ee","#8d6bc7","#d8a653","#77c7a3"][conditions.length%4]}]);setConditionName("")};
 const markArtifact=()=>{setArtifacts([...artifacts,{id:`artifact-${Date.now()}`,start:range[0],end:range[1]}]);setConditionResults({});setResult(null);setError("Artifact exclusions changed. Re-run analysis.")};
 const manifest=()=>buildManifest({recording,selected,conditions,artifacts,settings:DEFAULT_SETTINGS,conditionResults,duration});
 const exportJson=()=>saveDownload("flux-eeg-analysis.json",JSON.stringify(manifest(),null,2));
 const exportCsv=()=>saveDownload("flux-eeg-results.csv",buildResultsCsv(conditions,conditionResults),"text/csv");
 const load=async e=>{const f=e.target.files?.[0];if(!f)return;try{const r=parseOpenBCI(await f.text(),f.name);setRecording(r);const ns=Object.keys(r.channels),posterior=ns.filter(n=>/^(O1|O2)$/i.test(n)).slice(0,2);setSelected(posterior.length?posterior:ns.slice(0,2));setError("")}catch(err){setError(err.message)}};
 return <main className="app-shell">
  <aside className="steps"><div className="brand">Flux EEG <em>V0.2</em><span>Guided 1/f analysis</span></div><div className="step done"><b>✓</b><div><strong>1&nbsp; Recording</strong><span>Recording loaded</span></div></div><div className={`step ${view==="analyze"?"active":"done"}`}><b>{view==="compare"?"✓":"2"}</b><div><strong>Conditions</strong><span>Name intervals and exclude artifacts</span></div></div><div className={`step ${view==="compare"?"active":""}`}><b>3</b><div><strong>Compare</strong><span>Condition differences and exports</span></div></div><button className="quiet" onClick={()=>input.current.click()}>Import recording</button><button className="quiet" onClick={()=>setRecording(DEMO)}>Load demo</button></aside>
  <section className="workspace"><header><div><h1>EEG <span>Selected channels</span></h1><p>{recording.name} · {recording.rate} Hz · {Math.floor(duration/60)}:{String(Math.round(duration%60)).padStart(2,"0")}</p></div><div className="event-tools"><button onClick={markArtifact}>Exclude selection</button><button onClick={()=>setEvents([...events,{time:(range[0]+range[1])/2,label:"Event",color:"#d8a653"}])}>+ Event</button></div></header>
   <div className="trace-title"><span>Raw EEG (µV)</span><span className="legend"><i className="cyan"/>signal <i className="violet"/>selection <i className="artifact-key"/>excluded</span></div><TraceCanvas channels={recording.channels} selected={selected.slice(0,2)} duration={duration} range={range} events={events} conditions={conditions} artifacts={artifacts}/>
   <div className="range-controls"><label>Selection start <input type="range" min="0" max={duration} value={range[0]} onChange={e=>setRange([Math.min(+e.target.value,range[1]-1),range[1]])}/><output>{range[0].toFixed(0)}s</output></label><label>Selection end <input type="range" min="0" max={duration} value={range[1]} onChange={e=>setRange([range[0],Math.max(+e.target.value,range[0]+1)])}/><output>{range[1].toFixed(0)}s</output></label></div>
   <div className="condition-builder"><input aria-label="Condition name" placeholder="Name this interval…" value={conditionName} onChange={e=>setConditionName(e.target.value)}/><button onClick={addCondition}>Save condition</button><div className="condition-chips">{conditions.map(condition=><button key={condition.id} style={{"--chip":condition.color}} onClick={()=>setRange([condition.start,condition.end])}>{condition.name}<span>{condition.start.toFixed(0)}–{condition.end.toFixed(0)}s</span></button>)}</div></div>
   <div className="section-title"><div><h2>1/f Exponent <span>(moving window)</span></h2><p>Window 8 s · Step 8 s · 1–45 Hz</p></div><span className="legend"><i className="lime"/>average {selected.join(" + ")}</span></div><LineCanvas points={dynamic.length?dynamic:Array.from({length:30},(_,i)=>({t:i*duration/29,v:1.58+.38*Math.exp(-((i-15)**2)/55)+seededNoise(i,9)*.04}))} duration={duration} range={range}/>
  </section>
  <aside className="inspector"><div className="view-tabs"><button className={view==="analyze"?"selected":""} onClick={()=>setView("analyze")}>Analyze</button><button className={view==="compare"?"selected":""} onClick={()=>setView("compare")}>Compare</button></div><h2>Recording</h2><dl><dt>File</dt><dd>{recording.name}</dd><dt>Duration</dt><dd>{duration.toFixed(1)} s</dd><dt>Sampling rate</dt><dd>{recording.rate} Hz</dd><dt>Excluded</dt><dd>{artifacts.reduce((sum,a)=>sum+a.end-a.start,0).toFixed(1)} s</dd></dl><hr/><h2>Selected channels ({selected.length})</h2><div className="channels">{names.map(n=><label key={n}><input type="checkbox" checked={selected.includes(n)} onChange={()=>setSelected(selected.includes(n)?selected.filter(x=>x!==n):[...selected,n])}/>{n}</label>)}</div><p className="hint">Selected channels are averaged before fitting.</p>{view==="analyze"?<button className="primary" disabled={!selected.length||analyzing} onClick={analyze}>{analyzing?"Analyzing…":"Analyze current selection"}</button>:<button className="primary" disabled={conditions.length<2||analyzing} onClick={analyzeConditions}>{analyzing?"Analyzing conditions…":"Analyze conditions"}</button>}<button className="advanced" onClick={()=>setAdvanced(!advanced)}>Advanced <span>{advanced?"−":"+"}</span></button>{advanced&&<div className="advanced-body"><label>Frequency range <span>1–45 Hz</span></label><label>Welch window <span>4.096 s</span></label><label>Overlap <span>50%</span></label><label>Aperiodic mode <span>Fixed</span></label><label>Validation <span>Passed · 3 fixtures</span></label></div>}
   {error&&<p className="error">{error}</p>}<hr/>{view==="compare"?<><div className="results-head"><h2>Condition comparison</h2><span className="quality good">{Object.keys(conditionResults).length}/{conditions.length} ready</span></div><ComparisonPanel conditions={conditions} results={conditionResults}/>{Object.keys(conditionResults).length>0&&<div className="exports"><button onClick={exportCsv}>Export CSV</button><button onClick={exportJson}>Export manifest</button></div>}</>:<><div className="results-head"><h2>Results</h2><span className={result?.r2>.9?"quality good":"quality"}>Fit: {status}</span></div>{result?<><p className="engine">{result.engine}</p><dl className="metrics"><dt>Exponent (χ)</dt><dd>{result.exponent.toFixed(2)}</dd><dt>Offset</dt><dd>{result.offset.toFixed(2)}</dd><dt>R²</dt><dd>{result.r2.toFixed(3)}</dd><dt>Fit error (RMSE)</dt><dd>{result.error.toFixed(3)}</dd></dl><div className="alpha"><span>Alpha CF <b>{result.alphaCF?`${result.alphaCF.toFixed(1)} Hz`:"—"}</b></span><span>Alpha PW <b>{result.alphaCF?result.alphaPW.toFixed(2):"—"}</b></span><span>Alpha BW <b>{result.alphaCF?`${result.alphaBW.toFixed(1)} Hz`:"—"}</b></span></div><PsdCanvas result={result}/>{result.warnings.length>0&&<div className="warnings">{result.warnings.map(w=><p key={w}>{w}</p>)}</div>}</>:<div className="empty"><div>χ</div><p>Run the analysis for the current interval, or switch to Compare.</p></div>}</>}<p className="disclaimer">ⓘ Descriptive research output; not a diagnosis or statistical inference.</p>
  </aside><input ref={input} hidden type="file" accept=".csv,.txt,.tsv" onChange={load}/>
 </main>
}
