import assert from "node:assert/strict";
import test from "node:test";
import { mergeAvailability } from "../app/calendar-utils.mjs";

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
