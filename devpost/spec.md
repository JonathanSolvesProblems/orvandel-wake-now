---
doc: spec
status: approved
---

# Wake Now — Technical Spec

> Approval: Jonathan gave standing approval for the remaining planning documents while away ("assume looks good always, answer on my behave as going to sleep i trust you", `learner-profile.md > Areas Where the Learner Wants Ownership`). The technical choices below are the agent's recommendations, built on Orvandel's existing architecture, accepted under that approval.

## How This Works, In Plain Language
A guest is just a normal Orvandel account with a "guest" mark and no password anyone knows. Pressing Wake now asks the server to make one: it creates the account, gives it one ready character, signs the browser in with the usual session cookie, and the game enters the world exactly as it does for anyone else. Because a guest *is* an account, every existing system (saving, chat, quests, the world servers) works unchanged. Keeping the hero means filling in the name and password that a normal sign-up would have asked for; the mark comes off and nothing else changes. A small set of doors (dungeons, the raid, the Proving Grounds, codes, payments, extra characters) check the mark and say "keep your hero first". Once an hour, guests nobody has played for a day are deleted with the same deletion code the "Delete my account" button already uses.

Why this shape: a separate "guest mode" with its own save rules would double every system; marking an account touches a handful of entry points and nothing in the game loop.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. Title screen: the Wake now block (its own 16+ checkbox) calls `api.guest(acceptTerms)`.
2. Server `POST /api/guest`: refuse if logins are closed (maintenance) or the box is unticked, rate-limit by IP, create a guest account and a Human Vanguard in the Concord, start a session, return `{ account: { id, username, guest: true }, character }`.
3. Client shows the waking line on the loading veil and calls `enterWorld(character)` directly, skipping the select screen.
4. World: normal join. The player record carries `guest: true` from the account, the same way it carries membership.
5. HUD: the Keep this hero ribbon appears while `account.guest` is true.
6. Keep: `POST /api/account/keep { username, password }` checks the guest session and the same rules as sign-up, sets the name, password hash and a recovery code, clears the guest mark, and returns `{ account, recoveryCode }`. The client shows the existing recovery code screen, then hides the ribbon.
7. Return visit: `/api/session` reports `guest: true`, so the select screen lists the guest's hero and the ribbon shows again in the world.

## Stack
Unchanged: TypeScript, Vite 7 client, Node server on node:sqlite, Cloudflare Worker with Durable Objects and D1 (production). Docs: https://developers.cloudflare.com/workers/ , https://developers.cloudflare.com/d1/ , https://developers.cloudflare.com/workers/configuration/cron-triggers/ . New dependency: none.

## Where It Runs and How Someone Tries It
Live at https://play.jonathansolvesproblems.com (Cloudflare). Locally: `npx tsx server/index.ts` with `DB_FILE=tmp/dev.db`, and `npx vite --config client/vite.config.ts --port 5200`, then open http://localhost:5200 and press Wake now. Demo recording: the live site in a fresh browser window. Submission needs the short demo video and the repository; the live site is the optional extra.

## Look and Feel
Implements `prd.md > Look and Feel`. Reuse the title screen's existing classes and tokens (the `.tl-enter` button style for Wake now, `.tl-terms` for the checkbox, the game window style for the keep form, the `.site-notice` banner pattern for the ribbon). Copy: plain and calm, no exclamation marks, no em dashes; the waking line in the Wakeborn voice. No new fonts or colours.

## Components

### Guest rules (shared)
`shared/guest.ts`: the guest character blueprint (Concord, Human, Vanguard, random body type, generated name), the one refusal line ("Keep your hero first: name an account to go here."), the 24-hour stale window, and `isGuestName`. PRD ref: `prd.md > Waking as a guest`, `prd.md > Playing as a guest`.

### Guest creation endpoint
`POST /api/guest` on Node (`server/api.ts`, `server/auth.ts`) and the Worker (`worker/index.ts`, `worker/auth.ts` AuthDO). Username `guest_` plus 10 random base32 characters (fits `USERNAME_RE`). Password hash: a random secret nobody is told, hashed as usual, so login with it is impossible in practice. No recovery code at creation. Character name: `randomName('human')`, retried against `nameTaken`/`lookalike`, with a letter suffix fallback that still passes `NAME_RE`. Rate limit: 3 guests per IP per hour, stricter than sign-up. PRD ref: `prd.md > Waking as a guest`, `prd.md > Cleanup and limits`.

### Keep this hero endpoint
`POST /api/account/keep` on both backends: guest session required, `validateCredentials` and the name-taken check exactly as register, then update username, password hash and recovery hash, and clear the guest mark (the terms stamped at Wake now stay); return the recovery code once. Rate-limited with the auth limiter. PRD ref: `prd.md > Keeping the hero`.

### Guest gates
One check, `guestRefusal(guest)`, at: `/api/characters` POST, `/api/proving/characters`, `/api/account/redeem`, `/api/billing/checkout` and `/portal`, and in the world at `enterDungeon`/dungeon doors, `queueJoin` and `provingGate`. The world learns the mark from the account at join, alongside membership (`CharacterStore` on Node and D1), and `World` updates live players when a guest is kept. PRD ref: `prd.md > Playing as a guest`.

### Guest sweep
Deletes guests whose characters have not been played for 24 hours (and whose account is older than 24 hours), using `accountDeleteStatements`. Node: inside the existing minute timer in `server/auth.ts`, at most once an hour, skipping anyone online. Worker: a new hourly cron trigger in `wrangler.toml` and a `scheduled()` handler in `worker/index.ts`; anyone stale is by definition offline. PRD ref: `prd.md > Cleanup and limits`.

### Client: Wake now
`client/src/screens/login.ts`: the Wake now block with its own checkbox (disabled button until ticked), error line, and the call. `client/src/main.ts`: on success, enter the world directly with the waking line on the veil. `client/src/net/api.ts`: `guest()` and `keep()`. PRD ref: `prd.md > Waking as a guest`, `prd.md > States and Boundaries`.

### Client: ribbon, keep form, logout warning
`client/src/guest-ribbon.ts` (new): the persistent ribbon while the session is a guest, opening the keep window; on success it shows `showRecoveryCode` from `client/src/screens/recovery.ts`, then removes itself. The in-world Log out only returns to the character screen (the session and the hero stay), so it asks nothing; the select screen's log out, which ends the session, asks first for guests (Keep / Log out anyway), and its Account link reads Keep this hero for a guest and opens the same window. PRD ref: `prd.md > Keeping the hero`, `prd.md > States and Boundaries`.

### Admin count
`server/admin-rules.ts`: real accounts (and new accounts per day) exclude guests; a separate count of live guests, shown as a Guests now tile. Kept guests are not counted apart: nothing records when a guest was kept, and adding that is not cheap. PRD ref: `prd.md > Cleanup and limits`.

## Data Model
- `accounts.guest INTEGER NOT NULL DEFAULT 0` in migration `migrations/0019_guest.sql` and the matching entry in `server/db.ts` `MIGRATIONS`. Set to 1 at creation, 0 when kept.
- Staleness reads the existing `characters.last_played` and `accounts.created_at`. No other new data.
- `/api/session` and `/api/me` include `guest` on the account object; exports include it.

## File Structure
```
migrations/0019_guest.sql        guest flag on accounts
shared/guest.ts                  blueprint, refusal line, stale window, name helpers
server/api.ts                    /api/guest, /api/account/keep, gates on REST routes
server/auth.ts                   createGuest(), keepGuest(), hourly sweep in the minute timer
server/db.ts                     migration entry, accounts.setGuest/keep, stale-guest query
server/admin-rules.ts            guests counted apart from accounts
server/world/world.ts            guest gate at dungeon doors, queue and Proving
server/app.ts                    CharacterStore exposes the guest mark
worker/index.ts                  the two routes, gates, scheduled() sweep
worker/auth.ts                   AuthDO guest creation and keep (rate limit per IP)
worker/d1.ts                     D1 twins of the db.ts additions
wrangler.toml                    [triggers] crons = ["17 * * * *"]
client/src/net/api.ts            guest(), keep()
client/src/screens/login.ts      Wake now block
client/src/main.ts               straight into the world for a new guest
client/src/guest-ribbon.ts       ribbon and keep window (new)
client/src/screens/select.ts     guest logout warning, Keep this hero link, the guest line at Create
tests/verify-guest.ts            the PRD's acceptance criteria (new)
tests/cf-check.ts, cf-local.ts   Worker parity and an end-to-end guest run
```

## External Services and Dependencies
None new. Cloudflare cron triggers are included in the Workers plan already in use (docs above).

## Important Failure Modes
- **Guest creation refused** (rate limit, maintenance) → the title screen shows one plain line; the sign-in form still works.
- **Keep fails** (name taken, weak password) → the same message sign-up shows; the guest stays a guest, nothing lost.
- **Sweep races a returning guest** → the sweep only takes guests idle for 24 hours and skips anyone online on Node; on the Worker a guest returning in that same minute gets a fresh "session expired" and can wake again.

## What Was Simplified and Why
- **One fixed hero (Human Vanguard)** instead of a race and class choice — the PRD defers the choice; one hero keeps the first minute to a single click.
- **A random secret password** instead of a passwordless account type — keeps every login path unchanged.
- **Hourly sweep** instead of exact 24-hour expiry — cheap and good enough.

## Decisions and Open Issues
- Guest = marked normal account (agent recommendation, accepted under standing approval). Tradeoff: guest rows live in the real tables for up to a day; the sweep and the admin count handle that.
- Learner uncertainty, from his learning intention ("quality outputs in AI while minimizing token usage ... for large scale projects"): how to keep an agent's work cheap on a 500-commit codebase. Clarified by how this plan was made: one read-only mapping pass produced the file list above (about 137k tokens), so the build agent starts with exact entry points instead of exploring. The build will record its own token use so the wrap-up can compare a planned slice against earlier unplanned feature passes in this project (which ran 300k to 800k tokens each).
- Open: none blocking.
