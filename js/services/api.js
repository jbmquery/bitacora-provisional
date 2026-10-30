const API_URL = 'https://script.google.com/macros/s/AKfycbyJ4lR4bGxoFpyn2GXGp5rJp2OXF7BuF_Q4xnQPvQ9-WYCTmfRWetCvVyTnCW0UXck4/exec';

export async function api(action, data = {}) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data })
    });
  } catch (error) {
    console.error(`Error en la solicitud "${action}":`, error);
    return { ok: false, msg: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.' };
  }

  if (!response.ok) {
    return { ok: false, msg: `Error del servidor (${response.status})` };
  }

  try {
    return await response.json();
  } catch (error) {
    console.error(`Respuesta inválida para la solicitud "${action}":`, error);
    return { ok: false, msg: 'El servidor devolvió una respuesta inválida. Inténtalo nuevamente.' };
  }
}
