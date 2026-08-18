import { base44 } from '@/api/base44Client';

const PREFS_KEY = 'canvolt_prefs';

function getLocalPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}

/**
 * After a user adds a rare/legendary/ultra-rare collected can,
 * fan-out notifications to all their accepted followers who have
 * the `notify_rare_follows` pref enabled on their device.
 *
 * Because we can't read other users' localStorage, we store the
 * preference on the user entity via updateMe so it's server-side.
 * This function reads the list of followers and creates a notification
 * for each one — they will only show in their Notifications page.
 */
export async function notifyFollowersOfRarePull({ user, canName, canBrand, canRarity, canId, canImageUrl }) {
  const RARE_RARITIES = ['Ultra Rare', 'Legendary'];
  if (!RARE_RARITIES.includes(canRarity)) return;

  // Fetch accepted followers of the current user (people who follow ME)
  const follows = await base44.entities.Follow.filter({ following_id: user.id, status: 'accepted' });
  if (!follows.length) return;

  // Fetch all users to check their notify_rare_follows preference
  const allUsers = await base44.entities.User.list();
  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

  const notifications = follows
    .map(f => userMap[f.follower_id])
    .filter(follower => follower && follower.notify_rare_follows)
    .map(follower => ({
      recipient_id: follower.id,
      type: 'rare_pull_follow',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      can_id: canId,
      can_name: canName,
      can_brand: canBrand,
      can_rarity: canRarity,
      can_image_url: canImageUrl,
      is_read: false,
    }));

  await Promise.all(notifications.map(n => base44.entities.Notification.create(n)));
}