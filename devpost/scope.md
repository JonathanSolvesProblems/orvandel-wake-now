---
doc: scope
status: approved
---

# Wake Now

One click on Orvandel's title screen puts a stranger inside the living world as a ready hero, with no account and no forms, so they "really feel the experience" in their first minute.

> How this plan was made: Jonathan set the goal in his own words ("i want them to really feel the experience") and asked the agent to propose the rest from his work and approve it. Decisions marked *(proposed for Jonathan)* were the agent's proposals, accepted at review.

## The Unique Kernel
Orvandel is a full MMO, and today a visitor has to make an account, save a recovery code and build a character before they see any of it. The kernel is **the first minute**: a single "Wake now" button that drops a guest into the world, already standing somewhere beautiful, already able to fight, so the world itself is the pitch. Nothing about the game changes; the door does.

## Who It's For
A Devpost judge with five minutes and a link, and the stranger who clicks the link from a Reddit post tomorrow. Both are deciding in the first minute whether this is worth their time. Today they meet a sign-up form first, and many will leave there.

## The Core Loop
Open the link, press "Wake now", watch a short waking moment, take control of a hero in the starting lands, walk, meet the first quest giver, fight. If they like it, keep the character by making an account in one step; if not, they leave and nothing of theirs is stored for long.

## Inspiration & Identity
The waking already in Orvandel's story: players are "Wakeborn", souls who open their eyes in a body that is already theirs. The guest moment should feel like that waking, dark painterly and calm, not like a demo mode. Same art direction as the rest of the game (Elden Ring mood made its own, fair and readable).

## Why This Matters to the Learner
"i want them to really feel the experience." He is about to show Orvandel to judges and first players, and the sign-up wall is the one thing standing between them and the game he built. His learning intention fits here too: a small, sharply planned slice on a large codebase is the cheapest way to spend agent tokens well.

## What "Working" Looks Like
From the live title screen: press "Wake now", tick the 16+ box, and within about twenty seconds the guest is controlling a hero in Lanternfield, can walk to Sister Orla, accept the first quest and fight a boar. The "oh, that's cool" beat: no form, no password, and you are already standing in the lantern light. Then "Keep this hero" turns the guest into a real account with a name and password, character intact. *(proposed for Jonathan)*

## The POC Boundary
- "Wake now" on the title screen, with the existing 16+ and terms checkbox.
- The server makes a guest account and one ready character (a showcase race and class), signs the guest in, and drops them into the starting zone.
- Guests can play the normal game.
- "Keep this hero": set a name and password and keep the character.
- Guests that are never kept are removed after a while, and guest creation is rate-limited.
- Works on both backends (Node and the Cloudflare Worker), with tests.

## Later
- Letting the guest pick their race and class before waking.
- A guided "judge's tour" straight into a dungeon or the raid (judges already have the access code and the Proving Grounds for that).
- Measuring how many guests keep their hero (the admin dashboard is the place for it).

## Explicitly Cut
- **Skipping the 16+ and terms checkbox**: the law and the game's own terms require it, guest or not.
- **A separate "demo build" or scripted cutscene**: it would show a fake game; the point is the real one.
- **Guests in dungeons, the raid or the Proving Grounds**: keeps abuse and cost small; real accounts get those.
