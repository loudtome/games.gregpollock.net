#!/usr/bin/env node
// Prep script for the Password Showdown game.
//
// Normalizes a breach wordlist into ../data/passwords.json (+ meta.json), applying
// a blocklist, name/email filters, and a minimum-count threshold, then bakes in the
// one reveal fact that can't be cheaply computed in the browser: the offline crack
// time via zxcvbn. Rank and character-class shape are derived client-side.
//
// Re-runnable against a fresh wordlist with no code changes:
//   node build-data.mjs [path/to/wordlist]   (default: ../rockyou.txt)
//
// Input formats handled (detected once from a sample of the head, then applied
// consistently — passwords themselves contain ':' , ',' and digits, so per-line
// guessing would misread a plain wordlist):
//   password:20958297      pw:count
//   123456 20958297        pw count
//   20958297,password      count,pw
//   20958297 password      count pw
//   password               rank-only (no counts)
//
// rockyou.txt is the rank-only case: one password per line, ordered by frequency.
// When there are no counts we synthesize a strictly-decreasing occurrence count from
// each line's frequency rank using a power-law model anchored to the widely published
// rockyou-withcount head. Direction (which password is more common) therefore always
// follows the real frequency ordering of the source file.

import { createRequire } from 'node:module';
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const zxcvbn = require('zxcvbn');

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(__dirname, process.argv[2] || '../rockyou.txt');
const DATA_DIR = resolve(__dirname, '../data');
const REMOVED_LOG = resolve(__dirname, 'removed.log');

const TOP_CAP = 2900;      // keep at most this many entries (sized to keep JSON < ~150 KB)
const MIN_COUNT = 1000;    // drop anything below this occurrence count
const SCAN_LIMIT = 20000;  // for rank-only input, only the densest head matters

// --- offensive-term blocklist (hard requirement) -------------------------------------
// We err toward over-filtering per the spec, but must NOT nuke benign centerpiece
// passwords (e.g. "password" contains "ass"). Two tiers:
//
// STRONG: matched as a substring anywhere. These stems essentially never occur inside
// common benign words, so substring matching is safe and maximally aggressive.
const BLOCK_STRONG = [
  'nigg', 'nigor', 'chink', 'kike', 'wetback', 'gook', 'beaner', 'tranny', 'faggot',
  'fagg', 'fggt', 'nazi', 'hitler', 'fuck', 'fuk', 'fck', 'shit', 'sh1t', 'cunt',
  'cnut', 'pussy', 'pussi', 'puss1', 'penis', 'vagina', 'nipple', 'porn', 'p0rn',
  'xxx', 'orgy', 'orgasm', 'jizz', 'jism', 'sperm', 'semen', 'blowjob', 'handjob',
  'rimjob', 'whore', 'slut', 'skank', 'milf', 'gilf', 'bitch', 'biatch', 'b1tch',
  'bastard', 'jerkoff', 'horny', 'h0rny', 'rapist', 'molest', 'bestial', 'hentai',
  'fetish', 'bdsm', 'bondage', 'dildo', 'vibrator', 'bollock', 'ballsack', 'nutsack',
  'scrotum', 'testicle', 'ejacul', 'masturb', 'twat', 'minge', 'smegma', 'queef',
  'gangbang', 'creampie', 'deepthroat', 'felch', 'clunge', 'wanker', 'asshole',
  'butthole', 'dumbass', 'jackass', 'badass', 'smartass', 'fatass', 'asswipe',
  'cocksuck', 'motherfuck', 'dickhead', 'cockhead', 'shithead', 'dipshit', 'bullshit',
  'retard', 'faggit', 'niglet',
];
// SOFT: short stems that DO appear inside common words ("ass" in password, "butt" in
// butterfly, "sex" in essex). Matched only when bounded by a non-letter or a string
// edge, so "password"/"butterfly"/"essex" survive while "sex123"/"ass" are caught.
const BLOCK_SOFT = [
  'ass', 'azz', 'sex', 's3x', 'cum', 'butt', 'anal', 'anus', 'tit', 'tits', 'titt',
  'boob', 'b00b', 'cock', 'c0ck', 'dick', 'd1ck', 'clit', 'hoe', 'coon', 'spic',
  'hore', 'pron', 'fap', 'shag', 'knob', 'wank', 'boner', 'rape', 'raped', 'horn',
];
const SOFT_RE = new RegExp(`(^|[^a-z])(${BLOCK_SOFT.join('|')})([^a-z]|$)`);
function isOffensive(alpha, lower) {
  if (BLOCK_STRONG.some((t) => alpha.includes(t))) return true;
  return SOFT_RE.test(lower);
}

// --- name filter (block plausible full names; keep ambiguous single first names) -------
const FIRST_NAMES = new Set(['john','james','robert','michael','william','david','richard','joseph','thomas','charles','christopher','daniel','matthew','anthony','mark','donald','steven','paul','andrew','joshua','kenneth','kevin','brian','george','edward','ronald','timothy','jason','jeffrey','ryan','jacob','gary','nicholas','eric','jonathan','stephen','larry','justin','scott','brandon','frank','benjamin','gregory','samuel','raymond','patrick','alexander','jack','dennis','jerry','tyler','aaron','jose','henry','adam','douglas','nathan','peter','zachary','kyle','walter','ethan','jeremy','harold','carl','keith','roger','gerald','sean','austin','arthur','noah','lawrence','jesse','joe','bryan','billy','jordan','albert','dylan','bruce','willie','gabriel','logan','mary','patricia','jennifer','linda','elizabeth','barbara','susan','jessica','sarah','karen','nancy','lisa','betty','margaret','sandra','ashley','kimberly','emily','donna','michelle','carol','amanda','dorothy','melissa','deborah','stephanie','rebecca','sharon','laura','cynthia','kathleen','amy','angela','shirley','anna','brenda','pamela','nicole','emma','samantha','katherine','christine','helen','debra','rachel','carolyn','janet','maria','catherine','heather','diane','ruth','julie','olivia','joyce','victoria','kelly','lauren','christina','joan','evelyn','judith','megan','andrea','cheryl','hannah','jacqueline','martha','gloria','teresa','ann','sara','madison','frances','kathryn','janice','jean','abigail','alice','julia','judy','sophia','grace','denise','amber','doris','marilyn','danielle','beverly','isabella','theresa','diana','natalie','brittany','charlotte','marie','kayla','alexis','lori']);
const LAST_NAMES = new Set(['smith','johnson','williams','brown','jones','garcia','miller','davis','rodriguez','martinez','hernandez','lopez','gonzalez','wilson','anderson','thomas','taylor','moore','jackson','martin','perez','thompson','white','harris','sanchez','clark','ramirez','lewis','robinson','walker','young','allen','king','wright','scott','torres','nguyen','hill','flores','green','adams','nelson','baker','hall','rivera','campbell','mitchell','carter','roberts','gomez','phillips','evans','turner','diaz','parker','cruz','edwards','collins','reyes','stewart','morris','morales','murphy','cook','rogers','gutierrez','ortiz','morgan','cooper','peterson','bailey','reed','kelly','howard','ramos','cox','ward','richardson','watson','brooks','chavez','wood','bennett','gray','mendoza','ruiz','hughes','price','alvarez','castillo','sanders','patel','myers','long','ross','foster','jimenez']);

function isFullName(alpha) {
  if (alpha.length < 6) return false;
  for (let i = 3; i <= alpha.length - 3; i++) {
    if (FIRST_NAMES.has(alpha.slice(0, i)) && LAST_NAMES.has(alpha.slice(i))) return true;
  }
  return false;
}

// --- power-law count model for rank-only input ---------------------------------------
// Anchors (rank -> occurrences). Head anchors match the published rockyou-withcount
// counts; body/tail anchors are tuned so the game keeps a healthy pool above MIN_COUNT.
// Log-log linear interpolation between anchors, strictly monotonic decreasing.
const ANCHORS = [
  [1, 290729], [4, 59462], [10, 16648], [30, 9000], [100, 4200],
  [300, 2600], [1000, 1600], [3000, 1150], [5000, 1000],
];
function countFromRank(rank) {
  if (rank <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [r1, n1] = ANCHORS[i - 1];
    const [r2, n2] = ANCHORS[i];
    if (rank <= r2) {
      const t = (Math.log(rank) - Math.log(r1)) / (Math.log(r2) - Math.log(r1));
      return Math.round(Math.exp(Math.log(n1) + t * (Math.log(n2) - Math.log(n1))));
    }
  }
  const [r1, n1] = ANCHORS[ANCHORS.length - 2];
  const [r2, n2] = ANCHORS[ANCHORS.length - 1];
  const slope = (Math.log(n2) - Math.log(n1)) / (Math.log(r2) - Math.log(r1));
  return Math.round(Math.exp(Math.log(n2) + slope * (Math.log(rank) - Math.log(r2))));
}

// --- format detection ----------------------------------------------------------------
const FORMATS = {
  colon:       { test: (s) => /^.+:\d+$/.test(s),       parse: (s) => { const m = s.match(/^(.+):(\d+)$/);    return [m[1], +m[2]]; } },
  pw_space:    { test: (s) => /^\S.*\s+\d+$/.test(s),   parse: (s) => { const m = s.match(/^(.+?)\s+(\d+)$/); return [m[1], +m[2]]; } },
  count_comma: { test: (s) => /^\d+,.+$/.test(s),       parse: (s) => { const m = s.match(/^(\d+),(.+)$/);    return [m[2], +m[1]]; } },
  count_space: { test: (s) => /^\d+\s+\S.*$/.test(s),   parse: (s) => { const m = s.match(/^(\d+)\s+(.+)$/);  return [m[2], +m[1]]; } },
};
function detectFormat(sample) {
  let best = null, bestHits = 0;
  for (const [name, f] of Object.entries(FORMATS)) {
    const hits = sample.filter((s) => f.test(s)).length;
    if (hits > bestHits) { bestHits = hits; best = name; }
  }
  // Require a strong majority to trust a count-bearing format; else treat as rank-only.
  if (best && bestHits / sample.length >= 0.8) return best;
  return null;
}

// --- character-class shape (build-time; also mirrored client-side) --------------------
function shapeLabel(p) {
  const hasL = /[a-z]/.test(p), hasU = /[A-Z]/.test(p), hasD = /\d/.test(p), hasS = /[^a-zA-Z0-9]/.test(p);
  if (hasD && !hasL && !hasU && !hasS) return `${p.length} digits`;
  if ((hasL || hasU) && !hasD && !hasS) {
    const cls = hasU && hasL ? 'mixed-case letters' : hasU ? 'uppercase letters' : 'lowercase letters';
    return `${p.length} ${cls}`;
  }
  const wd = p.match(/^([a-zA-Z]+)(\d+)$/);
  if (wd) return `a word + ${wd[2].length} digit${wd[2].length > 1 ? 's' : ''}`;
  const digits = (p.match(/\d/g) || []).length;
  const letters = (p.match(/[a-zA-Z]/g) || []).length;
  const parts = [];
  if (letters) parts.push(`${letters} letter${letters > 1 ? 's' : ''}`);
  if (digits) parts.push(`${digits} digit${digits > 1 ? 's' : ''}`);
  if (hasS) parts.push('a symbol');
  return parts.join(' + ') || `${p.length} characters`;
}

function crackTime(p) {
  // Offline attack, fast hashing (1e10 guesses/sec) — the pessimistic, honest number.
  return zxcvbn(p).crack_times_display.offline_fast_hashing_1e10_per_second;
}

// --- main ----------------------------------------------------------------------------
async function readSample(n) {
  const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    const s = line.replace(/\r$/, '');
    if (s) out.push(s);
    if (out.length >= n) break;
  }
  rl.close();
  return out;
}

async function main() {
  console.log(`Reading ${INPUT}`);
  const fmtName = detectFormat(await readSample(500));
  const fmt = fmtName ? FORMATS[fmtName] : null;
  console.log(fmt ? `Format: ${fmtName} (counts present)` : 'Format: rank-only (frequency-ordered, synthesizing counts)');

  const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
  const rows = [];          // { p, n, rank }
  let rank = 0;

  for await (const line of rl) {
    const s = line.replace(/\r$/, '');
    if (!s) continue;
    let p, n;
    if (fmt) { const r = fmt.parse(s); p = r[0]; n = r[1]; } else { p = s; n = null; }
    if (!p || p.length < 3 || p.length > 40) continue;
    if (/\s/.test(p)) continue;
    rank++;
    rows.push({ p, n, rank });
    // rank-only: the densest head is all that matters; stop early for speed.
    if (!fmt && rows.length >= SCAN_LIMIT) break;
  }
  rl.close();
  console.log(`Parsed ${rows.length} rows`);

  // Assign counts + sort descending (rank-only counts are monotonic in rank).
  for (const row of rows) if (row.n == null) row.n = countFromRank(row.rank);
  rows.sort((a, b) => b.n - a.n);

  // Occurrence total over everything scanned (before truncation) for the headline stat.
  const totalOccurrencesAll = rows.reduce((s, r) => s + r.n, 0);

  // Filter.
  const removed = { blocklist: [], name: [], email: [], lowcount: [] };
  const kept = [];
  const seen = new Set();
  for (const row of rows) {
    if (kept.length >= TOP_CAP) break;
    const p = row.p;
    if (seen.has(p)) continue;
    seen.add(p);
    const lower = p.toLowerCase();
    const alpha = lower.replace(/[^a-z]/g, '');
    if (row.n < MIN_COUNT) { removed.lowcount.push(p); continue; }
    if (isOffensive(alpha, lower)) { removed.blocklist.push(p); continue; }
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(p)) { removed.email.push(p); continue; }
    if (isFullName(alpha) || /^[a-z]{3,}_[a-z]{3,}$/.test(lower)) { removed.name.push(p); continue; }
    kept.push(row);
  }

  // Per-entry payload: password, occurrence count, baked crack time. Rank = array
  // index + 1 and shape are derived client-side to keep the file small.
  const entries = kept.map((row) => ({ p: row.p, n: row.n, ct: crackTime(row.p) }));

  // Headline stat: share of scanned occurrences held by the top 100.
  const top100 = entries.slice(0, 100).reduce((s, e) => s + e.n, 0);
  const shareTop100 = top100 / totalOccurrencesAll;

  // Curated opening matchups — keep those whose members survived and land in band.
  // The game reads the counts it loads and decides the winner from those, so we never
  // hardcode a direction here.
  const byPw = new Map(entries.map((e) => [e.p, e]));
  const CANDIDATES = [
    ['password', 'Password'], ['password1', 'Password1'], ['password', 'p@ssword'],
    ['qwerty', 'iloveyou'], ['dragon', 'monkey'], ['letmein', 'trustno1'],
    ['abc123', '123abc'], ['football', 'baseball'], ['princess', 'sunshine'],
  ];
  const openers = [];
  for (const [a, b] of CANDIDATES) {
    const ea = byPw.get(a), eb = byPw.get(b);
    if (!ea || !eb) continue;
    const ratio = Math.max(ea.n, eb.n) / Math.min(ea.n, eb.n);
    if (ratio < 1.15 || ratio > 8) continue;
    openers.push([a, b]);
  }

  // Write outputs.
  writeFileSync(resolve(DATA_DIR, 'passwords.json'), JSON.stringify(entries));
  writeFileSync(resolve(DATA_DIR, 'meta.json'), JSON.stringify({
    count: entries.length,
    minCount: MIN_COUNT,
    shareTop100: Math.round(shareTop100 * 1000) / 1000,
    topPassword: entries[0].p,
    topCount: entries[0].n,
    openers,
  }, null, 2));

  const logText = ['# Removed entries (not shipped)',
    ...Object.entries(removed).flatMap(([reason, list]) => list.map((p) => `${reason}\t${p}`))].join('\n');
  writeFileSync(REMOVED_LOG, logText + '\n');

  // Report.
  const bytes = JSON.stringify(entries).length;
  console.log('--- prep summary ---');
  console.log(`kept:              ${entries.length}`);
  console.log(`removed blocklist: ${removed.blocklist.length}`);
  console.log(`removed names:     ${removed.name.length}`);
  console.log(`removed emails:    ${removed.email.length}`);
  console.log(`removed lowcount:  ${removed.lowcount.length}`);
  console.log(`top-100 share:     ${(shareTop100 * 100).toFixed(1)}% of scanned occurrences`);
  console.log(`openers kept:      ${openers.length} -> ${openers.map((o) => o.join(' vs ')).join(', ')}`);
  console.log(`passwords.json:    ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`removal log:       ${REMOVED_LOG} (gitignored)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
