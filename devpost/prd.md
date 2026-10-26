---
doc: prd
status: approved
---

# Wake Now — Product Requirements

A one-click way into Orvandel for a judge or a first-time visitor: press "Wake now" on the title screen and play a ready hero within seconds, then keep that hero by naming an account. Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

> Jonathan set the goal and approved this document; the agent proposed the specifics at his request (`learner-profile.md > Collaboration and Communication Preferences`).

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The visitor opens the title screen. Beside the sign-in form, a prominent **Wake now** button reads "Play as a guest. No account needed."
2. Pressing it shows the same 16+ and terms checkbox the sign-up form uses, right under the button. The button stays disabled until it is ticked.
3. Pressing **Wake now** again shows a short waking line ("You open your eyes...") on the existing loading veil, while the game makes a guest and a ready hero.
4. The visitor arrives in Lanternfield as a level 1 Human Vanguard, facing Sister Orla, with the normal first-time "Getting around" card. They play the real game: walk, talk, take the first quest, fight.
5. A small, persistent **Keep this hero** ribbon sits at the top of the screen.
6. Pressing it opens a short form: account name and password. Submitting turns the guest into a full account with the same hero, then shows the usual one-time recovery code screen.
7. If the visitor leaves without keeping the hero, they can come back on the same browser and continue as the same guest until the guest is cleaned up.

## Screens and Layout
- **Title screen**: one new button and line next to the existing sign-in form. Nothing else on the title screen moves.
- **In the world**: one new ribbon, top centre, small, never covering the hero or the action bar.
- **Keep this hero**: a small window in the game's existing window style, two fields and a button. Then the existing recovery code screen.

## Look and Feel
Carry Orvandel's existing look: the same fonts, colours and window style as the title screen and game windows, and the Wakeborn tone ("You open your eyes"). Copy is plain and calm, with no exclamation marks and no em dashes. The guest flow must not look like a separate demo mode. Source: `scope.md > Inspiration & Identity`.

## Features and Behavior

### Waking as a guest
- As a judge with five minutes, I want to be in the game with one click so that I see the world before I decide anything.
  - [ ] From the live title screen, ticking the box and pressing Wake now lands the visitor in control of a hero in Lanternfield, with no form to fill in.
  - [ ] The hero is a level 1 Human Vanguard with a generated, valid, unique name in Orvandel's style, and a randomly chosen body type.
  - [ ] The visitor is signed in as a guest; reloading the page keeps them signed in as the same guest with the same hero.

### Playing as a guest
- As a guest, I want the normal game so that what I feel is the real experience.
  - [ ] Questing, fighting, looting, the map, the character sheet, chat and grouping work as for any account.
  - [ ] Guests cannot enter dungeons, the raid or the Proving Grounds, redeem an access code, subscribe, or create more characters; each shows one calm line saying the hero must be kept first.

### Keeping the hero
- As a guest who likes it, I want to keep my hero without starting over so that my first minutes count.
  - [ ] The ribbon's form takes an account name and a password, with the same rules and messages as sign-up.
  - [ ] On success the guest becomes a normal account, the hero is unchanged, the ribbon disappears, and the one-time recovery code screen appears.
  - [ ] A taken name or a weak password shows the same error a normal sign-up shows, and nothing changes.

### Cleanup and limits
- As the owner, I want guests not to pile up so that the game stays cheap and tidy.
  - [ ] A guest that was never kept and has not played for 24 hours is removed, with its hero.
  - [ ] Making guests is rate-limited per visitor address, more strictly than sign-up.
  - [ ] Guests count separately from real accounts on the admin dashboard.

## States and Boundaries
- **First use** — Wake now, then the existing first-time hints in the world.
- **Returning guest** — the title screen shows their guest hero on the character screen with Enter World, plus the Keep this hero ribbon in the world.
- **Leaving as a guest** — logging out as a guest warns that the hero will be lost unless kept, with Keep and Log out anyway.
- **Error** — if the guest cannot be made (rate limit or the server is closed for maintenance), the title screen shows one plain line and the sign-in form still works.
- **Persistence** — a kept hero is permanent like any account. An unkept guest lasts 24 hours after its last play.

## Product Decisions
- Human Vanguard in Lanternfield *(proposed for Jonathan)* — the Concord start has the most polished first quest and the best-looking hero, and the Vanguard's shield and sword make the first fight read clearly.
- Keep the 16+ checkbox — required by law and the game's terms, guest or not (`scope.md > Explicitly Cut`).
- Guests stay out of dungeons, the raid and the Proving Grounds — keeps abuse and cost small; judges have the access code for those.
- 24 hours for unkept guests *(proposed for Jonathan)* — long enough to come back later the same day, short enough that abandoned guests do not accumulate.

## What We're Building
Everything under `Features and Behavior` and `States and Boundaries`, on both servers (the Node dev server and the live Cloudflare Worker), with tests, shipped to the live site.

## Deferred From the POC
- Choosing race and class before waking.
- A guided judge tour into a dungeon or the raid.
- Measuring how many guests keep their hero.
