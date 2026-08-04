/**
 * Merge touching or overlapping availability blocks on the same day and week.
 * @template {{ id: string, day: number, start: number, end: number, week?: number }} T
 * @param {T[]} slots
 * @returns {T[]}
 */
export function mergeAvailability(slots) {
  return [...slots]
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || a.day - b.day || a.start - b.start)
    .reduce((merged, slot) => {
      const previous = merged.at(-1);
      if (previous && (previous.week ?? 0) === (slot.week ?? 0) && previous.day === slot.day && slot.start <= previous.end) {
        previous.end = Math.max(previous.end, slot.end);
      } else {
        merged.push({ ...slot });
      }
      return merged;
    }, /** @type {T[]} */ ([]));
}
