// El cartero: manda el código de verificación de la cuenta (src/logica/correo.js) con Resend (valravnx, 2 nov).
// - Con la clave de Resend en la máquina (RESEND_API_KEY, en /etc/kinhold/correo.env: servidor/nube/LEEME.md), lo manda
//   por su API (https://api.resend.com/emails) desde KINHOLD_CORREO_DE (por defecto «Kinhold <cuentas@playkinhold.com>»).
// - Sin la clave (el servidor de pruebas, las pruebas), no manda nada: apunta el código en el registro del servidor
//   («código de verificación para «usuario»: 123456»), y así se puede probar sin correo de verdad.
// La clave nunca va al repositorio ni al registro.
// Lo que manda (tipo): 'verificar' (el código para confirmar el correo), 'recuperar' (el código para poner otra
// contraseña: sin clave apunta «código para recuperar la contraseña de «usuario»: 123456»), 'aviso_clave' (se ha cambiado
// la contraseña) y 'aviso_correo' (se ha cambiado el correo: al de antes, con el nuevo a medias en {n}).
import { enmascarar } from '../src/logica/correo.js';

export const DE = 'Kinhold <cuentas@playkinhold.com>';
const API = 'https://api.resend.com/emails';

const PIE = '\n\nKinhold — https://playkinhold.com';
const TEXTOS = {
  es: {
    verificar: ['Tu código de Kinhold: {c}', 'Hola, {u}:\n\nTu código para confirmar el correo de tu cuenta de Kinhold es:\n\n    {c}\n\nCaduca en 15 minutos. Si no has sido tú, no hagas nada: sin el código no se confirma nada.'],
    recuperar: ['Recupera tu contraseña de Kinhold: {c}', 'Hola, {u}:\n\nAlguien ha pedido poner otra contraseña a tu cuenta de Kinhold. Tu código es:\n\n    {c}\n\nCaduca en 15 minutos. Si no has sido tú, no hagas nada: sin el código tu contraseña no cambia.'],
    aviso_clave: ['Se ha cambiado tu contraseña de Kinhold', 'Hola, {u}:\n\nSe acaba de cambiar la contraseña de tu cuenta de Kinhold y se ha cerrado la sesión en los demás aparatos.\n\nSi no has sido tú, recupera la contraseña desde la pantalla de entrar («¿Has olvidado la contraseña?») cuanto antes.'],
    aviso_correo: ['Se ha cambiado el correo de tu cuenta de Kinhold', 'Hola, {u}:\n\nEl correo de tu cuenta de Kinhold ya no es este: ahora es {n}.\n\nSi no has sido tú, alguien tiene tu contraseña: escríbenos desde la web cuanto antes.'],
  },
  en: {
    verificar: ['Your Kinhold code: {c}', 'Hello, {u}:\n\nYour code to confirm the email of your Kinhold account is:\n\n    {c}\n\nIt expires in 15 minutes. If this wasn\'t you, do nothing: without the code nothing is confirmed.'],
    recuperar: ['Recover your Kinhold password: {c}', 'Hello, {u}:\n\nSomeone asked to set a new password for your Kinhold account. Your code is:\n\n    {c}\n\nIt expires in 15 minutes. If this wasn\'t you, do nothing: without the code your password does not change.'],
    aviso_clave: ['Your Kinhold password has been changed', 'Hello, {u}:\n\nThe password of your Kinhold account has just been changed and you have been signed out on your other devices.\n\nIf this wasn\'t you, recover your password from the sign-in screen («Forgot your password?») as soon as possible.'],
    aviso_correo: ['The email of your Kinhold account has been changed', 'Hello, {u}:\n\nThe email of your Kinhold account is no longer this one: it is now {n}.\n\nIf this wasn\'t you, someone has your password: write to us from the website as soon as possible.'],
  },
  ru: {
    verificar: ['Ваш код Kinhold: {c}', 'Здравствуйте, {u}!\n\nВаш код для подтверждения почты аккаунта Kinhold:\n\n    {c}\n\nОн действует 15 минут. Если это были не вы, ничего не делайте: без кода ничего не подтверждается.'],
    recuperar: ['Восстановление пароля Kinhold: {c}', 'Здравствуйте, {u}!\n\nКто-то попросил задать новый пароль для вашего аккаунта Kinhold. Ваш код:\n\n    {c}\n\nОн действует 15 минут. Если это были не вы, ничего не делайте: без кода пароль не изменится.'],
    aviso_clave: ['Пароль Kinhold изменён', 'Здравствуйте, {u}!\n\nПароль вашего аккаунта Kinhold только что изменён, и на других устройствах выполнен выход.\n\nЕсли это были не вы, как можно скорее восстановите пароль на экране входа («Забыли пароль?»).'],
    aviso_correo: ['Почта аккаунта Kinhold изменена', 'Здравствуйте, {u}!\n\nПочта вашего аккаунта Kinhold больше не эта: теперь это {n}.\n\nЕсли это были не вы, у кого-то есть ваш пароль: как можно скорее напишите нам через сайт.'],
  },
};
const poner = (t, d) => t.replace(/\{(\w)\}/g, (_, k) => d[k] ?? '');

export function crearCartero({ clave = process.env.RESEND_API_KEY, de = process.env.KINHOLD_CORREO_DE || DE, registrar = () => {}, pedir = globalThis.fetch } = {}) {
  clave = typeof clave === 'string' ? clave.trim() : '';
  return {
    conClave: !!clave,
    // manda el código; Promise<{ ok, motivo? }>
    async enviar({ para, usuario, codigo, idioma = 'es', tipo = 'verificar', nuevo = '' }) {
      if (!TEXTOS.es[tipo]) tipo = 'verificar';
      if (!clave) {
        const que = tipo === 'verificar' ? `código de verificación para «${usuario}»: ${codigo}` : tipo === 'recuperar' ? `código para recuperar la contraseña de «${usuario}»: ${codigo}` : `aviso a «${usuario}» (${tipo})`;
        registrar(`${que} (a ${enmascarar(para)}; sin clave de Resend, no se manda)`);
        return { ok: true, apuntado: true };
      }
      const [asunto, cuerpo] = (TEXTOS[idioma] || TEXTOS.es)[tipo], d = { c: codigo, u: usuario, n: enmascarar(nuevo) };
      const t = { asunto, cuerpo: cuerpo + PIE };
      try {
        const r = await pedir(API, {
          method: 'POST',
          headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: de, to: [para], subject: poner(t.asunto, d), text: poner(t.cuerpo, d) }),
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok) { registrar(`correo (${tipo}) mandado a «${usuario}» (${enmascarar(para)})`); return { ok: true }; }
        let det = ''; try { det = (await r.text()).slice(0, 200); } catch (e) { /* nada */ }
        registrar(`Resend no ha mandado el correo de «${usuario}»: ${r.status} ${det}`);
        return { ok: false, motivo: 'No se ha podido mandar el correo; prueba más tarde.' };
      } catch (e) {
        registrar(`Resend no responde (correo de «${usuario}»): ${e && (e.name || e.message)}`);
        return { ok: false, motivo: 'No se ha podido mandar el correo; prueba más tarde.' };
      }
    },
  };
}
