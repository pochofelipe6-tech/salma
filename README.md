# VÉLO · Seguridad en movimiento

Aplicación Next.js 16, React 19 y TypeScript para recorridos y prevención de excesos SST, con autenticación y almacenamiento opcionales en Supabase.

## Ejecutar

Requiere Node.js 20.9 o superior.

Al clonar, copia `.env.example` a `.env.local` y configura Supabase según la guía. Para probar solamente la interfaz sin base de datos, usa `NEXT_PUBLIC_AUTH_MODE=demo`.

```bash
npm install
npm run dev
```

- Login: http://localhost:3000/
- Conductor: http://localhost:3000/conductor
- Administrador: http://localhost:3000/admin
- Compilación: `npm run build` genera la exportación estática en `out/`.

## Conductor

Ingresa nombre y placa, permite la ubicación, selecciona la zona e inicia el recorrido. Leaflet dibuja los puntos GPS sobre OpenStreetMap. Al finalizar se guarda el resumen y se puede descargar el recorrido completo como JSON.

Muestra velocidad GPS, distancia, duración y alertas. No inventa velocidad cuando el dispositivo no la proporciona. Descarta posiciones con precisión peor que 80 m y suspende las alertas tras 15 segundos sin una lectura reciente.

| Zona                  | Límite preventivo SST |
| --------------------- | --------------------- |
| Urbana                | 50 km/h               |
| Vía nacional          | 70 km/h               |
| Curvas                | 35 km/h               |
| Escolar / residencial | 30 km/h               |

Un exceso registra conductor, placa, zona, coordenadas, fecha/hora y velocidad. La alarma suena cada cinco segundos mientras persista el exceso y haya señal reciente. Volver al límite o cambiar la zona permite registrar un nuevo episodio. Las notificaciones del navegador son opcionales y requieren permiso.

## Administrador y almacenamiento

`/admin` conserva el panel, filtros, conteos y exportación CSV. En modo demo lee eventos locales y puede incluir ejemplos. En modo Supabase consulta los eventos de todos los conductores cada 15 segundos. Su mapa es ilustrativo.

En modo demo, perfil, eventos y los últimos 20 recorridos se guardan solo en localStorage. En modo Supabase se sincronizan con PostgreSQL; las copias locales y pendientes se separan por usuario. No borres los datos locales mientras haya recorridos pendientes de sincronización.

## Supabase: tablas, INSERT y entorno

Sigue [supabase/README.md](supabase/README.md). Ejecuta primero [la migración](supabase/migrations/202611100001_velo.sql), después [los INSERT de zonas](supabase/seed.sql). [examples.sql](supabase/examples.sql) contiene INSERT opcionales de vehículos, recorridos, puntos y excesos para una cuenta real.

Completa `.env.local` con la URL y clave pública y cambia `NEXT_PUBLIC_AUTH_MODE=supabase`. `.env.example` documenta las variables; `.env` y `.env.local` están ignorados por Git. Las contraseñas se administran en Supabase Auth. No se necesita una clave service_role en esta app.

## GPS y mapa

- Necesita HTTPS en producción o localhost en desarrollo, ubicación habilitada y permiso del navegador.
- La zona es manual: no hay geocercas ni identificación automática de curvas/colegios. Respeta la señalización vial.
- Mantén la página abierta y el dispositivo despierto; no se garantiza monitoreo con pantalla bloqueada o en segundo plano.
- Precisión y velocidad dependen del hardware. El mapa necesita conexión a OpenStreetMap y muestra su atribución.
- Configura el viaje antes de conducir.

## Pruebas

Con el servidor local ejecutándose y Google Chrome instalado:

```bash
npm test
npm run test:db
npm run test:cloud
```

Playwright simula el GPS y comprueba permisos, ruta, persistencia, exportación, episodios de exceso, cambios de zona, sonido y silencio, pérdida de señal y diseño móvil. TEST_BASE_URL permite otro servidor y CHROME_PATH otro ejecutable. `test:db` verifica la migración y RLS con PostgreSQL embebido. `test:cloud` inicia un servidor aislado en el puerto 3002 y simula respuestas de Supabase, sin credenciales reales.

Sites usa `.openai/hosting.json` para publicar. También se puede alojar `out/` como sitio estático.

## Login de demostración

Selecciona tu rol e inicia sesión con una cuenta pública de prueba:

| Rol           | Correo             | Contraseña    |
| ------------- | ------------------ | ------------- |
| Administrador | admin@velo.app     | Admin123!     |
| Conductor     | conductor@velo.app | Conductor123! |

En modo demo las sesiones se guardan en sessionStorage, vencen tras ocho horas y se eliminan al cerrar sesión. En modo Supabase las sesiones son de Supabase Auth y el rol se consulta en profiles. Un conductor se redirige a /conductor y un administrador a /admin. Al cerrar sesión durante un viaje se finaliza y se intenta sincronizar antes de salir.

Las cuentas de esta tabla son exclusivamente del prototipo con `NEXT_PUBLIC_AUTH_MODE=demo`, sin protección de datos. Con `supabase` se deshabilitan las cuentas demo y se usa Auth con autorización RLS en PostgreSQL. Los usuarios reales se crean desde el panel de Supabase; la app no ofrece registro público ni recuperación de contraseña.
