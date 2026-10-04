// Decides how newly unlocked achievements are announced.
//
// Unlocks are tracked per device (localStorage), so a new phone or cleared
// site data used to replay every achievement already earned as a chain of
// full-screen pop-ups on the landing screen, and re-post each to the feed.
// A brand-new collector also starts with nothing stored, so "nothing
// stored" can't mean "new device" on its own: `initialized` marks a device
// that has evaluated achievements at least once.
//
//   catch-up (first evaluation on this device finds some already earned):
//     one summary note, no feed posts (they were posted when earned)
//   several unlocked at once on a known device: one summary note, posted
//   one earned just now: the full pop-up, posted
export function planUnlocks(achievements, seenKeys, initialized) {
  const fresh = (achievements || []).filter(a => a.unlocked && !seenKeys.has(a.key));
  if (fresh.length === 0) return { fresh, animate: [], summary: [], post: [] };
  if (!initialized) return { fresh, animate: [], summary: fresh, post: [] };
  if (fresh.length > 1) return { fresh, animate: [], summary: fresh, post: fresh };
  return { fresh, animate: fresh, summary: [], post: fresh };
}

// "6 achievements unlocked" / description naming the first few.
export function summaryText(list) {
  const n = list.length;
  const title = `${n} achievement${n === 1 ? '' : 's'} unlocked`;
  const names = list.map(a => a.title || a.name).filter(Boolean);
  const description = names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  return { title, description };
}
