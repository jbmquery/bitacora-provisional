import { $, show } from './components/dom.js';
import { clearSession, getSession } from './services/storage.js';
import { initializeAuth } from './features/auth.js';
import { createRecordsFeature } from './features/records.js';
import { createDashboardFeature } from './features/dashboard.js';
import { createGarantiasFeature } from './features/garantias.js';
import { createNavigation } from './components/navigation.js';
import { createNotificationsFeature } from './features/notifications.js';

const state = { data: {}, rows: [] };
const dashboard = createDashboardFeature({ state });
const garantias = createGarantiasFeature({ state });
const navigation = createNavigation({
  getData: () => state.data,
  initializeDashboardFilters: dashboard.initializeFilters,
  initializeGarantias: garantias.initializeView
});
const records = createRecordsFeature({ state, switchView: navigation.switchView });

// Al pulsar una notificación se abre el historial de comentarios del ticket en Garantías.
function openTicketFromNotification(ticket) {
  if (!state.data.usuarios) {
    alert('La aplicación aún está cargando. Inténtalo nuevamente en unos segundos.');
    return;
  }
  navigation.switchView('garantias');
  garantias.openTicketHistory(ticket);
}
const notifications = createNotificationsFeature({ state, onOpenTicket: openTicketFromNotification });

async function enterApp(user) {
  notifications.start(user);
  try {
    await records.enter(user);
  } catch (error) {
    notifications.stop();
    throw error;
  }
}
initializeAuth({ onLogin: enterApp });

$('#yr').textContent = new Date().getFullYear();
const session = getSession();
if (session) {
  enterApp(session).catch(error => {
    console.error('No se pudo restaurar la sesión:', error);
    clearSession();
    show('#login', true);
    $('#lErr').textContent = `No se pudo restaurar la sesión. Inicia sesión nuevamente. ${error.message}`;
  });
}
