# Prueba en navegador de «volver donde lo dejaste» (valravnx, 31 oct): con un servidor local y la demo en línea,
# el jugador se mueve, recarga la página y aparece donde estaba; una pestaña nueva del mismo navegador es el mismo
# jugador (la ficha va en el navegador, no en la pestaña) y deja fuera a la de antes, que lo dice en su cartel; otro
# navegador es otro jugador y sale en la salida. En el llano (?llano=1), para que cargue antes: las posiciones en
# línea van igual, relativas al sitio de salida.
# Uso: python3 pruebas/prueba_volver_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1 lanza un servidor que no manda dónde estabas: tiene que fallar.
# MUTAR_FICHA=1 guarda la ficha en la pestaña, como antes (sessionStorage): la pestaña nueva es otro; tiene que fallar.
import sys, os, json, tempfile, threading, http.server, functools, socketserver, subprocess, socket, shutil
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_volver'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
MUTAR_FICHA = bool(os.environ.get('MUTAR_FICHA'))

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
SERVIDOR = os.path.join(RAIZ, 'servidor/servidor.mjs')
if MUTAR:
    t = open(SERVIDOR).read(); m = t.replace('posicion: posiciones.get(autor) || null', 'posicion: null'); assert m != t
    SERVIDOR = os.path.join(RAIZ, 'servidor/.servidor_mutado_volver.mjs'); open(SERVIDOR, 'w').write(m)
servidor = subprocess.Popen(['node', SERVIDOR, str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&llano=1&servidor=ws://127.0.0.1:{PUERTO}'
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
    try: pg.screenshot(path=ruta)   # sin tarjeta gráfica, a veces no sale: no es lo que se prueba
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
def entrar(pg):
    pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
    return esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && !!{K}.enLinea.red.yo", 180000)
pos = lambda pg: pg.evaluate(f"({{ x: {K}.pj.x, z: {K}.pj.z, rot: {K}.pj.rot }})")

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR_FICHA:
                ctx.add_init_script("""(() => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
                  Storage.prototype.getItem = function (k) { if (String(k).startsWith('kinhold_ficha') && this === localStorage) return sessionStorage.getItem(k); return g.call(this, k); };
                  Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('kinhold_ficha') && this === localStorage) return sessionStorage.setItem(k, v); return s.call(this, k, v); }; })()""")
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            comprobar(f'{nombre}: entra en línea', entrar(pg))
            yo = pg.evaluate(f"{K}.enLinea.red.yo")
            p0 = pos(pg)
            comprobar(f'{nombre}: la primera vez, en la salida', abs(p0['x']) < 6 and abs(p0['z']) < 6, str(p0))
            # se va a otro sitio y espera a que el servidor lo apunte (el latido; aquí, salir lo apunta igual)
            destino = (14.0, -9.0) if not movil else (-11.0, 13.0)
            pg.evaluate(f"Object.assign({K}.pj, {{ x: {destino[0]}, z: {destino[1]}, rot: 1.1 }})")
            pg.wait_for_timeout(2500)
            print('  recarga la página')
            comprobar(f'{nombre}: vuelve a entrar', entrar(pg))
            p1 = pos(pg)
            comprobar(f'{nombre}: el mismo jugador', pg.evaluate(f"{K}.enLinea.red.yo") == yo)
            comprobar(f'{nombre}: aparece donde lo dejó', abs(p1['x'] - destino[0]) < 0.3 and abs(p1['z'] - destino[1]) < 0.3, str(p1))
            captura(pg, f'{SALIDA}/{nombre}_volver.png')
            print('  pestaña nueva del mismo navegador')
            pg2 = ctx.new_page()
            comprobar(f'{nombre}: la pestaña nueva entra', entrar(pg2))
            comprobar(f'{nombre}: y es el mismo jugador (la ficha va en el navegador)', pg2.evaluate(f"{K}.enLinea.red.yo") == yo, pg2.evaluate(f"{K}.enLinea.red.yo"))
            p2 = pos(pg2)
            comprobar(f'{nombre}: también donde lo dejó', abs(p2['x'] - destino[0]) < 0.5 and abs(p2['z'] - destino[1]) < 0.5, str(p2))
            comprobar(f'{nombre}: la de antes se queda fuera y lo dice', esperar(pg, "!!document.getElementById('sinConexion') && document.getElementById('sinConexion').innerText.includes('otra pestaña')", 20000))
            captura(pg, f'{SALIDA}/{nombre}_otra_pestana.png')
            print('  otro navegador')
            ctx2 = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            pg3 = ctx2.new_page()
            comprobar(f'{nombre}: otro navegador entra', entrar(pg3))
            p3 = pos(pg3)
            comprobar(f'{nombre}: es otro jugador, en la salida', pg3.evaluate(f"{K}.enLinea.red.yo") != yo and abs(p3['x']) < 6 and abs(p3['z']) < 6, str(p3))
            ctx2.close()
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
        nav.close()
finally:
    if servidor.poll() is None: servidor.terminate()
    if MUTAR: os.remove(SERVIDOR)
    web.shutdown()
    shutil.rmtree(sitio, ignore_errors=True)

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
