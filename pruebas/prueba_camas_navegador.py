# Prueba en navegador de la cama ligada (P4; valravnx, 8 nov: «ambas viables»): el refugio de ramas, fuera, y la cama
# de juncos, dentro de la casa.
# Uso: python3 pruebas/prueba_camas_navegador.py <html de la demo> <carpeta_capturas>
# Sin servidor (?sinservidor=1&llano=1, como las otras de construir): su mojón y una casa de 3×3 con muros de troncos (uno
# con puerta) y tejado. En PC (1280×800) y en el móvil (390×844): en el menú de construir, la pestaña «Camas» con las
# dos; el refugio no se pone dentro y la cama de juncos no se pone fuera; levantados, con Usar delante del refugio se
# liga y, otra vez, se duerme en él (tumbado); al moverse se levanta. Luego la cama de juncos, ligada: el refugio deja
# de ser su cama. Capturas de cerca de las dos y del personaje dormido.
# La lógica (ligar una por personaje, dormir, en tierra de otro) y el servidor, en pruebas/prueba_fabricacion.mjs, y el
# recorrido de jugador (paso 17), en pruebas/prueba_recorrido.mjs.
# MUTAR=1: ligar la cama no hace nada (como si no existiera): la prueba tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_camas'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
OX, OZ = 4, -3   # la esquina de la casa
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

CASA = f"""(() => {{
  const K = {K}, m = K.mundo;
  const c = {{ id: m.siguienteId++, ox: {OX}, oz: {OZ}, rot: 0, piezas: new Map() }}; m.construcciones.push(c);
  const H = {{ cim_tronco: 'f', muro_tronco: 'e', muro_tronco_puerta: 'e', tejado_paja: 'r' }}, fallos = [];
  const pon = (tipo, i, j, k, d = 0, dir = 0) => {{ const p = {{ tipo, hueco: H[tipo], i, j, k, dir, abierta: false }}; if (H[tipo] === 'e') p.d = d;
    const r = m.colocar({{ construccion: c, nueva: false, pieza: p }}); if (!r.ok) fallos.push(`${{tipo}} ${{i}},${{j}},${{k}}: ${{r.motivo}}`); }};
  for (const k in m.materiales) m.materiales[k] += 500;
  const N = 3, celdas = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) celdas.push([i, j]);
  for (const [i, j] of celdas) pon('cim_tronco', i, j, 0);
  for (let i = 0; i < N; i++) {{ pon(i === 1 ? 'muro_tronco_puerta' : 'muro_tronco', i, 0, 0, 0); pon('muro_tronco', i, N, 0, 0); }}
  for (let j = 0; j < N; j++) {{ pon('muro_tronco', 0, j, 0, 1); pon('muro_tronco', N, j, 0, 1); }}
  for (const [i, j] of celdas) pon('tejado_paja', i, j, 1, 0, j < 1 ? 0 : j > 1 ? 2 : 0);
  for (const c2 of m.construcciones) for (const p of c2.piezas.values()) delete p.obra;
  K.reconstruir();
  return {{ fallos, n: c.piezas.size }};
}})()"""

def entrar(nav, vista, movil):
    pg = nav.new_page(viewport=vista, locale='es-ES', **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if movil else {}))
    err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function(f'{K} !== undefined', timeout=30000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(800)
    return pg, err

def poner(pg, tipo, x, z, colocar=False):
    ev = pg.evaluate
    # el puntero, a la altura del suelo que pisa ahí (el de la casa, dentro; como al apuntar con el ratón al suelo)
    ev(f"(() => {{ const K = {K}; K.cambiarModo('mover'); K.camLibre.activa = false; Object.assign(K.pj, {{ x: {x}, z: {z} }}); }})()"); pg.wait_for_timeout(700)
    ev(f"(() => {{ const K = {K}, y = K.pj.y; K.cambiarModo('construir'); Object.assign(K.pj, {{ x: {x} - 1.2, z: {z} }}); K.estado.planta = 0; K.seleccionar('puesto', '{tipo}'); K.apuntar({x}, {z}, y); }})()")
    c = ev(f"(() => {{ const c = {K}.estado.candidato; return c ? {{ ok: c.v.ok, motivo: c.v.motivo || '', x: c.x, z: c.z }} : null; }})()")
    if colocar: ev(f"{K}.colocar()")
    return c

def levantar(pg, tipo):
    return pg.evaluate(f"""(() => {{ const K = {K}, e = Object.values(K.fabCliente.estaciones).find(x => x.tipo === '{tipo}');
      if (!e) return null; delete e.obra; K.estacionesV.poner(Object.values(K.fabCliente.estaciones)); return {{ id: e.id, x: e.x, z: e.z, giro: e.giro || 0 }}; }})()""")

def hacia(cx, cz, tx, tz):   # el giro de la cámara para mirar de (cx, cz) a (tx, tz)
    return math.atan2(cx - tx, cz - tz)

def mirar(pg, x, y, z, yaw, pitch, lejos=None):
    pg.evaluate(f"(() => {{ const K = {K}; K.cambiarModo('mover'); {('Object.assign(K.pj, { x: %s, z: %s });' % lejos) if lejos else ''} Object.assign(K.camLibre, {{ activa: true, x: {x}, y: {y}, z: {z} }}); K.cam.yaw = {yaw}; K.cam.pitch = {pitch}; }})()")
    pg.wait_for_timeout(2500)

def usar_delante(pg, e):
    ev = pg.evaluate
    ev(f"(() => {{ const K = {K}; K.camLibre.activa = false; K.cambiarModo('mover'); Object.assign(K.pj, {{ x: {e['x']} - 1.1, z: {e['z']} }}); }})()")
    pg.wait_for_timeout(300)
    ev(f"{K}.usar()"); pg.wait_for_timeout(500)
    return ev("(() => { const a = document.getElementById('aviso'); return a.hidden ? '' : a.textContent; })()")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('PC', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print(f'{nombre}: el refugio de ramas y la cama de juncos')
        pg, err = entrar(nav, vista, movil)
        ev = pg.evaluate
        if MUTAR: ev(f"{K}.fabCliente.ligarCama = () => ({{ ok: false, motivo: 'roto a propósito' }})")
        ev(f"{K}.llevarPara('mojon', 'mojon'); {K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon'); {K}.apuntar({OX - 3}, {OZ - 3}); {K}.colocar()")
        comprobar(f'{nombre}: su mojón (su tierra)', ev(f'!!{K}.miMojon'))
        r = ev(CASA)
        comprobar(f'{nombre}: la casa de 3×3 con muros y tejado', not r['fallos'], json.dumps(r, ensure_ascii=False)[:200])
        # el menú de construir: la pestaña de las camas, con las dos
        ev(f"{K}.cambiarModo('construir')"); pg.wait_for_timeout(300)
        pg.click('#pestanas button[data-cat="camas"]'); pg.wait_for_timeout(400)
        txt = pg.inner_text('#piezas')
        comprobar(f'{nombre}: en construir, la pestaña «Camas» con el refugio de ramas y la cama de juncos', 'Refugio de ramas' in txt and 'Cama de juncos' in txt and 'Hoguera' not in txt, txt[:160])
        comprobar(f'{nombre}: el menú no se sale de lado', ev("document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.screenshot(path=f'{SALIDA}/{nombre}_menu_camas.png')
        dentro = poner(pg, 'refugio_ramas', OX + 1.5, OZ + 3)
        comprobar(f'{nombre}: el refugio, dentro de la casa no', dentro and not dentro['ok'], json.dumps(dentro, ensure_ascii=False))
        fuera = poner(pg, 'cama_juncos', OX + 9, OZ + 3)
        comprobar(f'{nombre}: la cama de juncos, fuera no', fuera and not fuera['ok'], json.dumps(fuera, ensure_ascii=False))
        a = poner(pg, 'refugio_ramas', OX + 9, OZ + 3, True)
        b = poner(pg, 'cama_juncos', OX + 1.6, OZ + 3.2, True)
        comprobar(f'{nombre}: el refugio fuera y la cama dentro, sí', a and a['ok'] and b and b['ok'], json.dumps([a, b], ensure_ascii=False))
        ref = levantar(pg, 'refugio_ramas'); cama = levantar(pg, 'cama_juncos')
        pg.wait_for_timeout(600)
        # de cerca: el refugio (de frente, a la boca) y la cama (desde la puerta)
        cx, cz = ref['x'] - 0.5, ref['z'] + (4.8 if movil else 3.4)
        mirar(pg, cx, 1.5, cz, hacia(cx, cz, ref['x'], ref['z']), 0.2, (OX - 6, OZ - 6))
        pg.screenshot(path=f'{SALIDA}/{nombre}_refugio_ramas.png')
        cx, cz = ref['x'] + (3.6 if movil else 2.8), ref['z'] - 1.4
        mirar(pg, cx, 1.1, cz, hacia(cx, cz, ref['x'], ref['z'] - 0.3), 0.15, (OX - 6, OZ - 6))
        pg.screenshot(path=f'{SALIDA}/{nombre}_refugio_ramas_lado.png')
        cx, cz = OX + 3.2, OZ + (1.4 if movil else 1.9)
        mirar(pg, cx, 1.35, cz, hacia(cx, cz, cama['x'], cama['z']), 0.42, (OX - 6, OZ - 6))
        pg.screenshot(path=f'{SALIDA}/{nombre}_cama_juncos.png')
        # Usar delante del refugio: lo liga; otra vez, duerme en él
        av = usar_delante(pg, ref)
        mio = ev(f"(Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'refugio_ramas').ligadas || []).length")
        comprobar(f'{nombre}: con Usar delante del refugio, lo liga', mio == 1 and 'tu cama' in av, av)
        # en línea las estaciones llegan del servidor (estacionesV.poner): quién la tiene ligada tiene que llegar también
        ev(f"{K}.estacionesV.poner(JSON.parse(JSON.stringify(Object.values({K}.fabCliente.estaciones))))")
        comprobar(f'{nombre}: lo ligado sigue al volver a ponerle las estaciones (como llegan del servidor)', ev(f"(Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'refugio_ramas').ligadas || []).length") == 1)
        av = usar_delante(pg, ref)
        pg.wait_for_timeout(2500)
        dorm = ev(f"({{ d: !!{K}.estado.durmiendo, j: {K}.jugador.durmiendo, modo: {K}.jugador.modo, x: {K}.pj.x, z: {K}.pj.z }})")
        comprobar(f'{nombre}: otra vez Usar: duerme en él, tumbado sobre su lecho (al fondo del refugio)', dorm['d'] and dorm['modo'] in ('tumbarse', 'dormido') and abs(math.hypot(dorm['x'] - ref['x'], dorm['z'] - ref['z']) - 0.45) < 0.01, json.dumps(dorm) + ' ' + av)
        ev(f"(() => {{ const m = {K}.jugador.mh; if (m) m.mezclador.update(6); }})()"); pg.wait_for_timeout(1500); ev(f"(() => {{ const m = {K}.jugador.mh; if (m) m.mezclador.update(1); }})()")   # (con swiftshader va a 1-3 fps: que acabe de tumbarse)
        cx, cz = ref['x'] - 0.4, ref['z'] + (4.2 if movil else 3.0)
        mirar(pg, cx, 1.35, cz, hacia(cx, cz, ref['x'], ref['z']), 0.25)
        pg.screenshot(path=f'{SALIDA}/{nombre}_dormido_refugio.png')
        comprobar(f'{nombre}: tumbado del todo, con la de dormir (los brazos a lo largo del cuerpo)', ev(f"{K}.jugador.modo") == 'dormido', ev(f"{K}.jugador.modo"))
        ev(f"{K}.camLibre.activa = false")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_dormido_juego.png')
        # al moverse se levanta
        pg.keyboard.down('KeyW') if not movil else None
        if movil: ev(f"{K}.estado.durmiendo && (window.dispatchEvent(new KeyboardEvent('keydown', {{ code: 'KeyW' }})))")
        pg.wait_for_timeout(400)
        pg.keyboard.up('KeyW') if not movil else ev("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))")
        pg.wait_for_timeout(300)
        des = ev(f"({{ d: !!{K}.estado.durmiendo, modo: {K}.jugador.modo }})")
        comprobar(f'{nombre}: al moverse se levanta', not des['d'] and des['modo'] not in ('tumbarse', 'dormido'), json.dumps(des))
        # la cama de juncos: ligada, el refugio deja de ser su cama
        av = usar_delante(pg, cama)
        lig = ev(f"Object.values({K}.fabCliente.estaciones).map(x => [x.tipo, (x.ligadas || []).length])")
        usar_delante(pg, cama); ev(f"(() => {{ const m = {K}.jugador.mh; if (m) m.mezclador.update(6); }})()"); pg.wait_for_timeout(1500); ev(f"(() => {{ const m = {K}.jugador.mh; if (m) m.mezclador.update(1); }})()")
        cx, cz = OX + 3.4, OZ + (0.9 if movil else 1.9)
        mirar(pg, cx, 1.9 if movil else 1.35, cz, hacia(cx, cz, cama['x'], cama['z']), 0.55 if movil else 0.42)
        pg.screenshot(path=f'{SALIDA}/{nombre}_dormido_cama_juncos.png')
        pesos = ev(f"(() => {{ const a = {K}.jugador.mh.acciones; return Object.fromEntries(['tumbarse', 'dormido', 'levantarse', 'quieto'].map(k => [k, +a[k].getEffectiveWeight().toFixed(2)])); }})()")
        comprobar(f'{nombre}: dormido en la cama de juncos, encima del colchón y con la de dormir', ev(f"!!{K}.estado.durmiendo && {K}.pj.y > 0.05") and ev(f"{K}.jugador.modo") == 'dormido', f"y {ev(f'{K}.pj.y')} · {ev(f'{K}.jugador.modo')} · {pesos}")
        comprobar(f'{nombre}: liga la cama de juncos y el refugio deja de ser su cama', ['cama_juncos', 1] in lig and ['refugio_ramas', 0] in lig, json.dumps(lig) + ' ' + av)
        malos = [e for e in err if 'WebSocket' not in e]
        comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        pg.close()
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
