import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useNotifications(user) {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['my-notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  // Real-time: refetch whenever a Notification record is created/updated
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (
        event.type === 'create' &&
        event.data?.recipient_id === user.id
      ) {
        queryClient.invalidateQueries({ queryKey: ['my-notifications', user.id] });
      }
    });
    return unsubscribe;
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  return { notifications, unreadCount };
}