/* Password Showdown — tile-based rounds. Vanilla JS, no deps, no network after load. */
(() => {
  'use strict';

  // --- easter egg: greet would-be cheats who crack open the console ---
  (function cheatWatch() {
    const BANNER = String.raw`
 ____ _____ ___  ____     ____ _   _ _____    _  _____ ___ _   _  ____
/ ___|_   _/ _ \|  _ \   / ___| | | | ____|  / \|_   _|_ _| \ | |/ ___|
\___ \ | || | | | |_) | | |   | |_| |  _|   / _ \ | |  | ||  \| | |  _
 ___) || || |_| |  __/  | |___|  _  | |___ / ___ \| |  | || |\  | |_| |
|____/ |_| \___/|_|      \____|_| |_|_____/_/   \_\_| |___|_| \_|\____|

     _ _   _ ____ _____ ___ _   _ _
    | | | | / ___|_   _|_ _| \ | | |
 _  | | | | \___ \ | |  | ||  \| | |
| |_| | |_| |___) || |  | || |\  |_|
 \___/ \___/|____/ |_| |___|_| \_(_)
`;
    function shout() {
      try {
        console.log(BANNER);
        console.log('%cStop trying to cheat, JUSTIN! 🥊  The answers are all in your head anyway.',
          'color:#c0562b;font-size:16px;font-weight:bold;');
      } catch (_) { /* console unavailable */ }
    }
    shout(); // anyone who opens the console on load is greeted
    // Re-greet if devtools gets opened mid-game (docked-panel size heuristic).
    let wasOpen = false;
    const THRESH = 160;
    setInterval(() => {
      const open = (window.outerWidth - window.innerWidth > THRESH) ||
                   (window.outerHeight - window.innerHeight > THRESH);
      if (open && !wasOpen) shout();
      wasOpen = open;
    }, 1000);
  })();

  const $ = (id) => document.getElementById(id);
  const TEST = new URLSearchParams(location.search).has('test'); // exposes the answer
  const SHARE_URL = 'https://games.gregpollock.net/password_rank/';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BASE_ORDER = ['celebs', 'sports', 'foods', 'names'];
  const CHAOS = 'chaos';
  const Q_PER_ROUND = 5;

  // --- data ---
  let CATS = {};        // key -> {key,label,blurb,q,chaos?,entities:[{e,pop,v,r,ex,src,bucket?}]}
  let META = null;

  // --- progress ---
  let status = {};      // key -> 'locked' | 'available' | 'done'
  let roundScore = {};  // key -> points earned that round
  let totalScore = 0;

  // --- current round ---
  let cur = null;       // { key, cat, questions:[{left,right,winnerSide}], idx, correct, dbl }
  let phase = 'idle';   // 'ask' | 'reveal'
  let focusSide = 0;

  // --- helpers ---
  const randInt = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[randInt(a.length)];
  const fmt = (n) => n.toLocaleString('en-US');
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);

  // Bar-fill height on a FIXED log axis so bars are comparable across every
  // question (same pop -> same height). pop spans ~1..3164 (3 orders of
  // magnitude), which only a log scale renders legibly. Decades land at ~29/57/86%.
  const POP_AXIS = 3200;                    // ~ the most common entity
  const LOG_AXIS = Math.log10(POP_AXIS);
  const fillPct = (pop) =>
    Math.max(2, Math.min(100, Math.round((Math.log10(Math.max(1, pop)) / LOG_AXIS) * 100)));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const maxPoints = () => BASE_ORDER.length * Q_PER_ROUND + Q_PER_ROUND * 2; // 4*5 + 5*2 = 30

  // ---------- round construction ----------
  function orient(a, b) {
    const leftFirst = Math.random() < 0.5;
    const left = leftFirst ? a : b;
    const right = leftFirst ? b : a;
    const winnerSide = left.pop >= right.pop ? 0 : 1;
    return { left, right, winnerSide };
  }

  // Pick two distinct-pop entities, preferring an "interesting" (not lopsided) gap.
  function makePair(cands) {
    for (let t = 0; t < 80; t++) {
      const a = pick(cands);
      const opts = cands.filter((e) => e.e !== a.e && e.pop !== a.pop);
      if (!opts.length) continue;
      const banded = opts.filter((e) => { const r = ratio(a.pop, e.pop); return r >= 1.15 && r <= 8; });
      return orient(a, pick(banded.length ? banded : opts));
    }
    return null;
  }

  function buildQuestions(cat) {
    const used = new Set();
    const qs = [];
    for (let n = 0; n < Q_PER_ROUND; n++) {
      const cands = cat.entities.filter((e) => !used.has(e.e));
      if (cands.length < 2) break;
      const p = makePair(cands);
      if (!p) break;
      used.add(p.left.e); used.add(p.right.e);
      qs.push(p);
    }
    return qs;
  }

  // ---------- screens ----------
  function showScreen(name) {
    for (const s of ['home', 'round', 'final']) $(`screen-${s}`).hidden = s !== name;
  }

  // ---------- home / tiles ----------
  function renderHome() {
    $('home-score-val').textContent = totalScore;
    const wrap = $('tiles');
    wrap.innerHTML = '';
    const order = [...BASE_ORDER, CHAOS];
    for (const key of order) {
      const cat = CATS[key];
      if (!cat) continue;
      const st = status[key];
      const isChaos = key === CHAOS;
      const btn = document.createElement('button');
      btn.className = 'tile' + (isChaos ? ' tile-chaos' : '') + (st === 'done' ? ' is-done' : '') + (st === 'locked' ? ' is-locked' : '');
      btn.type = 'button';
      btn.dataset.key = key; // lets skins target a specific category (e.g. cover art)
      btn.disabled = st === 'locked' || st === 'done';

      let meta;
      if (st === 'done') meta = `<span class="tile-meta">✓ ${roundScore[key] || 0} pt${(roundScore[key] || 0) === 1 ? '' : 's'}</span>`;
      else if (st === 'locked') meta = `<span class="tile-meta">🔒 Clear 4 rounds</span>`;
      else if (isChaos) meta = `<span class="tile-meta tile-badge">2× POINTS</span>`;
      else meta = `<span class="tile-meta">${Q_PER_ROUND} questions</span>`;

      btn.innerHTML =
        `<span class="tile-label">${esc(cat.label)}</span>` +
        `<span class="tile-blurb">${esc(cat.blurb || '')}</span>` +
        meta;
      if (!btn.disabled) btn.addEventListener('click', () => startRound(key));
      wrap.appendChild(btn);
    }
  }

  // ---------- round lifecycle ----------
  function startRound(key) {
    const cat = CATS[key];
    const questions = buildQuestions(cat);
    if (!questions.length) return;
    cur = { key, cat, questions, idx: 0, correct: 0, dbl: !!cat.chaos };
    phase = 'idle';
    showScreen('round');
    renderQuestion();
    $('card-0').focus();
  }

  function renderQuestion() {
    const ring = $('ring');
    ring.classList.remove('revealed');
    const q = cur.questions[cur.idx];

    $('round-theme').textContent = cur.cat.label + (cur.dbl ? '  ·  2×' : '');
    $('prompt').textContent = cur.cat.q;

    for (const side of [0, 1]) {
      const entry = side === 0 ? q.left : q.right;
      const card = $(`card-${side}`);
      card.disabled = false;
      card.classList.remove('winner', 'loser', 'pick-correct', 'pick-wrong', 'is-focused');
      card.classList.add('is-themed');
      $(`pw-${side}`).textContent = entry.e;
      $(`count-${side}`).innerHTML = '';
      $(`vars-${side}`).innerHTML = '';
      const fill = $(`fill-${side}`);
      fill.style.height = '0%';
      fill.classList.remove('fill-win', 'fill-lose');
    }
    $('hud-q').textContent = `${cur.idx + 1}/${Q_PER_ROUND}`;
    $('hud-score').textContent = totalScore;
    $('reveal').hidden = true;
    $('hint').hidden = false;
    focusSide = 0;
    phase = 'ask';
    if (TEST) ring.dataset.winner = String(q.winnerSide);
  }

  function countUp(el, target, unit) {
    const render = (v) => `~${fmt(v)}<small>${unit}</small>`;
    if (reduceMotion) { el.innerHTML = render(target); return; }
    const dur = 850; let start = null;
    const step = (ts) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / dur);
      el.innerHTML = render(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    el.innerHTML = render(0);
    requestAnimationFrame(step);
  }

  // Top variants shown under each card (monospace). Fallback when none exist.
  function renderVars(entry) {
    const ex = (entry.ex || []).slice(0, 3);
    if (!ex.length) {
      return '<span class="vars-none">no variants found among the most common passwords</span>';
    }
    const chips = ex.map((v) => `<code>${esc(v)}</code>`).join('');
    return `<span class="vars-label">seen as</span>${chips}`;
  }

  // Non-repetitive takeaway: the ratio, which the card numbers don't state outright.
  function revealFact(q) {
    const w = q.winnerSide === 0 ? q.left : q.right;
    const l = q.winnerSide === 0 ? q.right : q.left;
    const r = l.pop > 0 ? w.pop / l.pop : 0;
    const mult = (r >= 10 ? String(Math.round(r)) : r.toFixed(1).replace(/\.0$/, '')) + '×';
    return `<b>${esc(w.e)}</b> shows up about <b>${mult}</b> as often as ` +
           `<b>${esc(l.e)}</b> in real breaches.`;
  }

  function choose(side) {
    if (phase !== 'ask') return;
    phase = 'reveal';
    const q = cur.questions[cur.idx];
    const correct = side === q.winnerSide;

    $('ring').classList.add('revealed');
    $('hint').hidden = true;

    for (const s of [0, 1]) {
      const card = $(`card-${s}`);
      card.disabled = true;
      card.classList.remove('is-focused');
      const entry = s === 0 ? q.left : q.right;
      countUp($(`count-${s}`), entry.pop, 'per million');
      const win = s === q.winnerSide;
      card.classList.add(win ? 'winner' : 'loser');

      const fill = $(`fill-${s}`);
      fill.classList.add(win ? 'fill-win' : 'fill-lose');
      const pct = fillPct(entry.pop);
      requestAnimationFrame(() => { fill.style.height = pct + '%'; });

      $(`vars-${s}`).innerHTML = renderVars(entry);
    }
    $(`card-${side}`).classList.add(correct ? 'pick-correct' : 'pick-wrong');

    if (correct) {
      const pts = cur.dbl ? 2 : 1;
      cur.correct += pts;
      totalScore += pts;
      $('hud-score').textContent = totalScore;
    }

    $('reveal-fact').innerHTML = revealFact(q);
    const last = cur.idx === cur.questions.length - 1;
    $('btn-next').textContent = last ? 'Finish round →' : 'Next →';
    $('reveal').hidden = false;
    $('btn-next').focus();
  }

  function advance() {
    if (phase !== 'reveal') return;
    if (cur.idx < cur.questions.length - 1) {
      cur.idx++;
      renderQuestion();
    } else {
      finishRound();
    }
  }

  function finishRound() {
    roundScore[cur.key] = cur.correct;
    status[cur.key] = 'done';
    // Unlock chaos once all four base rounds are done.
    if (BASE_ORDER.every((k) => status[k] === 'done') && status[CHAOS] === 'locked') {
      status[CHAOS] = 'available';
      toast('Chaos unlocked — points count double!');
    } else {
      toast(`Round complete: ${cur.correct} point${cur.correct === 1 ? '' : 's'}`);
    }
    const allDone = [...BASE_ORDER, CHAOS].every((k) => status[k] === 'done');
    cur = null;
    if (allDone) showFinal();
    else { renderHome(); showScreen('home'); }
  }

  // ---------- final ----------
  function showFinal() {
    $('final-num').textContent = totalScore;
    $('final-max').innerHTML = `out of a possible <strong>${maxPoints()}</strong>`;
    const pct = totalScore / maxPoints();
    $('final-verdict').textContent =
      pct >= 0.9 ? 'Breach savant' : pct >= 0.6 ? 'Nicely done' : 'All five rounds cleared';
    renderPayoff();
    showScreen('final');
    $('btn-reset').focus();
  }

  function renderPayoff() {
    if (META && META.topPassword && META.topCount) {
      $('payoff').innerHTML =
        `<p class="payoff-stat">The single most common password here, ` +
        `<b style="color:#e0a326">${esc(META.topPassword)}</b>, was chosen ${fmt(META.topCount)} times.</p>` +
        `<p class="payoff-sub">Every name you just ranked is someone&rsquo;s real password. ` +
        `&ldquo;Clever&rdquo; tweaks like a trailing <span style="font-family:ui-monospace,monospace">1</span> ` +
        `are themselves among the most common patterns there are.</p>`;
    } else {
      $('payoff').innerHTML =
        `<p class="payoff-stat">Every name you just ranked is someone&rsquo;s real password.</p>` +
        `<p class="payoff-sub">The lesson isn&rsquo;t the score &mdash; it&rsquo;s how ` +
        `<em>unoriginal</em> our &ldquo;clever&rdquo; passwords really are.</p>`;
    }
  }

  function resetAll() {
    initProgress();
    renderHome();
    showScreen('home');
  }

  async function shareResult() {
    const text = `Password Showdown 🔐\nScored ${totalScore}/${maxPoints()} across five rounds.\n${SHARE_URL}`;
    try { await navigator.clipboard.writeText(text); toast('Result copied'); }
    catch { toast('Copy failed'); }
  }

  // ---------- toast ----------
  let toastT = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- input ----------
  function moveFocus(side) {
    if (phase !== 'ask') return;
    focusSide = side;
    for (const s of [0, 1]) $(`card-${s}`).classList.toggle('is-focused', s === side);
    $(`card-${side}`).focus();
  }
  document.addEventListener('keydown', (e) => {
    if (!$('screen-round').hidden) {
      if (phase === 'ask') {
        if (e.key === 'ArrowLeft') { moveFocus(0); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { moveFocus(1); e.preventDefault(); }
        else if (e.key === 'Enter' || e.key === ' ') { choose(focusSide); e.preventDefault(); }
      } else if (phase === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
        advance(); e.preventDefault();
      }
    }
  });

  // ---------- init ----------
  function initProgress() {
    status = {};
    for (const k of BASE_ORDER) status[k] = 'available';
    status[CHAOS] = 'locked';
    roundScore = {};
    totalScore = 0;
    cur = null;
  }

  function wire() {
    $('card-0').addEventListener('click', () => choose(0));
    $('card-1').addEventListener('click', () => choose(1));
    $('btn-next').addEventListener('click', advance);
    $('btn-quit').addEventListener('click', () => { cur = null; renderHome(); showScreen('home'); });
    $('btn-reset').addEventListener('click', resetAll);
    $('btn-share').addEventListener('click', shareResult);
  }

  async function boot() {
    try {
      const [game, meta] = await Promise.all([
        fetch('./data/game.json').then((r) => r.json()),
        fetch('./data/meta.json').then((r) => r.json()).catch(() => null),
      ]);
      META = meta;
      // Label curation: when the only variants we matched are a distinctive
      // full-name form, show the person — not the ambiguous common word.
      const RELABEL = {
        Woods: 'Tiger Woods',      // only matches "tigerwoods"
        Tyson: 'Mike Tyson',       // only matches "miketyson"
        Brady: 'Tom Brady',        // matches "tombrady12"
        Manning: 'Peyton Manning', // top variant is "peyton"
      };
      const DROP = new Set([
        'Migos',    // "amigos"/"3amigos" is not the group — specious substring match
        'Leonardo', // bare "leonardo" is a common first name, not clearly DiCaprio
      ]);
      for (const c of game.categories) {
        c.entities = c.entities.filter((e) => !DROP.has(e.e));
        for (const e of c.entities) if (RELABEL[e.e]) e.e = RELABEL[e.e];
        CATS[c.key] = c;
      }
      if (TEST) window.__CATS = CATS;
      initProgress();
      wire();
      renderHome();
      showScreen('home');
    } catch (err) {
      $('stage').innerHTML =
        '<h1 class="title">Hmm.</h1><p class="lede">The game data failed to load. Try refreshing.</p>';
    }
  }

  boot();
})();
