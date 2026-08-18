import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Clock } from 'lucide-react';

export default function FollowButton({ targetUser, currentUser }) {
  const queryClient = useQueryClient();

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const myFollow = follows.find(
    f => f.follower_id === currentUser?.id && f.following_id === targetUser?.id
  );

  const isFollowing = myFollow?.status === 'accepted';
  const isPending = myFollow?.status === 'pending';

  const followMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('request_follow', { p_target_id: targetUser.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-follows'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('follows').delete().eq('id', myFollow.id);
      if (error) throw error;
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
