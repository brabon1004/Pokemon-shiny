# Shiny Tracker

An unofficial fan site that shows what's live in Pokémon GO right now and how likely each Pokémon is to be shiny. Every card carries a community-estimated shiny rate, and a calculator works out your chance of at least one shiny in N encounters.

Live site: https://shiny-tracker-go.pages.dev

## Tabs

- **Wild**: the species an event running now spawns more often, such as Community Day, Spotlight Hour, or an event like Dynamax Trails, with each one's shiny odds and when the event ends. Most are at the base rate; Community Day and `eventOverrides` boosts show their higher rate. Season-long spawns are left out.
- **Raids**: current raid bosses, by tier.
- **Dynamax**: current Max Battle bosses. The shiny rates here are unverified estimates, and the tab says so.
- **Eggs**: current egg hatches, by distance.
- **Research**: current field research rewards.
- **All Pokémon**: every species and form with a released shiny, searchable.

## How the data gets built

Nothing in `public/data/` is committed. The deploy workflow builds `public/data/combined.json` fresh on every run from these inputs:

1. [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck): raids, eggs, research and events, scraped from LeekDuck.
2. LeekDuck event pages (`leekduck.com/events/<event>/`) for events running now whose spawns ScrapedDuck doesn't list. The build reads each page's Wild Encounters section, one page at a time and at most 12 per run. It only requests https pages under `leekduck.com/events/`. A page that fails to load or lists nothing is skipped with a warning; it never fails the build.
3. LeekDuck's shiny list (`leekduck.com/shiny/pms.json`) for the All Pokémon tab. If that fetch fails, the build uses the snapshot in `data/shiny-list.snapshot.json`. The build also checks raid, egg, research and wild encounters against it: ScrapedDuck's `canBeShiny` flag misses released shinies (it once marked every research reward as not shiny), so an encounter counts as shiny when ScrapedDuck says so or when its form is on the list with a release date on or before the build date. Shadow raid bosses keep ScrapedDuck's flag, because the list has no shadow entries.
4. `data/rates.json`: the shiny rate table and the Max Battle rotation, both edited by hand.

The workflow (`.github/workflows/deploy.yml`) runs on every push to `prod`, every 4 hours on a schedule, and on demand from the Actions tab. It always builds the `prod` branch, so work on `main` never reaches the live site until it is merged into `prod`. It type-checks, lints and tests, builds the data, builds the site and deploys it to Cloudflare Pages. If any step fails, nothing is deployed and the last good version stays up.

## Local development

Requires Node 24.

```sh
npm ci
npm run dev          # uses sample data if public/data/combined.json is missing
npm run build:data   # fetch live data into public/data/combined.json
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:data -- --refresh-snapshot` (also rewrites `data/shiny-list.snapshot.json` from the live LeekDuck list), and `npm run refresh:names` (re-vendors species names from PokéAPI; run it after a new generation).

## Editing shiny rates

Open `data/rates.json`. Set `updated` to today's date whenever you change it; the build copies it into `combined.json` as `ratesUpdated`.

- `tiers`: each rate tier's label and odds (`denom` 512 means 1 in 512). Mark a tier `"unverified": true` when it is an unverified estimate with no research behind it; the legend marks its odds with * and explains the mark below the list.
- `encounterDefaults`: the tier for each encounter type: `wild`, `research`, `egg`, `raid:<tier>` using ScrapedDuck's raid tier name, such as `raid:5-Star Raids`, `max:dynamax` or `max:gigantamax`. `raid:default` covers raid tiers not listed.
- `eventTypeDefaults`: the tier for an event type, keyed by ScrapedDuck `eventType`. It applies to every Wild tab species the event features, except Community Day spawns outside its featured shinies, which get their normal rate.
- `speciesOverrides`: a fixed tier for one species in one encounter type (including `max:dynamax` and `max:gigantamax`), keyed by dex number as a string:

  ```json
  "speciesOverrides": {
    "382": { "raid:5-Star Raids": "raid_day" }
  }
  ```

- `eventOverrides`: a tier for specific species during one event, keyed by the ScrapedDuck `eventID` (find it in [`events.min.json`](https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json)). Use this when an event boosts shiny rates for its featured Pokémon. Those species then show up on the Wild tab while the event runs:

  ```json
  "eventOverrides": {
    "<eventID from events.min.json>": { "tier": "event", "dex": [607, 608] }
  }
  ```

  An override also applies to matching raid bosses (a Raid Day, say). Raid rows carry no event window, so the boosted tier shows for every build made while the event counts as active: during the event itself, and up to about 14 hours either side of it for local-time events.

When more than one rule matches, the first match wins in this order: `eventOverrides`, `speciesOverrides`, `eventTypeDefaults` (see above), `encounterDefaults`.

The rates are community estimates from archived Silph Road research (via Bulbapedia). Niantic doesn't publish official odds. The `dynamax` and `gigantamax` tiers (1 in 64) are unverified estimates with no research behind them, and the legend marks them so.

## Updating the Max Battle bosses

No feed lists the Max Battle rotation, so `maxBattles` in `data/rates.json` is kept by hand. Update it whenever the rotation changes:

```json
"maxBattles": {
  "updated": "2026-11-18",
  "until": "2026-11-23",
  "bosses": [
    { "name": "Bulbasaur", "dex": 1, "stars": 1, "form": "dynamax" },
    { "name": "Pikachu", "dex": 25, "stars": 6, "form": "gigantamax" }
  ]
}
```

- `updated`: the day you last checked the list. With an `until` date, the list starts showing at the start of this day in each viewer's own time.
- `until`: the last day the list is right, or `null` if you don't know. After that day the build leaves the whole list off the tab and warns `maxBattles list expired on …`, so a stale rotation never shows as current. The site also hides the list at the end of that day in each viewer's own time, even if later builds fail.
- `bosses`: `name` is the English species name and must match `dex` in `data/species-names.json`, or the build fails. `stars` is 1 to 6 and shows as "1★ Max Battle". `form` is `dynamax` or `gigantamax`.

A Dynamax boss counts as shiny once the species' normal shiny is out. A Gigantamax boss counts only when LeekDuck's shiny list has its Gigantamax form (`pm<dex>.fGIGANTAMAX`).

The build also finds bosses on its own. For a running ScrapedDuck event of type `max-mondays` or `max-battles`, it reads the boss from the event name, such as "Dynamax Espurr during Max Monday" or "Gigantamax Lapras Max Battle Day". The species has to match a name in `data/species-names.json` exactly (case aside). Names it can't read, like "Max Battle Day" or "Eternamax Eternatus Returns", are skipped with a build warning that names the event. These rows show only while the event runs, and `until` doesn't affect them. While one runs, it replaces the same boss from the list, so the boss isn't shown twice.

## One-time setup

The site is hosted on Cloudflare Pages in the project `shiny-tracker-go`, whose production branch is `prod`. If you ever need to recreate it, run these from outside the repo, because Wrangler edits project files when run inside it. `--force` doesn't appear in `--help`, but without it Wrangler 4.165 converts the new project to Cloudflare Workers instead of Pages:

```
npx wrangler login
npx wrangler pages project create shiny-tracker-go --production-branch=prod --force
```

The workflow needs two repository secrets under **Settings › Secrets and variables › Actions**:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with the account permission **Cloudflare Pages: Edit**.
- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.

The site used to be on GitHub Pages at `brabon1004.github.io/Pokemon-shiny`. That copy no longer updates, so turn it off under **Settings › Pages** (unpublish) and delete the `github-pages` environment under **Settings › Environments**.

## Keeping the schedule alive

GitHub disables scheduled workflows in a repository that has had no activity for 60 days. Data refreshes don't count, because they're never committed. If the site stops updating, open the **Actions** tab, select **Build and deploy**, and click **Enable workflow**. Any push to the default branch also resets the clock.

## Credits

- **[LeekDuck](https://leekduck.com)**: the source of all the event, raid, egg, research and shiny data on this site. Please visit and support them.
- **[ScrapedDuck](https://github.com/bigfoott/ScrapedDuck)**: the LeekDuck data as JSON.
- **[PokéAPI](https://pokeapi.co)**: species names and sprites.

ScrapedDuck's terms ask that projects using its data stay free (no paywall), carry no ads, and credit ScrapedDuck and LeekDuck. This site follows all three; keep it that way if you fork it.

This project isn't affiliated with, endorsed by or sponsored by Niantic, Nintendo, The Pokémon Company or LeekDuck. Pokémon and Pokémon GO are trademarks of their respective owners.
