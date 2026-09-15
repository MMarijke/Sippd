import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

/**
 * The current user's own follows, scoped server-side to rows they're the
 * follower on. Was three separately-shaped inline queries (FollowButton,
 * FindCollectors, Feed) plus one unscoped `select('*')` fetch of the entire
 * table (PublicProfile) all sharing the exact same react-query cache key
 * ('my-follows', userId) — whichever shape ran last effectively decided
 * what every consumer of that key saw. One canonical, properly-scoped query.
 */
export function useMyFollows(userId) {
  return useQuery({
    queryKey: ['my-follows', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Follow/unfollow mutations. unfollowMutation is also used to cancel a
 * still-pending request — both are the same operation (delete my own row
 * by id), which follows_delete_own RLS already permits regardless of the
 * row's status.
 */
export function useFollowActions(currentUserId) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-follows', currentUserId] });

  const followMutation = useMutation({
    mutationFn: async (targetId) => {
      const { error } = await supabase.rpc('request_follow', { p_caller_id: currentUserId, p_target_id: targetId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message || 'Failed to follow'),
  });

  const unfollowMutation = useMutation({
    mutationFn: async (followRowId) => {
      const { error } = await supabase.from('follows').delete().eq('id', followRowId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message || 'Failed to unfollow'),
  });

  return { followMutation, unfollowMutation };
}
