const scripts = new Map();

function loadScript(url) {
  if (scripts.has(url)) return scripts.get(url);

  const pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scripts.delete(url);
      reject(new Error(`No se pudo cargar la dependencia: ${url}`));
    };
    document.head.append(script);
  });

  scripts.set(url, pending);
  return pending;
}

export async function loadChartJs() {
  if (!window.Chart) {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js');
  }
  if (!window.Chart) throw new Error('Chart.js no está disponible.');
}

export async function loadPdfLibraries() {
  if (!window.jspdf?.jsPDF) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF no está disponible.');

  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
    throw new Error('El complemento de tablas para PDF no está disponible.');
  }
}
