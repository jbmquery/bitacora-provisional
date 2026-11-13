import { escapeHtml as esc } from './dom.js';

export function formatRelativeTime(iso, now = Date.now()) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(time).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function meta(item) {
  return [formatRelativeTime(item.fecha), item.ticket ? `Ticket #${item.ticket}` : ''].filter(Boolean).join(' · ');
}

export function renderNotificationList(items) {
  if (!items.length) {
    return '<li class="px-4 py-10 text-center text-sm text-slate-400">No tienes notificaciones.</li>';
  }
  return items.map(item => `
    <li>
      <button type="button" data-notif-id="${esc(item.id)}" class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${item.leida ? '' : 'bg-sky-50/70'}">
        <span class="mt-1.5 h-2 w-2 flex-none rounded-full ${item.leida ? 'bg-transparent' : 'bg-sky-600'}" aria-hidden="true"></span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm ${item.leida ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}">${esc(item.titulo)}</span>
          <span class="mt-0.5 block whitespace-pre-wrap break-words text-xs text-slate-600">${esc(item.mensaje)}</span>
          <span class="mt-1 block text-[11px] text-slate-400">${esc(meta(item))}</span>
        </span>
        ${item.leida ? '' : '<span class="sr-only">No leída</span>'}
      </button>
    </li>`).join('');
}

export function renderToast({ id, title, message }) {
  return `
    <div data-toast-id="${esc(id)}" role="status" class="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <button type="button" data-toast-open class="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-600 rounded">
        <span class="block text-sm font-semibold text-slate-900">${esc(title)}</span>
        ${message ? `<span class="mt-0.5 block break-words text-xs text-slate-600">${esc(message)}</span>` : ''}
      </button>
      <button type="button" data-toast-close class="flex-none rounded p-1 text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600" aria-label="Cerrar aviso">✕</button>
    </div>`;
}
