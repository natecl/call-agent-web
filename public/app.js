const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
(function routeSignedInAccount() {
  try {
    const sid = String(sessionStorage.getItem('treena-session-id') || localStorage.getItem('treena-session-id') || '').trim();
    if (/^cs_(test|live)_/.test(sid)) {
      location.replace(`/dashboard.html?session_id=${encodeURIComponent(sid)}`);
      return;
    }
  } catch (_) {}
  fetch('/api/auth/me').then((res) => res.json()).then((me) => {
    if (me && me.hasAccount) location.replace('/dashboard');
  }).catch(() => {});
})();
let casesInView=false, demoInView=false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const scenarios = [
  {name:'Dinner reservations', image:'dining-retina', source:[1254,1254], crop:[270,1005,250,195], before:'A table ', mark:'for two.', after:'', caption:'Dinner plans, without the phone call.', color:'#ffd3bf'},
  {name:'Haircuts', image:'haircut-yellow', source:[1942,809], crop:[250,195,490,400], before:'A little ', mark:'off the top.', after:'', caption:'Your next haircut, without the phone call.', color:'#ffe89b'},
  {name:'Store stock', image:'stock-retina', source:[1942,809], crop:[235,190,370,430], before:'Before you ', mark:'make the trip.', after:'', caption:'Find out what’s in stock before you go.', color:'#cee2c8'},
  {name:'Rescheduling', image:'reschedule-retina', source:[1942,809], crop:[180,225,560,325], before:'A ', mark:'better time', after:' for you.', caption:'Move your appointment. Keep your day.', color:'#e1d2f4'},
  {name:'Business hours', image:'hours-retina', source:[1942,809], crop:[255,170,430,410], before:'', mark:'Still open?', after:' Find out.', caption:'Get business hours, without the phone call.', color:'#cbe7fb'},
];
const sceneRoot = $('#case-scenes');
const stage = $('.case-stage');
const highlight = $('.shared-highlight');
const splitWords = (text) => text.split(/(\s+)/).map(t => /\s/.test(t) ? t : t ? `<span class="word">${t}</span>` : '').join('');
scenarios.forEach((s, i) => {
  const scene=document.createElement('div');
  scene.className='case-scene';
  scene.setAttribute('aria-hidden',String(i!==0));
  scene.style.visibility=i===0?'visible':'hidden';
  const results = [
    ['Reservation confirmed', 'A table for two', 'Tonight, 7:30 PM', 'Your evening is all set.'],
    ['Appointment booked', 'Your next haircut', 'Friday, 10:00 AM', 'A little time, just for you.'],
    ['Availability checked', 'Oat milk is in stock', 'Aisle 6', 'One less wasted trip.'],
    ['Appointment moved', 'A time that works', 'Tuesday, 2:00 PM', 'Your calendar can breathe.'],
    ['Opening hours confirmed', 'There’s still time', 'Open until 8:00 PM', 'Go when it works for you.'],
  ];
  const [status, title, detail, note] = results[i];
  scene.innerHTML=`<div class="case-art outcome-card"><div class="outcome-top"><span class="outcome-check" aria-hidden="true">✓</span><span>${status}</span></div><div class="outcome-body"><span class="outcome-label">${s.name}</span><strong>${title}</strong><span class="outcome-detail">${detail}</span></div><div class="outcome-footer"><span>${note}</span><span class="outcome-example">Example</span></div></div><div class="case-copy"><h3>${splitWords(s.before)}<span class="marked">${splitWords(s.mark)}</span>${splitWords(s.after)}</h3><p>${s.caption}</p></div>`;
  sceneRoot.append(scene);
});
const scenes=$$('.case-scene');
let current=0, sceneTimer, casesPaused=reduceMotion.matches, animations=[], transitionId=0, assetsReady=false;
function highlightBox(index){
  const b=$('.marked',scenes[index]).getBoundingClientRect(), p=stage.getBoundingClientRect();
  const scale=p.width/stage.offsetWidth||1;
  return {left:(b.left-p.left)/scale-8,top:(b.top-p.top)/scale-2,width:b.width/scale+16,height:b.height/scale+3};
}
function placeHighlight(index, animate=false){
  const box=highlightBox(index), previous={left:highlight.style.left,top:highlight.style.top,width:highlight.style.width,height:highlight.style.height,backgroundColor:highlight.style.backgroundColor};
  const next=Object.fromEntries(Object.entries(box).map(([k,v])=>[k,`${v}px`]));next.backgroundColor=scenarios[index].color;
  Object.assign(highlight.style,next);
  if(animate&&!reduceMotion.matches) animations.push(highlight.animate([previous,next],{duration:850,easing:'cubic-bezier(.22,1,.36,1)'}));
}
let settleTimer;
function settleScene(){
  clearTimeout(settleTimer);
  animations.forEach(a=>a.cancel());animations=[];
  scenes.forEach((scene,i)=>{
    scene.classList.remove('scene-enter','scene-exit');
    scene.style.visibility=i===current?'visible':'hidden';
    scene.setAttribute('aria-hidden',String(i!==current));
  });
  placeHighlight(current);
}
function showScene(next){
  settleScene();
  if(next===current)return;
  const old=scenes[current];current=next;
  const incoming=scenes[current];
  incoming.style.visibility='visible';incoming.setAttribute('aria-hidden','false');
  old.setAttribute('aria-hidden','true');
  placeHighlight(current,true);
  if(reduceMotion.matches){settleScene();return;}
  old.classList.add('scene-exit');
  incoming.classList.add('scene-enter');
  // One bounded CSS entrance; settled artwork never retains animation effects.
  settleTimer=setTimeout(settleScene,760);
}
function resetCycle(){
  clearTimeout(sceneTimer);
  if(!assetsReady||!casesInView||casesPaused||document.hidden)return;
  const advance=()=>{
    if(!casesInView||casesPaused||document.hidden)return;
    showScene((current+1)%scenes.length);
    sceneTimer=setTimeout(advance,3200);
  };
  sceneTimer=setTimeout(advance,200);
}
function updateCaseButton(){}
let resizeFrame;
new ResizeObserver(()=>{
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>settleScene());
}).observe(stage);
Promise.all([document.fonts.ready,...$$('.case-art img').map(img=>img.decode().catch(()=>{}))]).then(()=>{
  assetsReady=true;settleScene();resetCycle();
});updateCaseButton();
// Main demo: a single illustrative conversation, replayed as a small narrative.
const demo=$('.demo');let demoPaused=reduceMotion.matches,demoTime=0,lastFrame=0,demoPhase=-1;
const demoSteps=$$('[data-step]');
function renderDemo(time){
  const phase=time<900?0:time<1900?1:time<2800?2:time<9000?3:4;
  if(phase!==demoPhase){
    demoPhase=phase;
    demoSteps.forEach(el=>{const visible=Number(el.dataset.step)<=phase;el.setAttribute('aria-hidden',String(!visible));el.style.opacity=visible?'1':'0';el.style.transform=visible?'translateY(0)':'translateY(9px)';});
    $('#call-state').textContent=phase<3?'Getting ready':phase===3?'Treena is calling':'Call ended';
    $('#message-status').textContent=phase<4?'Calling Publix…':'Call complete';
    
  }
  const storeSpeaking=time>=6200&&phase===3;
  $('.caption-avatar').textContent=storeSpeaking?'P':'T';
  $('.live-caption').dataset.state=phase===4?'complete':storeSpeaking?'reply':'calling';
  $('#caption-speaker').textContent=phase===4?'Answer sent to iMessage':storeSpeaking?'Publix is speaking':phase<3?'Getting your answer':'Treena is speaking';
  $('#transcript').textContent=phase===4?'Oat milk is in stock. You’ll find it in aisle 6.':storeSpeaking?'Yes, we have oat milk in stock. You’ll find it in aisle 6.':phase<3?'Calling Publix to ask for you.':'Hi, I’m an AI assistant calling to check if you have oat milk in stock.';
  $('#call-timer').textContent=phase<3?'00:00':phase===3?'00:'+String(Math.min(42,Math.floor((time-2800)/130))).padStart(2,'0'):'00:42';
}
demoSteps.forEach(el=>el.style.transition='opacity .24s ease, transform .48s cubic-bezier(.22,1,.36,1)');
function tick(now){if(lastFrame&&demoInView&&!demoPaused&&!document.hidden){demoTime=(demoTime+Math.min(now-lastFrame,100))%13000;renderDemo(demoTime)}lastFrame=now;requestAnimationFrame(tick)}
function updateDemoButton(){demo.classList.toggle('is-paused',demoPaused||!demoInView)}
function watchDemo(){demo.scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'center'});demoTime=0;demoPhase=-1;demoPaused=reduceMotion.matches;renderDemo(reduceMotion.matches?9000:0);updateDemoButton()}
$('#watch-call').addEventListener('click',watchDemo);
$('nav a[href="#how-it-works"]').addEventListener('click',event=>{event.preventDefault();watchDemo()});
if(reduceMotion.matches){renderDemo(9000);updateDemoButton()}else{demoTime=0;renderDemo(0)}requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden)settleScene();resetCycle()});
reduceMotion.addEventListener('change',()=>{casesPaused=reduceMotion.matches;demoPaused=reduceMotion.matches;if(reduceMotion.matches){settleScene();renderDemo(9000)}updateCaseButton();updateDemoButton();resetCycle()});
function messageUrl(){return window.TREENA_MESSAGE_URL||'sms:+12138653024'}
const dialog=$('#contact-dialog');
$$('.text-relay').forEach(button=>button.addEventListener('click',event=>{const url=messageUrl();if(url){if(button.tagName==='A')return;event.preventDefault();location.href=url;return}event.preventDefault();if(dialog)dialog.showModal()}));
if(dialog){
  const close=$('.dialog-close');
  if(close)close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close()}});
  const demoBtn=$('#dialog-demo');
  if(demoBtn)demoBtn.addEventListener('click',()=>{dialog.close();watchDemo()});
}
fetch('/api/config').then(res=>res.json()).then(cfg=>{if(!cfg||!cfg.imessage||!cfg.imessage.smsUrl)return;window.TREENA_IMESSAGE_E164=cfg.imessage.e164;window.TREENA_MESSAGE_URL=cfg.imessage.smsUrl;$$('a.text-relay').forEach(a=>{if(String(a.getAttribute('href')||'').startsWith('sms:'))a.href=cfg.imessage.smsUrl})}).catch(()=>{});

// Homepage scroll reveals: a soft section entrance followed by staggered details.
const revealTargets=[$('.demo'),$('.how-strip'),$('.use-cases'),$('.closing'),$('footer')];
const sectionObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting||reduceMotion.matches)return;
    sectionObserver.unobserve(entry.target);
    entry.target.animate([
      {opacity:entry.target===demo?.65:.12,translate:entry.target===demo?'0 12px':'0 28px'},
      {opacity:1,translate:'0 0'}
    ],{duration:1000,easing:'cubic-bezier(.16,1,.3,1)'});
    const details=entry.target===demo?[]
      :entry.target.matches('.how-strip')?[...entry.target.children]
      :entry.target.matches('.use-cases')?$$('.section-kicker, h2, .section-subtitle, .case-stage',entry.target)
      :entry.target.matches('.closing')?[...entry.target.children]:[];
    details.forEach((detail,index)=>detail.animate([
      {opacity:0,translate:'0 16px'},
      {opacity:1,translate:'0 0'}
    ],{duration:900,delay:100+index*90,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
  });
},{threshold:.12,rootMargin:'0px 0px -32px 0px'});
revealTargets.forEach(el=>sectionObserver.observe(el));
reduceMotion.addEventListener('change',()=>{
  if(reduceMotion.matches)revealTargets.forEach(el=>el.getAnimations({subtree:true}).forEach(animation=>animation.cancel()));
});

// Only the section with the strongest presence in the viewport owns playback.
let focusFrame=0;
function syncPlaybackFocus(){
  focusFrame=0;
  const targets=[demo,$('.use-cases')];
  const scores=targets.map(el=>{
    const r=el.getBoundingClientRect();
    const visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
    return visible/Math.min(r.height,innerHeight);
  });
  const winner=document.hidden||Math.max(...scores)<.15?-1:scores[0]>=scores[1]?0:1;
  const nextCases=winner===1;
  const nextDemo=winner===0;
  if(nextDemo!==demoInView&&!reduceMotion.matches){
    demoTime=0;
    lastFrame=0;
    demoPhase=-1;
    renderDemo(0);
  }
  demoInView=nextDemo;
  if(casesInView!==nextCases){
    casesInView=nextCases;
    if(!casesInView)settleScene();
    resetCycle();
  }
  updateDemoButton();
}
function queuePlaybackFocus(){if(!focusFrame)focusFrame=requestAnimationFrame(syncPlaybackFocus)}
addEventListener('scroll',queuePlaybackFocus,{passive:true});
addEventListener('resize',queuePlaybackFocus);
document.addEventListener('visibilitychange',queuePlaybackFocus);
syncPlaybackFocus();

// Scroll depth belongs to outer shells, preserving highlight measurements inside.
const focusShells=[demo,$('.use-cases')].map(el=>{
  const shell=document.createElement('div');
  shell.className='scroll-depth-shell';
  el.before(shell);shell.append(el);
  return {shell,el};
});
let depthFrame=0;
function renderScrollDepth(){
  depthFrame=0;
  focusShells.forEach(({shell,el})=>{
    const r=shell.getBoundingClientRect();
    const center=r.top+r.height/2;
    const focus=Math.max(0,Math.min(1,1-Math.abs(center-innerHeight*.52)/(innerHeight*.8)));
    // Individual scale does not overwrite the one-time translate entrance.
    const minimum=innerWidth<=620?.985:.97;
    const easedFocus=focus*focus*(3-2*focus);
    el.style.scale=reduceMotion.matches||el!==demo?'1':String(minimum+(1-minimum)*easedFocus);
  });
}
function queueScrollDepth(){if(!depthFrame)depthFrame=requestAnimationFrame(renderScrollDepth)}
addEventListener('scroll',queueScrollDepth,{passive:true});
addEventListener('resize',queueScrollDepth);
reduceMotion.addEventListener('change',queueScrollDepth);
renderScrollDepth();
