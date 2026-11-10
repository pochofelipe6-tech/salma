# VÉLO · Seguridad en movimiento

Aplicación Next.js 16, React 19 y TypeScript para recorridos y prevención de excesos SST.

## Ejecutar

Requiere Node.js 20.9 o superior.

```bash
npm install
npm run dev
```

- Conductor: http://localhost:3000/
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

`/admin` conserva el panel, filtros, conteos y exportación CSV; lee los eventos del conductor en el mismo navegador. Su mapa es ilustrativo. Incluye ejemplos cuando no hay registros. El acceso al panel no está protegido por autenticación.

Perfil, eventos y los últimos 20 recorridos se guardan en localStorage. No hay servidor de datos ni sincronización entre dispositivos. Borrar los datos del navegador elimina los registros; descarga los recorridos que necesites conservar.

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
```

Playwright simula el GPS y comprueba permisos, ruta, persistencia, exportación, episodios de exceso, cambios de zona, sonido y silencio, pérdida de señal y diseño móvil. TEST_BASE_URL permite otro servidor y CHROME_PATH otro ejecutable.

Sites usa `.openai/hosting.json` para publicar. También se puede alojar `out/` como sitio estático.
