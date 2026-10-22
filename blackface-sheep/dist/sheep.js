/* Four-limb rig. Every pose shares the same underpainted body and illustrated parts. */
window.paintSheep = function(c,s,env,opts={}) {
 const {mood,p,e,t}=s,active=k=>mood===k?e:0;
 const {artImages,offsetX,offsetY,dragX,dragY,aimX,reduced,pointer,oval,line,path,clamp}=env;
 if(Object.values(artImages).some(img=>!img.complete||!img.naturalWidth))return;
 const tail=clamp(p/.68,0,1),recovering=mood==='land'?(s.fromGrab??1)*(1-tail*tail*(3-2*tail)):0;
 const happy=active('happy'),pet=active('pet'),party=active('celebrate'),sad=active('sad'),angry=active('angry'),sleep=active('sleep'),look=active('look')+active('typing'),grab=active('grab')+recovering,land=active('land');
 const motion=reduced?.2:1,px=opts.avatar?0:offsetX+dragX,py=opts.avatar?0:offsetY+dragY;
 const cycle=Math.sin(p*Math.PI*6),breath=Math.sin(t*1.85),hop=party*Math.max(0,Math.sin(p*Math.PI*8))*25*motion;
 const stomp=angry*Math.max(0,Math.sin(p*Math.PI*6))*2.5*motion;
 const sink=sad*7+sleep*10+land*Math.sin(p*Math.PI)*3;
 const tilt=(happy*Math.sin(p*Math.PI*4)*.042+pet*-.065+sad*.065+sleep*-.075+angry*Math.sin(p*Math.PI*6)*.035+look*-.035+grab*clamp(aimX-dragX,-12,12)*.002)*motion;
 const unit=300/1280,at=(x,y)=>[(x-640)*unit,y*unit-280];
 function part(key){const a=window.SHEEP_ART[key];c.drawImage(artImages[key],a.x*unit-150,a.y*unit-280,a.w*unit,a.h*unit);}
 function pivotPart(key,x,y,angle,dx=0,dy=0){const a=at(x,y);c.save();c.translate(a[0]+dx,a[1]+dy);c.rotate(angle);c.translate(-a[0],-a[1]);part(key);c.restore();}
 function bodyWithFeet(){
  const bank=window.paintSheep;
  if(bank.footBodySource!==artImages.body){
   const cv=document.createElement('canvas');cv.width=cv.height=1280;
   const q=cv.getContext('2d',{willReadFrequently:true});q.drawImage(artImages.body,0,0,1280,1280);
   bank.footBodySource=artImages.body;bank.bodyCanvas=cv;
   bank.footPixels=[330,735].map(x=>({x,y:1180,w:200,h:64,pixels:q.getImageData(x,1180,200,64),output:q.createImageData(200,64)}));
  }
  const q=bank.bodyCanvas.getContext('2d');
  for(const [i,patch]of bank.footPixels.entries()){
   const side=i?1:-1;
   const angle=(party*.22*Math.sin(p*Math.PI*8)+grab*(.14+.17*Math.sin(t*5+side))+angry*Math.max(0,Math.sin(p*Math.PI*6+side))*-.16)*motion;
   // The entire socket and upper hoof stay pixel-fixed. Only the distal tip bends.
   const lift=(sleep*16+sad*4+angry*Math.max(0,Math.sin(p*Math.PI*6+side*.7))*9)*motion;
   if(patch.angle===angle&&patch.lift===lift)continue;
   patch.angle=angle;patch.lift=lift;
   if(!angle&&!lift){q.putImageData(patch.pixels,patch.x,patch.y);continue;}
   const {w,h,pixels,output:out}=patch,src=pixels.data,H=44;out.data.fill(0);
   for(let y=0;y<h;y++){
    // Invert y' = y - lift*(y/H)^2; root derivative remains one.
    const sy=lift>.0001?(2*y)/(1+Math.sqrt(Math.max(0,1-4*lift*y/(H*H)))):y;
    if(sy>=H+1)continue;
    const wgt=Math.min(1,sy/H),shift=Math.sin(angle)*sy*wgt*wgt*side;
    for(let x=0;x<w;x++){
     const sx=x-shift,x0=Math.floor(sx),y0=Math.floor(sy);if(x0<0||x0+1>=w||y0+1>=h)continue;
     const fx=sx-x0,fy=sy-y0,di=(y*w+x)*4;
     for(let ch=0;ch<4;ch++)out.data[di+ch]=Math.round(src[(y0*w+x0)*4+ch]*(1-fx)*(1-fy)+src[(y0*w+x0+1)*4+ch]*fx*(1-fy)+src[((y0+1)*w+x0)*4+ch]*(1-fx)*fy+src[((y0+1)*w+x0+1)*4+ch]*fx*fy);
    }
   }
   q.putImageData(out,patch.x,patch.y);
  }
  c.drawImage(bank.bodyCanvas,-150,-280,300,300);
 }
 function bendEar(key,side,angle){
  const a=window.SHEEP_ART[key],bx=side<0?0:900,by=200,pinX=side<0?215:1085,pinY=side<0?395:415;
  const bank=window.paintSheep.earCanvases??=(Object.create(null));
  const cv=bank[key]??=(document.createElement('canvas'));if(cv.width!==400){cv.width=400;cv.height=500;}
  const q=cv.getContext('2d');q.setTransform(1,0,0,1,0,0);q.clearRect(0,0,400,500);q.translate(-bx,-by);
  const warp=(u,v)=>{const x=a.x+u,y=a.y+v,w=clamp(side*(x-pinX)/160,0,1),r=angle*.55*w*w*(3-2*w),dx=x-pinX,dy=y-pinY;return [pinX+dx*Math.cos(r)-dy*Math.sin(r),pinY+dx*Math.sin(r)+dy*Math.cos(r)];};
  function triangle(points,A,B,C,D,E,F,sx,sw){
   const mx=(points[0][0]+points[1][0]+points[2][0])/3,my=(points[0][1]+points[1][1]+points[2][1])/3;
   q.save();q.beginPath();points.forEach(([x,y],i)=>{const len=Math.hypot(x-mx,y-my)||1,px=x+(x-mx)/len*1.5,py=y+(y-my)/len*1.5;i?q.lineTo(px,py):q.moveTo(px,py);});q.closePath();q.clip();q.transform(A,B,C,D,E,F);
   q.drawImage(artImages[key],-sx,0,a.w,a.h);q.restore();
  }
  for(let i=0;i<16;i++){
   const sx=a.w*i/16,sw=a.w/16,h=a.h,p0=warp(sx,0),p1=warp(sx+sw,0),p2=warp(sx+sw,h),p3=warp(sx,h);
   let A=(p1[0]-p0[0])/sw,B=(p1[1]-p0[1])/sw,C=(p3[0]-p0[0])/h,D=(p3[1]-p0[1])/h;
   triangle([p0,p1,p3],A,B,C,D,p0[0],p0[1],sx,sw);
   A=(p2[0]-p3[0])/sw;B=(p2[1]-p3[1])/sw;C=(p2[0]-p1[0])/h;D=(p2[1]-p1[1])/h;
   triangle([p1,p2,p3],A,B,C,D,p2[0]-A*sw-C*h,p2[1]-B*sw-D*h,sx,sw);
  }
  // Copy the pinned base without resampling so its contour and root pixels never shift.
  q.save();q.beginPath();q.rect(side<0?pinX:900,200,side<0?400-pinX:pinX-900,500);q.clip();q.clearRect(a.x,a.y,a.w,a.h);q.drawImage(artImages[key],a.x,a.y,a.w,a.h);q.restore();
  c.drawImage(cv,bx*unit-150,by*unit-280,400*unit,500*unit);
 }
 if(!opts.avatar){
  const alpha=clamp(1-(hop+Math.abs(py))*.005,.3,1);c.globalAlpha=alpha;oval(c,226+px,357,73,9,'#796d4a24');oval(c,226+px,357,48,4.5,'#796d4a18');c.globalAlpha=1;
 }
 c.save();c.translate(226+px,355+py-hop+stomp+sink);c.rotate(tilt);
 // Quiet breathing keeps the floor anchor stable; emotions never rescale the body.
 c.scale(1+breath*.0013*motion,1+breath*.002*motion);
 // The extracted silhouettes exclude the unrelated fleece outlines behind the ears.
 const earDroop=sad*.65+sleep*.72+grab*.38-happy*.21-party*.42-look*.43;
 function drawEars(){for(const side of [-1,1]){
  const twitch=(Math.sin(t*1.8+side)*.025+(look&&side<0?-.2:0))*motion;
  const angle=side*(earDroop+angry*.20+twitch);
  // Keep the entire attachment region fixed; only the soft outer flap bends.
  bendEar(side<0?'earL':'earR',side,angle);
 }}
 bodyWithFeet();
 // Original short hoof AND its surrounding fleece turn together about the original wool root.
 // Keep the reference coordinates and native proportions; never invent or lengthen an arm.
 for(const side of [-1,1]){
  const key=side<0?'pawL':'pawR',a=window.SHEEP_ART[key];
  const lift=happy*(.17+.035*Math.sin(p*Math.PI*4))+party*(.32+.06*cycle)-sad*.12-angry*(.18+.025*cycle)-sleep*.16+pet*(side<0?.12+.04*Math.sin(p*Math.PI*2):.04)+grab*.24;
  // Side joint and compact fan of motion follow the user's red point and green sector.
  pivotPart(key,a.rootX,a.rootY,side*clamp(lift,-a.maxLower,a.maxLift)*motion);
 }
 drawEars();
 // High-contrast facial landmarks remain at fixed anchors inside the existing charcoal face.
 c.save();c.translate(-5,-157);
 const blink=opts.avatar?0:Math.max(0,1-Math.abs(t%4.7-4.23)/.11),gx=look*clamp(pointer.x,-1,1)*3.2+pet*1.5,gy=look*-2+sad*2;
 const ink='#17171b',light='#f2dcc0';
 function bean(size=5.4,openness=1){
  oval(c,0,0,size,Math.max(.3,(size+.5)*openness),ink);
  if(openness>.35){oval(c,-1.9,-2*openness,1.6,1.45,'#fff6e9');oval(c,2,2.4*openness,.7,.6,'#baa38c');}
 }
 for(const side of [-1,1]){
  c.save();c.translate(side*29+gx,gy);
  const expression=Math.max(happy,party,sad,angry,sleep,grab,pet);
  c.globalAlpha=1-expression;bean(5.4,Math.max(.08,1-blink));
  c.globalAlpha=expression;
  if(party){
   line(c,[[-7,-6],[2,0],[-7,6]].map(([x,y])=>[side<0?x:-x,y]),light,3.3);
  }else if(happy){
   line(c,[[-7,2],[0,-9,7,2]],light,3.2);
  }else if(sad){
   // The sloping closed eye IS the eyelid; no detached eyebrow above it.
   c.scale(-side,1);line(c,[[-7,3],[0,5,7,-3]],light,3.1);
  }else if(angry){
   // A single inward-slanting eye, without a second brow stroke.
   c.scale(-side,1);line(c,[[-7,-3],[7,3]],light,3.7);
  }else if(sleep){
   line(c,[[-7,-1],[0,6,7,-1]],light,3.0);
  }else if(grab){
   bean(7.2,1);oval(c,-2.1,-2.6,1.9,1.8,'#fff6e9');
  }else if(pet){
   if(side<0)line(c,[[-7,1],[0,-7,7,1]],light,3.1);else bean(5.4,.72);
  }
  c.restore();
 }
 // Keep the same tiny sheep nose and closed W mouth in every expression.
 path(c,'M-3 14 Q0 12.8 3 14 L1 17 Q0 18 -1 17Z',light);
 line(c,[[0,17],[0,21]],light,1.7);line(c,[[-6.2,21],[-3,26,0,21],[3,26,6.2,21]],light,1.9);
 if(!opts.noEffects&&sad>.25){c.globalAlpha=sad*.86;for(const side of [-1,1])path(c,`M${side*39} 7Q${side*30} 19 ${side*38} 24Q${side*47} 22 ${side*39} 7Z`,'#8bc9e8','#5a9bbe',.7);c.globalAlpha=1;}
 c.restore();
 if(!opts.noEffects){
  if(pet>.15||happy>.15){const v=Math.max(pet,happy);c.globalAlpha=v*.9;for(const [x,y,z,color]of[[-135,-231,.65,'#eb839a'],[129,-258,.54,'#b799e3']]){c.save();c.translate(x,y-v*8);c.scale(z,z);path(c,'M0 4C-18-5-12-17-5-15Q0-14 0-9Q2-19 10-14C21-7 4 4 0 4Z',color);c.restore();}c.globalAlpha=1;}
  if(angry>.2){c.globalAlpha=angry;line(c,[[112,-239],[112,-246,119,-246]],'#aa7770',2.1);line(c,[[124,-242],[131,-242,131,-235]],'#aa7770',2.1);line(c,[[117,-231],[117,-225,110,-225]],'#aa7770',2.1);c.globalAlpha=1;}
  if(sleep>.2){c.globalAlpha=sleep*.8;const y=-257-Math.sin(t)*3;line(c,[[110,y],[118,y],[110,y+9],[118,y+9]],'#8f9c7c',1.8);line(c,[[127,y-20],[138,y-20],[127,y-8],[138,y-8]],'#8f9c7c',1.8);c.globalAlpha=1;}
 }
 c.restore();
 // Paper leaves the paws, rises in two colorful bursts, then flutters down in scene space.
 if(!opts.noEffects&&mood==='celebrate'){
  const colors=['#ef7d93','#efb945','#67bca4','#6eabdf','#ae8bd6','#ee9863'];
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  for(const [burst,start]of [.16,.43].entries()){
   const age=(p-start)*3.5;if(age<0||age>2.4)continue;
   const strength=smooth(start/.2)*(1-smooth((start-.78)/.22));
   for(let i=0;i<28;i++){
    const side=i%2?1:-1,a=window.SHEEP_ART[side<0?'pawL':'pawR'];
    const lift=strength*(.32+.06*Math.sin(start*Math.PI*6)),angle=side*clamp(lift,-a.maxLower,a.maxLift)*motion;
    const joint=at(a.rootX,a.rootY),tip=at(side<0?385:885,815),dx=tip[0]-joint[0],dy=tip[1]-joint[1];
    const ox=226+px+joint[0]+dx*Math.cos(angle)-dy*Math.sin(angle),oy=355+py+joint[1]+dx*Math.sin(angle)+dy*Math.cos(angle);
    const seed=((i*37+burst*19)%101)/100,vx=side*(30+seed*77)*motion,vy=-(110+((i*23)%79))*motion;
    const x=ox+vx*age+Math.sin(age*5+i)*age*7*motion,y=oy+vy*age+102*age*age*motion;
    c.save();c.translate(x,y);c.rotate(i*1.7+age*(side*3+seed*4));c.scale(.35+.65*Math.abs(Math.cos(age*7+i)),1);
    c.globalAlpha=smooth(age/.07)*(1-smooth((age-1.8)/.6))*(1-smooth((p-.82)/.18));
    path(c,i%3?'M-3.2-2L3-2.4L3.2 2L-2.8 2.4Z':'M-2.2-4Q1-2 1.6 0Q-1 2 .3 4L2.8 3Q1 1 3-.8Q1.7-3-.2-4Z',colors[(i+burst*2)%colors.length]);
    c.restore();
   }
  }
 }
};
