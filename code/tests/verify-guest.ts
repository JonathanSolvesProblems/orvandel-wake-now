// Wake now (shared/guest.ts) on the Node server, on the virtual clock (so the hourly limit is exact).
// Covers: a guest made with one click (the 16+ box required), its hero (a level 1 Human Vanguard in Lanternfield with a
// valid, unique name and a random body type), the session it gets and keeps across a reload, the secret password never
// returned and no recovery code, the per-address limit of 3 an hour (and the hour ending), refusal while the realm is
// closed, the CSRF check, and the reserved guest_ prefix for sign-up. Keep this hero (sign-up's rules and messages, the
// same session and hero after). The guest's doors (more characters, the Proving Grounds, access codes, payments, dungeon
// doors, the Group Finder) and their opening live once kept; the hourly sweep (only stale, unkept, offline guests, at most
// once an hour); and the admin dashboard counting guests apart.
// Run: npx tsx tests/verify-guest.ts
import { endProcess } from './exit';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { installVirtualClock } from './vclock';
import { allowPerHour } from '../server/site-rules';
import { GUEST_LIMITED, GUEST_PER_HOUR, GUEST_REFUSED, guestNameCandidates, guestUsername, isGuestName } from '../shared/guest';
import { validateName } from '../shared/appearance';
import { ZONES, doorsInto } from '../shared/zones';
import { USERNAME_RE } from '../server/auth-rules';
import type { ServerMsg } from '../shared/protocol';
import type { Connection } from '../server/world/entities';

installVirtualClock(4242);
// The test names the client address itself, so every phase has its own IP and its own limits.
process.env.TRUST_PROXY = '1';
const { startServer } = await import('../server/app');
const { accounts, adminSql, characters, site } = await import('../server/db');
const { maybeSweepGuests, sweepGuests } = await import('../server/auth');
const { adminStats } = await import('../server/admin-rules');

const DB = resolve(`tmp/guest-${process.pid}.db`);
let failures = 0;
const check = (ok: boolean, text: string) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); };

const srv = await startServer({ port: 0, dbFile: DB });
const base = `http://localhost:${srv.port}`;
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const send = () => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  // Advancing the virtual clock fires the server's socket timers, which can drop a kept-alive connection: try once more.
  const r = await send().catch(() => send());
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, json, text, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] };
}
let ipN = 0;
const freshIp = () => `10.7.${Math.floor(++ipN / 250)}.${ipN % 250}`;
const from = (ip: string, cookie = '') => ({ 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) });
const wake = (ip: string, acceptTerms: unknown = true, extra: Record<string, string> = {}) => call('POST', '/api/guest', { acceptTerms }, { ...from(ip), ...extra });

// ---------- The rules ----------
const names = Array.from({ length: 50 }, (_, i) => guestUsername(new Uint8Array(Array.from({ length: 10 }, (_, j) => (i * 31 + j * 7) & 255))));
check(names.every((n) => USERNAME_RE.test(n) && n.length === 16 && isGuestName(n)), 'guest account names fit the account name rule and carry the guest_ prefix');
check(new Set(Array.from({ length: 200 }, () => guestUsername())).size === 200, 'random guest account names do not repeat');
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const cands = Array.from({ length: 40 }, () => guestNameCandidates(rnd)).flat();
check(cands.every((n) => validateName(n) === null), `every candidate hero name passes the name rule (${cands.slice(0, 8).join(', ')}, ...)`);
check(GUEST_PER_HOUR === 3 && GUEST_REFUSED.length > 0 && !/[\u2013\u2014!]/.test(GUEST_REFUSED + GUEST_LIMITED), 'three guests an hour; the lines have no dashes or exclamation marks');

// ---------- Wake now: one click, a guest, its hero and a session ----------
const ipA = freshIp();
const unticked = await wake(ipA, false);
check(unticked.status === 400 && /16 or older/.test(unticked.json?.error ?? '') && !unticked.cookie, 'without the 16+ box ticked no guest is made and no session is given');
check((await wake(ipA, 'yes')).status === 400, 'only a real tick counts (a string is not true)');
const a = await wake(ipA);
check(a.status === 201 && a.json?.account?.guest === true && isGuestName(a.json?.account?.username) && !!a.cookie, `Wake now answers 201 with a guest account and a session (${a.json?.account?.username})`);
check(!('recoveryCode' in (a.json ?? {})) && !/password|pass_hash|secret|scrypt/i.test(a.text), 'the answer carries no password, hash or recovery code');
const hero = a.json?.character;
check(hero?.race === 'human' && hero?.cls === 'vanguard' && hero?.faction === 'concord' && hero?.level === 1, 'the hero is a level 1 Human Vanguard of the Concord');
check(ZONES[hero?.zone]?.name === 'Lanternfield', `and stands in Lanternfield (${hero?.zone})`);
check(validateName(hero?.name ?? '') === null && characters.nameTaken(hero.name), `its name is valid and stored (${hero?.name})`);
check(hero?.appearance?.bodyType === 0 || hero?.appearance?.bodyType === 1, 'its body type is one of the two');
const rec = accounts.byName(a.json.account.username)!;
check(rec.guest === true && rec.passHash.startsWith('scrypt$') && rec.recoveryHash === '', 'stored: the guest mark, a hashed secret password, no recovery code');
check((await call('POST', '/api/login', { username: rec.username, password: '' }, from(freshIp()))).status === 401, 'the guest account cannot be signed into without its secret');

// Reloading the page: the same cookie is the same guest with the same hero.
const ses = await call('GET', '/api/session', undefined, from(ipA, a.cookie));
check(ses.status === 200 && ses.json?.account?.id === a.json.account.id && ses.json.account.guest === true, 'reloading: /api/session says the same guest');
const me = await call('GET', '/api/me', undefined, from(ipA, a.cookie));
check(me.status === 200 && me.json?.account?.guest === true, '/api/me marks the account as a guest');
const list = await call('GET', '/api/characters', undefined, from(ipA, a.cookie));
check(list.status === 200 && list.json?.characters?.length === 1 && list.json.characters[0].id === hero.id && list.json.characters[0].name === hero.name, 'and its one hero is listed');
const exp = await call('GET', '/api/account/export', undefined, from(ipA, a.cookie));
check(exp.json?.account?.guest === true && !/scrypt|pass/i.test(exp.text), 'the export says it is a guest, with no hash');

// A named account is not marked.
const named = await call('POST', '/api/register', { username: 'wakerofnone', password: 'a long password', acceptTerms: true }, from(freshIp()));
const namedSes = await call('GET', '/api/session', undefined, from(freshIp(), named.cookie));
check(named.status === 201 && !('guest' in named.json.account) && !('guest' in namedSes.json.account), 'a normal account carries no guest mark');
check((await call('POST', '/api/register', { username: 'guest_mine', password: 'a long password', acceptTerms: true }, from(freshIp()))).json?.error === 'Account names cannot start with guest_.', 'sign-up cannot take a guest_ name');

// Many guests: every hero gets its own name.
const heroNames = new Set<string>([hero.name]);
for (let i = 0; i < 12; i++) {
  const g = await wake(freshIp());
  if (g.status === 201) heroNames.add(g.json.character.name);
}
check(heroNames.size === 13, `thirteen guests, thirteen different hero names (${[...heroNames].slice(0, 6).join(', ')}, ...)`);

// ---------- Keep this hero: the guest names the account ----------
const ipK = freshIp();
const k = await wake(ipK);
const kc = k.cookie;
const kHero = k.json.character;
const keep = (body: Record<string, unknown>, cookie = kc, extra: Record<string, string> = {}) => call('POST', '/api/account/keep', body, { ...from(ipK, cookie), ...extra });
const signUpTaken = await call('POST', '/api/register', { username: 'wakerofnone', password: 'a long password', acceptTerms: true }, from(freshIp()));
const keptTaken = await keep({ username: 'WakerOfNone', password: 'a long password' });
check(keptTaken.status === 409 && keptTaken.json?.error === signUpTaken.json?.error, `a taken name gets sign-up's own message (${keptTaken.json?.error})`);
const signUpWeak = await call('POST', '/api/register', { username: 'weakling', password: 'short', acceptTerms: true }, from(freshIp()));
const keptWeak = await keep({ username: 'brandnewname', password: 'short' });
check(keptWeak.status === 400 && keptWeak.json?.error === signUpWeak.json?.error, `a weak password gets sign-up's own message (${keptWeak.json?.error})`);
check((await keep({ username: 'bad name!', password: 'a long password' })).status === 400 && (await keep({ username: 'guest_again', password: 'a long password' })).status === 400, 'a malformed name or a guest_ name is refused');
check(accounts.byId(k.json.account.id)?.guest === true && accounts.byId(k.json.account.id)?.username === k.json.account.username, 'after each refusal nothing changed: still the same guest');
check((await keep({ username: 'brandnewname', password: 'a long password' }, '')).status === 401, 'keeping needs a session');
check((await keep({ username: 'brandnewname', password: 'a long password' }, named.cookie)).json?.error === 'This account already has a name.', 'a named account cannot keep');
check((await keep({ username: 'brandnewname', password: 'a long password' }, kc, { Origin: 'https://evil.example' })).status === 403, 'a keep from another site is refused');
const kept = await keep({ username: 'Brandnewname', password: 'a kept password' });
check(kept.status === 200 && kept.json?.account?.username === 'Brandnewname' && !('guest' in kept.json.account) && /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/.test(kept.json?.recoveryCode ?? ''), 'keeping answers with the named account and a recovery code, shown once');
check(!/a kept password|scrypt/.test(kept.text), 'the answer carries no password or hash');
const keptRec = accounts.byName('brandnewname')!;
check(keptRec.id === k.json.account.id && keptRec.guest === false && keptRec.recoveryHash.startsWith('scrypt$') && keptRec.recoveryAt > 0, 'stored: the same account, no guest mark, a hashed recovery code');
const keptSes = await call('GET', '/api/session', undefined, from(ipK, kc));
check(keptSes.json?.account?.username === 'Brandnewname' && !('guest' in keptSes.json.account), 'the same session goes on as the named account');
const keptList = await call('GET', '/api/characters', undefined, from(ipK, kc));
const same = keptList.json?.characters?.[0];
check(keptList.json?.characters?.length === 1 && same.id === kHero.id && same.name === kHero.name && same.level === kHero.level && JSON.stringify(same.appearance) === JSON.stringify(kHero.appearance), 'the hero is unchanged');
check((await call('POST', '/api/login', { username: 'brandnewname', password: 'a kept password' }, from(freshIp()))).status === 200, 'logging in with the new name and password works');
check((await keep({ username: 'othername', password: 'a long password' })).json?.error === 'This account already has a name.', 'keeping twice is refused');
check((await call('GET', '/api/me', undefined, from(ipK, kc))).json?.recovery?.exists === true, 'the account window sees a recovery code');

// ---------- Limits: 3 an hour per address, stricter than sign-up ----------
const ipL = freshIp();
const byIp: number[] = [];
for (let i = 0; i < 5; i++) byIp.push((await wake(ipL)).status);
check(byIp.slice(0, 3).every((s) => s === 201) && byIp[3] === 429 && byIp[4] === 429, `one address makes 3 guests, then 429 (${byIp.join(',')})`);
check((await wake(ipL)).json?.error === GUEST_LIMITED, 'with one plain line');
check((await call('POST', '/api/register', { username: 'stilltheycan', password: 'a long password', acceptTerms: true }, from(ipL))).status === 201, 'the limited address can still make a named account');
check((await wake(freshIp())).status === 201, 'another address is not limited');
// The window itself, on the counter both backends use (server/site-rules.ts allowPerHour), at explicit times: advancing the
// virtual clock by an hour would run the whole world for an hour.
const hits = new Map<string, number[]>();
const t0 = 1_900_000_000_000;
const tries = [0, 1, 2, 3].map((i) => allowPerHour(hits, 'ip', GUEST_PER_HOUR, t0 + i * 1000));
check(tries.join() === 'true,true,true,false', `the counter allows 3 then refuses (${tries.join()})`);
check(!allowPerHour(hits, 'ip', GUEST_PER_HOUR, t0 + 10 * 60_000), 'ten minutes later it is still limited (the window is an hour, not the five minutes of sign-up)');
check(allowPerHour(hits, 'ip', GUEST_PER_HOUR, t0 + 3600_000 + 1000), 'after the hour it can wake again');

// ---------- The guest's doors: one calm line at each, open once the hero is kept ----------
const ipD = freshIp();
const d = await wake(ipD);
const dc = d.cookie;
const asGuest = (method: string, path: string, body?: unknown) => call(method, path, body, from(ipD, dc));
const refusedLine = (r: { status: number; json: any }) => r.status === 403 && r.json?.error === GUEST_REFUSED;
check(refusedLine(await asGuest('POST', '/api/characters', { name: 'Secondwake', faction: 'concord', race: 'human', cls: 'vanguard' })), 'a guest cannot make a second character');
check(refusedLine(await asGuest('POST', '/api/proving/characters', { name: 'Provewake', faction: 'concord', race: 'human', cls: 'vanguard' })), 'nor a Proving Grounds character');
check(refusedLine(await asGuest('POST', '/api/account/redeem', { code: 'ANY-CODE' })), 'nor redeem an access code');
check(refusedLine(await asGuest('POST', '/api/billing/checkout', {})) && refusedLine(await asGuest('POST', '/api/billing/portal', {})), 'nor start a payment or open the billing portal');
check((await call('POST', '/api/characters', { name: 'Namedwake', faction: 'concord', race: 'human', cls: 'vanguard' }, from(freshIp(), named.cookie))).status === 201, 'a named account still makes characters as before');

class Ear implements Connection {
  got: ServerMsg[] = []; closed = '';
  send(m: ServerMsg) { this.got.push(m); }
  close(r?: string) { this.closed = r ?? 'closed'; }
}
const world = srv.world;
const errorsOf = (ear: Ear) => ear.got.filter((m) => m.t === 'error').map((m) => (m as { text: string }).text);
const dEar = new Ear();
const dp = world.join(dEar, d.json.account.id, d.json.character.id);
if (typeof dp === 'string') throw new Error(dp);
check(dp.guest === true && dp.zone.id === 'lanternfield', 'the guest\'s hero joins the world carrying the guest mark');
const door = doorsInto('unrung-chapel')[0];
const atDoor = () => {
  if (dp.zone.id !== door.zone.id) world.transfer(dp, door.zone.id, { x: door.door.x, z: door.door.z, ry: 0 });
  dp.x = door.door.x; dp.z = door.door.z; dp.y = dp.zone.groundY(dp.x, dp.z); dp.arrivedAt = 0; dp.atDoor = null;
};
atDoor();
dEar.got.length = 0;
world.handle(dp, { t: 'dungeon', op: 'enter', story: true });
check(!dp.zone.instance && errorsOf(dEar).includes(GUEST_REFUSED), `a dungeon door gives the guest the one line (${errorsOf(dEar).join('|')})`);
dEar.got.length = 0;
world.handle(dp, { t: 'queue', op: 'join', dungeons: ['unrung-chapel'], roles: ['damage'] });
check(errorsOf(dEar).includes(GUEST_REFUSED) && !dEar.got.some((m) => m.t === 'queueState' && (m as { state?: string }).state === 'queued'), 'so does the Group Finder');
dEar.got.length = 0;
world.handle(dp, { t: 'proving', op: 'tutorial', action: 'start' });
check(errorsOf(dEar).includes(GUEST_REFUSED), 'and the Proving Grounds');
const raid = doorsInto('heart-of-vael')[0];
check(!!raid && world.membershipRefusal(dp, raid.door.dungeon) === GUEST_REFUSED && world.membershipRefusal(dp, 'lanternfield') === null, 'the raid is a dungeon like the rest; the open lands stay open');
// Kept while playing: the doors open at once.
const keptLive = await call('POST', '/api/account/keep', { username: 'Doorkeeper', password: 'a door password' }, from(ipD, dc));
check(keptLive.status === 200 && dp.guest === false, 'keeping the hero while it plays lifts the mark at once');
atDoor();
dEar.got.length = 0;
world.handle(dp, { t: 'dungeon', op: 'enter', story: true });
check(!errorsOf(dEar).includes(GUEST_REFUSED), `and the door no longer gives the guest line (${dp.zone.instance ? 'went in' : errorsOf(dEar).join('|') || 'no error'})`);
check((await call('POST', '/api/characters', { name: 'Keptsecond', faction: 'concord', race: 'human', cls: 'vanguard' }, from(ipD, dc))).status === 201, 'and a second character can be made');
world.leave(dp);

// ---------- The hourly sweep: stale, unkept, offline guests only ----------
const s1 = await wake(freshIp()); // left alone for a day: swept
const s2 = await wake(freshIp()); // played recently: stays
const s3 = await wake(freshIp()); // kept: stays
const s4 = await wake(freshIp()); // online right now: stays
await call('POST', '/api/account/keep', { username: 'Sweptnot', password: 'a long password' }, from(freshIp(), s3.cookie));
const sEar = new Ear();
const sp = world.join(sEar, s4.json.account.id, s4.json.character.id);
if (typeof sp === 'string') throw new Error(sp);
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
const peek = new DatabaseSync(DB);
const later = Date.now() + 25 * 3600_000;
peek.prepare('UPDATE characters SET last_played = ? WHERE id = ?').run(later - 2 * 3600_000, s2.json.character.id);
const exists = (id: number) => !!accounts.byId(id);
const s1Hero = s1.json.character.id;
const gone = sweepGuests(later);
check(gone.includes(s1.json.account.id) && !exists(s1.json.account.id) && !characters.get(s1Hero), 'a guest nobody played for a day is deleted, with its hero');
check(Number((peek.prepare('SELECT COUNT(*) AS n FROM sessions WHERE account_id = ?').get(s1.json.account.id) as { n: number }).n) === 0, 'and its session');
check((await call('GET', '/api/session', undefined, from(freshIp(), s1.cookie))).json?.account === null, 'its old cookie signs in nobody');
check(exists(s2.json.account.id) && !gone.includes(s2.json.account.id), 'a guest played within the day stays');
check(exists(s3.json.account.id) && accounts.byId(s3.json.account.id)?.guest === false, 'a kept hero stays');
check(exists(s4.json.account.id) && !gone.includes(s4.json.account.id), 'a guest playing right now is skipped');
check(exists(named.json.account.id), 'named accounts are never touched');
world.leave(sp);
const first = maybeSweepGuests(later);
const tooSoon = maybeSweepGuests(later + 10 * 60_000);
const hourOn = maybeSweepGuests(later + 61 * 60_000);
check(Array.isArray(first) && tooSoon === null && Array.isArray(hourOn), 'the minute timer sweeps at most once an hour');
check(!!first?.includes(s4.json.account.id) && !exists(s4.json.account.id), 'once offline and still stale, the skipped guest goes on the next sweep');

// ---------- The admin dashboard counts guests apart ----------
const counts = peek.prepare('SELECT SUM(guest = 1) AS g, SUM(guest = 0) AS a FROM accounts').get() as { g: number; a: number };
const stats = await adminStats(adminSql, { total: 0, zones: [] });
check(stats.growth.guests === Number(counts.g) && stats.growth.accounts === Number(counts.a) && Number(counts.g) > 0, `accounts (${stats.growth.accounts}) and guests now (${stats.growth.guests}) are counted apart`);
check(stats.growth.newAccounts.reduce((s, x) => s + x.n, 0) === Number(counts.a), 'and new guests do not count as new accounts');
peek.close();

// ---------- Closed for maintenance, and the CSRF check ----------
site.setFlag('closed', '1');
const closed = await wake(freshIp());
check(closed.status === 503 && /maintenance/.test(closed.json?.error ?? ''), 'no guests while the realm is closed for maintenance');
site.setFlag('closed', '0');
check((await wake(freshIp(), true, { Origin: 'https://evil.example' })).status === 403, 'a Wake now from another site is refused');
check((await wake(freshIp(), true, { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'and so is one the browser marks cross-site');
check((await wake(freshIp(), true, { Origin: base })).status === 201, 'the game\'s own page may');

await srv.stop();
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) rmSync(f, { force: true });
console.log(failures ? `${failures} FAILED` : 'guest checks passed');
await endProcess(failures ? 1 : 0);
