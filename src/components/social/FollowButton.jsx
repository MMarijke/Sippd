import { UserPlus, UserCheck, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyFollows, useFollowActions } from '@/hooks/useFollow';

export default function FollowButton({ targetUser, currentUser }) {
  const { data: follows = [] } = useMyFollows(currentUser?.id);
  const { followMutation, unfollowMutation } = useFollowActions(currentUser?.id);

  // useMyFollows already scopes to follower_id = currentUser.id, so no need
  // to re-check it here.
  const myFollow = follows.find(f => f.following_id === targetUser?.id);

  const isFollowing = myFollow?.status === 'accepted';
  const isPending = myFollow?.status === 'pending';

  if (!currentUser || currentUser.id === targetUser?.id) return null;

  if (isFollowing) {
    return (
      <Button
        size="sm"
        variant="outline"
        // group/unfollow + the span swap below make the label itself change
        // on hover/focus, not just the color — clicking "Following" deletes
        // the relationship, and a color-only hint was easy to miss
        // (/impeccable critique).
        className="group/unfollow h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:border-destructive/30 transition-colors"
        onClick={() => unfollowMutation.mutate(myFollow.id)}
        disabled={unfollowMutation.isPending}
      >
        <UserCheck className="w-3.5 h-3.5 group-hover/unfollow:hidden group-focus-visible/unfollow:hidden" />
        <X className="w-3.5 h-3.5 hidden group-hover/unfollow:block group-focus-visible/unfollow:block" />
        <span className="group-hover/unfollow:hidden group-focus-visible/unfollow:hidden">Following</span>
        <span className="hidden group-hover/unfollow:inline group-focus-visible/unfollow:inline">Unfollow</span>
      </Button>
    );
  }

  if (isPending) {
    return (
      <Button
        size="sm"
        variant="outline"
        // Was unconditionally disabled with no way to back out of a sent
        // request — cancelling is the same delete-my-own-row operation
        // unfollow already uses, RLS allows it regardless of status.
        // (/impeccable critique)
        className="group/cancel h-11 font-mono text-xs gap-1.5 border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:border-destructive/30 transition-colors"
        onClick={() => unfollowMutation.mutate(myFollow.id)}
        disabled={unfollowMutation.isPending}
      >
        <Clock className="w-3.5 h-3.5 group-hover/cancel:hidden group-focus-visible/cancel:hidden" />
        <X className="w-3.5 h-3.5 hidden group-hover/cancel:block group-focus-visible/cancel:block" />
        <span className="group-hover/cancel:hidden group-focus-visible/cancel:hidden">Requested</span>
        <span className="hidden group-hover/cancel:inline group-focus-visible/cancel:inline">Cancel</span>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => followMutation.mutate(targetUser.id)}
      disabled={followMutation.isPending}
    >
      <UserPlus className="w-3.5 h-3.5" />
      Follow
    </Button>
  );
}
