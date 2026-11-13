import { $ } from '../components/dom.js';
import { api as defaultApi } from '../services/api.js';
import { createNotificationsService } from '../services/notifications-service.js';
import { renderNotificationList, renderToast } from '../components/notification-list.js';

const POLL_MS = 30000;
const TOAST_MS = 8000;
const LIST_LIMIT = 30;
const BASE_TITLE = document.title;

// Bandeja de notificaciones internas: campana con contador, panel desplegable, avisos emergentes
// y consulta periódica al servidor (solo mientras la pestaña está visible).
export function createNotificationsFeature({ state, api = defaultApi, onOpenTicket }) {
  let user = null;
  let timer = null;
  let items = [];
  let unread = 0;
  let seen = new Set();
  let loadedOnce = false;
  let loading = false;
  let active = false;

  const service = createNotificationsService({ api, getToken: () => user?.token });

  const isPanelOpen = () => !$('#notifPanel').hidden;

  function setStatus(message) {
    const el = $('#notifStatus');
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function render() {
    const badge = $('#notifBadge');
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.hidden = unread === 0;
    $('#notifToggle').setAttribute('aria-label', unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones');
    $('#notifMarkAll').disabled = unread === 0;
    $('#notifList').innerHTML = renderNotificationList(items);
    document.title = unread ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
  }

  function handleInvalidSession(message) {
    stop();
    setStatus(message || 'Tu sesión venció. Cierra sesión e ingresa nuevamente para recibir notificaciones.');
  }

  async function refresh() {
    if (!active || loading || !user?.token) return;
    loading = true;
    try {
      const result = await service.list(LIST_LIMIT);
      if (!active) return;
      if (!result.ok) {
        if (result.code === 'SESION_INVALIDA') handleInvalidSession(result.msg);
        else setStatus(result.msg || 'No se pudieron cargar las notificaciones.');
        return;
      }
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const incoming = rows.filter(item => !item.leida && !seen.has(item.id));
      items = rows;
      unread = Number(result.noLeidas) || 0;
      rows.forEach(item => seen.add(item.id));

      if (!loadedOnce && unread > 0) {
        showToast({ id: 'resumen', title: `Tienes ${unread} notificación(es) sin leer`, message: '' });
      } else if (loadedOnce) {
        incoming.forEach(item => showToast({ id: item.id, title: item.titulo, message: item.mensaje }));
      }
      loadedOnce = true;
      setStatus('');
      render();
    } catch (error) {
      console.error('No se pudieron actualizar las notificaciones:', error);
    } finally {
      loading = false;
    }
  }

  function showToast({ id, title, message }) {
    const container = $('#notifToasts');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderToast({ id, title, message });
    const toast = wrapper.firstElementChild;
    const dismiss = () => toast.remove();
    toast.querySelector('[data-toast-close]').onclick = dismiss;
    toast.querySelector('[data-toast-open]').onclick = () => {
      dismiss();
      if (id === 'resumen') openPanel();
      else openItem(id);
    };
    container.append(toast);
    setTimeout(dismiss, TOAST_MS);
  }

  async function markRead(item) {
    item.leida = true;
    unread = Math.max(0, unread - 1);
    render();
    const result = await service.markRead(item.id);
    if (!result.ok) {
      if (result.code === 'SESION_INVALIDA') handleInvalidSession(result.msg);
      else refresh();
      return;
    }
    items = items.filter(entry => entry.id !== item.id);
    render();
  }

  async function markAllRead() {
    if (!unread) return;
    items.forEach(item => { item.leida = true; });
    unread = 0;
    render();
    const result = await service.markAllRead();
    if (!result.ok) {
      if (result.code === 'SESION_INVALIDA') handleInvalidSession(result.msg);
      else refresh();
      return;
    }
    items = items.filter(item => !item.leida);
    render();
  }

  function openItem(id) {
    const item = items.find(entry => entry.id === id);
    if (!item) return;
    closePanel();
    if (!item.leida) markRead(item);
    if (item.ticket && onOpenTicket) onOpenTicket(item.ticket);
  }

  function openPanel() {
    $('#notifPanel').hidden = false;
    $('#notifToggle').setAttribute('aria-expanded', 'true');
    refresh();
  }

  function closePanel() {
    $('#notifPanel').hidden = true;
    $('#notifToggle').setAttribute('aria-expanded', 'false');
  }

  function tick() {
    if (document.visibilityState === 'visible') refresh();
  }

  function start(sessionUser) {
    stop();
    user = sessionUser;
    active = true;
    seen = new Set();
    loadedOnce = false;
    items = [];
    unread = 0;
    render();
    if (!user?.token) {
      active = false;
      setStatus('Tu sesión es anterior a esta función. Cierra sesión e ingresa nuevamente para recibir notificaciones.');
      return;
    }
    setStatus('');
    refresh();
    timer = setInterval(tick, POLL_MS);
  }

  function stop() {
    active = false;
    if (timer) clearInterval(timer);
    timer = null;
    items = [];
    unread = 0;
    render();
    closePanel();
  }

  $('#notifToggle').onclick = () => (isPanelOpen() ? closePanel() : openPanel());
  $('#notifMarkAll').onclick = markAllRead;
  $('#notifList').addEventListener('click', event => {
    const button = event.target.closest('[data-notif-id]');
    if (button) openItem(button.dataset.notifId);
  });

  // Captura: el menú de perfil detiene la propagación de sus clics, así que se escucha antes.
  document.addEventListener('click', event => {
    if (isPanelOpen() && !$('#notifWrap').contains(event.target)) closePanel();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isPanelOpen()) {
      closePanel();
      $('#notifToggle').focus();
    }
  });
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);

  return { start, stop, refresh };
}
