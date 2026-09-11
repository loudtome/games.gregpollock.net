import {borders,validRoute,createGame,living,encounter,applyOutcome,advance} from './engine.js';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,topology,route=['FL'],game=null,timer=null,paused=false,pending=null;
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
}
function select(code){
 if(route.includes(code)){route=route.slice(0,route.indexOf(code)+1);renderRoute();return;}
 if(route.at(-1)==='OR'){$('hint').textContent='Your route reaches Oregon. Hit the road or undo a stop to change it.';return;}
 if(!borders[route.at(-1)].includes(code)){$('hint').textContent=`${data.names[code]} does not share a border with ${data.names[route.at(-1)]}. Select an outlined neighbor.`;return;}
 route.push(code);renderRoute();
}
function renderRoute(){
 const max=Math.max(...Object.values(counts));
 for(const code of Object.keys(paths)){
  const selected=route.includes(code),available=route.at(-1)!=='OR'&&borders[route.at(-1)].includes(code)&&!selected;
  const t=Math.sqrt(count(code)/max),start=[243,226,205],end=[113,40,39];
  paths[code].setAttribute('fill',selected?'#3d5844':`rgb(${start.map((n,i)=>Math.round(n+(end[i]-n)*t)).join(',')})`);
  paths[code].setAttribute('class',`state ${selected?'selected':''} ${available?'available':''}`);
  paths[code].setAttribute('aria-pressed',String(selected));labels[code].setAttribute('class',`state-label ${selected?'chosen':''}`);
 }
 $('route-overlay').replaceChildren();
 svg('polyline',{points:route.map(s=>centers[s].join(',')).join(' '),class:'route-line'},$('route-overlay'));
 for(const code of route)svg('circle',{cx:centers[code][0],cy:centers[code][1],r:4,class:'route-point'},$('route-overlay'));
 $('route-list').innerHTML=route.map((s,i)=>`<div class="stop"><span class="number">${String(i+1).padStart(2,'0')}</span><button data-stop="${s}">${esc(data.names[s])}${s==='FL'?' · start':s==='OR'?' · finish':''}</button><small>${count(s)} bills</small></div>`).join('')+(route.at(-1)!=='OR'?'<div class="stop destination"><span class="number">↟</span> Oregon · destination</div>':'');
 $('route-list').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.stop));
 $('route-stats').innerHTML=`<span>${route.length} states · ${route.length*4} days</span><span>${route.reduce((a,s)=>a+count(s),0)} proposals</span>`;
 $('depart').disabled=!validRoute(route);$('undo').disabled=route.length===1;$('clear').disabled=route.length===1;
 $('hint').textContent=validRoute(route)?'A continuous route to Oregon. Your party is ready.':`Next from ${data.names[route.at(-1)]}: ${borders[route.at(-1)].filter(s=>!route.includes(s)).map(s=>data.names[s]).join(', ')||'No unvisited neighbors. Undo to find another way'}.`;
}
function showEvent(){
 pending=encounter(game,data.bills);clearTimeout(timer);document.body.classList.add('paused');
 const e=pending;
 if(e.kind==='bill'){
  const b=e.bill,who=e.target===null?'Every surviving traveler':game.party[e.target].name;
  const story=b.description;
  $('event-content').innerHTML=`<div class="eyebrow">DAY ${game.day} / ${esc(data.names[b.state])} / SETBACK</div><h2>${esc(b.summary)}</h2><p class="event-meta">${esc(b.bill)} · ${esc(b.chamber)} · ${esc(b.category)}<br>Sponsor: ${esc(b.sponsor||'Not listed')}</p><p class="encounter-description">${esc(story)}</p><p><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">Read the proposal: ${esc(b.bill)} ↗</a></p><div class="impact">${who}: <strong>−${e.damage} health</strong><br>Spend $${e.cost} on support to reduce the loss to ${Math.ceil(e.damage*.35)}.</div><div class="event-buttons"><button class="primary" id="mitigate" ${game.money<e.cost?'disabled':''}>Pay $${e.cost} · soften the blow${game.money<e.cost?' (not enough money)':''}</button><button class="small" id="accept">Keep the money · take the health loss</button></div>`;
  $('mitigate').onclick=()=>resolve(true);$('accept').onclick=()=>resolve(false);
 }else{
  $('event-content').innerHTML=`<div class="eyebrow">DAY ${game.day} / ${esc(data.names[game.route[game.index]])} / A HELPING HAND</div><h2>${e.title}</h2><p>${e.text}</p><div class="impact">${e.heal?`All surviving travelers recover <strong>${e.heal} health</strong>.`:`Your travel fund gains <strong>$${e.gain}</strong>.`}</div><button class="primary" id="accept">Onward <span>→</span></button>`;$('accept').onclick=()=>resolve(false);
 }
 $('event').showModal();
}
function log(text){const n=document.createElement('div');n.className='log-entry';n.innerHTML=`<span>DAY ${game.day} · ${game.route[game.index]}</span>${text}`;$('log').prepend(n);}
function resolve(pay){
 if(!pending)return;
 const e=pending,deaths=applyOutcome(game,e,pay);pending=null;$('event').close();
 if(e.kind==='bill')log(`<a href="${esc(e.bill.url)}" target="_blank" rel="noopener noreferrer">${esc(e.bill.bill)}: ${esc(e.bill.summary)}</a> — ${e.target===null?'All survivors':esc(game.party[e.target].name)} lost ${pay?Math.ceil(e.damage*.35):e.damage} health.${pay?` Spent $${e.cost}.`:''}`);
 else log(`${e.title}. ${e.heal?`Survivors recovered up to ${e.heal} health.`:`Received $${e.gain}.`}`);
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
 const cur=game.route[game.index],max=Math.max(...Object.values(counts)),lo=[243,226,205],hi=[113,40,39];
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
 const c=centers[cur],m=svg('g',{class:'j-marker',transform:`translate(${c[0]},${c[1]})`},ov);
 svg('circle',{r:9,class:'j-marker-halo'},m);svg('circle',{r:5,class:'j-marker-dot'},m);
 $('journey-caption').textContent=`In ${data.names[cur]} · state ${game.index+1} of ${game.route.length} · day ${game.tick+1} of 4 here`;
}
function renderTravel(){
 $('location').textContent=data.names[game.route[game.index]];$('road-sign').textContent=game.route[game.index]==='OR'?'OREGON · ALMOST HOME':data.names[game.route[game.index]].toUpperCase()+' →';
 renderJourney();
 $('day').textContent=Math.min(game.day,game.route.length*4);$('money').textContent='$'+game.money;$('survivors').textContent=living(game).length+' / 5';
 $('progress-bar').style.width=((game.index*4+game.tick)/(game.route.length*4)*100)+'%';
 $('travel-route').innerHTML=game.route.map((s,i)=>i===game.index?`<b>${data.names[s]}</b>`:esc(s)).join(' &nbsp;→&nbsp; ');
 $('party').innerHTML=game.party.map((p,i)=>`<div class="person ${!p.health?'dead':p.health<35?'hurt':''}"><div class="person-top"><span class="portrait">${p.health?['◉','◈','◉','◈','◉'][i]:'✝'}</span><strong>${p.name}</strong></div><small>${p.health?p.health+' / 100 health':'Died on the trail'}</small><div class="health" role="meter" aria-label="${p.name} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.health}"><i style="width:${p.health}%"></i></div></div>`).join('');
}
function schedule(){clearTimeout(timer);document.body.classList.toggle('paused',paused);if(!paused&&game?.status==='travel')timer=setTimeout(showEvent,2300);}
function start(){game=createGame(route);paused=false;$('planner').hidden=true;$('travel').hidden=false;$('ending').hidden=true;$('log').replaceChildren();buildJourneyMap();$('step-label').textContent='02 / THE JOURNEY';$('phase-label').textContent='ONE STATE AT A TIME';$('pause').textContent='Pause';log('Five travelers leave Florida with $650 and a little hope.');renderTravel();schedule();$('travel').scrollIntoView({behavior:'smooth',block:'start'});}
function finish(){clearTimeout(timer);document.body.classList.add('paused');$('pause').disabled=true;$('ending').hidden=false;const won=game.status==='won';if(won)$('progress-bar').style.width='100%';$('step-label').textContent='03 / THE END OF THE ROAD';$('phase-label').textContent=won?'YOU MADE IT WEST':'REMEMBER YOUR TRAVELERS';$('ending').innerHTML=`<div class="eyebrow">${won?'WELCOME TO OREGON':'THE TRAIL ENDS HERE'}</div><h2>${won?'You made it west.':'No one made it home.'}</h2><p>${won?`${living(game).length} of your five travelers reached Oregon after ${game.route.length*4} days.`:`Your last traveler died in ${esc(data.names[game.route[game.index]])} on day ${game.day}.`}<br>$${game.money} remaining · ${game.seen.length} legislation encounters</p><p>${game.party.map(p=>`${p.name}: ${p.health?'survived with '+p.health+' health':'died'}`).join(' · ')}</p><button class="primary" id="again">Chart another course →</button>`;$('again').onclick=()=>{game=null;route=['FL'];$('travel').hidden=true;$('ending').hidden=true;$('planner').hidden=false;$('pause').disabled=false;$('step-label').textContent='01 / CHART YOUR COURSE';$('phase-label').textContent='THE ROAD AHEAD IS YOURS TO CHOOSE';renderRoute();$('planner').scrollIntoView({behavior:'smooth'});};$('ending').scrollIntoView({behavior:'smooth',block:'center'});}
$('undo').onclick=()=>{if(route.length>1)route.pop();renderRoute();};$('clear').onclick=()=>{route=['FL'];renderRoute();};$('depart').onclick=start;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';schedule();};
$('event').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.status==='travel'&&!pending){paused=true;$('pause').textContent='Resume';schedule();}});
try{
 const responses=await Promise.all([fetch('./data/bills.json'),fetch('./data/states-albers-10m.json')]);
 if(responses.some(r=>!r.ok))throw new Error('A game data file could not be loaded.');
 [data,topology]=await Promise.all(responses.map(r=>r.json()));
 for(const b of data.bills)counts[b.state]=(counts[b.state]||0)+1;
 $('max-count').textContent='0–'+Math.max(...Object.values(counts));
 $('data-note').textContent=`${data.bills.length.toLocaleString()} spreadsheet entries · colors show entry counts, not verified legal risk`;
 decodeMap();renderRoute();
}catch(e){$('hint').textContent='Unable to load game data. Serve this folder over HTTP and reload. '+e.message;$('data-note').textContent='Data unavailable';console.error(e);}
