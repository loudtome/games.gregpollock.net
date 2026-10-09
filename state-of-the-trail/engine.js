export const borders = {
 AL:'FL GA MS TN', AK:'', AZ:'CA NM NV UT', AR:'LA MS MO OK TN TX', CA:'AZ NV OR', CO:'KS NE NM OK UT WY', CT:'MA NY RI', DE:'MD NJ PA', FL:'AL GA', GA:'AL FL NC SC TN', HI:'', ID:'MT NV OR UT WA WY', IL:'IA IN KY MO WI', IN:'IL KY MI OH', IA:'IL MN MO NE SD WI', KS:'CO MO NE OK', KY:'IL IN MO OH TN VA WV', LA:'AR MS TX', ME:'NH', MD:'DE PA VA WV', MA:'CT NH NY RI VT', MI:'IN OH WI', MN:'IA ND SD WI', MS:'AL AR LA TN', MO:'AR IA IL KS KY NE OK TN', MT:'ID ND SD WY', NE:'CO IA KS MO SD WY', NV:'AZ CA ID OR UT', NH:'MA ME VT', NJ:'DE NY PA', NM:'AZ CO OK TX', NY:'CT MA NJ PA VT', NC:'GA SC TN VA', ND:'MN MT SD', OH:'IN KY MI PA WV', OK:'AR CO KS MO NM TX', OR:'CA ID NV WA', PA:'DE MD NJ NY OH WV', RI:'CT MA', SC:'GA NC', SD:'IA MN MT ND NE WY', TN:'AL AR GA KY MS MO NC VA', TX:'AR LA NM OK', UT:'AZ CO ID NV WY', VT:'MA NH NY', VA:'KY MD NC TN WV', WA:'ID OR', WV:'KY MD OH PA VA', WI:'IA IL MI MN', WY:'CO ID MT NE SD UT'
};
for (const s in borders) borders[s] = borders[s].split(' ').filter(Boolean);
export const FOOD_START=100, FOOD_MAX=140, FOOD_PER_DAY=3; // shared rations; run out and injuries hit twice as hard
// A route may start from any mainland state (AK/HI have no road connection) and must end in Oregon.
export function validRoute(route) { return route.length>0 && borders[route[0]]?.length>0 && route.at(-1)==='OR' && new Set(route).size===route.length && route.every((s,i)=>!i || borders[route[i-1]]?.includes(s)); }
export function createGame(route) {
 if (!validRoute(route)) throw new Error('Select a continuous route to Oregon.');
 return {route:[...route],index:0,day:1,tick:0,money:650,food:FOOD_START,party:['Alex','Jamie','Morgan','Riley','Sam'].map(name=>({name,health:100})),status:'travel',seen:[],last:null};
}
export const living = g => g.party.filter(p=>p.health>0);
export function applyOutcome(g, event, pay=false) {
 const cost=pay?event.cost:0;
 if(cost>g.money) throw new Error('Insufficient funds');
 g.money=Math.max(0,g.money-cost+(event.gain||0));
 // Food is a shared supply: delays drain it, good turns replenish it. Paying avoids the loss entirely.
 const foodLoss=event.food ? (pay?0:event.food) : 0;
 g.food=Math.max(0,Math.min(FOOD_MAX,g.food-foodLoss+(event.foodGain||0)));
 const starving=g.food<=0; // out of rations: every injury counts double
 const deaths=[];
 for(const [i,p] of g.party.entries()) {
  if(p.health<=0) continue;
  let damage=event.damage && (event.target===null || event.target===i) ? (pay?0:event.damage):0; // paying fully avoids the harm
  if(damage&&starving) damage*=2;
  p.health=Math.max(0,Math.min(100,p.health-damage+(event.heal||0)));
  if(!p.health){deaths.push(p.name);p.deathState=g.route[g.index];p.deathCategory=event.bill?event.bill.category:'the road';}
 }
 if(!living(g).length) g.status='lost';
 g.last={...event,paid:pay,deaths,starving};
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
  // Each bill's authored effect decides the outcome so the story matches the cost:
  // 'delay' costs time and supplies (food), 'all' injures the whole party, 'one' injures one traveler.
  const effect=bill.effect||(random()<0.35?'delay':random()<0.3?'all':'one');
  if(effect==='delay') return {kind:'bill',bill,title:bill.summary,text:bill.description,mode:'delay',food:10+Math.floor(random()*17),cost:55+Math.floor(random()*56)};
  const group=effect==='all', alive=g.party.map((p,i)=>p.health>0?i:-1).filter(i=>i>=0);
  const target=group?null:alive[Math.floor(random()*alive.length)];
  const text=group?bill.description:bill.description.replaceAll('{name}',g.party[target].name);
  return {kind:'bill',bill,title:bill.summary,text,mode:'harm',damage:group?18+Math.floor(random()*18):35+Math.floor(random()*34),target,cost:70+Math.floor(random()*81)};
 }
 const r=random();
 if(r<0.42) return {kind:'good',mode:'food',title:'Full pantry, open door',text:'Roadside growers wave you over and load a crate of food into the van.',foodGain:14+Math.floor(random()*19)};
 if(r<0.72) return {kind:'good',mode:'money',title:'Kindness at the crossroads',text:'Neighbors collect a travel fund for your party. The road feels a little less lonely.',gain:25+Math.floor(random()*46)};
 return {kind:'good',mode:'heal',title:'A little help along the way',text:'A local mutual-aid group shares a hot meal and a place to rest.',heal:8+Math.floor(random()*9)};
}
export function advance(g) {
 if(g.status!=='travel') return;
 g.day++; g.tick++; g.food=Math.max(0,g.food-FOOD_PER_DAY); // the party eats a little every day on the road
 if(g.tick>=4) {g.tick=0;g.index++;if(g.index>=g.route.length){g.index=g.route.length-1;g.status='won';}}
}
