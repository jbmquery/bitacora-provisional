export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];
export const field = key => $(`[data-k="${key}"]`);

export function unique(values) {
  return [...new Set(values.filter(value => value !== '' && value != null))];
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[character]);
}

export function setOptions(element, values, placeholder = '') {
  if (!element) return;
  element.replaceChildren(new Option(placeholder, ''));
  values.forEach(value => element.add(new Option(value, value)));
  if (typeof element._syncCombobox === 'function') {
    element._syncCombobox();
  }
}

export function show(selector, visible) {
  $(selector).classList.toggle('hidden', !visible);
}

export function setValue(element, value) {
  if (!element) return;
  const target = String(value ?? '');
  element.value = target;
  if (element.selectedIndex < 0) {
    if (element.dataset.allowCreate === 'true' && target.trim() !== '') {
      const clean = target.trim();
      element.add(new Option(clean, clean, true, true));
      element.value = clean;
    } else {
      element.value = '';
    }
  }
  if (typeof element._syncCombobox === 'function') {
    element._syncCombobox();
  }
}

export function enhanceCombobox(selectEl, { allowCreate = false, placeholder = '' } = {}) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return;
  if (selectEl.dataset.comboboxInit === 'true') {
    if (allowCreate) selectEl.dataset.allowCreate = 'true';
    if (typeof selectEl._syncCombobox === 'function') selectEl._syncCombobox();
    return;
  }

  selectEl.dataset.comboboxInit = 'true';
  selectEl.dataset.allowCreate = allowCreate ? 'true' : 'false';

  const wrapper = document.createElement('div');
  wrapper.className = 'cbx-wrap';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'cbx-input-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = `${selectEl.className} cbx-input`;
  if (allowCreate) input.classList.add('inp-upper');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = placeholder || (allowCreate ? 'Buscar o escribir para crear...' : 'Buscar o seleccionar...');

  const chevron = document.createElement('span');
  chevron.className = 'cbx-chevron';
  chevron.innerHTML = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

  const list = document.createElement('ul');
  list.className = 'cbx-list';
  list.setAttribute('role', 'listbox');

  inputWrap.appendChild(input);
  inputWrap.appendChild(chevron);
  wrapper.appendChild(inputWrap);
  wrapper.appendChild(list);

  selectEl.style.display = 'none';
  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

  let isTyping = false;
  let activeIndex = -1;

  function getValidOptions() {
    return Array.from(selectEl.options)
      .filter(opt => opt.value !== '' && !opt.disabled)
      .map(opt => ({ value: opt.value, text: opt.text.trim() }));
  }

  function getPlaceholderText() {
    const emptyOpt = Array.from(selectEl.options).find(opt => opt.value === '');
    if (emptyOpt && emptyOpt.text.trim()) return emptyOpt.text.trim();
    return placeholder || (allowCreate ? 'Buscar o escribir nuevo valor...' : 'Buscar o seleccionar...');
  }

  function syncFromSelect() {
    input.placeholder = getPlaceholderText();
    input.disabled = selectEl.disabled;
    const val = selectEl.value;
    if (!val) {
      input.value = '';
      return;
    }
    const selectedOpt = Array.from(selectEl.options).find(opt => opt.value === val);
    input.value = selectedOpt ? selectedOpt.text.trim() : val;
  }

  function commitSelection(value, text, isNew = false) {
    const finalVal = allowCreate ? String(value).trim().toUpperCase() : String(value).trim();
    const finalText = allowCreate ? String(text).trim().toUpperCase() : String(text).trim();

    if (isNew && finalVal !== '') {
      const exists = Array.from(selectEl.options).some(
        opt => opt.value.trim().toUpperCase() === finalVal.toUpperCase()
      );
      if (!exists) {
        selectEl.add(new Option(finalText, finalVal, true, true));
      }
    }

    selectEl.value = finalVal;
    if (selectEl.selectedIndex < 0 && allowCreate && finalVal !== '') {
      selectEl.add(new Option(finalText, finalVal, true, true));
      selectEl.value = finalVal;
    }

    input.value = finalText;
    isTyping = false;
    closeList();
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function renderList(filterQuery = '') {
    list.innerHTML = '';
    activeIndex = -1;
    const rawQuery = filterQuery.trim();
    const query = rawQuery.toLowerCase();
    const options = getValidOptions();

    const filtered = query === ''
      ? options
      : options.filter(opt => opt.text.toLowerCase().includes(query));

    filtered.forEach(opt => {
      const li = document.createElement('li');
      li.className = 'cbx-item';
      if (opt.value === selectEl.value) li.classList.add('is-selected');
      li.textContent = opt.text;
      li.dataset.val = opt.value;
      li.dataset.txt = opt.text;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        commitSelection(opt.value, opt.text, false);
      });
      list.appendChild(li);
    });

    const exactMatch = options.some(opt => opt.text.toLowerCase() === query);

    if (allowCreate && rawQuery !== '' && !exactMatch) {
      const newVal = rawQuery.toUpperCase();
      const createLi = document.createElement('li');
      createLi.className = 'cbx-create';
      createLi.dataset.val = newVal;
      createLi.dataset.txt = newVal;
      createLi.dataset.create = 'true';
      createLi.innerHTML = `<span>＋ Crear / Agregar <strong>"${escapeHtml(newVal)}"</strong></span>`;
      createLi.addEventListener('mousedown', e => {
        e.preventDefault();
        commitSelection(newVal, newVal, true);
      });
      list.appendChild(createLi);
    } else if (filtered.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'cbx-empty';
      emptyLi.textContent = 'Sin coincidencias';
      list.appendChild(emptyLi);
    }
  }

  function openList(filterText = '') {
    if (input.disabled) return;
    renderList(filterText);
    wrapper.classList.add('is-open');
  }

  function closeList() {
    wrapper.classList.remove('is-open');
    activeIndex = -1;
  }

  function highlightItem(index) {
    const items = [...list.querySelectorAll('.cbx-item, .cbx-create')];
    if (!items.length) return;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;
    activeIndex = index;
    items.forEach((el, idx) => {
      el.classList.toggle('is-active', idx === activeIndex);
      if (idx === activeIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  // Si hace clic o enfoca sin escribir nada -> muestra la lista completa
  input.addEventListener('focus', () => {
    isTyping = false;
    openList('');
  });

  input.addEventListener('click', () => {
    if (!isTyping) {
      openList('');
    } else if (!wrapper.classList.contains('is-open')) {
      openList(input.value);
    }
  });

  // Filtrado y correlación en tiempo real al escribir
  input.addEventListener('input', () => {
    isTyping = true;
    if (allowCreate) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(start, end);
    }
    openList(input.value);
  });

  input.addEventListener('keydown', e => {
    const items = [...list.querySelectorAll('.cbx-item, .cbx-create')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!wrapper.classList.contains('is-open')) {
        openList(isTyping ? input.value : '');
      } else {
        highlightItem(activeIndex + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (wrapper.classList.contains('is-open')) {
        highlightItem(activeIndex - 1);
      }
    } else if (e.key === 'Enter') {
      if (wrapper.classList.contains('is-open')) {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          const target = items[activeIndex];
          commitSelection(target.dataset.val, target.dataset.txt, target.dataset.create === 'true');
        } else if (items.length === 1) {
          const target = items[0];
          commitSelection(target.dataset.val, target.dataset.txt, target.dataset.create === 'true');
        } else if (allowCreate && input.value.trim() !== '') {
          const clean = input.value.trim().toUpperCase();
          commitSelection(clean, clean, true);
        }
      }
    } else if (e.key === 'Escape') {
      closeList();
      syncFromSelect();
      isTyping = false;
    }
  });

  input.addEventListener('blur', () => {
    closeList();
    const typed = input.value.trim();
    const options = getValidOptions();

    if (typed === '') {
      if (selectEl.value !== '') {
        selectEl.value = '';
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      input.value = '';
      isTyping = false;
      return;
    }

    const exactMatch = options.find(opt => opt.text.toLowerCase() === typed.toLowerCase());
    if (exactMatch) {
      if (selectEl.value !== exactMatch.value) {
        commitSelection(exactMatch.value, exactMatch.text, false);
      } else {
        input.value = exactMatch.text;
      }
    } else if (allowCreate) {
      const clean = typed.toUpperCase();
      commitSelection(clean, clean, true);
    } else {
      syncFromSelect();
    }
    isTyping = false;
  });

  selectEl._syncCombobox = syncFromSelect;
  syncFromSelect();
}

export function initFormComboboxes(containerSelector, oficinaKeys = ['OFICINA', 'oficina']) {
  const container = typeof containerSelector === 'string' ? $(containerSelector) : containerSelector;
  if (!container) return;
  const normalizedOficinaKeys = oficinaKeys.map(k => k.toLowerCase());
  container.querySelectorAll('select').forEach(selectEl => {
    const key = (selectEl.dataset.k || selectEl.dataset.gk || selectEl.name || selectEl.id || '').toLowerCase();
    const isOficina = normalizedOficinaKeys.includes(key) || key.includes('oficina');
    enhanceCombobox(selectEl, { allowCreate: isOficina });
  });
}

export function syncFormComboboxes(containerSelector) {
  const container = typeof containerSelector === 'string' ? $(containerSelector) : containerSelector;
  if (!container) return;
  container.querySelectorAll('select').forEach(selectEl => {
    if (typeof selectEl._syncCombobox === 'function') {
      selectEl._syncCombobox();
    }
  });
}
