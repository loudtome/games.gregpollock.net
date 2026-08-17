// Invariant test for pair selection against the real shipped data.
// Asserts: no repeated password within a run, every pair inside its round's band
// (or the documented relaxed fallback), over many long runs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRIES = JSON.parse(readFileSync(resolve(__dirname, '../data/passwords.json')));
const META = JSON.parse(readFileSync(resolve(__dirname, '../data/meta.json')));

const randInt = (n) => Math.floor(Math.random() * n);
const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);
const bandForRound = (r) => (r <= 3 ? [3, 12] : r < 10 ? [1.15, 8] : [1.05, 3]);
function orient(a, b) { const lf = Math.random() < 0.5; const left = lf ? a : b, right = lf ? b : a; return { left, right, winnerSide: left.n >= right.n ? 0 : 1 }; }
function pickPair(r, used) {
  const avail = ENTRIES.filter((e) => !used.has(e.p));
  if (avail.length < 2) return null;
  const tryBand = (lo, hi, att) => { for (let i = 0; i < att; i++) { const a = avail[randInt(avail.length)]; const c = avail.filter((e) => e !== a && ratio(a.n, e.n) >= lo && ratio(a.n, e.n) <= hi); if (c.length) return orient(a, c[randInt(c.length)]); } return null; };
  const [lo, hi] = bandForRound(r);
  return tryBand(lo, hi, 60) || tryBand(1.02, 20, 200) || orient(avail[0], avail[1]);
}

const RUNS = 3000, ROUNDS = 25;
let outOfPrimaryBand = 0, outOfRelaxed = 0, repeats = 0, curatedUsed = 0, total = 0;
for (let run = 0; run < RUNS; run++) {
  const used = new Set();
  const openers = META.openers.slice().sort(() => Math.random() - 0.5);
  for (let round = 1; round <= ROUNDS; round++) {
    let pair = null;
    if (round <= 2) {
      while (openers.length) {
        const [pa, pb] = openers.shift();
        const ea = ENTRIES.find((e) => e.p === pa), eb = ENTRIES.find((e) => e.p === pb);
        if (ea && eb && !used.has(pa) && !used.has(pb)) { pair = orient(ea, eb); curatedUsed++; break; }
      }
    }
    if (!pair) pair = pickPair(round, used);
    if (!pair) break;
    total++;
    if (used.has(pair.left.p) || used.has(pair.right.p)) repeats++;
    used.add(pair.left.p); used.add(pair.right.p);
    const rr = ratio(pair.left.n, pair.right.n);
    const [lo, hi] = bandForRound(round);
    if (rr < lo || rr > hi) { outOfPrimaryBand++; if (rr < 1.02 || rr > 20) outOfRelaxed++; }
  }
}
console.log(`runs=${RUNS} rounds=${ROUNDS} pairs=${total}`);
console.log(`repeats within run:        ${repeats}   (must be 0)`);
console.log(`pairs outside PRIMARY band:${outOfPrimaryBand}  (${(100*outOfPrimaryBand/total).toFixed(2)}% — allowed only via relaxed fallback)`);
console.log(`pairs outside RELAXED band:${outOfRelaxed}   (should be ~0; only ultimate fallback)`);
console.log(`curated openers used:      ${curatedUsed}`);
console.log(repeats === 0 ? 'PASS: no repeats' : 'FAIL: repeats found');
