// Central deployment settings with safe defaults for the local MVP.

// Shared mailbox: calendar organiser and fallback recipient for team
// reminders when a workshop has no verantwortlich intern (SPEC §5/§6).
export const SERVICE_EMAIL = (
  process.env.HUB_SERVICE_EMAIL ?? "service@dbrains.academy"
).toLowerCase();

// Sending mailbox for every hub mail (SPEC §7). Final address still open.
export const ABSENDER_EMAIL = (
  process.env.HUB_ABSENDER_EMAIL ?? "trainer@dbrains.academy"
).toLowerCase();

export const HUB_URL = process.env.AUTH_URL ?? "http://localhost:3000";

// Test login (choose a role instead of Microsoft/magic link). On in local
// development; on a server only behind the Coolify password (SPEC §8 stage 2).
export function istTestLoginAktiv(): boolean {
  if (process.env.HUB_TEST_LOGIN === "true") return true;
  if (process.env.HUB_TEST_LOGIN === "false") return false;
  return process.env.NODE_ENV === "development";
}
