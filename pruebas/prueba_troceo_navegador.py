# Prueba en navegador (Chromium sin pantalla): tronzar y partir en la construcción (hito de equipo).
# Con un hacha en la mano, Usar junto a un tronco largo tumbado lo tronza a golpes y deja 3 o 4 troncos cortos; junto a
# un tronco corto, lo parte en 6 de leña. El tronco corto se coge con las dos manos y pasa al hombro y vuelve con los
# botones de abajo. Lo que va a medias se guarda al recargar. Capturas de cerca en PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_troceo_navegador.py dist/kinhold_demo.html <carpeta>
# La rodaja (P11c): del tronco largo, «Cortar una rodaja» en el menú; deja 1 rodaja y 2 o 3 troncos cortos; la rodaja
# se coge con las dos manos, y en el banco de tronco, con 2 varas y 1 tronco corto, es la carretilla.
# MUTAR=1: los golpes no terminan nunca (el tronco no se trocea): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

K = 'window.__kinhold'

def abrir(nav, w, h, movil=False, limpiar=True, pg=None):
    if pg is None:
        pg = nav.new_page(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
        pg.errores = []
        pg.on('pageerror', lambda e: pg.errores.append(str(e)))
        pg.on('console', lambda m: pg.errores.append(m.text) if m.type == 'error' else None)
        pg.goto(URL)
    else:
        pg.reload()
    pg.wait_for_function('window.__kinhold !== undefined', timeout=30000)
    if limpiar: pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    if MUTAR: pg.evaluate(f"{K}.troceo.golpe = () => ({{ ok: true, termina: false, golpes: 1, faltan: 1, accion: 'tronzar' }})")
    pg.wait_for_timeout(800)
    return pg

# un tronco en el suelo a 1,6 m del jugador (girado «giro»), con la cámara de lado; devuelve su id
def tronco(pg, tipo, n=1, giro=1.57, dx=1.6):
    return pg.evaluate(f"""(() => {{ const k = {K}; k.pj.k = 0;
      const o = k.sueloObjetos.suelo.dejar({{ tipo: '{tipo}', n: {n} }}, k.pj.x + {dx}, k.pj.z, Date.now(), 'jugador:local', false, {giro});
      k.sueloObjetos.guardar(); k.sueloObjetos.refrescar(); return o.id; }})()""")

def camara(pg, dist=5.5, pitch=0.42, giro=0.9):
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = -Math.PI / 2 + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; k.pj.rot = Math.PI / 2; }})()")

def en_mano(pg, tipo, lugar='mano:der'):
    return pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{tipo}', cantidad: 1, a: '{lugar}' }}); {K}.pintarLlevas(); {K}.vestir(); return r.ok; }})()")

def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")

def foto(pg, nombre):
    pg.wait_for_timeout(300); pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')

# golpes seguidos sin esperar el gesto (se olvida el último golpe para que la lógica no los frene)
def golpes(pg, id, n, modo=None):
    m = f"'{modo}'" if modo else 'null'
    return pg.evaluate(f"""(() => {{ const k = {K}; let r;
      for (let i = 0; i < {n}; i++) {{ k.troceo.ultimoGolpe = {{}}; r = k.golpeTroceo('{id}', {m}); if (!r.ok || r.termina) break; }}
      return {{ ok: r.ok, termina: !!r.termina, faltan: r.faltan, motivo: r.motivo || '', da: r.da || null, resto: r.resto || null }}; }})()""")

# la rodaja (P11c): del tronco largo, con el menú; devuelve el resultado del último golpe
def rodaja(pg, prefijo):
    largo = tronco(pg, 'tronco_largo')
    ops = pg.evaluate(f"{K}.opcionesUsar()")
    comprobar(f'{prefijo}el menú ofrece «Cortar una rodaja» junto al tronco largo', any('rodaja' in o for o in ops), str(ops))
    r = golpes(pg, largo, 60, 'rodaja')
    cortos = en_suelo(pg, 'tronco_corto')
    comprobar(f'{prefijo}cortada: 1 rodaja y 2 o 3 troncos cortos, y el largo ya no está', r['termina'] and en_suelo(pg, 'rodaja') == 1 and 2 <= cortos <= 3 and en_suelo(pg, 'tronco_largo') == 0, f'{r} {cortos}')
    comprobar(f'{prefijo}el aviso lo dice', 'rodaja' in aviso(pg), aviso(pg))
    comprobar(f'{prefijo}se ve la rodaja en el suelo', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_rodaja')"))
    return r

def en_suelo(pg, tipo):
    return pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === '{tipo}').reduce((s, o) => s + o.cosa.n, 0)")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: tronzar un tronco largo')
    pg = abrir(nav, 1280, 800)
    largo = tronco(pg, 'tronco_largo')
    camara(pg)
    pg.evaluate(f"{K}.usar()")
    comprobar('sin hacha no se tronza', not pg.evaluate(f"!!{K}.estado.talando"), aviso(pg))
    comprobar('con el hacha de hierro en la mano', en_mano(pg, 'hacha_hierro'))
    pg.evaluate(f"{K}.usar()")
    comprobar('Usar junto al tronco largo empieza a tronzarlo', pg.evaluate(f"{K}.estado.talando?.troceo") == largo and 'Tronzas' in aviso(pg), aviso(pg))
    pg.wait_for_function(f"{K}.troceo.progreso('{largo}') > 0", timeout=60000)
    comprobar('cada golpe dice cuántos faltan', 'faltan' in aviso(pg), aviso(pg))
    comprobar('el golpe va al registro con su autor', pg.evaluate(f"{K}.registroAcciones.entradas.some(e => e.tipo === 'trocear' && e.autor === 'jugador:local' && e.ok)"))
    foto(pg, 'troceo_01_tronzando')
    pg.evaluate(f"{K}.estado.talando = null")
    r = golpes(pg, largo, 30)
    comprobar('con los golpes que pide, queda tronzado', r['ok'] and r['termina'], str(r))
    cortos = en_suelo(pg, 'tronco_corto')
    comprobar('el tronco largo ya no está y hay 3 o 4 troncos cortos', en_suelo(pg, 'tronco_largo') == 0 and 3 <= cortos <= 4, f'{cortos}')
    comprobar('se ven los troncos cortos y no el largo', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_tronco_corto') && !{K}.escena.getObjectByName('suelo_tronco_largo')"))
    comprobar('el aviso dice cuántos', 'Tronzado' in aviso(pg), aviso(pg))
    camara(pg, dist=4.2, pitch=0.5)
    foto(pg, 'troceo_02_tronzado')

    print('PC: partir un tronco corto')
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'tronco_corto'); k.pj.x = o.x - 1.2; k.pj.z = o.z; }})()")
    pg.evaluate(f"{K}.usar()")
    corto = pg.evaluate(f"{K}.estado.talando?.troceo")
    comprobar('Usar junto a los troncos cortos empieza a partir', corto is not None and 'Partes' in aviso(pg), aviso(pg))
    pg.evaluate(f"{K}.estado.talando = null")
    r = golpes(pg, corto, 10)
    comprobar('partido: 6 de leña en el suelo y un tronco corto menos', r['termina'] and en_suelo(pg, 'lena') == 6 and en_suelo(pg, 'tronco_corto') == cortos - 1, f"{r} {en_suelo(pg, 'lena')}")
    comprobar('se ve la leña', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_lena')"))
    camara(pg, dist=3.4, pitch=0.55, giro=0.6)
    foto(pg, 'troceo_03_lena')

    print('PC: el tronco corto, con las dos manos o al hombro')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'tronco_corto'); k.cogerDelSuelo(o); }})()")
    comprobar('el tronco corto se coge con las dos manos', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'tronco_corto')
    comprobar('abajo sale «Al hombro»', pg.locator('#llevas [data-alhombro]').count() == 1)
    foto(pg, 'troceo_04_en_las_manos')
    pg.locator('#llevas [data-alhombro]').click()
    comprobar('«Al hombro» lo pasa al hombro y deja las manos libres', pg.evaluate(f"{K}.inventario.lugares.hombro?.tipo") == 'tronco_corto' and not pg.evaluate(f"{K}.inventario.lugares['mano:der']"))
    comprobar('y sale «A las manos»', pg.locator('#llevas [data-amanos]').count() == 1)
    foto(pg, 'troceo_05_al_hombro')
    pg.locator('#llevas [data-amanos]').click()
    comprobar('«A las manos» lo devuelve', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'tronco_corto' and not pg.evaluate(f"{K}.inventario.lugares.hombro"))

    print('PC: la rodaja de tronco y la carretilla (P11c)')
    pg.evaluate(f"(() => {{ const k = {K}; k.sueloObjetos.suelo.objetos = []; k.sueloObjetos.refrescar(); }})()")
    en_mano(pg, 'hacha_hierro')
    rodaja(pg, '')
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'rodaja'); k.pj.x = o.x - 1.1; k.pj.z = o.z + 0.4; }})()")
    camara(pg, dist=3.2, pitch=0.5, giro=0.7)
    foto(pg, 'troceo_08_rodaja')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'rodaja'); k.cogerDelSuelo(o); }})()")
    comprobar('la rodaja se coge con las dos manos', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'rodaja' and pg.evaluate(f"!!{K}.escena.getObjectByName('llevado_manos')"))
    pg.wait_for_timeout(600)
    camara(pg, dist=2.6, pitch=0.25, giro=1.2)
    foto(pg, 'troceo_09_rodaja_en_las_manos')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    # el banco de tronco con lo de la carretilla depositado, y una carretilla hecha al lado (solo para mirarlos)
    pg.evaluate(f"""(() => {{ const k = {K}, f = k.fabCliente;
      f.estaciones['banco_tronco:vista'] = {{ id: 'banco_tronco:vista', tipo: 'banco_tronco', x: k.pj.x + 1.6, z: k.pj.z - 1.2, autor: 'vista', cola: [], deposito: {{ rodaja: 1, vara: 2, tronco_corto: 1 }} }};
      k.estacionesV.refrescar();
      k.sueloObjetos.suelo.dejar({{ tipo: 'carretilla', n: 1 }}, k.pj.x + 2.9, k.pj.z + 0.4, Date.now(), 'jugador:local', true, 2.2); k.sueloObjetos.refrescar(); }})()""")
    comprobar('el banco con la rodaja depositada y la carretilla se dibujan', pg.evaluate(f"!!{K}.escena.getObjectByName('estacion_banco_tronco') && !!{K}.escena.getObjectByName('deposito_rodaja') && !!{K}.escena.getObjectByName('suelo_carretilla')"))
    camara(pg, dist=4.6, pitch=0.5, giro=0.3)
    foto(pg, 'troceo_10_banco_y_carretilla')
    pg.evaluate(f"(() => {{ const f = {K}.fabCliente; delete f.estaciones['banco_tronco:vista']; {K}.estacionesV.refrescar(); }})()")

    print('PC: lo que va a medias se guarda')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    en_mano(pg, 'hacha_hierro')
    otro = tronco(pg, 'tronco_largo', dx=-2.5)
    golpes(pg, otro, 3)
    pg = abrir(nav, 1280, 800, limpiar=False, pg=pg)
    prog = pg.evaluate(f"{K}.troceo.progreso('{otro}')")
    comprobar('al recargar sigue a medias', abs(prog - 3 / 18) < 1e-6, f'{prog}')
    comprobar('sin errores en la consola (PC)', not pg.errores, '; '.join(pg.errores[:3]))
    pg.close()

    print('Móvil: tronzar con el botón Usar')
    pg = abrir(nav, 390, 844, movil=True)
    largo = tronco(pg, 'tronco_largo')
    camara(pg, dist=5)
    en_mano(pg, 'hacha_piedra')
    pg.locator('#btnUsar').tap()
    pg.wait_for_function(f"{K}.troceo.progreso('{largo}') > 0", timeout=60000)
    comprobar('móvil: el botón Usar tronza (con piedra: 54 golpes)', pg.evaluate(f"{K}.estado.talando?.troceo") == largo and 'faltan 5' in aviso(pg), aviso(pg))
    foto(pg, 'troceo_06_movil_tronzando')
    pg.evaluate(f"{K}.estado.talando = null")
    r = golpes(pg, largo, 60)
    comprobar('móvil: queda tronzado', r['termina'])
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'tronco_corto'); k.pj.x = o.x - 1; k.pj.z = o.z; k.cogerDelSuelo(o); }})()")
    pg.locator('#llevas [data-alhombro]').tap()
    comprobar('móvil: «Al hombro» funciona', pg.evaluate(f"{K}.inventario.lugares.hombro?.tipo") == 'tronco_corto')
    camara(pg, dist=4)
    foto(pg, 'troceo_07_movil_al_hombro')
    print('Móvil: la rodaja')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'hombro' }})")
    pg.evaluate(f"(() => {{ const k = {K}; k.sueloObjetos.suelo.objetos = []; k.sueloObjetos.refrescar(); }})()")
    en_mano(pg, 'hacha_piedra')
    rodaja(pg, 'móvil: ')
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'rodaja'); k.pj.x = o.x - 0.8; k.pj.z = o.z; k.cogerDelSuelo(o); }})()")
    comprobar('móvil: la rodaja en las dos manos', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'rodaja')
    pg.wait_for_timeout(600)
    camara(pg, dist=2.8, pitch=0.3, giro=1.2)
    foto(pg, 'troceo_11_movil_rodaja')
    comprobar('sin errores en la consola (móvil)', not pg.errores, '; '.join(pg.errores[:3]))
    nav.close()

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
