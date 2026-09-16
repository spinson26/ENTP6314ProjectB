# Team Vacation Scheduler

A single-page app for scheduling vacation across an 18-person team on a continuous
52-week year. It generates a legal schedule automatically, lets an admin hand-tune it
with live rule checking, and handles requests for extra weeks.

Plain HTML, CSS and JavaScript. **No installation, no build step, no server, no
internet connection required.**

---

## How to open it

Double-click **`index.html`**. That's the whole process.

If your browser blocks something when opened that way, any static web server also
works — for example, from this folder run `npx serve .` and open the address it prints.

---

## The rules it enforces

These come from `rules.js`. Change them there and the whole app follows.

| Rule | Current value |
|---|---|
| Team size | 18 employees |
| Minimum weeks per person | 9 |
| Senior tier | the 4 most senior, maximum **17** weeks |
| Everyone else | 9-week floor, **no maximum** |
| Coverage cap | at most **4** people on vacation in any one week |
| Summer | 11 weeks, from the first week starting in June |
| Lottery weeks | Thanksgiving, Christmas, the last week of the year, spring break |

**Why the coverage cap matters:** 4 people × 52 weeks = **208** available weeks. Everyone
at their 9-week floor needs 162. If all four seniors take their full 17, that rises to
**194** — leaving only 14 weeks of slack in the whole year. A cap of 3 would be
mathematically impossible (156 available, 162 needed).

The four lottery weeks are handed out by a rotation that shifts each year instead of by
seniority, so the same people don't get Christmas every year. There are 16 lottery seats
for 18 people, so two people miss out each year — a different two annually.

---

## The five tabs

**Schedule** — the 52-week × 18-person grid. Click any square to add or remove a week.
Rule problems appear immediately in the panel on the right, with the offending week or
person highlighted. Buttons here also run auto-allocation, clear the schedule, and handle
backups.

**Employees** — pick anyone to see their weeks against their minimum and maximum, how
each week was won, and their request history. Also where an extra week is requested.

**Requests** — approve or deny extra-week requests. Approving a week that is already
full warns first, then lets you override; the breach then shows up like any other problem.

**Dashboard** — headline numbers, a bar chart of how many people are out each week
(against the cap), any current rule problems, and a table of the whole team.

**Self-checks** — see below.

---

## How the automatic schedule is built

Four passes, in order:

1. **Lottery** — the four holiday weeks, by yearly rotation.
2. **Summer** — the 11 summer weeks, drafted in seniority order. Rank 1 picks, then
   rank 2, and so on, wrapping around, so seniors get the best and the most.
3. **Fill to the minimum** — everyone reaches 9 weeks *before* anyone gets extras.
   This ordering is why nobody ends up short.
4. **Top up** — seniors climb toward their 17-week maximum with what's left.

The coverage cap is never broken to make the numbers fit. If someone genuinely cannot be
placed, they are reported as unresolved rather than silently breaking a rule.

---

## Instead of a test suite: the Self-checks tab

There's no test tool to install. The **Self-checks** tab runs 24 checks inside the app and
shows PASS or FAIL for each. They cover the calendar (52 weeks, 11 summer, 4 lottery),
each rule catching its own violation, one deliberately legal schedule coming back clean,
and the auto-allocator producing no errors.

**Open that tab after changing anything in `rules.js` or `employees.js`.** If a change
makes the rules impossible to satisfy, the checks are where it shows up.

---

## Changing the rules

Everything is in **`rules.js`**, one value per rule, with comments. Nothing is hardcoded
elsewhere. To change the team, edit the names in **`employees.js`** — the list is in
seniority order, most senior first.

Note that **rules are never saved to the browser**, on purpose. `rules.js` always wins, so
editing a number there takes effect on the next reload rather than being overridden by an
old saved copy.

Two rules are still undecided — see **`TODO.md`**.

---

## Saving your work

The schedule and all requests save to your browser automatically after every change, and
come back when you reopen the page. The grey text on the right of the toolbar tells you
whether that's working.

If it ever says saving is unavailable, the app keeps working normally — use **Export
backup** to save a file instead, and **Import backup** to load it again.

- **Export backup** — a `.json` file containing the schedule and all requests
- **Export for Excel** — a `.csv` with one row per employee, one column per week, and a
  "people out" tally row
- **Reset everything** — wipes the schedule, the requests, and the saved copy

---

## The files

| File | What it's for |
|---|---|
| `index.html` | the page |
| `style.css` | all the styling |
| `rules.js` | **every rule value — edit this one** |
| `employees.js` | **the 18 people — edit this one** |
| `calendar.js` | builds the 52 weeks and finds the holidays |
| `validate.js` | the single source of truth for whether a schedule is legal |
| `allocate.js` | builds a schedule automatically |
| `storage.js` | saving, plus backup and spreadsheet files |
| `selfcheck.js` | the 24 correctness checks |
| `app.js` | the screen and everything you click |

The scripts load as ordinary `<script>` tags rather than modern JavaScript modules,
because modules are blocked by browsers when a page is opened directly from disk. That's
what keeps double-click-to-open working.
