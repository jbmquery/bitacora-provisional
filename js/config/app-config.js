const MESES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const FECHAS=['FECHA REC','FECHA INICIO','FECHA FINAL','FECHA CIERRE'];
const TIEMPOS={INCIDENTE:{BAJO:'4H',MEDIO:'2H',ALTO:'0.5H'},REQUERIMIENTO:{BAJO:'8H',MEDIO:'4H',ALTO:'1H'}};
const ESTADOS_RESUELTOS=['RESUELTO','CERRADO'];
const PALETA=["#0D9488","#6366F1","#F59E0B","#F43F5E","#8B5CF6","#0EA5E9","#64748B","#22C55E"];

// [campo, tipo, opciones]  tipos: ro | text | date | sel | area
const F=[['ITEM','ro'],['ASUNTO','text'],['RESPONSABLE DE ATENCION','sel'],['NIVEL TECNICO','ro'],
['FECHA REC','date'],['FECHA INICIO','date'],['FECHA FINAL','date'],['FECHA CIERRE','date'],
['CATEGORIA','sel'],['SUB CATEGORIA','sel'],['SS CATEGORIA','sel'],
['FACULTAD DEPENDENCIA','sel-search'],['PREDIO','ro'],['OFICINA','sel-search'],
['MEDIO','sel',['CORREO','VERBAL','TELEFONO']],['OFICIO','text'],
['ESTADO','sel',['EN CURSO','EN ESPERA','PENDIENTE DE USUARIO','RESUELTO','CERRADO']],
['TIPO','sel',['INCIDENTE','CONSULTA','REQUERIMIENTO']],['SOLICITANTE','sel',['ADMINISTRATIVO','ALUMNO']],
['CORREO','text'],['USUARIO SOLICITANTE','text'],['PRIORIDAD','sel',['BAJO','MEDIO','ALTO']],
['TIME','sel',['0.5H','1H','2H','4H','8H']],['SEMANA','ro'],['DIAGONISTICO','area'],['SOLUCION','area']];

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

const ALL_COLUMNS = [
  { key: 'RESPONSABLE DE ATENCION', label: 'Responsable' },
  { key: 'ASUNTO', label: 'Asunto' },
  { key: 'FECHA REC', label: 'Fecha' },
  { key: 'CATEGORIA', label: 'Categoría' },
  { key: 'SUB CATEGORIA', label: 'Sub categoría' },
  { key: 'SS CATEGORIA', label: 'SS categoría' },
  { key: 'ESTADO', label: 'Estado' },
  { key: 'TIPO', label: 'Tipo' },
  { key: 'PRIORIDAD', label: 'Prioridad' },
  { key: 'FACULTAD DEPENDENCIA', label: 'Facultad' },
  { key: 'MEDIO', label: 'Medio' },
  { key: 'CORREO', label: 'Correo' },
  { key: 'USUARIO SOLICITANTE', label: 'Solicitante' },
  { key: 'ID_CATEGORIA', label: 'ID Categoría' }
];

// ====== CONFIGURACIÓN MÓDULO GARANTÍAS ======
const BIENES_GARANTIA = ['CPU', 'Impresora', 'Pantalla Interactiva', 'Teclado', 'Tablet', 'Monitor', 'Laptop'];
const MARCAS_GARANTIA = ['HP', 'Kyocera', 'Lenovo','Trump Board'];
const ESTADOS_GARANTIA = ['Pendiente', 'Atendido', 'En proceso', 'Sin Respuesta', 'Cerrado', 'Reprogramado', 'No Procede'];
const FECHAS_GARANTIA = ['Fecha Solicitud', 'Fecha Atencion', 'Fecha de cierre'];

// [campo, tipo, opciones, labelOpcional]
const FG = [
  ['TICKET', 'ro'],
  ['BIEN', 'sel', BIENES_GARANTIA],
  ['Marca', 'sel', MARCAS_GARANTIA],
  ['Nro Serie', 'text'],
  ['Modelo', 'text'],
  ['Patrimonio', 'text'],
  ['Tecnico responsable', 'sel'],
  ['dependencia', 'sel'],
  ['predio', 'ro'],
  ['oficina', 'text'],
  ['equipo', 'text'],
  ['direccion', 'text', null, 'dirección'],
  ['Fecha Solicitud', 'date'],
  ['Fecha Atencion', 'date', null, 'Fecha Atención'],
  ['Fecha de cierre', 'date'],
  ['estado', 'sel', ESTADOS_GARANTIA],
  ['tecnico garantía visitante', 'text'],
  ['id caso', 'text'],
  ['PROBLEMA', 'area'],
  ['SOLUCION', 'area']
];

const SPAN_MAP_G = {
  TICKET: { m: 1, d: 1 },
  BIEN: { m: 3, d: 2 },
  Marca: { m: 2, d: 2 },
  'Nro Serie': { m: 2, d: 3 },
  Modelo: { m: 2, d: 2 },
  Patrimonio: { m: 2, d: 2 },
  'Tecnico responsable': { m: 4, d: 4 },
  dependencia: { m: 4, d: 4 },
  predio: { m: 2, d: 1 },
  oficina: { m: 2, d: 3 },
  equipo: { m: 2, d: 2 },
  direccion: { m: 2, d: 3 },
  'Fecha Solicitud': { m: 2, d: 2 },
  'Fecha Atencion': { m: 2, d: 2 },
  'Fecha de cierre': { m: 2, d: 2 },
  estado: { m: 2, d: 2 },
  'tecnico garantía visitante': { m: 4, d: 4 },
  'id caso': { m: 4, d: 4 },
  PROBLEMA: { m: 4, d: 8 },
  SOLUCION: { m: 4, d: 8 }
};

export {
  MESES, FECHAS, TIEMPOS, ESTADOS_RESUELTOS, PALETA, F, SPAN_MAP, ALL_COLUMNS,
  BIENES_GARANTIA, MARCAS_GARANTIA, ESTADOS_GARANTIA, FECHAS_GARANTIA, FG, SPAN_MAP_G
};
