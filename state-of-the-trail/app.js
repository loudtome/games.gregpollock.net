import {borders,validRoute,createGame,living,encounter,applyOutcome,advance} from './engine.js';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Deterministic color per issue category, so the same category always shows the same label color.
const catColor=cat=>{let h=0;for(const c of String(cat))h=(h*31+c.charCodeAt(0))>>>0;return `hsl(${h%360} 48% 34%)`;};
// Small inline stat icons (inherit currentColor).
const ICON={
 health:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3.5 15.4 3.5 9.6C3.5 6.9 5.6 5 8 5c1.7 0 3.1.9 4 2.3C12.9 5.9 14.3 5 16 5c2.4 0 4.5 1.9 4.5 4.6C20.5 15.4 12 21 12 21z"/></svg>',
 money:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2.2"/><circle cx="12" cy="12" r="3.1" fill="#fff"/><circle cx="5.6" cy="12" r="1.1" fill="#fff"/><circle cx="18.4" cy="12" r="1.1" fill="#fff"/></svg>',
 food:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.3C10.4 7 7.8 7 6.3 8.6 4.8 10.2 4.9 13 6.4 16c1 2 2.1 3.6 3.2 3.6.8 0 1.3-.35 2.4-.35s1.6.35 2.4.35c1.1 0 2.2-1.6 3.2-3.6 1.5-3 1.6-5.8.1-7.4C18.2 7 15.6 7 14 8.3z"/><path d="M12.3 8C12.2 5.8 13.4 4.2 15.6 3.7c.2 2.1-.9 3.9-3.3 4.3z"/></svg>'};
const statChip=(icon,label,delta,unit)=>{const up=delta>0;return `<span class="stat-chip ${up?'good':'bad'}"><span class="ic">${ICON[icon]}</span>${label?`<span class="sc-label">${esc(label)}</span>`:''}<span class="arrow">${up?'▲':'▼'}</span><b>${up?'+':'−'}${Math.abs(delta)}${unit?`<span class="unit">${unit}</span>`:''}</b></span>`;};
// Newspaper helpers for the encounter modal.
const PAPERS=['Sentinel','Gazette','Tribune','Herald','Dispatch','Chronicle','Register','Courier','Bulletin','Ledger'];
const paperName=state=>{let h=0;for(const c of String(state))h=(h*31+c.charCodeAt(0))>>>0;return `The ${data.names[state]||state} ${PAPERS[h%PAPERS.length]}`;};
const prettyBill=id=>String(id).replace(/^([A-Za-z]+)[\s.]*0*(\d.*)$/,(_,a,n)=>`${a.toUpperCase()} ${n}`);
function legName(b){ // a readable bill name, derived from the LegiScan URL where possible
 try{const u=new URL(b.url);
  if(u.hostname.endsWith('legiscan.com')){const p=u.pathname.split('/').filter(Boolean),st=p[0],id=p.find(s=>/^[A-Za-z]{1,4}\d/.test(s));
   if(st&&id&&data.names[st])return `${data.names[st]} ${prettyBill(id)}`;}
 }catch{}
 const nm=data.names[b.state]||b.state;
 return b.bill&&b.bill!=='Proposal'?`${nm} ${prettyBill(b.bill)}`:`${nm} proposal`;
}
// Category icon slot: drop an SVG at icons/<slug>.svg and it appears automatically; missing files remove themselves.
const catSlug=cat=>String(cat).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const categoryIcon=cat=>`<img class="cat-icon" src="icons/${catSlug(cat)}.svg" alt="" onerror="this.remove()">`;
let data,topology,route=[],game=null,timer=null,paused=false,pending=null;
const counts={},centers={},paths={},labels={};let journeyPaths={};
const count=s=>counts[s]||0;
function svg(tag,attrs,parent=$('map')){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
function decodeMap(){
 const {scale,translate}=topology.transform;
 const arcs=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(p=>{x+=p[0];y+=p[1];return [x*scale[0]+translate[0],y*scale[1]+translate[1]];});});
 const ring=refs=>refs.flatMap((ref,i)=>{let a=ref<0?[...arcs[~ref]].reverse():arcs[ref];return i?a.slice(1):a;});
 const lookup=Object.fromEntries(Object.entries(data.names).map(([a,n])=>[n,a]));
 for(const geo of topology.objects.states.geometries){
  const code=lookup[geo.properties.name];if(!code)continue;
  const polygons=(geo.type==='Polygon'?[geo.arcs]:geo.arcs).map(poly=>poly.map(ring));
  let largest=0,center;
  for(const poly of polygons){let area=0,cx=0,cy=0;const pts=poly[0];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],cross=a[0]*b[1]-b[0]*a[1];area+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;}if(Math.abs(area)>largest){largest=Math.abs(area);center=[cx/(3*area),cy/(3*area)];}}
  centers[code]=center;
  const d=polygons.flatMap(poly=>poly.map(pts=>'M'+pts.map(p=>p.map(n=>n.toFixed(2)).join(',')).join('L')+'Z')).join('');
  paths[code]=svg('path',{d,class:'state',tabindex:'0',role:'button','aria-label':`${data.names[code]}: ${count(code)} proposals`});
  const title=svg('title',{},paths[code]);title.textContent=`${data.names[code]} · ${count(code)} proposals`;
  const show=()=>{$('map-tooltip').textContent=`${data.names[code]} · ${count(code)} proposals${borders[code].length?'':' · No mainland road connection'}`;$('map-tooltip').style.opacity=1;};
  paths[code].addEventListener('mouseenter',show);paths[code].addEventListener('focus',show);
  paths[code].addEventListener('mouseleave',()=>{$('map-tooltip').style.opacity=0;});paths[code].addEventListener('blur',()=>{$('map-tooltip').style.opacity=0;});
  paths[code].addEventListener('click',()=>select(code));paths[code].addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(code);}});
 }
 svg('g',{id:'route-overlay'});
 const offset={RI:[39,10],CT:[33,23],NJ:[35,12],DE:[37,21],MD:[40,35],MA:[37,-8]};
 for(const [code,point] of Object.entries(centers)){
  const delta=offset[code]||[0,0],p=[point[0]+delta[0],point[1]+delta[1]];
  if(offset[code]) svg('line',{x1:point[0],y1:point[1],x2:p[0],y2:p[1],stroke:'#8a8d7a','stroke-width':.7,'pointer-events':'none'});
  labels[code]=svg('text',{x:p[0],y:p[1]+3,'text-anchor':'middle',class:'state-label'});labels[code].textContent=code;
 }
 if(centers.OR)drawFlag($('map'),centers.OR[0],centers.OR[1]); // Oregon is the destination
}
// A little pixel American flag, planted at a state's centroid to mark the destination.
function drawFlag(parent,x,y){
 const g=svg('g',{class:'or-flag',transform:`translate(${x},${y}) scale(2)`},parent);
 svg('rect',{x:0,y:-17,width:1.6,height:23,class:'flag-pole'},g);
 svg('rect',{x:1.6,y:-17,width:18,height:12,class:'flag-field'},g);
 for(let i=0;i<3;i++)svg('rect',{x:1.6,y:-17+i*4,width:18,height:2,class:'flag-stripe'},g);
 svg('rect',{x:1.6,y:-17,width:8,height:6,class:'flag-canton'},g);
 for(const [sx,sy] of [[3.4,-15.4],[6,-15.4],[3.4,-13],[6,-13]])svg('rect',{x:sx,y:sy,width:1,height:1,class:'flag-star'},g);
}
function select(code){
 if(!route.length){ // first pick sets the starting state
  if(!borders[code]?.length){$('hint').textContent=`${data.names[code]} has no mainland road connection — pick a state on the continent.`;return;}
  route=[code];renderRoute();return;
 }
 if(route.includes(code)){route=route.slice(0,route.indexOf(code)+1);renderRoute();return;}
 if(route.at(-1)==='OR'){$('hint').textContent='Your route reaches Oregon. Hit the road or undo a stop to change it.';return;}
 if(!borders[route.at(-1)].includes(code)){$('hint').textContent=`${data.names[code]} does not share a border with ${data.names[route.at(-1)]}. Select an outlined neighbor.`;return;}
 route.push(code);renderRoute();
}
function renderRoute(){
 const max=Math.max(...Object.values(counts)),empty=!route.length;
 for(const code of Object.keys(paths)){
  const selected=route.includes(code),available=empty?borders[code]?.length>0:route.at(-1)!=='OR'&&borders[route.at(-1)].includes(code)&&!selected;
  const t=Math.sqrt(count(code)/max),start=[52,46,28],end=[201,67,37]; // dark khaki -> rust: dangerous states glow red
  paths[code].setAttribute('fill',selected?'#caa233':`rgb(${start.map((n,i)=>Math.round(n+(end[i]-n)*t)).join(',')})`);
  paths[code].setAttribute('class',`state ${selected?'selected':''} ${available?'available':''}`);
  paths[code].setAttribute('aria-pressed',String(selected));labels[code].setAttribute('class',`state-label ${selected?'chosen':''}`);
 }
 $('route-overlay').replaceChildren();
 svg('polyline',{points:route.map(s=>centers[s].join(',')).join(' '),class:'route-line'},$('route-overlay'));
 for(const code of route)svg('circle',{cx:centers[code][0],cy:centers[code][1],r:4,class:'route-point'},$('route-overlay'));
 $('route-list').innerHTML=route.map((s,i)=>`<div class="stop"><span class="number">${String(i+1).padStart(2,'0')}</span><button data-stop="${s}">${esc(data.names[s])}${i===0?' · start':s==='OR'?' · finish':''}</button><small>${count(s)} bills</small></div>`).join('')+(route.at(-1)!=='OR'?'<div class="stop destination"><span class="number">↟</span> Oregon · destination</div>':'');
 $('route-list').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.stop));
 $('route-stats').innerHTML=`<span>${route.length} states · ${route.length*4} days</span><span>${route.reduce((a,s)=>a+count(s),0)} proposals</span>`;
 $('depart').disabled=!validRoute(route);$('undo').disabled=empty;$('clear').disabled=empty;
 $('hint').textContent=empty?'Pick any state on the map to begin your route to Oregon.':validRoute(route)?'A continuous route to Oregon. Your party is ready.':`Next from ${data.names[route.at(-1)]}: ${borders[route.at(-1)].filter(s=>!route.includes(s)).map(s=>data.names[s]).join(', ')||'No unvisited neighbors. Undo to find another way'}.`;
}
function showEvent(){
 pending=encounter(game,data.bills);clearTimeout(timer);document.body.classList.add('paused');
 const e=pending,state=data.names[game.route[game.index]];
 if(e.kind==='bill'){
  const b=e.bill,harm=e.mode==='harm',poor=game.money<e.cost,unit=harm?'health':'rations';
  const dbl=harm&&game.food<=0?2:1; // out of rations doubles the injury, so show the real number
  const full=harm?e.damage*dbl:e.food;
  const chip=harm?statChip('health',e.target===null?'Everyone':game.party[e.target].name,-full):statChip('food','Rations',-full);
  $('event-content').innerHTML=`<div class="news"><div class="news-masthead"><span class="news-name">${esc(paperName(b.state))}</span><span class="news-date">DAY ${game.day} · ${esc(state).toUpperCase()}</span></div><div class="news-eyebrow"><span class="news-cat" style="--c:${catColor(b.category)}">${categoryIcon(b.category)}<span>${esc(b.category)}</span></span><span class="news-passed">${esc(legName(b))} passes!</span></div><h2 class="news-headline">${esc(b.summary)}</h2></div><div class="consequence-block"><div class="cq-label">What it means for your party</div><p class="ev-narrative">${esc(b.description)}</p><div class="ev-consequence">${chip}${dbl>1?'<span class="cq-note">rations empty · damage doubled</span>':''}</div><a class="ev-link" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">Read the proposal ↗</a><div class="event-buttons"><button class="primary" id="mitigate" ${poor?'disabled':''}>${poor?`Pay $${e.cost} — not enough money`:`Pay $${e.cost} and lose no ${unit}`}</button><button class="small" id="accept">Lose ${full} ${unit}</button></div></div>`;
  $('mitigate').onclick=()=>resolve(true);$('accept').onclick=()=>resolve(false);
 }else{
  const chip=e.mode==='food'?statChip('food','Rations',e.foodGain):e.mode==='money'?statChip('money','Travel fund',e.gain):statChip('health','Everyone',e.heal);
  $('event-content').innerHTML=`<div class="news good-news"><div class="news-masthead"><span class="news-name">Good news on the road</span><span class="news-date">DAY ${game.day} · ${esc(state).toUpperCase()}</span></div><h2 class="news-headline">${esc(e.title)}</h2></div><div class="consequence-block"><p class="ev-narrative">${esc(e.text)}</p><div class="ev-consequence">${chip}</div><div class="event-buttons"><button class="primary" id="accept">Onward <span>→</span></button></div></div>`;
  $('accept').onclick=()=>resolve(false);
 }
 $('event').classList.add('open');
}
function log(text){const n=document.createElement('div');n.className='log-entry';n.innerHTML=`<span>DAY ${game.day} · ${game.route[game.index]}</span>${text}`;$('log').prepend(n);}
function resolve(pay){
 if(!pending)return;
 const e=pending,deaths=applyOutcome(game,e,pay),starved=game.last.starving;pending=null;$('event').classList.remove('open');
 if(e.kind==='bill'){
  const link=`<a href="${esc(e.bill.url)}" target="_blank" rel="noopener noreferrer">${esc(e.bill.bill)}: ${esc(e.bill.summary)}</a>`;
  if(e.mode==='harm'){const who=e.target===null?'All survivors':esc(game.party[e.target].name);log(pay?`${link} — Paid $${e.cost} to keep the party safe.`:`${link} — ${who} lost ${e.damage*(starved?2:1)} health${starved?' (rations empty — damage doubled)':''}.`);}
  else log(pay?`${link} — Paid $${e.cost} to avoid the delay.`:`${link} — Delays cost ${e.food} rations.`);
 }else log(`${e.title}. ${e.mode==='food'?`Gained ${e.foodGain} rations.`:e.mode==='money'?`Received $${e.gain}.`:`Survivors recovered up to ${e.heal} health.`}`);
 if(deaths.length)log(`<strong>${deaths.map(esc).join(', ')} ${deaths.length===1?'has':'have'} died on the trail.</strong>`);
 advance(game);renderTravel();
 if(game.status!=='travel')finish();else schedule();
}
function buildJourneyMap(){
 const map=$('journey-map');map.replaceChildren();journeyPaths={};
 for(const code of Object.keys(paths)){
  const d=paths[code].getAttribute('d');if(!d)continue;
  journeyPaths[code]=svg('path',{d,class:'j-state'},map);
 }
 svg('g',{id:'j-overlay'},map);
}
function renderJourney(){
 if(!Object.keys(journeyPaths).length)return;
 const cur=game.route[game.index],max=Math.max(...Object.values(counts)),lo=[52,46,28],hi=[201,67,37];
 const threat=code=>{const t=Math.sqrt(count(code)/max);return`rgb(${lo.map((n,i)=>Math.round(n+(hi[i]-n)*t)).join(',')})`;};
 for(const [code,el] of Object.entries(journeyPaths)){
  const pos=game.route.indexOf(code);
  if(pos<0){el.style.fill='';el.setAttribute('class','j-state');continue;}
  el.style.fill=threat(code); // same bill-count gradient as the planner: darker red = more dangerous
  el.setAttribute('class',`j-state j-route${code===cur?' j-current':pos<game.index?' j-passed':''}`);
 }
 const ov=$('j-overlay');ov.replaceChildren();
 const pts=game.route.map(s=>centers[s]);
 const remaining=pts.slice(game.index);
 if(remaining.length>1)svg('polyline',{points:remaining.map(p=>p.join(',')).join(' '),class:'j-line-remaining'},ov);
 const traveled=pts.slice(0,game.index+1);
 if(traveled.length>1)svg('polyline',{points:traveled.map(p=>p.join(',')).join(' '),class:'j-line-traveled'},ov);
 for(const s of game.route){const c=centers[s];svg('circle',{cx:c[0],cy:c[1],r:s===cur?0:3,class:'j-dot'},ov);}
 // a tombstone in every state where a traveler died
 const graves={};for(const p of game.party)if(p.health<=0&&p.deathState&&centers[p.deathState])graves[p.deathState]=(graves[p.deathState]||0)+1;
 for(const [st,n] of Object.entries(graves)){
  const gc=centers[st],g=svg('g',{class:'grave',transform:`translate(${gc[0]+11},${gc[1]-2})`},ov);
  svg('path',{d:'M-6 6 L-6 -2 C-6 -8 6 -8 6 -2 L6 6 Z',class:'grave-stone'},g);
  svg('rect',{x:-1.2,y:-5,width:2.4,height:8,class:'grave-cross'},g);svg('rect',{x:-4,y:-3,width:8,height:2.4,class:'grave-cross'},g);
  if(n>1){const t=svg('text',{x:0,y:16,'text-anchor':'middle',class:'grave-count'},g);t.textContent='x'+n;}
 }
 if(centers.OR)drawFlag(ov,centers.OR[0],centers.OR[1]); // destination marker
 const c=centers[cur],m=svg('g',{class:'j-marker',transform:`translate(${c[0]},${c[1]})`},ov);
 svg('circle',{r:9,class:'j-marker-halo'},m);svg('circle',{r:5,class:'j-marker-dot'},m);
 $('journey-caption').textContent=`In ${data.names[cur]} · state ${game.index+1} of ${game.route.length} · day ${game.tick+1} of 4 here`;
}
function renderTravel(){
 $('location').textContent=data.names[game.route[game.index]];$('road-sign').textContent=game.route[game.index]==='OR'?'OREGON · ALMOST HOME':data.names[game.route[game.index]].toUpperCase()+' →';
 renderJourney();
 $('day').textContent=Math.min(game.day,game.route.length*4);$('money').textContent='$'+game.money;$('survivors').textContent=living(game).length+' / 5';
 $('food').textContent=game.food;$('food').parentElement.classList.toggle('starving',game.food<=0);
 $('progress-bar').style.width=((game.index*4+game.tick)/(game.route.length*4)*100)+'%';
 $('travel-route').innerHTML=game.route.map((s,i)=>i===game.index?`<b>${data.names[s]}</b>`:esc(s)).join(' &nbsp;→&nbsp; ');
 $('party').innerHTML=game.party.map((p,i)=>{
  const dead=!p.health;
  const info=dead?`<small class="death-cause">Died from ${esc(p.deathCategory||'the road')}</small>`
   :`<small>${p.health} / 100 health</small><div class="health" role="meter" aria-label="${esc(p.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.health}"><i style="width:${p.health}%"></i></div>`;
  return `<div class="person ${dead?'dead':p.health<35?'hurt':''}"><div class="person-top"><span class="portrait">${dead?'✝':['◉','◈','◉','◈','◉'][i]}</span><strong>${esc(p.name)}</strong></div>${info}</div>`;
 }).join('');
}
function schedule(){clearTimeout(timer);document.body.classList.toggle('paused',paused);if(!paused&&game?.status==='travel')timer=setTimeout(showEvent,2300);}
function start(){game=createGame(route);paused=false;$('planner').hidden=true;$('travel').hidden=false;$('ending').hidden=true;$('log').replaceChildren();buildJourneyMap();$('step-label').textContent='02 / THE JOURNEY';$('phase-label').textContent='ONE STATE AT A TIME';$('pause').textContent='Pause';log(`Five travelers set out from ${esc(data.names[route[0]])} with $650 and 100 rations.`);renderTravel();schedule();$('travel').scrollIntoView({behavior:'smooth',block:'start'});}
function finish(){clearTimeout(timer);document.body.classList.add('paused');$('pause').disabled=true;$('ending').hidden=false;const won=game.status==='won';if(won)$('progress-bar').style.width='100%';$('step-label').textContent='03 / THE END OF THE ROAD';$('phase-label').textContent=won?'YOU MADE IT WEST':'REMEMBER YOUR TRAVELERS';$('ending').innerHTML=`<div class="eyebrow">${won?'WELCOME TO OREGON':'THE TRAIL ENDS HERE'}</div><h2>${won?'You made it west.':'No one made it home.'}</h2><p>${won?`${living(game).length} of your five travelers reached Oregon after ${game.route.length*4} days.`:`Your last traveler died in ${esc(data.names[game.route[game.index]])} on day ${game.day}.`}<br>$${game.money} remaining · ${game.food} rations · ${game.seen.length} legislation encounters</p><p>${game.party.map(p=>`${p.name}: ${p.health?'survived with '+p.health+' health':'died'}`).join(' · ')}</p><button class="primary" id="again">Chart another course →</button>`;$('again').onclick=()=>{game=null;route=[];$('travel').hidden=true;$('ending').hidden=true;$('planner').hidden=false;$('pause').disabled=false;$('step-label').textContent='01 / CHART YOUR COURSE';$('phase-label').textContent='THE ROAD AHEAD IS YOURS TO CHOOSE';renderRoute();$('planner').scrollIntoView({behavior:'smooth'});};$('ending').scrollIntoView({behavior:'smooth',block:'center'});}
$('undo').onclick=()=>{if(route.length)route.pop();renderRoute();};$('clear').onclick=()=>{route=[];renderRoute();};$('depart').onclick=start;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';schedule();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.status==='travel'&&!pending){paused=true;$('pause').textContent='Resume';schedule();}});
try{
 const responses=await Promise.all([fetch('./data/bills.json'),fetch('./data/states-albers-10m.json')]);
 if(responses.some(r=>!r.ok))throw new Error('A game data file could not be loaded.');
 [data,topology]=await Promise.all(responses.map(r=>r.json()));
 for(const b of data.bills)counts[b.state]=(counts[b.state]||0)+1;
 $('data-note').textContent=`${data.bills.length.toLocaleString()} spreadsheet entries · colors show entry counts, not verified legal risk`;
 decodeMap();renderRoute();
}catch(e){$('hint').textContent='Unable to load game data. Serve this folder over HTTP and reload. '+e.message;$('data-note').textContent='Data unavailable';console.error(e);}
