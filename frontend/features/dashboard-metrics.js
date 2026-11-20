import { ESTADOS_RESUELTOS, PALETA } from '../config/app-config.js';

/* ================================================================
   Cálculos y configuraciones de gráficos compartidos por el dashboard
   (pantalla) y el informe PDF, para que ambos muestren lo mismo.
   ================================================================ */

export const fmtPct = n => n.toFixed(1) + '%';

/** «Agosto 2026», «Todos los meses 2026», etc. según los filtros activos. */
export function periodoTexto(mes, anio) {
  const m = mes ? mes.charAt(0) + mes.slice(1).toLowerCase() : 'Todos los meses';
  return `${m} ${anio || 'Todos los años'}`;
}

export function agrupar(rows, campo, vacio = 'SIN DATO') {
  const m = new Map();
  rows.forEach(r => {
    const k = String(r[campo] ?? '').trim() || vacio;
    m.set(k, (m.get(k) || 0) + 1);
  });
  const t = rows.length;
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count, pct: t ? count / t * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function parseFecha(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d) ? null : d;
}

export function calcularKpis(rows) {
  const total = rows.length;
  const resueltos = rows.filter(r => ESTADOS_RESUELTOS.includes(r.ESTADO)).length;
  let horas = 0, n = 0, mismoDia = 0;
  rows.forEach(r => {
    const ini = parseFecha(r['FECHA REC']);
    const fin = parseFecha(r['FECHA FINAL'] || r['FECHA CIERRE']);
    if (ini && fin && fin >= ini) {
      horas += (fin - ini) / 36e5;
      n++;
      if (ini.toDateString() === fin.toDateString()) mismoDia++;
    }
  });
  return {
    total,
    tasaResolucion: total ? resueltos / total * 100 : 0,
    mttr: n ? horas / n : 0,
    mismoDia: n ? mismoDia / n * 100 : 0
  };
}

/** Todas las métricas que consumen las tarjetas, tablas y gráficos. */
export function calcularDashboard(rows) {
  const porCategoria = agrupar(rows, 'CATEGORIA', 'SIN CATEGORÍA');
  return {
    kpis: calcularKpis(rows),
    porEstado: agrupar(rows, 'ESTADO'),
    porCategoria,
    porPrioridad: agrupar(rows, 'PRIORIDAD', 'SIN PRIORIDAD'),
    porMedio: agrupar(rows, 'MEDIO', 'SIN MEDIO'),
    porTecnico: agrupar(rows, 'RESPONSABLE DE ATENCION', 'SIN RESPONSABLE'),
    facultades: tablaFacultades(rows),
    historico: historicoDiario(rows, porCategoria.map(c => c.label)),
    arbol: construirArbolCategorias(rows)
  };
}

export function colorCategoria(i) { return PALETA[i % PALETA.length]; }

/** Tickets por día (FECHA REC) apilados por categoría. */
export function historicoDiario(rows, categorias) {
  const dias = new Map();
  rows.forEach(r => {
    const f = String(r['FECHA REC'] || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    const cat = String(r.CATEGORIA || '').trim() || 'SIN CATEGORÍA';
    if (!dias.has(f)) dias.set(f, new Map());
    const c = dias.get(f);
    c.set(cat, (c.get(cat) || 0) + 1);
  });
  const fechas = [...dias.keys()].sort();
  const variosAnios = new Set(fechas.map(f => f.slice(0, 4))).size > 1;
  const labels = fechas.map(f => {
    const [y, m, d] = f.split('-');
    return `${d}/${m}${variosAnios ? '/' + y.slice(2) : ''}`;
  });
  const series = categorias.map((cat, i) => ({
    label: cat,
    data: fechas.map(f => dias.get(f).get(cat) || 0),
    backgroundColor: colorCategoria(i),
    stack: 'dia'
  }));
  return { labels, series };
}

export function tablaFacultades(rows) {
  const m = new Map();
  rows.forEach(r => {
    const fac = String(r['FACULTAD DEPENDENCIA'] ?? '').trim() || 'SIN DATO';
    if (!m.has(fac)) m.set(fac, { fac, predio: '', tickets: 0, alumnos: 0, admin: 0 });
    const f = m.get(fac);
    if (!f.predio && r.PREDIO !== '' && r.PREDIO != null) f.predio = String(r.PREDIO);
    f.tickets++;
    if (r.SOLICITANTE === 'ALUMNO') f.alumnos++;
    else if (r.SOLICITANTE === 'ADMINISTRATIVO') f.admin++;
  });
  return [...m.values()]
    .map(f => ({ ...f, predio: f.predio || '0' }))
    .sort((a, b) => b.tickets - a.tickets || a.fac.localeCompare(b.fac));
}

/** Categoría → Sub categoría → SS categoría, con conteos ordenados. */
export function construirArbolCategorias(rows) {
  const tree = new Map();
  rows.forEach(r => {
    const cat = String(r.CATEGORIA || '').trim() || 'SIN CATEGORÍA';
    const sub = String(r['SUB CATEGORIA'] || '').trim() || 'SIN SUBCATEGORÍA';
    const ss = String(r['SS CATEGORIA'] || '').trim() || 'SIN SS CATEGORÍA';
    if (!tree.has(cat)) tree.set(cat, { name: cat, count: 0, map: new Map() });
    const c = tree.get(cat); c.count++;
    if (!c.map.has(sub)) c.map.set(sub, { name: sub, count: 0, map: new Map() });
    const s = c.map.get(sub); s.count++;
    s.map.set(ss, (s.map.get(ss) || 0) + 1);
  });
  const ord = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
  return [...tree.values()].sort(ord).map(c => ({
    name: c.name, count: c.count,
    subs: [...c.map.values()].sort(ord).map(s => ({
      name: s.name, count: s.count,
      ss: [...s.map.entries()].map(([name, count]) => ({ name, count })).sort(ord)
    }))
  }));
}

/* ---------------- Configuraciones Chart.js ---------------- */

const PRIO_COLOR = { BAJO: '#0EA5E9', BAJA: '#0EA5E9', MEDIO: '#F59E0B', MEDIA: '#F59E0B', ALTO: '#F43F5E', ALTA: '#F43F5E', 'SIN PRIORIDAD': '#94A3B8' };

/** `pdf: true` desactiva animaciones y fija la resolución para exportar a imagen. */
export function chartConfigs(d, { pdf = false } = {}) {
  const fs = pdf ? 6.5 : 10;            // tamaño de letra de leyendas y ejes
  const box = pdf ? 6 : 10;
  const legend = { position: 'bottom', labels: { boxWidth: box, boxHeight: box, padding: pdf ? 5 : 8, font: { size: fs } } };
  const base = pdf
    ? { animation: false, responsive: false, devicePixelRatio: 3, maintainAspectRatio: false }
    : { responsive: true, maintainAspectRatio: false };

  const historico = {
    type: 'bar',
    data: { labels: d.historico.labels, datasets: d.historico.series },
    options: {
      ...base,
      plugins: { legend, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: pdf ? { font: { size: 5.5 }, maxRotation: 0, minRotation: 0, autoSkip: false } : { font: { size: fs } } },
        y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { precision: 0, font: { size: fs } } }
      }
    }
  };

  const prioridad = {
    type: 'doughnut',
    data: { labels: d.porPrioridad.map(p => p.label), datasets: [{ data: d.porPrioridad.map(p => p.count), backgroundColor: d.porPrioridad.map(p => PRIO_COLOR[p.label] || '#94A3B8'), borderWidth: 2, borderColor: '#fff' }] },
    options: { ...base, cutout: '65%', plugins: { legend } }
  };

  const concentracion = {
    type: 'bar',
    data: { labels: d.porCategoria.map(c => c.label), datasets: [{ data: d.porCategoria.map(c => c.count), backgroundColor: d.porCategoria.map((_, i) => colorCategoria(i)), borderRadius: 3, maxBarThickness: pdf ? 10 : 16 }] },
    options: {
      ...base, indexAxis: 'y', plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#F1F5F9' }, ticks: { precision: 0, font: { size: fs } } },
        y: { grid: { display: false }, ticks: { font: { size: pdf ? fs : 9 } } }
      }
    }
  };

  const medio = {
    type: 'doughnut',
    data: { labels: d.porMedio.map(m => m.label), datasets: [{ data: d.porMedio.map(m => m.count), backgroundColor: d.porMedio.map((_, i) => colorCategoria(i)), borderWidth: 2, borderColor: '#fff' }] },
    options: { ...base, cutout: '65%', plugins: { legend } }
  };

  return { historico, prioridad, concentracion, medio };
}
