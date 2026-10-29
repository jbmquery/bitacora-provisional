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
  element.replaceChildren(new Option(placeholder, ''));
  values.forEach(value => element.add(new Option(value, value)));
}

export function show(selector, visible) {
  $(selector).classList.toggle('hidden', !visible);
}

export function setValue(element, value) {
  element.value = value;
  if (element.selectedIndex < 0) element.value = '';
}
