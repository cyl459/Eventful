import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete seven-day calendar", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    assert.match(html, new RegExp(`<b>${day}<\\/b>`));
  }
  assert.match(html, />My Events</);
  assert.match(html, />＋ Create event</);
  assert.match(html, /<small>Create<\/small>/);
});

test("includes interactive filters, friends, interests, and profile settings", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const calendar = await readFile(new URL("../app/data/calendar.json", import.meta.url), "utf8");
  const notifications = await readFile(new URL("../app/data/notifications.json", import.meta.url), "utf8");
  assert.match(page, /type="range"/);
  assert.match(page, /availabilityOnly/);
  assert.match(page, /onPointerMove=\{drag\}/);
  assert.match(page, /Add as Friend/);
  assert.match(page, /Remove friend/);
  assert.match(page, /interest-editor/);
  assert.match(page, /SettingsModal/);
  assert.match(page, /Compare availability/);
  assert.match(page, /drag-selection/);
  assert.match(page, /current-time/);
  assert.match(page, /Display summary/);
  assert.match(page, /name="interests"/);
  assert.match(page, /Remove .*\?/);
  assert.match(page, /delete-notification/);
  assert.match(page, /Edit event/);
  assert.match(page, /SearchableInterestPicker/);
  assert.match(page, /Create community/);
  assert.match(page, /toggleCommunity/);
  assert.match(page, /invitedCommunityIds/);
  assert.match(page, /Community invitations sent/);
  assert.match(page, /selectedPerson \? setSelectedPerson\(null\)/);
  assert.match(page, /pointerEvents: privatePlan \? "none"/);
  assert.match(page, /`calendar-\$\{event\.id\}` === showEventSheet\.id/);
  assert.match(page, /Location <small>Optional<\/small>/);
  assert.match(page, /addAvailabilitySlot\(slotChoice\)/);
  assert.match(page, /2 · Invite friends/);
  assert.match(page, /Public community/);
  assert.match(page, /CommunityDetail/);
  assert.match(page, /Edit community/);
  assert.match(page, /Preview sign-up flow/);
  assert.match(page, /setShowSignup\(false\)/);
  assert.match(page, /showSignup \?/);
  assert.match(page, /Continue with Google/);
  assert.match(page, /Continue with Apple/);
  assert.match(page, /Confirm password/);
  assert.match(page, /Confirm your .* email/);
  assert.doesNotMatch(page, /Linked email/);
  assert.doesNotMatch(page, />Confirm email</);
  assert.match(page, /provider-popup/);
  assert.match(page, /Search interests/);
  assert.match(page, /Add custom/);
  assert.match(page, /Date.UTC\(2026, 7, 3\)/);
  assert.match(page, /today\.week === weekOffset && day\.index === today\.day/);
  assert.match(page, /recurring && <label>Recurrence/);
  assert.match(page, /Account & login/);
  assert.match(page, /Save login changes/);
  assert.match(page, /Log out/);
  assert.match(page, /Delete account/);
  assert.match(page, /function SignInFlow/);
  assert.match(page, /showSignin \?/);
  assert.match(page, />✓ Accept</);
  assert.match(page, />Decline</);
  assert.match(page, />Decide later</);
  assert.match(page, /response === "accepted"/);
  assert.match(page, /event\.id !== "lunch"/);
  assert.match(page, /notificationSeed\.find/);
  assert.match(css, /scrollbar-gutter: stable/);
  assert.match(css, /week-scroll::\-webkit-scrollbar-thumb/);
  assert.doesNotMatch(calendar, /"id": "lunch"/);
  assert.match(notifications, /"category": "invite"/);
  assert.match(notifications, /"response": "pending"/);
  assert.match(page, /Compare friends/);
  assert.match(page, /aria-pressed=\{compareIds\.includes/);
  assert.match(page, /overlayFriendIds\.flatMap/);
  assert.match(page, /setCalendarCompareIds/);
  assert.match(css, /\.compare-friend-list/);
  assert.match(page, /if \(id === "erin"\)/);
  assert.match(page, /navigate\("profile"\)/);
  assert.match(page, /function makePlanWith/);
  assert.match(page, /setPrivateInviteIds\(\[id\]\)/);
  assert.match(page, /onClick=\{onMakePlan\}>Make a plan with/);
});
