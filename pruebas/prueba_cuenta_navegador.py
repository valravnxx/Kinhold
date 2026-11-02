# Prueba en navegador de la pantalla de entrar y de crear cuenta (P1 «Cuentas», src/mundo/pantalla_cuenta.js).
# Uso: python3 pruebas/prueba_cuenta_navegador.py <html de la demo> <carpeta_capturas>
# Una sola página abierta cada vez (no es de las de dos páginas en línea): la demo con un servidor local. En PC y en móvil:
#   - al entrar por primera vez sale la pantalla de la cuenta (crear), que tapa el juego;
#   - lo que no vale se dice al momento (usuario corto, contraseñas distintas) y no se manda;
#   - al crear la cuenta se quita la pantalla y el personaje sigue siendo el mismo (mismo autor), y el servidor la guarda
#     con ese autor y sin la contraseña en claro;
#   - al recargar se entra solo, sin pantalla, con el mismo personaje;
#   - desde otro aparato (otro navegador, sin nada guardado): pantalla otra vez, con otro personaje; «Entrar» con la
#     contraseña mal lo dice y no entra; con la buena, recarga y es el personaje de la cuenta, sin pantalla;
#   - en el menú sale la cuenta y «Salir de la cuenta» olvida la ficha: al volver a «Jugar», pantalla otra vez.
# MUTAR=1: un servidor que al entrar da la ficha de otro personaje: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, json
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_cuenta'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

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
    t = open(SERVIDOR).read(); m = t.replace("ficha: fichaPara(r.autor)", "ficha: fichaPara('jugador:otro')"); assert m != t
    SERVIDOR = os.path.join(RAIZ, 'servidor/.servidor_mutado_cuenta_nav.mjs'); open(SERVIDOR, 'w').write(m)
servidor = subprocess.Popen(['node', SERVIDOR, str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ, env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()

BASE = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html'
URL = f'{BASE}?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
MENU = f'{BASE}?servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
LISTO = f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.enLinea.red.yo && {K}.mundoListo"
PANTALLA = "!!document.getElementById('pantallaCuenta')"
MOTIVO = "document.getElementById('pcMotivo').textContent"
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
def cuentas_guardadas():
    try: return [json.loads(l) for l in open(os.path.join(sitio, 'cuentas.jsonl')) if l.strip()]
    except FileNotFoundError: return []
def rellenar(pg, usuario, clave, clave2=None):
    pg.fill('#pcUsuario', usuario); pg.fill('#pcClave', clave)
    if clave2 is not None: pg.fill('#pcClave2', clave2)
    pg.click('#pcIr')

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            USUARIO, CLAVE = f'Ana_{nombre}', 'pradera-del-sur-7'
            opciones = dict(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            # --- el primer aparato: crear la cuenta
            ctx = nav.new_context(**opciones)
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: entra en línea con el mundo listo', esperar(pg, LISTO, 300000))
            comprobar(f'{nombre}: sale la pantalla de la cuenta', esperar(pg, PANTALLA, 10000))
            autor = pg.evaluate(f'{K}.enLinea.red.yo')
            tapa = pg.evaluate("(() => { const r = document.getElementById('pantallaCuenta').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; })()")
            comprobar(f'{nombre}: la pantalla tapa el juego entero', tapa)
            caja = pg.evaluate("(() => { const r = document.querySelector('#pantallaCuenta .pc-caja').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })()")
            comprobar(f'{nombre}: la caja cabe en la pantalla', caja[0] >= 0 and caja[1] <= vista['width'] and caja[2] >= 0 and caja[3] <= vista['height'], str(caja))
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/cuenta-crear-{nombre}.png')
            rellenar(pg, 'ab', CLAVE, CLAVE)
            comprobar(f'{nombre}: usuario corto, dicho al momento', 'de 3 a 20' in pg.evaluate(MOTIVO), pg.evaluate(MOTIVO))
            rellenar(pg, USUARIO, CLAVE, CLAVE + 'x')
            comprobar(f'{nombre}: contraseñas distintas, dicho al momento', 'no son iguales' in pg.evaluate(MOTIVO), pg.evaluate(MOTIVO))
            captura(pg, f'{SALIDA}/cuenta-motivo-{nombre}.png')
            comprobar(f'{nombre}: lo que no vale no llega al servidor', not cuentas_guardadas() if nombre == 'pc' else len(cuentas_guardadas()) == 1)
            rellenar(pg, USUARIO, CLAVE, CLAVE)
            comprobar(f'{nombre}: al crear la cuenta se quita la pantalla', esperar(pg, '!' + PANTALLA, 15000), pg.evaluate(f"document.getElementById('pcMotivo') && {MOTIVO}") or '')
            comprobar(f'{nombre}: sigue siendo el mismo personaje', pg.evaluate(f'{K}.enLinea.red.yo') == autor)
            comprobar(f'{nombre}: el cliente sabe su cuenta', pg.evaluate(f'{K}.enLinea.cuenta') == USUARIO, str(pg.evaluate(f'{K}.enLinea.cuenta')))
            c = [x for x in cuentas_guardadas() if x.get('usuario') == USUARIO]
            comprobar(f'{nombre}: el servidor la guarda con ese personaje', len(c) == 1 and c[0].get('autor') == autor, str(c[:1])[:120])
            comprobar(f'{nombre}: sin la contraseña en claro', CLAVE not in open(os.path.join(sitio, 'cuentas.jsonl')).read())
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/cuenta-creada-{nombre}.png')
            # al recargar: se entra solo
            pg.reload(wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: al recargar entra solo', esperar(pg, LISTO, 300000) and pg.evaluate(f'{K}.enLinea.red.yo') == autor and not pg.evaluate(PANTALLA))
            ctx.close()
            # --- otro aparato: entrar con la cuenta
            ctx = nav.new_context(**opciones)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: en otro aparato, pantalla y otro personaje', esperar(pg, LISTO, 300000) and esperar(pg, PANTALLA, 10000) and pg.evaluate(f'{K}.enLinea.red.yo') != autor)
            pg.click('#pantallaCuenta .pc-pestanas button[data-que="entrar"]')
            comprobar(f'{nombre}: «Entrar» no pide repetir la contraseña', not pg.is_visible('#pcClave2'))
            rellenar(pg, USUARIO.lower(), CLAVE + 'mal')
            comprobar(f'{nombre}: contraseña mal, lo dice y no entra', esperar(pg, f"{MOTIVO}.includes('incorrectos')", 15000) and pg.evaluate(PANTALLA), pg.evaluate(MOTIVO))
            pg.wait_for_timeout(500)
            captura(pg, f'{SALIDA}/cuenta-entrar-mal-{nombre}.png')
            rellenar(pg, USUARIO.lower(), CLAVE)   # sin mirar mayúsculas
            # recarga sola y entra con la ficha de la cuenta
            ok = esperar(pg, f"{LISTO} && {K}.enLinea.red.yo === {json.dumps(autor)}", 300000)
            comprobar(f'{nombre}: con la buena, es el personaje de la cuenta', ok, str(pg.evaluate(f'{K} && {K}.enLinea && {K}.enLinea.red.yo')))
            comprobar(f'{nombre}: y sin pantalla', not pg.evaluate(PANTALLA))
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/cuenta-otro-aparato-{nombre}.png')
            # el menú: la cuenta y salir de ella
            pg.goto(MENU, wait_until='domcontentloaded', timeout=60000)
            esperar(pg, 'window.__demo && window.__demo.listo')
            texto = pg.evaluate("document.getElementById('demoCuenta').hidden ? '' : document.getElementById('demoCuentaTexto').textContent")
            comprobar(f'{nombre}: el menú enseña la cuenta', USUARIO in texto, texto)
            captura(pg, f'{SALIDA}/cuenta-menu-{nombre}.png')
            pg.click('#btnDemoSalirCuenta')
            fichas = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('kinhold_ficha:') || k.startsWith('kinhold_cuenta:'))")
            comprobar(f'{nombre}: «Salir de la cuenta» olvida la ficha', not fichas and pg.evaluate("document.getElementById('demoCuenta').hidden"), str(fichas))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: al volver a jugar, pantalla otra vez', esperar(pg, LISTO, 300000) and esperar(pg, PANTALLA, 10000) and pg.evaluate(f'{K}.enLinea.red.yo') != autor)
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err)[:200])
            ctx.close()
        nav.close()
finally:
    servidor.terminate(); web.shutdown()
    if MUTAR: os.remove(SERVIDOR)

print('Fallos:', len(fallos))
sys.exit(1 if fallos else 0)
