# Prueba en navegador de desconectarse (GDD, apartado 6; src/logica/dormidos.js), contra el servidor de verdad, con un
# jugador simulado (node) a unos metros, en PC y en móvil (una sola página):
#   - mientras está, se le ve de pie y sin símbolo;
#   - al cortarse su conexión no desaparece: se queda tumbado donde estaba, con el símbolo de desconectado encima.
# Uso: python3 pruebas/prueba_desconectado_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el navegador no pone el símbolo: tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_desconectado'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

def bot_codigo(OTRO): return f"""import {{ WebSocket }} from 'ws';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const y = terrenoWhitholm().suelo({OTRO[0]}, {OTRO[1]});
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
ws.on('open', () => {{ setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: {OTRO[0]}, y, z: {OTRO[1]}, giro: 0.6, anim: 'quieto' }})), 200); }});
ws.on('message', (d) => {{ const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') console.log('yo ' + m.autor); }});"""
def bot_nuevo(OTRO):
    b = subprocess.Popen(['node', '--input-type=module', '-e', bot_codigo(OTRO)], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return b, b.stdout.readline().strip()[3:]

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
# el símbolo de desconectado de alguien: dónde está y si se ve (o null)
SIMBOLO = f"""(autor) => {{ const s = {K}.escena.children.find(o => o.userData && o.userData.simboloDe === autor); return s ? [s.position.x, s.position.y, s.position.z, s.visible] : null; }}"""
HAY_SIMBOLO = f"""(autor) => {K}.escena.children.some(o => o.userData && o.userData.simboloDe === autor)"""
bots = []
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil, OTRO in [('pc', {'width': 1280, 'height': 800}, False, (3.0, -5.0)), ('movil', {'width': 390, 'height': 844}, True, (-3.0, -5.0))]:
            print('Vista', nombre)
            bot, autor = bot_nuevo(OTRO); bots.append(bot)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR: ctx.add_init_script('window.__mutarDesconectado = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'descon' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea', listo)
            visto = esperar(pg, f"{K}.escena.children.some(o => o.userData && o.userData.autor === {json.dumps(autor)})", 30000)
            pg.evaluate(f"""(() => {{ const k = {K}, dx = {OTRO[0]} - k.pj.x, dz = {OTRO[1]} - k.pj.z; k.cam.yaw = Math.atan2(-dx, -dz) + {0.25 if movil else 0.5}; k.cam.pitch = 0.35; k.cam.dist = 6.5; }})()""")
            pg.wait_for_timeout(1500)
            comprobar(f'{nombre}: mientras está, se le ve y sin símbolo', visto and pg.evaluate(SIMBOLO, autor) is None)
            captura(pg, f'{SALIDA}/{nombre}_conectado.png')
            bot.kill(); bot.wait()
            try: pg.wait_for_function(HAY_SIMBOLO, arg=autor, timeout=20000); sale = True
            except Exception: sale = False
            s = pg.evaluate(SIMBOLO, autor)
            comprobar(f'{nombre}: al cortarse, el símbolo de desconectado sale encima de él', sale and s and abs(s[0] - OTRO[0]) < 0.3 and abs(s[2] - OTRO[1]) < 0.3 and s[3], str(s))
            sigue = pg.evaluate(f"{K}.escena.children.some(o => o.userData && o.userData.autor === {json.dumps(autor)})")
            comprobar(f'{nombre}: y no desaparece: se queda donde estaba', sigue)
            pg.wait_for_timeout(25000)   # que se tumbe (sin tarjeta gráfica va a 1 fotograma por segundo, y la animación avanza poco en cada uno)
            captura(pg, f'{SALIDA}/{nombre}_desconectado.png')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    for b in bots:
        try: b.kill()
        except Exception: pass
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
