-- DVIR DESIGNS: Supabase schema. Run once in SQL Editor.
-- All product modifications are restricted to invited administrators.
create table if not exists public.dvir_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.dvir_admins enable row level security;
-- No general read or write policies on the admin list.

create or replace function public.dvir_is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.dvir_admins where user_id = (select auth.uid())); $$;
revoke all on function public.dvir_is_admin() from public;
grant execute on function public.dvir_is_admin() to anon, authenticated;

create table if not exists public.dvir_products (
  key text primary key,
  data jsonb not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint product_key_match check (data->>'key' = key),
  constraint product_category_check check (data->>'category' in ('pillows','curtains','tables')),
  constraint product_valid_sizes check (jsonb_typeof(data->'sizes') = 'array'),
  constraint product_valid_stock check (jsonb_typeof(data->'stock') = 'object')
);
create or replace function public.dvir_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists dvir_products_updated_at on public.dvir_products;
create trigger dvir_products_updated_at before update on public.dvir_products
for each row execute function public.dvir_touch_updated_at();
create index if not exists dvir_products_active_idx on public.dvir_products(active);
alter table public.dvir_products enable row level security;
drop policy if exists "Read active products" on public.dvir_products;
create policy "Read active products" on public.dvir_products for select to anon,authenticated
using (active = true or public.dvir_is_admin());
drop policy if exists "Admins add products" on public.dvir_products;
create policy "Admins add products" on public.dvir_products for insert to authenticated
with check (public.dvir_is_admin());
drop policy if exists "Admins update products" on public.dvir_products;
create policy "Admins update products" on public.dvir_products for update to authenticated
using (public.dvir_is_admin()) with check(public.dvir_is_admin());
drop policy if exists "Admins delete products" on public.dvir_products;
create policy "Admins delete products" on public.dvir_products for delete to authenticated
using (public.dvir_is_admin());
grant select on public.dvir_products to anon,authenticated;
grant insert,update,delete on public.dvir_products to authenticated;

-- Optional image upload support, with private write and public read.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('dvir-product-images','dvir-product-images',true,10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true;
drop policy if exists "DVIR public images" on storage.objects;
create policy "DVIR public images" on storage.objects for select to anon,authenticated
using (bucket_id = 'dvir-product-images');
drop policy if exists "DVIR admin image upload" on storage.objects;
create policy "DVIR admin image upload" on storage.objects for insert to authenticated
with check (bucket_id = 'dvir-product-images' and public.dvir_is_admin());
drop policy if exists "DVIR admin image update" on storage.objects;
create policy "DVIR admin image update" on storage.objects for update to authenticated
using (bucket_id = 'dvir-product-images' and public.dvir_is_admin())
with check (bucket_id = 'dvir-product-images' and public.dvir_is_admin());
drop policy if exists "DVIR admin image delete" on storage.objects;
create policy "DVIR admin image delete" on storage.objects for delete to authenticated
using (bucket_id = 'dvir-product-images' and public.dvir_is_admin());

-- To authorize a real admin after creating their Auth user in the Supabase dashboard,
-- run the following statement with THEIR real email, not with a public test user:
-- insert into public.dvir_admins(user_id)
-- select id from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com';
-- Do not run seed-products.sql again after editing products in the admin dashboard:
-- seed overwrites product data on matching keys.
