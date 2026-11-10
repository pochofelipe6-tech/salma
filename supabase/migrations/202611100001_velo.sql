-- Ejecutar completo una vez en Supabase > SQL Editor, antes de seed.sql.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'conductor' check (role in ('admin','conductor')),
  created_at timestamptz not null default now()
);
create table public.speed_zones (
  code text primary key,
  name text not null unique,
  speed_limit smallint not null check (speed_limit between 1 and 200)
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  plate text not null check (length(plate) between 1 and 12 and plate = upper(plate)),
  created_at timestamptz not null default now(),
  unique(driver_id, plate), unique(id, driver_id)
);
create table public.trips (
  id uuid primary key,
  driver_id uuid not null references public.profiles(id),
  vehicle_id uuid not null,
  driver_name text not null check (length(driver_name) between 1 and 80),
  plate text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_km numeric not null default 0 check (distance_km >= 0),
  updated_at timestamptz not null default now(),
  foreign key(vehicle_id, driver_id) references public.vehicles(id, driver_id),
  check (ended_at is null or ended_at >= started_at)
);
create table public.trip_points (
  trip_id uuid not null references public.trips(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 80),
  speed_kmh double precision check (speed_kmh between 0 and 500),
  primary key(trip_id, sequence)
);
create table public.speed_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  client_id bigint not null,
  zone_code text not null references public.speed_zones(code),
  sector text not null,
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed_kmh numeric not null check (speed_kmh <= 500),
  limit_kmh smallint not null check (limit_kmh > 0),
  excess_kmh numeric generated always as (speed_kmh - limit_kmh) stored,
  unique(trip_id, client_id), check (speed_kmh > limit_kmh)
);
create index trips_driver_started_idx on public.trips(driver_id, started_at desc);
create index speed_events_recorded_idx on public.speed_events(recorded_at desc);
create index speed_events_trip_zone_idx on public.speed_events(trip_id, zone_code);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Nunca aceptar el rol de user_metadata: un registro público no puede hacerse admin.
  insert into public.profiles(id,email,full_name,role)
  values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),80),'conductor');
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,email,full_name)
select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'full_name',''),80) from auth.users on conflict(id) do nothing;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.speed_zones enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_points enable row level security;
alter table public.speed_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.is_admin()));
create policy profiles_name on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));
create policy zones_read on public.speed_zones for select to authenticated using (true);
create policy vehicles_read on public.vehicles for select to authenticated using (driver_id=(select auth.uid()) or (select public.is_admin()));
create policy trips_read on public.trips for select to authenticated using (driver_id=(select auth.uid()) or (select public.is_admin()));
create policy points_read on public.trip_points for select to authenticated using (exists(select 1 from public.trips t where t.id=trip_id));
create policy events_read on public.speed_events for select to authenticated using (exists(select 1 from public.trips t where t.id=trip_id));

-- Los clientes solo leen; las escrituras pasan por una RPC con propietario validado.
revoke all on public.profiles,public.speed_zones,public.vehicles,public.trips,public.trip_points,public.speed_events from anon, authenticated;
grant select on public.profiles,public.speed_zones,public.vehicles,public.trips,public.trip_points,public.speed_events to authenticated;
grant update(full_name) on public.profiles to authenticated;

create function public.sync_trip(p_payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_trip uuid := (p_payload->>'id')::uuid;
  v_vehicle uuid;
  v_plate text := upper(trim(p_payload->>'plate'));
  v_name text := trim(p_payload->>'driver');
  v_started timestamptz := (p_payload->>'started_at')::timestamptz;
  v_ended timestamptz := (p_payload->>'ended_at')::timestamptz;
  v_point jsonb;
  v_event jsonb;
  v_limit smallint;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role='conductor') then
    raise exception 'Se requiere una sesión de conductor' using errcode='42501';
  end if;
  if v_trip is null or v_started is null or v_name is null or length(v_name) not between 1 and 80 or v_plate is null or length(v_plate) not between 1 and 12 then
    raise exception 'Datos del recorrido inválidos' using errcode='22023';
  end if;
  -- Serializa reintentos del mismo UUID, incluyendo creación concurrente.
  perform pg_advisory_xact_lock(hashtextextended(v_trip::text,0));
  if exists(select 1 from public.trips where id=v_trip and driver_id<>v_user) then
    raise exception 'El recorrido pertenece a otro conductor' using errcode='42501';
  end if;
  if exists(select 1 from public.trips where id=v_trip and (started_at<>v_started or plate<>v_plate or driver_name<>v_name)) then
    raise exception 'No se puede cambiar la identidad de un recorrido' using errcode='22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'points','[]'))>500 or jsonb_array_length(coalesce(p_payload->'events','[]'))>500 then
    raise exception 'Máximo 500 puntos y eventos por lote' using errcode='22023';
  end if;
  insert into public.vehicles(driver_id,plate) values(v_user,v_plate)
  on conflict(driver_id,plate) do update set plate=excluded.plate returning id into v_vehicle;
  insert into public.trips(id,driver_id,vehicle_id,driver_name,plate,started_at,ended_at,distance_km)
  values(v_trip,v_user,v_vehicle,v_name,v_plate,v_started,v_ended,(p_payload->>'distance_km')::numeric)
  on conflict(id) do update set ended_at=coalesce(public.trips.ended_at,excluded.ended_at),
    distance_km=greatest(public.trips.distance_km,excluded.distance_km),updated_at=now();
  for v_point in select value from jsonb_array_elements(coalesce(p_payload->'points','[]')) loop
    insert into public.trip_points(trip_id,sequence,recorded_at,latitude,longitude,accuracy_m,speed_kmh)
    values(v_trip,(v_point->>'sequence')::integer,(v_point->>'recorded_at')::timestamptz,
      (v_point->>'latitude')::double precision,(v_point->>'longitude')::double precision,
      (v_point->>'accuracy_m')::double precision,(v_point->>'speed_kmh')::double precision)
    on conflict(trip_id,sequence) do nothing;
  end loop;
  for v_event in select value from jsonb_array_elements(coalesce(p_payload->'events','[]')) loop
    select speed_limit into strict v_limit from public.speed_zones where code=v_event->>'zone_code';
    insert into public.speed_events(trip_id,client_id,zone_code,sector,recorded_at,latitude,longitude,speed_kmh,limit_kmh)
    values(v_trip,(v_event->>'client_id')::bigint,v_event->>'zone_code',v_event->>'sector',
      (v_event->>'recorded_at')::timestamptz,(v_event->>'latitude')::double precision,
      (v_event->>'longitude')::double precision,(v_event->>'speed_kmh')::numeric,v_limit)
    on conflict(trip_id,client_id) do nothing;
  end loop;
  return v_trip;
end $$;
revoke all on function public.sync_trip(jsonb) from public,anon;
grant execute on function public.sync_trip(jsonb) to authenticated;
commit;
