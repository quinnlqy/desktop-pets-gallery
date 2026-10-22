/* One continuous illustrated bun. Features and bow share its soft deformation. */
window.paintMantou=function(c,s,env,opts={}){
 const {mood,p,e,t}=s,{artImages,clamp,line,path,oval,reduced,offsetX,offsetY,dragX,dragY,aimX,pointer}=env;
 if(Object.values(artImages).some(i=>!i.complete||!i.naturalWidth))return;
 const active=k=>mood===k?e:0,tail=clamp(p/.68,0,1),recovery=mood==='land'?(s.fromGrab??1)*(1-tail*tail*(3-2*tail)):0;
 const happy=active('happy'),party=active('celebrate'),sad=active('sad'),angry=active('angry'),sleep=active('sleep'),pet=active('pet'),look=active('look')+active('typing'),grab=active('grab')+recovery,land=active('land');
 const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);},touch=pet*ease((p-.08)/.16),motion=reduced?.22:1;
 const px=opts.avatar?0:offsetX+dragX,py=opts.avatar?0:offsetY+dragY;
 const hop=(happy*Math.max(0,Math.sin((p-.08)*Math.PI*4))*8+party*Math.max(0,Math.sin(p*Math.PI*6))*25+angry*Math.max(0,Math.sin(p*Math.PI*10))*2)*motion;
 const tilt=(touch*-.045+sad*.055+sleep*-.038+happy*Math.sin(p*Math.PI*4)*.035+angry*Math.sin(p*Math.PI*14)*.022+look*clamp(pointer.x,-1,1)*.035+grab*clamp(aimX-dragX,-15,15)*.002)*motion;
 const bow=(Math.sin(t*1.4)*.7+happy*Math.sin(p*Math.PI*5)*5+party*Math.sin(p*Math.PI*8)*7+touch*3+sad*4+grab*Math.sin(t*5)*5)*motion;
 const jelly=(happy*Math.sin(p*Math.PI*6)*1.6+party*Math.sin(p*Math.PI*10)*2.4+angry*Math.sin(p*Math.PI*12)*1.2+land*Math.sin(p*Math.PI*4)*4)*motion;
 const squash=(sleep*.025+sad*.012-grab*.023+party*Math.sin(p*Math.PI*6)*.012+land*Math.sin(p*Math.PI*4)*.022)*motion;
 const bank=window.paintMantou;
 if(!bank.surface){bank.surface=document.createElement('canvas');bank.surface.width=bank.surface.height=768;}
 const q=bank.surface.getContext('2d',{willReadFrequently:true});q.setTransform(1,0,0,1,0,0);q.globalAlpha=1;q.clearRect(0,0,768,768);q.drawImage(artImages.body,0,0,768,768);q.scale(.6,.6);
 const ink='#3e2d25',light='#fff9ef',eyeY=762,eyes=[542,944],mouthX=744;
 const blink=opts.avatar?0:Math.max(0,1-Math.abs(t%5.2-4.6)/.13),energy=Math.max(happy,party,sad,angry,sleep,touch,grab);
 const gazeX=(look*clamp(pointer.x,-1,1)*8+pet*2),gazeY=look*-5+sad*3;
 function square(size,open=1){
  const h=Math.max(3,size*open),r=Math.min(17,h*.24),x=-size/2,y=-h/2;
  q.beginPath();q.moveTo(x+r,y);q.arcTo(x+size,y,x+size,y+h,r);q.arcTo(x+size,y+h,x,y+h,r);q.arcTo(x,y+h,x,y,r);q.arcTo(x,y,x+size,y,r);q.closePath();q.fillStyle=ink;q.fill();
  if(open>.3){oval(q,size*.22,-h*.28,7.8,7.2,light);q.globalAlpha*=.08;for(let i=0;i<11;i++)oval(q,Math.sin(i*4.1)*size*.35,Math.cos(i*3.3)*h*.33,2,1.7,'#d9c6b5');q.globalAlpha/=.08;}
 }
 for(const [i,x]of eyes.entries()){
  const side=i?1:-1;q.save();q.translate(x+gazeX,eyeY+gazeY);
  q.globalAlpha=1-energy;square(110,Math.max(.07,1-blink));q.globalAlpha=energy;
  if(party)line(q,[[-37,-26],[18,0],[-37,26]].map(([x,y])=>[side<0?x:-x,y]),ink,18);
  else if(happy)line(q,[[-40,9],[0,-48,40,9]],ink,18);
  else if(sad){q.scale(-side,1);line(q,[[-39,17],[0,24,39,-13]],ink,17);}
  else if(angry){q.scale(-side,1);line(q,[[-40,-17],[39,17]],ink,20);}
  else if(sleep)line(q,[[-41,-6],[0,34,41,-6]],ink,17);
  else if(grab)square(119,1.05);
  else if(touch){if(i===0)line(q,[[-39,7],[0,-40,39,7]],ink,17);else square(108,.62);}
  q.restore();
 }
 // The original small caret mouth stays closed; no human mouth, eyebrows or added limbs.
 q.save();q.translate(mouthX,823);line(q,[[-43,12],[0,-28],[43,12]],ink,18);q.restore();
 if(!opts.noEffects&&sad>.15){q.globalAlpha=sad;for(const x of [497,983])path(q,`M${x} 817Q${x-23} 850 ${x} 860Q${x+23} 851 ${x} 817Z`,'#88c7e5','#69a8cb',3);q.globalAlpha=1;}
 if(!opts.avatar){const shade=clamp(1-(hop+Math.abs(py))*.008,.25,1);c.globalAlpha=shade;oval(c,226+px,324,83,8,'#82664d23');oval(c,226+px,325,58,4,'#82664d1a');c.globalAlpha=1;}
 c.save();c.translate(226+px,323+py-hop+sad*3+sleep*4);c.rotate(tilt);const breath=Math.sin(t*1.6)*.0015*motion;c.scale(1+squash+breath,1/(1+squash)+breath);
 // A continuous, foot-anchored soft lean keeps dough and bow attached without cut seams.
 c.save();c.transform(1,0,-bow/284,1,0,0);c.scale(1+jelly*.001,1-jelly*.001);c.drawImage(bank.surface,-142,-724*284/768,284,284);c.restore();
 if(!opts.noEffects){
  if(happy>.15||touch>.15){const v=Math.max(happy,touch);c.globalAlpha=v;for(const[x,y,color]of[[-135,-178,'#e98faa'],[113,-223,'#b69ae2']]){c.save();c.translate(x,y-v*8);c.scale(.62,.62);path(c,'M0 4C-18-5-12-17-5-15Q0-14 0-9Q2-19 10-14C21-7 4 4 0 4Z',color);c.restore();}c.globalAlpha=1;}
  if(sleep>.2){c.globalAlpha=sleep*.8;const y=-204-Math.sin(t)*3;line(c,[[114,y],[122,y],[114,y+9],[122,y+9]],'#82a6bd',1.9);line(c,[[132,y-20],[143,y-20],[132,y-8],[143,y-8]],'#82a6bd',1.9);c.globalAlpha=1;}
  if(angry>.2){c.globalAlpha=angry;line(c,[[122,-192],[122,-199,129,-199]],'#d28e87',2);line(c,[[135,-195],[142,-195,142,-188]],'#d28e87',2);c.globalAlpha=1;}
 }
 c.restore();
 if(!opts.noEffects&&mood==='celebrate'){
  const colors=['#ee839d','#efbc55','#78bea9','#76aedd','#b89ad9','#eea070'];
  for(const[burst,start]of[.16,.43].entries()){
   const age=(p-start)*3.5;if(age<0||age>2.4)continue;
   for(let i=0;i<28;i++){
    const side=i%2?1:-1,seed=((i*37+burst*19)%101)/100,x=226+px+side*68+side*(32+seed*75)*age*motion+Math.sin(age*5+i)*age*7*motion,y=192+py-(105+(i*23)%79)*age*motion+102*age*age*motion;
    c.save();c.translate(x,y);c.rotate(i*1.7+age*(side*3+seed*4));c.scale(.35+.65*Math.abs(Math.cos(age*7+i)),1);c.globalAlpha=ease(age/.07)*(1-ease((age-1.8)/.6))*(1-ease((p-.82)/.18));path(c,i%3?'M-3.2-2L3-2.4L3.2 2L-2.8 2.4Z':'M-2.2-4Q1-2 1.6 0Q-1 2 .3 4L2.8 3Q1 1 3-.8Q1.7-3-.2-4Z',colors[(i+burst*2)%6]);c.restore();
   }
  }
 }
};
