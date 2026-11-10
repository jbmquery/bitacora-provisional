import { $ } from '../components/dom.js';
import { loadPdfLibraries } from '../services/libraries.js';
import { ESTADOS_RESUELTOS } from '../config/app-config.js';

export async function exportInformePDF(){
  if(!window._dbRows||window._dbRows.length===0){
    alert('No hay datos en el dashboard para exportar. Aplica los filtros primero.');
    return;
  }

  // Preguntar si incluir Anexo 1
  const incluirAnexo = confirm('¿Desea incluir el Anexo 1 (detalle expandido de Categoría · Sub Categoría · SS Categoría) en el informe?');

  const btn=$('#dbExport');
  const prevText=btn.innerHTML;
  btn.disabled=true;
  btn.textContent='Preparando informe…';

  try {
    await loadPdfLibraries();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 30;
    const contentW = pageW - marginX * 2;

    const tec = $('#dbTec').value || 'Todos los técnicos';
    const mes = $('#dbMes').value || 'Todos';
    const anio = $('#dbAnio').value || 'Todos';
    const mesLabel = mes && mes !== '' ? mes.charAt(0) + mes.slice(1).toLowerCase() : 'Todos los meses';
    const anioLabel = anio && anio !== '' ? anio : 'Todos los años';
    const periodoLabel = `${mesLabel} ${anioLabel}`;
    const generado = new Date().toLocaleString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const rows = window._dbRows;

    const FOOTER_ORG = 'Oficina Central de Gestión de Tecnologías de la Información (OCGTI)';


    // ========== UTILIDADES ==========
    const agrupar = (arr, campo) => {
      const m = new Map();
      arr.forEach(r => { const k = r[campo] || 'SIN DATO'; m.set(k, (m.get(k) || 0) + 1); });
      const t = arr.length;
      return Array.from(m.entries()).map(([l, c]) => ({ label: l, count: c, pct: t ? (c / t * 100) : 0 })).sort((a, b) => b.count - a.count);
    };

    function getCanvasCapture(id){
      const c = document.getElementById(id);
      if(!c||!c.width||!c.height) return null;
      try {
        return { dataUrl: c.toDataURL('image/png', 1.0), ratio: c.height / c.width };
      } catch(e){ return null; }
    }

    function drawReportHeader(pageNum){
      // Title band
      doc.setFillColor(3, 105, 161);
      doc.rect(0, 0, pageW, 60, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Sistema de Reportes de la BITACORA de OCGTI', marginX, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Periodo: ${periodoLabel}`, marginX, 35);
      doc.text(`Generado: ${generado}`, marginX, 47);
      if(tec !== 'Todos los técnicos'){
        doc.text(`Técnico: ${tec}`, pageW - marginX, 35, { align: 'right' });
      }
    }

    function drawFooter(pageNum){
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(marginX, pageH - 24, pageW - marginX, pageH - 24);
      doc.text(FOOTER_ORG, marginX, pageH - 12);
      doc.text(`Página ${pageNum}`, pageW - marginX, pageH - 12, { align: 'right' });
    }

    function sectionTitle(title, posY){
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(3, 105, 161);
      doc.text(title, marginX, posY);
      doc.setDrawColor(3, 105, 161);
      doc.setLineWidth(0.7);
      doc.line(marginX, posY + 3, marginX + contentW, posY + 3);
      return posY + 15;
    }

    function checkPageBreak(y, needed){
      if(y + needed > pageH - 35){
        currentPageNum++;
        doc.addPage();
        drawReportHeader(currentPageNum);
        drawFooter(currentPageNum);
        return 75;
      }
      return y;
    }

    let currentPageNum = 1;

    // ========== CÁLCULOS ==========
    const total = rows.length;
    const resueltos = rows.filter(r => ESTADOS_RESUELTOS.includes(r.ESTADO)).length;
    const tasaRes = total ? (resueltos / total * 100) : 0;
    const pendientes = rows.filter(r => r.ESTADO === 'PENDIENTE DE USUARIO' || r.ESTADO === 'EN ESPERA').length;
    const enCurso = rows.filter(r => r.ESTADO === 'EN CURSO').length;

    // MTTR calculation (approximate from FECHA REC to FECHA FINAL/FECHA CIERRE)
    let mttrHours = 0;
    let mttrCount = 0;
    let sameDayCount = 0;
    rows.forEach(r => {
      const fRec = r['FECHA REC'];
      const fFin = r['FECHA FINAL'] || r['FECHA CIERRE'];
      if(fRec && fFin){
        const dRec = new Date(fRec);
        const dFin = new Date(fFin);
        if(!isNaN(dRec) && !isNaN(dFin) && dFin >= dRec){
          const diffH = (dFin - dRec) / (1000 * 60 * 60);
          mttrHours += diffH;
          mttrCount++;
          if(dRec.toDateString() === dFin.toDateString()) sameDayCount++;
        }
      }
    });
    const mttr = mttrCount > 0 ? (mttrHours / mttrCount) : 0;
    const sameDayPct = mttrCount > 0 ? (sameDayCount / mttrCount * 100) : 0;

    const porEstado = agrupar(rows, 'ESTADO');
    const porCategoria = agrupar(rows, 'CATEGORIA');
    const porMedio = agrupar(rows, 'MEDIO');
    const porPrioridad = agrupar(rows, 'PRIORIDAD');
    const porTecnico = agrupar(rows, 'RESPONSABLE DE ATENCION');
    const porFacultad = agrupar(rows, 'FACULTAD DEPENDENCIA');

    // ========== PÁGINA 1 ==========
    drawReportHeader(1);
    drawFooter(1);

    let y = 75;

    // --- 4 KPI Cards ---
    const kpis = [
      { label: 'TOTAL TICKETS', val: total.toLocaleString('es-PE'), color: [13, 148, 136] },
      { label: 'TASA DE RESOLUCIÓN', val: tasaRes.toFixed(1) + '%', color: [14, 165, 233] },
      { label: 'TIEMPO MEDIO (MTTR)', val: mttr.toFixed(1) + ' h', color: [139, 92, 246] },
      { label: 'RESUELTO MISMO DÍA', val: sameDayPct.toFixed(1) + '%', color: [245, 158, 11] }
    ];

    const gap = 8;
    const cardW = (contentW - gap * 3) / 4;
    const cardH = 48;

    kpis.forEach((kp, i) => {
      const x = marginX + i * (cardW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');

      doc.setFillColor(...kp.color);
      doc.rect(x, y, 3.5, cardH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kp.label, x + 10, y + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text(kp.val, x + 10, y + 36);
    });
    y += cardH + 18;

    // --- Histórico diario (chart) ---
    y = sectionTitle('Histórico diario de tickets por categoría', y);
    const capCat = getCanvasCapture('dbChartCategoria');
    if(capCat){
      const chartW = contentW;
      const chartH = Math.min(chartW * capCat.ratio, 140);
      doc.addImage(capCat.dataUrl, 'PNG', marginX, y, chartW, chartH);
      y += chartH + 12;
    } else {
      y += 8;
    }

    // --- Prioridad + Detalle por estado (side by side) ---
    const colW = (contentW - 14) / 2;

    y = sectionTitle('Prioridad de respuesta', y);
    const prioStartY = y;

    const capPrio = getCanvasCapture('dbChartPrioridad');
    if(capPrio){
      const pW = Math.min(colW - 20, 150);
      const pH = Math.min(pW * capPrio.ratio, 120);
      doc.addImage(capPrio.dataUrl, 'PNG', marginX + (colW - pW) / 2, y, pW, pH);
      y += pH + 8;
    }

    // Detalle por estado - tabla a la derecha
    const xRight = marginX + colW + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(3, 105, 161);
    doc.text('Detalle por estado', xRight, prioStartY - 2);

    doc.autoTable({
      head: [['Estado', 'Cant.', '%']],
      body: porEstado.map(e => [e.label, String(e.count), e.pct.toFixed(1) + '%']),
      startY: prioStartY,
      margin: { left: xRight, right: marginX },
      tableWidth: colW,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.4 },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
    });
    const estadoTableEnd = doc.lastAutoTable.finalY;
    y = Math.max(y, estadoTableEnd) + 14;

    // --- Categoría tabla + gráfico concentración ---
    y = checkPageBreak(y, 200);
    y = sectionTitle('Categoría · Sub Categoría · SS Categoría', y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Toca cada nivel para expandir. El % es relativo a su nivel superior. Para mayor detalle, visualiza el Anexo 1.', marginX, y);
    y += 10;

    const catStartY = y;

    // Categoría tabla izquierda
    doc.autoTable({
      head: [['Categoría', 'Cant.', '%']],
      body: porCategoria.map(c => [c.label, String(c.count), c.pct.toFixed(1) + '%']),
      startY: catStartY,
      margin: { left: marginX, right: pageW - (marginX + colW) },
      tableWidth: colW,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.4 },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
    });
    const catTableEnd = doc.lastAutoTable.finalY;

    // Concentración por categoría - gráfico derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(3, 105, 161);
    doc.text('Concentración por categoría', xRight, catStartY - 2);

    if(capCat){
      const gW = colW;
      const gH = Math.min(gW * capCat.ratio, catTableEnd - catStartY);
      doc.addImage(capCat.dataUrl, 'PNG', xRight, catStartY, gW, Math.max(gH, 100));
    }

    y = catTableEnd + 14;

    // --- Canal de recepción + Carga por responsable ---
    y = checkPageBreak(y, 180);
    y = sectionTitle('Canal de recepción', y);
    const canalStartY = y;

    const capMedio = getCanvasCapture('dbChartMedio');
    if(capMedio){
      const mW = Math.min(colW - 20, 150);
      const mH = Math.min(mW * capMedio.ratio, 120);
      doc.addImage(capMedio.dataUrl, 'PNG', marginX + (colW - mW) / 2, y, mW, mH);
      y += mH + 8;
    }

    // Carga por responsable - tabla derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(3, 105, 161);
    doc.text('Carga por responsable de atención', xRight, canalStartY - 2);

    doc.autoTable({
      head: [['Responsable', 'Cant.', '%']],
      body: porTecnico.map(t => [t.label, String(t.count), t.pct.toFixed(1) + '%']),
      startY: canalStartY,
      margin: { left: xRight, right: marginX },
      tableWidth: colW,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.4 },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
    });
    const tecTableEnd = doc.lastAutoTable.finalY;
    y = Math.max(y, tecTableEnd) + 14;

    // ========== PÁGINA 2: Facultad/Dependencia ==========
    currentPageNum++;
    doc.addPage();
    drawReportHeader(currentPageNum);
    drawFooter(currentPageNum);
    y = 75;

    y = sectionTitle('Tickets por Facultad/Dependencia', y);

    // Build faculty data with predio, alumnos, administrativos
    const facMap = new Map();
    rows.forEach(r => {
      const fac = r['FACULTAD DEPENDENCIA'] || 'SIN DATO';
      if(!facMap.has(fac)) facMap.set(fac, { tickets: 0, predio: r.PREDIO || '0', alumnos: 0, admin: 0 });
      const f = facMap.get(fac);
      f.tickets++;
      if(r.SOLICITANTE === 'ALUMNO') f.alumnos++;
      else if(r.SOLICITANTE === 'ADMINISTRATIVO') f.admin++;
    });
    const facData = Array.from(facMap.entries())
      .map(([k, v]) => ({ fac: k, predio: v.predio, tickets: v.tickets, alumnos: v.alumnos, admin: v.admin }))
      .sort((a, b) => b.tickets - a.tickets);

    doc.autoTable({
      head: [['Facultad/Dependencia', 'Predio', 'Tickets', 'Alumnos', 'Administrativos']],
      body: facData.map(f => [f.fac, f.predio, String(f.tickets), String(f.alumnos), String(f.admin)]),
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.4, overflow: 'linebreak' },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'right', cellWidth: 55 },
        3: { halign: 'right', cellWidth: 65 },
        4: { halign: 'right', cellWidth: 85 }
      },
      didDrawPage: (data) => {
        // handle page breaks within the table
        if(data.pageNumber > 1){
          currentPageNum++;
          drawReportHeader(currentPageNum);
          drawFooter(currentPageNum);
        }
      }
    });

    // ========== ANEXO 1 (si el usuario lo pidió) ==========
    if(incluirAnexo){
      currentPageNum++;
      doc.addPage();
      drawReportHeader(currentPageNum);
      drawFooter(currentPageNum);
      y = 75;

      y = sectionTitle('Anexo 1 — Categoría · Sub Categoría · SS Categoría (detalle expandido)', y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('El % de Sub Categoría es relativo a su Categoría. El % de SS Categoría es relativo a su Sub Categoría.', marginX, y);
      y += 12;

      // Build the category tree
      const catTree = buildCategoryTree(rows);
      const anexoBody = [];

      catTree.forEach(cat => {
        // Category row
        anexoBody.push({
          cells: [cat.name, String(cat.count), (cat.count / total * 100).toFixed(1) + '%'],
          level: 0
        });
        cat.subs.forEach(sub => {
          // Sub category row
          const subPct = cat.count > 0 ? (sub.count / cat.count * 100).toFixed(1) + '%' : '0.0%';
          anexoBody.push({
            cells: ['     ' + sub.name, String(sub.count), subPct],
            level: 1
          });
          sub.ssCats.forEach(ss => {
            // SS category row
            const ssPct = sub.count > 0 ? (ss.count / sub.count * 100).toFixed(1) + '%' : '0.0%';
            anexoBody.push({
              cells: ['          •  ' + ss.name, String(ss.count), ssPct],
              level: 2
            });
          });
        });
      });

      doc.autoTable({
        head: [['Categoria / Sub Categoria / SS Categoria', 'Cant.', '%']],
        body: anexoBody.map(r => r.cells),
        startY: y,
        margin: { left: marginX, right: marginX, top: 75, bottom: 35 },
        tableWidth: contentW,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.4, overflow: 'linebreak' },
        headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: contentW - 120 },
          1: { halign: 'right', cellWidth: 60 },
          2: { halign: 'right', cellWidth: 60 }
        },
        didParseCell: (data) => {
          if(data.section === 'body'){
            const rowData = anexoBody[data.row.index];
            if(rowData){
              if(rowData.level === 0){
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [241, 245, 249];
              } else if(rowData.level === 1){
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [51, 65, 85];
              } else {
                data.cell.styles.textColor = [100, 116, 139];
              }
            }
          }
        },
        didDrawPage: (data) => {
          if(data.pageNumber > 1){
            currentPageNum++;
          }
          drawReportHeader(currentPageNum);
          drawFooter(currentPageNum);
        }
      });
    } // end if(incluirAnexo)

    // ========== FIX PAGE NUMBERS ==========
    const totalPages = doc.internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++){
      doc.setPage(i);
      // Redraw footer with correct total
      doc.setFillColor(255, 255, 255);
      doc.rect(pageW - marginX - 100, pageH - 22, 100, 14, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Página ${i} de ${totalPages}`, pageW - marginX, pageH - 12, { align: 'right' });
    }

    const filename = `informe_bitacora_OCGTI_${periodoLabel.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  } catch(err){
    console.error('Error al generar Informe PDF:', err);
    alert('Ocurrió un error al generar el informe. Revisa la consola para más detalles.');
  } finally {
    btn.disabled=false;
    btn.innerHTML=prevText;
  }
}

/* ---------- Construir árbol de categorías ---------- */
function buildCategoryTree(rows){
  const tree = new Map();

  rows.forEach(r => {
    const cat = r.CATEGORIA || 'SIN CATEGORÍA';
    const sub = r['SUB CATEGORIA'] || 'SIN SUBCATEGORÍA';
    const ss = r['SS CATEGORIA'] || 'SIN SS CATEGORÍA';

    if(!tree.has(cat)) tree.set(cat, { name: cat, count: 0, subsMap: new Map() });
    const catNode = tree.get(cat);
    catNode.count++;

    if(!catNode.subsMap.has(sub)) catNode.subsMap.set(sub, { name: sub, count: 0, ssMap: new Map() });
    const subNode = catNode.subsMap.get(sub);
    subNode.count++;

    if(!subNode.ssMap.has(ss)) subNode.ssMap.set(ss, { name: ss, count: 0 });
    subNode.ssMap.get(ss).count++;
  });

  // Convert maps to sorted arrays
  return Array.from(tree.values())
    .sort((a, b) => b.count - a.count)
    .map(cat => ({
      ...cat,
      subs: Array.from(cat.subsMap.values())
        .sort((a, b) => b.count - a.count)
        .map(sub => ({
          ...sub,
          ssCats: Array.from(sub.ssMap.values()).sort((a, b) => b.count - a.count)
        }))
    }));
}

/* ================================================================
   DASHBOARD: applyDashboard (render gráficos y tablas)
   ================================================================ */

