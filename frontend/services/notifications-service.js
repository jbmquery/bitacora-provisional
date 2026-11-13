import { api as defaultApi } from './api.js';

// Acceso a la API de notificaciones. El token de sesión identifica al destinatario en el servidor:
// cada usuario solo puede leer y marcar sus propias notificaciones.
export function createNotificationsService({ api = defaultApi, getToken }) {
  const call = (action, data = {}) => api(action, { token: getToken(), ...data });

  return {
    list: (limit = 30) => call('listarNotificaciones', { limite: limit }),
    markRead: id => call('marcarNotificacionLeida', { id }),
    markAllRead: () => call('marcarTodasNotificacionesLeidas')
  };
}
