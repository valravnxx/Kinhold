# Prueba en navegador (Chromium sin pantalla) de las primeras herramientas de hierro (P10, 19 nov). En el mundo de
# verdad (Whitholm), sin servidor, primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - cada herramienta se ve en la mano: el hacha de hierro y el pico, empuñados en la mano derecha (cada uno con su
#     modelo: el pico no es el hacha); el mango y los clavos, con su modelo (no la bolsa ni el hatillo de lo que aún no
#     tiene); y el pico, colgado del cinto como el hacha;
#   - el mango, el pico, los clavos y el hacha de hierro, en el suelo;
#   - en el panel de fabricar, en la pestaña «Fragua», el hacha de hierro, el pico y los clavos; la ficha del hacha
#     pide la barra, el mango y el mazo de piedra; en la del banco de tronco, el mango; sin salirse de lado en el móvil;
#   - sin errores en la página.
# Capturas de cerca de cada cosa en la mano (de frente y de lado), del suelo y del panel, en PC y en móvil.
# Uso: python3 pruebas/prueba_herramientas_hierro_navegador.py <html> <carpeta_capturas>
# Rota a propósito (19 nov): MUTAR=1 dibuja lo hecho a mano y el pico como antes (la bolsa, el hatillo y el hacha):
# falla.
import sys, os, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_herramientas_hierro'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=180000)
    except Exception: pass
    pg.wait_for_timeout(1500)

C = lambda tipo, n=1, dentro=None: {'tipo': tipo, 'n': n, **({'dentro': dentro} if dentro is not None else {})}
def equipar(pg, lugares):
    pg.evaluate('''(l) => { const K = window.__kinhold, inv = K.inventario;
      for (const k of ['cintura', 'espalda', 'hombro', 'mano:der', 'mano:izq']) inv.lugares[k] = l[k] ? JSON.parse(JSON.stringify(l[k])) : null;
      K.vestir(); }''', lugares)
    pg.wait_for_timeout(700)

# lo que se ve en la mano derecha: la herramienta empuñada (la del personaje) o la pieza del llevado, y dónde está
VER = '''() => { const K = window.__kinhold, j = K.jugador; K.escena.updateMatrixWorld(true);
  const mano = j.mh.hueso.hand_r.getWorldPosition(j.raiz.position.clone());
  const centro = o => { const s = mano.clone().set(0, 0, 0), v = mano.clone(); let n = 0;
    o.traverse(m => { if (!m.isMesh || !m.visible) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 5) { s.add(v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); n++; } });
    return n ? s.divideScalar(n) : null; };
  const h = j.hacha && j.hacha.visible ? j.hacha : null, p = j.llevado.grupo.children.find(o => o.name === 'llevado_mano_r');
  const cinto = j.llevado.grupo.children.filter(o => o.name === 'llevado_hacha_colgada').map(o => { let n = ''; o.traverse(m => { if (['pico', 'hacha', 'hacha_piedra', 'mazo_piedra'].includes(m.name)) n = m.name; }); return n; });
  const ch = h && centro(h), cp = p && centro(p);
  return { empunada: h ? h.name : null, dEmpunada: ch ? +ch.distanceTo(mano).toFixed(3) : null, pieza: !!p, generico: p ? !!p.userData.generico : null, dPieza: cp ? +cp.distanceTo(mano).toFixed(3) : null, cinto }; }'''

def mirarMano(pg, giro, d, a):
    pg.evaluate('''([g, d, a]) => { const K = window.__kinhold; K.cam.dist = d; K.cam.pitch = a; K.cam.yaw = K.jugador.raiz.rotation.y + g; }''', [giro, d, a])
    pg.wait_for_timeout(900)

def mirar(pg, c, dx, dz, yaw, dist, pitch, lado=1.2):
    pg.evaluate(f"([x, z, yaw, d, p]) => {{ const k = {K}, px = x + Math.cos(yaw) * {lado}, pz = z - Math.sin(yaw) * {lado}; k.pj.x = px; k.pj.z = pz; k.pj.y = k.alturaSuelo(px, pz); k.pj.rot = Math.atan2(x - px, z - pz); k.cam.yaw = yaw; k.cam.dist = d; k.cam.pitch = p; }}", [c['x'] + dx, c['z'] + dz, yaw, dist, pitch])
    pg.wait_for_timeout(2500)

def recorrido(nav, nombre, pref, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    pg = ctx.new_page(); errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    if MUTAR: pg.add_init_script('globalThis.__sinModelosManos = true')
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo && {K}.jugador.mh', timeout=300000)
    esperar(pg, 3000)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.35 if movil else 1
    # en la mano: el hacha de hierro y el pico, empuñados; el mango y los clavos, con su modelo
    for t in ['hacha_hierro', 'pico', 'mango', 'clavo']:
        equipar(pg, {'cintura': C('cordel', 1, [None]), 'mano:der': C(t, 10 if t == 'clavo' else 1)})
        v = pg.evaluate(VER)
        if t in ('hacha_hierro', 'pico'):
            quiere = 'hacha' if t == 'hacha_hierro' else 'pico'
            comprobar(f'{nombre}: {t}, empuñado en la mano derecha con su modelo ({quiere})', v['empunada'] == quiere and v['dEmpunada'] is not None and v['dEmpunada'] < 0.6, str(v))
        else:
            comprobar(f'{nombre}: {t}, en la mano derecha con su modelo (no la bolsa ni el hatillo)', v['pieza'] and v['generico'] is False and v['dPieza'] is not None and v['dPieza'] < 0.35, str(v))
        for vista_, (g, d, a) in ({'frente': (0.45, 1.3, 0.12), 'lado': (1.3, 1.25, 0.12)} if not movil else {'frente': (0.45, 1.3 * D, 0.12)}).items():
            mirarMano(pg, g, d, a)
            pg.screenshot(path=f'{SALIDA}/{pref}_mano_{t}_{vista_}.png', timeout=180000)
    # el pico colgado del cinto, como el hacha
    equipar(pg, {'cintura': C('cinto_cuero', 1, [C('pico'), None, None])})
    v = pg.evaluate(VER)
    comprobar(f'{nombre}: el pico, colgado del cinto con su modelo', v['cinto'] == ['pico'], str(v))
    if not movil:
        mirarMano(pg, 1.6, 1.4, 0.15)
        pg.screenshot(path=f'{SALIDA}/{pref}_cinto_pico.png', timeout=180000)
    equipar(pg, {'cintura': C('cordel', 1, [None])})
    # en el suelo, de cerca
    c = pg.evaluate(f"(() => {{ const k = {K}; return {{ x: k.pj.x + 1.5, z: k.pj.z - 2.5 }}; }})()")
    pg.evaluate(f"(([x, z]) => {{ const k = {K}, s = k.sueloObjetos.suelo, a = Date.now(); s.dejar({{ tipo: 'mango', n: 3 }}, x - 0.45, z - 0.1, a, 'vista', false); s.dejar({{ tipo: 'pico', n: 1 }}, x + 0.4, z - 0.15, a, 'vista', false); s.dejar({{ tipo: 'clavo', n: 10 }}, x - 0.3, z + 0.4, a, 'vista', false); s.dejar({{ tipo: 'hacha_hierro', n: 1 }}, x + 0.35, z + 0.45, a, 'vista', false); k.sueloObjetos.refrescar(); }})", [c['x'], c['z']])
    n = pg.evaluate(f"{K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => ['mango', 'pico', 'clavo', 'hacha_hierro'].includes(o.cosa.tipo)).length")
    comprobar(f'{nombre}: el mango, el pico, los clavos y el hacha se dejan en el suelo', n == 4, str(n))
    # (la cámara sigue al jugador: se le pone en medio de lo dejado y se le esconde mientras se mira el suelo)
    pg.evaluate(f'{K}.jugador.raiz.visible = false')
    mirar(pg, c, 0, 0.15, 0.5, 2.0 * D, 0.95, 0)
    pg.screenshot(path=f'{SALIDA}/{pref}_suelo.png', timeout=180000)
    if not movil:
        mirar(pg, c, -0.3, 0.4, 0.5, 0.75, 1.0, 0)
        pg.screenshot(path=f'{SALIDA}/{pref}_suelo_clavos.png', timeout=180000)
    pg.evaluate(f'{K}.jugador.raiz.visible = true')
    # el panel: la fragua y el banco de tronco, puestos al lado
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"""(() => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x + 2, z0 = k.pj.z - 4;
      f.estaciones['fragua:vista'] = {{ id: 'fragua:vista', tipo: 'fragua', x: x0, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ barra_hierro: 1, mango: 1 }}, fuego: {{ hasta: Date.now() + 600000, combustible: 0, cenizas: false }} }};
      f.estaciones['banco:vista'] = {{ id: 'banco:vista', tipo: 'banco_tronco', x: x0 + 2.5, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ vara: 1 }} }};
      k.estacionesV.refrescar(); k.pj.x = x0 + 0.3; k.pj.z = z0 + 1.3; k.inventario.meterDonde('mazo_piedra', 1); }})()""")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('fragua:vista')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: en la pestaña «Fragua», el hacha de hierro, el pico y los clavos', all(x in texto for x in ['Hacha de hierro', 'Pico', 'Clavos']), texto[:300])
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_fragua.png', timeout=180000)
    sel = '#panelFabricar .fab-carta[data-fila="hacha_hierro"]'
    pg.tap(sel) if movil else pg.click(sel)
    pg.wait_for_timeout(800)
    ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha del hacha pide la barra, el mango y el mazo de piedra', re.search('barra', ficha, re.I) and re.search('mango', ficha, re.I) and re.search('mazo', ficha, re.I), ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_hacha_ficha.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
    pg.evaluate(f"(() => {{ const k = {K}, e = k.fabCliente.estaciones['banco:vista']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.3; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('banco:vista')"); pg.wait_for_timeout(1200)
    sel = '#panelFabricar .fab-carta[data-fila="mango"]'
    hay = pg.evaluate(f"!!document.querySelector('{sel}')")
    comprobar(f'{nombre}: en el banco de tronco, el mango de herramienta', hay)
    if hay:
        pg.tap(sel) if movil else pg.click(sel)
        pg.wait_for_timeout(800)
        ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
        comprobar(f'{nombre}: la ficha del mango pide 1 vara', re.search('vara', ficha, re.I), ficha[:300])
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{SALIDA}/{pref}_panel_mango.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
    comprobar(f'{nombre}: sin errores en la página', not errores, str(errores[:3]))
    ctx.close()

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    recorrido(nav, 'PC', 'PC', {'width': 1280, 'height': 800}, False)   # una cosa cada vez: el PC termina y se cierra
    if os.environ.get('SOLO') != 'PC': recorrido(nav, 'móvil', 'movil', {'width': 390, 'height': 844}, True)
    nav.close()
srv.shutdown()
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
