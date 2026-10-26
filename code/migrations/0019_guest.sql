-- Mirrors server/db.ts migration 19 (2026-10-20 Wake now): a guest account is a normal account with this mark and a
-- password nobody is told. 1 from the moment Wake now makes it, 0 once the guest keeps the hero by naming the account.
-- Guests never kept and not played for a day are deleted by the hourly sweep (shared/guest.ts GUEST_STALE_MS).
ALTER TABLE accounts ADD COLUMN guest INTEGER NOT NULL DEFAULT 0;
