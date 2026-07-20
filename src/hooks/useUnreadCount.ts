import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

function lsKey(apartmentId: string, userId: string) {
  return `chat_read:${apartmentId}:${userId}`;
}

function getLocalLastRead(apartmentId: string, userId: string): string | null {
  return localStorage.getItem(lsKey(apartmentId, userId));
}

function setLocalLastRead(apartmentId: string, userId: string, ts: string) {
  localStorage.setItem(lsKey(apartmentId, userId), ts);
}

export function useUnreadCount(apartmentId: string | null, currentUserId: string, isActive: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const fetchUnread = useCallback(async () => {
    if (!apartmentId || !currentUserId) return;
    if (isActiveRef.current) { setUnreadCount(0); return; }

    const localLastRead = getLocalLastRead(apartmentId, currentUserId);

    // Try DB
    const { data: readRow } = await supabase
      .from('chat_reads')
      .select('last_read_at')
      .eq('apartment_id', apartmentId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    let lastRead: string;
    if (readRow?.last_read_at) {
      lastRead = readRow.last_read_at;
      setLocalLastRead(apartmentId, currentUserId, lastRead);
    } else if (localLastRead) {
      lastRead = localLastRead;
    } else {
      // First time ever — treat everything as read, save now to localStorage
      const now = new Date().toISOString();
      setLocalLastRead(apartmentId, currentUserId, now);
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('apartment_id', apartmentId)
      .neq('sender_id', currentUserId)
      .is('deleted_at', null)
      .gt('created_at', lastRead);

    if (!isActiveRef.current) setUnreadCount(count ?? 0);
  }, [apartmentId, currentUserId]);

  const markRead = useCallback(async () => {
    if (!apartmentId || !currentUserId) return;
    const now = new Date().toISOString();
    // Always save to localStorage so it persists even if DB table doesn't exist
    setLocalLastRead(apartmentId, currentUserId, now);
    await supabase.from('chat_reads').upsert(
      { apartment_id: apartmentId, user_id: currentUserId, last_read_at: now },
      { onConflict: 'apartment_id,user_id' }
    );
    setUnreadCount(0);
  }, [apartmentId, currentUserId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (isActive) markRead();
  }, [isActive, markRead]);

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
        if (payload.new.sender_id === currentUserId) return;
        if (!isActiveRef.current) setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [apartmentId, currentUserId]);

  return { unreadCount, markRead };
}
