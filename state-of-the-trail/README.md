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
- Start with $650 and five named travelers with 100 health each. Every state, including Florida and Oregon, takes four encounter days. A new encounter appears after approximately 2.3 seconds of travel.
- Higher proposal counts increase the probability of a negative encounter. Negative encounters always use a row mapped to the current state. Cards show the CSV summary, category, sponsor, chamber, a bill identifier where extractable, and the original source link.
- Spend money to reduce damage, or preserve funds and accept the full loss. Good encounters restore surviving travelers' health or add money. Dead travelers cannot recover. Money reaching zero does not itself kill anyone.
- Reach the end of Oregon's segment with at least one survivor to win. Lose when everyone dies. Pause stops travel. Changing browser tabs automatically pauses between encounters. Refreshing starts over; there is no saved game.

## Data and interpretation

`Grid view.csv` is the supplied source with an added **State** column, derived from the first token of **Chamber**. All original columns and rows are retained. Nebraska's `NE` chamber maps directly to Nebraska. There are 1,182 entries. Counts are rows, not deduplicated bills; multiple entries may refer to the same proposal.

The spreadsheet's summaries and issue labels are reproduced as supplied. Proposed legislation is not treated as enacted law. The game does not verify current bill status or independently rate legal risk. Encounters use individually written stories based on each summary and category; damage, death, probabilities, and mitigation costs are gameplay inventions, not factual assertions about specific bills.

### Editing encounter descriptions

Edit the **Encounter Description** column in `Grid view.csv`. Each cell holds 1–3 sentences of plain text. Keep the headers unchanged, and let a spreadsheet editor handle quoting commas and line breaks. Original summaries remain in **Summary**; the new column is the narrative shown beneath the bill title.

Every row has a description. Identical summary/category pairs initially share text, but you can edit any row independently. There are 902 distinct pairs across the 1,182 source entries. Six Luna batches of roughly 150 pairs produced the drafts; `writing/` retains those inputs and outputs for reference. Once merged, the CSV is the editable source of truth; ordinary rebuilds do not rerun or overwrite your descriptions with the draft files.

Regenerate the browser data after CSV changes:

```sh
python3 build_data.py
```

The importer validates chamber codes against all 50 states and cross-checks the state against LegiScan URL paths or known official legislative domains. Unknown or mismatched states and missing descriptions fail the build. Add new official domains to the validation table when needed.

## Verification

```sh
npm test
```

Tests cover state mapping, reciprocal adjacency, valid and invalid routes, state-local encounters, money and health bounds, permanent deaths, final-state completion, and 100 seeded full-game simulations.

## Map attribution

The bundled map is `states-albers-10m.json` from [us-atlas 3](https://github.com/topojson/us-atlas), based on US Census Bureau boundaries and distributed under the ISC license. Its Albers USA projection shows Alaska and Hawaii as insets. The game decodes the TopoJSON locally without third-party runtime dependencies. See `data/MAP-LICENSE.txt`.
