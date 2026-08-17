# Password Showdown — data prep

Turns a breach wordlist into the small JSON the game ships.

## Rebuild

```bash
cd password_rank/prep
npm install                       # one dependency: zxcvbn (build-time crack times)
node build-data.mjs [wordlist]    # default: ../rockyou.txt
node test-pairs.mjs               # invariant check: no repeats, bands respected
```

Outputs `../data/passwords.json` (~145 KB, top ~2,900 entries) and `../data/meta.json`.
A `removed.log` of everything filtered is written for review and is gitignored.

## Input formats

Detected once from a sample of the head, then applied to the whole file:

| line looks like        | interpreted as |
|------------------------|----------------|
| `password:20958297`    | `pw:count`     |
| `123456 20958297`      | `pw count`     |
| `20958297,password`    | `count,pw`     |
| `20958297 password`    | `count pw`     |
| `password`             | rank-only (no counts) |

`rockyou.txt` is the rank-only case — one password per line, ordered by frequency, no
counts. When counts are absent they're synthesized from each line's frequency rank via a
power-law model anchored to the published rockyou-withcount head (see `ANCHORS` in
`build-data.mjs`). Counts therefore fall strictly with rank, so the "which is more common"
answer always matches the source file's real frequency ordering. Supply a wordlist that
*does* carry counts and those real counts are used verbatim — no code changes needed.

## Filtering (all at build time)

- Offensive terms — a two-tier blocklist. Unambiguous slurs match as substrings; short
  stems that occur inside benign words (`ass` in `password`, `butt` in `butterfly`) match
  only at non-letter boundaries, so centerpiece passwords survive while `sex123` etc. do not.
- Plausible full names (first + last, e.g. `johnsmith`) and `first_last` handles.
- Email-looking strings.
- Anything below 1,000 occurrences.

Ambiguous single first names (`nicole`, `daniel`) are intentionally kept — they're good content.
