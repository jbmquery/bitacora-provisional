# Bitácora

Aplicación web de mesa de ayuda que sincroniza sus registros con Google Sheets.

## Estructura

```
bitacora/
├── backend/                     Google Apps Script (un archivo .gs por función)
│   ├── appsscript.json
│   ├── Config.gs                constantes y cabeceras de hojas
│   ├── Utilidades.gs            helpers compartidos (sh, tabla, err…)
│   ├── Auth.gs                  login, reset, token de sesión firmado
│   ├── Api.gs                   doGet/doPost y tabla de acciones
│   ├── Registros.gs             hojas mensuales
│   ├── Garantias.gs             CRUD de garantías (guarda el creador del ticket)
│   ├── GarantiasHistorial.gs    comentarios/historial por ticket
│   ├── Adjuntos.gs              archivos en Drive
│   └── Notificaciones.gs        bandeja interna: crear, listar, marcar leídas
└── frontend/                    servir esta carpeta por HTTP
    ├── index.html
    ├── app.js
    ├── components/  dom, navigation, record-filters, records-table, notification-list
    ├── config/      app-config
    ├── features/    auth, records, garantias, garantias-adjuntos, dashboard, dashboard-report, notifications
    └── services/    api, libraries, storage, notifications-service
```

`index.html` vive en la raíz y carga `frontend/app.js`; los módulos JavaScript restantes están dentro de `frontend/`.

## Notificaciones internas (bandeja)

- Al guardar un comentario en una garantía, el backend crea una fila en la hoja `NOTIFICACIONES` para el **técnico que creó el ticket**. No se notifica si el autor del comentario es el mismo creador.
- El creador se guarda en las columnas nuevas `CREADO POR` y `CREADO POR CORREO` (se crean solas) a partir del token de sesión. Para tickets antiguos, sin creador, se usa el `Tecnico responsable`.
- Acciones nuevas: `listarNotificaciones`, `marcarNotificacionLeida`, `marcarTodasNotificacionesLeidas` (todas exigen el token; cada usuario solo ve las suyas).
- Frontend: campana con contador en la cabecera, panel con la bandeja de notificaciones no leídas, aviso emergente al llegar una nueva (consulta cada 30 s con la pestaña visible) y, al pulsar una, se abre el historial del ticket. Al marcar una notificación como leída desaparece de la bandeja; su registro se conserva en la hoja `NOTIFICACIONES`.
- `depurarNotificaciones()` borra las de más de 90 días (ejecutar a mano o con activador diario).
- Tras actualizar el script publica una **nueva versión** de la implementación. Las sesiones previas no tienen token: deben cerrar sesión e ingresar de nuevo.

## Ejecutar localmente en Windows

```powershell
cd bitacora
py -m http.server 8765
```

### Garantías: búsqueda por serie y autor de comentarios

- La búsqueda se hace por **N° de serie** (`serie` en `buscarGarantias`): coincidencia exacta, sin distinguir mayúsculas ni espacios. Con serie informada se ignoran los filtros de técnico, bien y estado; sin serie se lista con esos filtros. Ya no existe el filtro por fecha.
- `login` devuelve un **token firmado** (HMAC-SHA256, vigencia 7 días) que el frontend envía al guardar/actualizar una garantía. El servidor lo valida, toma el nombre desde la hoja `USUARIOS` y lo guarda en `RESPONSABLE` del historial; cualquier nombre enviado por el cliente se ignora. La clave de firma se genera sola en Propiedades del script (`SESSION_SECRET`).
- En la interfaz, el campo «Comentario registrado por» es de solo lectura y solo muestra la sesión activa.
- Tras actualizar el script hay que publicar una **nueva versión** de la implementación. Las sesiones iniciadas antes de la actualización no tienen token: deben cerrar sesión e ingresar de nuevo para poder comentar.

