# Prueba en navegador (Chromium sin pantalla): la carretilla de rueda maciza (hito de equipo).
# Del arcón de pruebas sale al suelo; se carga con lo de una pila del suelo (4 troncos cortos como mucho) o con leña;
# Usar la empuja (con las manos libres): va delante del personaje, con las agarraderas en sus manos, la rueda rueda al
# andar, más deprisa que la rastra; Usar la aparca donde está y se queda con lo que lleva, también al recargar;
# descargada, la carga cae al lado. En el móvil, desde el panel de inventario y con los botones. Capturas de cerca en
# PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_carretilla_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR=1: la carretilla no se deja empujar: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', TALLER), f'{sitio}/recursos/personajes/{TALLER}')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v3'), f'{sitio}/recursos/personajes/taller-carga-v3')  # las de cargar del taller
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
MUTAR_ANIM = os.environ.get('MUTAR_ANIM') == '1'   # da por buena la de llevar en brazos: tiene que fallar

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
    if MUTAR: pg.evaluate(f"{K}.rastras.enganchar = () => ({{ ok: false, motivo: 'MUTAR' }})")
    pg.wait_for_timeout(800)
    return pg


def camara(pg, dist=5.5, pitch=0.42, giro=0.9):
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = k.pj.rot + Math.PI / 2 + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")

def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")

def foto(pg, nombre):
    pg.wait_for_timeout(400); pg.evaluate(f"{K}.render && {K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')

def carr(pg):
    return pg.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'carretilla'); return o ? JSON.parse(JSON.stringify(o)) : null; }})()")

def en_suelo(pg, tipo):
    return pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === '{tipo}').reduce((s, o) => s + o.cosa.n, 0)")

def andar(pg, pasos=40, dx=0.12):
    pg.evaluate(f"""(async () => {{ const k = {K}; k.pj.rot = Math.PI / 2;
      for (let i = 0; i < {pasos}; i++) {{ k.pj.x += {dx}; await new Promise(r => requestAnimationFrame(r)); }} }})()""")
    pg.wait_for_timeout(300)

VISTA = f"{K}.escena.getObjectByName('suelo_carretilla')"
def lejos(pg):  # lo lejos que se ve el centro de la carretilla del personaje
    return pg.evaluate(f"(() => {{ const k = {K}, o = {VISTA}; return o ? Math.hypot(o.position.x - k.pj.x, o.position.z - k.pj.z) : -1; }})()")

# lo lejos que quedan las agarraderas de los puños del personaje (los nudillos, middle_01; m), o None si no hay personaje
# del taller. [hueso, distancia, altura del nudillo, altura de la agarradera]
MANOS = """(() => { const k = window.__kinhold, j = k.jugador, o = k.escena.getObjectByName('suelo_carretilla'); if (!j.mh || !o) return null;
  k.escena.updateMatrixWorld(true); const V = o.position.constructor, manos = [], ags = [];
  j.mh.raiz.traverse(n => { if (/^middle_01_[lr]$/i.test(n.name)) manos.push(n); });
  o.traverse(n => { if (n.name === 'agarradera') ags.push(n.getWorldPosition(new V())); });
  return manos.map(m => { const v = m.getWorldPosition(new V()); return [m.name, +Math.min(...ags.map(a => a.distanceTo(v))).toFixed(3), +v.y.toFixed(3), +ags[0].y.toFixed(3)]; }); })()"""

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: la carretilla sale del arcón al suelo y se carga')
    pg = abrir(nav, 1280, 800)
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.k = 0; k.pj.rot = Math.PI / 2; k.arconAlSuelo('carretilla'); }})()")
    c = carr(pg)
    comprobar('del arcón sale la carretilla al suelo, delante de ti', c is not None and pg.evaluate(f"!!{VISTA}"), aviso(pg))
    comprobar('no desaparece', c and c['desaparece'] is None)
    comprobar('tiene su rueda de rodaja de tronco', pg.evaluate(f"!!{VISTA}.getObjectByName('rueda')"))
    comprobar('no se coge con las manos', pg.evaluate(f"{K}.opcionesUsar().every(t => !t.includes('Carretilla de rueda maciza'))"))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'carretilla'); k.sueloObjetos.suelo.dejar({{ tipo: 'tronco_corto', n: 5 }}, o.x + 0.3, o.z + 1.4, Date.now(), 'jugador:local', false, 0); k.sueloObjetos.refrescar(); k.pj.x = o.x - 0.6; k.pj.z = o.z + 0.6; }})()")
    ops = pg.evaluate(f"{K}.opcionesRastra()")
    comprobar('el menú ofrece empujarla y cargar 4 de la pila (caben 4)', any('Empujar la carretilla' in o for o in ops) and any('Cargar en la carretilla: 4' in o for o in ops), str(ops))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0], s = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'tronco_corto'); k.cargarRastra(o, {{ suelo: s.id }}); }})()")
    c = carr(pg)
    comprobar('lleva 4 troncos cortos y queda 1 en la pila', (c['cosa'].get('carga') or {}).get('n') == 4 and en_suelo(pg, 'tronco_corto') == 1, aviso(pg))
    comprobar('la carga se ve en la caja', pg.evaluate(f"!!{VISTA}.getObjectByName('carga')"))
    comprobar('cargar queda en el registro con su autor', pg.evaluate(f"{K}.registroAcciones.entradas.some(e => e.tipo === 'cargar_carretilla' && e.autor === 'jugador:local' && e.ok)"))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.7; k.pj.z = o.z - 1.3; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
    camara(pg, dist=3.6, pitch=0.5, giro=0.6)
    foto(pg, 'carretilla_01_cargada')
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x + 1.6; k.pj.z = o.z - 1.6; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
    camara(pg, dist=3.4, pitch=0.35, giro=0.35)
    foto(pg, 'carretilla_02_de_cerca')

    print('PC: empujarla')
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.0; k.pj.z = o.z; }})()")
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'cuchillo', cantidad: 1, a: 'mano:der' }})")
    pg.evaluate(f"{K}.usar()")
    comprobar('con algo en las manos no se empuja', not pg.evaluate(f"!!{K}.miRastra()") and 'manos libres' in aviso(pg), aviso(pg))
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    pg.evaluate(f"{K}.usar()")
    comprobar('con las manos libres, Usar la empuja', pg.evaluate(f"!!{K}.miRastra()") and 'Empujas' in aviso(pg), aviso(pg))
    v = pg.evaluate(f"{K}.velocidadCarga()")
    comprobar('con cuatro troncos vas al 65 % (más que con la rastra llena)', abs(v - 0.65) < 0.01, f'{v}')
    comprobar('abajo sale «Empujas: Carretilla» con Aparcar', pg.locator('#llevas [data-soltarrastra]').count() == 1 and 'Empujas' in pg.locator('#llevas').inner_text())
    giro0 = pg.evaluate(f"{VISTA}.getObjectByName('rueda').rotation.x")
    andar(pg, 50)
    d = lejos(pg)
    comprobar('al andar, la carretilla va delante (a 1,4 m)', abs(d - 1.4) < 0.05, f'{d:.2f}')
    comprobar('delante de verdad: hacia donde anda', pg.evaluate(f"{VISTA}.position.x > {K}.pj.x + 1.3"))
    giro1 = pg.evaluate(f"{VISTA}.getObjectByName('rueda').rotation.x")
    comprobar('la rueda rueda al avanzar (unos 6 m: 25 rad)', giro1 - giro0 > 20, f'{giro1 - giro0:.1f}')
    comprobar('las varas suben a las manos', pg.evaluate(f"{VISTA}.getObjectByName('cuerpo').rotation.x > 0.1"))
    # la animación de empujar del taller (taller-carga-v3): andando, empujarCarretilla; parado, empujarQuieto
    comprobar('el personaje la empuja con la animación de empujar (no la de llevar en brazos)', pg.evaluate(f"{K}.jugador.mh ? ['empujarCarretilla', 'empujarQuieto'].includes({K}.jugador.modo) : true") != MUTAR_ANIM, pg.evaluate(f"{K}.jugador.modo"))
    comprobar('la carretilla va poco levantada (menos de 25°)', pg.evaluate(f"(() => {{ const c = {VISTA}.getObjectByName('cuerpo'), cama = c.getObjectByName('cama'); return (c.rotation.x + cama.rotation.x) * 180 / Math.PI; }})()") < 25)
    manos = pg.evaluate(MANOS)
    print('     puños y agarraderas:', manos)
    comprobar('las agarraderas quedan en los puños (a menos de 8 cm de los nudillos), quieto', manos is None or (len(manos) == 2 and all(m[1] < 0.08 for m in manos)), str(manos))
    camara(pg, dist=1.9, pitch=0.25, giro=1.3)
    foto(pg, 'carretilla_08_manos_de_cerca')
    # andando, que las manos sigan en las varas lo mira pruebas/prueba_anim_carga.mjs en todos los fotogramas
    camara(pg, dist=4.0, pitch=0.3, giro=0.8)
    foto(pg, 'carretilla_03_empujando')
    camara(pg, dist=2.8, pitch=0.2, giro=1.6)
    foto(pg, 'carretilla_04_empujando_de_lado')
    comprobar('empujándola no se coge nada con las manos', not pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:der' }}).ok"))

    print('PC: aparcarla y volver')
    visto = pg.evaluate(f"(() => {{ const o = {VISTA}; return [o.position.x, o.position.z]; }})()")
    pg.evaluate(f"{K}.usar()")
    c = carr(pg)
    comprobar('Usar la aparca donde se ve', not c.get('arrastra') and abs(c['x'] - visto[0]) < 0.05 and abs(c['z'] - visto[1]) < 0.05, f"{c['x']},{c['z']} / {visto}")
    comprobar('fuera de tus tierras avisa de que cualquiera puede coger lo que lleva', 'cualquiera' in aviso(pg) and not c.get('guarda'), aviso(pg))
    comprobar('aparcada, descansa en las patas', pg.evaluate(f"{VISTA}.getObjectByName('cuerpo').rotation.x") == 0)
    comprobar('y vuelves a andar a tu paso', pg.evaluate(f"{K}.velocidadCarga()") > 0.95)
    pg = abrir(nav, 1280, 800, limpiar=False, pg=pg)
    c = carr(pg)
    comprobar('al recargar sigue donde la dejaste, con lo que lleva', c and abs(c['x'] - visto[0]) < 0.05 and (c['cosa'].get('carga') or {}).get('n') == 4)
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.k = 0; k.pj.x = o.x - 0.4; k.pj.z = o.z + 1.0; k.descargarRastra(o); }})()")
    comprobar('descargada, los 4 troncos caen a su lado', en_suelo(pg, 'tronco_corto') == 5 and not (carr(pg)['cosa'].get('carga')), aviso(pg))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.sueloObjetos.suelo.dejar({{ tipo: 'lena', n: 30 }}, o.x - 0.6, o.z - 1, Date.now(), 'jugador:local', false); k.sueloObjetos.refrescar(); k.pj.x = o.x - 0.5; k.pj.z = o.z - 0.8; }})()")
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0], s = k.sueloObjetos.suelo.objetos.find(x => x.cosa.tipo === 'lena'); k.cargarRastra(o, {{ suelo: s.id }}); }})()")
    comprobar('la leña va en la carretilla', (carr(pg)['cosa'].get('carga') or {}).get('n') == 30, aviso(pg))
    pg.evaluate(f"(() => {{ const k = {K}, o = k.rastras.todas(Date.now())[0]; k.pj.x = o.x - 1.5; k.pj.z = o.z - 1.5; k.pj.rot = Math.atan2(o.x - k.pj.x, o.z - k.pj.z); }})()")
    camara(pg, dist=3.2, pitch=0.6, giro=0.3)
    foto(pg, 'carretilla_05_lena')
    comprobar('sin errores en la consola (PC)', not pg.errores, '; '.join(pg.errores[:3]))
    pg.close()

    print('Móvil: desde el panel y con los botones')
    pg = abrir(nav, 390, 844, movil=True)
    pg.evaluate(f"{K}.pj.k = 0; {K}.pj.rot = Math.PI / 2")
    pg.locator('#btnMenu').tap(); pg.locator('#btnInventario').tap()   # (el menú con pestañas)
    pg.wait_for_timeout(300)
    pg.locator('#panelInventario .inv-objeto[data-tipo="carretilla"]').tap()
    comprobar('móvil: en el arcón, la carretilla sale con «Dejarlo en el suelo»', pg.locator('#panelInventario .inv-alsuelo').count() == 1)
    foto(pg, 'carretilla_06_movil_arcon')
    pg.locator('#panelInventario .inv-alsuelo').tap()
    comprobar('móvil: la deja en el suelo', carr(pg) is not None)
    pg.locator('#hubCerrar').tap()   # (la cruz del menú con pestañas)
    pg.locator('#btnUsar').tap()
    comprobar('móvil: el botón Usar la empuja', pg.evaluate(f"!!{K}.miRastra()"), aviso(pg))
    andar(pg, 40)
    camara(pg, dist=4.5, pitch=0.4, giro=1.0)
    foto(pg, 'carretilla_07_movil_empujando')
    pg.locator('#llevas [data-soltarrastra]').tap()
    comprobar('móvil: «Aparcar» de abajo la deja', not pg.evaluate(f"!!{K}.miRastra()") and not carr(pg).get('arrastra'), aviso(pg))
    comprobar('sin errores en la consola (móvil)', not pg.errores, '; '.join(pg.errores[:3]))
    nav.close()

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
