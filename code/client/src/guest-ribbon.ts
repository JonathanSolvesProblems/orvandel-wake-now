// Keep this hero (shared/guest.ts): while the session is a guest, a small ribbon at the top of the world opens a short
// window that names the account (sign-up's rules and messages). On success the one-time recovery code screen follows,
// then the ribbon goes for good. The hero is not touched: the account only gains a name, a password and a code.
import { api } from './net/api';
import type { AccountInfo } from '../../shared/protocol';
import { showRecoveryCode } from './screens/recovery';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Opens the keep window over the page. `heroName` is said in the lede; `onKept` runs once the recovery code is saved.
 * `onClose` runs when the window is closed without keeping.
 */
export function openKeepWindow(heroName: string, onKept: (acc: AccountInfo) => void, onClose?: () => void): void {
  const veil = document.createElement('div');
  veil.className = 'modal-veil guest-veil';
  veil.innerHTML = `
    <div class="modal stone guest-keep" role="dialog" aria-modal="true" aria-labelledby="keep-title">
      <h2 id="keep-title" class="display">Keep this hero</h2>
      <p class="guest-keep-lede">Name an account and set a password. ${heroName ? `<b>${esc(heroName)}</b> stays` : 'Your hero stays'} exactly as they are, here and now.</p>
      <form novalidate>
        <label class="tl-field"><span>Account name</span><input name="username" autocomplete="username" maxlength="20" spellcheck="false" /></label>
        <label class="tl-field"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="8" /></label>
        <p class="tl-hint">3 to 20 letters, numbers or underscores. Passwords need at least 8 characters.</p>
        <p class="form-error" role="alert" aria-live="assertive"></p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" data-close>Not now</button>
          <button type="submit" class="btn-primary" data-keep>Keep this hero</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(veil);
  const form = veil.querySelector('form')!;
  const err = veil.querySelector<HTMLElement>('.form-error')!;
  const go = veil.querySelector<HTMLButtonElement>('[data-keep]')!;
  const field = (n: string) => veil.querySelector<HTMLInputElement>(`input[name=${n}]`)!;
  const close = () => { veil.remove(); onClose?.(); };
  veil.querySelector('[data-close]')!.addEventListener('click', close);
  // Keys typed here belong to the form, not to the game's bindings underneath; Escape closes the window.
  veil.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && !veil.querySelector('.rc-veil')) close(); });
  veil.addEventListener('keyup', (e) => e.stopPropagation());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = field('username').value.trim();
    const password = field('password').value;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { err.textContent = 'Account names are 3 to 20 letters, numbers or underscores.'; return; }
    if (password.length < 8) { err.textContent = 'Passwords need at least 8 characters.'; return; }
    err.textContent = '';
    go.disabled = true;
    go.classList.add('busy');
    try {
      const res = await api.keep(username, password);
      field('password').value = '';
      veil.querySelector<HTMLElement>('.guest-keep')!.hidden = true;
      veil.classList.add('guest-veil-clear'); // the recovery screen brings its own shade
      showRecoveryCode(veil, res.recoveryCode, {
        username: res.account.username,
        heading: 'Your hero is kept',
        lede: `The account ${res.account.username} is yours now. There is no email on an account here, so this recovery code is the only way back in if you forget your password. It is shown once. Save it now.`,
        doneLabel: 'Back to the world',
        onDone: () => { veil.remove(); onKept(res.account); },
      });
    } catch (ex: any) {
      err.textContent = ex?.message ?? 'Something went wrong.';
    } finally {
      go.disabled = false;
      go.classList.remove('busy');
    }
  });
  window.setTimeout(() => field('username').focus(), 0);
}

/** The ribbon at the top of the world while the session is a guest. Returns a remover. */
export function mountGuestRibbon(parent: HTMLElement, heroName: string, onKept: (acc: AccountInfo) => void): () => void {
  const el = document.createElement('div');
  el.className = 'guest-ribbon';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Guest');
  el.innerHTML = `<span class="guest-ribbon-text">Playing as a guest</span><button type="button" class="guest-ribbon-keep">Keep this hero</button>`;
  parent.appendChild(el);
  const btn = el.querySelector<HTMLButtonElement>('button')!;
  // Pointer presses here are the ribbon's, not a camera drag in the world underneath.
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', () => {
    btn.blur();
    openKeepWindow(heroName, (acc) => { el.remove(); onKept(acc); });
  });
  return () => el.remove();
}
