# VÉLO

Aplicación Next.js + React + TypeScript para prevención de excesos de velocidad SST.

Ejecutar: npm install y npm run dev. Compilar: npm run build (exportación estática en out).

Incluye datos de ejemplo, filtros por zona, búsqueda por placa/conductor/sector, exportación CSV, alertas Web Audio y notificaciones con permiso. El seguimiento utiliza la velocidad reportada por Geolocation; requiere HTTPS o localhost. La zona y el sector se seleccionan manualmente. Un exceso se registra al cruzar el límite y se rearma al volver a una velocidad permitida.

Los registros se guardan en localStorage del navegador. No incluye backend, telemetría remota, detección automática de zonas ni ejecución en segundo plano. El mapa es ilustrativo.
