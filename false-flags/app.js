const $ = (id) => document.getElementById(id);

const state = {
  misses: 0,
  current: null,
  next: null,      // prefetched round
  seen: [],        // recently used countries, sent as exclusions
};

const LOADING_MSGS = [
  'Stitching a brand-new flag…',
  'Consulting the vexillologists…',
  'Interviewing local geese for fun facts…',
  'Running it up the flagpole…',
  'Arguing about the exact shade of teal…',
];
let loadingTimer;

function startLoadingMsgs() {
  let i = 0;
  $('loadingMsg').textContent = LOADING_MSGS[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MSGS.length;
    $('loadingMsg').textContent = LOADING_MSGS[i];
  }, 3000);
}
function stopLoadingMsgs() { clearInterval(loadingTimer); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// On static hosting (GitHub Pages) rounds are pre-generated files listed in a
// manifest; when developing against server.js the manifest 404s and we fall
// back to the live /api/round endpoint.
let manifestPromise = null;
function getManifest() {
  manifestPromise ??= fetch('rounds/index.json')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  return manifestPromise;
}

async function fetchRound() {
  const manifest = await getManifest();
  if (manifest) {
    let pool = manifest.filter((f) => !state.seen.includes(f));
    if (pool.length === 0) pool = manifest; // all seen: allow repeats
    const file = pool[Math.floor(Math.random() * pool.length)];
    const round = await (await fetch('rounds/' + file)).json();
    round.file = file;
    round.options = shuffle(round.options);
    return round;
  }

  const res = await fetch('/api/round', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exclude: state.seen }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

function prefetchNext() {
  state.next = fetchRound().catch(() => null); // a promise; resolved lazily
}

async function loadRound() {
  $('reveal').classList.add('hidden');
  $('reveal').innerHTML = '';
  $('options').classList.add('hidden');
  $('missNotes').innerHTML = '';
  $('flagWrap').innerHTML = '<div class="loading" id="loading"><div class="spinner"></div><div id="loadingMsg"></div></div>';
  startLoadingMsgs();

  let round = null;
  if (state.next) {
    round = await state.next;
    state.next = null;
  }
  if (!round) {
    try {
      round = await fetchRound();
    } catch (err) {
      stopLoadingMsgs();
      $('flagWrap').innerHTML = `<div class="error">Couldn't generate a round: ${err.message}<br><button onclick="loadRound()">Try again</button></div>`;
      return;
    }
  }

  stopLoadingMsgs();
  state.current = round;
  state.misses = 0;
  state.seen.push(round.file || round.answer);

  $('flagWrap').innerHTML = `<img src="${round.flag}" alt="A fictitious flag — guess the country!">`;

  const opts = $('options');
  opts.innerHTML = '';
  round.options.forEach((name) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => guess(name, b);
    opts.appendChild(b);
  });
  opts.classList.remove('hidden');

  prefetchNext();
}

function guess(name, btn) {
  const { answer, facts, decoys } = state.current;

  if (name !== answer) {
    // Eliminate this option, explain the mismatch, keep playing.
    btn.disabled = true;
    btn.classList.add('wrong');
    state.misses++;

    const decoy = decoys.find((d) => d.country === name);
    const note = document.createElement('div');
    note.className = 'miss-note';
    note.innerHTML = `<b>Not ${name}.</b> ${decoy ? decoy.overlap : ''}`;
    $('missNotes').appendChild(note);
    return;
  }

  // Correct: end the round.
  document.querySelectorAll('#options button').forEach((b) => {
    b.disabled = true;
    if (b.textContent === answer) b.classList.add('correct');
    else b.classList.add('faded');
  });

  const firstTry = state.misses === 0;
  const verdict = firstTry
    ? 'Nailed it first try!'
    : state.misses === 3
      ? `It was ${answer} — by process of elimination.`
      : `Got there after ${state.misses} wrong guess${state.misses > 1 ? 'es' : ''}.`;

  const reveal = $('reveal');
  reveal.innerHTML = `
    <div class="verdict ${firstTry ? 'good' : 'bad'}">${verdict}</div>
    <h3>What the flag was telling you</h3>
    ${facts.map((f) => `
      <div class="factcard">
        <div>${f.fact}</div>
        <div class="fe">⚑ ${f.flagElement}</div>
      </div>`).join('')}
    ${(() => {
      const guessed = new Set([...document.querySelectorAll('#options button.wrong')].map((b) => b.textContent));
      const rest = decoys.filter((d) => !guessed.has(d.country));
      if (rest.length === 0) return '';
      return `<h3>Why the other option${rest.length > 1 ? 's were' : ' was'} tempting</h3>` +
        rest.map((d) => `<div class="decoy"><b>${d.country}</b> — ${d.overlap}</div>`).join('');
    })()}
    <button class="next" onclick="nextRound()">Next flag →</button>
  `;
  reveal.classList.remove('hidden');
  reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextRound() {
  loadRound();
}

loadRound();
