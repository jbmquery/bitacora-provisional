import { api as defaultApi } from '../services/api.js';
import { clearSession, saveSession } from '../services/storage.js';
import { $, show } from '../components/dom.js';

export function initializeAuth({ api = defaultApi, onLogin }) {
$('#lForm').onsubmit=async e=>{
 e.preventDefault();
 const submit=$('#lSubmit');
 $('#lErr').textContent='';
 submit.disabled=true;
 submit.textContent='Ingresando…';
 try {
  const response=await api('login',{correo:$('#lMail').value.trim(),password:$('#lPass').value});
  if(!response.ok){
   $('#lErr').textContent=response.msg||'No se pudo iniciar sesión. Verifica tus datos.';
   return;
  }
  if(!response.user){
   $('#lErr').textContent='El servidor no devolvió los datos de usuario. Inténtalo nuevamente.';
   return;
  }
  await onLogin(response.user);
  saveSession(response.user);
 } catch(error) {
  console.error('Error al iniciar sesión:',error);
  $('#lErr').textContent=error.message||'No se pudo iniciar sesión. Inténtalo nuevamente.';
 } finally {
  submit.disabled=false;
  submit.textContent='Ingresar';
 }
};
$('#btnOut').onclick=()=>{clearSession();location.reload();};
$('#btnRec').onclick=()=>{
 $('#rErr').textContent='';
 if($('#lMail').value.trim())$('#rMail').value=$('#lMail').value.trim();
 show('#recM',true);
};
$('#rCancel').onclick=()=>show('#recM',false);
$('#rForm').onsubmit=async event=>{
 event.preventDefault();
 const submit=$('#rOk');
 const password=$('#rNew').value;
 $('#rErr').textContent='';
 if(password!==$('#rNew2').value){
  $('#rErr').textContent='Las contraseñas no coinciden.';
  return;
 }
 submit.disabled=true;
 submit.textContent='Actualizando…';
 try {
  const response=await api('reset',{correo:$('#rMail').value.trim(),nueva:password});
  if(!response.ok){
   $('#rErr').textContent=response.msg||'No se pudo actualizar la contraseña. Verifica el correo e inténtalo nuevamente.';
   return;
  }
  $('#rNew').value='';
  $('#rNew2').value='';
  show('#recM',false);
  $('#lErr').textContent='Contraseña actualizada. Ya puedes iniciar sesión.';
 } catch(error) {
  console.error('Error al restablecer la contraseña:',error);
  $('#rErr').textContent=error.message||'No se pudo actualizar la contraseña. Inténtalo nuevamente.';
 } finally {
  submit.disabled=false;
  submit.textContent='Cambiar';
 }
};


}
