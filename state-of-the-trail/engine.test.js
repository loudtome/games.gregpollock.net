import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {borders,validRoute,createGame,encounter,applyOutcome,advance,living,delayLoss,FOOD_MAX,GOOD_START,GOOD,MONEY_START,FOOD_START,TUNING,goodOdds} from './engine.js';
const data=JSON.parse(fs.readFileSync(new URL('./data/bills.json',import.meta.url)));
const route=['FL','AL','MS','LA','TX','NM','AZ','CA','OR'];
test('all 50 states and reciprocal shared borders; no corner-only crossings',()=>{
 assert.equal(Object.keys(borders).length,50);
 for(const [s,ns] of Object.entries(borders))for(const n of ns)assert.ok(borders[n].includes(s),`${s}-${n}`);
 assert.ok(!borders.AZ.includes('CO'));assert.ok(!borders.NM.includes('UT'));
});
test('continuous routes in any direction work; jumps, loops, and islands fail',()=>{
 assert.ok(validRoute(route));assert.ok(validRoute(['FL','GA','TN','KY','IN','IL','IA','MN','SD','ND','MT','ID','WA','OR']));
 assert.ok(validRoute(['GA','TN','KY','IN','IL','IA','MN','SD','ND','MT','ID','WA','OR'])); // any mainland state may start
 assert.ok(validRoute(['ID','WA','OR']));assert.ok(validRoute(['OR'])); // short journeys, and starting on the destination, are legal
 for(const r of [['FL','OR'],['FL','GA','FL','AL','OR'],['FL','AK','OR'],['AL','OR'],['AK','OR'],['GA','TN']])assert.equal(validRoute(r),false); // jumps, loops, islands, and routes that never reach Oregon
});
test('all entries map to valid states and bill URL agrees',()=>{
 assert.equal(data.bills.length,1182);
 for(const b of data.bills){assert.ok(data.names[b.state]);if(new URL(b.url).hostname==='legiscan.com')assert.equal(new URL(b.url).pathname.split('/')[1].toUpperCase(),b.state);assert.ok(b.summary);}
});

test('every encounter has short authored text without immersion-breaking disclaimers',()=>{
 const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
 for(const b of data.bills){
  assert.equal(typeof b.description,'string',b.summary);
  assert.ok(b.description.trim().length>0,b.summary);
  const sentences=[...segmenter.segment(b.description)].filter(s=>s.segment.trim());
  assert.ok(sentences.length>=1&&sentences.length<=4,`${b.summary}: ${sentences.length} sentences`);
  assert.ok(b.description.split(/\s+/).length<=45,`${b.summary}: over 45 words`);
  assert.ok(!/\b(fictional|hypothetical|simulation)\b/i.test(b.description),b.summary);
  assert.ok(['one','all','delay'].includes(b.effect),b.summary);
  assert.equal(b.description.includes('{name}'),b.effect==='one',b.summary);
 }
});
test('encounters follow the bill\'s authored effect and name the injured traveler',()=>{
 for(const b of data.bills.slice(0,200)){
  const g=createGame(route);g.party[0].health=0;
  const e=encounter(g,[{...b,state:'FL'}],()=>0);
  if(b.effect==='delay'){assert.equal(e.mode,'delay');assert.ok(e.food>0);}
  else {assert.equal(e.mode,'harm');assert.equal(e.target,b.effect==='all'?null:1);}
  assert.ok(!e.text.includes('{name}'));
  if(b.effect==='one')assert.ok(e.text.includes('Jamie'),b.summary); // skips the dead traveler
 }
});
test('negative encounters always draw from the current state; empty states are positive',()=>{
 for(const state of Object.keys(borders)){
  const g=createGame(route);g.route=[state];
  for(let i=0;i<20;i++){g.goodChance=GOOD_START;const e=encounter(g,data.bills,()=>0);if(data.bills.some(b=>b.state===state)){assert.equal(e.kind,'bill');assert.equal(e.bill.state,state);}else assert.equal(e.kind,'good');}
 }
});
test('good luck climbs with each setback and resets after a good turn, so bad runs are bounded',()=>{
 const g=createGame(route);let bad=0;
 for(let i=0;i<20;i++){const e=encounter(g,data.bills,()=>0.5);if(e.kind==='bill')bad++;else break;} // a middling roll every time
 assert.ok(bad>=1&&bad<=5,`${bad} setbacks in a row`);
 assert.equal(g.goodChance,GOOD_START); // the good turn reset it
 for(let i=0;i<20;i++)encounter(g,data.bills,()=>0); // worst possible luck still yields a good turn eventually
 assert.ok(g.goodChance<1);
});
test('good encounters vary and don\'t repeat until the pool for that resource is used up',()=>{
 for(const [mode,list] of Object.entries(GOOD)){
  assert.ok(list.length>=8,mode);
  for(const x of list)assert.ok(x.title&&x.text.split(/\s+/).length<=30,x.title);
  const g=createGame(route);const seen=new Set();let i=0; // with no bills, every encounter is good
  const r=mode==='food'?0.1:mode==='money'?0.5:0.9,rand=()=>(i++?Math.random():r); // first roll picks the resource
  for(let n=0;n<list.length;n++){i=0;const e=encounter(g,[],rand);assert.equal(e.mode,mode==='heal'?'heal':mode);seen.add(e.title);}
  assert.equal(seen.size,list.length,mode);
  i=0;assert.ok(encounter(g,[],rand).title); // then the pool starts over
 }
});
test('deaths persist, funds cannot go negative, mitigation works',()=>{
 const g=createGame(route);g.money=650;g.party[0].health=10;
 assert.deepEqual(applyOutcome(g,{damage:20,target:0,cost:50}),['Alex']);
 applyOutcome(g,{heal:100});assert.equal(g.party[0].health,0);
 applyOutcome(g,{damage:20,target:1,cost:50},true);assert.equal(g.party[1].health,100);assert.equal(g.money,600); // paying fully avoids the harm
 assert.throws(()=>applyOutcome(g,{cost:601},true));assert.equal(g.money,600);
 applyOutcome(g,{damage:200,target:null});assert.equal(g.status,'lost');assert.equal(living(g).length,0);
});
test('food is a bounded shared supply; injuries double when it runs out',()=>{
 const g=createGame(route);assert.equal(g.food,FOOD_START);g.food=100;g.money=650;
 applyOutcome(g,{food:30});assert.equal(g.food,70); // a delay drains rations
 applyOutcome(g,{food:40,cost:50},true);assert.equal(g.food,70);assert.equal(g.money,600); // paying fully avoids the loss
 applyOutcome(g,{foodGain:200});assert.equal(g.food,FOOD_MAX); // gains cap at the max
 applyOutcome(g,{food:FOOD_MAX});assert.equal(g.food,0); // drains to empty, never negative
 g.party[0].health=100;applyOutcome(g,{damage:20,target:0});assert.equal(g.party[0].health,60); // starving: 20 damage lands as 40
 applyOutcome(g,{foodGain:50});g.party[1].health=100;applyOutcome(g,{damage:20,target:1});assert.equal(g.party[1].health,80); // fed: 20 damage lands as 20
});
test('a delay the rations cannot cover falls to money, then to everyone\'s health',()=>{
 const delay={food:20,cost:100}; // $5 per ration
 let g=createGame(route);g.food=50;g.money=650;
 assert.deepEqual(delayLoss(g,delay),{food:20,money:0,damage:0}); // enough rations: no fallback
 g.food=8;applyOutcome(g,delay);assert.equal(g.food,0);assert.equal(g.money,590); // 12 short, bought at $5 each
 for(const p of g.party)assert.equal(p.health,100);
 g=createGame(route);g.food=0;g.money=30;g.party[0].health=0;
 assert.deepEqual(delayLoss(g,delay),{food:0,money:30,damage:14}); // $30 covers 6; the other 14 cost health
 applyOutcome(g,delay);assert.equal(g.money,0);
 assert.equal(g.party[0].health,0);for(const p of g.party.slice(1))assert.equal(p.health,86); // not doubled by starving
 g.food=0;g.money=0;applyOutcome(g,delay);for(const p of g.party.slice(1))assert.equal(p.health,66); // nothing left: all of it costs health
 g.food=0;g.money=0;applyOutcome(g,delay,false);assert.ok(g.party.every(p=>p.health<100));
});
test('Oregon has its full encounter segment before victory',()=>{
 const g=createGame(route);for(let i=0;i<route.length*4-1;i++)advance(g);
 assert.equal(g.route[g.index],'OR');assert.equal(g.status,'travel');advance(g);assert.equal(g.status,'won');
});
test('rubber band: a party ahead of the target draws worse odds than one behind it',()=>{
 const ahead=createGame(route),behind=createGame(route);
 behind.index=ahead.index=4;for(const p of behind.party)p.health=30;behind.food=0;behind.money=0;
 assert.ok(goodOdds(behind)>goodOdds(ahead)+0.3,`${goodOdds(behind)} vs ${goodOdds(ahead)}`);
 assert.ok(goodOdds(ahead)>=TUNING.floor);
});
test('simulated trips are close calls: usually won, usually costly',()=>{
 let wins=0,deaths=0,close=0;const N=200;
 for(let seed=1;seed<=N;seed++){
  let x=seed;const random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
  const g=createGame(route);let low=500;
  for(let i=0;g.status==='travel'&&i<200;i++){
   const e=encounter(g,data.bills,random);applyOutcome(g,e,e.kind==='bill'&&g.money>=e.cost);advance(g);
   assert.ok(g.money>=0);assert.ok(g.food>=0&&g.food<=FOOD_MAX);for(const p of g.party)assert.ok(p.health>=0&&p.health<=100);
   low=Math.min(low,living(g).reduce((a,p)=>a+p.health,0));
  }
  assert.ok(['won','lost'].includes(g.status));if(g.status==='won')wins++;deaths+=g.party.filter(p=>!p.health).length;if(low<250)close++;
 }
 console.log(`${N} seeded trips: ${wins} reached Oregon, ${(deaths/N).toFixed(2)} deaths per trip, ${close} fell below half health`);
 assert.ok(wins/N>=0.9,'most trips should reach Oregon');
 assert.ok(deaths/N>=0.5&&deaths/N<=2,'a typical trip costs a traveler or so');
 assert.ok(close/N>=0.8,'nearly every trip should get close');
});
