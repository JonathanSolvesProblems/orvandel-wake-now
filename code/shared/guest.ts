// Wake now: a visitor plays at once as a guest, a normal account with a guest mark and a password nobody is told.
// The rules shared by the Node server, the Cloudflare Worker and the client. Pure: no storage, no Node built-ins.
import { randomAppearance } from './appearance';
import { RACES } from './lore';

/** Every guest account name starts with this, and no other account may (auth-rules.ts validateCredentials). */
export const GUEST_PREFIX = 'guest_';
/** Guests one address may make per hour: stricter than sign-up (10 attempts per 5 minutes). GUEST_RATE_LIMIT overrides it. */
export const GUEST_PER_HOUR = 3;
/** A guest never kept is deleted once none of its characters has been played for this long (and the account is as old). */
export const GUEST_STALE_MS = 24 * 3600_000;
/** How often the sweep looks for stale guests. */
export const GUEST_SWEEP_EVERY_MS = 3600_000;

/** The one line a guest meets at every door kept for named accounts. */
export const GUEST_REFUSED = 'Keep your hero first: name an account to go here.';
export const GUEST_LIMITED = 'Too many guests from this address. Try again in an hour, or make an account.';
export const GUEST_FAILED = 'The realm could not make a guest right now. Try again in a moment.';
export const GUEST_NAME_RESERVED = 'Account names cannot start with guest_.';
/** Keep this hero asked of an account that is not a guest. */
export const NOT_A_GUEST = 'This account already has a name.';

/** The hero every guest wakes as: a Human Vanguard of the Concord, who starts in Lanternfield. */
export const GUEST_HERO = { faction: 'concord', race: 'human', cls: 'vanguard' } as const;

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** guest_ and 10 random base32 letters and digits: fits the account name rule (3 to 20 letters, digits or underscores). */
export function guestUsername(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(10))): string {
  let s = GUEST_PREFIX;
  for (let i = 0; i < 10; i++) s += BASE32[bytes[i % bytes.length] & 31];
  return s;
}

/** A secret password for a new guest. It is hashed like any password and never told to anyone, logged or returned. */
export function guestSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

export function isGuestName(username: unknown): boolean {
  return typeof username === 'string' && username.toLowerCase().startsWith(GUEST_PREFIX);
}

/** The refusal a gate shows a guest, or null for a named account. */
export function guestRefusal(guest: boolean | undefined): string | null {
  return guest ? GUEST_REFUSED : null;
}

// Syllables in the sound of the Concord's own names (shared/lore.ts human names), for when those few names are taken.
const HEADS = ['Al', 'Ma', 'To', 'E', 'Cor', 'Sa', 'Ro', 'I', 'Da', 'Lu', 'Bren', 'Ha', 'Ce', 'Ves', 'Ori', 'Wil', 'Ca', 'Mer'];
const JOINS = ['r', 'l', 'n', 'v', 's', 'm', 'd', 'th', 'b'];
const VOWELS = ['a', 'e', 'i', 'o'];
const TAILS = ['ic', 'a', 'in', 'ise', 'ine', 'an', 'en', 'el', 'is', 'or', 'yn', 'eth', 'ard', 'ia', 'ric', 'win'];

/**
 * Names to try for a guest's hero, in order: one of the Concord's human names first, then made ones from the same sounds,
 * longer towards the end of the list so a crowded realm still finds a free one. Each passes the name rule
 * (shared/appearance.ts validateName: 3 to 16 letters, a capital first).
 */
export function guestNameCandidates(rnd: () => number = Math.random, n = 8): string[] {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const human = RACES.human.names.first;
  const out = [pick(human)];
  while (out.length < n) {
    const long = out.length >= n / 2;
    const name = pick(HEADS) + pick(JOINS) + (long ? pick(VOWELS) + pick(JOINS) : '') + pick(TAILS);
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** The create-character body for a guest's hero with this name: the fixed people and calling, a random look. */
export function guestBlueprint(name: string, rnd: () => number = Math.random): Record<string, unknown> {
  return { name, ...GUEST_HERO, appearance: randomAppearance(GUEST_HERO.race, rnd) };
}

/** The line on the loading veil while a guest wakes (the Wakeborn open their eyes in a body already theirs). */
export const WAKING_LINE = 'You open your eyes';
