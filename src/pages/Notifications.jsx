import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft, Check, X, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
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

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
    onError: (error) => {
      toast.error('Failed to mark notifications read: ' + (error.message || 'Unknown error'));
    },
  });

  const handleFollowRequest = useMutation({
    mutationFn: async ({ notif, accept }) => {
      const { error } = accept
        ? await supabase.rpc('accept_follow_request', { p_caller_id: user.id, p_follow_id: notif.follow_id })
        : await supabase.rpc('deny_follow_request', { p_caller_id: user.id, p_follow_id: notif.follow_id });
      if (error) throw error;
    },
    onSuccess: (_, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-follows'] });
      toast.success(accept ? 'Follow request accepted' : 'Follow request denied');
    },
    onError: (error) => {
      toast.error('Failed to respond to follow request: ' + (error.message || 'Unknown error'));
    },
  });

  const handleTradeRequest = useMutation({
    mutationFn: async ({ notif, accept }) => {
      const { error } = await supabase.rpc('respond_to_trade_request', {
        p_caller_id: user.id,
        p_notification_id: notif.id,
        p_accept: accept,
      });
      if (error) throw error;
    },
    onSuccess: (_, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      toast.success(accept ? 'Trade accepted' : 'Trade declined');
    },
    onError: (error) => {
      toast.error('Failed to respond to trade request: ' + (error.message || 'Unknown error'));
    },
  });

  const getLabel = (n) => {
    switch (n.type) {
      case 'new_follower': return `${n.actor_name} started following you`;
      case 'follow_request': return `${n.actor_name} wants to follow you`;
      case 'reaction': return `${n.actor_name} reacted ${n.emoji === 'fire' ? '🔥' : n.emoji === 'star' ? '⭐' : '😮'} to your ${n.can_name} addition`;
      case 'can_rated': return `${n.can_name} has been rated ${n.can_rarity} by the community`;
      case 'can_confirmed': return `${n.can_name} is now community verified as ${n.can_rarity}`;
      case 'trade_request': return `${n.actor_name} wants to trade — offering ${n.trade_offer_can_name} for your ${n.trade_want_can_name}`;
      case 'trade_response': return `${n.actor_name} ${n.trade_response_text} your trade request for ${n.trade_want_can_name}`;
      case 'trade_status_update': return `Trade updated to ${n.trade_new_status}: ${n.trade_offer_can_name} ↔ ${n.trade_want_can_name}`;
      case 'rare_pull_follow': return `🔥 ${n.actor_name} just pulled a ${n.can_rarity} — ${n.can_name}${n.can_brand ? ` by ${n.can_brand}` : ''}`;
      default: return 'New notification';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="text-base font-display font-bold text-foreground tracking-wide">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" className="font-mono text-xs gap-1.5 text-muted-foreground" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 px-8 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm font-mono text-muted-foreground">No notifications yet — start collecting and following other collectors!</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notifications.map(n => (
            <div key={n.id} className={cn('px-5 py-4 transition-colors', !n.is_read && 'bg-primary/5')}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-display font-bold text-primary">
                  {n.actor_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{getLabel(n)}</p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                    {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                  </p>

                  {n.type === 'trade_request' && !n.trade_status && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => handleTradeRequest.mutate({ notif: n, accept: true })}
                      >
                        <Check className="w-3 h-3 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 font-mono text-xs border-border text-muted-foreground"
                        onClick={() => handleTradeRequest.mutate({ notif: n, accept: false })}
                      >
                        <X className="w-3 h-3 mr-1" /> Decline
                      </Button>
                    </div>
                  )}
                  {n.type === 'trade_request' && n.trade_status && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {n.trade_status === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                      {n.trade_message && ` · "${n.trade_message}"`}
                    </span>
                  )}

                  {n.type === 'follow_request' && !n.follow_status && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => handleFollowRequest.mutate({ notif: n, accept: true })}
                      >
                        <Check className="w-3 h-3 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 font-mono text-xs border-border text-muted-foreground"
                        onClick={() => handleFollowRequest.mutate({ notif: n, accept: false })}
                      >
                        <X className="w-3 h-3 mr-1" /> Deny
                      </Button>
                    </div>
                  )}
                  {n.type === 'follow_request' && n.follow_status && (
                    <span className="text-[11px] font-mono text-muted-foreground">{n.follow_status === 'accepted' ? '✓ Accepted' : '✗ Denied'}</span>
                  )}
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" role="status">
                    <span className="sr-only">Unread</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
