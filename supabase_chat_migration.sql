-- ── Chat messages table ──────────────────────────────────────────────────────
create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  apartment_id    uuid not null references apartments(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  sender_name     text not null,
  type            text not null default 'text', -- 'text' | 'image'
  text            text,
  image_url       text,
  reply_to_id     uuid references chat_messages(id) on delete set null,
  is_pinned       boolean not null default false,
  pinned_by       uuid references auth.users(id),
  pinned_at       timestamptz,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- Index for loading messages by apartment
create index if not exists chat_messages_apartment_created
  on chat_messages(apartment_id, created_at desc);

-- RLS
alter table chat_messages enable row level security;

-- Only apartment members can read messages
create policy "chat_read" on chat_messages
  for select using (
    exists (
      select 1 from apartment_members
      where apartment_members.apartment_id = chat_messages.apartment_id
        and apartment_members.user_id = auth.uid()
    )
  );

-- Only apartment members can insert
create policy "chat_insert" on chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from apartment_members
      where apartment_members.apartment_id = chat_messages.apartment_id
        and apartment_members.user_id = auth.uid()
    )
  );

-- Only the sender can update their own messages
create policy "chat_update" on chat_messages
  for update using (
    sender_id = auth.uid()
    or exists (
      select 1 from apartment_members
      where apartment_members.apartment_id = chat_messages.apartment_id
        and apartment_members.user_id = auth.uid()
    )
  );

-- Realtime
alter publication supabase_realtime add table chat_messages;
