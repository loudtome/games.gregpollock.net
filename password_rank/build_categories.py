#!/usr/bin/env python3
"""Assemble the 5 game categories from output/final/game_corpus.json.

Categories (what the app shows as tiles):
  celebs  = celebrity + athlete
  sports  = sport + sports_team   (country national teams removed)
  foods   = food
  names   = name
  chaos   = movies + music + tech (each curated to the most-deserving entries),
            ~25% of the pool each, plus ~25% drawn from the other categories.

All comparisons in the game are on `pop` (estimated appearances per million,
from the Zipf model) — the "which is more popular?" signal. Each entity ships
its pop, variant count (v), best rank (r), a few example variants (ex), and its
source theme (src) so chaos can show what class a thing came from.

Guiding curation principle: the category must be the FIRST and BY FAR STRONGEST
association for the word (a "falcon" is an animal, "metallica" is a band,
"morgan" is just a name — so morgan is out of music).
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "output", "final", "game_corpus.json")
DST = os.path.join(HERE, "data", "game.json")

MAX_PER_CATEGORY = 50
MIN_V = 3            # default minimum variants
MIN_V_BY_THEME = {"athlete": 1}   # curated whitelist; a single popular variant is fine
MAX_EXAMPLES = 3

# --- removals for the standard categories -----------------------------------
COUNTRY_TEAMS = {"mexico", "england", "france", "portugal", "colombia",
                 "argentina", "brazil", "germany", "italy", "uruguay",
                 "spain", "usa", "russia", "holland", "netherlands", "chile"}
SPORTS_TEAM_DROP = COUNTRY_TEAMS | {
    "orange", "marseille", "redskins", "sporting", "revolution", "nice",
    "reds", "saopaulo", "saopualo",
    # "hearts" is dominated by the ♥ symbol / &hearts; HTML entity / card game,
    # not Heart of Midlothian FC — the word doesn't identify the team.
    "hearts",
}
SPORT_DROP = {"striking", "mma"}

# Some clubs are scattered across several tokens (manutd / manchester / united).
# Roll those into one entity so the game shows the club, not the fragments.
# `tokens` are corpus entity names (lowercase); pop/variants are combined.
# NB: "mancity" is deliberately NOT here — that's Manchester City, a different club.
SPORTS_MERGES = [
    {"label": "Manchester United", "tokens": ["manutd", "manchester", "united"]},
]

# Foods whose variants are overwhelmingly a DIFFERENT word that merely embeds the
# food token — the count is a lie about the food, so drop them.
#   fanta  -> fantasy / fantastic / fantasia (the soda is a rounding error)
#   butter -> butterfly (an insect; would otherwise be the #1 "food")
#   cotton -> cotton the fabric (only cottoncandy is food, and it's tiny)
FOOD_DROP = {"fanta", "butter", "cotton"}

# --- Chaos whitelists: only tokens whose #1 association is that thing --------
MUSIC_KEEP = {
    "slipknot", "metallica", "nirvana", "greenday", "slayer", "pantera",
    "rammstein", "beatles", "korn", "oasis", "sublime", "bonjovi", "pearljam",
    "wutang", "beastie", "toto", "tiesto", "diplo", "bobmarley",
    "lilwayne", "aaliyah", "santana", "bowie", "beyonce", "nirvana",
}
MOVIE_KEEP = {
    "starwars", "batman", "joker", "twilight", "scarface", "spongebob",
    "scoobydoo", "jamesbond", "tinkerbell", "avatar", "titanic", "wolverine",
    "kingkong", "godfather", "godzilla", "terminator", "harrypotter", "shrek",
    "lionking", "peterpan", "gladiator", "hercules", "rambo", "predator",
    "stargate", "simpsons", "familyguy", "southpark", "frodo", "legolas",
    "aragorn", "gandalf", "tarzan", "aslan", "mirabel", "walle", "iceage",
    "bourne", "venom", "killbill", "commando", "vader", "maximus", "optimus",
    "bumblebee", "ragnar", "matrix",
}
TECH_KEEP = {
    "nokia", "pokemon", "yahoo", "google", "samsung", "windows", "hotmail",
    "madden", "warcraft", "iphone", "nintendo", "halo", "facebook",
    "minecraft", "fifa", "pikachu", "zelda", "youtube", "motorola",
    "playstation", "starcraft", "microsoft", "pacman", "gameboy", "callofduty",
    "oracle", "linux", "mario", "diablo",
    # dropped: "sonic" (panasonic/viewsonic inflate it) and "atari"
    # (katarina/catarina inflate it) — the token doesn't identify the brand.
}


def title(e):
    return e[:1].upper() + e[1:] if e else e


def ents_from(corpus, theme, keep=None, drop=None):
    """Pull cleaned entities from a corpus theme -> list of game entities."""
    t = corpus["themes"].get(theme)
    if not t:
        return []
    keep = keep and {k.lower() for k in keep}
    drop = {d.lower() for d in (drop or set())}
    minv = MIN_V_BY_THEME.get(theme, MIN_V)
    out = []
    for e in t["entities"]:
        name = e["entity"]
        if not name.isalpha() or len(name) < 3:
            continue
        if keep is not None and name not in keep:
            continue
        if name in drop:
            continue
        if e["n_variants"] < minv:
            continue
        out.append({
            "e": title(name),
            "pop": e["pop"],
            "v": e["n_variants"],
            "r": e["best_rank"],
            "ex": e["variants"][:MAX_EXAMPLES],
            "src": theme,
        })
    return out


def apply_merges(entities, merges):
    """Combine several scattered tokens into one labeled entity (summed pop /
    variant count, best rank, a round-robin of each part's example variants)."""
    by = {e["e"].lower(): e for e in entities}
    consumed = set()
    merged = []
    for m in merges:
        parts = [by[t] for t in m["tokens"] if t in by]
        if not parts:
            continue
        consumed.update(t for t in m["tokens"] if t in by)
        parts.sort(key=lambda x: -x["pop"])
        # round-robin the parts' examples so all forms show up under "seen as"
        lists = [list(p["ex"]) for p in parts]
        ex = []
        while len(ex) < MAX_EXAMPLES and any(lists):
            for pl in lists:
                if pl:
                    x = pl.pop(0)
                    if x not in ex:
                        ex.append(x)
                    if len(ex) >= MAX_EXAMPLES:
                        break
        merged.append({
            "e": m["label"],
            "pop": sum(p["pop"] for p in parts),
            "v": sum(p["v"] for p in parts),
            "r": min(p["r"] for p in parts),
            "ex": ex,
            "src": parts[0]["src"],
        })
    kept = [e for e in entities if e["e"].lower() not in consumed]
    return merged + kept


def dedupe_top(entities, cap):
    """Keep highest-pop entity per display name, return top `cap` by pop."""
    best = {}
    for e in entities:
        if e["e"] not in best or e["pop"] > best[e["e"]]["pop"]:
            best[e["e"]] = e
    ents = sorted(best.values(), key=lambda x: -x["pop"])
    return ents[:cap]


def main():
    corpus = json.load(open(SRC))
    N = corpus["meta"]["source_total"]

    celebs = dedupe_top(ents_from(corpus, "celebrity") + ents_from(corpus, "athlete"),
                        MAX_PER_CATEGORY)
    sports = dedupe_top(apply_merges(
                        ents_from(corpus, "sport", drop=SPORT_DROP) +
                        ents_from(corpus, "sports_team", drop=SPORTS_TEAM_DROP),
                        SPORTS_MERGES),
                        MAX_PER_CATEGORY)
    foods = dedupe_top(ents_from(corpus, "food", drop=FOOD_DROP), MAX_PER_CATEGORY)
    names = dedupe_top(ents_from(corpus, "name"), MAX_PER_CATEGORY)

    # Chaos: 25% movies / 25% music / 25% tech / 25% from the other categories.
    per_bucket = 15
    movies = dedupe_top(ents_from(corpus, "movie_tv", keep=MOVIE_KEEP), per_bucket)
    music = dedupe_top(ents_from(corpus, "music", keep=MUSIC_KEEP), per_bucket)
    tech = dedupe_top(ents_from(corpus, "tech_brand", keep=TECH_KEEP), per_bucket)
    for e in movies: e["bucket"] = "movie"
    for e in music:  e["bucket"] = "music"
    for e in tech:   e["bucket"] = "tech"
    others = []
    for grp in (celebs, sports, foods, names):
        for e in grp[:8]:
            o = dict(e); o["bucket"] = "other"; others.append(o)
    others = dedupe_top(others, per_bucket)
    chaos = movies + music + tech + others

    cats = [
        {"key": "celebs", "label": "Celebs", "blurb": "Famous people & athletes",
         "q": "Which name is more common in leaked passwords?", "entities": celebs},
        {"key": "sports", "label": "Sports", "blurb": "Sports & teams",
         "q": "Which shows up in more leaked passwords?", "entities": sports},
        {"key": "foods", "label": "Foods", "blurb": "Snacks & staples",
         "q": "Which food is more common in leaked passwords?", "entities": foods},
        {"key": "names", "label": "Names", "blurb": "Given names",
         "q": "Which name is more common in leaked passwords?", "entities": names},
        {"key": "chaos", "label": "Chaos", "blurb": "Movies, music, tech & more",
         "q": "Which is more common in leaked passwords?", "chaos": True,
         "entities": chaos},
    ]

    out = {"meta": {"source_total": N,
                    "note": "pop = estimated appearances per 1,000,000 leaked "
                            "passwords, modelled from rank (Zipf)."},
           "categories": cats}
    with open(DST, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {DST} ({os.path.getsize(DST)/1024:.1f} KB)")
    for c in cats:
        top = ", ".join(f"{e['e']}({e['pop']})" for e in c["entities"][:6])
        print(f"  {c['key']:8s} {len(c['entities']):3d} entities  {top}")


if __name__ == "__main__":
    main()
