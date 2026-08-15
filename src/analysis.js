export const DEFAULT_SETTINGS = Object.freeze({ frequencyRange:[1,45], aperiodicMode:"fixed", peakWidthLimits:[0.5,12], maxPeaks:6, minPeakHeight:0, peakThreshold:2, windowSeconds:4.096, overlap:0.5 });

export function cleanIntervals(interval, artifacts) {
  let parts = [interval];
  for (const artifact of artifacts) {
    parts = parts.flatMap(([start, end]) => {
      if (artifact.end <= start || artifact.start >= end) return [[start, end]];
      return [[start, Math.max(start, artifact.start)], [Math.min(end, artifact.end), end]].filter(([a, b]) => b - a >= 4.2);
    });
  }
  return parts;
}

export function evaluateConfidence({ result, cleanDuration, quality = [] }) {
  let score = 100;
  const reasons = [];
  if (cleanDuration < 12) { score -= 25; reasons.push("Less than 12 seconds of clean data."); }
  else if (cleanDuration < 20) { score -= 10; reasons.push("A longer clean interval would improve stability."); }
  if (result.segments < 3) { score -= 20; reasons.push("Fewer than three Welch segments contributed."); }
  if (result.r2 < 0.9) { score -= 35; reasons.push("The spectral model fit is below R² 0.90."); }
  else if (result.r2 < 0.95) { score -= 10; reasons.push("The fit is usable but retains visible residual structure."); }
  if (result.error > 0.2) { score -= 10; reasons.push("Fit error is elevated."); }
  if (quality.some(channel => channel.status === "bad")) { score -= 25; reasons.push("At least one selected channel failed the quality screen."); }
  else if (quality.some(channel => channel.status === "review")) { score -= 10; reasons.push("At least one selected channel needs review."); }
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "High confidence" : score >= 60 ? "Moderate confidence" : "Low confidence";
  return { score, label, reasons };
}

function fftReal(values){const n=values.length,re=Float64Array.from(values),im=new Float64Array(n);for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,lr=Math.cos(a),li=Math.sin(a);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const ur=re[i+j],ui=im[i+j],k=i+j+len/2,vr=re[k]*wr-im[k]*wi,vi=re[k]*wi+im[k]*wr;re[i+j]=ur+vr;im[i+j]=ui+vi;re[k]=ur-vr;im[k]=ui-vi;const nr=wr*lr-wi*li;wi=wr*li+wi*lr;wr=nr}}}return{re,im}}

export function welchPsd(signal,rate,settings=DEFAULT_SETTINGS){const requested=Math.round(settings.windowSeconds*rate),nperseg=Math.min(2**Math.floor(Math.log2(requested)),2**Math.floor(Math.log2(signal.length)));if(nperseg<128)throw new Error("Selection is too short for a stable spectrum.");const step=Math.max(1,Math.round(nperseg*(1-settings.overlap))),bins=nperseg/2+1,psd=new Float64Array(bins),window=Float64Array.from({length:nperseg},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/nperseg)),windowPower=window.reduce((s,v)=>s+v*v,0);let segments=0;for(let start=0;start+nperseg<=signal.length;start+=step){let mean=0;for(let i=0;i<nperseg;i++)mean+=signal[start+i];mean/=nperseg;const tapered=Float64Array.from({length:nperseg},(_,i)=>(signal[start+i]-mean)*window[i]),{re,im}=fftReal(tapered);for(let k=0;k<bins;k++){const one=k===0||k===nperseg/2?1:2;psd[k]+=one*(re[k]**2+im[k]**2)/(rate*windowPower)}segments++}return{freq:Array.from({length:bins},(_,k)=>k*rate/nperseg),psd:Array.from(psd,v=>v/segments),nperseg,segments,resolution:rate/nperseg}}

function linearFit(xs,ys){const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;let num=0,den=0;for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2}const slope=num/(den||1);return{slope,intercept:my-slope*mx}}
function percentile(values,q){const s=[...values].sort((a,b)=>a-b),p=(s.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return s[l]+(s[h]-s[l])*(p-l)}
function std(values){const m=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0)/values.length)}
const gaussian=(f,c,h,s)=>h*Math.exp(-.5*((f-c)/s)**2);

export function parameterizeSpectrum(freq,psd,settings=DEFAULT_SETTINGS){const[low,high]=settings.frequencyRange,points=freq.map((f,i)=>({f,p:Math.log10(Math.max(psd[i],1e-24))})).filter(x=>x.f>=low&&x.f<=high);if(points.length<20)throw new Error("Frequency resolution is insufficient for this fit range.");const logF=points.map(x=>Math.log10(x.f)),logP=points.map(x=>x.p);let fit=linearFit(logF,logP);for(let n=0;n<3;n++){const residual=logP.map((p,i)=>p-(fit.intercept+fit.slope*logF[i])),cut=percentile(residual,.35),kept=residual.map((r,i)=>({r,i})).filter(x=>x.r<=cut+.05);fit=linearFit(kept.map(x=>logF[x.i]),kept.map(x=>logP[x.i]))}const peaks=[],periodic=new Float64Array(points.length);for(let p=0;p<settings.maxPeaks;p++){const flat=logP.map((v,i)=>v-(fit.intercept+fit.slope*logF[i])-periodic[i]),noise=std(flat.filter(v=>v<=percentile(flat,.8)));let best=0;for(let i=1;i<flat.length-1;i++)if(flat[i]>flat[best])best=i;const height=flat[best];if(height<settings.minPeakHeight||height<settings.peakThreshold*noise)break;const half=height/2;let left=best,right=best;while(left>0&&flat[left]>half)left--;while(right<flat.length-1&&flat[right]>half)right++;let bandwidth=Math.max(points[right].f-points[left].f,settings.peakWidthLimits[0]);bandwidth=Math.min(bandwidth,settings.peakWidthLimits[1]);const sigma=bandwidth/2.355,center=points[best].f;peaks.push({center,power:height,bandwidth});for(let i=0;i<points.length;i++)periodic[i]+=gaussian(points[i].f,center,height,sigma)}fit=linearFit(logF,logP.map((v,i)=>v-periodic[i]));const modeled=logF.map((x,i)=>fit.intercept+fit.slope*x+periodic[i]),mean=logP.reduce((a,b)=>a+b,0)/logP.length,sse=logP.reduce((s,v,i)=>s+(v-modeled[i])**2,0),sst=logP.reduce((s,v)=>s+(v-mean)**2,0)||1,r2=1-sse/sst,alpha=peaks.filter(p=>p.center>=7&&p.center<=14).sort((a,b)=>b.power-a.power)[0]||null,warnings=[];if(r2<.9)warnings.push("Low model R²; inspect the fit before comparing conditions.");if(!alpha)warnings.push("No alpha peak passed the configured peak threshold.");if(peaks.some(p=>p.bandwidth<=settings.peakWidthLimits[0]+1e-6))warnings.push("A peak reached the minimum bandwidth boundary.");return{exponent:-fit.slope,offset:fit.intercept,r2,error:Math.sqrt(sse/logP.length),peaks,alphaCF:alpha?.center||0,alphaPW:alpha?.power||0,alphaBW:alpha?.bandwidth||0,aperiodicFit:freq.map(f=>f>0?10**(fit.intercept+fit.slope*Math.log10(f)):null),warnings}}

export function analyzeSignal(signal,rate,settings=DEFAULT_SETTINGS){const spectrum=welchPsd(signal,rate,settings);return{...spectrum,...parameterizeSpectrum(spectrum.freq,spectrum.psd,settings),settings,engine:"Flux spectral-fit 0.3 · specparam-compatible fixed mode"}}
