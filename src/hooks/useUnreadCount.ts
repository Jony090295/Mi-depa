import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useUnreadCount(apartmentId: string | null, currentUserId: string, isActive: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const fetchUnread = useCallback(async () => {
    if (!apartmentId || !currentUserId) return;
    // If chat tab is already open, nothing is unread
    if (isActiveRef.current) { setUnreadCount(0); return; }

    const { data: readRow } = await supabase
      .from('chat_reads')
      .select('last_read_at')
      .eq('apartment_id', apartmentId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    const lastRead = readRow?.last_read_at ?? '1970-01-01T00:00:00Z';

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('apartment_id', apartmentId)
      .neq('sender_id', currentUserId)
      .is('deleted_at', null)
      .gt('created_at', lastRead);

    // Only update if tab is still inactive (avoid race if user switched tabs mid-fetch)
    if (!isActiveRef.current) setUnreadCount(count ?? 0);
  }, [apartmentId, currentUserId]);

  // Mark as read when chat tab is active
  const markRead = useCallback(async () => {
    if (!apartmentId || !currentUserId) return;
    await supabase.from('chat_reads').upsert(
      { apartment_id: apartmentId, user_id: currentUserId, last_read_at: new Date().toISOString() },
      { onConflict: 'apartment_id,user_id' }
    );
    setUnreadCount(0);
  }, [apartmentId, currentUserId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Mark read when tab becomes active
  useEffect(() => {
    if (isActive) markRead();
  }, [isActive, markRead]);

  // Realtime: listen for new messages to update badge
  useEffect(() => {
    if (!apartmentId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`unread:${apartmentId}:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `apartment_id=eq.${apartmentId}`,
      }, (payload) => {
        // Only count messages from others
        if (payload.new.sender_id === currentUserId) return;
        if (!isActive) setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [apartmentId, currentUserId, isActive]);

  return { unreadCount, markRead };
}
