import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RarityBadge from '@/components/shared/RarityBadge';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { getStreakIcon } from '@/lib/streakIcon';
import ProBadge from '@/components/shared/ProBadge';

const EMOJI_MAP = { fire: '🔥', star: '⭐', wow: '😮' };

// Card-level rarity treatment for can_added/rarity_voted — mirrors
// RarityBadge.jsx's own config exactly: the same theme-invariant
// --rarity-* tokens, the same --glow-intensity-scaled .rarity-glow-*
// classes from index.css, and the same Common/Uncommon-stay-glow-free
// rule. A Legendary pull in the Feed now reads as visually related to
// that same pull's badge everywhere else in the app, not a coincidentally
// similar color invented independently. (/impeccable critique: every
// activity type previously shared one undifferentiated card shell.)
const CARD_RARITY_STYLES = {
  'Rare': 'border-rarity-rare/30 rarity-glow-rare',
  'Ultra Rare': 'border-rarity-ultra/30 rarity-glow-ultra',
  'Legendary': 'border-rarity-legendary/40 bg-rarity-legendary/5 rarity-glow-legendary',
};

export default function ActivityCard({ item, user, myReactionSet, onReact, isPro = false }) {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();

  const timeAgo = item.created_at
    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
    : '';

  const openProfile = (e) => {
    e.stopPropagation();
    // find user id — stored in user_id field
    if (item.user_id) navigate(`/u/${item.user_id}`);
  };

  const isCanEvent = item.type === 'can_added' || item.type === 'rarity_voted';
  const cardRarityClass = isCanEvent ? CARD_RARITY_STYLES[item.can_rarity] : null;

  // Escalates at the achievement system's own real thresholds
  // (achievements.js: streak_7 unlocks at 7 days, streak_30 — icon 💥,
  // not 🔥 — at 30) rather than an invented scale, so "30 days" reads as
  // the same kind of milestone here as it does on the Achievements page.
  const isMajorStreak = item.type === 'streak_milestone' && item.streak_days >= 30;

  const hasReacted = ['fire', 'star', 'wow'].some(emoji => myReactionSet?.has(`${item.id}:${emoji}`));

  const renderAction = () => {
    switch (item.type) {
      case 'can_added':
        return (
          <span className="text-foreground">
            added <span className="font-semibold">{item.can_name}</span> to their vault
          </span>
        );
      case 'rarity_voted':
        return (
          <span className="text-foreground">
            voted <RarityBadge rarity={item.can_rarity} size="sm" className="mx-0.5 inline-flex" /> on <span className="font-semibold">{item.can_name}</span>
          </span>
        );
      case 'achievement_unlocked':
        // achievement_icon already renders once in the header's icon box
        // below — repeating it here read as an oversight, not a choice,
        // in an already-sparse card (/impeccable critique).
        return (
          <span className="text-foreground">
            unlocked the <span className="font-semibold">{item.achievement_title}</span> achievement
          </span>
        );
      case 'streak_milestone':
        return (
          <span className="text-foreground">
            {getStreakIcon(item.streak_days)} reached a <span className="font-semibold">{item.streak_days} day</span> streak
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('bg-card border border-border rounded-2xl p-4 space-y-3 transition-colors', cardRarityClass)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={openProfile}
          aria-label={`View ${item.user_name || 'Collector'}'s profile`}
          className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 p-0 flex-shrink-0 text-sm font-display font-bold text-primary hover:bg-primary/20"
        >
          {item.user_name?.[0]?.toUpperCase() || '?'}
        </Button>
        <div className="flex-1 min-w-0">
          <button onClick={openProfile} className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
            {item.user_name || 'Collector'}
            {isPro && <ProBadge />}
          </button>
          <p className="text-2xs font-mono text-muted-foreground">{timeAgo}</p>
        </div>

        {/* Can thumbnail */}
        {isCanEvent && item.can_image_url && (
          <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
            <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </div>
        )}
        {isCanEvent && !item.can_image_url && (
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-muted-foreground/30" />
          </div>
        )}
        {item.type === 'achievement_unlocked' && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xl">
            {item.achievement_icon || '🏆'}
          </div>
        )}
        {/* Streak badge — previously this activity type had no third header
            element at all, just plain text, making a real retention
            milestone the visually weakest card in the feed. Shows the day
            count itself (not another flame — the sentence already carries
            one) so nothing repeats. */}
        {item.type === 'streak_milestone' && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl bg-primary/10 border flex items-center justify-center flex-shrink-0',
              isMajorStreak ? 'border-primary/40 neon-glow' : 'border-primary/20'
            )}
          >
            <span className="text-sm font-display font-black text-primary leading-none tabular-nums">
              {item.streak_days}
            </span>
          </div>
        )}
      </div>

      {/* Action text */}
      <p className="text-sm font-mono text-muted-foreground leading-relaxed">
        {renderAction()}
      </p>

      {/* Rarity badge for can_added */}
      {item.type === 'can_added' && (
        <div className="flex items-center justify-between">
          {item.can_rarity ? (
            <RarityBadge rarity={item.can_rarity} />
          ) : (
            <span className="text-2xs font-mono text-muted-foreground border border-border rounded px-2 py-0.5">? ? ?</span>
          )}
        </div>
      )}

      {/* Reaction row */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        {['fire', 'star', 'wow'].map(emoji => {
          const count = emoji === 'fire' ? item.reactions_fire : emoji === 'star' ? item.reactions_star : item.reactions_wow;
          const reacted = myReactionSet?.has(`${item.id}:${emoji}`);
          return (
            // The tap-scale + count pop below are this page's one authored
            // motion moment (/impeccable critique: Feed and ActivityCard
            // were the only two core-loop files with zero motion-library
            // imports) — reacting to a friend's pull is the Feed's one
            // direct, repeated interaction, so it's the one place motion
            // earns its keep here rather than being added everywhere.
            <motion.div key={emoji} whileTap={reducedMotion || (hasReacted && !reacted) ? undefined : { scale: 0.88 }}>
              <Button
                variant="ghost"
                onClick={() => onReact(item, emoji)}
                disabled={hasReacted && !reacted}
                aria-label={
                  reacted
                    ? `You reacted ${emoji} — locked, can't be removed${count > 0 ? ` (${count} total)` : ''}`
                    : hasReacted
                    ? `${emoji} unavailable — you already reacted to this post`
                    : `React ${emoji}${count > 0 ? `, ${count} reactions` : ''}`
                }
                aria-pressed={reacted}
                className={cn(
                  'h-11 min-w-11 px-2.5 gap-1 rounded-full text-xs font-mono border transition-all',
                  reacted
                    ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary'
                    : hasReacted
                    ? 'bg-secondary border-border text-muted-foreground/40 opacity-50'
                    : 'bg-secondary border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
                )}
              >
                {EMOJI_MAP[emoji]}{' '}
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={reducedMotion ? false : { scale: 1.5, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="inline-block tabular-nums"
                  >
                    {count}
                  </motion.span>
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Only shown once the viewer has actually reacted — matching how
          AddCanForm's own "You voted: X · vote locked" note only appears
          after a vote is cast, not before. A persistent warning repeated
          on every card in a scrolling feed (the way the pre-vote "Vote
          locks once cast" caption works for a single, one-time control)
          would be real clutter here; this answers "why won't this
          un-tap?" exactly when it becomes the relevant question, not
          before. Wording previously said "Reactions lock in once cast,"
          which reads as "this specific reaction can't be undone" — the
          actual rule is "only one reaction total per post," which is why
          the other two buttons are disabled above, not just this one
          (/impeccable critique). */}
      {hasReacted && (
        <p className="text-2xs font-mono text-muted-foreground -mt-1">
          One reaction per post — choose carefully.
        </p>
      )}
    </div>
  );
}
