// The side-scrolling road scene: parallax terrain that changes with the landscape of each state,
// plus roadside signs that drift past at the speed of the nearest layer.
// Each layer is a seamless SVG tile; its width is fixed so a CSS keyframe can pan exactly one tile.
const TILE={far:[1200,130],mid:[900,90],near:[600,110]};
export const NEAR_SPEED=600/6.5; // px per second; must match the .layer.near animation in style.css

export const BIOMES={
 mountains:'WA OR ID MT WY CO UT CA', desert:'AZ NM NV',
 plains:'ND SD NE KS OK TX IA MN WI IL IN OH MI MO',
 woods:'PA NY NJ CT RI MA VT NH ME MD DE VA WV KY TN NC',
 south:'FL GA SC AL MS LA AR'
};
const biomeOf=code=>Object.keys(BIOMES).find(b=>BIOMES[b].split(' ').includes(code))||'plains';

const HOPE=['VOTE YOUR HOPES','RESIST','SÍ SE PUEDE','WE THE PEOPLE','LOVE THY NEIGHBOR','KEEP GOING','YOU ARE NOT ALONE','ORGANIZE'];

// ---- tiny SVG toolkit ----
const url=(w,h,body)=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`)}")`;
const poly=(pts,fill)=>`<polygon fill="${fill}" points="${pts.map(p=>p.join(',')).join(' ')}"/>`;
const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
// A filled skyline from a list of [x,y] points; first and last y must match for the tile to repeat cleanly.
const ridge=(w,h,pts,fill)=>poly([[0,h],...pts,[w,h]],fill);
// Rolling hills built from quadratic curves through alternating crest/valley heights.
function rolling(w,h,ys,fill){
 const step=w/ys.length;let d=`M0,${h} L0,${ys[0]}`;
 ys.forEach((y,i)=>{const next=ys[(i+1)%ys.length];d+=` Q${i*step+step/2},${y-(next-y)/2-8} ${(i+1)*step},${next}`;});
 return `<path fill="${fill}" d="${d} L${w},${h} Z"/>`;
}
function snowcaps(pts,fill){
 let out='';
 for(let i=1;i<pts.length-1;i++){
  const [ax,ay]=pts[i],[lx,ly]=pts[i-1],[rx,ry]=pts[i+1];
  if(ay>32||ly<=ay||ry<=ay)continue;
  const fl=Math.min(1,13/(ly-ay)),fr=Math.min(1,13/(ry-ay));
  const L=[ax+(lx-ax)*fl,ay+(ly-ay)*fl],R=[ax+(rx-ax)*fr,ay+(ry-ay)*fr];
  out+=poly([[ax,ay],L,[(L[0]+ax)/2+2,L[1]-3],[ax,L[1]+1],[(R[0]+ax)/2,R[1]-4],R],fill);
 }
 return out;
}
const pine=(x,base,h,c)=>rect(x-2,base-h*.18,4,h*.18,c)+[0,1,2].map(i=>poly([[x,base-h+i*h*.22],[x-h*(.2+i*.07),base-h*.18-(2-i)*h*.2],[x+h*(.2+i*.07),base-h*.18-(2-i)*h*.2]],c)).join('');
const saguaro=(x,base,h,c)=>rect(x-4,base-h,8,h,c)+rect(x-14,base-h*.62,4,h*.3,c)+rect(x-14,base-h*.36,12,4,c)+rect(x+10,base-h*.75,4,h*.32,c)+rect(x+2,base-h*.47,12,4,c);
const leafy=(x,base,h,c)=>rect(x-3,base-h*.4,6,h*.4,c)+circle(x,base-h*.62,h*.28,c)+circle(x-h*.2,base-h*.5,h*.2,c)+circle(x+h*.2,base-h*.52,h*.22,c);
const palm=(x,base,h,c)=>`<path d="M${x},${base} q4,${-h*.5} 12,${-h}" stroke="${c}" stroke-width="5" fill="none"/>`+
 [[-26,6],[-18,-8],[0,-12],[20,-6],[26,8]].map(([dx,dy])=>`<path d="M${x+12},${base-h} q${dx/2},${dy-6} ${dx},${dy+4}" stroke="${c}" stroke-width="4" fill="none"/>`).join('');
const cypress=(x,base,h,c)=>poly([[x,base-h],[x-7,base-h*.3],[x-4,base],[x+4,base],[x+7,base-h*.3]],c);

// ---- the five landscapes: far / mid / near tiles ----
const C={far:'#3f2d22',mid:'#2b2017',near:'#18120c',snow:'#9a8670'};
const LAND={
 mountains(){
  const [fw,fh]=TILE.far,peaks=[[0,80],[90,34],[150,62],[230,10],[320,70],[400,42],[470,76],[560,18],[650,66],[720,36],[800,82],[880,14],[980,70],[1060,30],[1140,62],[1200,80]];
  const [mw,mh]=TILE.mid,mid=[[0,60],[70,30],[140,55],[230,20],[320,58],[420,34],[500,62],[600,26],[690,56],[780,32],[900,60]];
  const [nw,nh]=TILE.near;
  return {far:url(fw,fh,ridge(fw,fh,peaks,C.far)+snowcaps(peaks,C.snow)),
   mid:url(mw,mh,ridge(mw,mh,mid,C.mid)+[60,95,250,290,330,480,520,640,700,850].map((x,i)=>pine(x,mh-6,26+(i%3)*8,C.mid)).join('')),
   near:url(nw,nh,[[40,90],[120,64],[150,100],[330,80],[370,58],[520,96]].map(([x,h])=>pine(x,nh,h,C.near)).join('')+poly([[230,nh],[238,nh-14],[256,nh-18],[268,nh-6],[272,nh]],C.near))};
 },
 desert(){
  const [fw,fh]=TILE.far,[mw,mh]=TILE.mid,[nw,nh]=TILE.near;
  const mesas=[[0,104],[110,104],[128,52],[300,52],[318,104],[480,104],[494,76],[560,76],[574,104],[700,104],[720,40],[760,40],[772,60],[900,60],[918,104],[1200,104]];
  const buttes=[[0,70],[160,70],[172,36],[214,36],[226,70],[520,70],[530,46],[548,30],[566,46],[576,70],[900,70]];
  return {far:url(fw,fh,ridge(fw,fh,mesas,'#4c3020')+rect(128,60,172,3,'#5e3c27')+rect(720,48,40,3,'#5e3c27')),
   mid:url(mw,mh,ridge(mw,mh,buttes,'#36221a')),
   near:url(nw,nh,saguaro(90,nh,70,C.near)+saguaro(380,nh,52,C.near)+[[200,8],[260,6],[480,9],[560,5]].map(([x,r])=>circle(x,nh-r+3,r,C.near)).join('')+poly([[300,nh],[306,nh-9],[322,nh-12],[330,nh]],C.near))};
 },
 plains(){
  const [fw,fh]=TILE.far,[mw,mh]=TILE.mid,[nw,nh]=TILE.near;
  const elevator=rect(300,64,22,50,C.far)+rect(322,74,16,40,C.far)+rect(338,74,16,40,C.far)+rect(304,56,14,8,C.far);
  const tower=[812,828].map(x=>rect(x,92,3,22,C.far)).join('')+`<ellipse cx="822" cy="86" rx="18" ry="10" fill="${C.far}"/>`+rect(820,72,4,6,C.far);
  const windmill=rect(498,22,4,46,C.mid)+[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>rect(500+dx*10-3,22+dy*10-3,6,6,C.mid)).join('')+rect(482,24,18,4,C.mid)+rect(498,6,4,18,C.mid);
  const fence=[0,60,120,180,240,300,360,420,480,540].map(x=>rect(x+10,nh-26,4,26,C.near)).join('')+rect(0,nh-21,nw,1,C.near)+rect(0,nh-12,nw,1,C.near);
  const pole=rect(296,4,6,nh-4,C.near)+rect(282,10,34,4,C.near)+rect(0,13,nw,1,C.near);
  return {far:url(fw,fh,rect(0,112,fw,18,C.far)+elevator+tower+[120,140,640,660,1000].map(x=>circle(x,110,10,C.far)).join('')),
   mid:url(mw,mh,rolling(mw,mh,[68,60,72,64,70,58],C.mid)+windmill+rect(700,48,30,20,C.mid)+poly([[696,48],[715,34],[734,48]],C.mid)),
   near:url(nw,nh,fence+pole+circle(450,nh-11,11,C.near)+rect(439,nh-11,22,11,C.near))};
 },
 woods(){
  const [fw,fh]=TILE.far,[mw,mh]=TILE.mid,[nw,nh]=TILE.near;
  const canopy=Array.from({length:30},(_,i)=>circle(i*30+15,52+(i*7%3)*6,20+(i*5%3)*3,C.mid)).join('');
  return {far:url(fw,fh,rolling(fw,fh,[70,46,64,38,58,50],'#3a2c26')),
   mid:url(mw,mh,canopy+rect(0,60,mw,mh-60,C.mid)),
   near:url(nw,nh,leafy(80,nh,90,C.near)+leafy(250,nh,64,C.near)+leafy(470,nh,100,C.near)+rect(360,nh-30,4,30,C.near)+rect(352,nh-38,20,10,C.near))};
 },
 south(){
  const [fw,fh]=TILE.far,[mw,mh]=TILE.mid,[nw,nh]=TILE.near;
  const refinery=[[620,30,10],[650,50,8],[700,20,12]].map(([x,y,w])=>rect(x,y,w,fh-y,C.far)).join('')+[[740,18],[790,14]].map(([x,r])=>`<ellipse cx="${x}" cy="${fh-r}" rx="${r*1.6}" ry="${r}" fill="${C.far}"/>`).join('')+rect(600,100,230,30,C.far)
   +[[625,22],[704,12]].map(([x,y])=>circle(x,y,7,'#6d5444')+circle(x+8,y-9,9,'#6d5444')+circle(x+20,y-15,11,'#6d5444')).join('');
  const line=Array.from({length:18},(_,i)=>circle(i*50+25,62+(i%3)*4,18,C.mid)).join('')+rect(0,64,mw,mh-64,C.mid)+[110,330,560,780].map(x=>cypress(x,mh,70,C.mid)).join('');
  return {far:url(fw,fh,rect(0,110,fw,20,C.far)+refinery),
   mid:url(mw,mh,line),
   near:url(nw,nh,palm(70,nh,92,C.near)+palm(330,nh,74,C.near)+[[190,10],[500,12]].map(([x,r])=>[-1,0,1].map(s=>`<path d="M${x},${nh} l${s*r},${-r*1.4}" stroke="${C.near}" stroke-width="4"/>`).join('')).join(''))};
 }
};
const cache={};
const tiles=b=>cache[b]||(cache[b]=LAND[b]());

// ---- runtime ----
let scene,current,last=0,next=6000,moving=0;
export function initScene(el){
 scene=el;
 setInterval(()=>{ // signs appear after 5–10 s of actual driving, never while an encounter has the van stopped
  if(!scene||document.body.classList.contains('paused')||!scene.offsetParent||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  moving+=250;if(moving>=next){moving=0;next=5000+Math.random()*5000;const text=HOPE[Math.floor(Math.random()*HOPE.length)];sign(text,/[^A-Z ]/.test(text)||Math.random()<.5?'board':'hope');} // accented text goes on the hand-painted board: the pixel font has no accented capitals
 },250);
}
export function setScene(code,name){
 if(!scene)return;
 const biome=biomeOf(code);
 if(scene.dataset.biome!==biome){scene.dataset.biome=biome;const t=tiles(biome);for(const k of ['far','mid','near'])scene.querySelector(`.layer.${k}`).style.backgroundImage=t[k];}
 if(code!==current){current=code;moving=Math.min(moving,next-2500);sign(`WELCOME TO ${name.toUpperCase()}`,'welcome');}
}
export function resetScene(){current=null;scene?.querySelectorAll('.sign').forEach(s=>s.remove());}
function sign(text,kind){
 const now=performance.now();if(now-last<1800&&kind!=='welcome')return;last=now;
 const s=document.createElement('div');s.className=`sign ${kind}`;s.innerHTML=`<span></span>`;s.firstChild.textContent=text;
 scene.querySelector('.signs').append(s);
 s.style.animationDuration=((scene.clientWidth+320)/NEAR_SPEED)+'s'; // from left:100% to left:-320px, matching the near layer's speed
 s.addEventListener('animationend',()=>s.remove());
}
