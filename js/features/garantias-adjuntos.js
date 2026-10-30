import { $, escapeHtml as esc } from '../components/dom.js';

const MAX_BYTES = 10 * 1024 * 1024; // límite por archivo (ya comprimido, en el caso de imágenes)
const MAX_DIM = 1600;               // lado máximo de las imágenes tras comprimir
const QUALITY = 0.82;               // calidad JPEG al comprimir
const EXT_PERMITIDAS = ['png', 'jpg', 'jpeg', 'pdf'];

const extOf = name => String(name || '').split('.').pop().toLowerCase();
const nombreVisible = name => String(name || '').replace(/^\d{8}-\d{6}_/, '');
const esImagen = ext => ['png', 'jpg', 'jpeg'].includes(ext);

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Redimensiona y recomprime a JPEG. Si no mejora el peso, conserva el original.
async function comprimirImagen(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, name: file.name };
  }

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // los PNG con transparencia se aplanan sobre blanco
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || (scale === 1 && blob.size >= file.size)) {
    return { blob: file, name: file.name };
  }
  const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
  return { blob, name: `${base}.jpg` };
}

export function createAdjuntosManager({ api }) {
  let ticket = '';
  let pending = [];   // archivos elegidos, aún sin subir
  let existing = [];  // archivos ya guardados en Drive
  let busy = false;
  let seq = 0;
  let loadToken = 0;

  const listEl = () => $('#gAdjList');
  const msgEl = () => $('#gAdjMsg');

  function setMsg(text) {
    const el = msgEl();
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  function revokeAll() {
    pending.forEach(item => item.preview && URL.revokeObjectURL(item.preview));
  }

  function card({ thumb, name, meta, tag, link, actionAttr, actionLabel }) {
    const nameHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-sky-700 hover:underline truncate block" title="${esc(name)}">${esc(name)}</a>`
      : `<span class="text-xs font-medium text-slate-700 truncate block" title="${esc(name)}">${esc(name)}</span>`;
    return `
      <li class="flex items-center gap-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
        ${thumb}
        <div class="min-w-0 flex-1">
          ${nameHtml}
          <span class="block text-[11px] text-slate-400">${esc(meta)}</span>
          ${tag ? `<span class="inline-block text-[10px] font-semibold px-1.5 rounded bg-amber-100 text-amber-800">${esc(tag)}</span>` : ''}
        </div>
        <button type="button" ${actionAttr} ${busy ? 'disabled' : ''} class="text-xs text-red-600 hover:text-red-800 font-semibold px-1 disabled:opacity-40" title="${esc(actionLabel)}">✕</button>
      </li>`;
  }

  const pdfThumb = '<div class="w-12 h-12 shrink-0 rounded bg-red-100 text-red-700 text-[11px] font-bold flex items-center justify-center">PDF</div>';
  const imgThumb = src => `<img src="${esc(src)}" alt="" loading="lazy" class="w-12 h-12 shrink-0 rounded object-cover bg-slate-200" onerror="this.style.visibility='hidden'">`;

  function render() {
    const existingHtml = existing.map(file => card({
      thumb: esImagen(extOf(file.nombre))
        ? imgThumb(`https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w160`)
        : pdfThumb,
      name: nombreVisible(file.nombre),
      meta: fmtSize(file.size || 0),
      link: file.url,
      actionAttr: `data-del="${esc(file.id)}"`,
      actionLabel: 'Eliminar archivo'
    }));

    const pendingHtml = pending.map(item => card({
      thumb: item.preview ? imgThumb(item.preview) : pdfThumb,
      name: item.name,
      meta: fmtSize(item.blob.size),
      tag: 'Se subirá al guardar',
      actionAttr: `data-rm="${item.uid}"`,
      actionLabel: 'Quitar de la lista'
    }));

    const all = [...existingHtml, ...pendingHtml];
    listEl().innerHTML = all.length
      ? all.join('')
      : '<li class="col-span-full text-xs text-slate-400">Sin archivos adjuntos.</li>';

    $('#gAdjAdd').disabled = busy;
  }

  async function agregar(fileList) {
    const errors = [];
    for (const file of fileList) {
      const ext = extOf(file.name);
      if (!EXT_PERMITIDAS.includes(ext)) {
        errors.push(`"${file.name}": formato no permitido (solo PNG, JPG, JPEG o PDF).`);
        continue;
      }

      let blob = file;
      let name = file.name;
      if (esImagen(ext)) {
        ({ blob, name } = await comprimirImagen(file));
      }
      if (blob.size > MAX_BYTES) {
        errors.push(`"${file.name}": supera los ${fmtSize(MAX_BYTES)} permitidos.`);
        continue;
      }

      pending.push({
        uid: String(++seq),
        blob,
        name,
        preview: esImagen(extOf(name)) ? URL.createObjectURL(blob) : ''
      });
    }
    setMsg(errors.join(' '));
    render();
  }

  async function cargarExistentes() {
    const token = ++loadToken;
    listEl().innerHTML = '<li class="col-span-full text-xs text-slate-400">Cargando adjuntos…</li>';
    try {
      const res = await api('listarAdjuntosGarantia', { ticket });
      if (token !== loadToken) return;
      existing = res.ok ? (res.archivos || []) : [];
      if (!res.ok) setMsg(res.msg || 'No se pudieron cargar los adjuntos.');
    } catch (error) {
      if (token !== loadToken) return;
      console.error('No se pudieron cargar los adjuntos:', error);
      setMsg('No se pudieron cargar los adjuntos.');
    }
    render();
  }

  async function eliminar(fileId) {
    const file = existing.find(item => item.id === fileId);
    if (!file || !confirm(`¿Eliminar "${nombreVisible(file.nombre)}"?`)) return;

    busy = true;
    render();
    try {
      const res = await api('eliminarAdjuntoGarantia', { ticket, fileId });
      if (res.ok) {
        existing = existing.filter(item => item.id !== fileId);
        setMsg('');
      } else {
        setMsg(res.msg || 'No se pudo eliminar el archivo.');
      }
    } catch (error) {
      console.error('No se pudo eliminar el adjunto:', error);
      setMsg('No se pudo eliminar el archivo.');
    } finally {
      busy = false;
      render();
    }
  }

  function bind() {
    const input = $('#gAdjInput');
    $('#gAdjAdd').onclick = () => input.click();
    input.onchange = async () => {
      const files = [...input.files];
      input.value = '';
      if (files.length) await agregar(files);
    };
    listEl().addEventListener('click', event => {
      const rm = event.target.closest('[data-rm]');
      if (rm) {
        const item = pending.find(p => p.uid === rm.dataset.rm);
        if (item?.preview) URL.revokeObjectURL(item.preview);
        pending = pending.filter(p => p.uid !== rm.dataset.rm);
        render();
        return;
      }
      const del = event.target.closest('[data-del]');
      if (del) eliminar(del.dataset.del);
    });
  }

  async function reset(newTicket = '') {
    revokeAll();
    pending = [];
    existing = [];
    busy = false;
    ticket = String(newTicket || '').trim();
    loadToken++;
    setMsg('');
    render();
    if (ticket) await cargarExistentes();
  }

  // Sube de a un archivo. Devuelve la lista de los que fallaron.
  async function uploadPending(targetTicket, onProgress = () => {}) {
    ticket = String(targetTicket);
    const queue = [...pending];
    const failed = [];
    busy = true;
    render();

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      onProgress(i + 1, queue.length);
      try {
        const data = await toBase64(item.blob);
        const res = await api('subirAdjuntoGarantia', { ticket, nombre: item.name, data });
        if (res.ok) {
          if (item.preview) URL.revokeObjectURL(item.preview);
          pending = pending.filter(p => p.uid !== item.uid);
          existing.push(res.archivo);
        } else {
          failed.push(`${item.name} (${res.msg || 'error'})`);
        }
      } catch (error) {
        console.error('No se pudo subir el adjunto:', error);
        failed.push(item.name);
      }
      render();
    }

    busy = false;
    render();
    return failed;
  }

  return {
    bind,
    reset,
    uploadPending,
    hasPending: () => pending.length > 0,
    isBusy: () => busy,
    setTicket: value => { ticket = String(value); }
  };
}
