---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (chosen for Jonathan under his standing approval: experienced, asked for speed; `learner-profile.md > Collaboration and Communication Preferences`)

## Slices

- [x] **1. Wake now puts a stranger in the world**
  Becomes usable: On the title screen, ticking the box and pressing Wake now signs in a guest and drops a level 1 Human Vanguard into Lanternfield; reloading keeps the same guest and hero.
  Why now: This is the kernel (`scope.md > The Unique Kernel`). It crosses the database, both servers and the client, so the riskiest wiring is proven first.
  PRD ref: `prd.md > The Core Journey` (steps 1-4, 7), `prd.md > Waking as a guest`
  Spec ref: `spec.md > Guest rules (shared)`, `spec.md > Guest creation endpoint`, `spec.md > Client: Wake now`, `spec.md > Data Model`
  Build: Migration 0019 and its db.ts entry; shared/guest.ts; POST /api/guest on Node and the Worker (terms check, maintenance check, per-IP limit, guest account, generated hero, session); guest on /api/session and /api/me; the Wake now block on the title screen; straight into the world with the waking line.
  Verify (mechanical): tsc for both configs; a new tests/verify-guest.ts covering creation, the refused unticked box, the rate limit, the hero blueprint and reload as the same guest; cf-check schema parity; a GPU Chromium run that presses Wake now on a local build and lands in Lanternfield with no console errors.
  Learner check: Open the title screen, tick the box, press Wake now, and say whether being in the world that fast feels right.
  Commit: `Wake now: one click from the title screen into the world as a guest hero`

- [x] **2. Keep this hero**
  Becomes usable: A guest sees a small ribbon, names an account and password, gets the recovery code screen, and is now a normal account with the same hero.
  Why now: Keeping the hero is what turns a curious visitor into a player; it touches account code, so it comes right after the kernel while that code is fresh.
  PRD ref: `prd.md > The Core Journey` (steps 5-6), `prd.md > Keeping the hero`
  Spec ref: `spec.md > Keep this hero endpoint`, `spec.md > Client: ribbon, keep form, logout warning`
  Build: POST /api/account/keep on both servers with sign-up's rules; the ribbon and keep window; the recovery code screen on success; the ribbon disappears.
  Verify (mechanical): verify-guest.ts covers keep success, taken name, weak password, no keep for a non-guest, login with the new password, the hero unchanged; a browser run through the ribbon to the recovery code screen.
  Learner check: As a guest, press Keep this hero, pick a name and password, and confirm you can log in with them afterwards and your hero is the same.
  Commit: `Keep this hero: a guest names an account and keeps the character`

- [x] **3. Guest boundaries and cleanup**
  Becomes usable: Guests get one calm line at dungeon doors, the Group Finder, the Proving Grounds, codes, payments and extra characters; logging out as a guest asks first; guests idle for a day are removed; the admin dashboard counts guests apart.
  Why now: These protect cost and fairness; they only make sense once guests exist and can be kept.
  PRD ref: `prd.md > Playing as a guest`, `prd.md > Cleanup and limits`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Guest gates`, `spec.md > Guest sweep`, `spec.md > Admin count`
  Build: guestRefusal at the REST routes and world entry points with the mark carried into the world; the logout warning; the hourly sweep on Node and the Worker cron plus scheduled(); guests apart in admin stats.
  Verify (mechanical): verify-guest.ts covers each gate, the sweep removing only stale unkept guests, and the admin count; the full test suite (three shards) and npm run test:cf pass.
  Learner check: As a guest, try the Group Finder and a dungeon door, then log out, and say whether the messages read clearly.
  Commit: `Guest boundaries, logout warning, hourly cleanup and admin count`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1, on the local build (Jonathan is away; under his standing approval the agent performs this check in a real browser and records what it saw, and he reviews the recording in the morning)
  Performed by the agent under Jonathan's standing approval, 2026-10-20, in GPU headless Chromium (ANGLE Direct3D 11, Intel Iris Xe, the game chose Medium) against a production build served by vite preview with the Node server behind it. Seen: Wake now sits beside the sign-in form, which did not move; the button stays disabled until the 16+ box is ticked; one click shows the veil reading `You open your eyes...` over `In Lanternfield`, then the hero stands in Lanternfield facing Sister Orla's shrine with the `Getting around` card and the first quest tracked; W walks; no console errors; a reload opens the character screen with the same hero and the account shown as `Guest`. Click to control of the hero (`wake:click` to `veil:lift`): 14.0 s and 14.6 s cold at first, then 10.2 s, 10.5 s and 7.0 s after the agent made the box tick start fetching the game code and freed the title screen's spare 3D stage; the guest API answered in 51 to 408 ms. For comparison a normal account's Enter World took 12.1 s. Frame rate: 55 to 57 fps in the first 5 s while the arrival warm-ups run, 116 fps uncapped a few seconds later (62 for a normal account measured the same way). Feedback the agent acted on: the select screen showed the raw `guest_...` account name, now `Guest`. Shots: `.design/endgame/shots/wake-now/cold-1-title.jpg` to `cold-6-reload.jpg`.
- [ ] Final kick-the-tires exploration and feedback completed — on the live site after deploy
  Deployed 2026-10-20 as build 9860499 (migration 0019 applied on D1, the hourly cron registered). Agent smoke check on https://play.jonathansolvesproblems.com in GPU headless Chromium: Wake now made the guest Mara, a level 1 Human Vanguard standing in Lanternfield facing Sister Orla, with the `Playing as a guest · Keep this hero` ribbon top centre, the Getting around card and the first quest tracked; no console errors. Left unticked: this checkpoint is Jonathan's own exploration of the live site.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions
- Keep this hero leaves the terms version as stamped at Wake now instead of writing it again — the guest ticked the same 16+ and terms box to wake, so the stored acceptance is already the current one.
- On the character screen a guest's Account link reads Keep this hero and opens the same keep window — the account window offers a password change, a recovery code and deletion, all of which ask for a password a guest was never told.
- The logout warning lives on the character screen only, not on the in-world Log out — in the game Log out returns to the character screen with the session and the hero intact, so a warning there would claim a loss that does not happen; the character screen's Log out is the one that ends a guest for good.
- The admin dashboard counts live guests apart (a Guests now tile, and guests left out of Accounts and new accounts per day) but not guests kept in the last 30 days — nothing records when a guest was kept, so that count would need a new column for a number the PRD defers.
- On the character screen a guest's Create a new character and Proving Grounds buttons show the one guest line in a small window with Keep this hero, instead of opening the creator — the server refuses the new character anyway, and a guest should not design a hero only to be refused at the end.
- The Worker sweep is checked locally through a test hook (/api/test/sweep, only with TEST_HOOKS) that calls the same function as scheduled() — wrangler dev's /__scheduled endpoint needs its own bundling, and tests/cf-local.ts runs the prebuilt deploy bundle.
