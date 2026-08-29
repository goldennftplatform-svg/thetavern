create table if not exists public.conflic_state (
  id text primary key check (id = 'global'),
  revision bigint not null default 0,
  state jsonb,
  updated_at timestamptz not null default now()
);

alter table public.conflic_state enable row level security;
revoke all on table public.conflic_state from anon, authenticated;

insert into public.conflic_state (id, revision, state)
values ('global', 0, null)
on conflict (id) do nothing;

comment on table public.conflic_state is
  'Server-only authoritative state for the five Conflic Bouy tables.';
