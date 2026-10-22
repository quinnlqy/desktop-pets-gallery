(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#pet'), ctx = canvas.getContext('2d'), scene = $('#scene');
  const W = 452, H = 424, TAU = Math.PI * 2;
  const themes = {
    mist: { page:'#eeeade', scene:'#f6edcf', ink:'#5c4b42', accent:'#87946c', soft:'#f0f1e4', tint:null },
    sage: { page:'#e9ecdf', scene:'#e7e9cd', ink:'#4c5543', accent:'#7e9066', soft:'#eef1e2', tint:'#b7c69b' },
    rose: { page:'#f1e7df', scene:'#f5e7d1', ink:'#614d46', accent:'#af8a7c', soft:'#f5ece5', tint:'#f0c7bc' },
    oat: { page:'#eee8da', scene:'#eee4c7', ink:'#5b503f', accent:'#a29469', soft:'#f3efdf', tint:'#e4c895' }
  };
  const storeKey = 'blackface-sheep-card-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch {}
  let theme = themes[saved.theme] ? saved.theme : 'mist', sound = saved.sound === true;
  const signature = $('#signature'), note = $('#note');
  signature.textContent = typeof saved.signature === 'string' ? Array.from(saved.signature).slice(0,24).join('') : '我和小羊';
  note.textContent = typeof saved.note === 'string' ? Array.from(saved.note).slice(0,240).join('') : '';
  let storageWarned = false;
  function persist() {
    try { localStorage.setItem(storeKey, JSON.stringify({theme, sound, signature:signature.textContent, note:note.textContent})); }
    catch { if (!storageWarned) { toast('浏览器未允许保存，关闭页面前请先保存图片'); storageWarned = true; } }
  }
  function toast(s) { $('#toast').textContent=s; $('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2800); }
  function setTheme(t) {
    theme=t;const p=themes[t];for(const k of ['page','scene','ink','accent','soft'])document.documentElement.style.setProperty('--'+k,p[k]);
    document.querySelector('meta[name=theme-color]').content=p.page;
    document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.theme===t));
    drawAvatar();
  }
  let audio;
  function chime(mood='happy') {
    if(!sound)return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();
      const notes=mood==='celebrate'?[523.25,659.25,783.99]:mood==='angry'?[220,207.65]:mood==='sad'?[329.63,293.66]:[440,554.37];
      notes.forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.11;o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.042,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.34);});
    } catch {}
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=x=>x*x*(3-2*x);
  const ease=x=>smooth(clamp(x,0,1));
  function oval(c,x,y,rx,ry,fill,stroke,lw=2,rot=0){c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function line(c,points,col='#535653',width=2){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++){const p=points[i];if(p.length===4)c.quadraticCurveTo(...p);else if(p.length===6)c.bezierCurveTo(...p);else c.lineTo(...p);}c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function path(c,d,fill,stroke,width=2){const p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke(p);}}
  function background(c,t){
    const p=themes[theme];c.fillStyle=p.scene;c.fillRect(0,0,W,H);
    const image=artImages.meadow;if(image.complete&&image.naturalWidth)c.drawImage(image,0,0,W,H);
    if(p.tint){c.globalAlpha=.12;c.fillStyle=p.tint;c.fillRect(0,0,W,H);c.globalAlpha=1;}
  }
  const durations={happy:2900,celebrate:3500,sad:3400,angry:3000,sleep:8500,pet:2500,look:1900,typing:2200,land:900};
  let action=null,lastActivity=performance.now(),lastTime=0,pendingAction=null,pendingTimer;
  let pointer={x:0,y:0,near:false},drag=null,dragX=0,dragY=0,aimX=0,aimY=0,offsetX=0,offsetY=0;
  let lookCooldown=0,typingCooldown=0,autoSleep=false,watchUntil=0,watchKind='look';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frames=0;
  function highlight(mood){document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.action===mood));}
  function start(mood,opts={}){
    if(action||drag)return false;
    clearTimeout(pendingTimer);pendingAction=null;watchUntil=0;
    action={mood,start:performance.now(),duration:durations[mood]||2500,automatic:!!opts.automatic,fromGrab:opts.fromGrab};autoSleep=!!opts.automatic;
    highlight(mood);if(!opts.silent&&mood!=='sleep'&&mood!=='typing'&&mood!=='look')chime(mood);
    return true;
  }
  function wake(){if(action?.mood==='sleep'&&!action.wake){const now=performance.now(),raw=clamp((now-action.start)/action.duration,0,1),phase=action.automatic&&raw>=1?.5:raw;action.wake={time:now,phase,amplitude:ease(phase/.2)*(1-ease((phase-.78)/.22))};action.automatic=false;autoSleep=false;}}
  function activity(){lastActivity=performance.now();}
  function stateAt(now){
    let mood='idle',p=0,e=0;
    if(action){
      const waking=action.wake;p=waking?(now-waking.time>=550?1:waking.phase):clamp((now-action.start)/action.duration,0,1);mood=action.mood;
      if(p>=1){if(action.automatic&&mood==='sleep'){p=.5;}else{action=null;autoSleep=false;highlight(null);activity();mood='idle';p=0;const next=pendingAction;pendingAction=null;if(next)pendingTimer=setTimeout(()=>start(next),180);}}
      e=waking&&action?waking.amplitude*(1-ease((now-waking.time)/550)):ease(p/.2)*(1-ease((p-.78)/.22));
    }
    if(!action&&!drag&&now<watchUntil){mood=watchKind;p=1-(watchUntil-now)/2200;e=ease((2200-(watchUntil-now))/250)*ease((watchUntil-now)/450);}
    if(drag?.held){mood='grab';e=ease((now-drag.grabAt)/250);p=(now-drag.grabAt)/1000;}
    return {mood,p,e,t:now/1000,fromGrab:action?.fromGrab};
  }
  const artImages={};
  for(const [key,asset] of Object.entries(window.SHEEP_ART)){
    const image=new Image();artImages[key]=image;
    image.addEventListener('load',()=>drawAvatar());
    image.addEventListener('error',()=>toast('小羊图片未能载入，请重新打开页面'));
    image.src=asset.src;
  }
  function drawPet(c,s,opts={}) {
    window.paintSheep(c,s,{artImages,offsetX,offsetY,dragX,dragY,aimX,reduced,pointer,oval,line,path,clamp},opts);
  }
  function drawAvatar(){
    const c=$('#avatar').getContext('2d');c.clearRect(0,0,192,192);c.fillStyle=themes[theme].scene;c.fillRect(0,0,192,192);c.save();c.scale(2,2);c.translate(-69,-49);c.scale(.52,.52);drawPet(c,{mood:'idle',p:0,e:0,t:1},{avatar:true});c.restore();
  }
  function fit(){const dpr=Math.min(devicePixelRatio||1,3);const r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
  if(window.ResizeObserver)new ResizeObserver(fit).observe(scene);
  else window.addEventListener('resize',fit);
  function tick(now){
    const dt=Math.min(40,now-(lastTime||now));lastTime=now;frames++;
    if(!action&&!drag&&now-lastActivity>23000&&document.activeElement?.getAttribute('contenteditable')!=='true')start('sleep',{automatic:true,silent:true});
    const f=1-Math.exp(-dt/65);dragX=lerp(dragX,aimX,f);dragY=lerp(dragY,aimY,f);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);background(ctx,now/1000);drawPet(ctx,stateAt(now));
    requestAnimationFrame(tick);
  }
  function point(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
  function hit(pt){return Math.pow((pt.x-226-offsetX-dragX)/139,2)+Math.pow((pt.y-225-offsetY-dragY)/139,2)<1;}
  canvas.addEventListener('pointermove',ev=>{
    const pt=point(ev);pointer.x=(pt.x-226)/226;pointer.y=(pt.y-212)/212;
      if(drag&&drag.id===ev.pointerId){const dx=pt.x-drag.x,dy=pt.y-drag.y;if(Math.hypot(dx,dy)>6)drag.moved=true;if(drag.moved||drag.held){if(!drag.held){drag.held=true;drag.grabAt=performance.now();}aimX=clamp(dx, -65-offsetX,65-offsetX);aimY=clamp(dy,-70-offsetY,8-offsetY);wake();highlight(null);}activity();return;}
    if(ev.pointerType==='mouse'&&hit(pt)&&!pointer.near){pointer.near=true;activity();wake();if(performance.now()-lookCooldown>3500){lookCooldown=performance.now();watchUntil=performance.now()+2200;watchKind='look';}}
    if(!hit(pt))pointer.near=false;
  });
  canvas.addEventListener('pointerleave',()=>{pointer.near=false;});
  canvas.addEventListener('pointerdown',ev=>{
    if(ev.button!==0)return;const pt=point(ev);activity();wake();
    if(!hit(pt)||action)return;
    watchUntil=0;drag={id:ev.pointerId,x:pt.x,y:pt.y,time:performance.now(),moved:false,held:false};canvas.setPointerCapture(ev.pointerId);
    drag.timer=setTimeout(()=>{if(drag&&!drag.held){drag.held=true;drag.grabAt=performance.now();chime('sad');}},280);
    ev.preventDefault();
  });
  function release(ev,cancelled=false){
    if(!drag||drag.id!==ev.pointerId)return;
    const held=drag.held,moved=drag.moved,fromGrab=held?ease((performance.now()-drag.grabAt)/250):0;clearTimeout(drag.timer);drag=null;
    if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
    // Land directly below the held pet; keep all of the silhouette inside the scene.
    if(held||moved){offsetX=clamp(offsetX+dragX,-65,65);dragX=0;offsetY=0;aimX=0;aimY=0;start('land',{silent:true,fromGrab});}
    else {aimX=aimY=0;if(!cancelled)start('pet');}
    activity();
  }
  canvas.addEventListener('pointerup',ev=>release(ev));canvas.addEventListener('pointercancel',ev=>release(ev,true));canvas.addEventListener('lostpointercapture',ev=>release(ev,true));
  canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
  canvas.addEventListener('keydown',ev=>{
    if(ev.key===' '||ev.key==='Enter'){ev.preventDefault();activity();wake();start('pet');}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)){ev.preventDefault();activity();if(!action){offsetX=clamp(offsetX+(ev.key==='ArrowRight'?12:ev.key==='ArrowLeft'?-12:0),-65,65);start('look',{silent:true});}}
  });
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{activity();const mood=b.dataset.action;if(action?.mood==='sleep'){pendingAction=mood==='sleep'?null:mood;wake();}else if(action){if(action.mood!==mood)pendingAction=mood;}else start(mood);}));
  // Text stays in place and is stored at each input, including composition input.
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>{
    const el=document.getElementById(b.dataset.edit);if(el.contentEditable==='true'){el.blur();return;}
    el.contentEditable='true';b.setAttribute('aria-pressed','true');el.focus();const sel=getSelection(),range=document.createRange();range.selectNodeContents(el);range.collapse(false);sel.removeAllRanges();sel.addRange(range);activity();wake();
  }));
  let composing=false;
  for(const el of [signature,note]){
    el.addEventListener('compositionstart',()=>{composing=true;});el.addEventListener('compositionend',()=>{composing=false;limitText(el);persist();});
    el.addEventListener('input',()=>{if(!composing)limitText(el);persist();activity();wake();if(performance.now()-typingCooldown>2500){typingCooldown=performance.now();pointer.x=.25;watchUntil=performance.now()+2200;watchKind='typing';}});
    el.addEventListener('paste',ev=>{ev.preventDefault();const raw=ev.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,el===signature?raw.replace(/[\r\n]+/g,' '):raw);});
    el.addEventListener('keydown',ev=>{if(ev.isComposing)return;if(ev.key==='Escape'||(ev.key==='Enter'&&(el===signature||ev.ctrlKey||ev.metaKey))){ev.preventDefault();el.blur();}});
    el.addEventListener('blur',()=>{limitText(el);el.contentEditable='false';document.querySelector(`[data-edit="${el.id}"]`).setAttribute('aria-pressed','false');persist();});
  }
  function limitText(el){const max=Number(el.dataset.limit);let text=el.innerText.replace(/\r/g,'');if(el===signature)text=text.replace(/\n/g,' ');const chars=Array.from(text);if(chars.length>max||el.children.length||el.textContent!==text){el.textContent=chars.slice(0,max).join('');if(document.activeElement===el){const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);}}}
  function toggleMenu(open){$('#settings').hidden=!open;$('#menu-toggle').setAttribute('aria-expanded',open);}
  $('#menu-toggle').addEventListener('click',()=>{activity();toggleMenu($('#settings').hidden);});
  document.addEventListener('click',ev=>{if(!ev.target.closest('.card-head'))toggleMenu(false);});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){toggleMenu(false);}});
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{setTheme(b.dataset.theme);persist();activity();}));
  $('#sound').setAttribute('aria-checked',sound);$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').setAttribute('aria-checked',sound);persist();chime();activity();});
  function updateDate(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');$('#date').dateTime=`${y}-${m}-${day}`;$('#date').textContent=`${y}年${m}月${day}日`;}
  updateDate();setInterval(updateDate,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastTime=0;activity();updateDate();}});
  // Export paints the actual current scene, plus card elements at their live positions.
  // It uses no remote images, HTML-to-image service, or connection to an AI service.
  function exportCard(){
    const card=$('.pet-card'),r=card.getBoundingClientRect(),scale=3;
    const out=document.createElement('canvas');out.width=Math.round(r.width*scale);out.height=Math.round(r.height*scale);const c=out.getContext('2d');c.scale(scale,scale);c.fillStyle='#fffefa';c.fillRect(0,0,r.width,r.height);
    const rect=el=>{const b=el.getBoundingClientRect();return{x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height};};
    const sc=rect(canvas);c.drawImage(canvas,sc.x,sc.y,sc.w,sc.h);
    const av=rect($('#avatar'));c.save();c.beginPath();c.arc(av.x+av.w/2,av.y+av.h/2,av.w/2,0,TAU);c.clip();c.drawImage($('#avatar'),av.x,av.y,av.w,av.h);c.restore();
    function round(x,y,w,h,rad,fill){c.fillStyle=fill;c.beginPath();c.moveTo(x+rad,y);c.arcTo(x+w,y,x+w,y+h,rad);c.arcTo(x+w,y+h,x,y+h,rad);c.arcTo(x,y+h,x,y,rad);c.arcTo(x,y,x+w,y,rad);c.closePath();c.fill();}
    for(const b of document.querySelectorAll('[data-action]')){if(b.getAttribute('aria-pressed')==='true'){const q=rect(b);round(q.x,q.y,q.w,q.h,13,themes[theme].soft);}}
    for(const svg of document.querySelectorAll('.pet-card svg')){
      if(svg.closest('.settings')||!svg.getBoundingClientRect().width)continue;
      const b=rect(svg),v=svg.viewBox.baseVal;c.save();c.translate(b.x,b.y);c.scale(b.w/v.width,b.h/v.height);
      for(const shape of svg.children){const st=getComputedStyle(shape);c.fillStyle=st.fill;c.strokeStyle=st.stroke;c.lineWidth=parseFloat(st.strokeWidth)||1;c.lineCap=st.strokeLinecap;c.lineJoin=st.strokeLinejoin;let p;if(shape.tagName.toLowerCase()==='circle'){p=new Path2D();p.arc(+shape.getAttribute('cx'),+shape.getAttribute('cy'),+shape.getAttribute('r'),0,TAU);}else if(shape.hasAttribute('d'))p=new Path2D(shape.getAttribute('d'));if(p){if(st.fill!=='none')c.fill(p);if(st.stroke!=='none')c.stroke(p);}}
      c.restore();
    }
    function text(el){
      const style=getComputedStyle(el),fs=parseFloat(style.fontSize);c.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;c.fillStyle=style.color;c.textBaseline='alphabetic';
      const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;
      while((n=walk.nextNode())){let buffer='',last=null;const flush=()=>{if(last&&buffer)c.fillText(buffer,last.x-r.x,last.y-r.y+fs*.88);buffer='';};
        // Ranges preserve each browser-wrapped line, including player line breaks.
        for(let i=0;i<n.textContent.length;){const code=n.textContent.codePointAt(i),len=code>65535?2:1,ch=n.textContent.slice(i,i+len),range=document.createRange();range.setStart(n,i);range.setEnd(n,i+len);const box=range.getBoundingClientRect();if(ch==='\n'||!box.width){flush();last=null;}else if(last&&Math.abs(last.y-box.y)<1){buffer+=ch;}else{flush();last=box;buffer=ch;}i+=len;}flush();
      }
    }
    for(const el of document.querySelectorAll('h1,.actions span,.share-button span,#signature,#note,#date'))text(el);
    const sr=rect($('.share-row'));c.fillStyle='#eceeeb';c.fillRect(sr.x,sr.y+sr.h-1,sr.w,1);
    return out;
  }
  let imageURL,shareFile,sharing=false;
  $('#share').addEventListener('click',async()=>{
    if(sharing)return;sharing=true;toggleMenu(false);document.activeElement?.blur();updateDate();
    try {const out=exportCard();const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('blob')),'image/png'));if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);$('#share-image').src=imageURL;$('#download').href=imageURL;const filename=`黑脸小羊-${$('#date').dateTime}.png`;$('#download').download=filename;shareFile=new File([blob],filename,{type:'image/png'});const dialog=$('#share-dialog');if(dialog.showModal)dialog.showModal();else{dialog.classList.add('dialog-fallback');dialog.setAttribute('open','');dialog.setAttribute('aria-modal','true');$('#close-share').focus();}}
    catch {toast('图片暂时未能生成，请再试一次');}finally{sharing=false;}
  });
  function closeShare(){const dialog=$('#share-dialog');if(dialog.close)dialog.close();else dialog.removeAttribute('open');$('#share').focus();}
  $('#close-share').addEventListener('click',closeShare);
  $('#share-dialog').addEventListener('click',ev=>{if(ev.target===$('#share-dialog')){const r=ev.target.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closeShare();}});
  $('#system-share').addEventListener('click',async()=>{
    if(!shareFile)return;
    try {if(navigator.canShare?.({files:[shareFile]})){await navigator.share({files:[shareFile],title:'黑脸小羊'});}else toast('这个浏览器请长按图片保存，再分享给朋友');}
    catch(err){if(err.name!=='AbortError')toast('请长按图片保存，或点击保存图片');}
  });
  setTheme(theme);fit();requestAnimationFrame(tick);
  // Small read-only diagnostics for repeatable interaction checks.
  Object.defineProperty(window,'sheepStatus',{get:()=>({mood:drag?.held?'grab':action?.mood||'idle',progress:action?clamp((performance.now()-action.start)/action.duration,0,1):0,automaticSleep:autoSleep,dragging:!!drag?.held,position:{x:offsetX+dragX,y:offsetY+dragY},frames,theme,sound,artReady:Object.values(artImages).every(img=>img.complete&&img.naturalWidth>0)})});
})();
