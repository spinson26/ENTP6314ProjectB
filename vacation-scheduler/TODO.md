# TODO — open decisions

Two scheduling rules aren't settled yet. The app runs fine in the meantime using the
placeholder values noted below. Each one is a **single value in `rules.js`** — changing it
requires no other code changes.

---

## 1. Which week is spring break?

Spring break is one of the 4 lottery weeks (assigned by rotation instead of seniority), so it
needs a date. Unlike Thanksgiving and Christmas, there's no rule the calendar can work out on
its own — it varies by school district and employer.

**Placeholder in use:** week 11 → **Mar 15–21, 2026**
**Where to change it:** `rules.js`, the `springBreakWeek` value

Options discussed:
- A fixed week number you set each year (what the placeholder does)
- Auto-calculate as the week of the 3rd Monday in March
- Auto-calculate as the week before Easter

---

## 2. How much summer priority does the senior tier get?

The 4 senior employees are supposed to get more summer than the other 14. What's undecided is
how much more, and by what mechanism.

**Placeholder in use:** `seniorSummerGuarantee: 0` — seniors simply pick first in strict
seniority order, with no fixed guarantee. They naturally get the best summer weeks, but the
actual gap depends on how many weeks each senior wants.

**Where to change it:** `rules.js`, the `seniorSummerGuarantee` value. Setting it to `4` means
each senior locks in at least 4 summer weeks before the other 14 get any summer allocation.

Context for the decision — there are **44 summer slots** total (11 summer weeks × the coverage
cap of 4) shared among 18 people. These are the **actual results** from running the allocator at
each setting:

| Setting | Senior summer avg | Staff summer avg | Staff range | Valid schedule? |
|---|---|---|---|---|
| **0** (current placeholder) | 3.0 | 2.3 | 2–3 | yes |
| 2 | 4.0 | 2.0 | 2–2 | yes |
| 4 | 6.0 | 1.4 | 1–2 | yes |
| 6 | 7.5 | 1.0 | 1–1 | yes |
| 8 | 9.0 | 0.6 | 0–1 | yes |

Every setting produces a legal schedule with no errors and nobody left unplaced, so this is
purely a fairness call, not a technical one.

**Worth knowing:** at the current placeholder of 0, the senior advantage is very thin — 3.0
summer weeks vs 2.3, and the four most senior *non*-senior staff also get 3. If the intent is
for the senior tier to be visibly better off in summer, 0 is probably too low.

---

## For you to check: does saving work when you double-click the file?

Automatic saving is confirmed working when the app is served from a local web server.
I could **not** verify it when opening `index.html` directly from File Explorer, because
Claude's preview pane converts local files into a form where browser storage is switched off
by design — that's a limitation of my testing tool, not of the app.

In normal Chrome or Edge, opening a local file this way usually does allow saving. **Please
confirm it yourself:** double-click `index.html`, make a change, press F5, and see whether the
change is still there.

The app tells you either way — look at the grey text on the right of the toolbar:
- *"Saved in this browser."* → saving is working
- *"This browser is not allowing saving…"* → use **Export backup** to keep your work in a file

Either way nothing breaks; worst case you save by file instead of automatically.

---

## Also worth confirming

- **Do the 4 lottery weeks count toward an employee's 9-week minimum?** The app currently
  assumes **yes** — they're vacation weeks like any other, just handed out differently. If they
  should be bonus weeks on top of the 9, that changes the capacity math.
