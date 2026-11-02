// El cartero: manda el código de verificación de la cuenta (src/logica/correo.js) con Resend (valravnx, 2 nov).
// - Con la clave de Resend en la máquina (RESEND_API_KEY, en /etc/kinhold/correo.env: servidor/nube/LEEME.md), lo manda
//   por su API (https://api.resend.com/emails) desde KINHOLD_CORREO_DE (por defecto «Kinhold <cuentas@playkinhold.com>»).
// - Sin la clave (el servidor de pruebas, las pruebas), no manda nada: apunta el código en el registro del servidor
//   («código de verificación para «usuario»: 123456»), y así se puede probar sin correo de verdad.
// La clave nunca va al repositorio ni al registro.
import { enmascarar } from '../src/logica/correo.js';

export const DE = 'Kinhold <cuentas@playkinhold.com>';
const API = 'https://api.resend.com/emails';

const TEXTOS = {
  es: { asunto: 'Tu código de Kinhold: {c}', cuerpo: 'Hola, {u}:\n\nTu código para confirmar el correo de tu cuenta de Kinhold es:\n\n    {c}\n\nCaduca en 15 minutos. Si no has sido tú, no hagas nada: sin el código no se confirma nada.\n\nKinhold — https://playkinhold.com' },
  en: { asunto: 'Your Kinhold code: {c}', cuerpo: 'Hello, {u}:\n\nYour code to confirm the email of your Kinhold account is:\n\n    {c}\n\nIt expires in 15 minutes. If this wasn\'t you, do nothing: without the code nothing is confirmed.\n\nKinhold — https://playkinhold.com' },
  ru: { asunto: 'Ваш код Kinhold: {c}', cuerpo: 'Здравствуйте, {u}!\n\nВаш код для подтверждения почты аккаунта Kinhold:\n\n    {c}\n\nОн действует 15 минут. Если это были не вы, ничего не делайте: без кода ничего не подтверждается.\n\nKinhold — https://playkinhold.com' },
};
const poner = (t, d) => t.replace(/\{(\w)\}/g, (_, k) => d[k] ?? '');

export function crearCartero({ clave = process.env.RESEND_API_KEY, de = process.env.KINHOLD_CORREO_DE || DE, registrar = () => {}, pedir = globalThis.fetch } = {}) {
  clave = typeof clave === 'string' ? clave.trim() : '';
  return {
    conClave: !!clave,
    // manda el código; Promise<{ ok, motivo? }>
    async enviar({ para, usuario, codigo, idioma = 'es' }) {
      if (!clave) {
        registrar(`código de verificación para «${usuario}»: ${codigo} (a ${enmascarar(para)}; sin clave de Resend, no se manda)`);
        return { ok: true, apuntado: true };
      }
      const t = TEXTOS[idioma] || TEXTOS.es, d = { c: codigo, u: usuario };
      try {
        const r = await pedir(API, {
          method: 'POST',
          headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: de, to: [para], subject: poner(t.asunto, d), text: poner(t.cuerpo, d) }),
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok) { registrar(`código de verificación mandado a «${usuario}» (${enmascarar(para)})`); return { ok: true }; }
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
