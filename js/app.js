const API='https://script.google.com/macros/s/AKfycbyJ4lR4bGxoFpyn2GXGp5rJp2OXF7BuF_Q4xnQPvQ9-WYCTmfRWetCvVyTnCW0UXck4/exec';
const MESES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const FECHAS=['FECHA REC','FECHA INICIO','FECHA FINAL','FECHA CIERRE'];
const TIEMPOS={INCIDENTE:{BAJO:'4H',MEDIO:'2H',ALTO:'0.5H'},REQUERIMIENTO:{BAJO:'8H',MEDIO:'4H',ALTO:'1H'}};
// [campo, tipo, opciones]  tipos: ro | text | date | sel | dl (buscador) | area
const F=[['ITEM','ro'],['ASUNTO','text'],['RESPONSABLE DE ATENCION','sel'],['NIVEL TECNICO','ro'],
['FECHA REC','date'],['FECHA INICIO','date'],['FECHA FINAL','date'],['FECHA CIERRE','date'],
['CATEGORIA','sel'],['SUB CATEGORIA','sel'],['SS CATEGORIA','sel'],
['FACULTAD DEPENDENCIA','dl'],['PREDIO','ro'],['OFICINA','dl'],
['MEDIO','sel',['CORREO','VERBAL','TELEFONO']],['OFICIO','text'],
['ESTADO','sel',['EN CURSO','EN ESPERA','PENDIENTE DE USUARIO','RESUELTO','CERRADO']],
['TIPO','sel',['INCIDENTE','CONSULTA','REQUERIMIENTO']],['SOLICITANTE','sel',['ADMINISTRATIVO','ALUMNO']],
['CORREO','text'],['USUARIO SOLICITANTE','text'],['PRIORIDAD','sel',['BAJO','MEDIO','ALTO']],
['TIME','sel',['0.5H','1H','2H','4H','8H']],['SEMANA','ro'],['DIAGONISTICO','area'],['SOLUCION','area']];

// Mapa de distribucion responsive: m = movil (base 4 col), d = desktop (base 8 col)
const SPAN_MAP = {
  'ITEM':                  { m: 1, d: 2 },
  'ASUNTO':                { m: 3, d: 6 },
  'RESPONSABLE DE ATENCION': { m: 3, d: 5 },
  'NIVEL TECNICO':         { m: 1, d: 3 },
  'FECHA REC':             { m: 2, d: 2 },
  'FECHA INICIO':          { m: 2, d: 2 },
  'FECHA FINAL':           { m: 2, d: 2 },
  'FECHA CIERRE':          { m: 2, d: 2 },
  'CATEGORIA':             { m: 4, d: 2 },
  'SUB CATEGORIA':         { m: 4, d: 2 },
  'SS CATEGORIA':          { m: 4, d: 2 },
  'FACULTAD DEPENDENCIA':  { m: 4, d: 4 },
  'PREDIO':                { m: 1, d: 1 },
  'OFICINA':               { m: 3, d: 3 },
  'MEDIO':                 { m: 2, d: 2 },
  'OFICIO':                { m: 2, d: 2 },
  'ESTADO':                { m: 2, d: 2 },
  'TIPO':                  { m: 2, d: 2 },
  'SOLICITANTE':           { m: 4, d: 2 },
  'CORREO':                { m: 4, d: 3 },
  'USUARIO SOLICITANTE':   { m: 4, d: 3 },
  'PRIORIDAD':             { m: 2, d: 4 },
  'TIME':                  { m: 1, d: 2 },
  'SEMANA':                { m: 1, d: 2 },
  'DIAGONISTICO':          { m: 4, d: 8 },
  'SOLUCION':              { m: 4, d: 8 }
};

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],E=k=>$(`[data-k="${k}"]`);
const uniq=a=>[...new Set(a.filter(x=>x!==''&&x!=null))];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const opts=(el,a,all='')=>{el.innerHTML=`<option value="">${all}</option>`+a.map(x=>`<option>${esc(x)}</option>`).join('');};
const show=(s,v)=>$(s).classList.toggle('hidden',!v);
const sv=(el,v)=>{el.value=v;if(el.selectedIndex<0)el.value='';};
let D={},LAST=[],MODE='add',HOJA='';

async function api(action,data={}){
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...data})});return await r.json();}
 catch(e){return{ok:false,msg:'Error de conexión con el servidor'};}
}

/* ---------- LOGIN ---------- */
$('#lForm').onsubmit=async e=>{e.preventDefault();$('#lErr').textContent='';
 const r=await api('login',{correo:$('#lMail').value.trim(),password:$('#lPass').value});
 if(!r.ok)return $('#lErr').textContent=r.msg;
 localStorage.setItem('u',JSON.stringify(r.user));entrar(r.user);};
$('#btnOut').onclick=()=>{localStorage.removeItem('u');location.reload();};
$('#btnRec').onclick=()=>show('#recM',true);
$('#rCancel').onclick=()=>show('#recM',false);
$('#rOk').onclick=async()=>{const n=$('#rNew').value;
 if(n.length<6||n!=$('#rNew2').value)return alert('La contraseña debe tener mínimo 6 caracteres y coincidir en ambos campos');
 const r=await api('reset',{correo:$('#rMail').value.trim(),nueva:n});
 alert(r.ok?'Contraseña actualizada':r.msg);if(r.ok)show('#recM',false);};

async function entrar(u){
 show('#login',false);show('#app',true);$('#hdrUser').classList.remove('hidden');$('#hdrUser').classList.add('flex');
 $('#uName').textContent=u.nombre;
 const r=await api('init');if(!r.ok){alert(r.msg);return;}
 D=r;armar();iniFiltros();buscar();
}

/* ---------- FILTROS Y RESULTADOS ---------- */
function iniFiltros(){
 const ms=uniq(D.hojas.map(h=>h.split('-')[1])).sort((a,b)=>MESES.indexOf(a)-MESES.indexOf(b));
 opts($('#fMes'),ms,'TODOS');opts($('#fAnio'),uniq(D.hojas.map(h=>h.split('-')[0])).sort(),'TODOS');opts($('#fEst'),D.estados,'TODOS');
 const n=new Date();sv($('#fMes'),MESES[n.getMonth()]);sv($('#fAnio'),String(n.getFullYear()));
 respos();
}
async function respos(){const r=await api('filtros',{mes:$('#fMes').value,anio:$('#fAnio').value});opts($('#fResp'),r.resp||[],'TODOS');}
$('#fMes').onchange=$('#fAnio').onchange=respos;

async function buscar(){
 $('#tb').innerHTML='<tr><td colspan="8" class="p-4 text-center text-slate-500">Cargando…</td></tr>';
 const r=await api('buscar',{q:$('#q').value.trim(),resp:$('#fResp').value,mes:$('#fMes').value,anio:$('#fAnio').value,estado:$('#fEst').value});
 if(!r.ok){$('#tb').innerHTML='';return alert(r.msg);}
 LAST=r.rows;$('#cnt').textContent=LAST.length+' registro(s)';
 $('#tb').innerHTML=LAST.map((x,i)=>`<tr class="border-t hover:bg-slate-50 align-top">
  <td class="p-2">${esc(x['RESPONSABLE DE ATENCION'])}</td>
  <td class="p-2">${esc(x.ASUNTO)}<div class="lg:hidden text-xs text-slate-500">${esc([x.CATEGORIA,x['SUB CATEGORIA'],x['SS CATEGORIA']].filter(Boolean).join(' › '))} ${esc(x['FECHA REC'])}</div></td>
  <td class="p-2 hidden sm:table-cell whitespace-nowrap">${esc(x['FECHA REC'])}</td>
  <td class="p-2 hidden lg:table-cell">${esc(x.CATEGORIA)}</td><td class="p-2 hidden lg:table-cell">${esc(x['SUB CATEGORIA'])}</td><td class="p-2 hidden lg:table-cell">${esc(x['SS CATEGORIA'])}</td>
  <td class="p-2">${esc(x.ESTADO)}</td>
  <td class="p-2"><button data-i="${i}" class="ver btn bg-teal-700 hover:bg-teal-800 !px-3 !py-1">Ver</button></td></tr>`).join('')
  ||'<tr><td colspan="8" class="p-4 text-center text-slate-500">Sin resultados. Ajusta los filtros o añade un registro.</td></tr>';
}
$('#tb').onclick=e=>{const b=e.target.closest('.ver');if(b)abrir('ver',LAST[b.dataset.i]);};
$('#bBus').onclick=buscar;
$('#bClr').onclick=()=>{$('#q').value='';$('#fEst').value='';const n=new Date();sv($('#fMes'),MESES[n.getMonth()]);sv($('#fAnio'),String(n.getFullYear()));respos().then(buscar);};
$('#bAdd').onclick=()=>abrir('add');

/* ---------- FORMULARIO ---------- */
const semana=f=>{if(!f)return'';const[y,m,d]=f.split('-').map(Number);return Math.ceil((d+(new Date(y,m-1,1).getDay()+6)%7)/7);};
function campo([k,t,o]){
 const dl='dl_'+k.replace(/ /g,'_');
 const sp = SPAN_MAP[k] || { m: 4, d: 8 };
 const spanClass = `col-span-${sp.m} md:col-span-${sp.d}`;
 
 let c;
 if(t=='sel')c=`<select data-k="${k}" class="inp">${(o||[]).map(x=>`<option>${x}</option>`).join('')}</select>`;
 else if(t=='area')c=`<textarea data-k="${k}" rows="2" class="inp"></textarea>`;
 else c=`<input data-k="${k}" type="${t=='date'?'date':'text'}" ${t=='ro'?'readonly':''} ${t=='dl'?`list="${dl}" autocomplete="off"`:''} class="inp">${t=='dl'?`<datalist id="${dl}"></datalist>`:''}`;
 if(k=='ASUNTO')c=`<div class="flex gap-2">${c}<button type="button" id="copy" class="btn bg-slate-600 hover:bg-slate-700">Copiar</button></div>`;
 const rapido=k=='CATEGORIA'?`<div class="col-span-4 md:col-span-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg p-2"><span class="text-xs font-semibold">ID rápido de categoría</span><input id="qid" type="number" min="1" class="inp" style="width:6rem" placeholder="Ej: 1"></div>`:'';
 return `${rapido}<label class="block ${spanClass}"><span class="text-xs font-semibold text-slate-600">${k}</span>${c}</label>`;
}
function catSub(){opts(E('SUB CATEGORIA'),uniq(D.categorias.filter(c=>c.CATEGORIA==E('CATEGORIA').value).map(c=>c.SUB_CATEGORIA)));catSS();}
function catSS(){opts(E('SS CATEGORIA'),uniq(D.categorias.filter(c=>c.CATEGORIA==E('CATEGORIA').value&&c.SUB_CATEGORIA==E('SUB CATEGORIA').value).map(c=>c.SS_CATEGORIA)));}
function cats(c,s,ss){sv(E('CATEGORIA'),c??'');catSub();sv(E('SUB CATEGORIA'),s??'');catSS();sv(E('SS CATEGORIA'),ss??'');}
function tiempo(){const t=(TIEMPOS[E('TIPO').value]||{})[E('PRIORIDAD').value];if(t)E('TIME').value=t;}

function armar(){
 $('#fForm').innerHTML=F.map(campo).join('');
 opts(E('RESPONSABLE DE ATENCION'),D.usuarios.map(u=>u.nombre).sort((a,b)=>a.localeCompare(b)));
 opts(E('CATEGORIA'),uniq(D.categorias.map(c=>c.CATEGORIA)));opts(E('SUB CATEGORIA'),[]);opts(E('SS CATEGORIA'),[]);
 $('#dl_FACULTAD_DEPENDENCIA').innerHTML=D.facultades.map(f=>`<option value="${esc(f.DEPENDENCIA)}">`).join('');
 $('#dl_OFICINA').innerHTML=D.oficinas.map(o=>`<option value="${esc(o)}">`).join('');
 E('RESPONSABLE DE ATENCION').onchange=e=>E('NIVEL TECNICO').value=(D.usuarios.find(u=>u.nombre==e.target.value)||{}).nivel||'';
 E('CATEGORIA').onchange=catSub;E('SUB CATEGORIA').onchange=catSS;
 $('#qid').oninput=e=>{const c=D.categorias.find(c=>c.id==e.target.value);if(c)cats(c.CATEGORIA,c.SUB_CATEGORIA,c.SS_CATEGORIA);};
 E('FACULTAD DEPENDENCIA').oninput=e=>{const f=D.facultades.find(f=>f.DEPENDENCIA==e.target.value);E('PREDIO').value=f?f.PREDIO:'';};
 E('FECHA REC').oninput=()=>E('SEMANA').value=semana(E('FECHA REC').value);
 E('CORREO').oninput=e=>{const u=D.correos[e.target.value.trim().toLowerCase()];if(u)E('USUARIO SOLICITANTE').value=u;};
 E('TIPO').onchange=E('PRIORIDAD').onchange=tiempo;
 $('#copy').onclick=()=>navigator.clipboard.writeText(E('ASUNTO').value).then(()=>{$('#copy').textContent='¡Copiado!';setTimeout(()=>$('#copy').textContent='Copiar',1200);});
}

function abrir(mode,r={}){
 MODE=mode;HOJA=r._hoja||'';
 $('#fTitle').textContent=mode=='add'?'Nuevo registro':'Registro #'+r.ITEM;
 $('#fOk').textContent=mode=='add'?'Guardar':'Actualizar';
 $$('[data-k]').forEach(e=>{e.value='';});$('#qid').value='';
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
 const R={};$$('[data-k]').forEach(e=>R[e.dataset.k]=e.value.trim());
 if(!R.ASUNTO||!R['RESPONSABLE DE ATENCION']||!R['FECHA REC'])return alert('Completa ASUNTO, RESPONSABLE DE ATENCION y FECHA REC');
 if(R['FACULTAD DEPENDENCIA']&&!D.facultades.some(f=>f.DEPENDENCIA==R['FACULTAD DEPENDENCIA']))return alert('Elige una FACULTAD DEPENDENCIA de la lista');
 const ds=FECHAS.map(k=>R[k]).filter(Boolean);
 if(ds.some((v,i)=>i&&ds[i-1]>v))return alert('Las fechas deben cumplir: FECHA REC ≤ INICIO ≤ FINAL ≤ CIERRE');
 const b=$('#fOk');b.disabled=true;
 const r=MODE=='add'?await api('guardar',{reg:R}):await api('actualizar',{hoja:HOJA,reg:R});
 b.disabled=false;
 if(!r.ok)return alert(r.msg);
 alert(MODE=='add'?`Registro guardado en ${r.hoja} (ITEM ${r.item})`:'Registro actualizado');
 show('#fm',false);buscar();
};

/* ---------- INICIO ---------- */
$('#yr').textContent=new Date().getFullYear();
const sesion=localStorage.getItem('u');if(sesion)entrar(JSON.parse(sesion));