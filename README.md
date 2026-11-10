# Bitácora

Aplicación web de mesa de ayuda que sincroniza sus registros con Google Sheets.

## Estructura

- `index.html`: estructura de las vistas y estilos con Tailwind CSS.
- `frontend/app.js`: punto de entrada que conecta los módulos de la aplicación.
- `frontend/config/app-config.js`: campos, opciones y constantes compartidas.
- `frontend/features/`: flujos de autenticación, registros, garantías, dashboard e informes.
- `frontend/components/`: utilidades de interfaz, navegación, filtros y tabla de registros.
- `frontend/services/`: acceso a la API y persistencia de sesión/preferencias.

La aplicación usa módulos JavaScript nativos del navegador; no requiere un paso de compilación. Chart.js y las bibliotecas de PDF se cargan solo al abrir el Dashboard o exportar, para reducir la carga inicial. Debe abrirse mediante HTTP: abrir `index.html` directamente como `file://` bloquea la carga de los módulos ES.

El módulo Garantías requiere que el backend de Google Apps Script exponga las acciones `buscarGarantias`, `guardarGarantia`, `actualizarGarantia` y `buscarHistorialGarantia`. Al marcar la casilla de comentario y guardar, se agrega una fila en `HISTORIAL GARANTÍA` con ID de cambio, ticket, fecha y hora, responsable, estado y comentario. La columna `HISTORICO` de `GARANTÍA` conserva el ID del último comentario guardado. Las columnas y la hoja de historial se crean automáticamente al consultar o guardar garantías. Después de actualizar el script, publica una nueva versión de la implementación para que la URL configurada en `frontend/services/api.js` use esos métodos.

### Garantías: búsqueda por serie y autor de comentarios

- La búsqueda se hace por **N° de serie** (`serie` en `buscarGarantias`): coincidencia exacta, sin distinguir mayúsculas ni espacios. Con serie informada se ignoran los filtros de técnico, bien y estado; sin serie se lista con esos filtros. Ya no existe el filtro por fecha.
- `login` devuelve un **token firmado** (HMAC-SHA256, vigencia 7 días) que el frontend envía al guardar/actualizar una garantía. El servidor lo valida, toma el nombre desde la hoja `USUARIOS` y lo guarda en `RESPONSABLE` del historial; cualquier nombre enviado por el cliente se ignora. La clave de firma se genera sola en Propiedades del script (`SESSION_SECRET`).
- En la interfaz, el campo «Comentario registrado por» es de solo lectura y solo muestra la sesión activa.
- Tras actualizar el script hay que publicar una **nueva versión** de la implementación. Las sesiones iniciadas antes de la actualización no tienen token: deben cerrar sesión e ingresar de nuevo para poder comentar.

### Ejecutar localmente en Windows

Abre una terminal en la carpeta del proyecto y ejecuta:

```powershell
py -m http.server 8765
```
