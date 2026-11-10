import { api as defaultApi } from '../services/api.js';
import { $, unique as uniq, escapeHtml as esc, setOptions as opts, show, setValue as sv } from '../components/dom.js';
import { loadChartJs } from '../services/libraries.js';
import { exportInformePDF } from './dashboard-report.js';
import { ESTADOS_RESUELTOS, MESES, PALETA } from '../config/app-config.js';

export function createDashboardFeature({ state, api = defaultApi }) {
let dbCharts={};
let dbFiltersInitialized=false;

function initDashboardFilters(){
  if(dbFiltersInitialized) return;
  dbFiltersInitialized=true;

  // Técnicos
  const tecNames=state.data.usuarios?state.data.usuarios.map(u=>u.nombre).sort((a,b)=>a.localeCompare(b)):[];
  opts($('#dbTec'),tecNames,'TODOS');

  // Meses y Años
  const ms=uniq(state.data.hojas.map(h=>h.split('-')[1])).sort((a,b)=>MESES.indexOf(a)-MESES.indexOf(b));
  opts($('#dbMes'),ms,'TODOS');
  opts($('#dbAnio'),uniq(state.data.hojas.map(h=>h.split('-')[0])).sort(),'TODOS');
  const n=new Date();sv($('#dbMes'),MESES[n.getMonth()]);sv($('#dbAnio'),String(n.getFullYear()));

  // Aplicar filtros al hacer clic
  $('#dbApply').onclick=applyDashboard;

  // Exportar dashboard: Informe + Anexo
  $('#dbExport').onclick=exportInformePDF;

  loadChartJs()
    .then(applyDashboard)
    .catch(error=>{
      dbFiltersInitialized=false;
      console.error('No se pudo cargar el gráfico del dashboard:',error);
      show('#dbAlerta',true);
      $('#dbAlerta').textContent=error.message||'No se pudo cargar el dashboard.';
    });
}

async function applyDashboard(){
  const tec=$('#dbTec').value;
  const mes=$('#dbMes').value;
  const anio=$('#dbAnio').value;

  // Fetch data
  const btn=$('#dbApply');
  btn.disabled=true;btn.querySelector('span')||btn.classList.add('opacity-70');
  const r=await api('buscar',{q:'',resp:tec||'',mes:mes||'',anio:anio||'',estado:''});
  btn.disabled=false;btn.classList.remove('opacity-70');
  if(!r.ok){alert(r.msg);return;}
  const rows=r.rows;
  window._dbRows=rows;

  if(rows.length===0){
    show('#dbGrid',false);show('#dbEmpty',true);show('#dbAlerta',false);
    return;
  }
  show('#dbEmpty',false);show('#dbGrid',true);

  // ---- Calcular KPIs ----
  const total=rows.length;
  const resueltos=rows.filter(r=>ESTADOS_RESUELTOS.includes(r.ESTADO)).length;
  const tasaRes=total?(resueltos/total*100):0;
  const pendientes=rows.filter(r=>r.ESTADO==='PENDIENTE DE USUARIO'||r.ESTADO==='EN ESPERA').length;
  const enCurso=rows.filter(r=>r.ESTADO==='EN CURSO').length;

  $('#dbKpiTotal').textContent=total.toLocaleString('es-PE');
  $('#dbKpiResolucion').textContent=tasaRes.toFixed(1)+'%';
  $('#dbKpiPendientes').textContent=pendientes.toLocaleString('es-PE');
  $('#dbKpiEnCurso').textContent=enCurso.toLocaleString('es-PE');

  // ---- Agrupar datos ----
  const agrupar=(arr,campo)=>{
    const m=new Map();
    arr.forEach(r=>{const k=r[campo]||'SIN DATO';m.set(k,(m.get(k)||0)+1);});
    const t=arr.length;
    return Array.from(m.entries()).map(([l,c])=>({label:l,count:c,pct:t?(c/t*100):0})).sort((a,b)=>b.count-a.count);
  };

  const porCategoria=agrupar(rows,'CATEGORIA');
  const porMedio=agrupar(rows,'MEDIO');
  const porPrioridad=agrupar(rows,'PRIORIDAD');
  const porTecnico=agrupar(rows,'RESPONSABLE DE ATENCION');
  const porTipo=agrupar(rows,'TIPO');
  const porFacultad=agrupar(rows,'FACULTAD DEPENDENCIA');

  // ---- Render tablas ----
  const fmtPct=n=>n.toFixed(1)+'%';
  const renderDbTabla=(container,filas)=>{
    if(!filas.length){container.innerHTML='<tr><td colspan="3" class="py-4 text-center text-slate-400 text-sm">Sin datos</td></tr>';return;}
    container.innerHTML=filas.map(f=>`
      <tr class="border-b border-slate-100 last:border-0">
        <td class="py-2 pr-3 text-sm text-slate-700">${esc(f.label)}</td>
        <td class="py-2 pr-3 text-sm text-slate-500 text-right tabular-nums">${f.count}</td>
        <td class="py-2 text-sm font-mono text-slate-400 text-right">${fmtPct(f.pct)}</td>
      </tr>`).join('');
  };

  renderDbTabla($('#dbTablaTecnico'),porTecnico);
  renderDbTabla($('#dbTablaFacultad'),porFacultad);

  // ---- Render gráficos ----
  // Destruir anteriores
  Object.values(dbCharts).forEach(c=>c&&c.destroy());
  dbCharts={};

  Chart.defaults.color='#64748B';

  // Categoría (barras horizontales)
  dbCharts.categoria=new Chart($('#dbChartCategoria'),{
    type:'bar',
    data:{
      labels:porCategoria.map(c=>c.label),
      datasets:[{data:porCategoria.map(c=>c.count),backgroundColor:porCategoria.map((_,i)=>PALETA[i%PALETA.length]),borderRadius:4,maxBarThickness:22}]
    },
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#F1F5F9'},ticks:{precision:0}},y:{grid:{display:false},ticks:{font:{size:9}}}}}
  });

  // Medio (dona)
  dbCharts.medio=new Chart($('#dbChartMedio'),{
    type:'doughnut',
    data:{
      labels:porMedio.map(m=>m.label),
      datasets:[{data:porMedio.map(m=>m.count),backgroundColor:porMedio.map((_,i)=>PALETA[i%PALETA.length]),borderWidth:2,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:10}}}}}
  });

  // Prioridad (dona)
  const PRIO_COLOR={'BAJO':'#0EA5E9','MEDIO':'#F59E0B','ALTO':'#F43F5E'};
  dbCharts.prioridad=new Chart($('#dbChartPrioridad'),{
    type:'doughnut',
    data:{
      labels:porPrioridad.map(p=>p.label),
      datasets:[{data:porPrioridad.map(p=>p.count),backgroundColor:porPrioridad.map(p=>PRIO_COLOR[p.label]||'#94A3B8'),borderWidth:2,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:10}}}}}
  });

  // Tipo (dona)
  const TIPO_COLOR={'INCIDENTE':'#F43F5E','CONSULTA':'#6366F1','REQUERIMIENTO':'#0D9488'};
  dbCharts.tipo=new Chart($('#dbChartTipo'),{
    type:'doughnut',
    data:{
      labels:porTipo.map(t=>t.label),
      datasets:[{data:porTipo.map(t=>t.count),backgroundColor:porTipo.map(t=>TIPO_COLOR[t.label]||'#94A3B8'),borderWidth:2,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:8,font:{size:10}}}}}
  });

  // ---- Alerta de saturación ----
  if(porTecnico.length&&porTecnico[0].pct>=50){
    show('#dbAlerta',true);
    $('#dbAlerta').innerHTML=`<strong>${esc(porTecnico[0].label)}</strong> concentra el ${fmtPct(porTecnico[0].pct)} de las atenciones. Riesgo de saturación / dependencia crítica de un solo técnico.`;
  } else {
    show('#dbAlerta',false);
  }
}

/* ================================================================
   INICIO
   ================================================================ */

  return { initializeFilters: initDashboardFilters };
}
