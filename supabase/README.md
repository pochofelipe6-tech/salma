# Configurar Supabase para VÉLO

Proyecto indicado: `tewsunpdcoqkxwbetoll`.

## 1. Crear las tablas e insertar límites

En el SQL Editor de tu proyecto, ejecuta en este orden:

1. `migrations/202611100001_velo.sql`, completo una sola vez. Crea tablas, claves, índices, trigger de perfiles, políticas RLS y la función de escritura.
2. `seed.sql`. Inserta los cuatro límites SST; puede repetirse.

`examples.sql` contiene INSERT de vehículo, recorrido, puntos GPS y exceso para un usuario real. Es opcional y requiere cambiar el correo de ejemplo. No ejecutarlo si no deseas datos de ejemplo.

| Tabla          | Información                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `profiles`     | Usuario de Auth, correo, nombre y rol                                    |
| `vehicles`     | Placa y conductor propietario                                            |
| `speed_zones`  | Urbana 50, nacional 70, curvas 35 y escolar/residencial 30               |
| `trips`        | Conductor, vehículo, placa/nombre del viaje, inicio, fin, distancia      |
| `trip_points`  | Secuencia, coordenadas, fecha/hora, precisión y velocidad                |
| `speed_events` | Viaje, zona, sector, coordenadas, fecha/hora, velocidad, límite y exceso |

## 2. Crear usuarios y asignar el administrador

En **Authentication → Users → Add user** crea las cuentas con correo y contraseña. Confirma el correo desde el panel si corresponde. El trigger crea automáticamente `profiles`, siempre como conductor: ningún cliente puede asignarse admin mediante metadatos.

Si ya había usuarios antes de ejecutar la migración, sus perfiles se crean durante la migración.

Para el administrador, ejecuta en SQL Editor, reemplazando el correo:

```sql
update public.profiles
set role = 'admin', full_name = 'Administrador'
where email = 'administrador@tuempresa.com'
returning id, email, role;
```

Para actualizar el nombre de un conductor:

```sql
update public.profiles
set full_name = 'Felipe García'
where email = 'conductor@tuempresa.com';
```

Las contraseñas pertenecen a Supabase Auth. No se insertan ni se guardan en tablas públicas. Las cuentas del login demo no se crean automáticamente en Supabase.

## 3. Completar el entorno

Ya existe `.env.local` ignorado por Git. En la raíz del proyecto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://tewsunpdcoqkxwbetoll.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
NEXT_PUBLIC_AUTH_MODE=supabase
```

Obtén la URL y clave pública desde **Connect** o la configuración de API del proyecto. También se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` para proyectos con claves antiguas. No uses `service_role`, `sb_secret` ni contraseña de PostgreSQL: el navegador solo necesita la clave pública y RLS.

Reinicia `npm run dev`. En producción vuelve a compilar: Next.js incorpora `NEXT_PUBLIC_*` durante el build. Configura el sitio/orígenes autorizados en Authentication para localhost y tu dominio si vas a usar confirmaciones o recuperación por correo.

Con `NEXT_PUBLIC_AUTH_MODE=demo` la app usa exclusivamente el prototipo local. Con `supabase` exige configuración completa y no permite entrar con las cuentas públicas demo. Se mantiene demo en el archivo local hasta recibir la clave y ejecutar las tablas, para no romper el acceso actual.

## 4. Guardado desde la app

El login usa Supabase Auth y consulta el rol en `profiles`. Las políticas del servidor autorizan datos; cambiar el rol del selector o modificar el navegador no otorga privilegios en la base.

- El conductor crea el recorrido y sincroniza puntos/excesos en lotes cada 15 segundos y al finalizar.
- `sync_trip` valida la identidad autenticada y rechaza UUID de otro conductor. Los puntos y eventos se insertan de forma idempotente; reintentos no duplican registros.
- El límite del evento se obtiene de `speed_zones` en PostgreSQL, no se acepta el límite enviado por el cliente.
- El historial se carga desde Supabase. Las copias locales y pendientes se separan por ID de usuario.
- Si falla la red, la app avisa y conserva una copia pendiente local. Reintenta durante el viaje o al volver a entrar. No borres datos locales antes de sincronizar.
- El administrador consulta los eventos de todos los conductores cada 15 segundos. El mapa del administrador sigue siendo ilustrativo.

El navegador debe permanecer abierto; cerrar o bloquear puede impedir capturar los últimos segundos de GPS. No se envían automáticamente los antiguos datos demo al proyecto real. Si falla el guardado local por falta de espacio, descarga el recorrido para conservarlo.

## 5. Verificar

```sql
select id,email,role from public.profiles;
select plate,driver_name,started_at,ended_at,distance_km from public.trips order by started_at desc;
select * from public.speed_events order by recorded_at desc;
```

Estas consultas de SQL Editor se ejecutan con privilegios de propietario. Para comprobar RLS hay que probar con sesiones reales de conductor/administrador o ejecutar `npm run test:db`, que valida la migración en PostgreSQL embebido con usuarios simulados.

La configuración por sí sola no aplica SQL a tu proyecto. Sin conexión autorizada o acceso al SQL Editor no se pueden crear tablas remotamente. El enlace al editor no proporciona la clave ni una sesión de acceso.
