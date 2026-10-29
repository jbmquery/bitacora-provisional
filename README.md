# Bitácora

Aplicación web de mesa de ayuda que sincroniza sus registros con Google Sheets.

## Estructura

- `index.html`: estructura de las vistas y estilos con Tailwind CSS.
- `js/app.js`: punto de entrada que conecta los módulos de la aplicación.
- `js/config/app-config.js`: campos, opciones y constantes compartidas.
- `js/features/`: flujos de autenticación, registros, garantías, dashboard e informes.
- `js/components/`: utilidades de interfaz, navegación, filtros y tabla de registros.
- `js/services/`: acceso a la API y persistencia de sesión/preferencias.

La aplicación usa módulos JavaScript nativos del navegador; no requiere un paso de compilación. Chart.js y las bibliotecas de PDF se cargan solo al abrir el Dashboard o exportar, para reducir la carga inicial. Debe abrirse mediante HTTP: abrir `index.html` directamente como `file://` bloquea la carga de los módulos ES.

El módulo Garantías requiere que el backend de Google Apps Script exponga las acciones `buscarGarantias`, `guardarGarantia` y `actualizarGarantia`. Después de actualizar el script, publica una nueva versión de la implementación para que la URL configurada en `js/services/api.js` use esos métodos.

### Ejecutar localmente en Windows

Abre una terminal en la carpeta del proyecto y ejecuta:

```powershell
py -m http.server 8765
```
