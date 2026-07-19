-- Track when each user last read the chat for their apartment
create table if not exists public.chat_reads (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid not null,
  user_id      text not null,
  last_read_at timestamptz not null default now(),
  unique (apartment_id, user_id)
);

-- RLS
alter table public.chat_reads enable row level security;

create policy "chat_reads_select" on public.chat_reads
  for select using (true);

create policy "chat_reads_upsert" on public.chat_reads
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
