-- Ejecutar después de migrations/202611100001_velo.sql.
insert into public.speed_zones(code,name,speed_limit) values
  ('urban','Zona urbana',50),
  ('national','Vía nacional',70),
  ('curves','Curvas',35),
  ('school','Escolar / residencial',30)
on conflict(code) do update set name=excluded.name,speed_limit=excluded.speed_limit;

-- Los usuarios se crean en Authentication > Users > Add user, no con INSERT en auth.users.
-- El trigger crea profiles con rol conductor. Para promover una cuenta existente,
-- ejecutar solo desde SQL Editor con el correo real (no desde el navegador):
-- update public.profiles set role='admin' where email='administrador@tuempresa.com';
