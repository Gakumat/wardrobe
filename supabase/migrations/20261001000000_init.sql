-- Wardrobe: initial schema.
-- Single user, but every row is owned by auth.uid() and locked down with RLS,
-- so nothing (including underwear/intimate items) is reachable without a session.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'tagging', 'review', 'active', 'failed')),
  error text,

  category text check (category in (
    'headwear','eyewear','neckwear','outerwear','midlayer','top','bottom','onepiece',
    'belt','underwear','socks','shoes','gloves','bag','jewellery','watch','tech','other'
  )),
  subcategory text,
  name text,
  colours jsonb not null default '[]'::jsonb,           -- [{name, hex, proportion}]
  pattern text check (pattern in ('solid','stripe','check','graphic','print','texture','other')),
  material text,
  fabric_weight text check (fabric_weight in ('sheer','light','mid','heavy')),
  warmth smallint check (warmth between 1 and 5),
  weather_resistance jsonb not null default '{}'::jsonb, -- {waterproof, windproof, breathable}
  formality smallint check (formality between 1 and 5),
  seasons text[] not null default '{}',
  fit text check (fit in ('slim','regular','relaxed','oversized','cropped')),
  vibes text[] not null default '{}',
  role text check (role in ('hero','supporting')),
  layering jsonb not null default '{}'::jsonb,           -- {good_under, good_over, standalone_only}
  styling_properties jsonb not null default '{}'::jsonb, -- {holds_a_tuck, cuffable, can_cinch_or_knot, drapes_well, sleeves_roll}
  visibility_default text check (visibility_default in ('visible','functional')),
  notes text,
  low_confidence text[] not null default '{}',

  photo_original text,
  photo_cutout text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_user_status_idx on public.items (user_id, status);
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outfits
-- ---------------------------------------------------------------------------
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  source text not null check (source in ('today','shuffle','vibe','chat','swap')),
  context text,
  weather jsonb,
  explanation jsonb,   -- {why, how_to_wear, weather_note, alternate_take, neglect_callouts[]}
  reply text,          -- conversational reply (chat)
  status text not null default 'suggested'
    check (status in ('suggested','worn','skipped')),
  favourite boolean not null default false,
  skip_reason text,
  signature text,      -- sorted ids of every item
  trio_signature text, -- sorted top/onepiece + bottom + shoes ids
  parent_id uuid references public.outfits on delete set null
);
create index outfits_user_created_idx on public.outfits (user_id, created_at desc);

create table public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  outfit_id uuid not null references public.outfits on delete cascade,
  item_id uuid not null references public.items on delete cascade,
  slot text not null,
  visible boolean not null default true,
  styling_note text,
  position smallint not null default 0
);
create index outfit_items_outfit_idx on public.outfit_items (outfit_id);
create index outfit_items_item_idx on public.outfit_items (item_id);

create table public.wear_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  outfit_id uuid not null references public.outfits on delete cascade,
  worn_at timestamptz not null default now()
);
create index wear_log_outfit_idx on public.wear_log (outfit_id);

-- ---------------------------------------------------------------------------
-- preferences & gaps
-- ---------------------------------------------------------------------------
create table public.preferences (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  likes text not null default '',
  dislikes text not null default '',
  learned jsonb not null default '[]'::jsonb, -- [{at, note}] distilled from skip reasons
  location_name text,
  lat double precision,
  lon double precision,
  model text,
  updated_at timestamptz not null default now()
);
create trigger preferences_updated_at before update on public.preferences
  for each row execute function public.set_updated_at();

create table public.gap_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  description text not null,
  reason text not null,
  unlock_count integer not null default 0,
  created_at timestamptz not null default now(),
  dismissed boolean not null default false
);

-- ---------------------------------------------------------------------------
-- derived wear stats
-- ---------------------------------------------------------------------------
create view public.items_with_wear
with (security_invoker = true) as
select
  i.*,
  coalesce(w.times_worn, 0)::int as times_worn,
  w.last_worn_at
from public.items i
left join (
  select oi.item_id, count(*) as times_worn, max(wl.worn_at) as last_worn_at
  from public.wear_log wl
  join public.outfit_items oi on oi.outfit_id = wl.outfit_id
  group by oi.item_id
) w on w.item_id = i.id;

-- ---------------------------------------------------------------------------
-- RLS: owner-only on everything
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['items','outfits','outfit_items','wear_log','preferences','gap_suggestions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- storage: private bucket, files under {uid}/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('items', 'items', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "items owner read" on storage.objects for select to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "items owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "items owner update" on storage.objects for update to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "items owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = auth.uid()::text);
