export const borders = {
 AL:'FL GA MS TN', AK:'', AZ:'CA NM NV UT', AR:'LA MS MO OK TN TX', CA:'AZ NV OR', CO:'KS NE NM OK UT WY', CT:'MA NY RI', DE:'MD NJ PA', FL:'AL GA', GA:'AL FL NC SC TN', HI:'', ID:'MT NV OR UT WA WY', IL:'IA IN KY MO WI', IN:'IL KY MI OH', IA:'IL MN MO NE SD WI', KS:'CO MO NE OK', KY:'IL IN MO OH TN VA WV', LA:'AR MS TX', ME:'NH', MD:'DE PA VA WV', MA:'CT NH NY RI VT', MI:'IN OH WI', MN:'IA ND SD WI', MS:'AL AR LA TN', MO:'AR IA IL KS KY NE OK TN', MT:'ID ND SD WY', NE:'CO IA KS MO SD WY', NV:'AZ CA ID OR UT', NH:'MA ME VT', NJ:'DE NY PA', NM:'AZ CO OK TX', NY:'CT MA NJ PA VT', NC:'GA SC TN VA', ND:'MN MT SD', OH:'IN KY MI PA WV', OK:'AR CO KS MO NM TX', OR:'CA ID NV WA', PA:'DE MD NJ NY OH WV', RI:'CT MA', SC:'GA NC', SD:'IA MN MT ND NE WY', TN:'AL AR GA KY MS MO NC VA', TX:'AR LA NM OK', UT:'AZ CO ID NV WY', VT:'MA NH NY', VA:'KY MD NC TN WV', WA:'ID OR', WV:'KY MD OH PA VA', WI:'IA IL MI MN', WY:'CO ID MT NE SD UT'
};
for (const s in borders) borders[s] = borders[s].split(' ').filter(Boolean);
export const FOOD_START=100, FOOD_MAX=140, FOOD_PER_DAY=3; // shared rations; run out and injuries hit twice as hard
// A route may start from any mainland state (AK/HI have no road connection) and must end in Oregon.
export function validRoute(route) { return route.length>0 && borders[route[0]]?.length>0 && route.at(-1)==='OR' && new Set(route).size===route.length && route.every((s,i)=>!i || borders[route[i-1]]?.includes(s)); }
// Good luck is streaky by design: the chance of a good encounter starts low, climbs with every
// setback, and resets once one arrives. Busier states (more bills) climb more slowly.
export const GOOD_START=0.1;
export const goodStep=count=>0.4-0.2*Math.min(1,Math.sqrt(count/108)); // +40 points in quiet states, +20 in the busiest
export function createGame(route) {
 if (!validRoute(route)) throw new Error('Select a continuous route to Oregon.');
 return {route:[...route],index:0,day:1,tick:0,money:650,food:FOOD_START,party:['Alex','Jamie','Morgan','Riley','Sam'].map(name=>({name,health:100})),status:'travel',seen:[],last:null,goodChance:GOOD_START};
}
export const living = g => g.party.filter(p=>p.health>0);
export function applyOutcome(g, event, pay=false) {
 const cost=pay?event.cost:0;
 if(cost>g.money) throw new Error('Insufficient funds');
 g.money=Math.max(0,g.money-cost+(event.gain||0));
 // Food is a shared supply: delays drain it, good turns replenish it. Paying avoids the loss entirely.
 const loss=event.food&&!pay ? delayLoss(g,event) : {food:0,money:0,damage:0};
 g.money-=loss.money;
 g.food=Math.max(0,Math.min(FOOD_MAX,g.food-loss.food+(event.foodGain||0)));
 const starving=g.food<=0; // out of rations: every injury counts double
 const deaths=[];
 for(const [i,p] of g.party.entries()) {
  if(p.health<=0) continue;
  let damage=event.damage && (event.target===null || event.target===i) ? (pay?0:event.damage):0; // paying fully avoids the harm
  if(damage&&starving) damage*=2;
  damage+=loss.damage; // a delay the party can't cover with rations or money comes out of everyone's health
  p.health=Math.max(0,Math.min(100,p.health-damage+(event.heal||0)));
  if(!p.health){deaths.push(p.name);p.deathState=g.route[g.index];p.deathCategory=event.bill?event.bill.category:'the road';}
 }
 if(!living(g).length) g.status='lost';
 g.last={...event,paid:pay,deaths,starving,loss};
 return deaths;
}
// What accepting a delay actually costs. Rations go first; any shortfall is bought at the
// event's own price per ration; whatever money can't cover costs every survivor 1 health per ration.
export function delayLoss(g,event) {
 const food=Math.min(g.food,event.food), short=event.food-food, rate=(event.cost||0)/event.food;
 const money=rate?Math.min(g.money,Math.ceil(short*rate)):0;
 return {food,money,damage:Math.max(0,Math.ceil(short-(rate?money/rate:0)))};
}
export function encounter(g,bills,random=Math.random) {
 const local=bills.filter(b=>b.state===g.route[g.index]);
 const chance=g.goodChance??GOOD_START;
 // States with no bills are always good; otherwise roll against the climbing good chance.
 if(local.length && random()<1-chance) {
  g.goodChance=Math.min(1,chance+goodStep(local.length));
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
 g.goodChance=GOOD_START;
 const r=random(),pick=list=>{ // no repeats until every story for that resource has been told
  const fresh=list.filter(x=>!g.goodSeen?.includes(x.title)),pool=fresh.length?fresh:list,x=pool[Math.floor(random()*pool.length)];
  if(!fresh.length)g.goodSeen=g.goodSeen.filter(t=>!list.some(y=>y.title===t));
  (g.goodSeen||=[]).push(x.title);return x;
 };
 if(r<0.42) return {kind:'good',mode:'food',...pick(GOOD.food),foodGain:14+Math.floor(random()*19)};
 if(r<0.72) return {kind:'good',mode:'money',...pick(GOOD.money),gain:25+Math.floor(random()*46)};
 return {kind:'good',mode:'heal',...pick(GOOD.heal),heal:8+Math.floor(random()*9)};
}
// Mutual aid along the way, by the resource it restores.
const good=pairs=>pairs.map(([title,text])=>({title,text}));
export const GOOD={
 food:good([
  ['Full pantry, open door','Roadside growers wave you over and load a crate of food into the van.'],
  ['Take what you need','A painted fridge outside a laundromat says TAKE WHAT YOU NEED. The party takes what it needs.'],
  ['Church basement potluck','The potluck has more casseroles than people. The party leaves with three foil pans.'],
  ['No questions asked','The food bank volunteers don\'t ask for ID or a reason. They ask how many people, and pack for five.'],
  ['End of the harvest shift','Farmworkers coming off a shift hand over a box of seconds: bruised peaches, split tomatoes, plenty.'],
  ['Tamales for the road','A family selling tamales from a cooler won\'t take money from travelers. Two dozen, still warm.'],
  ['The garden overflows','A community gardener fills a grocery bag with squash and tells the party to come back next year.'],
  ['Thursday at the union hall','The union hall\'s Thursday dinner is open to anyone. The party eats, and leaves with leftovers.'],
  ['Little free pantry','A wooden box at the end of a driveway holds canned beans and peanut butter. The note says: for whoever needs it.'],
  ['Open iftar','The mosque\'s evening meal is open to travelers. The party is fed, and then fed again.']
 ]),
 money:good([
  ['Kindness at the crossroads','Neighbors collect a travel fund for your party. The road feels a little less lonely.'],
  ['Mutual aid network','A local mutual aid network covers the party\'s gas. The only paperwork is a thumbs-up emoji.'],
  ['Pass the hat','The band at the diner passes the hat for the travelers and hands it over full.'],
  ['The tip jar','The bartender empties the night\'s tip jar into the party\'s hands. Somebody did it for her once.'],
  ['Paid at the pump','A stranger at the next pump pays for the fill-up and drives off before anyone can say thanks.'],
  ['Strike fund','Retired teachers running a strike fund decide the party counts. They write a check.'],
  ['An honest day\'s pay','A farmer pays the party cash for an afternoon of fence repair, and rounds up.'],
  ['Garage sale','A block-wide garage sale gives the day\'s take to travelers passing through.']
 ]),
 heal:good([
  ['A little help along the way','A local mutual-aid group shares a hot meal and a place to rest.'],
  ['Clinic in a van','A volunteer nurse runs a free clinic out of a church van. Everyone is checked, bandaged and sent off with ibuprofen.'],
  ['Spare rooms','A family with spare bedrooms takes the party in for a night of real beds and hot showers.'],
  ['Street medics','Street medics with supplies to spare clean every scrape and restock the first aid kit.'],
  ['Shared fire','The next campsite over shares a fire, a pot of soup and a long night\'s sleep.'],
  ['At cost','An independent pharmacist fills the party\'s prescriptions at cost and covers the rest.'],
  ['A day off the road','A retired couple lets the party park in their yard. Nobody drives anywhere for a whole day.'],
  ['The bunk room','The volunteer fire department lets the party sleep in the station bunk room and makes them breakfast.']
 ])
};
export function advance(g) {
 if(g.status!=='travel') return;
 g.day++; g.tick++; g.food=Math.max(0,g.food-FOOD_PER_DAY); // the party eats a little every day on the road
 if(g.tick>=4) {g.tick=0;g.index++;if(g.index>=g.route.length){g.index=g.route.length-1;g.status='won';}}
}
