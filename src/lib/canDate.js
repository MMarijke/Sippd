// When a collector got a can: the date they gave ("Date added" in the add
// and edit forms, user_collection.acquired_on), or else when they logged
// it in the app. Used wherever the collection is shown or ordered by date:
// Haul and crate sorting, a can's own page, the monthly report, Home's
// Recent row.
//
// Deliberately NOT used for scoring or time-boxed stats (points this week,
// streaks, achievement unlock dates): those stay on created_at, so
// backdating a can can't move them.
export function acquiredAt(item) {
  if (item?.acquired_on) return new Date(`${item.acquired_on}T12:00:00`);
  return item?.created_at ? new Date(item.created_at) : null;
}

// Newest first by acquiredAt; items with no date sort last.
export function byAcquiredDesc(a, b) {
  return (acquiredAt(b)?.getTime() ?? -Infinity) - (acquiredAt(a)?.getTime() ?? -Infinity);
}
