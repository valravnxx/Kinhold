# Prueba en navegador (Chromium sin pantalla) de construir con el acabado nuevo (estudio de la interfaz del 7 nov, tarea
# «Construir» de «La interfaz nueva»), sin servidor y en un llano, en PC (1280×800) y móvil (390×844):
#   - sin mojón, construir se abre en la pestaña Tierra con el mojón elegido;
#   - arriba, «Poner | Quitar», la planta, Deshacer y Terminar, en una barra que no se sale de la pantalla; X pasa de
#     poner a quitar y vuelve; en el móvil, por encima de nada de lo de abajo;
#   - cada pieza con su imagen (cargada de verdad) y el coste en iconos; lo que no tienes, en rojo;
#   - deshacer lo último: el marco puesto se quita, y otra vez ya no hay nada que deshacer.
# Rota a propósito con MUTAR=1 (el botón de deshacer no hace nada): falla.
# Uso: python3 pruebas/prueba_construir_menu_navegador.py <html> <carpeta_capturas>
import sys, os, re, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_construir_menu'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['meshy-v2', 'taller-v24', 'taller-carga-v3', 'taller-dormir-v1', 'taller-sentarse-v1']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
for c in ['naturaleza', 'estaciones-meshy-v1']: shutil.copytree(os.path.join(RAIZ, f'docs/recursos/{c}'), f'{sitio}/recursos/{c}')
for c in re.findall(r"CARPETA_(?:ICONOS|INTERFAZ|FUENTES|PIEZAS) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{c}'): shutil.copytree(os.path.join(RAIZ, 'docs', c), f'{sitio}/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, opts in [('PC', dict(viewport={'width': 1280, 'height': 800})),
                         ('móvil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        print(nombre)
        pg = nav.new_page(locale='es-ES', **opts); errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text + ' ' + str(m.location.get('url'))) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_function(f'{K} !== undefined', timeout=60000)
        pg.evaluate(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(2000)
        ev = pg.evaluate
        if os.environ.get('MUTAR') == '1': ev("document.getElementById('btnDeshacer').onclick = null")
        ev(f"{K}.cambiarModo('mover'); {K}.cambiarModo('construir')"); pg.wait_for_timeout(1500)
        comprobar('sin mojón, construir se abre en la pestaña Tierra con el mojón', ev("document.querySelector('#pestanas button.sel').dataset.cat") == 'tierra' and ev(f"{K}.estado.sel.clase") == 'mojon')
        pg.screenshot(path=f'{SALIDA}/{nombre}_1_sin_mojon.png'.replace('ó', 'o'))
        caja = ev("(() => { const r = document.getElementById('modos').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
        vis = ev("['construir','desmontar','mover'].map(m => !!document.querySelector(`#modos [data-modo=${m}]`).offsetParent).concat([!!document.getElementById('controlPlanta').offsetParent, !!document.getElementById('btnDeshacer').offsetParent])")
        comprobar('arriba: Poner, Quitar, Terminar, la planta y Deshacer', all(vis), str(vis))
        W, H = opts['viewport']['width'], opts['viewport']['height']
        comprobar('la barra de arriba cabe en la pantalla, en la mitad de arriba', caja[0] >= 0 and caja[2] <= W and caja[1] >= 0 and caja[3] < H / 2, str(caja))
        barra = ev("document.getElementById('barra').getBoundingClientRect().top")
        tapados = ev(f"['joystick','btnGirar','btnColocar'].map(id => document.getElementById(id)).filter(e => e && e.offsetParent).filter(e => e.getBoundingClientRect().bottom > {barra} + 1).map(e => e.id)")
        comprobar('nada de lo de abajo queda tapado por la barra de las piezas', not tapados, str(tapados))
        # el mojón y una pieza
        ev(f"{K}.llevarPara('mojon','mojon'); {K}.seleccionar('mojon','mojon'); {K}.apuntar(-3,-6); {K}.colocar()")
        comprobar('mojón puesto', bool(ev(f"{K}.mundo.mojonDe({K}.yo)")) or bool(ev(f"{K}.mundo.mojones && {K}.mundo.mojones.length")))
        pg.click('#pestanas button[data-cat="muro"]'); pg.wait_for_timeout(1500)
        ev("document.getElementById('piezas').scrollLeft = 1e5"); pg.wait_for_timeout(1500)   # (las de fuera se cargan al deslizar)
        ev("document.getElementById('piezas').scrollLeft = 0")
        imgs = ev("[...document.querySelectorAll('#piezas button.pieza')].map(b => { const i = b.querySelector('img.pz-img'); return [b.querySelector('b').textContent, !!i && i.complete && i.naturalWidth > 0, b.querySelectorAll('.cc img').length]; })")
        comprobar('cada muro con su imagen cargada', imgs and all(i[1] for i in imgs), str([i for i in imgs if not i[1]][:3]))
        comprobar('y su coste en iconos', imgs and all(i[2] >= 1 for i in imgs))
        ev(f"{K}.mundo.materiales.vara = 0"); pg.wait_for_timeout(2500)
        rojo = ev("[...document.querySelectorAll('#piezas button.pieza')].filter(b => b.querySelector('b').textContent.startsWith('Muro de zarzo')).map(b => !!b.querySelector('.cc.falta'))")
        comprobar('sin varas, los muros de zarzo marcan en rojo lo que falta', rojo and all(rojo), str(rojo))
        ev(f"{K}.mundo.materiales.vara = 120")
        # poner un marco y deshacerlo
        ev(f"{K}.seleccionar('pieza','cim_piedra'); {K}.apuntar(1,1); {K}.colocar()")
        n1 = ev(f"{K}.mundo.construcciones.reduce((a, c) => a + c.piezas.size, 0)")
        comprobar('marco puesto y Deshacer encendido', n1 == 1 and not ev("document.getElementById('btnDeshacer').disabled"), f'piezas={n1}')
        ev(f"{K}.seleccionar('pieza','muro_zarzo'); {K}.apuntar(3,2)"); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_2_poner.png'.replace('ó', 'o'))
        pg.click('#btnDeshacer'); pg.wait_for_timeout(600)
        n2 = ev(f"{K}.mundo.construcciones.reduce((a, c) => a + c.piezas.size, 0)")
        comprobar('Deshacer quita el marco puesto', n2 == 0, f'piezas={n2}')
        av = ev("(() => { const a = document.getElementById('aviso'); return a.hidden ? '' : a.textContent; })()")
        comprobar('y lo dice («Deshecho: …»)', av.startswith('Deshecho'), av)
        comprobar('y luego ya no hay nada que deshacer', ev("document.getElementById('btnDeshacer').disabled"))
        pg.screenshot(path=f'{SALIDA}/{nombre}_3_deshecho.png'.replace('ó', 'o'))
        if nombre == 'PC':
            pg.keyboard.press('x'); pg.wait_for_timeout(500)
            comprobar('X: de poner a quitar', ev(f"{K}.estado.modo") == 'desmontar' and ev("document.querySelector('#modos [data-modo=desmontar]').classList.contains('sel')"))
            pg.screenshot(path=f'{SALIDA}/{nombre}_4_quitar.png')
            comprobar('quitando, sin los huecos de las manos de abajo', not ev("!!document.getElementById('llevas').offsetParent"))
            pg.keyboard.press('x'); pg.wait_for_timeout(300)
            comprobar('X otra vez: vuelve a poner', ev(f"{K}.estado.modo") == 'construir')
        else:
            pg.click('#modos [data-modo=desmontar]'); pg.wait_for_timeout(500)
            comprobar('Quitar: a quitar', ev(f"{K}.estado.modo") == 'desmontar')
            pg.screenshot(path=f'{SALIDA}/movil_4_quitar.png')
            comprobar('quitando, sin los huecos de las manos de abajo', not ev("!!document.getElementById('llevas').offsetParent"))
            pg.click('#modos [data-modo=construir]'); pg.wait_for_timeout(300)
            comprobar('Poner: vuelve a poner', ev(f"{K}.estado.modo") == 'construir')
        pg.click('#pestanas button[data-cat="almacenajes"]'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_5_almacenajes.png'.replace('ó', 'o'))
        comprobar('sin errores en la página', not errores, '; '.join(errores[:3]))
        pg.close()
    nav.close()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + '; '.join(fallos))
sys.exit(1 if fallos else 0)
