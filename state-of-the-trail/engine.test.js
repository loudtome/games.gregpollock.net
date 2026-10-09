import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {borders,validRoute,createGame,encounter,applyOutcome,advance,living,FOOD_MAX} from './engine.js';
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
  for(let i=0;i<20;i++){const e=encounter(g,data.bills,()=>0);if(data.bills.some(b=>b.state===state)){assert.equal(e.kind,'bill');assert.equal(e.bill.state,state);}else assert.equal(e.kind,'good');}
 }
});
test('deaths persist, funds cannot go negative, mitigation works',()=>{
 const g=createGame(route);g.party[0].health=10;
 assert.deepEqual(applyOutcome(g,{damage:20,target:0,cost:50}),['Alex']);
 applyOutcome(g,{heal:100});assert.equal(g.party[0].health,0);
 applyOutcome(g,{damage:20,target:1,cost:50},true);assert.equal(g.party[1].health,100);assert.equal(g.money,600); // paying fully avoids the harm
 assert.throws(()=>applyOutcome(g,{cost:601},true));assert.equal(g.money,600);
 applyOutcome(g,{damage:200,target:null});assert.equal(g.status,'lost');assert.equal(living(g).length,0);
});
test('food is a bounded shared supply; injuries double when it runs out',()=>{
 const g=createGame(route);assert.equal(g.food,100);
 applyOutcome(g,{food:30});assert.equal(g.food,70); // a delay drains rations
 applyOutcome(g,{food:40,cost:50},true);assert.equal(g.food,70);assert.equal(g.money,600); // paying fully avoids the loss
 applyOutcome(g,{foodGain:200});assert.equal(g.food,FOOD_MAX); // gains cap at the max
 applyOutcome(g,{food:1000});assert.equal(g.food,0); // never negative
 g.party[0].health=100;applyOutcome(g,{damage:20,target:0});assert.equal(g.party[0].health,60); // starving: 20 damage lands as 40
 applyOutcome(g,{foodGain:50});g.party[1].health=100;applyOutcome(g,{damage:20,target:1});assert.equal(g.party[1].health,80); // fed: 20 damage lands as 20
});
test('Oregon has its full encounter segment before victory',()=>{
 const g=createGame(route);for(let i=0;i<route.length*4-1;i++)advance(g);
 assert.equal(g.route[g.index],'OR');assert.equal(g.status,'travel');advance(g);assert.equal(g.status,'won');
});
test('simulated complete games terminate with bounded resources and real encounters',()=>{
 let wins=0,losses=0;
 for(let seed=1;seed<=100;seed++){
  let x=seed;const random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
  const g=createGame(route);
  for(let i=0;g.status==='travel'&&i<200;i++){
   const e=encounter(g,data.bills,random);applyOutcome(g,e,e.kind==='bill'&&g.money>=e.cost);advance(g);
   assert.ok(g.money>=0);assert.ok(g.food>=0&&g.food<=FOOD_MAX);for(const p of g.party)assert.ok(p.health>=0&&p.health<=100);
  }
  assert.ok(['won','lost'].includes(g.status));if(g.status==='won')wins++;else losses++;
 }
 assert.ok(wins>0);assert.ok(losses>0);console.log(`100 seeded trips: ${wins} victories, ${losses} losses`);
});
