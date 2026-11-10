const SESSION_KEY = 'u';
const VISIBLE_COLUMNS_KEY = 'visibleCols';
const DEFAULT_VISIBLE_COLUMNS = ['RESPONSABLE DE ATENCION', 'ASUNTO', 'FECHA REC', 'ESTADO'];

export function getSession() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;

  try {
    return JSON.parse(session);
  } catch (error) {
    console.error('La sesión guardada no tiene un formato válido:', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getVisibleColumns() {
  const saved = localStorage.getItem(VISIBLE_COLUMNS_KEY);
  if (!saved) return [...DEFAULT_VISIBLE_COLUMNS];

  try {
    const columns = JSON.parse(saved);
    if (Array.isArray(columns) && columns.every(column => typeof column === 'string')) {
      return columns;
    }
    console.error('La configuración de columnas guardada no es válida.');
  } catch (error) {
    console.error('No se pudo leer la configuración de columnas:', error);
  }

  return [...DEFAULT_VISIBLE_COLUMNS];
}

export function saveVisibleColumns(columns) {
  localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(columns));
}

export function defaultVisibleColumns() {
  return [...DEFAULT_VISIBLE_COLUMNS];
}
