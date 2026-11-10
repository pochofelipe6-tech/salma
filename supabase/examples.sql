-- OPCIONAL: ejemplos de INSERT, no necesarios para que la app guarde recorridos.
-- Ejecutar como propietario en SQL Editor, tras migración + seed.
-- Crear primero un usuario real en Authentication > Users y cambiar este correo.
begin;
do $$
declare
  v_driver uuid;
  v_vehicle uuid;
  v_trip uuid := gen_random_uuid();
begin
  select id into v_driver from public.profiles where email='conductor@tuempresa.com' and role='conductor';
  if v_driver is null then raise exception 'Reemplaza conductor@tuempresa.com por un usuario existente en Auth'; end if;

  insert into public.vehicles(driver_id,plate) values(v_driver,'ABC123')
  on conflict(driver_id,plate) do update set plate=excluded.plate returning id into v_vehicle;

  insert into public.trips(id,driver_id,vehicle_id,driver_name,plate,started_at,ended_at,distance_km)
  values(v_trip,v_driver,v_vehicle,'Conductor de ejemplo','ABC123',now()-interval '10 minutes',now(),1.25);

  insert into public.trip_points(trip_id,sequence,recorded_at,latitude,longitude,accuracy_m,speed_kmh) values
    (v_trip,0,now()-interval '10 minutes',4.6500,-74.0800,8,40),
    (v_trip,1,now()-interval '9 minutes',4.6502,-74.0801,8,64);

  insert into public.speed_events(trip_id,client_id,zone_code,sector,recorded_at,latitude,longitude,speed_kmh,limit_kmh)
  select v_trip,1710000000000,'urban','Av. El Dorado · Bogotá',now()-interval '9 minutes',4.6502,-74.0801,64,speed_limit
  from public.speed_zones where code='urban';
end $$;
commit;

-- profiles se inserta automáticamente al crear usuarios en Supabase Auth.
-- Para promover al administrador, ejecutar por separado con su correo real:
-- update public.profiles set role='admin' where email='administrador@tuempresa.com';
