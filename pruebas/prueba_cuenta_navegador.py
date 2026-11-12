# Prueba en navegador de la pantalla de entrar y de crear cuenta (P1 «Cuentas», src/mundo/pantalla_cuenta.js).
# Uso: python3 pruebas/prueba_cuenta_navegador.py <html de la demo> <carpeta_capturas>
# Una sola página abierta cada vez (no es de las de dos páginas en línea): la demo con un servidor local. En PC y en móvil:
#   - al entrar por primera vez sale la pantalla de la cuenta (crear), que tapa el juego;
#   - lo que no vale se dice al momento (usuario corto, contraseñas distintas) y no se manda;
#   - el correo (valravnx, 2 nov): sin correo, o con uno que no vale, se dice al momento; al crear la cuenta sale «Confirma
#     tu correo» (tapa el juego) y el servidor no atiende lo que haga; al recargar sin confirmar, otra vez esa pantalla; un
#     código mal lo dice; pedir otro enseguida dice que espere; con el bueno (el que el servidor de pruebas apunta en su
#     salida, sin clave de Resend) se quita la pantalla;
#   - al crear la cuenta el personaje sigue siendo el mismo (mismo autor), y el servidor la guarda
#     con ese autor y sin la contraseña en claro;
#   - al recargar se entra solo, sin pantalla, con el mismo personaje;
#   - desde otro aparato (otro navegador, sin nada guardado): pantalla otra vez, con otro personaje; «Entrar» con la
#     contraseña mal lo dice y no entra; con la buena, recarga y es el personaje de la cuenta, sin pantalla;
#   - en el menú sale la cuenta; recuperar y cambiar (valravnx, 2 nov): «Cambiar la contraseña» con la actual mal lo
#     dice, con la buena cambia y deja una ficha nueva aquí; «Cambiar el correo» manda el código al nuevo y con él
#     cambia; «Salir de la cuenta» olvida la ficha: al volver a «Jugar», pantalla otra vez; ahí «¿Has olvidado la
#     contraseña?» con el usuario manda un código y con él y la contraseña nueva se entra con el personaje de la cuenta.
# MUTAR=1: un servidor que al entrar da la ficha de otro personaje: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, json
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_cuenta'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
SERVIDOR = os.path.join(RAIZ, 'servidor/servidor.mjs')
if MUTAR:
    t = open(SERVIDOR).read(); m = t.replace("ficha: fichaPara(r.autor)", "ficha: fichaPara('jugador:otro')"); assert m != t
    SERVIDOR = os.path.join(RAIZ, 'servidor/.servidor_mutado_cuenta_nav.mjs'); open(SERVIDOR, 'w').write(m)
servidor = subprocess.Popen(['node', SERVIDOR, str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ, env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

BASE = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html'
URL = f'{BASE}?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
MENU = f'{BASE}?servidor=ws://127.0.0.1:{PUERTO}'
# las tres salidas en línea (src/logica/whitholm.js, SALIDAS_INICIO), en metros del mundo, y la común (el 0 de la escena)
SITIOS_SALIDA = {'lindholt': [184596, 46280], 'ciudad': [217589, 52804], 'motdale': [204000, 57000]}
SALIDA_COMUN = SITIOS_SALIDA['lindholt']
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
MOTIVO_C = "document.getElementById('pcMotivoCorreo').textContent"
VERIFICAR = "!!document.getElementById('pcFormCorreo') && !document.getElementById('pcFormCorreo').hidden"
def rellenar(pg, usuario, clave, clave2=None, correo=None):
    pg.fill('#pcUsuario', usuario); pg.fill('#pcClave', clave)
    if correo is not None: pg.fill('#pcCorreo', correo)
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
            CORREO = f'ana.{nombre}@ejemplo.com'
            rellenar(pg, USUARIO, CLAVE, CLAVE, '')
            comprobar(f'{nombre}: sin correo, dicho al momento', 'Falta el correo' in pg.evaluate(MOTIVO), pg.evaluate(MOTIVO))
            rellenar(pg, USUARIO, CLAVE, CLAVE, 'ana@ejemplo')
            comprobar(f'{nombre}: correo que no vale, dicho al momento', 'no es válido' in pg.evaluate(MOTIVO), pg.evaluate(MOTIVO))
            rellenar(pg, USUARIO, CLAVE, CLAVE + 'x', CORREO)
            comprobar(f'{nombre}: contraseñas distintas, dicho al momento', 'no son iguales' in pg.evaluate(MOTIVO), pg.evaluate(MOTIVO))
            captura(pg, f'{SALIDA}/cuenta-motivo-{nombre}.png')
            comprobar(f'{nombre}: lo que no vale no llega al servidor', len([x for x in cuentas_guardadas() if 'usuario' in x]) == (0 if nombre == 'pc' else 1))
            rellenar(pg, USUARIO, CLAVE, CLAVE)
            comprobar(f'{nombre}: al crear la cuenta sale «Confirma tu correo»', esperar(pg, VERIFICAR, 15000), pg.evaluate(f"document.getElementById('pcMotivo') && {MOTIVO}") or '')
            comprobar(f'{nombre}: dice a qué correo (a medias no: el que ha escrito)', CORREO in pg.evaluate("document.getElementById('pcTextoCorreo').textContent"))
            comprobar(f'{nombre}: y sigue tapando el juego', pg.evaluate(PANTALLA) and pg.evaluate(f'{K}.enLinea.sinCorreo') is True)
            caja = pg.evaluate("(() => { const r = document.getElementById('pcFormCorreo').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })()")
            comprobar(f'{nombre}: la caja del correo cabe en la pantalla', caja[0] >= 0 and caja[1] <= vista['width'] and caja[2] >= 0 and caja[3] <= vista['height'], str(caja))
            pg.wait_for_timeout(800)
            captura(pg, f'{SALIDA}/cuenta-correo-{nombre}.png')
            # al recargar sin confirmar: la misma pantalla, ya en el correo
            pg.reload(wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: al recargar sin confirmar, otra vez «Confirma tu correo»', esperar(pg, LISTO, 300000) and esperar(pg, VERIFICAR, 15000) and pg.evaluate(f'{K}.enLinea.red.yo') == autor)
            comprobar(f'{nombre}: (con el correo a medias, que es lo que sabe el servidor)', 'a***@e***.com' in pg.evaluate("document.getElementById('pcTextoCorreo').textContent"))
            pg.fill('#pcCodigo', '12'); pg.click('#pcIrCorreo')
            comprobar(f'{nombre}: código corto, dicho al momento', '6 cifras' in pg.evaluate(MOTIVO_C), pg.evaluate(MOTIVO_C))
            bueno = codigos.de(USUARIO)
            pg.fill('#pcCodigo', '000000' if bueno != '000000' else '000001'); pg.click('#pcIrCorreo')
            comprobar(f'{nombre}: código mal, lo dice', esperar(pg, f"{MOTIVO_C}.includes('no es correcto')", 15000) and pg.evaluate(PANTALLA), pg.evaluate(MOTIVO_C))
            # otro código: si ha pasado el minuto desde el primero, llega; el siguiente, enseguida, tiene que esperar
            pg.click('#pcReenviar')
            esperar(pg, f"{MOTIVO_C}.includes('Espera') || {MOTIVO_C}.includes('mandado')", 15000)
            if 'mandado' in pg.evaluate(MOTIVO_C):
                codigos.de(USUARIO, 1); pg.click('#pcReenviar')
                esperar(pg, f"{MOTIVO_C}.includes('Espera')", 15000)
            comprobar(f'{nombre}: otro código enseguida, que espere', 'Espera' in pg.evaluate(MOTIVO_C), pg.evaluate(MOTIVO_C))
            bueno = codigos.de(USUARIO)
            captura(pg, f'{SALIDA}/cuenta-correo-mal-{nombre}.png')
            comprobar(f'{nombre}: el código llega (al registro del servidor de pruebas)', bool(bueno))
            pg.fill('#pcCodigo', bueno or ''); pg.click('#pcIrCorreo')
            comprobar(f'{nombre}: con el bueno se quita la pantalla', esperar(pg, '!' + PANTALLA, 15000), pg.evaluate(f"document.getElementById('pcMotivoCorreo') && {MOTIVO_C}") or '')
            comprobar(f'{nombre}: y ya entra en el mundo', pg.evaluate(f'{K}.enLinea.sinCorreo') is False)
            comprobar(f'{nombre}: sigue siendo el mismo personaje', pg.evaluate(f'{K}.enLinea.red.yo') == autor)
            comprobar(f'{nombre}: el cliente sabe su cuenta', pg.evaluate(f'{K}.enLinea.cuenta') == USUARIO, str(pg.evaluate(f'{K}.enLinea.cuenta')))
            c = [x for x in cuentas_guardadas() if x.get('usuario') == USUARIO]
            comprobar(f'{nombre}: el servidor la guarda con ese personaje', len(c) == 1 and c[0].get('autor') == autor, str(c[:1])[:120])
            comprobar(f'{nombre}: sin la contraseña en claro', CLAVE not in open(os.path.join(sitio, 'cuentas.jsonl')).read())
            # dónde empieza (valravnx, 5 nov: tres salidas del rey, «lo eligen»): sale al quitarse la pantalla de la cuenta
            PSAL = "!!document.getElementById('panelSalida')"
            comprobar(f'{nombre}: personaje nuevo: sale «¿Dónde empiezas?» con las tres salidas', esperar(pg, PSAL, 15000) and pg.evaluate("document.querySelectorAll('#panelSalida button[data-salida]').length") == 3, '; '.join(err)[:300])
            if not pg.evaluate(PSAL): raise RuntimeError('sin el panel de las salidas no se puede seguir')
            caja = pg.evaluate("(() => { const r = document.querySelector('#panelSalida .ps-caja').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })()")
            comprobar(f'{nombre}: la caja de las salidas cabe en la pantalla', caja[0] >= 0 and caja[1] <= vista['width'] and caja[2] >= 0 and caja[3] <= vista['height'], str(caja))
            pg.wait_for_timeout(800)
            captura(pg, f'{SALIDA}/cuenta-salida-{nombre}.png')
            ELIGE = 'motdale' if nombre == 'pc' else 'ciudad'
            esperada = [SITIOS_SALIDA[ELIGE][0] - SALIDA_COMUN[0], SITIOS_SALIDA[ELIGE][1] - SALIDA_COMUN[1]]
            pg.click(f'#panelSalida button[data-salida="{ELIGE}"]')
            comprobar(f'{nombre}: elige {ELIGE}: se quita el panel y aparece allí', esperar(pg, f"!{PSAL} && Math.hypot({K}.pj.x - {esperada[0]}, {K}.pj.z - {esperada[1]}) < 2", 20000), str(pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")))
            pos = json.load(open(os.path.join(sitio, 'posiciones.json'))).get(autor) if os.path.exists(os.path.join(sitio, 'posiciones.json')) else None
            comprobar(f'{nombre}: el servidor lo apunta como su sitio', bool(pos) and abs(pos['x'] - esperada[0]) < 1e-6 and abs(pos['z'] - esperada[1]) < 1e-6, str(pos))
            pg.wait_for_timeout(6000)   # que llegue el terreno de allí
            captura(pg, f'{SALIDA}/cuenta-salida-{ELIGE}-{nombre}.png')
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/cuenta-creada-{nombre}.png')
            # al recargar: se entra solo
            pg.reload(wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: al recargar entra solo', esperar(pg, LISTO, 300000) and pg.evaluate(f'{K}.enLinea.red.yo') == autor and not pg.evaluate(PANTALLA))
            pg.wait_for_timeout(1500)
            comprobar(f'{nombre}: y no vuelve a preguntar dónde empieza: sale donde eligió', not pg.evaluate(PSAL) and abs(pg.evaluate(f'{K}.pj.x') - esperada[0]) < 30 and abs(pg.evaluate(f'{K}.pj.z') - esperada[1]) < 30, str(pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")))
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
            CAMBIO = "document.getElementById('demoCambioMotivo').textContent"
            AVISO = "document.getElementById('demoCuentaAviso').textContent"
            FICHA = "Object.keys(localStorage).filter(k => k.startsWith('kinhold_ficha:')).map(k => localStorage.getItem(k)).join()"
            ficha0 = pg.evaluate(FICHA)
            pg.click('#btnDemoCambiarClave')
            comprobar(f'{nombre}: «Cambiar la contraseña» abre su caja', pg.is_visible('#demoActual') and pg.is_visible('#demoNueva2') and not pg.is_visible('#demoCorreoNuevo'))
            caja = pg.evaluate("(() => { const r = document.getElementById('demoMenu').querySelector('.caja').getBoundingClientRect(); return [r.left, r.right]; })()")
            comprobar(f'{nombre}: el menú cabe a lo ancho', caja[0] >= 0 and caja[1] <= vista['width'], str(caja))
            CLAVE2, CLAVE3 = 'leña-seca-del-hogar-3', 'zarzo-con-barro-del-rio-5'
            pg.fill('#demoActual', CLAVE + 'mal'); pg.fill('#demoNueva', CLAVE2); pg.fill('#demoNueva2', CLAVE2); pg.click('#btnDemoCambio')
            comprobar(f'{nombre}: con la actual mal, lo dice', esperar(pg, f"{CAMBIO}.includes('actual')", 20000), pg.evaluate(CAMBIO))
            captura(pg, f'{SALIDA}/cuenta-cambiar-clave-{nombre}.png')
            pg.fill('#demoActual', CLAVE); pg.click('#btnDemoCambio')
            comprobar(f'{nombre}: con la buena, cambia', esperar(pg, f"{AVISO}.includes('Contraseña cambiada')", 20000), pg.evaluate(CAMBIO))
            comprobar(f'{nombre}: y aquí queda una ficha nueva', pg.evaluate(FICHA) not in ('', ficha0))
            pg.click('#btnDemoCambiarCorreo')
            CORREO2 = f'ana.nueva.{nombre}@ejemplo.com'
            antes = len(codigos.todos(USUARIO))
            pg.fill('#demoActual', CLAVE2); pg.fill('#demoCorreoNuevo', CORREO2); pg.click('#btnDemoCambio')
            comprobar(f'{nombre}: «Cambiar el correo» manda el código al nuevo', esperar(pg, f"{CAMBIO}.includes('a***@e***.com')", 20000) and pg.is_visible('#demoCodigo'), pg.evaluate(CAMBIO))
            captura(pg, f'{SALIDA}/cuenta-cambiar-correo-{nombre}.png')
            pg.fill('#demoCodigo', codigos.de(USUARIO, antes) or ''); pg.click('#btnDemoCambio')
            comprobar(f'{nombre}: con el código, el correo cambia', esperar(pg, f"{AVISO}.includes('Correo cambiado')", 20000), pg.evaluate(CAMBIO))
            c = [x for x in cuentas_guardadas() if x.get('verificado') == USUARIO]
            comprobar(f'{nombre}: el servidor guarda el correo nuevo', bool(c) and c[-1].get('correo') == CORREO2, str(c[-1:]))
            pg.click('#btnDemoSalirCuenta')
            fichas = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('kinhold_ficha:') || k.startsWith('kinhold_cuenta:'))")
            comprobar(f'{nombre}: «Salir de la cuenta» olvida la ficha', not fichas and pg.evaluate("document.getElementById('demoCuenta').hidden"), str(fichas))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: al volver a jugar, pantalla otra vez', esperar(pg, LISTO, 300000) and esperar(pg, PANTALLA, 10000) and pg.evaluate(f'{K}.enLinea.red.yo') != autor)
            # ¿has olvidado la contraseña?
            MOTIVO_R = "document.getElementById('pcMotivoR').textContent"
            pg.click('#pantallaCuenta .pc-pestanas button[data-que="entrar"]')
            pg.click('#pcOlvido')
            comprobar(f'{nombre}: «¿Has olvidado la contraseña?» abre recuperar', pg.is_visible('#pcQuien') and not pg.is_visible('#pcClaveN'))
            caja = pg.evaluate("(() => { const r = document.getElementById('pcFormRecuperar').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })()")
            comprobar(f'{nombre}: la caja de recuperar cabe en la pantalla', caja[0] >= 0 and caja[1] <= vista['width'] and caja[2] >= 0 and caja[3] <= vista['height'], str(caja))
            captura(pg, f'{SALIDA}/cuenta-recuperar-{nombre}.png')
            pg.fill('#pcQuien', USUARIO); pg.click('#pcIrR')
            comprobar(f'{nombre}: pide el código y la contraseña nueva', esperar(pg, "!document.getElementById('pcPaso2').hidden", 20000) and pg.is_visible('#pcClaveN2'), pg.evaluate(MOTIVO_R))
            cod = codigos.recuperar(USUARIO)
            comprobar(f'{nombre}: llega el código para recuperar', bool(cod))
            pg.fill('#pcCodigoR', '000000' if cod != '000000' else '000001'); pg.fill('#pcClaveN', CLAVE3); pg.fill('#pcClaveN2', CLAVE3); pg.click('#pcIrR')
            comprobar(f'{nombre}: con el código mal, lo dice', esperar(pg, f"{MOTIVO_R}.includes('no es correcto')", 20000), pg.evaluate(MOTIVO_R))
            pg.wait_for_timeout(300)
            captura(pg, f'{SALIDA}/cuenta-recuperar-codigo-{nombre}.png')
            pg.fill('#pcCodigoR', cod or ''); pg.click('#pcIrR')
            ok = esperar(pg, f"{LISTO} && {K}.enLinea.red.yo === {json.dumps(autor)}", 300000)
            comprobar(f'{nombre}: con el bueno, entra con el personaje de la cuenta', ok and not pg.evaluate(PANTALLA), str(pg.evaluate(f'{K} && {K}.enLinea && {K}.enLinea.red.yo')))
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err)[:200])
            ctx.close()
        nav.close()
finally:
    servidor.terminate(); web.shutdown()
    if MUTAR: os.remove(SERVIDOR)

print('Fallos:', len(fallos))
sys.exit(1 if fallos else 0)
