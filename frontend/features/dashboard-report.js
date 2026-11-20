import { loadPdfLibraries } from '../services/libraries.js';
import { chartConfigs, fmtPct, periodoTexto } from './dashboard-metrics.js';

/* ================================================================
   Reporte PDF de la Bitácora (A4 vertical).
   - Sin Anexo 1: pág. 1 resumen + pág. 2 Facultad/Dependencia.
   - Con Anexo 1: lo anterior + detalle Categoría · Sub Categoría · SS Categoría.
   Recibe los datos ya calculados por el dashboard (mismos números que en pantalla).
   ================================================================ */

const NARANJA = [235, 89, 13];
const TEXTO = [30, 41, 59];
const GRIS = [100, 116, 139];
const CEBRA = [242, 245, 250];
const CAT_FONDO = [255, 237, 214];
const FOOTER_ORG = 'Oficina Central de Gestión de Tecnologías de la Información (OCGTI)';

export async function exportInformePDF({ rows, data: d, filtros, incluirAnexo }) {
  if (!rows || rows.length === 0) throw new Error('No hay datos en el dashboard para exportar.');

  await loadPdfLibraries();
  // El logo es opcional: si el archivo no está, el reporte se genera sin él.
  const logo = await import('../assets/logo-unfv.js').catch(() => null);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const M = 32;                         // margen lateral
  const W = pageW - M * 2;              // ancho útil
  const GAP = 14;
  const COLW = (W - GAP) / 2;           // ancho de cada columna
  const XR = M + COLW + GAP;            // x de la columna derecha
  const TOP = 70;                       // inicio de contenido bajo la cabecera
  const BOTTOM = pageH - 30;            // límite inferior antes del pie

  const periodo = periodoTexto(filtros.mes, filtros.anio);
  const generado = new Date().toLocaleString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  /* ---------- helpers de dibujo ---------- */
  const setText = (size, style = 'normal', color = TEXTO) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
  };

  /** Título de sección: `top` es la parte superior del texto; devuelve dónde empieza el contenido. */
  function titulo(texto, x, top) {
    setText(10, 'bold');
    doc.text(texto, x, top + 8);
    return top + 16;
  }

  /** Dibuja un gráfico Chart.js fuera de pantalla y devuelve su PNG. */
  function imagenGrafico(config, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const chart = new Chart(canvas, config);
    const url = canvas.toDataURL('image/png');
    chart.destroy();
    return url;
  }

  const estiloTabla = {
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 }, textColor: TEXTO, lineWidth: 0, overflow: 'linebreak' },
    headStyles: { fillColor: NARANJA, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CEBRA },
    margin: { top: TOP, bottom: 30 }
  };

  /** Tabla «Etiqueta · Cant. · %». Los encabezados van a la izquierda y los valores a la derecha. */
  function tablaConteo(titulos, filas, x, y, ancho) {
    doc.autoTable({
      ...estiloTabla,
      head: [titulos],
      body: filas.map(f => [f.label, f.count.toLocaleString('es-PE'), fmtPct(f.pct)]),
      startY: y,
      margin: { ...estiloTabla.margin, left: x, right: pageW - x - ancho },
      tableWidth: ancho,
      columnStyles: { 0: { cellWidth: ancho - 80 }, 1: { cellWidth: 40, halign: 'right' }, 2: { cellWidth: 40, halign: 'right' } },
      didParseCell: h => { if (h.section === 'head') h.cell.styles.halign = 'left'; }
    });
    return doc.lastAutoTable.finalY;
  }

  /** Salta de página si el bloque que sigue no cabe. */
  function reservar(y, necesario) {
    if (y + necesario > BOTTOM) { doc.addPage(); return TOP; }
    return y;
  }

  /* ================= PÁGINA 1 ================= */
  const cfg = chartConfigs(d, { pdf: true });
  let y = 68;

  // --- KPIs ---
  const k = d.kpis;
  const kpis = [
    ['TOTAL TICKETS', k.total.toLocaleString('es-PE')],
    ['TASA DE RESOLUCIÓN', fmtPct(k.tasaResolucion)],
    ['TIEMPO MEDIO (MTTR)', k.mttr.toFixed(1) + ' h'],
    ['RESUELTO MISMO DÍA', fmtPct(k.mismoDia)]
  ];
  const kGap = 8, kW = (W - kGap * 3) / 4, kH = 42;
  kpis.forEach(([label, valor], i) => {
    const x = M + i * (kW + kGap);
    doc.setFillColor(...CEBRA);
    doc.roundedRect(x, y, kW, kH, 3, 3, 'F');
    doc.setFillColor(...NARANJA);
    doc.rect(x, y, 3, kH, 'F');
    setText(6.5, 'normal', GRIS);
    doc.text(label, x + 8, y + 14);
    setText(13, 'bold', [15, 23, 42]);
    doc.text(valor, x + 8, y + 33);
  });
  y += kH + 16;

  // --- Histórico diario ---
  y = titulo('Histórico diario de tickets por categoría', M, y);
  const hH = 130;
  doc.addImage(imagenGrafico(cfg.historico, W, hH), 'PNG', M, y, W, hH);
  y += hH + 12;

  // --- Prioridad de respuesta | Detalle por estado ---
  const donutH = 115;
  y = reservar(y, 16 + donutH);
  let yc = titulo('Prioridad de respuesta', M, y);
  titulo('Detalle por estado', XR, y);
  doc.addImage(imagenGrafico(cfg.prioridad, COLW, donutH), 'PNG', M, yc, COLW, donutH);
  const finEstado = tablaConteo(['Estado', 'Cant.', '%'], d.porEstado, XR, yc, COLW);
  y = Math.max(yc + donutH, finEstado) + 12;

  // --- Categoría (resumen) | Concentración por categoría ---
  const filaH = 15;
  const tablaCatH = (d.porCategoria.length + 1) * filaH;
  y = reservar(y, 30 + Math.max(tablaCatH, 120));
  titulo('Categoría · Sub Categoría · SS Categoría', M, y);
  titulo('Concentración por categoría', XR, y);
  setText(7, 'normal', GRIS);
  doc.text('Toca cada nivel para expandir. El % es relativo a su nivel superior.' + (incluirAnexo ? ' Para mayor detalle, visualiza el Anexo 1.' : ''), M, y + 27);
  yc = y + 36;
  const finCat = tablaConteo(['Categoría', 'Cant.', '%'], d.porCategoria, M, yc, COLW);
  const gH = Math.max(120, finCat - yc);
  doc.addImage(imagenGrafico(cfg.concentracion, COLW, gH), 'PNG', XR, yc, COLW, gH);
  y = Math.max(finCat, yc + gH) + 12;

  // --- Canal de recepción | Carga por responsable ---
  const necesarioCanal = 16 + Math.max(donutH, (d.porTecnico.length + 1) * filaH);
  y = reservar(y, necesarioCanal);
  yc = titulo('Canal de recepción', M, y);
  titulo('Carga por responsable de atención', XR, y);
  doc.addImage(imagenGrafico(cfg.medio, COLW, donutH), 'PNG', M, yc, COLW, donutH);
  tablaConteo(['Responsable', 'Cant.', '%'], d.porTecnico, XR, yc, COLW);

  /* ================= PÁGINA 2: Facultad / Dependencia ================= */
  doc.addPage();
  y = titulo('Tickets por Facultad/Dependencia', M, TOP);
  doc.autoTable({
    ...estiloTabla,
    styles: { ...estiloTabla.styles, fontSize: 7 },
    head: [['Facultad/Dependencia', 'Predio', 'Tickets', 'Alumnos', 'Administrativos']],
    body: d.facultades.map(f => [f.fac, f.predio, String(f.tickets), String(f.alumnos), String(f.admin)]),
    startY: y,
    margin: { ...estiloTabla.margin, left: M, right: M },
    tableWidth: W,
    columnStyles: {
      0: { cellWidth: W - 55 * 3 - 91 },
      1: { cellWidth: 55, halign: 'center' },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 55, halign: 'center' },
      4: { cellWidth: 91, halign: 'right' }
    },
    didParseCell: h => { if (h.section === 'head') h.cell.styles.halign = 'left'; }
  });

  /* ================= ANEXO 1 (opcional) ================= */
  if (incluirAnexo) {
    doc.addPage();
    y = titulo('Anexo 1 — Categoría · Sub Categoría · SS Categoría (detalle expandido)', M, TOP);
    setText(7, 'normal', GRIS);
    doc.text('El % de Sub Categoría es relativo a su Categoría. El % de SS Categoría es relativo a su Sub Categoría.', M, y + 3);

    const filasAnexo = [];   // [nivel, nombre, cantidad, porcentaje]
    const pct = (n, base) => fmtPct(base ? n / base * 100 : 0);
    d.arbol.forEach(cat => {
      filasAnexo.push([0, cat.name, cat.count, pct(cat.count, k.total)]);
      cat.subs.forEach(sub => {
        filasAnexo.push([1, sub.name, sub.count, pct(sub.count, cat.count)]);
        sub.ss.forEach(ss => filasAnexo.push([2, '•  ' + ss.name, ss.count, pct(ss.count, sub.count)]));
      });
    });

    doc.autoTable({
      ...estiloTabla,
      head: [['Categoría / Sub Categoría / SS Categoría', 'Cant.', '%']],
      body: filasAnexo.map(f => [f[1], f[2].toLocaleString('es-PE'), f[3]]),
      startY: y + 11,
      margin: { ...estiloTabla.margin, left: M, right: M },
      tableWidth: W,
      columnStyles: { 0: { cellWidth: W - 112 }, 1: { cellWidth: 56, halign: 'right' }, 2: { cellWidth: 56, halign: 'right' } },
      didParseCell: h => {
        if (h.section === 'head') { h.cell.styles.halign = 'left'; return; }
        if (h.section !== 'body') return;
        const nivel = filasAnexo[h.row.index][0];
        if (nivel === 0) {
          h.cell.styles.fontStyle = 'bold';
          h.cell.styles.fillColor = CAT_FONDO;
        } else if (nivel === 1) {
          h.cell.styles.textColor = [51, 65, 85];
          if (h.column.index === 0) h.cell.styles.cellPadding = { ...estiloTabla.styles.cellPadding, left: 14 };
        } else {
          h.cell.styles.textColor = GRIS;
          if (h.column.index === 0) h.cell.styles.cellPadding = { ...estiloTabla.styles.cellPadding, left: 22 };
        }
      }
    });
  }

  /* ================= CABECERA Y PIE EN TODAS LAS PÁGINAS ================= */
  const total = doc.internal.getNumberOfPages();
  const logoW = 90, logoH = logo ? logoW * logo.LOGO_UNFV_RATIO : 0;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    doc.setFillColor(...NARANJA);
    doc.rect(0, 0, pageW, 54, 'F');
    setText(12, 'bold', [255, 255, 255]);
    doc.text('Sistema de Reportes de la BITACORA de OCGTI', M, 24.5);
    setText(8.5, 'normal', [255, 255, 255]);
    doc.text(`Periodo: ${periodo}` + (filtros.tec ? `  ·  Responsable: ${filtros.tec}` : ''), M, 39);
    doc.text(`Generado: ${generado}`, M, 50);
    if (logo) doc.addImage(logo.LOGO_UNFV_DATA_URL, 'PNG', pageW - M - logoW, (54 - logoH) / 2, logoW, logoH);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 24, pageW - M, pageH - 24);
    setText(7, 'normal', GRIS);
    doc.text(FOOTER_ORG, M, pageH - 10);
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 10, { align: 'right' });
  }

  const nombre = `Reporte-BITACORA-OCGTI-${periodo.replace(/\s+/g, '_')}${filtros.tec ? '_' + filtros.tec.replace(/\s+/g, '_') : ''}.pdf`;
  doc.save(nombre);
}
