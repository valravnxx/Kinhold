# Prueba en navegador del chat de texto (valravnx, 6 nov: «vamos a poner chat de texto ya, debe verse sobre el jugador,
# y desaparecer al rato»), contra el servidor de verdad, con un jugador simulado (node) a unos metros, en PC y en móvil:
#   - con Intro (en el móvil, el botón «Hablar») sale el cuadro para escribir; mientras se escribe no se mueve;
#   - al decirlo, el bocadillo sale sobre tu cabeza (lo que ha aceptado el servidor) y le llega al otro, contigo de autor;
#   - lo que dice el otro sale sobre su cabeza;
#   - Esc deja lo escrito sin decirlo; hablar a chorro: el aviso del servidor;
#   - el bocadillo se va al rato;
#   - las ocho frases rápidas: se ven enteras en el cuadro, un toque y se dice (por la red, solo su número) y a cada uno
#     le sale en su lengua (el móvil va en inglés: lo que el otro dice como frase 7 le sale «Watch out!»).
# Uso: python3 pruebas/prueba_charla_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el navegador no pone los bocadillos: tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_charla'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'
EN = json.load(open(os.path.join(RAIZ, 'src/idiomas/en.json'), encoding='utf-8'))
FRASES = ['¡Hola!', 'Sí', 'No', 'Gracias', 'Ven aquí', 'Espera', '¡Ayuda!', '¡Cuidado!']   # (src/logica/charla.js)

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

# el otro jugador: quieto en OTRO (m, relativos a la salida; cerca, para oírse), dice lo que le llega por su entrada y
# cuenta lo que oye
OTRO = (3.0, -6.0)
BOT = f"""import {{ WebSocket }} from 'ws';
import {{ createInterface }} from 'readline';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const y = terrenoWhitholm().suelo({OTRO[0]}, {OTRO[1]});
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
ws.on('open', () => setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: {OTRO[0]}, y, z: {OTRO[1]}, giro: 0, anim: 'quieto' }})), 200));
createInterface({{ input: process.stdin }}).on('line', (t) => ws.send(JSON.stringify(t.startsWith('#frase ') ? {{ tipo: 'decir', frase: +t.slice(7) }} : {{ tipo: 'decir', texto: t }})));
ws.on('message', (d) => {{ const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') console.log('yo ' + m.autor);
  if (m.tipo === 'dicho') console.log('dicho ' + JSON.stringify(m)); }});"""
bot = subprocess.Popen(['node', '--input-type=module', '-e', BOT], cwd=RAIZ, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
AUTOR_BOT = bot.stdout.readline().strip()[3:]
OYE = []
def leer_bot():
    for l in bot.stdout:
        if l.startswith('dicho '): OYE.append(json.loads(l[6:]))
threading.Thread(target=leer_bot, daemon=True).start()
def bot_dice(t): bot.stdin.write(t + '\n'); bot.stdin.flush()

URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(nombre, ok, detalle=''):
    print(('  OK   ' if ok else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not ok: fallos.append(nombre)
def esperar(pg, cond, ms=30000):
    try: pg.wait_for_function(cond, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
# el bocadillo de alguien: si se ve, su caja en pantalla, y dónde cae su cabeza
BOCADILLO = """(autor) => { const k = window.__kinhold, el = [...document.querySelectorAll('#charlaBocadillos .charlaBocadillo')].find(e => e.dataset.autor === autor);
  if (!el || el.style.display === 'none' || !(+el.style.opacity > 0)) return null;
  const r = el.getBoundingClientRect(), p = autor === k.yo ? k.pj : (k.panelAdmin && false) || null;
  return { texto: el.textContent, x: r.left + r.width / 2, abajo: r.bottom, w: r.width, h: r.height }; }"""
# dónde cae en pantalla la cabeza de alguien (2 m sobre sus pies)
CABEZA = """(autor) => { const k = window.__kinhold, T = k.camara.position.constructor;
  let p = null; if (autor === k.yo) p = k.pj; else { const r = k.escena.children.find(o => o.userData && o.userData.autor === autor); if (r) p = r.position; }
  if (!p) return null; const v = new T(p.x, p.y + 1.8, p.z).project(k.camara), c = document.getElementById('lienzo');
  return { x: (v.x + 1) / 2 * c.clientWidth, y: (1 - v.y) / 2 * c.clientHeight }; }"""

try:
    print('Jugador simulado:', AUTOR_BOT)
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR: ctx.add_init_script('window.__mutarCharla = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            lengua = 'en' if movil else 'es'
            T = (lambda t: EN.get(t, t)) if lengua == 'en' else (lambda t: t)
            pg.goto(URL + '&lang=' + lengua, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'charla' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.charla && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea, con el chat de texto y el botón «Hablar»', listo and pg.is_visible('#btnHablar'))
            yo = pg.evaluate(f'{K}.yo')
            # mirar hacia el otro (la cámara, detrás de ti)
            esperar(pg, f"{K}.escena.children.some(o => o.userData && o.userData.autor === {json.dumps(AUTOR_BOT)})", 30000)
            pg.evaluate(f"""(() => {{ const k = {K}, dx = {OTRO[0]} - k.pj.x, dz = {OTRO[1]} - k.pj.z; k.cam.yaw = Math.atan2(-dx, -dz); k.cam.pitch = 0.25; k.cam.dist = 9; }})()""")
            pg.wait_for_timeout(1500)
            antes = pg.evaluate(f'[{K}.pj.x, {K}.pj.z]')
            # (largas, para que tu bocadillo, de 10 a 11 s, siga cuando hable el otro: sin tarjeta gráfica todo va despacio)
            frase = 'Buenas, ¿subimos hoy el muro de zarzo de la casa? Traigo varas y barro del río, tú pon el cimiento' if nombre == 'pc' else 'Voy a por varas al bosque de allí y vuelvo enseguida con barro del río para el muro'
            if movil:
                pg.tap('#btnHablar')
                # (en el móvil se abre sin teclado, para que se vean las frases; se toca el campo para escribir)
                sin_teclado = esperar(pg, f"{K}.charla.abierta && document.activeElement && document.activeElement.id !== 'charlaTexto'", 5000)
                comprobar(f'{nombre}: «Hablar» abre el cuadro sin sacar el teclado (se ven las frases)', sin_teclado)
                pg.tap('#charlaTexto')
            else:
                pg.keyboard.press('Enter')
            abierta = esperar(pg, f"{K}.charla.abierta && document.activeElement && document.activeElement.id === 'charlaTexto'", 5000)
            comprobar(f'{nombre}: {"«Hablar» y tocar el campo" if movil else "Intro"} abre el cuadro para escribir', abierta)
            pg.keyboard.type(frase + ' wasd', delay=20)
            for _ in range(5): pg.keyboard.press('Backspace')
            pg.wait_for_timeout(800)
            ahora = pg.evaluate(f'[{K}.pj.x, {K}.pj.z]')
            comprobar(f'{nombre}: mientras se escribe, las teclas no mueven', abs(ahora[0] - antes[0]) < 0.05 and abs(ahora[1] - antes[1]) < 0.05, f'{antes} → {ahora}')
            n0 = len(OYE)
            if movil: pg.tap('#charlaDecir')
            else: pg.keyboard.press('Enter')
            sale = esperar(pg, f"{K}.charla.bocadillos.get({json.dumps(yo)}) === {json.dumps(frase)}", 5000)
            comprobar(f'{nombre}: al decirlo sale el bocadillo con lo que has dicho', sale and not pg.evaluate(f'{K}.charla.abierta'))
            pg.wait_for_timeout(600)
            b = pg.evaluate(BOCADILLO, yo); c = pg.evaluate(CABEZA, yo)
            comprobar(f'{nombre}: y se ve sobre tu cabeza', bool(b and c) and abs(b['x'] - c['x']) < 40 and b['abajo'] < c['y'] + 4 and b['abajo'] > c['y'] - 120, f'bocadillo {b} · cabeza {c}')
            for _ in range(30):
                if len(OYE) > n0: break
                time.sleep(0.1)
            nuevo = OYE[n0:] if len(OYE) > n0 else []
            comprobar(f'{nombre}: le llega al otro, contigo de autor (por el servidor)', any(d['autor'] == yo and d['texto'] == frase for d in nuevo), json.dumps(nuevo, ensure_ascii=False))
            dice = 'Aquí te espero' if nombre == 'pc' else 'Trae también barro'
            # (lo tuyo se dice otra vez justo antes, largo: en la nube, sin tarjeta gráfica, lo de antes puede haberse
            # ido ya cuando llega lo del otro, y entonces no habría dos bocadillos que mirar)
            otra = 'Y luego, con las varas que sobren, hacemos la puerta de la casa y el soporte de varas junto al muro'
            pg.wait_for_timeout(1100)
            pg.evaluate(f"(t) => {{ const c = {K}.charla; c.abrir(); const e = document.getElementById('charlaTexto'); e.value = t; document.getElementById('charlaCaja').requestSubmit(); }}", otra)
            esperar(pg, f"{K}.charla.bocadillos.get({json.dumps(yo)}) === {json.dumps(otra)}", 5000)
            bot_dice(dice)
            sale = esperar(pg, f"{K}.charla.bocadillos.get({json.dumps(AUTOR_BOT)}) === {json.dumps(dice)}", 5000)
            pg.wait_for_timeout(600)
            b2 = pg.evaluate(BOCADILLO, AUTOR_BOT); c2 = pg.evaluate(CABEZA, AUTOR_BOT)
            comprobar(f'{nombre}: lo que dice el otro sale sobre su cabeza', sale and bool(b2 and c2) and abs(b2['x'] - c2['x']) < 40 and b2['abajo'] < c2['y'] + 4 and b2['abajo'] > c2['y'] - 120, f'bocadillo {b2} · cabeza {c2}')
            # los dos a la vez (el tuyo aún se ve): no se pisan
            r = pg.evaluate("""() => [...document.querySelectorAll('#charlaBocadillos .charlaBocadillo')].filter(e => e.style.display !== 'none').map(e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })""")
            pisan = len(r) == 2 and r[0][0] < r[1][2] and r[0][2] > r[1][0] and r[0][1] < r[1][3] and r[0][3] > r[1][1]
            comprobar(f'{nombre}: los dos bocadillos a la vez, sin pisarse', len(r) == 2 and not pisan, str(r))
            captura(pg, f'{SALIDA}/{nombre}_charla.png')
            # Esc: lo escrito no se dice
            pg.wait_for_timeout(1200)
            n1 = len(OYE)
            if movil: pg.tap('#btnHablar'); esperar(pg, f"{K}.charla.abierta", 3000); pg.tap('#charlaTexto')
            else: pg.keyboard.press('Enter')
            esperar(pg, f"{K}.charla.abierta", 3000)
            pg.keyboard.type('esto no', delay=20); pg.keyboard.press('Escape')
            pg.wait_for_timeout(1500)
            comprobar(f'{nombre}: Esc lo deja sin decirlo', not pg.evaluate(f'{K}.charla.abierta') and len(OYE) == n1)
            # a chorro: dos seguidas desde el cuadro, en el mismo instante (escribiéndolas, sin tarjeta gráfica pasaba más de un
            # segundo entre una y otra y el servidor, con razón, dejaba las dos): la segunda no pasa y se avisa
            pg.evaluate(f"""(() => {{ const c = {K}.charla, f = document.getElementById('charlaCaja'), t = document.getElementById('charlaTexto');
              for (const x of ['una', 'dos']) {{ c.abrir(); t.value = x; f.requestSubmit(); }} }})()""")
            despacio = T('Más despacio: espera un poco antes de volver a hablar.')[:12]
            aviso = esperar(pg, f"!document.getElementById('aviso').hidden && document.getElementById('aviso').textContent.includes({json.dumps(despacio)})", 5000)
            comprobar(f'{nombre}: hablar a chorro: el servidor no lo deja y se avisa', aviso and pg.evaluate(f"{K}.charla.bocadillos.get({json.dumps(yo)})") == 'una')
            # y el bocadillo se va al rato (el de «una»: 4,2 s)
            se_va = esperar(pg, f"!{K}.charla.bocadillos.has({json.dumps(yo)}) && ![...document.querySelectorAll('#charlaBocadillos .charlaBocadillo')].some(e => e.dataset.autor === {json.dumps(yo)})", 15000)
            comprobar(f'{nombre}: el bocadillo se va al rato', se_va)
            # las ocho frases rápidas: enteras y en tu lengua en el cuadro
            pg.wait_for_timeout(1200)
            if movil: pg.tap('#btnHablar')
            else: pg.keyboard.press('Enter')
            esperar(pg, f"{K}.charla.abierta", 3000)
            pg.wait_for_timeout(300)
            botones = pg.evaluate("""() => [...document.querySelectorAll('#charlaFrases button')].map(b => { const r = b.getBoundingClientRect();
              return { t: b.textContent, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, cabe: b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1 }; })""")
            W, H = vista['width'], vista['height']
            comprobar(f'{nombre}: las ocho frases rápidas, en tu lengua', [b['t'] for b in botones] == [T(f) for f in FRASES], str([b['t'] for b in botones]))
            comprobar(f'{nombre}: enteras y dentro de la pantalla (sin cortar el texto)', len(botones) == 8 and all(b['cabe'] and b['x0'] >= 0 and b['x1'] <= W and b['y0'] >= 0 and b['y1'] <= H for b in botones), str(botones[:2]))
            captura(pg, f'{SALIDA}/{nombre}_frases.png')
            try: pg.locator('#charlaCaja').screenshot(path=f'{SALIDA}/{nombre}_frases_cerca.png')
            except Exception as e: print('  (sin captura de cerca:', str(e)[:80], ')')
            # un toque en «Ven aquí» (la 4): se dice, y por la red va solo su número
            n2 = len(OYE)
            if movil: pg.tap('#charlaFrases button[data-frase="4"]')
            else: pg.click('#charlaFrases button[data-frase="4"]')
            sale = esperar(pg, f"{K}.charla.bocadillos.get({json.dumps(yo)}) === {json.dumps(T('Ven aquí'))}", 5000)
            comprobar(f'{nombre}: un toque en «{T("Ven aquí")}» y se dice (y el cuadro se cierra)', sale and not pg.evaluate(f'{K}.charla.abierta'))
            for _ in range(30):
                if len(OYE) > n2: break
                time.sleep(0.1)
            nuevo = OYE[n2:]
            comprobar(f'{nombre}: al otro le llega su número, no el texto', any(d['autor'] == yo and d.get('frase') == 4 and 'texto' not in d for d in nuevo), json.dumps(nuevo, ensure_ascii=False))
            # y lo que el otro dice como frase rápida, a ti te sale en tu lengua (enseguida: para la captura, con los dos
            # bocadillos aún a la vista; el límite es de cada uno)
            bot_dice('#frase 7')
            sale = esperar(pg, f"{K}.charla.bocadillos.get({json.dumps(AUTOR_BOT)}) === {json.dumps(T('¡Cuidado!'))}", 5000)
            comprobar(f'{nombre}: la frase rápida del otro te sale en tu lengua («{T("¡Cuidado!")}»)', sale, str(pg.evaluate(f"[...{K}.charla.bocadillos]")))
            captura(pg, f'{SALIDA}/{nombre}_frase_dicha.png')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.2)
        nav.close()
finally:
    bot.kill(); servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
