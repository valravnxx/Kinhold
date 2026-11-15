# Prueba en navegador (Chromium sin pantalla) de construir con el acabado nuevo (estudio de la interfaz del 7 nov, tarea
# «Construir» de «La interfaz nueva»), sin servidor y en un llano, en PC (1280×800) y móvil (390×844):
#   - sin mojón, construir se abre en la pestaña Tierra con el mojón elegido;
#   - arriba, «Poner | Quitar», la planta, Deshacer y Terminar, en una barra que no se sale de la pantalla; X pasa de
#     poner a quitar y vuelve; en el móvil, por encima de nada de lo de abajo;
#   - cada pieza con su imagen (cargada de verdad) y el coste en iconos; lo que no tienes, en rojo;
#   - deshacer lo último: el marco puesto se quita, y otra vez ya no hay nada que deshacer;
#   - la empalizada (P11c), a la vista en «Exterior» con su imagen y sus 6 troncos, y de cerca, levantada.
#   - el muro de entramado (P11c), liso, con puerta y con ventana, a la vista en «Muro» y levantado en una casilla, de cerca.
# Rota a propósito con MUTAR=1 (el botón de deshacer no hace nada), MUTAR=2 (sin la empalizada en el menú), MUTAR=3 (sin su portón)
# o MUTAR=4 (sin el muro de entramado con ventana): falla.
# Uso: python3 pruebas/prueba_construir_menu_navegador.py <html> <carpeta_capturas>
import sys, os, re, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_construir_menu'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
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
        for paso in range(1, 7):   # (las de fuera se cargan al deslizar: poco a poco, que cada una pase por la vista)
            ev(f"(() => {{ const e = document.getElementById('piezas'); e.scrollLeft = e.scrollWidth * {paso} / 6; }})()"); pg.wait_for_timeout(700)
        ev("document.getElementById('piezas').scrollLeft = 0"); pg.wait_for_timeout(800)
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
        # la empalizada (P11c): ya no se esconde; en «Exterior», con su imagen y sus 6 troncos (delgados); se levanta
        # clavada en el suelo, con las puntas afiladas. MUTAR=2: escondida otra vez (tiene que fallar)
        pg.click('#pestanas button[data-cat="exterior"]'); pg.wait_for_timeout(2000)
        ext = ev("[...document.querySelectorAll('#piezas button.pieza')].map(b => { const i = b.querySelector('img.pz-img'); return [b.querySelector('b').textContent, !!i && i.complete && i.naturalWidth > 0, [...b.querySelectorAll('.cc')].map(c => c.title).join(' ')]; })")
        emp = [e for e in ext if e[0] == 'Empalizada']
        if os.environ.get('MUTAR') == '2': emp = []
        comprobar('en «Exterior», la empalizada a la vista, con su imagen cargada', bool(emp) and emp[0][1], str([e[0] for e in ext]))
        comprobar('y cuesta 6 troncos', bool(emp) and emp[0][2].startswith('6 tronco'), emp[0][2] if emp else '')
        # el portón sin hierro (P11c): a la vista, 4 troncos y 2 cuerdas, sin hierro. MUTAR=3: escondido otra vez (tiene que fallar)
        por = [e for e in ext if e[0] == 'Puerta de empalizada']
        if os.environ.get('MUTAR') == '3': por = []
        comprobar('el portón de empalizada (sin hierro) a la vista, con su imagen cargada', bool(por) and por[0][1], str([e[0] for e in ext]))
        comprobar('y cuesta 4 troncos y 2 cuerdas, sin hierro', bool(por) and por[0][2].startswith('4 tronco') and '2 cuerda' in por[0][2] and 'hierro' not in por[0][2], por[0][2] if por else '')
        antes = ev(f"{K}.mundo.construcciones.reduce((a, c) => a + c.piezas.size, 0)")
        for x in [3, 5, 7]:
            ev(f"{K}.seleccionar('pieza','empalizada'); {K}.apuntar({x},2); {K}.colocar()")
        ev(f"{K}.seleccionar('pieza','empalizada_puerta'); {K}.apuntar(1,2); {K}.colocar()")
        ev(f"{K}.seleccionar('pieza','cerca'); {K}.apuntar(9,2); {K}.colocar(); {K}.terminarObras()")   # (sin servidor, las obras se terminan al momento)
        n3 = ev(f"{K}.mundo.construcciones.reduce((a, c) => a + c.piezas.size, 0)")
        comprobar('tres tramos de empalizada, su portón y una cerca puestos', n3 == antes + 5, f'piezas={n3 - antes}')
        hechas = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'empalizada' && !p.obra).length")
        comprobar('y la empalizada, levantada', hechas == 3, f'tramos={hechas}')
        ev(f"{K}.cambiarModo('mover')"); pg.wait_for_timeout(800)
        for i, (px, pz, giro, pitch, dist) in enumerate([(8.5, 3.6, 0.5, 0.28, 8), (4, 3.4, -0.4, 0.12, 5), (2.6, 3.0, -0.2, 0.05, 2.6)]):
            ev(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: {px}, z: {pz}, rot: 0 }}); k.cam.yaw = {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_6_empalizada_{i + 1}.png'.replace('ó', 'o'))
        # el portón: cerrado, de cerca por delante y por detrás (las traviesas, la tornapunta y las gazas de los goznes);
        # luego se abre con Usar (por la acción, con su autor) y se vuelve a cerrar
        pt = ev(f"(() => {{ for (const c of {K}.mundo.construcciones) for (const [k, p] of c.piezas) if (p.tipo === 'empalizada_puerta') return {{ c: c.id, k, obra: !!p.obra }}; return null; }})()")
        comprobar('el portón, levantado', bool(pt) and not pt['obra'], str(pt))
        vistas = [(1.2, 4.2, 0.15, 0.1, 4.2), (0.2, 3.2, -0.6, 0.12, 2.4), (1.0, -0.6, 3.14, 0.12, 4.2)]
        for i, (px, pz, giro, pitch, dist) in enumerate(vistas):
            ev(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: {px}, z: {pz}, rot: 0 }}); k.cam.yaw = {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_7_porton_{i + 1}.png'.replace('ó', 'o'))
        if pt:
            # como el jugador: a su lado (donde la acción a la vista es abrir el portón), Usar, con su autor; solo se rehace esa hoja
            abierta = f"{K}.mundo.construcciones.find(c => c.id === {pt['c']!r}).piezas.get({pt['k']!r}).abierta === true"
            sitio, vista = None, None
            for zz in [2.9, 1.1, 3.4, 0.6]:
                for xx in [1.0, 0.0, 2.0, -1.0, 3.0]:
                    ev(f"Object.assign({K}.pj, {{ x: {xx}, z: {zz} }})"); pg.wait_for_timeout(500)
                    vista = ev(f"{K}.accionVista && {K}.accionVista.texto")
                    if vista and 'empalizada' in vista: sitio = (xx, zz); break
                if sitio: break
            comprobar('a su lado, la acción a la vista es abrir el portón', bool(sitio), str(vista))
            if sitio: ev(f"Object.assign({K}.pj, {{ x: {sitio[0]}, z: {sitio[1]} }})"); pg.wait_for_timeout(300)
            ev(f"{K}.usar()"); pg.wait_for_timeout(500)
            comprobar('el portón se abre con Usar', ev(abierta), str(vista))
            ev(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: 3.4, z: 5.2, rot: 0 }}); k.cam.yaw = 0.5; k.cam.pitch = 0.2; k.cam.dist = 5.5; }})()")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_7_porton_abierto.png'.replace('ó', 'o'))
            if sitio: ev(f"Object.assign({K}.pj, {{ x: {sitio[0]}, z: {sitio[1]} }})"); pg.wait_for_timeout(600)
            ev(f"{K}.usar()"); pg.wait_for_timeout(500)
            comprobar('y se vuelve a cerrar', bool(sitio) and not ev(abierta))
        # el muro de entramado (P11c): liso, con puerta y con ventana, en «Muro» con su imagen y su coste (troncos, varas y
        # barro, nada de hierro ni tablas); en una casilla con cimiento de piedra, de cerca. MUTAR=4: sin el de ventana (tiene que fallar)
        ev(f"{K}.cambiarModo('construir')"); pg.wait_for_timeout(800)
        pg.click('#pestanas button[data-cat="muro"]'); pg.wait_for_timeout(1500)
        ev("document.getElementById('piezas').scrollLeft = 1e5"); pg.wait_for_timeout(1500)
        mur = ev("[...document.querySelectorAll('#piezas button.pieza')].map(b => { const i = b.querySelector('img.pz-img'); return [b.querySelector('b').textContent, !!i && i.complete && i.naturalWidth > 0, [...b.querySelectorAll('.cc')].map(c => c.title).join(' ')]; })")
        ent = {e[0]: e for e in mur if e[0].startswith('Muro de entramado')}
        if os.environ.get('MUTAR') == '4': ent.pop('Muro de entramado con ventana', None)
        for n in ['Muro de entramado', 'Muro de entramado con puerta', 'Muro de entramado con ventana']:
            e = ent.get(n)
            comprobar(f'en «Muro», {n.lower()} a la vista, con su imagen cargada', bool(e) and e[1], str([m[0] for m in mur]))
            comprobar(f'  y su coste: troncos, varas y barro, sin hierro ni tablas', bool(e) and 'tronco' in e[2] and 'vara' in e[2] and 'barro' in e[2] and 'hierro' not in e[2] and 'tabla' not in e[2], e[2] if e else '')
        ev("document.getElementById('piezas').scrollLeft = 0")
        ev(f"(() => {{ const m = {K}.mundo.materiales; for (const k of ['tronco', 'vara', 'barro', 'piedra']) m[k] = Math.max(m[k] || 0, 200); }})()")
        antes = ev(f"{K}.mundo.construcciones.reduce((a, c) => a + c.piezas.size, 0)")
        ev(f"{K}.seleccionar('pieza','cim_piedra'); {K}.apuntar(-5,-1); {K}.colocar(); {K}.terminarObras()")   # (los muros, sobre el cimiento ya hecho)
        for t, x, z in [('muro_entramado_puerta', -5, 0), ('muro_entramado_ventana', -4, -1), ('muro_entramado', -6, -1), ('muro_entramado', -5, -2)]:
            ev(f"{K}.seleccionar('pieza','{t}'); {K}.apuntar({x},{z}); {K}.colocar()")
        ev(f"{K}.terminarObras()")
        tipos = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo.startsWith('muro_entramado') && !p.obra).map(p => p.tipo).sort()")
        comprobar('los cuatro muros de entramado (liso, con puerta y con ventana), levantados', tipos == ['muro_entramado', 'muro_entramado', 'muro_entramado_puerta', 'muro_entramado_ventana'], str(tipos))
        ev(f"{K}.cambiarModo('mover')"); pg.wait_for_timeout(800)
        vistas = [(-3.3, 2.6, -0.35, 0.14, 5.0), (-2.2, 0.6, 0.95, 0.15, 5.2), (-3.9, 1.3, -0.55, 0.06, 2.8), (-7.6, -4.2, 3.7, 0.15, 5.0)]
        for i, (px, pz, giro, pitch, dist) in enumerate(vistas):
            ev(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: {px}, z: {pz}, rot: 0 }}); k.cam.yaw = {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_8_entramado_{i + 1}.png'.replace('ó', 'o'))
        ev(f"{K}.cambiarModo('construir')"); pg.wait_for_timeout(800)
        pg.click('#pestanas button[data-cat="almacenajes"]'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_5_almacenajes.png'.replace('ó', 'o'))
        comprobar('sin errores en la página', not errores, '; '.join(errores[:3]))
        pg.close()
    nav.close()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + '; '.join(fallos))
sys.exit(1 if fallos else 0)
