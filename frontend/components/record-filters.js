import { $, unique, setOptions, setValue } from './dom.js';

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];
export function initializeRecordFilters(data, onSearch, api) {
  const months = unique(data.hojas.map(sheet => sheet.split('-')[1]))
    .sort((left, right) => MONTHS.indexOf(left) - MONTHS.indexOf(right));
  const years = unique(data.hojas.map(sheet => sheet.split('-')[0])).sort();

  setOptions($('#fMes'), months, 'TODOS');
  setOptions($('#fAnio'), years, 'TODOS');
  setOptions($('#fEst'), unique((data.estados || [])
    .map(state => String(state ?? '').trim())
    .filter(Boolean))
    .sort((left, right) => left.localeCompare(right, 'es')), 'TODOS LOS ESTADOS');

  const now = new Date();
  setValue($('#fMes'), MONTHS[now.getMonth()]);
  setValue($('#fAnio'), String(now.getFullYear()));

  $('#fMes').onchange = refreshResponsibles;
  $('#fAnio').onchange = refreshResponsibles;
  $('#fEst').onchange = onSearch;

  async function refreshResponsibles() {
    const response = await api('filtros', {
      mes: $('#fMes').value,
      anio: $('#fAnio').value
    });

    if (response.ok === false) {
      $('#fResp').replaceChildren(new Option('No se pudieron cargar', ''));
      console.error('No se pudieron cargar los responsables:', response.msg);
      return;
    }

    setOptions($('#fResp'), response.resp || [], 'TODOS');
  }

  async function refreshStates() {
    const response = await api('buscar', {
      q: '',
      resp: '',
      mes: '',
      anio: '',
      estado: ''
    });

    if (response.ok === false) {
      throw new Error(`No se pudieron cargar los estados de los registros: ${response.msg}`);
    }

    if (!Array.isArray(response.rows)) {
      throw new Error('El servidor devolvió registros con un formato inválido al cargar los estados.');
    }

    const states = unique(response.rows
      .map(row => String(row.ESTADO ?? '').trim())
      .filter(Boolean))
      .sort((left, right) => left.localeCompare(right, 'es'));

    setOptions($('#fEst'), states, 'TODOS LOS ESTADOS');
  }

  return { refreshResponsibles, refreshStates };
}
