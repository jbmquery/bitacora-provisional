import { api as defaultApi } from '../services/api.js';
import { $, unique as uniq, escapeHtml as esc, setOptions as opts, show, setValue as sv } from '../components/dom.js';
import { loadChartJs } from '../services/libraries.js';
import { exportInformePDF } from './dashboard-report.js';
import { MESES } from '../config/app-config.js';
import { calcularDashboard, chartConfigs, fmtPct, periodoTexto } from './dashboard-metrics.js';

export function createDashboardFeature({ state, api = defaultApi }) {
let dbCharts = {};
let dbFiltersInitialized = false;
let dbRequest = 0;
let dbCurrent = null;   // { rows, data, filtros } del último periodo mostrado

/* ================================================================
   FILTROS: Mes · Año · Responsable de atención
   ================================================================ */
function initDashboardFilters() {
  if (dbFiltersInitialized) return;
  dbFiltersInitialized = true;

  const tecNames = state.data.usuarios ? state.data.usuarios.map(u => u.nombre).sort((a, b) => a.localeCompare(b)) : [];
  opts($('#dbTec'), tecNames, 'Todos');

  const hojas = state.data.hojas || [];
  const ms = uniq(hojas.map(h => h.split('-')[1])).sort((a, b) => MESES.indexOf(a) - MESES.indexOf(b));
  const anios = uniq(hojas.map(h => h.split('-')[0])).sort();
  opts($('#dbMes'), ms, 'Todos');
  opts($('#dbAnio'), anios, 'Todos');

  // Periodo por defecto: el mes actual; si aún no tiene hoja, el más reciente con datos.
  const hoy = new Date();
  let mes = MESES[hoy.getMonth()];
  let anio = String(hoy.getFullYear());
  if (!hojas.includes(`${anio}-${mes}`)) {
    const ultima = [...hojas].sort((a, b) => {
      const [ya, ma] = a.split('-'), [yb, mb] = b.split('-');
      return (ya - yb) || (MESES.indexOf(ma) - MESES.indexOf(mb));
    }).pop();
    if (ultima) [anio, mes] = ultima.split('-');
  }
  sv($('#dbMes'), mes);
  sv($('#dbAnio'), anio);

  $('#dbApply').onclick = applyDashboard;
  $('#dbExport').onclick = abrirModalReporte;
  $('#dbModalNo').onclick = () => generarReporte(false);
  $('#dbModalSi').onclick = () => generarReporte(true);
  $('#dbModal').addEventListener('click', e => { if (e.target === $('#dbModal')) cerrarModalReporte(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModalReporte(); });

  loadChartJs()
    .then(applyDashboard)
    .catch(error => {
      dbFiltersInitialized = false;
      console.error('No se pudo cargar el gráfico del dashboard:', error);
      show('#dbAlerta', true);
      $('#dbAlerta').textContent = error.message || 'No se pudo cargar el dashboard.';
    });
}

/* ================================================================
   CARGA DE DATOS Y RENDER
   ================================================================ */
async function applyDashboard() {
  const tec = $('#dbTec').value;
  const mes = $('#dbMes').value;
  const anio = $('#dbAnio').value;
  const token = ++dbRequest;

  const btn = $('#dbApply');
  btn.disabled = true; btn.classList.add('opacity-70');
  $('#dbExport').disabled = true;
  show('#dbAlerta', false);
  show('#dbEmpty', false); show('#dbGrid', false); show('#dbLoading', true);

  let r;
  try {
    r = await api('buscar', { q: '', resp: tec || '', mes: mes || '', anio: anio || '', estado: '' });
  } finally {
    if (token === dbRequest) { btn.disabled = false; btn.classList.remove('opacity-70'); }
  }
  if (token !== dbRequest) return;            // llegó una consulta más reciente
  show('#dbLoading', false);

  $('#dbPeriodo').textContent = periodoTexto(mes, anio);

  if (!r.ok) {
    show('#dbAlerta', true);
    $('#dbAlerta').textContent = r.msg || 'No se pudieron cargar los datos del dashboard.';
    dbCurrent = null;
    return;
  }

  const rows = r.rows || [];
  if (rows.length === 0) {
    dbCurrent = null;
    destroyCharts();
    show('#dbEmpty', true);
    return;
  }

  const data = calcularDashboard(rows);
  dbCurrent = { rows, data, filtros: { tec, mes, anio } };
  show('#dbGrid', true);                      // visible antes de crear los gráficos para que midan bien
  renderKpis(data.kpis);
  renderTablas(data);
  renderArbol(data.arbol, rows.length);
  renderGraficos(data);
  $('#dbExport').disabled = false;
}

function renderKpis(k) {
  $('#dbKpiTotal').textContent = k.total.toLocaleString('es-PE');
  $('#dbKpiResolucion').textContent = fmtPct(k.tasaResolucion);
  $('#dbKpiMttr').textContent = k.mttr.toFixed(1) + ' h';
  $('#dbKpiMismoDia').textContent = fmtPct(k.mismoDia);
}

function renderTablas(d) {
  const sinDatos = cols => `<tr><td colspan="${cols}" class="py-4 text-center text-slate-400 text-sm">Sin datos</td></tr>`;
  const fila3 = f => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(f.label)}</td>
      <td class="py-2 pr-3 text-sm text-slate-500 text-right tabular-nums font-mono">${f.count.toLocaleString('es-PE')}</td>
      <td class="py-2 text-sm font-mono text-slate-400 text-right">${fmtPct(f.pct)}</td>
    </tr>`;

  $('#dbTablaEstado').innerHTML = d.porEstado.length ? d.porEstado.map(fila3).join('') : sinDatos(3);
  $('#dbTablaTecnico').innerHTML = d.porTecnico.length ? d.porTecnico.map(fila3).join('') : sinDatos(3);

  $('#dbTablaFacultad').innerHTML = d.facultades.length ? d.facultades.map(f => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(f.fac)}</td>
      <td class="py-2 pr-3 text-sm text-slate-500 text-right tabular-nums font-mono">${esc(f.predio)}</td>
      <td class="py-2 pr-3 text-sm font-semibold text-slate-700 text-right tabular-nums font-mono">${f.tickets.toLocaleString('es-PE')}</td>
      <td class="py-2 pr-3 text-sm text-slate-500 text-right tabular-nums font-mono">${f.alumnos.toLocaleString('es-PE')}</td>
      <td class="py-2 text-sm text-slate-500 text-right tabular-nums font-mono">${f.admin.toLocaleString('es-PE')}</td>
    </tr>`).join('') : sinDatos(5);
}

/* ---------- Árbol Categoría · Sub Categoría · SS Categoría ---------- */
const CHEV = '<svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>';

function renderArbol(arbol, total) {
  const pct = (n, base) => fmtPct(base ? n / base * 100 : 0);
  const fila = (nivel, nombre, count, porcentaje, expandible) => `
    <${expandible ? 'button type="button" aria-expanded="false"' : 'div'} class="db-tree-row db-tree-l${nivel}">
      ${expandible ? CHEV : '<span class="chev"></span>'}
      <span class="db-tree-name">${esc(nombre)}</span>
      <span class="db-tree-num">${count.toLocaleString('es-PE')}</span>
      <span class="db-tree-pct">${porcentaje}</span>
    </${expandible ? 'button' : 'div'}>`;

  $('#dbArbol').innerHTML = arbol.map(cat => `
    <div class="db-tree-node">
      ${fila(0, cat.name, cat.count, pct(cat.count, total), true)}
      <div class="hidden">
        ${cat.subs.map(sub => `
          <div class="db-tree-node">
            ${fila(1, sub.name, sub.count, pct(sub.count, cat.count), true)}
            <div class="hidden">
              ${sub.ss.map(ss => fila(2, ss.name, ss.count, pct(ss.count, sub.count), false)).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// Un solo manejador para todo el árbol: abre/cierra el nivel pulsado.
document.addEventListener('click', e => {
  const row = e.target.closest('#dbArbol .db-tree-row[aria-expanded]');
  if (!row) return;
  const open = row.getAttribute('aria-expanded') !== 'true';
  row.setAttribute('aria-expanded', String(open));
  row.nextElementSibling.classList.toggle('hidden', !open);
});

/* ---------- Gráficos ---------- */
function destroyCharts() {
  Object.values(dbCharts).forEach(c => c && c.destroy());
  dbCharts = {};
}

function renderGraficos(d) {
  destroyCharts();
  Chart.defaults.color = '#64748B';
  const cfg = chartConfigs(d);

  // Histórico diario: si hay muchos días, el gráfico se ensancha y la tarjeta se desplaza.
  const wrap = $('#dbHistoricoWrap');
  wrap.style.minWidth = Math.max(0, d.historico.labels.length * 26) + 'px';

  // Concentración: altura proporcional a la cantidad de categorías.
  $('#dbConcentracionWrap').style.height = Math.max(288, d.porCategoria.length * 26 + 40) + 'px';

  dbCharts.historico = new Chart($('#dbChartHistorico'), cfg.historico);
  dbCharts.prioridad = new Chart($('#dbChartPrioridad'), cfg.prioridad);
  dbCharts.concentracion = new Chart($('#dbChartConcentracion'), cfg.concentracion);
  dbCharts.medio = new Chart($('#dbChartMedio'), cfg.medio);
}

/* ================================================================
   REPORTE PDF (con o sin Anexo 1)
   ================================================================ */
function abrirModalReporte() {
  if (!dbCurrent) return;
  show('#dbModal', true);
  $('#dbModalSi').focus();
}
function cerrarModalReporte() {
  if ($('#dbModal') && !$('#dbModal').classList.contains('hidden')) show('#dbModal', false);
}

async function generarReporte(incluirAnexo) {
  cerrarModalReporte();
  if (!dbCurrent) return;
  const btn = $('#dbExport');
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Generando reporte…';
  try {
    await exportInformePDF({ ...dbCurrent, incluirAnexo });
  } catch (error) {
    console.error('Error al generar el reporte PDF:', error);
    alert('Ocurrió un error al generar el reporte. Revisa la consola para más detalles.');
  } finally {
    btn.innerHTML = prev;
    btn.disabled = !dbCurrent;
  }
}

return { initializeFilters: initDashboardFilters };
}
