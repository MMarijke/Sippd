// Shared by ActivityCard.jsx (Feed) and FeedPreview.jsx (dashboard) so a
// streak_milestone activity gets the same escalation in both places. Was
// only implemented on ActivityCard — FeedPreview rendered every streak with
// a hardcoded 🔥 regardless of length, so the identical 30-day milestone
// read as a big neon deal on Feed and a throwaway line on the dashboard
// (/impeccable critique). Threshold matches achievements.js's real
// streak_30 unlock point (goal: 30, icon: '💥').
export function getStreakIcon(streakDays) {
  return streakDays >= 30 ? '💥' : '🔥';
}
