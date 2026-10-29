import { $, show } from './components/dom.js';
import { clearSession, getSession } from './services/storage.js';
import { initializeAuth } from './features/auth.js';
import { createRecordsFeature } from './features/records.js';
import { createDashboardFeature } from './features/dashboard.js';
import { createGarantiasFeature } from './features/garantias.js';
import { createNavigation } from './components/navigation.js';

const state = { data: {}, rows: [] };
const dashboard = createDashboardFeature({ state });
const garantias = createGarantiasFeature({ state });
const navigation = createNavigation({
  getData: () => state.data,
  initializeDashboardFilters: dashboard.initializeFilters,
  initializeGarantias: garantias.initializeView
});
const records = createRecordsFeature({ state, switchView: navigation.switchView });
initializeAuth({ onLogin: records.enter });

$('#yr').textContent = new Date().getFullYear();
const session = getSession();
if (session) {
  records.enter(session).catch(error => {
    console.error('No se pudo restaurar la sesión:', error);
    clearSession();
    show('#login', true);
    $('#lErr').textContent = `No se pudo restaurar la sesión. Inicia sesión nuevamente. ${error.message}`;
  });
}
