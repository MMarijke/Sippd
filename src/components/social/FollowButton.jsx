import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, UserMinus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FollowButton({ targetUser, currentUser }) {
  const queryClient = useQueryClient();

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows', currentUser?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: currentUser.id }, '-created_date', 200),
    enabled: !!currentUser?.id,
  });

  const myFollow = follows.find(
    f => f.follower_id === currentUser?.id && f.following_id === targetUser?.id
  );

  const isFollowing = myFollow?.status === 'accepted';
  const isPending = myFollow?.status === 'pending';

  const followMutation = useMutation({
    mutationFn: async () => {
      const isPrivate = targetUser?.is_private;
      const status = isPrivate ? 'pending' : 'accepted';
      const follow = await base44.entities.Follow.create({
        follower_id: currentUser.id,
        follower_email: currentUser.email,
        follower_name: currentUser.full_name || currentUser.email,
        following_id: targetUser.id,
        following_email: targetUser.email,
        status,
      });

      // Notify target user
      await base44.entities.Notification.create({
        recipient_id: targetUser.id,
        recipient_email: targetUser.email,
        type: isPrivate ? 'follow_request' : 'new_follower',
        actor_name: currentUser.full_name || currentUser.email,
        actor_id: currentUser.id,
        follow_id: follow.id,
        is_read: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-follows'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Follow.delete(myFollow.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-follows'] });
    },
  });

  if (!currentUser || currentUser.id === targetUser?.id) return null;

  if (isFollowing) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
        onClick={() => unfollowMutation.mutate()}
        disabled={unfollowMutation.isPending}
      >
        <UserCheck className="w-3.5 h-3.5" />
        Following
      </Button>
    );
  }

  if (isPending) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="font-mono text-xs gap-1.5 border-border text-muted-foreground"
        disabled
      >
        <Clock className="w-3.5 h-3.5" />
        Requested
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => followMutation.mutate()}
      disabled={followMutation.isPending}
    >
      <UserPlus className="w-3.5 h-3.5" />
      Follow
    </Button>
  );
}