# The State of the Trail

A self-contained browser survival game inspired by Oregon Trail. Plot a continuous route from Florida to Oregon, then try to get five travelers through legislation-based encounters alive.

## Play locally

From this directory:

```sh
npm start
```

Open http://localhost:8080. Alternatively, run `python3 -m http.server 8080`. Serve over HTTP; opening `index.html` directly cannot load the JSON files in most browsers.

No npm install, build step, API keys, or external runtime services are needed. To publish, upload this folder to any static web host (including the `data` directory and CSV).

## Rules

- Click neighboring states to extend your route. Click a previous stop to trim it, or use Undo / Reset. Routes cannot repeat states. Eastward and northward detours are allowed.
- Borders include river boundaries and Michigan–Wisconsin via the Upper Peninsula. Corner-only Four Corners crossings are excluded. Alaska and Hawaii appear on the map but have no mainland driving connection.
- Colors represent spreadsheet row counts, from pale cream to dark red. Green marks your route. Dashed borders mark possible next stops. Zero means no entries in this dataset, not a claim of safety.
- Start with $250, 50 rations and five named travelers with 100 health each. Resources are lean on purpose, so the first setbacks already cost something. Every state, including Florida and Oregon, takes four encounter days. A new encounter appears after approximately 2.3 seconds of travel.
- Luck runs in rhythm, on a rubber band. The chance of a good encounter starts at 10%, rises after every negative encounter (by 40 points in quiet states, 20 in the busiest), and resets after a good one.
- The rubber band aims every trip at the same shape: in danger, probably not lost, maybe one death. The party's condition (70% average health counting the dead as zero, 15% rations, 15% money, each relative to the start) is compared with a target that falls from 100% to 45% over the trip. A party ahead of the target gets worse odds and harder hits; one behind it gets better odds, softer hits, and good luck aimed at whatever it is shortest of. The knobs are `TUNING` in `engine.js`.
- Tuned by seeded simulation across short, medium and long routes and three player styles (pays whenever possible, pays only to prevent a death, never pays). On 6- to 14-state routes about 97–100% of trips reach Oregon, most with one or two deaths, and the party's total health typically bottoms out at a quarter to a third. 3-state routes are milder. States with no proposals are always good. Negative encounters always use a row mapped to the current state. Cards show the CSV summary, category, sponsor, chamber, a bill identifier where extractable, and the original source link.
- Spend money to reduce damage, or preserve funds and accept the full loss. Good encounters restore surviving travelers' health or add money. Dead travelers cannot recover. If a delay costs more rations than the party has, the shortfall is bought with money at that encounter's price per ration. Whatever money can't cover costs every survivor 1 health per missing ration.
- Reach the end of Oregon's segment with at least one survivor to win. Lose when everyone dies. Pause stops travel. Changing browser tabs automatically pauses between encounters. Refreshing starts over; there is no saved game.

## Data and interpretation

`Grid view.csv` is the supplied source with an added **State** column, derived from the first token of **Chamber**. All original columns and rows are retained. Nebraska's `NE` chamber maps directly to Nebraska. There are 1,182 entries. Counts are rows, not deduplicated bills; multiple entries may refer to the same proposal.

The spreadsheet's summaries and issue labels are reproduced as supplied. Proposed legislation is not treated as enacted law. The game does not verify current bill status or independently rate legal risk. Encounters use individually written stories based on each summary and category. They depict plausible worst-case consequences of a proposal, not reported events. Damage, death, probabilities, and mitigation costs are gameplay inventions, not factual assertions about specific bills.

### Editing encounter descriptions

Each row has two authored columns in `Grid view.csv`:

- **Encounter Description**: 1–4 short sentences of plain text, at most 45 words, shown beneath the headline. It depicts the realistic worst-case consequence of the bill itself, in a deadpan register.
- **Encounter Effect**: `one` (a single traveler is injured), `all` (every survivor is injured), or `delay` (the party loses rations). The engine uses this to pick the outcome, so the story always matches the cost shown.

When the effect is `one`, the description must contain `{name}`. The game replaces it with the traveler who is hit. `{name}` must not appear for `all` or `delay`. Rows sharing a summary and category initially share text, which is why shared texts avoid place names specific to one state. You can edit any row independently.

The current text comes from a v2 rewrite, kept in `writing/v2/`: `STYLE.md` is the writing guide, `REVIEW.md` the editorial pass, `input-*.json` and `output-*.json` the batches, and `merge.py` merges them into the CSV. `merge.py` overwrites every description and effect, so don't rerun it after hand edits to the CSV. The older v1 drafts remain in `writing/` for reference. The CSV is the source of truth.

Regenerate the browser data after CSV changes:

```sh
python3 build_data.py
```

The importer validates effects and `{name}` placeholders, plus chamber codes against all 50 states and cross-checks the state against LegiScan URL paths or known official legislative domains. Unknown or mismatched states, missing descriptions, and invalid effects fail the build. Add new official domains to the validation table when needed.

## Verification

```sh
npm test
```

Tests cover state mapping, reciprocal adjacency, valid and invalid routes, state-local encounters, money and health bounds, permanent deaths, final-state completion, and 100 seeded full-game simulations.

## Map attribution

The bundled map is `states-albers-10m.json` from [us-atlas 3](https://github.com/topojson/us-atlas), based on US Census Bureau boundaries and distributed under the ISC license. Its Albers USA projection shows Alaska and Hawaii as insets. The game decodes the TopoJSON locally without third-party runtime dependencies. See `data/MAP-LICENSE.txt`.

## Deploying changes
The site sits behind Cloudflare, which can keep old copies of files for hours. `index.html` isn't cached, so it references the other files with a version stamp (`?v=…`) in four places: `style.css` and `app.js` in `index.html`, and `engine.js` and `data/bills.json` in `app.js`. Bump the stamp whenever you change any of those files, along with `scene.js`, which is imported from `app.js` with the same stamp.
