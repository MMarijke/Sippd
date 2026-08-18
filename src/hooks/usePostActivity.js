import { base44 } from '@/api/base44Client';

export async function postActivity({ user, type, can, achievementData, streakDays, isPrivate }) {
  const payload = {
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name || user.email,
    type,
    is_private_user: isPrivate || false,
  };

  if (can) {
    payload.can_id = can.id || can.can_id;
    payload.can_name = can.name || can.can_name;
    payload.can_image_url = can.image_url || can.can_image_url || '';
    payload.can_rarity = can.consensus_rarity || can.rarity || can.can_rarity || null;
  }

  if (achievementData) {
    payload.achievement_key = achievementData.key;
    payload.achievement_title = achievementData.title;
    payload.achievement_icon = achievementData.icon;
  }

  if (streakDays) {
    payload.streak_days = streakDays;
  }

  await base44.entities.ActivityItem.create(payload);
}