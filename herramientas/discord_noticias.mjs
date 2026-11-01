// Noticias del desarrollo en Discord (valravnx, 1 nov): cada versión jugable nueva y cada entrada nueva del diario se
// publican solas en el Discord de Kinhold, por los webhooks que crea el montador del servidor. El servidor va en inglés
// (valravnx, 1 nov: «que el main sea inglés»): en inglés salen en #versions y #dev-diary, y en español y en ruso, las
// dos cosas juntas en el canal de noticias de cada idioma (las traducciones, las de proyecto/idiomas). Lo lanza GitHub al subir a main (.github/workflows/discord.yml), así que no depende de que
// nadie tenga nada encendido.
//
// Uso: node herramientas/discord_noticias.mjs <commit de antes> <commit de ahora>
//   Con los secretos del repositorio DISCORD_WEBHOOK_VERSIONES y DISCORD_WEBHOOK_DIARIO (en inglés) y
//   DISCORD_WEBHOOK_ES y DISCORD_WEBHOOK_RU (español y ruso); los que falten se saltan, y sin ninguno no hace nada.
//   SIN_ENVIAR=1 → escribe en la salida lo que mandaría, sin mandarlo.
//
// - Versiones: las páginas docs/jugar/<prototipo>/vN.html que aparecen entre los dos commits; la nota y las capturas,
//   las de esa versión en proyecto/roadmap.json.
// - Diario: las entradas de proyecto/diario.json que no estaban antes (por su hora de inicio y su título).
// - Como mucho MAX_MENSAJES de cada cosa por vez (si llegan muchas de golpe, las últimas), con un respiro entre
//   mensajes para no pasar del límite de Discord.
// - Las imágenes van por raw.githubusercontent.com con el commit exacto: están desde el primer momento (la web de
//   GitHub Pages tarda un rato en publicarse).
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

export const WEB = 'https://valravnxx.github.io/Kinhold/';
export const REPO = 'valravnxx/Kinhold';
export const ICONO = WEB + 'recursos/marca/v1/icono_k_192.png';
export const MAX_MENSAJES = 8;
const COLOR = { ok: 0x7a9a5a, fallo: 0xb04a3a, version: 0x8c2a1e };
// los textos fijos de los mensajes, en cada idioma
export const TEXTOS = {
  es: { hito: 'Hito', tiempo: 'Tiempo', pruebas: 'Pruebas', min: 'min', jugar: 'Jugar', progreso: 'El progreso del desarrollo', nueva: 'Versión nueva.' },
  en: { hito: 'Milestone', tiempo: 'Time', pruebas: 'Tests', min: 'min', jugar: 'Play', progreso: 'Development progress', nueva: 'New version.' },
  ru: { hito: 'Этап', tiempo: 'Время', pruebas: 'Тесты', min: 'мин', jugar: 'Играть', progreso: 'Ход разработки', nueva: 'Новая версия.' },
};

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const jsonEn = (commit, ruta) => { try { return JSON.parse(git('show', `${commit}:${ruta}`)); } catch { return null; } };
const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const crudo = (sha, ruta) => `https://raw.githubusercontent.com/${REPO}/${sha}/docs/${ruta}`;

// la primera captura de una carpeta (en ese commit), mejor una de PC
function primeraCaptura(sha, carpeta) {
  if (!carpeta) return null;
  let lista = [];
  try { lista = git('ls-tree', '--name-only', `${sha}:docs/${carpeta}`).split('\n').filter(f => /\.(jpe?g|png)$/i.test(f)); } catch { return null; }
  if (!lista.length) return null;
  const f = lista.find(x => x.startsWith('pc')) || lista[0];
  return crudo(sha, `${carpeta}/${f}`);
}

// Lo que hay que publicar entre dos commits (puro con lo que le pasan; lo usa la prueba)
// idioma: es, en o ru; trad: el diccionario de proyecto/idiomas/<idioma>.json (texto en español → traducción)
export function noticias({ diarioAntes, diarioAhora, versionesNuevas, roadmap, sha, captura = () => null, idioma = 'es', trad = {} }) {
  const tx = TEXTOS[idioma] || TEXTOS.es;
  const t = (s) => (idioma === 'es' || !s ? s : (trad[s] ?? s));
  const web = WEB + `?lang=${idioma}`;
  const clave = (e) => `${e.inicio}|${e.titulo}`;
  const antes = new Set((diarioAntes || []).map(clave));
  const nombreHito = Object.fromEntries((roadmap?.hitos || []).map(h => [h.id, t(h.nombre)]));
  const diario = (diarioAhora || []).filter(e => !antes.has(clave(e))).slice(-MAX_MENSAJES).map(e => {
    const min = Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000);
    const hecho = (e.hecho || []).map(h => '• ' + t(h)).join('\n');
    const emb = {
      title: corta((e.estado === 'fallo' ? '⚠️ ' : '') + t(e.titulo), 256),
      url: web,
      color: COLOR[e.estado] ?? COLOR.ok,
      description: corta(hecho || '—', 4000),
      fields: [
        ...(nombreHito[e.hito] ? [{ name: tx.hito, value: corta(nombreHito[e.hito], 1024), inline: true }] : []),
        ...(Number.isFinite(min) && min > 0 ? [{ name: tx.tiempo, value: `${min} ${tx.min}`, inline: true }] : []),
        ...(e.pruebas ? [{ name: tx.pruebas, value: corta(t(e.pruebas), 1024) }] : []),
      ],
      timestamp: e.fin || e.inicio,
    };
    const img = captura(e.capturas);
    if (img) emb.image = { url: img };
    return { embeds: [emb] };
  });
  const protos = Object.fromEntries((roadmap?.prototipos || []).map(p => [p.id, p]));
  const versiones = (versionesNuevas || []).slice(-MAX_MENSAJES).map(({ prototipo, v }) => {
    const p = protos[prototipo];
    const info = (p?.versiones || []).find(x => x.v === v) || {};
    const emb = {
      title: corta(`${t(p?.nombre) || prototipo} · ${v}`, 256),
      url: WEB + `jugar/${prototipo}/${v}.html?lang=${idioma}`,
      color: COLOR.version,
      description: corta((t(info.notas) || tx.nueva) + `\n\n🎮 **[${tx.jugar}](${WEB}jugar/${prototipo}/?lang=${idioma})** · 🗺️ [${tx.progreso}](${web})`, 4000),
      timestamp: info.fecha ? new Date(info.fecha + 'T12:00:00Z').toISOString() : undefined,
    };
    const img = captura(info.capturas);
    if (img) emb.image = { url: img };
    return { embeds: [emb] };
  });
  return { diario, versiones };
}

// las páginas de versión que aparecen entre dos commits
export function versionesEntre(antes, ahora) {
  let salida = '';
  try { salida = git('diff', '--name-only', '--diff-filter=A', antes, ahora, '--', 'docs/jugar'); } catch { return []; }
  return salida.split('\n').map(f => f.match(/^docs\/jugar\/([^/]+)\/(v\d+)\.html$/)).filter(Boolean)
    .map(m => ({ prototipo: m[1], v: m[2] })).sort((a, b) => a.prototipo.localeCompare(b.prototipo) || Number(a.v.slice(1)) - Number(b.v.slice(1)));
}

async function mandar(url, cuerpo) {
  const datos = { username: 'Kinhold', avatar_url: ICONO, allowed_mentions: { parse: [] }, ...cuerpo };
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    if (r.ok) return true;
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(z => setTimeout(z, Math.ceil((j.retry_after || 2) * 1000))); continue; }
    console.error(`Discord ha dicho ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return false;
  }
  return false;
}

async function principal() {
  const [antes, ahora] = process.argv.slice(2);
  if (!antes || !ahora) { console.error('Uso: node herramientas/discord_noticias.mjs <commit de antes> <commit de ahora>'); process.exit(2); }
  const ev = process.env, seco = !!ev.SIN_ENVIAR;
  // a dónde va cada cosa en cada idioma: [idioma, webhook de las versiones, webhook del diario]
  const destinos = [['en', ev.DISCORD_WEBHOOK_VERSIONES, ev.DISCORD_WEBHOOK_DIARIO], ['es', ev.DISCORD_WEBHOOK_ES, ev.DISCORD_WEBHOOK_ES],
    ['ru', ev.DISCORD_WEBHOOK_RU, ev.DISCORD_WEBHOOK_RU]].filter(([, v, d]) => seco || v || d);
  if (!destinos.length) { console.log('Sin webhooks de Discord (secretos DISCORD_WEBHOOK_*): no se publica nada.'); return; }
  const sha = git('rev-parse', ahora).trim();
  const base = /^0+$/.test(antes) ? `${sha}~1` : antes;   // (el primer empuje de una rama trae un «antes» vacío)
  const comun = {
    diarioAntes: jsonEn(base, 'proyecto/diario.json'), diarioAhora: jsonEn(sha, 'proyecto/diario.json'),
    versionesNuevas: versionesEntre(base, sha), roadmap: jsonEn(sha, 'proyecto/roadmap.json'), sha,
    captura: (carpeta) => primeraCaptura(sha, carpeta),
  };
  let mal = 0;
  for (const [idioma, urlV, urlD] of destinos) {
    const trad = idioma === 'es' ? {} : (jsonEn(sha, `proyecto/idiomas/${idioma}.json`) || {});
    const n = noticias({ ...comun, idioma, trad });
    console.log(`${idioma}: ${n.versiones.length} versiones y ${n.diario.length} entradas del diario nuevas.`);
    for (const [url, lista] of [[urlV, n.versiones], [urlD, n.diario]]) {
      for (const m of lista) {
        if (seco) { console.log(JSON.stringify(m)); continue; }
        if (!url) continue;
        if (!(await mandar(url, m))) mal++;
        await new Promise(z => setTimeout(z, 1200));
      }
    }
  }
  if (mal) { console.error(`${mal} mensajes no se han podido publicar.`); process.exit(1); }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) principal();
