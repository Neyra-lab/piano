const LOW=60,HIGH=84;
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const BLACK=[1,3,6,8,10];
const MAP={z:60,s:61,x:62,d:63,c:64,v:65,g:66,b:67,h:68,n:69,j:70,m:71,q:72,2:73,w:74,3:75,e:76,r:77,5:78,t:79,6:80,y:81,7:82,u:83,i:84};
const KEYOF={};for(const k in MAP)KEYOF[MAP[k]]=k;
const SONGS={
  'Ode to Joy':[64,64,65,67,67,65,64,62,60,60,62,64,64,62,62],
  'Twinkle, Twinkle':[60,60,67,67,69,69,67,65,65,64,64,62,62,60],
  'Happy Birthday':[60,60,62,60,65,64,60,60,62,60,67,65]
};


const piano=document.getElementById('piano'),els={};
const whites=[];for(let m=LOW;m<=HIGH;m++)if(!BLACK.includes(m%12))whites.push(m);
const W=100/whites.length;let wi=0;
for(let m=LOW;m<=HIGH;m++){
  const el=document.createElement('div'),black=BLACK.includes(m%12);
  el.className='k '+(black?'b':'w');
  el.dataset.m=m;
  const name=NAMES[m%12]+(Math.floor(m/12)-1),key=(KEYOF[m]||'').toUpperCase();
  el.innerHTML='<small><span class="nm">'+name+'</span><br>'+key+'</small>';
  el.setAttribute('aria-label',name);
  if(black){el.style.left=(wi*W-W*.3)+'%';el.style.width=(W*.6)+'%'}else wi++;
  piano.appendChild(el);els[m]=el;
}

let ctx,master,tone='piano';
const TONES={
  piano:{parts:[[1,1],[2,.45],[3,.2],[4,.1]],type:'sine',attack:.005,decay:2.6},
  organ:{parts:[[1,1],[2,.5],[3,.25],[4,.3]],type:'sine',attack:.03,decay:0},
  glass:{parts:[[1,1],[2.76,.35],[5.4,.15]],type:'sine',attack:.004,decay:1.6},
  synth:{parts:[[1,1],[1.005,.8]],type:'sawtooth',attack:.02,decay:0,lp:1500}
};
function initAudio(){
  if(!ctx){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=.45;
    const c=ctx.createDynamicsCompressor();master.connect(c);c.connect(ctx.destination);
  }
  if(ctx.state==='suspended')ctx.resume();
}
const voices={};
function sound(m){
  if(voices[m])return;
  initAudio();
  const T=TONES[tone],t=ctx.currentTime,f=440*Math.pow(2,(m-69)/12);
  const g=ctx.createGain(),sum=T.parts.reduce((a,p)=>a+p[1],0);
  let out=g;
  if(T.lp){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=T.lp;g.connect(lp);lp.connect(master)}else g.connect(master);
  const peak=(T.type==='sawtooth'?.35:.8)/sum*(m<72?1:.85);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak*T.parts.length*.55,t+T.attack);
  if(T.decay)g.gain.exponentialRampToValueAtTime(.0008,t+T.decay);
  const oscs=T.parts.map(([r,a])=>{
    const o=ctx.createOscillator(),pg=ctx.createGain();
    o.type=T.type;o.frequency.value=f*r;pg.gain.value=a/ T.parts.length;
    o.connect(pg);pg.connect(g);o.start(t);return o;
  });
  voices[m]={g,oscs};
}
function silence(m){
  const v=voices[m];if(!v)return;
  const t=ctx.currentTime;
  v.g.gain.cancelScheduledValues(t);
  v.g.gain.setValueAtTime(Math.max(v.g.gain.value,.0001),t);
  v.g.gain.setTargetAtTime(0,t,.07);
  v.oscs.forEach(o=>o.stop(t+.5));
  delete voices[m];
}


let recording=false,track=[],t0=0,playing=false;
function press(m,fromPlayback){
  if(els[m].classList.contains('on'))return;
  els[m].classList.add('on');sound(m);
  if(recording&&!fromPlayback)track.push({t:performance.now()-t0,m,on:1});
  learnCheck(m);
}
function release(m,fromPlayback){
  if(!els[m].classList.contains('on'))return;
  els[m].classList.remove('on');silence(m);
  if(recording&&!fromPlayback)track.push({t:performance.now()-t0,m,on:0});
}


piano.addEventListener('pointerdown',e=>{
  const k=e.target.closest('.k');if(!k)return;
  if(k.hasPointerCapture&&k.hasPointerCapture(e.pointerId))k.releasePointerCapture(e.pointerId);
  press(+k.dataset.m);
});
piano.addEventListener('pointerover',e=>{
  const k=e.target.closest('.k');if(k&&e.buttons===1&&e.pointerType==='mouse')press(+k.dataset.m);
});
piano.addEventListener('pointerout',e=>{
  const k=e.target.closest('.k');if(k&&e.pointerType==='mouse')release(+k.dataset.m);
});
['pointerup','pointercancel'].forEach(ev=>piano.addEventListener(ev,e=>{
  const k=e.target.closest('.k');if(k)release(+k.dataset.m);
}));
window.addEventListener('pointerup',()=>Object.keys(els).forEach(m=>{if(els[m].classList.contains('on')&&!heldKeys.has(+m))release(+m)}));
/* computer keyboard */
const heldKeys=new Set();
addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  const m=MAP[e.key.toLowerCase()];if(m==null)return;
  heldKeys.add(m);press(m);
});
addEventListener('keyup',e=>{
  const m=MAP[e.key.toLowerCase()];if(m==null)return;
  heldKeys.delete(m);release(m);
});
addEventListener('blur',()=>{heldKeys.clear();Object.keys(els).forEach(m=>release(+m))});


document.querySelectorAll('#tones button').forEach(b=>b.addEventListener('click',()=>{
  tone=b.dataset.tone;
  document.querySelectorAll('#tones button').forEach(x=>x.setAttribute('aria-pressed',x===b));
}));
document.getElementById('names').addEventListener('change',e=>piano.classList.toggle('hide-names',!e.target.checked));

const recBtn=document.getElementById('rec'),playBtn=document.getElementById('play');
recBtn.addEventListener('click',()=>{
  if(!recording){track=[];t0=performance.now();recording=true;recBtn.textContent='Stop recording';recBtn.classList.add('live');playBtn.disabled=true}
  else{recording=false;recBtn.textContent='Record';recBtn.classList.remove('live');playBtn.disabled=!track.length}
});
playBtn.addEventListener('click',()=>{
  if(playing||!track.length)return;
  playing=true;playBtn.disabled=true;playBtn.textContent='Playing…';
  track.forEach(n=>setTimeout(()=>n.on?press(n.m,true):release(n.m,true),n.t));
  const end=track[track.length-1].t+600;
  setTimeout(()=>{playing=false;playBtn.disabled=false;playBtn.textContent='Play back'},end);
});


const sel=document.getElementById('song'),status=document.getElementById('status'),bar=document.getElementById('bar');
const startBtn=document.getElementById('start'),stopBtn=document.getElementById('stop');
Object.keys(SONGS).forEach(n=>sel.add(new Option(n,n)));
let melody=null,idx=0;
function showNext(){
  document.querySelectorAll('.next').forEach(x=>x.classList.remove('next'));
  if(melody&&idx<melody.length){
    els[melody[idx]].classList.add('next');
    const m=melody[idx];
    status.textContent='Play '+NAMES[m%12]+(Math.floor(m/12)-1)+(KEYOF[m]?' (key '+KEYOF[m].toUpperCase()+')':'')+'. Note '+(idx+1)+' of '+melody.length+'.';
  }
  bar.style.width=melody?(idx/melody.length*100)+'%':'0';
}
function endLearn(msg){
  melody=null;idx=0;showNext();status.textContent=msg||'';
  startBtn.hidden=false;stopBtn.hidden=true;sel.disabled=false;
}
function learnCheck(m){
  if(!melody||playing)return;
  if(m===melody[idx]){
    idx++;
    if(idx>=melody.length){bar.style.width='100%';endLearn('Well played! You finished '+sel.value+'.')}
    else showNext();
  }
}
startBtn.addEventListener('click',()=>{
  melody=SONGS[sel.value];idx=0;showNext();
  startBtn.hidden=true;stopBtn.hidden=false;sel.disabled=true;
});
stopBtn.addEventListener('click',()=>endLearn('Stopped. Pick a song to start again.'));