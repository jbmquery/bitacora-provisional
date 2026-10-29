import { $, escapeHtml } from './dom.js';

const PAGE_SIZE = 20;

export function createRecordsTable({ getColumns, getRows, getCategoryId, getColumnLabel, onOpenRecord }) {
  let currentPage = 1;

  document.addEventListener('click', event => {
    const button = event.target.closest('.pag-btn');
    if (!button) return;

    const page = Number.parseInt(button.dataset.p, 10);
    if (Number.isInteger(page) && page >= 1) {
      currentPage = page;
      render();
    }
  });

  $('#tb').addEventListener('click', event => {
    const button = event.target.closest('.ver');
    if (button) onOpenRecord(getRows()[Number(button.dataset.i)]);
  });

  function render({ resetPage = false } = {}) {
    if (resetPage) currentPage = 1;

    const columns = getColumns();
    $('#thead-row').innerHTML = columns.map(key => {
      return `<th class="p-2">${escapeHtml(getColumnLabel(key))}</th>`;
    }).join('') + '<th class="p-2">Acción</th>';

    const rows = getRows();
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    $('#cnt').textContent = `${total} registro(s) · Página ${currentPage} de ${totalPages}`;
    renderPagination(totalPages);

    if (pageRows.length === 0) {
      $('#tb').innerHTML = `<tr><td colspan="${columns.length + 1}" class="p-4 text-center text-slate-500">Sin resultados. Ajusta los filtros o añade un registro.</td></tr>`;
      return;
    }

    $('#tb').innerHTML = pageRows.map((row, localIndex) => {
      const globalIndex = start + localIndex;
      const cells = columns.map(key => {
        const value = key === 'ID_CATEGORIA' ? getCategoryId(row) : row[key] ?? '';
        return `<td class="p-2">${escapeHtml(value)}</td>`;
      }).join('');

      return `<tr class="border-t hover:bg-slate-50 align-top">${cells}<td class="p-2"><button data-i="${globalIndex}" class="ver btn bg-teal-700 hover:bg-teal-800 !px-3 !py-1">Ver</button></td></tr>`;
    }).join('');
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      $('#pag').innerHTML = '';
      return;
    }

    let markup = '';
    markup += paginationButton('«', 1, currentPage === 1);
    markup += paginationButton('‹', currentPage - 1, currentPage === 1);
    const firstPage = Math.max(1, currentPage - 2);
    const lastPage = Math.min(totalPages, currentPage + 2);

    for (let page = firstPage; page <= lastPage; page++) {
      markup += `<button class="pag-btn btn ${page === currentPage ? 'bg-teal-600' : 'bg-slate-400 hover:bg-slate-500'} !px-2 !py-1 text-xs" data-p="${page}">${page}</button>`;
    }

    markup += paginationButton('›', currentPage + 1, currentPage === totalPages);
    markup += paginationButton('»', totalPages, currentPage === totalPages);
    $('#pag').innerHTML = markup;
  }

  function paginationButton(label, page, disabled) {
    return `<button class="pag-btn btn bg-slate-400 hover:bg-slate-500 !px-2 !py-1 text-xs" data-p="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }

  return { render };
}
