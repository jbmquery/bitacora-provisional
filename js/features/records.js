import { api as defaultApi } from '../services/api.js';
import {
  defaultVisibleColumns, getVisibleColumns, saveVisibleColumns
} from '../services/storage.js';
import { $, $$, field as E, unique as uniq, escapeHtml as esc, setOptions as opts, show, setValue as sv } from '../components/dom.js';
import { initializeRecordFilters } from '../components/record-filters.js';
import { createRecordsTable } from '../components/records-table.js';
import { loadPdfLibraries } from '../services/libraries.js';
import { ALL_COLUMNS, FECHAS, F, MESES, SPAN_MAP, TIEMPOS } from '../config/app-config.js';

export function createRecordsFeature({ state, switchView, api = defaultApi }) {
  let mode = 'add';
  let sheet = '';
  const recordsTable = createRecordsTable({
    getColumns: getVisibleColumns,
    getRows: () => state.rows,
    getCategoryId: getCatId,
    getColumnLabel: key => ALL_COLUMNS.find(column => column.key === key)?.label || key,
    onOpenRecord: row => abrir('ver', row)
  });
function applyCase(el,fieldName){
  const isEmail=fieldName==='CORREO';
  const isTextField=el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&el.type==='text');
  if(!isEmail&&!isTextField)return;

  el.classList.add(isEmail?'inp-lower':'inp-upper');
  el.addEventListener('input',()=>{
    const start=el.selectionStart;
    const end=el.selectionEnd;
    el.value=isEmail?el.value.toLowerCase():el.value.toUpperCase();
    el.setSelectionRange(start,end);
  });
}

/* ================================================================
   LOGIN
   ================================================================ */
async function enter(u){
 show('#login',false);
 show('#viewRegistros',true);
 $('#hdrUser').classList.remove('hidden');$('#hdrUser').classList.add('flex');
 $('#navToggle').classList.remove('hidden');
 $('#navTabs').classList.remove('hidden');
 $('#uName').textContent=u.nombre;
 switchView('registros');
 $('#tabRegistros').disabled=true;
 $('#tabDashboard').disabled=true;
 if($('#tabGarantias')) $('#tabGarantias').disabled=true;
 $('#tb').innerHTML='<tr><td colspan="10" class="p-4 text-center text-slate-500">Cargando tus registros…</td></tr>';


 try {
  const response=await api('init');
  if(!response.ok)throw new Error(response.msg||'No se pudo cargar la información de la cuenta.');
  state.data=response;
  armar();
  await iniFiltros();
  $('#tabRegistros').disabled=false;
  $('#tabDashboard').disabled=false;
  if($('#tabGarantias')) $('#tabGarantias').disabled=false;
  Promise.allSettled([
   refreshResponsibles(),
   refreshAvailableStates(),
   buscar()
  ]).then(results=>{
   results.slice(0,2).forEach((result,index)=>{
    if(result.status==='rejected'){
     console.error('No se pudo completar la carga inicial de filtros:',result.reason);
     if(index===1)$('#fEst').replaceChildren(new Option('No se pudieron cargar los estados',''));
    }
   });
  });
 } catch(error) {
  show('#login',true);
  show('#viewRegistros',false);
  $('#hdrUser').classList.add('hidden');
  $('#hdrUser').classList.remove('flex');
  $('#navTabs').classList.add('hidden');
  $('#navTabs').classList.remove('is-open');
  $('#navToggle').classList.add('hidden');
  throw error;
 }
}

/* ================================================================
   FILTROS Y RESULTADOS (REGISTROS)
   ================================================================ */
let refreshResponsibles = async () => {};
let refreshAvailableStates = async () => {};

function iniFiltros(){
 const filters = initializeRecordFilters(state.data, buscar, api);
 refreshResponsibles = filters.refreshResponsibles;
 refreshAvailableStates = filters.refreshStates;
}

/* ---------- CALCULAR ID CATEGORÍA ---------- */
function getCatId(row){
  if(!state.data.categorias) return '';
  const c=state.data.categorias.find(c=>c.CATEGORIA===row.CATEGORIA && c.SUB_CATEGORIA===row['SUB CATEGORIA'] && c.SS_CATEGORIA===row['SS CATEGORIA']);
  return c?c.id:'';
}

async function buscar(){
 $('#tb').innerHTML=`<tr><td colspan="10" class="p-4 text-center text-slate-500">Cargando…</td></tr>`;
 const r=await api('buscar',{q:$('#q').value.trim(),resp:$('#fResp').value,mes:$('#fMes').value,anio:$('#fAnio').value,estado:$('#fEst').value});
 if(!r.ok){$('#tb').innerHTML='';return alert(r.msg);}
 state.rows=r.rows;
 recordsTable.render({ resetPage: true });
}
$('#bBus').onclick=buscar;
$('#bClr').onclick=()=>{$('#q').value='';$('#fEst').value='';const n=new Date();sv($('#fMes'),MESES[n.getMonth()]);sv($('#fAnio'),String(n.getFullYear()));refreshResponsibles().then(buscar);};
$('#bAdd').onclick=()=>abrir('add');

/* ================================================================
   CONFIGURAR COLUMNAS VISIBLES (MODAL)
   ================================================================ */
$('#bCols').onclick = () => {
  const current = getVisibleColumns();
  const container = $('#colsList');
  container.innerHTML = ALL_COLUMNS.map(col => {
    const checked = current.includes(col.key) ? 'checked' : '';
    return `<label class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer select-none">
      <input type="checkbox" value="${col.key}" ${checked} class="col-chk accent-teal-600 w-4 h-4">
      <span class="text-sm text-slate-700">${esc(col.label)}</span>
      <span class="text-xs text-slate-400 ml-auto">${esc(col.key)}</span>
    </label>`;
  }).join('');
  show('#colsM', true);
};

$('#colsOk').onclick = () => {
  const checks = [...$('#colsList').querySelectorAll('.col-chk:checked')];
  const selected = checks.map(ch => ch.value);
  if (selected.length === 0) {
    alert('Debes seleccionar al menos una columna.');
    return;
  }
  saveVisibleColumns(selected);
  recordsTable.render();
  show('#colsM', false);
};

$('#colsCancel').onclick = () => show('#colsM', false);

$('#colsReset').onclick = () => {
  const defaults = defaultVisibleColumns();
  saveVisibleColumns(defaults);
  // Re-check defaults in the UI
  [...$('#colsList').querySelectorAll('.col-chk')].forEach(ch => {
    ch.checked = defaults.includes(ch.value);
  });
};

// Close modal on background click
$('#colsM').addEventListener('click', e => {
  if (e.target === $('#colsM')) show('#colsM', false);
});

/* ================================================================
   EXPORTACIÓN EN VISTA REGISTROS (CSV Y PDF EN CUADRO)
   ================================================================ */
function exportCSV(data,filename){
  if(!data||data.length===0){alert('No hay datos para exportar');return;}
  const keys=Object.keys(data[0]).filter(k=>!k.startsWith('_'));
  let csv='\uFEFF';
  csv+=keys.join(',')+'\n';
  data.forEach(row=>{
    csv+=keys.map(k=>{
      let v=String(row[k]??'').replace(/"/g,'""');
      return `"${v}"`;
    }).join(',')+'\n';
  });
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

async function exportRegistrosPDF(){
  if(!state.rows||state.rows.length===0){
    alert('No hay resultados para exportar. Realiza una búsqueda primero.');
    return;
  }
  await loadPdfLibraries();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;

  function drawHeader(){
    doc.setFillColor(3, 105, 161); // sky-700
    doc.rect(0, 0, pageW, 52, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('MESA DE AYUDA TI · REPORTE DE REGISTROS DE ATENCIÓN', marginX, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const filtroResp = $('#fResp').value || 'Todos';
    const filtroMes = $('#fMes').value || 'Todos';
    const filtroAnio = $('#fAnio').value || 'Todos';
    const filtroEst = $('#fEst').value || 'Todos';
    const qTexto = $('#q').value.trim() ? ` · Búsqueda: "${$('#q').value.trim()}"` : '';
    const infoFiltros = `Periodo: ${filtroMes} ${filtroAnio} · Responsable: ${filtroResp} · Estado: ${filtroEst}${qTexto}`;
    doc.text(infoFiltros, marginX, 35);
    doc.text(`Total registros: ${state.rows.length}  |  Fecha de emisión: ${new Date().toLocaleString('es-PE')}`, marginX, 46);
  }

  // Columnas a incluir: las visibles en la vista actual + asegurar ITEM
  const visCols = getVisibleColumns();
  const cols = [];
  if (!visCols.includes('ITEM')) {
    cols.push({ key: 'ITEM', label: 'Item' });
  }
  visCols.forEach(k => {
    const colDef = ALL_COLUMNS.find(c => c.key === k);
    cols.push({ key: k, label: colDef ? colDef.label : k });
  });

  const head = [cols.map(c => c.label)];
  const body = state.rows.map((row, idx) => {
    return cols.map(c => {
      if (c.key === 'ITEM') return String(row.ITEM || (idx + 1));
      if (c.key === 'ID_CATEGORIA') return String(getCatId(row));
      return String(row[c.key] ?? '');
    });
  });

  doc.autoTable({
    head: head,
    body: body,
    startY: 62,
    margin: { left: marginX, right: marginX, top: 62, bottom: 25 },
    theme: 'grid', // Formato de cuadro
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [3, 105, 161],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: () => {
      drawHeader();
    }
  });

  // Numeración de páginas
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
    doc.text('Mesa de Ayuda TI · Bitácora de Atenciones', marginX, pageH - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - marginX, pageH - 8, { align: 'right' });
  }

  const filename = `registros_mesa_ayuda_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// Control del menú desplegable de exportar en Registros
const bExportBtn = $('#bExport');
const exportMenu = $('#exportMenu');
if(bExportBtn && exportMenu){
  bExportBtn.onclick = (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('hidden');
  };
}
if($('#bExpCSV')){
  $('#bExpCSV').onclick = () => {
    if(exportMenu) exportMenu.classList.add('hidden');
    if(!state.rows||state.rows.length===0){alert('No hay resultados para exportar. Realiza una búsqueda primero.');return;}
    exportCSV(state.rows, 'busqueda_registros.csv');
  };
}
if($('#bExpPDF')){
  $('#bExpPDF').onclick = async () => {
    if(exportMenu) exportMenu.classList.add('hidden');
    const button=$('#bExpPDF');
    button.disabled=true;
    button.textContent='Preparando PDF…';
    try {
      await exportRegistrosPDF();
    } catch(error) {
      console.error('Error al exportar registros a PDF:',error);
      alert(error.message||'No se pudo generar el PDF.');
    } finally {
      button.disabled=false;
      button.textContent='Exportar PDF (Cuadro)';
    }
  };
}
document.addEventListener('click', (e) => {
  const wrapper = $('#exportWrapper');
  if(wrapper && exportMenu && !wrapper.contains(e.target)){
    exportMenu.classList.add('hidden');
  }
});

/* ================================================================
   FORMULARIO (Añadir / Ver registro)
   ================================================================ */
const semana=f=>{if(!f)return'';const[y,m,d]=f.split('-').map(Number);return Math.ceil((d+(new Date(y,m-1,1).getDay()+6)%7)/7);};

function campo([k,t,o]){
 const sp = SPAN_MAP[k] || { m: 4, d: 8 };
 const spanClass = `col-span-${sp.m} md:col-span-${sp.d}`;

 let c;
 if(t=='sel'||t=='sel-search'){
   c=`<select data-k="${k}" class="inp">${(o||[]).map(x=>`<option>${x}</option>`).join('')}</select>`;
 }
 else if(t=='area')c=`<textarea data-k="${k}" rows="2" class="inp"></textarea>`;
 else c=`<input data-k="${k}" type="${t=='date'?'date':'text'}" ${t=='ro'?'readonly':''} class="inp">`;

 if(k=='ASUNTO')c=`<div class="flex gap-2">${c}<button type="button" id="copy" class="btn bg-slate-600 hover:bg-slate-700">Copiar</button></div>`;

 const rapido=k=='CATEGORIA'?`<div class="col-span-4 md:col-span-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg p-2">
   <span class="text-xs font-semibold">ID rápido de categoría</span>
   <input id="qid" type="number" min="1" class="inp" style="width:6rem" placeholder="Ej: 1">
   <span id="catIdDisplay" class="text-xs font-bold text-teal-700 ml-1"></span>
 </div>`:'';

 return `${rapido}<label class="block ${spanClass}"><span class="text-xs font-semibold text-slate-600">${k}</span>${c}</label>`;
}

function catSub(){opts(E('SUB CATEGORIA'),uniq(state.data.categorias.filter(c=>c.CATEGORIA==E('CATEGORIA').value).map(c=>c.SUB_CATEGORIA)));catSS();}
function catSS(){opts(E('SS CATEGORIA'),uniq(state.data.categorias.filter(c=>c.CATEGORIA==E('CATEGORIA').value&&c.SUB_CATEGORIA==E('SUB CATEGORIA').value).map(c=>c.SS_CATEGORIA)));updateCatId();}

function updateCatId(){
  const catEl=E('CATEGORIA'), subEl=E('SUB CATEGORIA'), ssEl=E('SS CATEGORIA');
  const display=$('#catIdDisplay');
  if(!display)return;
  if(!catEl||!catEl.value){display.textContent='';return;}
  const match=state.data.categorias.find(c=>c.CATEGORIA===catEl.value && c.SUB_CATEGORIA===(subEl?subEl.value:'') && c.SS_CATEGORIA===(ssEl?ssEl.value:''));
  display.textContent=match?`ID: ${match.id}`:'';
}

function cats(c,s,ss){sv(E('CATEGORIA'),c??'');catSub();sv(E('SUB CATEGORIA'),s??'');catSS();sv(E('SS CATEGORIA'),ss??'');}
function tiempo(){const t=(TIEMPOS[E('TIPO').value]||{})[E('PRIORIDAD').value];if(t)E('TIME').value=t;}

function armar(){
 $('#fForm').innerHTML=F.map(campo).join('');
 $$('[data-k]').forEach(el=>{
   const k=el.dataset.k;
   applyCase(el,k);
 });
 opts(E('RESPONSABLE DE ATENCION'),state.data.usuarios.map(u=>u.nombre).sort((a,b)=>a.localeCompare(b)));
 opts(E('CATEGORIA'),uniq(state.data.categorias.map(c=>c.CATEGORIA)));opts(E('SUB CATEGORIA'),[]);opts(E('SS CATEGORIA'),[]);
 opts(E('FACULTAD DEPENDENCIA'),state.data.facultades.map(f=>f.DEPENDENCIA));
 opts(E('OFICINA'),state.data.oficinas||[]);
 E('RESPONSABLE DE ATENCION').onchange=e=>E('NIVEL TECNICO').value=(state.data.usuarios.find(u=>u.nombre==e.target.value)||{}).nivel||'';
 E('CATEGORIA').onchange=()=>{catSub();updateCatId();};
 E('SUB CATEGORIA').onchange=()=>{catSS();updateCatId();};
 E('SS CATEGORIA').onchange=updateCatId;
 $('#qid').oninput=e=>{const c=state.data.categorias.find(c=>c.id==e.target.value);if(c)cats(c.CATEGORIA,c.SUB_CATEGORIA,c.SS_CATEGORIA);};
 E('FACULTAD DEPENDENCIA').onchange=e=>{const f=state.data.facultades.find(f=>f.DEPENDENCIA==e.target.value);E('PREDIO').value=f?f.PREDIO:'';};
 E('FECHA REC').oninput=()=>E('SEMANA').value=semana(E('FECHA REC').value);
 E('CORREO').oninput=e=>{const u=state.data.correos[e.target.value.trim().toLowerCase()];if(u)E('USUARIO SOLICITANTE').value=u;};
 E('TIPO').onchange=E('PRIORIDAD').onchange=tiempo;
 $('#copy').onclick=()=>navigator.clipboard.writeText(E('ASUNTO').value).then(()=>{$('#copy').textContent='¡Copiado!';setTimeout(()=>$('#copy').textContent='Copiar',1200);});
}

function abrir(mode,r={}){
 mode=mode;sheet=r._hoja||'';
 $('#fTitle').textContent=mode=='add'?'Nuevo registro':'Registro #'+r.ITEM;
 $('#fOk').textContent=mode=='add'?'Guardar':'Actualizar';
 $$('[data-k]').forEach(e=>{e.value='';});$('#qid').value='';
 const catIdDisp=$('#catIdDisplay');if(catIdDisp)catIdDisp.textContent='';
 F.forEach(([k,t,o])=>{if(t=='sel'&&o)E(k).selectedIndex=0;});
 cats('','','');
 if(mode=='add'){
  E('ITEM').value='Automático';E('FECHA REC').value=new Date().toLocaleDateString('en-CA');
  E('SEMANA').value=semana(E('FECHA REC').value);E('PRIORIDAD').value='BAJO';tiempo();
 }else{
  F.forEach(([k])=>{if(!k.includes('CATEGORIA'))E(k).value=r[k]??'';});
  cats(r.CATEGORIA,r['SUB CATEGORIA'],r['SS CATEGORIA']);
 }
 E('FECHA REC').disabled=mode!='add';
 show('#fm',true);
}
$('#fCancel').onclick=()=>show('#fm',false);

$('#fOk').onclick=async()=>{
 const R={};$$('[data-k]').forEach(e=>{
   let val=e.value.trim();
   if(e.dataset.k==='CORREO'){
     val=val.toLowerCase();
   } else if(e.tagName==='INPUT'&&e.type==='text'||e.tagName==='TEXTAREA'){
     val=val.toUpperCase();
   }
   R[e.dataset.k]=val;
 });
 if(!R.ASUNTO||!R['RESPONSABLE DE ATENCION']||!R['FECHA REC'])return alert('Completa ASUNTO, RESPONSABLE DE ATENCION y FECHA REC');
 if(R['FACULTAD DEPENDENCIA']&&!state.data.facultades.some(f=>f.DEPENDENCIA==R['FACULTAD DEPENDENCIA']))return alert('Elige una FACULTAD DEPENDENCIA de la lista');
 const ds=FECHAS.map(k=>R[k]).filter(Boolean);
 if(ds.some((v,i)=>i&&ds[i-1]>v))return alert('Las fechas deben cumplir: FECHA REC ≤ INICIO ≤ FINAL ≤ CIERRE');
 const b=$('#fOk');b.disabled=true;
 const r=mode=='add'?await api('guardar',{reg:R}):await api('actualizar',{hoja:sheet,reg:R});
 b.disabled=false;
 if(!r.ok)return alert(r.msg);
 alert(mode=='add'?`Registro guardado en ${r.hoja} (ITEM ${r.item})`:'Registro actualizado');
 show('#fm',false);
 try {
  await refreshAvailableStates();
 } catch(error) {
  console.error(error);
  alert(`El registro se guardó, pero no se pudo actualizar la lista de estados: ${error.message}`);
 }
 await buscar();
};

  return { enter };
}
