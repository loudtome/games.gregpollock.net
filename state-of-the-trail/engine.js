export const borders = {
 AL:'FL GA MS TN', AK:'', AZ:'CA NM NV UT', AR:'LA MS MO OK TN TX', CA:'AZ NV OR', CO:'KS NE NM OK UT WY', CT:'MA NY RI', DE:'MD NJ PA', FL:'AL GA', GA:'AL FL NC SC TN', HI:'', ID:'MT NV OR UT WA WY', IL:'IA IN KY MO WI', IN:'IL KY MI OH', IA:'IL MN MO NE SD WI', KS:'CO MO NE OK', KY:'IL IN MO OH TN VA WV', LA:'AR MS TX', ME:'NH', MD:'DE PA VA WV', MA:'CT NH NY RI VT', MI:'IN OH WI', MN:'IA ND SD WI', MS:'AL AR LA TN', MO:'AR IA IL KS KY NE OK TN', MT:'ID ND SD WY', NE:'CO IA KS MO SD WY', NV:'AZ CA ID OR UT', NH:'MA ME VT', NJ:'DE NY PA', NM:'AZ CO OK TX', NY:'CT MA NJ PA VT', NC:'GA SC TN VA', ND:'MN MT SD', OH:'IN KY MI PA WV', OK:'AR CO KS MO NM TX', OR:'CA ID NV WA', PA:'DE MD NJ NY OH WV', RI:'CT MA', SC:'GA NC', SD:'IA MN MT ND NE WY', TN:'AL AR GA KY MS MO NC VA', TX:'AR LA NM OK', UT:'AZ CO ID NV WY', VT:'MA NH NY', VA:'KY MD NC TN WV', WA:'ID OR', WV:'KY MD OH PA VA', WI:'IA IL MI MN', WY:'CO ID MT NE SD UT'
};
for (const s in borders) borders[s] = borders[s].split(' ').filter(Boolean);
export function validRoute(route) { return route[0]==='FL' && route.at(-1)==='OR' && new Set(route).size===route.length && route.every((s,i)=>!i || borders[route[i-1]]?.includes(s)); }
export function createGame(route) {
 if (!validRoute(route)) throw new Error('Select a continuous route from Florida to Oregon.');
 return {route:[...route],index:0,day:1,tick:0,money:650,party:['Alex','Jamie','Morgan','Riley','Sam'].map(name=>({name,health:100})),status:'travel',seen:[],last:null};
}
export const living = g => g.party.filter(p=>p.health>0);
export function applyOutcome(g, event, pay=false) {
 const cost=pay?event.cost:0;
 if(cost>g.money) throw new Error('Insufficient funds');
 g.money=Math.max(0,g.money-cost+(event.gain||0));
 const deaths=[];
 for(const [i,p] of g.party.entries()) {
  if(p.health<=0) continue;
  const damage=event.damage && (event.target===null || event.target===i) ? (pay?Math.ceil(event.damage*0.35):event.damage):0;
  p.health=Math.max(0,Math.min(100,p.health-damage+(event.heal||0)));
  if(!p.health) deaths.push(p.name);
 }
 if(!living(g).length) g.status='lost';
 g.last={...event,paid:pay,deaths};
 return deaths;
}
export function encounter(g,bills,random=Math.random) {
 const local=bills.filter(b=>b.state===g.route[g.index]);
 // Good events are wasted while the party is still healthy, so front-load the danger:
 // drive the negative-encounter rate toward certainty for the first few states, then relax to normal.
 const early=Math.max(0,1-g.index/3); // 1 at the start, tapering to 0 by the fourth state
 let risk=local.length ? 0.43+0.4*Math.sqrt(local.length/108) : 0;
 if(local.length) risk+=(1-risk)*0.85*early;
 if(random()<risk) {
  const unseen=local.filter(b=>!g.seen.includes(b.url));
  const pool=unseen.length?unseen:local, bill=pool[Math.floor(random()*pool.length)];
  g.seen.push(bill.url);
  const group=random()<0.3, alive=g.party.map((p,i)=>p.health>0?i:-1).filter(i=>i>=0);
  return {kind:'bill',bill,title:bill.summary,damage:group?14+Math.floor(random()*15):28+Math.floor(random()*27),target:group?null:alive[Math.floor(random()*alive.length)],cost:45+Math.floor(random()*65)};
 }
 return random()<0.55?{kind:'good',title:'A little help along the way',text:'A local mutual-aid group shares a hot meal and a place to rest.',heal:8+Math.floor(random()*9)}:{kind:'good',title:'Kindness at the crossroads',text:'Neighbors collect a travel fund for your party. The road feels a little less lonely.',gain:25+Math.floor(random()*46)};
}
export function advance(g) {
 if(g.status!=='travel') return;
 g.day++; g.tick++;
 if(g.tick>=4) {g.tick=0;g.index++;if(g.index>=g.route.length){g.index=g.route.length-1;g.status='won';}}
}
