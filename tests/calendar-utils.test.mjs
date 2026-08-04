import assert from "node:assert/strict";
import test from "node:test";
import { findScheduleConflict, mergeAvailability } from "../app/calendar-utils.mjs";

test("availability blocks merge only within the same day and week", () => {
  const merged = mergeAvailability([
    { id: "a", day: 2, week: 0, start: 10, end: 12 },
    { id: "b", day: 2, week: 0, start: 11, end: 14 },
    { id: "c", day: 2, week: 1, start: 11, end: 14 },
  ]);
  assert.deepEqual(merged.map(({ day, week, start, end }) => ({ day, week, start, end })), [
    { day: 2, week: 0, start: 10, end: 14 },
    { day: 2, week: 1, start: 11, end: 14 },
  ]);
});

test("schedule conflicts require a real overlap on the same day and week", () => {
  const events = [
    { id: "class", day: 2, week: 0, start: 16, end: 17.5 },
    { id: "joined-public", day: 2, week: 0, start: 18, end: 19 },
  ];
  assert.equal(findScheduleConflict({ day: 2, week: 0, start: 17, end: 18 }, events)?.id, "class");
  assert.equal(findScheduleConflict({ day: 2, week: 0, start: 17.5, end: 18 }, events), undefined);
  assert.equal(findScheduleConflict({ day: 2, week: 1, start: 16, end: 17 }, events), undefined);
  assert.equal(findScheduleConflict({ day: 2, week: 0, start: 18, end: 19 }, events, ["joined-public"]), undefined);
});
