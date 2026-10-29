import { $, show } from '../components/dom.js';

export function createNavigation({ getData, initializeDashboardFilters, initializeGarantias }) {
  let currentView = 'registros';
  function switchView(view) {
    currentView = view;
    setActiveNavIndicator(view);
    show('#viewRegistros', view === 'registros');
    show('#viewDashboard', view === 'dashboard');
    show('#viewGarantias', view === 'garantias');
    closeHeaderMenus();

    if (view === 'dashboard' && getData().hojas) initializeDashboardFilters();
    if (view === 'garantias' && getData().usuarios && initializeGarantias) initializeGarantias();
  }

  $('#tabRegistros').onclick = () => switchView('registros');
  $('#tabDashboard').onclick = () => switchView('dashboard');
  if ($('#tabGarantias')) $('#tabGarantias').onclick = () => switchView('garantias');

  $('#navToggle').onclick = event => {
    event.stopPropagation();
    const isOpen = $('#navTabs').classList.toggle('is-open');
    $('#navToggle').setAttribute('aria-expanded', String(isOpen));
    if (isOpen) closeProfileMenu();
    if (isOpen) setActiveNavIndicator(currentView);
  };

  $('#profileToggle').onclick = event => {
    event.stopPropagation();
    const menu = $('#profileMenu');
    const isOpen = menu.hidden;
    menu.hidden = !isOpen;
    $('#profileToggle').setAttribute('aria-expanded', String(isOpen));
    if (isOpen) closeNavMenu();
  };

  document.addEventListener('click', event => {
    if (!$('#navTabs').contains(event.target) && !$('#navToggle').contains(event.target) &&
        !$('#profileMenu').contains(event.target) && !$('#profileToggle').contains(event.target)) {
      closeHeaderMenus();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeHeaderMenus();
  });

  $('#navTabs').addEventListener('pointerover', event => {
    const link = event.target.closest('.navbar-link');
    if (link) positionNavIndicator(link, 'hover');
  });
  $('#navTabs').addEventListener('pointerleave', () => $('#navTabs').classList.remove('is-hovering'));
  $('#navTabs').addEventListener('focusin', event => {
    const link = event.target.closest('.navbar-link');
    if (link) positionNavIndicator(link, 'hover');
  });
  $('#navTabs').addEventListener('focusout', event => {
    if (!$('#navTabs').contains(event.relatedTarget)) $('#navTabs').classList.remove('is-hovering');
  });

  window.addEventListener('resize', () => setActiveNavIndicator(currentView));

  function positionNavIndicator(link, type) {
    const nav = $('#navTabs');
    nav.style.setProperty(`--${type}-x`, `${link.offsetLeft}px`);
    nav.style.setProperty(`--${type}-width`, `${link.offsetWidth}px`);
    if (type === 'hover') nav.classList.add('is-hovering');
  }

  function setActiveNavIndicator(view) {
    const map = {
      registros: $('#tabRegistros'),
      dashboard: $('#tabDashboard'),
      garantias: $('#tabGarantias')
    };
    const link = map[view] || $('#tabRegistros');
    Object.values(map).forEach(button => button && button.removeAttribute('aria-current'));
    if (link) {
      link.setAttribute('aria-current', 'page');
      requestAnimationFrame(() => {
        if (link.offsetParent) positionNavIndicator(link, 'active');
      });
    }
  }

  function closeHeaderMenus() {
    closeNavMenu();
    closeProfileMenu();
  }
  function closeNavMenu() {
    $('#navTabs').classList.remove('is-open');
    $('#navToggle').setAttribute('aria-expanded', 'false');
  }
  function closeProfileMenu() {
    $('#profileMenu').hidden = true;
    $('#profileToggle').setAttribute('aria-expanded', 'false');
  }

  return { switchView, setActiveNavIndicator };
}
