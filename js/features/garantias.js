import { api as defaultApi } from '../services/api.js';
import { $, $$, escapeHtml as esc, setOptions as opts, show } from '../components/dom.js';
import { BIENES_GARANTIA, ESTADOS_GARANTIA, FG, SPAN_MAP_G } from '../config/app-config.js';
import { createAdjuntosManager } from './garantias-adjuntos.js';

export function createGarantiasFeature({ state, api = defaultApi }) {
  let mode = 'add';
  let currentTicket = '';
  let initialized = false;
  let rows = [];
  const adjuntos = createAdjuntosManager({ api });

  const EG = key => $(`#gForm [data-gk="${key}"]`);

  function applyCase(el) {
    const isTextField = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text');
    if (!isTextField || el.readOnly) return;
    el.classList.add('inp-upper');
    el.addEventListener('input', () => {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.toUpperCase();
      el.setSelectionRange(start, end);
    });
  }

  function setSelectCaseInsensitive(selectEl, val) {
    if (!selectEl) return;
    const target = String(val ?? '').trim();
    if (!target) {
      selectEl.value = '';
      return;
    }
    const match = [...selectEl.options].find(
      opt => opt.value.trim().toUpperCase() === target.toUpperCase()
    );
    if (match) {
      selectEl.value = match.value;
    } else {
      selectEl.add(new Option(target, target));
      selectEl.value = target;
    }
  }

  function campo([key, type, options, label]) {
    const span = SPAN_MAP_G[key] || { m: 4, d: 4 };
    const spanClass = `col-span-${span.m} md:col-span-${span.d}`;
    const displayLabel = label || key;

    let control;
    if (type === 'sel') {
      control = `<select data-gk="${key}" class="inp">${(options || []).map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}</select>`;
    } else if (type === 'area') {
      control = `<textarea data-gk="${key}" rows="2" class="inp"></textarea>`;
    } else {
      control = `<input data-gk="${key}" type="${type === 'date' ? 'date' : 'text'}" ${type === 'ro' ? 'readonly' : ''} class="inp">`;
    }

    return `<label class="block ${spanClass}"><span class="text-xs font-semibold uppercase text-slate-600">${esc(displayLabel)}</span>${control}</label>`;
  }

  function poblarOpcionesModal() {
    const techNames = (state.data.usuarios || []).map(user => user.nombre).sort((a, b) => a.localeCompare(b));
    opts(EG('Tecnico responsable'), techNames, 'Seleccionar técnico...');
    opts(EG('dependencia'), (state.data.facultades || []).map(faculty => faculty.DEPENDENCIA), 'Seleccionar dependencia...');
  }

  function armarModal() {
    $('#gForm').innerHTML = FG.map(campo).join('');
    $$('#gForm [data-gk]').forEach(el => applyCase(el));

    poblarOpcionesModal();

    EG('dependencia').onchange = event => {
      const faculty = (state.data.facultades || []).find(item => item.DEPENDENCIA === event.target.value);
      EG('predio').value = faculty ? faculty.PREDIO : '';
    };
  }

  function initializeView() {
    if (initialized) {
      buscar();
      return;
    }
    initialized = true;

    const techNames = (state.data.usuarios || []).map(user => user.nombre).sort((a, b) => a.localeCompare(b));
    opts($('#gfTec'), techNames, 'TODOS');
    opts($('#gfBien'), BIENES_GARANTIA, 'TODOS');
    opts($('#gfEst'), ESTADOS_GARANTIA, 'TODOS');

    armarModal();
    adjuntos.bind();

    $('#gbBus').onclick = buscar;
    $('#gbClr').onclick = () => {
      $('#gfTec').value = '';
      $('#gfFecha').value = '';
      $('#gfBien').value = '';
      $('#gfEst').value = '';
      buscar();
    };
    $('#gbAdd').onclick = () => abrir('add');
    $('#gCancel').onclick = cerrar;
    $('#gOk').onclick = guardar;

    $('#gm').addEventListener('click', event => {
      if (event.target === $('#gm')) cerrar();
    });

    $('#gResultados').addEventListener('click', async event => {
      const copyButton = event.target.closest('.btn-copy-serie');
      if (copyButton) {
        try {
          await navigator.clipboard.writeText(copyButton.dataset.serie || '');
          const original = copyButton.innerHTML;
          copyButton.textContent = '¡Copiado!';
          setTimeout(() => { copyButton.innerHTML = original; }, 1200);
        } catch (error) {
          console.error('No se pudo copiar el número de serie:', error);
          alert('No se pudo copiar el número de serie.');
        }
        return;
      }

      const editButton = event.target.closest('.btn-edit-garantia');
      if (editButton) {
        const ticket = editButton.dataset.ticket;
        const record = rows.find(row => String(row.TICKET).trim() === String(ticket).trim());
        if (record) {
          abrir('edit', record);
        } else {
          alert(`No se encontró la garantía con ticket #${ticket}. Actualiza la búsqueda e inténtalo nuevamente.`);
        }
      }
    });

    buscar();
  }

  function cerrar() {
    if (adjuntos.isBusy()) return;
    if (adjuntos.hasPending() && !confirm('Hay archivos seleccionados que aún no se han subido. ¿Cerrar de todos modos?')) return;
    show('#gm', false);
  }

  async function buscar() {
    const container = $('#gResultados');
    container.innerHTML = '<div class="bg-white rounded-xl shadow p-8 text-center text-slate-500 text-sm">Cargando garantías…</div>';

    try {
      const result = await api('buscarGarantias', {
        tec: $('#gfTec').value,
        fecha: $('#gfFecha').value,
        bien: $('#gfBien').value,
        estado: $('#gfEst').value
      });

      if (!result.ok) {
        container.innerHTML = '';
        alert(result.msg || 'Error al buscar garantías');
        return;
      }

      rows = result.rows || [];
      $('#gCnt').textContent = `${rows.length} garantía(s) encontrada(s)`;
      renderResultados();
    } catch (error) {
      console.error('No se pudieron buscar las garantías:', error);
      container.innerHTML = '';
      alert('Ocurrió un error al buscar garantías. Inténtalo nuevamente.');
    }
  }

  function parseTimelineSteps(row) {
    let steps = ['Pendiente'];
    if (row.HISTORIAL) {
      try {
        const parsed = JSON.parse(row.HISTORIAL);
        if (Array.isArray(parsed) && parsed.length) steps = parsed;
      } catch {
        steps = ['Pendiente'];
      }
    }
    const current = row.estado || 'Pendiente';
    if (steps[steps.length - 1] !== current) steps.push(current);
    return steps;
  }

  function renderTimeline(row) {
    const steps = parseTimelineSteps(row);
    const current = row.estado || 'Pendiente';
    const reachedGoal = steps.some(s => String(s).toLowerCase() === 'atendido');

    const displayNodes = steps.map((step, index) => ({
      label: step,
      status: index < steps.length - 1 ? 'done' : 'current'
    }));

    if (!reachedGoal) displayNodes.push({ label: 'Atendido', status: 'goal' });

    return `
      <div class="mt-4 pt-3 border-t border-slate-100">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avance de Garantía (Meta: Atendido)</span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${
            current === 'Atendido' || current === 'Cerrado'
              ? 'bg-teal-100 text-teal-800'
              : current === 'No Procede'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-800'
          }">${esc(current)}</span>
        </div>
        <div class="flex items-center flex-wrap gap-y-2 py-1">
          ${displayNodes.map((node, index) => {
            const isLast = index === displayNodes.length - 1;
            let circleClass = '';
            let textClass = '';
            let icon = '';

            if (node.status === 'done') {
              circleClass = 'bg-teal-600 text-white border-teal-600';
              textClass = 'text-teal-700 font-medium';
              icon = '✓';
            } else if (node.status === 'current') {
              circleClass = String(node.label).toLowerCase() === 'atendido'
                ? 'bg-teal-600 text-white border-teal-600 ring-4 ring-teal-100'
                : 'bg-sky-600 text-white border-sky-600 ring-4 ring-sky-100';
              textClass = 'text-slate-800 font-bold';
              icon = String(node.label).toLowerCase() === 'atendido' ? '✓' : index + 1;
            } else {
              circleClass = 'bg-white text-slate-400 border-2 border-dashed border-slate-300';
              textClass = 'text-slate-400 font-medium';
              icon = '🏁';
            }

            const connectorClass = node.status === 'done'
              ? 'bg-teal-500'
              : 'bg-slate-200 border-t border-dashed border-slate-300';

            return `
              <div class="flex items-center">
                <div class="flex items-center gap-1.5">
                  <span class="w-6 h-6 rounded-full text-xs flex items-center justify-center border ${circleClass}">
                    ${icon}
                  </span>
                  <span class="text-xs ${textClass}">${esc(node.label)}</span>
                </div>
                ${!isLast ? `<div class="w-6 sm:w-10 h-0.5 mx-2 ${connectorClass}"></div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderResultados() {
    const container = $('#gResultados');
    if (!rows.length) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p class="text-slate-400 text-sm">No se encontraron garantías con los filtros seleccionados.</p>
        </div>`;
      return;
    }

    const groups = new Map();
    rows.forEach(row => {
      const tech = row['Tecnico responsable'] || 'SIN TÉCNICO ASIGNADO';
      if (!groups.has(tech)) groups.set(tech, []);
      groups.get(tech).push(row);
    });

    container.innerHTML = Array.from(groups.entries()).map(([tech, items]) => `
      <div class="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
        <div class="bg-sky-700 text-white px-4 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 text-sky-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <h3 class="font-semibold text-sm tracking-wide uppercase">${esc(tech)}</h3>
          </div>
          <span class="text-xs bg-sky-800 px-2.5 py-0.5 rounded-full font-mono">${items.length} caso(s)</span>
        </div>
        <div class="divide-y divide-slate-200">
          ${items.map(item => `
            <div class="p-4 hover:bg-slate-50/70 transition-colors">
              <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
                  <div>
                    <span class="block text-[11px] font-semibold uppercase text-slate-400">Ticket · Bien</span>
                    <span class="text-sm font-bold text-slate-800">#${esc(item.TICKET)} · ${esc(item.BIEN || '—')}</span>
                  </div>
                  <div>
                    <span class="block text-[11px] font-semibold uppercase text-slate-400">Marca</span>
                    <span class="text-sm font-medium text-slate-700">${esc(item.Marca || '—')}</span>
                  </div>
                  <div>
                    <span class="block text-[11px] font-semibold uppercase text-slate-400">N° de Serie</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="text-sm font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${esc(item['Nro Serie'] || '—')}</span>
                      ${item['Nro Serie'] ? `
                        <button type="button" data-serie="${esc(item['Nro Serie'])}" class="btn-copy-serie text-xs bg-slate-600 hover:bg-slate-700 text-white px-2 py-1 rounded font-semibold transition" title="Copiar N° de Serie">Copiar</button>
                      ` : ''}
                    </div>
                  </div>
                  <div>
                    <span class="block text-[11px] font-semibold uppercase text-slate-400">Patrimonio</span>
                    <span class="text-sm font-mono text-slate-700">${esc(item.Patrimonio || '—')}</span>
                  </div>
                  <div>
                    <span class="block text-[11px] font-semibold uppercase text-slate-400">Oficina</span>
                    <span class="text-sm text-slate-700">${esc(item.oficina || '—')} ${item.predio ? `<span class="text-xs text-slate-400">(${esc(item.predio)})</span>` : ''}</span>
                  </div>
                </div>
                <div class="flex items-center justify-end gap-2 lg:self-center">
                  ${String(item.ADJUNTOS || '').startsWith('https://drive.google.com/') ? `<a href="${esc(item.ADJUNTOS)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-sky-700 hover:underline" title="Abrir carpeta de adjuntos">📎 Adjuntos</a>` : ''}
                  <button type="button" data-ticket="${esc(item.TICKET)}" class="btn-edit-garantia btn bg-teal-700 hover:bg-teal-800 !px-3.5 !py-1.5 text-xs flex items-center gap-1.5">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Actualizar
                  </button>
                </div>
              </div>
              ${renderTimeline(item)}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function abrir(modo, r = {}) {
    mode = modo;
    currentTicket = String(r.TICKET ?? '').trim();

    $('#gTitle').textContent = mode === 'add' ? 'Nueva Garantía' : `Actualizar Garantía · Ticket #${currentTicket}`;
    $('#gOk').textContent = mode === 'add' ? 'Guardar' : 'Actualizar';

    poblarOpcionesModal();

    $$('#gForm [data-gk]').forEach(element => { element.value = ''; });
    FG.forEach(([key, type, options]) => {
      if (type === 'sel' && options) EG(key).selectedIndex = 0;
    });

    if (mode === 'add') {
      EG('TICKET').value = 'Automático';
      EG('Fecha Solicitud').value = new Date().toLocaleDateString('en-CA');
      setSelectCaseInsensitive(EG('estado'), 'Pendiente');
    } else {
      FG.forEach(([key, type]) => {
        const el = EG(key);
        if (!el) return;
        if (type === 'sel') {
          setSelectCaseInsensitive(el, r[key]);
        } else {
          el.value = r[key] ?? '';
        }
      });
      EG('TICKET').value = currentTicket;
    }

    show('#gm', true);
    adjuntos.reset(mode === 'edit' ? currentTicket : '');
  }

  async function guardar() {
    const R = {};
    $$('#gForm [data-gk]').forEach(element => {
      let val = element.value.trim();
      if (((element.tagName === 'INPUT' && element.type === 'text' && !element.readOnly) || element.tagName === 'TEXTAREA')) {
        val = val.toUpperCase();
      }
      R[element.dataset.gk] = val;
    });

    if (mode === 'edit') {
      R.TICKET = currentTicket || R.TICKET;
    }

    if (!R.BIEN || !R['Tecnico responsable'] || !R['Fecha Solicitud']) {
      alert('Completa al menos BIEN, Técnico responsable y Fecha Solicitud.');
      return;
    }

    const requestMode = mode;
    if (requestMode === 'edit' && !R.TICKET) {
      alert('No se puede actualizar la garantía porque falta el número de ticket. Cierra el formulario y vuelve a abrir el registro.');
      return;
    }

    const fSol = R['Fecha Solicitud'];
    const fAte = R['Fecha Atencion'];
    const fCie = R['Fecha de cierre'];
    if (fSol && fAte && fSol > fAte) {
      alert('La Fecha Solicitud debe ser menor o igual que la Fecha Atención.');
      return;
    }
    if (fAte && fCie && fAte > fCie) {
      alert('La Fecha Atención debe ser menor o igual que la Fecha de cierre.');
      return;
    }
    if (fSol && fCie && fSol > fCie) {
      alert('La Fecha Solicitud debe ser menor o igual que la Fecha de cierre.');
      return;
    }

    const b = $('#gOk');
    b.disabled = true;
    try {
      const res = requestMode === 'add'
        ? await api('guardarGarantia', { reg: R })
        : await api('actualizarGarantia', { ticket: R.TICKET, reg: R });

      if (!res.ok) {
        alert(res.msg || (requestMode === 'edit'
          ? 'El servidor no pudo actualizar la garantía. Verifica que actualizarGarantia esté publicada en Apps Script.'
          : 'No se pudo procesar la solicitud.'));
        return;
      }

      const ticket = String(res.ticket || R.TICKET);

      // Subida de archivos adjuntos (después de guardar, porque la carpeta usa el N° de ticket)
      let failed = [];
      if (adjuntos.hasPending()) {
        $('#gCancel').disabled = true;
        failed = await adjuntos.uploadPending(ticket, (done, total) => {
          b.textContent = `Subiendo ${done}/${total}…`;
        });
        $('#gCancel').disabled = false;
      }

      if (failed.length) {
        // El registro ya existe: pasamos a modo edición para que reintentar no lo duplique.
        mode = 'edit';
        currentTicket = ticket;
        $('#gTitle').textContent = `Actualizar Garantía · Ticket #${ticket}`;
        EG('TICKET').value = ticket;
        adjuntos.setTicket(ticket);
        alert(`La garantía #${ticket} se guardó, pero no se pudieron subir estos archivos:\n- ${failed.join('\n- ')}\n\nPulsa "Actualizar" para reintentar.`);
        await buscar();
        return;
      }

      alert(requestMode === 'add'
        ? `Garantía registrada (TICKET #${ticket})`
        : `Garantía #${ticket} actualizada correctamente`);
      show('#gm', false);
      await buscar();
    } catch (error) {
      console.error('No se pudo guardar la garantía:', error);
      alert('Ocurrió un error al guardar la garantía. Inténtalo nuevamente.');
    } finally {
      b.disabled = false;
      $('#gCancel').disabled = false;
      b.textContent = mode === 'add' ? 'Guardar' : 'Actualizar';
    }
  }

  return { initializeView };
}