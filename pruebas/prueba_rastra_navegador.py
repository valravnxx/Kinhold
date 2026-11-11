# Prueba en navegador (Chromium sin pantalla): la rastra (hito de equipo).
# Del arcón de pruebas sale al suelo; se carga con el tronco corto de las manos y con los de una pila del suelo (3 como
# mucho); Usar la engancha (con las manos libres), va detrás del personaje al andar, despacio y con la animación de
# arrastrar; Usar la suelta donde está y se queda con lo que lleva, también al recargar; descargada, la carga cae al lado.
# En el móvil, desde el panel de inventario y con los botones. Capturas de cerca en PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_rastra_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR=1: en la rastra no se puede cargar nada: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/naturaleza'), f'{sitio}/recursos/naturaleza')   # la naturaleza de Meshy (11 nov), como en la web
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', TALLER), f'{sitio}/recursos/personajes/{TALLER}')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v3'), f'{sitio}/recursos/personajes/taller-carga-v3')  # las de cargar del taller
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/meshy-v2'), f'{sitio}/recursos/personajes/meshy-v2')  # los personajes de Meshy
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/estaciones-meshy-v1'), f'{sitio}/recursos/estaciones-meshy-v1')  # el acopio y el mojón de valravnx (Meshy), como en la web
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-dormir-v1'), f'{sitio}/recursos/personajes/taller-dormir-v1')  # tumbarse y levantarse
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-sentarse-v1'), f'{sitio}/recursos/personajes/taller-sentarse-v1')  # sentarse en el suelo
import re as _re
_ICONOS = _re.search(r"CARPETA_ICONOS = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs', _ICONOS), f'{sitio}/{_ICONOS}')  # las imágenes del panel de equipo
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ|FUENTES) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
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
    if MUTAR: pg.evaluate(f"{K}.rastras.cargar = () => ({{ ok: false, motivo: 'MUTAR' }})")
    pg.wait_for_timeout(800)
    return pg


def camara(pg, dist=5.5, pitch=0.42, giro=0.9):
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = k.pj.rot + Math.PI / 2 + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")

def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")

def foto(pg, nombre):
    pg.wait_for_timeout(400); pg.evaluate(f"{K}.render && {K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')

def rastra(pg):
    return pg.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'rastra'); return o ? JSON.parse(JSON.stringify(o)) : null; }})()")

def en_suelo(pg, tipo):
    return pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === '{tipo}').reduce((s, o) => s + o.cosa.n, 0)")

# andar hacia delante n fotogramas reales (la rastra la mueve cada fotograma)
def andar(pg, pasos=40, dx=0.12):
    pg.evaluate(f"""(async () => {{ const k = {K}; k.pj.rot = Math.PI / 2;
      for (let i = 0; i < {pasos}; i++) {{ k.pj.x += {dx}; await new Promise(r => requestAnimationFrame(r)); }} }})()""")
    pg.wait_for_timeout(300)

def lejos_rastra(pg):  # lo lejos que se ve el centro de la rastra del personaje
    return pg.evaluate(f"(() => {{ const k = {K}, o = k.escena.getObjectByName('suelo_rastra'); return o ? Math.hypot(o.position.x - k.pj.x, o.position.z - k.pj.z) : -1; }})()")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: la rastra sale del arcón al suelo y se carga')
    pg = abrir(nav, 1280, 800)
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.k = 0; k.pj.rot = Math.PI / 2; k.arconAlSuelo('rastra'); }})()")
    r = rastra(pg)
    comprobar('del arcón sale la rastra al suelo, delante de ti', r is not None and pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_rastra')"), aviso(pg))
    comprobar('no desaparece', r and r['desaparece'] is None)
    comprobar('no se coge con las manos', pg.evaluate(f"{K}.opcionesUsar().every(t => !t.includes('Coger del suelo: 1 × Rastra'))"))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'rastra'); k.sueloObjetos.suelo.dejar({{ tipo: 'tronco_corto', n: 3 }}, o.x + 0.2, o.z + 1.4, Date.now(), 'jugador:local', false, 0); k.sueloObjetos.refrescar(); k.pj.x = o.x - 0.6; k.pj.z = o.z + 0.6; }})()")
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'tronco_corto', cantidad: 1, a: 'mano:der' }}); {K}.pintarLlevas(); {K}.vestir()")
    pg.evaluate(f"{K}.usar()")
    r = rastra(pg)
    comprobar('Usar junto a ella con un tronco corto en las manos lo carga', (r['cosa'].get('carga') or {}).get('n') == 1 and not pg.evaluate(f"{K}.inventario.lugares['mano:der']"), aviso(pg))
    ops = pg.evaluate(f"{K}.opcionesRastra()")
    comprobar('el menú ofrece cargar 2 de la pila del suelo (caben 3)', any('Cargar en la rastra: 2' in o for o in ops), str(ops))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0], s = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'tronco_corto'); k.cargarRastra(o, {{ suelo: s.id }}); }})()")
    r = rastra(pg)
    comprobar('lleva 3 troncos cortos y queda 1 en la pila', (r['cosa'].get('carga') or {}).get('n') == 3 and en_suelo(pg, 'tronco_corto') == 1, aviso(pg))
    comprobar('la carga se ve en la rastra', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_rastra').getObjectByName('carga')"))
    comprobar('cargar queda en el registro con su autor', pg.evaluate(f"{K}.registroAcciones.entradas.some(e => e.tipo === 'cargar_rastra' && e.autor === 'jugador:local' && e.ok)"))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.6; k.pj.z = o.z - 1.2; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
    camara(pg, dist=4.2, pitch=0.5, giro=0.5)
    foto(pg, 'rastra_01_cargada')

    print('PC: arrastrarla')
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x + 0.8; k.pj.z = o.z; }})()")
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'cuchillo', cantidad: 1, a: 'mano:der' }})")
    pg.evaluate(f"{K}.usar()")
    comprobar('con algo en las manos no se engancha', not pg.evaluate(f"!!{K}.miRastra()") and 'manos libres' in aviso(pg), aviso(pg))
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"{K}.usar()")
    comprobar('con las manos libres, Usar la engancha', pg.evaluate(f"!!{K}.miRastra()"), aviso(pg))
    v = pg.evaluate(f"{K}.velocidadCarga()")
    comprobar('cargada con tres troncos vas despacio (al 50 %)', abs(v - 0.5) < 0.01, f'{v}')
    comprobar('abajo sale «Arrastras: Rastra» con Soltar', pg.locator('#llevas [data-soltarrastra]').count() == 1)
    andar(pg, 50)
    d = lejos_rastra(pg)
    comprobar('al andar, la rastra va detrás (a 1,6 m)', abs(d - 1.6) < 0.05, f'{d:.2f}')
    comprobar('detrás de verdad: al otro lado de hacia donde anda', pg.evaluate(f"{K}.escena.getObjectByName('suelo_rastra').position.x < {K}.pj.x - 1.4"))
    comprobar('el personaje la arrastra con su animación', pg.evaluate(f"{K}.jugador.mh ? {K}.jugador.modo === 'arrastrar' : true"), pg.evaluate(f"{K}.jugador.modo"))
    camara(pg, dist=4.6, pitch=0.35, giro=0.75)
    foto(pg, 'rastra_02_arrastrando')
    camara(pg, dist=3.6, pitch=0.25, giro=-0.2)
    foto(pg, 'rastra_03_arrastrando_de_cerca')
    c = pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:der' }}).ok")
    comprobar('arrastrándola no se coge nada con las manos', not c)

    print('PC: soltarla y volver')
    visto = pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('suelo_rastra'); return [o.position.x, o.position.z]; }})()")
    pg.evaluate(f"{K}.usar()")
    r = rastra(pg)
    comprobar('Usar la suelta donde se ve', not r.get('arrastra') and abs(r['x'] - visto[0]) < 0.05 and abs(r['z'] - visto[1]) < 0.05, f"{r['x']},{r['z']} / {visto}")
    comprobar('y vuelves a andar a tu paso', pg.evaluate(f"{K}.velocidadCarga()") > 0.95)
    andar(pg, 20)
    comprobar('ya no te sigue', abs(pg.evaluate(f"{K}.escena.getObjectByName('suelo_rastra').position.x") - visto[0]) < 0.05)
    pg = abrir(nav, 1280, 800, limpiar=False, pg=pg)
    r = rastra(pg)
    comprobar('al recargar sigue donde la dejaste, con lo que lleva', r and abs(r['x'] - visto[0]) < 0.05 and (r['cosa'].get('carga') or {}).get('n') == 3)
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.k = 0; k.pj.x = o.x + 1.2; k.pj.z = o.z + 0.4; }})()")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.descargarRastra(o); }})()")
    comprobar('descargada, los 3 troncos caen a su lado', en_suelo(pg, 'tronco_corto') == 4 and not (rastra(pg)['cosa'].get('carga')), aviso(pg))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.sueloObjetos.suelo.dejar({{ tipo: 'piedra', n: 30 }}, o.x - 0.5, o.z + 1, Date.now(), 'jugador:local', false); k.sueloObjetos.refrescar(); k.pj.x = o.x; k.pj.z = o.z + 1.2; }})()")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0], s = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'piedra'); k.cargarRastra(o, {{ suelo: s.id }}); }})()")
    comprobar('un montón de piedras: 24', (rastra(pg)['cosa'].get('carga') or {}).get('n') == 24, aviso(pg))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.9; k.pj.z = o.z - 1.4; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
    camara(pg, dist=3.8, pitch=0.55, giro=0.3)
    foto(pg, 'rastra_04_piedras')
    # troncos delgados y varas (valravnx, 7 nov: «metelo ya»)
    for tipo, n, cabe, nombre in (('tronco_delgado', 6, 5, 'rastra_07_troncos_delgados'), ('vara', 14, 12, 'rastra_08_varas')):
        pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x + 1.2; k.pj.z = o.z + 0.4; k.descargarRastra(o); }})()")
        pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.sueloObjetos.suelo.objetos = k.sueloObjetos.suelo.objetos.filter(x => x.cosa.tipo === 'rastra'); k.sueloObjetos.suelo.dejar({{ tipo: '{tipo}', n: {n} }}, o.x - 0.5, o.z + 1, Date.now(), 'jugador:local', false); k.sueloObjetos.refrescar(); k.pj.x = o.x; k.pj.z = o.z + 1.2; }})()")
        pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0], s = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === '{tipo}'); k.cargarRastra(o, {{ suelo: s.id }}); }})()")
        comprobar(f'en la rastra van {cabe} de {tipo}', (rastra(pg)['cosa'].get('carga') or {}).get('n') == cabe and (rastra(pg)['cosa'].get('carga') or {}).get('tipo') == tipo, aviso(pg))
        pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.9; k.pj.z = o.z - 1.4; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
        camara(pg, dist=3.8, pitch=0.55, giro=0.3)
        comprobar(f'y se ven puestos en ella ({tipo})', pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('suelo_rastra'); return !!o && !!o.getObjectByName('carga'); }})()"))
        foto(pg, nombre)
    # los juncos, en el fardo atado a la espalda
    pg.evaluate(f"(() => {{ const k = {K}, l = k.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) k.accionInventario({{ tipo: 'soltar', de: m }}); if (l.espalda) k.accionInventario({{ tipo: 'soltar', de: 'espalda' }}); }})()")
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'fardo', cantidad: 1, a: 'espalda' }})")
    r = pg.evaluate(f"[{K}.accionInventario({{ tipo: 'coger', objeto: 'junco', cantidad: 3, a: 'espalda/0' }}), {K}.accionInventario({{ tipo: 'coger', objeto: 'junco', cantidad: 3, a: 'espalda/1' }})]")
    comprobar('el fardo atado lleva juncos', all(x.get('ok') for x in r) and pg.evaluate(f"{K}.inventario.lugares.espalda.dentro[0].tipo === 'junco'"), str(r))
    pg.evaluate(f"{K}.pintarLlevas(); {K}.vestir()")
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.rot = 0; }})()")
    camara(pg, dist=2.4, pitch=0.3, giro=0)
    foto(pg, 'rastra_09_fardo_juncos')
    comprobar('sin errores en la consola (PC)', not pg.errores, '; '.join(pg.errores[:3]))
    pg.close()

    print('Móvil: desde el panel y con los botones')
    pg = abrir(nav, 390, 844, movil=True)
    pg.evaluate(f"{K}.pj.k = 0; {K}.pj.rot = Math.PI / 2")
    pg.locator('#btnMenu').tap(); pg.locator('#btnInventario').tap()   # (el menú con pestañas)
    pg.wait_for_timeout(300)
    pg.locator('#panelInventario .inv-objeto[data-tipo="rastra"]').tap()
    comprobar('móvil: en el arcón, la rastra sale con «Dejarlo en el suelo»', pg.locator('#panelInventario .inv-alsuelo').count() == 1)
    foto(pg, 'rastra_05_movil_arcon')
    pg.locator('#panelInventario .inv-alsuelo').tap()
    comprobar('móvil: la deja en el suelo', rastra(pg) is not None)
    pg.locator('#hubCerrar').tap()   # (la cruz del menú con pestañas)
    pg.locator('#btnUsar').tap()
    comprobar('móvil: el botón Usar la engancha', pg.evaluate(f"!!{K}.miRastra()"), aviso(pg))
    andar(pg, 40)
    camara(pg, dist=6, pitch=0.42, giro=1.15)
    foto(pg, 'rastra_06_movil_arrastrando')
    pg.locator('#llevas [data-soltarrastra]').tap()
    comprobar('móvil: «Soltar» de abajo la deja', not pg.evaluate(f"!!{K}.miRastra()") and not rastra(pg).get('arrastra'), aviso(pg))
    comprobar('sin errores en la consola (móvil)', not pg.errores, '; '.join(pg.errores[:3]))
    nav.close()

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
