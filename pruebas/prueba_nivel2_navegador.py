# Prueba en navegador (Chromium sin pantalla) de las piezas de nivel 2 a la vista (P10, 20 nov): la tabla, el clavo y la
# barra de hierro ya salen del mundo (la sierra, la fragua) y el tramo pasa al nivel 2. Sin servidor y en un llano,
# primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - en Construir, cada pieza y cada mueble de nivel 2 a la vista en su pestaña, con su imagen cargada y su coste
#     (tablas, clavos, barras de hierro…): suelo, muros (liso, con puerta y con ventana) y escalera de tablas, tejado y
#     remate de tablillas, puerta de tablas, contraventana, trampilla, chimenea, adarve, polea, polipasto y los muebles
#     de tablas (mesa, banco, arcón, estantería, barril y cama de madera);
#   - levantadas, de cerca: una casa de tablas de 3 × 2 con su puerta, sus ventanas con contraventana, la chimenea y el
#     tejado de tablillas a dos aguas con sus remates; un armazón de postes y vigas con el suelo de tablas arriba, la
#     escalera de tablas, la trampilla, la polea y el polipasto; la empalizada con su puerta y el adarve detrás; y los
#     muebles de tablas sobre un cimiento de piedra;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_nivel2_navegador.py <html> <carpeta_capturas>
# Rota a propósito (20 nov): MUTAR=1 busca en el menú una pieza que no existe («Muro de tablas dobles»): falla.
import sys, os, json, shutil
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_nivel2'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
MOJON = (5, 7)
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# lo que tiene que salir en cada pestaña del menú: nombre → lo que tiene que pedir su coste
MENU = {
    'base': {'Suelo de tablas': ['tabla', 'clavo']},
    'estructura': {'Chimenea': ['piedra', 'barro']},
    'muro': {'Muro de tablas': ['tabla', 'clavo'], 'Muro de tablas con puerta': ['tabla', 'clavo'], 'Muro de tablas con ventana': ['tabla', 'clavo']},
    'tejado': {'Tejado de tablillas': ['tabla', 'clavo'], 'Remate de tablillas (esquina)': ['tabla', 'clavo']},
    'acceso': {'Escalera de tablas': ['tabla', 'clavo'], 'Puerta de tablas': ['tabla', 'clavo', 'hierro'], 'Contraventana': ['tabla', 'clavo'],
               'Trampilla': ['tabla', 'clavo'], 'Polea': ['tabla', 'cuerda', 'hierro'], 'Polipasto con torno': ['tabla', 'cuerda', 'hierro']},
    'exterior': {'Adarve': ['tabla', 'clavo', 'tronco']},
    'deco': {'Mesa': ['tabla', 'clavo'], 'Banco': ['tabla', 'clavo'], 'Arcón': ['tabla', 'clavo'], 'Estantería': ['tabla', 'clavo'],
             'Barril': ['tabla', 'hierro'], 'Cama de madera': ['tabla', 'clavo', 'paja']},
}
if MUTAR == '1': MENU['muro']['Muro de tablas dobles'] = ['tabla']

# Las obras, puestas por la lógica (Mundo.colocar, con su validación) y terminadas al momento (sin servidor).
ESCENA = f"""(() => {{
  const K = {K}, m = K.mundo, fallos = [];
  const H = {{ cim_piedra: 'f', suelo_tabla: 'f', poste: 'v', viga: 'b', muro_tabla: 'e', muro_tabla_puerta: 'e', muro_tabla_ventana: 'e',
    tejado_tablilla: 'r', remate_tablilla: 'r', puerta_tabla: 'p', contraventana: 'w', trampilla: 't', escalera_tabla: 'l', hogar: 'h',
    polea: 'q', polipasto: 'q', empalizada: 'e', empalizada_puerta: 'e', adarve: 'a' }};
  const casa = (ox, oz) => {{ const c = {{ id: m.siguienteId++, ox, oz, rot: 0, piezas: new Map() }}; m.construcciones.push(c); return c; }};
  const term = () => {{ for (const c2 of m.construcciones) for (const p of c2.piezas.values()) delete p.obra; }};
  const pon = (c, tipo, i, j, k, d = 0, dir = 0) => {{ const p = {{ tipo, hueco: H[tipo], i, j, k, dir, abierta: false }}; if (['e', 'b', 'p', 'q', 'w'].includes(H[tipo])) p.d = d;
    const r = m.colocar({{ construccion: c, nueva: false, pieza: p }}); if (!r.ok) fallos.push(`${{tipo}} ${{i}},${{j}},${{k}}: ${{r.motivo}}`); term(); }};
  for (const k in m.materiales) m.materiales[k] += 5000;
  // A: la casa de tablas, 3 × 2 casillas
  const A = casa(0, 0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pon(A, 'cim_piedra', i, j, 0);
  pon(A, 'muro_tabla', 0, 0, 0, 0); pon(A, 'muro_tabla_puerta', 1, 0, 0, 0); pon(A, 'muro_tabla_ventana', 2, 0, 0, 0);
  pon(A, 'muro_tabla', 0, 2, 0, 0); pon(A, 'muro_tabla_ventana', 1, 2, 0, 0); pon(A, 'muro_tabla', 2, 2, 0, 0);
  pon(A, 'muro_tabla', 0, 0, 0, 1); pon(A, 'muro_tabla', 0, 1, 0, 1); pon(A, 'muro_tabla_ventana', 3, 0, 0, 1); pon(A, 'muro_tabla', 3, 1, 0, 1);
  pon(A, 'puerta_tabla', 1, 0, 0, 0); pon(A, 'contraventana', 2, 0, 0, 0); pon(A, 'contraventana', 3, 0, 0, 1); pon(A, 'contraventana', 1, 2, 0, 0);
  pon(A, 'hogar', 0, 1, 0);
  for (let i = 0; i < 2; i++) {{ pon(A, 'tejado_tablilla', i, 0, 1, 0, 0); pon(A, 'tejado_tablilla', i, 1, 1, 0, 2); }}
  pon(A, 'remate_tablilla', 2, 0, 1, 0, 1); pon(A, 'remate_tablilla', 2, 1, 1, 0, 2);
  // C: postes y vigas, el suelo de tablas arriba, la escalera de tablas con su trampilla, la polea y el polipasto
  const C = casa(0, 10);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) pon(C, 'cim_piedra', i, j, 0);
  for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) pon(C, 'poste', a, b, 0);
  for (let i = 0; i < 2; i++) for (let j = 0; j <= 2; j++) pon(C, 'viga', i, j, 0, 0);
  for (let i = 0; i <= 2; i++) for (let j = 0; j < 2; j++) pon(C, 'viga', i, j, 0, 1);
  pon(C, 'suelo_tabla', 1, 0, 1); pon(C, 'suelo_tabla', 1, 1, 1); pon(C, 'suelo_tabla', 0, 1, 1);
  pon(C, 'escalera_tabla', 0, 0, 0, 0, 0); pon(C, 'trampilla', 0, 0, 1);
  pon(C, 'polea', 0, 0, 0, 0); pon(C, 'polipasto', 1, 2, 0, 0);
  // E: la empalizada con su puerta y el adarve detrás
  const E = casa(12, 0);
  for (let i = 0; i < 3; i++) pon(E, i === 1 ? 'empalizada_puerta' : 'empalizada', i, 0, 0, 0);
  pon(E, 'adarve', 0, 0, 0); pon(E, 'adarve', 2, 0, 0);
  // B: el cimiento de piedra con un muro de tablas detrás, para los muebles
  const B = casa(8, 8);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pon(B, 'cim_piedra', i, j, 0);
  for (let i = 0; i < 3; i++) pon(B, 'muro_tabla', i, 2, 0, 0);
  K.reconstruir();
  const tipos = [A, C, E, B].flatMap(c => [...c.piezas.values()].map(p => p.tipo));
  return {{ fallos, n: tipos.length, tipos: [...new Set(tipos)].sort() }};
}})()"""
NIVEL2 = ['suelo_tabla', 'muro_tabla', 'muro_tabla_puerta', 'muro_tabla_ventana', 'escalera_tabla', 'tejado_tablilla', 'remate_tablilla',
          'puerta_tabla', 'contraventana', 'trampilla', 'hogar', 'adarve', 'polea', 'polipasto']
MUEBLES = [('mesa', 10.2, 9.6), ('banco', 10.2, 10.9), ('arcon', 12.6, 9.3), ('estanteria', 13.0, 11.4), ('barril', 8.9, 11.2), ('cama_madera', 9.6, 8.9)]

def entrar(nav, vista, movil):
    ctx = nav.new_context(viewport=vista, locale='es-ES', **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if movil else {}))
    pg = ctx.new_page(); err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function(f'{K} !== undefined', timeout=60000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(2000)
    return ctx, pg, err

def mirar(pg, px, pz, yaw, pitch, dist, rot=0):
    pg.evaluate(f"(() => {{ const k = {K}; k.cambiarModo('mover'); Object.assign(k.pj, {{ x: {px}, z: {pz}, rot: {rot} }}); k.pj.y = k.alturaSuelo({px}, {pz}); k.cam.yaw = {yaw}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")
    pg.wait_for_timeout(2500)

def recorrido(nav, nombre, vista, movil):
    print(nombre)
    ctx, pg, err = entrar(nav, vista, movil)
    ev = pg.evaluate
    ev(f"{K}.llevarPara('mojon', 'mojon'); {K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon'); {K}.apuntar({MOJON[0]}, {MOJON[1]}); {K}.colocar()")
    comprobar(f'{nombre}: su mojón', ev(f'!!{K}.miMojon'))
    # ---- el menú: cada pieza y cada mueble de nivel 2, con su imagen y su coste ----
    ev(f"{K}.cambiarModo('mover'); {K}.cambiarModo('construir')"); pg.wait_for_timeout(1000)
    for cat, piden in MENU.items():
        pg.click(f'#pestanas button[data-cat="{cat}"]'); pg.wait_for_timeout(1500)
        lista = {}
        for paso in range(0, 9):   # (las de fuera se cargan al deslizar: poco a poco, que cada una pase por la vista)
            ev(f"(() => {{ const e = document.getElementById('piezas'); e.scrollLeft = e.scrollWidth * {paso} / 8; }})()"); pg.wait_for_timeout(600)
            for e in ev("[...document.querySelectorAll('#piezas button.pieza')].map(b => { const i = b.querySelector('img.pz-img'); return [b.querySelector('b').textContent, !!i && i.complete && i.naturalWidth > 0, [...b.querySelectorAll('.cc')].map(c => c.title).join(' ')]; })"):
                if e[1] or e[0] not in lista: lista[e[0]] = e
        for n, mats in piden.items():
            e = lista.get(n)
            comprobar(f'{nombre}: en «{cat}», {n} a la vista, con su imagen cargada', bool(e) and e[1], str(list(lista))[:300])
            comprobar(f'{nombre}:   y su coste pide {", ".join(mats)}', bool(e) and all(m in e[2] for m in mats), e[2] if e else '')
        if cat in ('muro', 'acceso', 'deco'):
            primera = list(piden)[0]
            ev(f"(() => {{ const b = [...document.querySelectorAll('#piezas button.pieza')].find(b => b.querySelector('b').textContent === {json.dumps(primera)}); if (b) b.scrollIntoView({{ inline: 'start', block: 'nearest' }}); }})()")
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_menu_{cat}.png', timeout=180000)
    # ---- levantadas ----
    r = ev(ESCENA)
    falta = [t for t in NIVEL2 if t not in r['tipos']]
    comprobar(f'{nombre}: la casa de tablas, el armazón con su suelo, la empalizada con el adarve y el cimiento de los muebles, levantados', not r['fallos'] and not falta,
              json.dumps({'fallos': r['fallos'][:4], 'falta': falta}, ensure_ascii=False))
    puestos = []
    for t, x, z in MUEBLES:
        ev(f"{K}.llevarPara('deco', '{t}'); {K}.cambiarModo('construir'); {K}.seleccionar('deco', '{t}'); {K}.apuntar({x}, {z}); {K}.colocar()")
        puestos = ev(f"{K}.mundo.decoracion.map(d => d.tipo)")
    comprobar(f'{nombre}: los seis muebles de tablas, puestos', sorted(puestos) == sorted(t for t, _, _ in MUEBLES), str(puestos))
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.9 if movil else 1   # (en el móvil, de pie, el cuadro es estrecho: más lejos)
    # con la cámara libre (la del admin), mirando a cada cosa desde (yaw, pitch, dist); el jugador, lejos (no tapa nada)
    vistas = [
        ('casa_tablas', 3.0, 1.6, 2.0, 3.55, 0.28, 10.5),     # de frente: la puerta, la ventana con su contraventana y el tejado de tablillas
        ('casa_puerta', 3.3, 1.2, 0.0, 3.35, 0.12, 4.2),      # de cerca: la puerta de tablas y la contraventana
        ('casa_remate', 6.0, 2.0, 2.0, 1.45, 0.3, 7.5),       # el lado de los remates de tablillas, con su ventana
        ('casa_chimenea', 1.0, 2.6, 3.0, -0.75, 0.35, 9.0),   # por detrás: la chimenea saliendo del tejado
        ('armazon', 2.0, 1.4, 11.0, 3.5, 0.28, 8.0),          # el armazón: la escalera de tablas, la polea y el suelo de tablas
        ('armazon_arriba', 2.0, 2.6, 12.0, 0.3, 0.95, 6.0),   # desde arriba: el suelo de tablas y la trampilla
        ('polipasto', 3.0, 1.6, 14.0, 0.2, 0.18, 4.5),        # el polipasto, en la viga de detrás
        ('adarve', 15.0, 1.6, 1.0, 0.2, 0.3, 8.5),            # la empalizada con su puerta y el adarve, por dentro
        ('adarve_lado', 13.0, 1.5, 1.0, -1.6, 0.2, 5.5),       # de lado: el adarve arrimado a la empalizada
        ('muebles', 11.0, 0.6, 10.2, 3.24, 0.55, 6.5),         # los muebles de tablas
        ('muebles_cerca', 11.0, 0.6, 10.2, 3.14, 0.32, 4.0),
    ]
    import math
    ev(f"(() => {{ const k = {K}; k.cambiarModo('mover'); Object.assign(k.pj, {{ x: -25, z: -25 }}); }})()")
    for n, tx, ty, tz, yaw, pitch, dist in vistas:
        dist *= D
        cx, cy, cz = tx + dist * math.sin(yaw) * math.cos(pitch), ty + dist * math.sin(pitch), tz + dist * math.cos(yaw) * math.cos(pitch)
        ev(f"(() => {{ const k = {K}; Object.assign(k.camLibre, {{ activa: true, x: {cx}, y: {cy}, z: {cz} }}); k.cam.yaw = {yaw}; k.cam.pitch = {pitch}; }})()")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_{n}.png', timeout=180000)
    ev(f"{K}.camLibre.activa = false")
    malos = [x for x in err if 'WebSocket' not in x and 'Failed to load resource' not in x]
    comprobar(f'{nombre}: sin errores en la página', not malos, str(malos[:3]))
    ctx.close()

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    recorrido(nav, 'PC', {'width': 1280, 'height': 800}, False)   # una cosa cada vez: el PC termina y se cierra
    if os.environ.get('SOLO') != 'PC': recorrido(nav, 'movil', {'width': 390, 'height': 844}, True)
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
