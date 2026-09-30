import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useNotifications(user) {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['my-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Real-time: refetch whenever a Notification record is created for this user.
  // Requires `notifications` to be added to the supabase_realtime publication —
  // see supabase/migrations/20260819000000_slice2_prereqs.sql.
  //
  // The channel name is unique per hook instance. supabase.channel(name)
  // hands back an existing channel with the same name, and calling .on()
  // on one that's already joined throws ("cannot add postgres_changes
  // callbacks ... after subscribe()"). Every PageHeader runs this hook, so a
  // shared name let one page's header pick up the previous page's
  // still-joined channel during navigation, and the throw took down the
  // whole app ("Something went wrong").
  const instanceId = useId();
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, instanceId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  return { notifications, unreadCount };
}
