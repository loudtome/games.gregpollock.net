# Build spec: password head-to-head game

## What this is

A single-page browser game for Cybersecurity Awareness Month. The player is shown two real
passwords from breach data and guesses which one appears more often. Reveal shows both counts.
Repeat until they get one wrong.

The point is not the score. The point is that after ten rounds the player has an intuition for
what the distribution actually looks like — specifically that "clever" variations (`p@ssw0rd`,
`Password1`, `letmein2`) are themselves extremely common patterns rather than improvements.

## Deliverable

One static page. HTML/CSS/JS, no backend, no build step required unless you want one.
Data ships as a JSON file loaded at startup. Everything runs client-side.

No analytics, no logging, no network calls after page load. Say so somewhere on the page.

## Input data

You'll be given a wordlist of passwords with occurrence counts, roughly ranked.
Expect messy formatting — handle whichever of these you actually get:

```
password:20958297
123456 20958297
20958297,password
```

Write a prep script that normalizes this into `data/passwords.json`:

```json
[
  { "p": "123456", "n": 20958297 },
  { "p": "password", "n": 9545824 }
]
```

Sorted descending by `n`. Cap at the top 5,000 entries — beyond that the counts get thin and
the game gets less interesting. Target file size under ~150 KB; if it's larger, cut the tail.

### Prep filtering (do this at build time, not runtime)

Drop entries that are:

- Slurs, sexual terms, or anything that would be a problem on a corporate-branded page.
  Some of these are genuinely high-frequency, so they *will* be in the top 1,000. Use a
  blocklist; err toward over-filtering. This is a hard requirement — do not skip it.
- Plausible full names (`johnsmith`, `maria_garcia`). Ambiguous single first names are fine
  and are actually good content.
- Anything that looks like an email address, phone number, or address fragment.
- Entries with `n` below 1,000. Small counts make for arbitrary matchups.

Log what was removed to a separate file so it can be reviewed. Do not ship that file.

## Core mechanic: pair selection

This is the part that determines whether the game is fun. Random pairs from a power-law
distribution are boring — one side is usually 100× the other and the answer is obvious.

For each round, pick pair `(A, B)` such that:

- **Ratio band.** `1.15 ≤ max(nA,nB) / min(nA,nB) ≤ 8`. Tighter than 1.15 feels arbitrary
  to the player; wider than 8 is a giveaway. Tune these numbers once you can play it.
- **No repeats.** Track shown passwords per session; don't reuse a string within a run.
- **Randomize which side is the larger one.** Obvious, easy to get wrong.

Implementation: bucket entries by `floor(log10(n))`, sample bucket weighted toward the denser
buckets, then sample two entries within it and check the ratio. Retry on failure with a cap of
~50 attempts before falling back to a relaxed band.

### Difficulty ramp

Widen the ratio band for early rounds so people win the first two or three, then tighten it.
Round 1–3: band `[3, 12]`. Round 4+: band `[1.15, 8]`. Round 10+: `[1.05, 3]`.

### Curated opening rounds

Hardcode a small set of high-signal matchups and draw the first two rounds from it (shuffled).
These teach the lesson faster than random pairs. Pull the actual counts from the data at build
time and **verify the direction from the data** rather than assuming — do not hardcode which
side wins.

Candidate pairs, use whichever survive filtering and land in a reasonable ratio band:

- `password` vs `Password` — case sensitivity
- `password1` vs `Password1`
- `password` vs `p@ssword` — the substitution people think helps
- `qwerty` vs `iloveyou`
- `dragon` vs `monkey`
- `letmein` vs `trustno1`
- `abc123` vs `123abc`
- `football` vs `baseball`
- `princess` vs `sunshine`

If a curated pair falls outside the band or one side got filtered, drop it silently.

## Game loop

1. Two cards, side by side (stacked on mobile). Each shows one password in a monospace face,
   large. No counts yet.
2. Player clicks one. Both counts animate in. Correct choice gets marked.
3. Correct → streak increments, next round after a short beat or on click.
4. Wrong → run ends, go to results.

Counting up the numbers rather than snapping them in is worth the effort — the magnitude is
the payload and watching 9,000,000 tick past sells it better than the digits appearing.

## Scoring

Streak-based, endless. No fixed round count, no timer. The shareable unit is "I got 14 in a row."

Results screen shows: final streak, the pair that ended the run, and a "play again" that
reshuffles. Include a copy-to-clipboard share string — plain text, no image generation:

```
Password Showdown 🔐
Streak: 14
Died on: hunter2 vs monkey1
[url]
```

Persist a personal best in `localStorage`. Nothing else stored.

## Reveal detail

On each reveal, alongside the two counts, show one short factual line about the winning entry.
Derive these at build time from the string itself — no LLM, no external service:

- Rank in the list ("#38 most common")
- Character-class shape (`8 lowercase letters`, `word + 2 digits`)
- Estimated offline crack time via `zxcvbn` (bundle it; it's the one dependency worth taking)

One line, not three. Rotate which one you show.

## Closing screen

After the run ends, one screen of payoff before "play again":

- The single strongest stat from the dataset — e.g. what share of all occurrences the top 100
  passwords account for. Compute it at build time from the full list before truncation.
- A link out to Have I Been Pwned for people who want to check their own.
- Do **not** include an input box for the player to type their own password. Not even a
  client-side one. It is the obvious next feature and it is the wrong call for a security
  company to ship — the screenshot of someone typing their real password into your branded
  page is the only outcome that matters here.

## Visual direction

Open brief, but avoid the default "dark background, one acid-green accent, monospace
everything" hacker look — it's the templated answer for this subject. Pick a direction and
commit to it. The two passwords in head-to-head are the whole interface; make that moment feel
like a matchup, not a form.

Requirements regardless of direction: responsive to 360px, visible keyboard focus, full
keyboard play (left/right arrows + enter), `prefers-reduced-motion` respected.

## Non-goals

- No accounts, no leaderboard, no backend.
- No generating passwords for the user.
- No conditioning on user attributes (name, birth year, etc.).
- No search or lookup of arbitrary strings.

## Acceptance

- Loads and plays with JS-only, served from a static host.
- Zero network requests after initial page load.
- Prep script is re-runnable against a fresh wordlist without code changes.
- Blocklist filtering demonstrably applied — include the removal log in the repo's
  `.gitignore` but show a count in the prep script output.
- Played through 20 rounds, no repeated password within a run, no pair outside its band.
