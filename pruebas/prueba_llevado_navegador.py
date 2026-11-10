# Prueba en navegador real (Chromium sin pantalla): lo que llevas se ve puesto en el personaje del taller (hito 2):
# el cinturón y lo que cuelga de él, la mochila o el bastidor a la espalda con lo que lleva dentro, lo del hombro y lo
# de las manos. Para cada equipo de prueba: que cada pieza está donde tiene que estar respecto al cuerpo (el cinturón
# en la cintura, lo de la espalda detrás, lo del hombro arriba, lo de la mano en la mano) y que, al andar, sigue a su
# hueso. Capturas de cerca, de frente, de lado y de espalda, en PC y en móvil.
# Uso: python3 pruebas/prueba_llevado_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR=1 hace que las piezas no sigan a los huesos: tiene que fallar. MUTAR_MANOS=1 dibuja lo hecho a mano con la
# bolsa o el hatillo y el hacha de piedra como la de hierro: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, json
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v24'), f'{sitio}/recursos/personajes/taller-v24')
# las animaciones de cargar hechas en el taller (al hombro, arrastrar). MUTAR_HOMBRO=1 no las copia: tiene que fallar
if not os.environ.get('MUTAR_HOMBRO'):
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v3'), f'{sitio}/recursos/personajes/taller-carga-v3')
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/meshy-v1'), f'{sitio}/recursos/personajes/meshy-v1')  # los personajes de Meshy
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-dormir-v1'), f'{sitio}/recursos/personajes/taller-dormir-v1')  # tumbarse y levantarse
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-sentarse-v1'), f'{sitio}/recursos/personajes/taller-sentarse-v1')  # sentarse en el suelo
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

C = lambda tipo, n=1, dentro=None: {'tipo': tipo, 'n': n, **({'dentro': dentro} if dentro is not None else {})}
# equipos de prueba: lugares del inventario
EQUIPOS = {
    'lenero': {'cintura': C('cinto_anillas', 1, [C('hacha_piedra'), C('cuchillo'), C('bayas', 4), None]),
               'espalda': C('lenero', 1, [C('tronco_corto'), None, C('lena', 3), C('lena', 3), C('lena', 3), C('lena', 3)]),
               'hombro': C('saco'), 'mano:der': C('rama')},
    'mochila': {'cintura': C('cinto_cuero', 1, [C('piedra', 2), C('silex', 3), None]),
                'espalda': C('mochila_bastidor', 1, [None] * 8), 'hombro': C('odre'), 'mano:izq': C('piedra')},
    'cesta': {'cintura': C('cordel', 1, [C('setas', 3)]), 'espalda': C('cesta_recoleccion', 1, [C('bayas', 10), C('setas', 10), C('hierbas', 6), None, None, None]),
              'hombro': C('bandolera'), 'mano:der': C('lena')},
    'armas': {'cintura': C('cinto_armas', 1, [C('espada'), C('cuchillo'), None]), 'espalda': C('carcaj', 1, [C('flecha', 10), C('flecha', 10)]),
              'hombro': C('tronco_corto')},
    'zurron': {'cintura': C('cuerda_trenzada', 1, [C('cuerda', 3), None]), 'espalda': C('zurron', 1, [None] * 4), 'mano:izq': C('tronco_corto')},
    # lo que se fabrica con las manos (P3, 7 nov): cada uno con su modelo en la mano y en el cinturón
    'a_mano': {'cintura': C('cinto_anillas', 1, [C('taladro_fuego'), C('palo_cavador'), C('lasca_silex'), C('cordel', 2)]),
               'mano:der': C('hacha_piedra'), 'mano:izq': C('cuerda', 2)},
    'a_mano2': {'cintura': C('cuerda_trenzada', 1, [C('cuerda'), C('lasca_silex')]), 'mano:der': C('palo_cavador'), 'mano:izq': C('lasca_silex')},
    'a_mano3': {'cintura': C('cordel', 1, [C('lasca_silex')]), 'mano:der': C('taladro_fuego'), 'mano:izq': C('cordel', 3)},
    'lenero_en_manos': {'cintura': C('cordel', 1, [None]), 'mano:der': C('lenero', 1, [None] * 6)},
}
# lo que se fabrica con las manos: ninguno sale con la bolsa o el hatillo de lo que aún no tiene modelo
A_MANO = ('a_mano', 'a_mano2', 'a_mano3', 'lenero_en_manos')
VISTAS = {'frente': 0.0, 'lado': 1.5708, 'espalda': 3.1416}

MEDIR = '''() => { const K = window.__kinhold, j = K.jugador, H = j.mh.hueso; K.escena.updateMatrixWorld(true);
  const inv = j.raiz.matrixWorld.clone().invert(), V = () => j.raiz.position.clone();
  const local = (o) => o.getWorldPosition(V()).applyMatrix4(inv);
  const r = { piezas: {} };
  for (const o of j.llevado.grupo.children) {
    // el centro de lo que se ve (caja de todos sus vértices), en el espacio del personaje
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; const p = V();
    o.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i += 7) { p.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); z1 = Math.max(z1, p.z); } });
    r.piezas[o.name.slice(8)] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0].map(v => +v.toFixed(3));
  }
  r.modo = j.modo; r.alHombro = !!j.alHombro;
  r.genericos = j.llevado.grupo.children.filter(o => o.userData.generico).map(o => o.name.slice(8));
  r.hacha = j.hacha ? { nombre: j.hacha.name, visible: j.hacha.visible } : null;
  for (const n of ['pelvis', 'spine_03', 'hand_r', 'hand_l', 'neck_01', 'head', 'upperarm_r']) r[n] = local(H[n]).toArray().map(v => +v.toFixed(3));
  return r; }'''

def equipar(pg, lugares):
    pg.evaluate('''(l) => { const K = window.__kinhold, inv = K.inventario;
      for (const k of ['cintura', 'espalda', 'hombro', 'mano:der', 'mano:izq']) inv.lugares[k] = l[k] ? JSON.parse(JSON.stringify(l[k])) : null;
      K.vestir(); }''', lugares)
    pg.wait_for_timeout(300)
    if 'hombro' in lugares and lugares['hombro']['tipo'] == 'tronco_corto':
        # que la postura de llevarlo al hombro haya entrado del todo (el fundido dura 0,2 s)
        try: pg.wait_for_function(f"{K}.jugador.modo === 'hombroQuieto'", timeout=8000)
        except Exception: pass
        pg.wait_for_timeout(1200)

def mirar(pg, giro, dist=2.3, alto=0.35):
    # la cámara cerca del personaje: el personaje mira a +Z de su raíz; giro 0 = de frente
    pg.evaluate('''([g, d, a]) => { const K = window.__kinhold; K.cam.dist = d; K.cam.pitch = a;
      K.cam.yaw = K.jugador.raiz.rotation.y + g; }''', [giro, dist, alto])
    pg.wait_for_timeout(500)

def cercaTronco(pg, disp, quien):
    equipar(pg, {'hombro': C('tronco_corto')})
    vistas = {'frente': (0.0, 1.5, 0.3), 'der': (-1.5708, 1.5, 0.3), 'izq': (1.5708, 1.5, 0.3), 'arriba': (-0.8, 1.3, 0.7)} if disp == 'pc' else {'frente': (0.3, 2.0, 0.3), 'arriba': (-0.8, 1.8, 0.7)}
    for v, (g, d, a) in vistas.items():
        mirar(pg, g, d, a)
        pg.screenshot(path=f'{SALIDA}/{disp}_tronco_{quien}_{v}.png')

def dist(a, b): return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5

# El tronco al hombro (revisión del 1 nov: tapaba la cabeza y la mano subía al cuello): al lado de la cabeza, apoyado
# sobre el hombro y la muñeca derecha por encima de él y por delante. MUTAR_TRONCO=1 lo pone donde iba antes: tiene que fallar
def revisarTronco(nombre, m):
    h, cab, hom, mano = m['piezas']['hombro'], m['head'], m['upperarm_r'], m['hand_r']
    r = h[3] / 2  # el radio: lo ancho del tronco de lado
    comprobar(f'{nombre}: el tronco va al lado de la cabeza, sin taparla', abs(h[0] - cab[0]) > r + 0.07, f'{abs(h[0] - cab[0]) * 100:.1f} cm de lado entre la cabeza y el centro del tronco (radio {r * 100:.0f} cm)')
    comprobar(f'{nombre}: el tronco apoyado sobre el hombro (de 2 a 9 cm por encima de la articulación)', 0.02 < h[1] - r - hom[1] < 0.09, f'{(h[1] - r - hom[1]) * 100:.1f} cm')
    comprobar(f'{nombre}: la mano encima del tronco y por delante del hombro', mano[1] > h[1] + r * 0.6 and mano[2] > hom[2] + 0.1, f'mano {mano} · tronco {h[:3]} · hombro {hom}')

def revisar(nombre, m):
    p, P = m['piezas'], m['pelvis']
    if 'cinturon' in p:
        c = p['cinturon']
        comprobar(f'{nombre}: el cinturón rodea la cintura', abs(c[0] - P[0]) < 0.06 and P[1] - 0.05 < c[1] < P[1] + 0.2 and 0.2 < c[3] < 0.55, f'centro {c[:3]}, ancho {c[3]}, pelvis {P}')
    if 'espalda' in p:
        e = p['espalda']
        comprobar(f'{nombre}: lo de la espalda va detrás (-Z) y a la altura de la espalda', e[2] - e[5] / 2 < P[2] - 0.15 and P[1] < e[1] < m['neck_01'][1] + 0.1, f'centro {e[:3]}, fondo {e[5]}')
    if 'hombro' in p:
        h = p['hombro']
        comprobar(f'{nombre}: lo del hombro va por encima de la cintura', h[1] > P[1] + 0.15, f'centro {h[:3]}')
        if m.get('alHombro'):
            # el tronco al hombro: la postura de llevarlo (taller-carga-v3) y la mano derecha arriba, sobre el tronco
            comprobar(f'{nombre}: con el tronco al hombro, la postura de llevarlo', m.get('modo') == 'hombroQuieto', m.get('modo'))
            mano = m['hand_r']
            comprobar(f'{nombre}: la mano derecha sujeta el tronco (sobre el hombro, cerca del tronco)', mano[1] > m['neck_01'][1] - 0.05 and abs(mano[0] - h[0]) < 0.15 and abs(mano[1] - h[1]) < 0.2,
                      f'mano {mano} · tronco {h[:3]} · cuello {m["neck_01"]}')
            revisarTronco(nombre, m)
    for lado, hueso in (('r', 'hand_r'), ('l', 'hand_l')):
        if 'mano_' + lado in p:
            comprobar(f'{nombre}: lo de la mano {lado} está en la mano', dist(p['mano_' + lado], m[hueso]) < 0.35, f'{p["mano_" + lado][:3]} · mano {m[hueso]}')
    if 'manos' in p:
        medio = [(m['hand_r'][i] + m['hand_l'][i]) / 2 for i in range(3)]
        comprobar(f'{nombre}: lo grande, delante, entre las dos manos', p['manos'][2] > P[2] + 0.1 and dist(p['manos'], medio) < 0.15, f'{p["manos"][:3]} · entre las manos {[round(v, 3) for v in medio]}')
        comprobar(f'{nombre}: y el personaje lo sujeta (postura de llevar en brazos)', m.get('modo') == 'cargar', m.get('modo'))

with sync_playwright() as pw:
    nav = pw.chromium.launch(args=ARGS)
    for disp, vp in (('pc', {'width': 1280, 'height': 800}), ('movil', {'width': 390, 'height': 844})):
        print(f'== {disp}')
        ctx = nav.new_context(locale='es-ES', viewport=vp, **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if disp == 'movil' else {}))
        pg = ctx.new_page(); errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.goto(URL)
        pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
        pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
        pg.wait_for_function(f'{K}.jugador.mh', timeout=120000)
        if os.environ.get('MUTAR'): pg.evaluate('globalThis.__sinSeguirLlevado = true')
        if os.environ.get('MUTAR_TRONCO'): pg.evaluate('globalThis.__troncoComoAntes = true')
        if os.environ.get('MUTAR_MANOS'): pg.evaluate('globalThis.__sinModelosManos = true')
        pg.evaluate("document.querySelectorAll('#ayuda, .ayuda, #panelAyuda').forEach(e => e.style.display = 'none')")
        for nombre, lugares in EQUIPOS.items():
            equipar(pg, lugares)
            m = pg.evaluate(MEDIR)
            if disp == 'pc':
                revisar(nombre, m)
                faltan = [k for k, t in (('cinturon', 'cintura'), ('espalda', 'espalda'), ('hombro', 'hombro')) if t in lugares and k not in m['piezas']]
                comprobar(f'{nombre}: se ve todo lo que lleva', not faltan, f'piezas {sorted(m["piezas"])}, faltan {faltan}')
            if disp == 'pc' and nombre in A_MANO:
                comprobar(f'{nombre}: lo hecho a mano, cada uno con su modelo (sin bolsa ni hatillo)', not m['genericos'], f'con el de relleno: {m["genericos"]}')
            if disp == 'pc' and nombre == 'a_mano':
                comprobar('a_mano: el hacha de piedra en la mano es la de piedra y se ve', m['hacha'] == {'nombre': 'hacha_piedra', 'visible': True}, str(m['hacha']))
            if disp == 'pc' and nombre == 'lenero_en_manos':
                comprobar('lenero_en_manos: el leñero cogido delante, entre las dos manos', 'manos' in m['piezas'] and m['piezas']['manos'][3] > 0.25, str(m['piezas'].get('manos')))
            vistas = VISTAS if disp == 'pc' else {'frente': 0.6, 'espalda': 3.6}
            for v, g in vistas.items():
                mirar(pg, g, 2.3 if disp == 'pc' else 3.2)
                pg.screenshot(path=f'{SALIDA}/{disp}_{nombre}_{v}.png')
        # lo hecho a mano, de cerca (en la mano y en el cinturón)
        for nombre in A_MANO:
            equipar(pg, EQUIPOS[nombre])
            for v, (g, d, a) in ({'frente': (0.35, 1.3, 0.15), 'lado': (1.2, 1.3, 0.15)} if disp == 'pc' else {'frente': (0.35, 1.8, 0.15)}).items():
                mirar(pg, g, d, a)
                pg.screenshot(path=f'{SALIDA}/{disp}_cerca_{nombre}_{v}.png')
        if disp == 'pc':
            # el hacha de hierro vuelve a ser la de hierro al cambiarla
            equipar(pg, {'mano:der': C('hacha_mano')})
            h = pg.evaluate(f'{K}.jugador.hacha && {K}.jugador.hacha.name')
            comprobar('con el hacha de mano, se ve la de hierro (no se queda la de piedra)', h == 'hacha', str(h))
        # el tronco al hombro de cerca (revisión del 1 nov): de frente, de lado (los dos) y desde arriba, por delante
        cercaTronco(pg, disp, 'hombre')
        if disp == 'pc':
            # al andar, lo de la mano sigue a la mano y lo de la espalda a la espalda
            print('Al andar, cada pieza sigue a su hueso')
            equipar(pg, EQUIPOS['lenero'])
            antes = pg.evaluate(MEDIR)
            pg.keyboard.down('w'); pg.wait_for_timeout(1800)
            ahora = pg.evaluate(MEDIR); anda = pg.evaluate(f'{K}.jugador.modo'); pg.keyboard.up('w')
            d_mano = dist(ahora['piezas']['mano_r'], ahora['hand_r'])
            comprobar('el personaje anda', anda in ('andar', 'correr'), anda)
            comprobar('andando, la rama sigue en la mano', d_mano < 0.35, f'{d_mano:.3f} m de la mano')
            comprobar('andando, el leñero sigue detrás', ahora['piezas']['espalda'][2] < ahora['spine_03'][2] - 0.05, f'{ahora["piezas"]["espalda"][:3]}')
            comprobar('la mano se ha movido con la animación (si no, la prueba no prueba nada)', dist(antes['hand_r'], ahora['hand_r']) > 0.02, f'{dist(antes["hand_r"], ahora["hand_r"]):.3f} m')
            # sin nada: no queda nada encima
            equipar(pg, {})
            comprobar('sin nada encima, no se dibuja nada', pg.evaluate(f'{K}.jugador.llevado.grupo.children.length') == 0)
        comprobar(f'{disp}: sin errores en la página', not errores, '; '.join(errores[:3]))
        ctx.close()
        # y la mujer (hombros más estrechos): el mismo tronco, al lado de la cabeza, con la mano encima
        ctx = nav.new_context(locale='es-ES', viewport=vp, **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if disp == 'movil' else {}))
        pg = ctx.new_page(); errores = []; pedidos = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('request', lambda r: pedidos.append(r.url))
        pg.goto(URL)
        pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
        pg.evaluate("localStorage.clear(); localStorage.setItem('kinhold_personaje_v2', JSON.stringify({sexo: 'mujer'})); location.reload()")
        pg.wait_for_function('window.__kinhold !== undefined && window.__kinhold.jugador.mh', timeout=180000)
        if os.environ.get('MUTAR_TRONCO'): pg.evaluate('globalThis.__troncoComoAntes = true')
        pg.evaluate("document.querySelectorAll('#ayuda, .ayuda, #panelAyuda').forEach(e => e.style.display = 'none')")
        comprobar(f'{disp}: la mujer, elegida (se carga la de Meshy, con sus animaciones)', any('meshy-v1/mujer.glb' in u for u in pedidos))
        equipar(pg, {'hombro': C('tronco_corto')})
        m = pg.evaluate(MEDIR)
        if disp == 'pc':
            comprobar('mujer: con el tronco al hombro, la postura de llevarlo', m.get('modo') == 'hombroQuieto', m.get('modo'))
            revisarTronco('mujer', m)
        cercaTronco(pg, disp, 'mujer')
        comprobar(f'{disp} (mujer): sin errores en la página', not errores, '; '.join(errores[:3]))
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"TODO CORRECTO" if not fallos else "FALLAN: " + ", ".join(fallos)}')
sys.exit(1 if fallos else 0)
