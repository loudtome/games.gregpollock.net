/* Password Showdown — client logic. Vanilla JS, no dependencies, no network after load. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const BEST_KEY = 'pwshowdown_best';
  const SHARE_URL = 'https://games.gregpollock.net/password_rank/';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- state ---
  let ENTRIES = [];          // [{p, n, ct}] sorted desc by n; array index = frequency rank
  let META = null;
  let rankOf = new Map();     // p -> 1-based rank (array index + 1)
  let openers = [];           // [[a,b], ...] curated, orientation resolved from data

  let round = 0;              // 1-based current round number
  let streak = 0;
  let used = new Set();       // passwords shown this run
  let pair = null;            // { left, right, winnerSide }
  let phase = 'idle';         // 'ask' | 'reveal'
  let focusSide = 0;

  // --- helpers ---
  const randInt = (n) => Math.floor(Math.random() * n);
  const fmt = (n) => n.toLocaleString('en-US');
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Character-class shape — mirror of the build-time labeller.
  function shapeLabel(p) {
    const hasL = /[a-z]/.test(p), hasU = /[A-Z]/.test(p), hasD = /\d/.test(p), hasS = /[^a-zA-Z0-9]/.test(p);
    if (hasD && !hasL && !hasU && !hasS) return `${p.length} digits`;
    if ((hasL || hasU) && !hasD && !hasS) {
      const cls = hasU && hasL ? 'mixed-case letters' : hasU ? 'uppercase letters' : 'lowercase letters';
      return `${p.length} ${cls}`;
    }
    const wd = p.match(/^([a-zA-Z]+)(\d+)$/);
    if (wd) return `a word plus ${wd[2].length} digit${wd[2].length > 1 ? 's' : ''}`;
    const digits = (p.match(/\d/g) || []).length;
    const letters = (p.match(/[a-zA-Z]/g) || []).length;
    const parts = [];
    if (letters) parts.push(`${letters} letter${letters > 1 ? 's' : ''}`);
    if (digits) parts.push(`${digits} digit${digits > 1 ? 's' : ''}`);
    if (hasS) parts.push('a symbol');
    return parts.join(' + ') || `${p.length} characters`;
  }

  // Band for a given round (1-based). Rounds 1-2 are curated openers.
  function bandForRound(r) {
    if (r <= 3) return [3, 12];
    if (r < 10) return [1.15, 8];
    return [1.05, 3];
  }

  // Orient two entries into {left,right,winnerSide}, randomizing which side is bigger.
  function orient(a, b) {
    const leftFirst = Math.random() < 0.5;
    const left = leftFirst ? a : b;
    const right = leftFirst ? b : a;
    const winnerSide = left.n >= right.n ? 0 : 1;
    return { left, right, winnerSide };
  }

  // Pick a fresh pair within the round's ratio band. Falls back to a relaxed band,
  // then to any two unused entries, so the game never stalls.
  function pickPair(r) {
    const avail = ENTRIES.filter((e) => !used.has(e.p));
    if (avail.length < 2) return null;

    const tryBand = (lo, hi, attempts) => {
      for (let i = 0; i < attempts; i++) {
        const a = avail[randInt(avail.length)];
        const cands = avail.filter((e) => e !== a && ratio(a.n, e.n) >= lo && ratio(a.n, e.n) <= hi);
        if (cands.length) return orient(a, cands[randInt(cands.length)]);
      }
      return null;
    };

    const [lo, hi] = bandForRound(r);
    return tryBand(lo, hi, 60)
        || tryBand(1.02, 20, 200)
        || orient(avail[0], avail[1]);
  }

  function nextPair() {
    // First two rounds: draw from curated openers when their members are still unused.
    if (round <= 2) {
      while (openers.length) {
        const [pa, pb] = openers.shift();
        const ea = ENTRIES.find((e) => e.p === pa);
        const eb = ENTRIES.find((e) => e.p === pb);
        if (ea && eb && !used.has(pa) && !used.has(pb)) return orient(ea, eb);
      }
    }
    return pickPair(round);
  }

  // --- rendering ---
  function showScreen(name) {
    for (const s of ['intro', 'game', 'results']) $(`screen-${s}`).hidden = s !== name;
  }

  function renderPair() {
    const ring = $('ring');
    ring.classList.remove('revealed');
    for (const side of [0, 1]) {
      const entry = side === 0 ? pair.left : pair.right;
      const card = $(`card-${side}`);
      card.disabled = false;
      card.classList.remove('winner', 'loser', 'pick-correct', 'pick-wrong', 'is-focused');
      $(`pw-${side}`).textContent = entry.p;
      $(`count-${side}`).innerHTML = '';
    }
    $('hud-round').textContent = round;
    $('hud-streak').textContent = streak;
    $('reveal').hidden = true;
    $('hint').hidden = false;
    focusSide = 0;
    phase = 'ask';
  }

  function countUp(el, target) {
    el.innerHTML = `0<small>times chosen</small>`;
    if (reduceMotion) { el.innerHTML = `${fmt(target)}<small>times chosen</small>`; return; }
    const dur = 950;
    let start = null;
    const step = (ts) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(target * eased);
      el.innerHTML = `${fmt(val)}<small>times chosen</small>`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function revealFact() {
    const winner = pair.winnerSide === 0 ? pair.left : pair.right;
    const kind = round % 3; // rotate rank / shape / crack time
    if (kind === 1) {
      const rk = rankOf.get(winner.p);
      return `<b>${winner.p}</b> is the <b>#${rk}</b> most common password in this breach.`;
    }
    if (kind === 2) {
      return `<b>${winner.p}</b> is just ${shapeLabel(winner.p)} — a pattern crackers try early.`;
    }
    return `A fast offline attack cracks <b>${winner.p}</b> in <b>${winner.ct}</b>.`;
  }

  function choose(side) {
    if (phase !== 'ask') return;
    phase = 'reveal';
    const correct = side === pair.winnerSide;

    $('ring').classList.add('revealed');
    $('hint').hidden = true;

    for (const s of [0, 1]) {
      const card = $(`card-${s}`);
      card.disabled = true;
      card.classList.remove('is-focused');
      const entry = s === 0 ? pair.left : pair.right;
      countUp($(`count-${s}`), entry.n);
      if (s === pair.winnerSide) card.classList.add('winner');
      else card.classList.add('loser');
    }
    $(`card-${side}`).classList.add(correct ? 'pick-correct' : 'pick-wrong');

    used.add(pair.left.p);
    used.add(pair.right.p);

    if (correct) {
      streak++;
      $('hud-streak').textContent = streak;
      $('reveal-fact').innerHTML = revealFact();
      $('reveal').hidden = false;
      $('btn-next').focus();
    } else {
      // brief beat so the counts land before the results screen
      setTimeout(endRun, reduceMotion ? 300 : 1250);
    }
  }

  function advance() {
    if (phase !== 'reveal') return;
    round++;
    pair = nextPair();
    if (!pair) { endRun(); return; }
    renderPair();
  }

  // --- run lifecycle ---
  function startRun() {
    round = 1;
    streak = 0;
    used = new Set();
    openers = shuffle(META.openers);
    pair = nextPair();
    showScreen('game');
    renderPair();
    $('card-0').focus();
  }

  function endRun() {
    const best = getBest();
    if (streak > best) { setBest(streak); }
    const newBest = Math.max(best, streak);

    $('final-streak').textContent = streak;
    $('results-verdict').textContent = streak >= best && streak > 0 ? 'New personal best!' : 'Run over';
    $('results-best').innerHTML = `Personal best: <strong>${newBest}</strong>`;

    // ending pair
    const w = pair.winnerSide === 0 ? pair.left : pair.right;
    const l = pair.winnerSide === 0 ? pair.right : pair.left;
    $('died-pair').innerHTML =
      `<span class="dp win"><span class="dp-pw">${esc(w.p)}</span><span class="dp-n">${fmt(w.n)} uses</span></span>` +
      `<span class="dp-vs">beat</span>` +
      `<span class="dp"><span class="dp-pw">${esc(l.p)}</span><span class="dp-n">${fmt(l.n)} uses</span></span>`;

    renderPayoff();
    showScreen('results');
    $('btn-again').focus();
  }

  function renderPayoff() {
    const share = META.shareTop100;               // fraction of scanned occurrences
    const oneIn = Math.max(2, Math.round(1 / share));
    $('payoff').innerHTML =
      `<p class="payoff-stat">Just 100 passwords cover about <b>1 in ${oneIn}</b> of the accounts in this data.</p>` +
      `<p class="payoff-sub">The single most common one, <b style="color:#e0a326">${esc(META.topPassword)}</b>, was chosen ${fmt(META.topCount)} times. "Clever" tweaks like a trailing <span style="font-family:ui-monospace,monospace">1</span> or a <span style="font-family:ui-monospace,monospace">@</span> for <span style="font-family:ui-monospace,monospace">a</span> are themselves some of the most common patterns there are.</p>`;
  }

  // --- persistence ---
  function getBest() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { return 0; } }
  function setBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* ignore */ } }

  // --- share ---
  function shareText() {
    const w = pair.winnerSide === 0 ? pair.left : pair.right;
    const l = pair.winnerSide === 0 ? pair.right : pair.left;
    return `Password Showdown 🔐\nStreak: ${streak}\nDied on: ${w.p} vs ${l.p}\n${SHARE_URL}`;
  }
  async function copyResult() {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      toast('Result copied to clipboard');
    } catch {
      // Fallback for browsers without clipboard API / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Result copied to clipboard'); }
      catch { toast('Copy not supported — select and copy manually'); }
      document.body.removeChild(ta);
    }
  }

  let toastTimer = null;
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- keyboard ---
  function moveFocus(side) {
    if (phase !== 'ask') return;
    focusSide = side;
    for (const s of [0, 1]) $(`card-${s}`).classList.toggle('is-focused', s === side);
    $(`card-${side}`).focus();
  }
  function onKey(e) {
    if ($('screen-game').hidden) return;
    if (phase === 'ask') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.side != null) return; // let button handle it
        e.preventDefault(); choose(focusSide);
      }
    } else if (phase === 'reveal') {
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement === $('btn-next')) return;
        e.preventDefault(); advance();
      }
    }
  }

  // --- wire up ---
  function bind() {
    $('btn-start').addEventListener('click', startRun);
    $('btn-again').addEventListener('click', startRun);
    $('btn-share').addEventListener('click', copyResult);
    $('btn-next').addEventListener('click', advance);
    for (const s of [0, 1]) {
      const card = $(`card-${s}`);
      card.addEventListener('click', () => choose(s));
      card.addEventListener('focus', () => { if (phase === 'ask') { focusSide = s; } });
    }
    document.addEventListener('keydown', onKey);

    const best = getBest();
    if (best > 0) { $('intro-best').hidden = false; $('intro-best-val').textContent = best; }
  }

  async function boot() {
    bind();
    try {
      const [pw, meta] = await Promise.all([
        fetch('./data/passwords.json').then((r) => r.json()),
        fetch('./data/meta.json').then((r) => r.json()),
      ]);
      ENTRIES = pw;
      META = meta;
      ENTRIES.forEach((e, i) => rankOf.set(e.p, i + 1));
    } catch (err) {
      $('screen-intro').innerHTML =
        '<h1 class="title">Hmm.</h1><p class="lede">The password data failed to load. Try refreshing.</p>';
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  boot();
})();
