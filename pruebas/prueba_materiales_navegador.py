# Prueba en navegador (Chromium sin pantalla) de de dónde salen el mimbre, la corteza y la resina (tarea del hito
# crafting, 8 nov). En el mundo de verdad (Whitholm), sin servidor, en PC (1280×800) y móvil (390×844):
#   - en la ribera del río de cerca de la salida hay mimbreras, y junto a una se ven su cepa y sus varas;
#   - con la lasca de sílex, Usar corta sus varas: un haz de mimbre; las varas se van y la cepa se queda;
#   - junto a un árbol, sin hacha en la mano y con la lasca, Usar lo descorteza (1 o 2 cortezas) y el menú ya no lo ofrece;
#   - (oficios, 17 nov) el roble da corteza de roble; en el suelo, al lado de la corteza, de cerca; y con el cubo lleno en
#     la mano, el menú del clic derecho ofrece «Vaciar el cubo» y al elegirlo queda vacío;
#   - (oficios, 17 nov) las cubas de curtido, delante, con una piel en remojo: con el cubo lleno en la mano, Usar echa su
#     agua en ellas (el cubo queda vacío); se ven de lejos y de cerca, curtiendo y con lo curtido, y su pestaña del panel
#     de fabricar tiene el cuero (1 piel limpia, 2 cortezas de roble y agua; dos días);
#   - junto a un pino (a unos 4 km), Usar le hace el corte; cuando la resina está lista, Usar la coge (1 resina);
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_materiales_navegador.py <html> <carpeta_capturas>
# Rota a propósito (8 nov): MUTAR=1 deja las varas de la mimbrera siempre puestas (como si no se cortaran): falla.
# MUTAR=2 (17 nov): las cubas no se llenan (Usar con el cubo lleno no les echa el agua): falla.
# MUTAR=3 (17 nov): las cubas no despejan la hierba (como __sinDespejarEras): falla.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_materiales'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=184596,46280&lang=es'   # (la salida en línea: las coordenadas de abajo son de su escena)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
MIMBRERA = (-12, -850)   # (escena) la mimbrera más cercana a la salida, en la ribera del río del sur (mirado con la lógica)
PINAR = (2854, 3070)     # (escena) un sitio con pinos o abetos: los más cercanos a la salida
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    for cond in [f'{K}.decorado.pendientes === 0', f'{K}.recoleccion.listo']:
        try: pg.wait_for_function(cond, timeout=180000)
        except Exception: pass
    pg.wait_for_timeout(1500)

def ir(pg, x, z):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [x, z])
    esperar(pg, 4000)

def mirar(pg, x, z, d=3.2, pitch=0.35, yaw=0.6):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 1.1; k.pj.z = z + 0.4; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); k.cam.dist = {d}; k.cam.pitch = {pitch}; k.cam.yaw = {yaw}; }}', [x, z])
    pg.wait_for_timeout(2500)

def poner_lasca(pg):
    pg.evaluate(f"(() => {{ const k = {K}, inv = k.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l); inv.coger('lasca_silex', 1, 'mano:izq'); k.pintarTodoInventario(); }})()")

VIS_MIMBRE = f"(id) => {{ const k = {K}, rec = k.recoleccion, lista = rec.puntos.filter(p => p.tipo === 'mimbre'), i = lista.findIndex(p => p.id === id), m = new k.camara.matrixWorld.constructor(); const r = {{}}; rec.grupo.children.filter(c => c.name.startsWith('recoger_mimbre')).forEach(c => {{ c.getMatrixAt(i, m); r[c.name] = Math.abs(m.determinant()) > 1e-12; }}); return r; }}"

# (oficios, 17 nov) las cubas de curtido, puestas delante (ya cavadas), con piel limpia y corteza de roble dejadas
def cubas(pg, nombre, pref):
    # un sitio despejado de prado (sin árboles, rocas ni matas a 3,5 m, y lo más alto de alrededor: lejos del río)
    pg.evaluate(f"""(() => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x, z0 = k.pj.z; let mejor = null;
      for (let r = 6; r <= 24; r += 3) for (let a = 0; a < 6.28; a += 0.4) {{
        const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, h = k.alturaSuelo(x, z);
        if (!Number.isFinite(h) || k.obstaculos.some(o => Math.hypot(o.x - x, o.z - z) < 3.5 + (o.r || 0))) continue;
        const llano = Math.abs(k.alturaSuelo(x + 1, z) - h) + Math.abs(k.alturaSuelo(x, z + 1) - h);
        if (llano > 0.25) continue;
        if (!mejor || h > mejor.h) mejor = {{ x, z, h }};
      }}
      const x = mejor ? mejor.x : x0 + 8, z = mejor ? mejor.z : z0;
      f.estaciones['cubas_curtido:vista'] = {{ id: 'cubas_curtido:vista', tipo: 'cubas_curtido', x, z, giro: 0.4, autor: 'jugador:local', cola: [], deposito: {{ piel_limpia: 1, corteza_roble: 2 }} }};
      if ({'true' if MUTAR == '2' else 'false'}) f.estaciones['cubas_curtido:vista'].tipo = 'hoyo_barro';
      if ({'true' if MUTAR == '3' else 'false'}) window.__sinDespejarEras = true;
      k.estacionesV.refrescar(); k.mirarEras(); k.pj.x = x + 1.3; k.pj.z = z + 0.2; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z);
      const inv = k.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l); inv.coger('cubo_agua', 1, 'mano:der'); k.pintarTodoInventario(); }})()""")
    esperar(pg, 2000)
    comprobar(f'{nombre}: las cubas de curtido se dibujan', pg.evaluate(f"!!{K}.escena.getObjectByName('estacion_cubas_curtido')"))
    comprobar(f'{nombre}: y sin hierba que asome en el agua ni en la tierra sacada (las cubas despejan la hierba densa)', pg.evaluate(f"(() => {{ const e = {K}.fabCliente.estaciones['cubas_curtido:vista']; return {K}.erasDespejadas().some(c => Math.hypot(c[0] - e.x, c[1] - e.z) < 0.01 && c[2] >= 0.9); }})()"))
    ops = pg.evaluate(f"{K}.opcionesUsar()")
    comprobar(f'{nombre}: delante de las cubas, con el cubo lleno, el menú ofrece echarles el agua', 'Echar el agua del cubo en las cubas' in ops, str(ops))
    pg.keyboard.press('f'); pg.wait_for_timeout(1200)
    r = pg.evaluate(f"(() => {{ const k = {K}, e = k.fabCliente.estaciones['cubas_curtido:vista'], l = k.inventario.lugares['mano:der']; return {{ agua: e.deposito.agua || 0, mano: l ? l.tipo : null }}; }})()")
    comprobar(f'{nombre}: Usar echa el agua del cubo en las cubas: el cubo, vacío; las cubas, con agua', r['agua'] == 1 and r['mano'] == 'cubo', str(r))
    # que se vea lo que se curte (en línea lo manda el servidor: colgado): una curtida y otra en remojo
    pg.evaluate(f"""(() => {{ const k = {K}, e = k.fabCliente.estaciones['cubas_curtido:vista'], ahora = Date.now(), inv = k.inventario;
      if (inv.lugares['mano:der']) inv.sacar('mano:der'); k.pintarTodoInventario();
      e.colgado = [{{ hasta: ahora + 40 * 3600e3 }}, {{ hasta: ahora - 1000 }}]; k.estacionesV.refrescar(); }})()""")
    e = pg.evaluate(f"(() => {{ const e = {K}.fabCliente.estaciones['cubas_curtido:vista']; return {{ x: e.x, z: e.z }}; }})()")
    # (sin tarjeta gráfica, la hierba densa tarda en rehacerse sin lo que tapan las cubas: se espera a que acabe)
    esperar_hierba = f"!{K}.hierbaDensa || !{K}.hierbaDensa.activa || {K}.hierbaDensa.porRehacer === 0"
    # el jugador a un lado de las cubas y la cámara detrás de él, de través (que no las tape); en el móvil, la pantalla
    # es estrecha y de lado no caben: las cubas delante del jugador, en la línea de la cámara (yaw 0,6), y la cámara alta,
    # para que se vean por encima de él
    vistas = [('cubas', 1.9, 1.0, 4.2, 0.55), ('cubas_cerca', 1.6, 0.8, 2.6, 0.6)] if pref == 'pc' else [('cubas', 1.35, 1.98, 4.4, 0.8), ('cubas_cerca', 1.19, 1.73, 2.8, 1.0)]
    for (cual, dx, dz, dist, pitch) in vistas:
        pg.evaluate(f"""(() => {{ const k = {K}, e = k.fabCliente.estaciones['cubas_curtido:vista']; k.pj.x = e.x + {dx}; k.pj.z = e.z + {dz}; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z);
          k.pj.rot = Math.atan2(e.x - k.pj.x, e.z - k.pj.z); k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = 0.6; }})()""")
        pg.wait_for_timeout(2500)
        try: pg.wait_for_function(esperar_hierba, timeout=90000, polling=500)
        except Exception: pass
        pg.screenshot(path=f'{SALIDA}/{pref}_2d_{cual}.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('cubas_curtido:vista')"); pg.wait_for_timeout(1200)
    pg.add_style_tag(content='#panelFabricar:not([hidden]), #panelFabricar:not([hidden]) * { visibility: visible !important; }')
    t = pg.evaluate("document.getElementById('panelFabricar').innerText")
    pest = pg.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"curtir\"]')")
    comprobar(f'{nombre}: su pestaña «Cubas de curtido», con el cuero y lo que tiene dentro', pest and 'Cuero' in t and 'Dentro de las cubas de curtido' in t, t[:300])
    pg.screenshot(path=f'{SALIDA}/{pref}_2e_panel_cubas.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()"); pg.wait_for_timeout(300)

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    # la mimbrera
    ir(pg, MIMBRERA[0] + 3, MIMBRERA[1])
    try: pg.wait_for_function(f"{K}.recoleccion.puntos.some(p => p.tipo === 'mimbre' && Math.hypot(p.x - ({MIMBRERA[0]}), p.z - ({MIMBRERA[1]})) < 3)", timeout=240000)
    except Exception: pass
    m = pg.evaluate(f"(() => {{ const k = {K}, l = k.recoleccion.puntos.filter(p => p.tipo === 'mimbre').sort((a, b) => Math.hypot(a.x - {MIMBRERA[0]}, a.z - {MIMBRERA[1]}) - Math.hypot(b.x - {MIMBRERA[0]}, b.z - {MIMBRERA[1]})); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()")
    comprobar(f'{nombre}: en la ribera del río del sur hay una mimbrera', bool(m) and abs(m['x'] - MIMBRERA[0]) < 3, str(m))
    if not m: return
    if MUTAR == '1': pg.evaluate(f"{K}.recoleccion.grupo.children.filter(c => c.name === 'recoger_mimbre').forEach(c => c.name = 'recoger_mimbre_planta')")
    mirar(pg, m['x'], m['z'])
    antes = pg.evaluate(VIS_MIMBRE, m['id'])
    comprobar(f'{nombre}: se ven su cepa y sus varas', antes.get('recoger_mimbre_planta') and antes.get('recoger_mimbre'), str(antes))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_mimbrera.png', timeout=180000)
    poner_lasca(pg)
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.5; k.pj.z = z + 0.2; }}', [m['x'], m['z']]); pg.wait_for_timeout(600)
    pg.keyboard.press('f'); pg.wait_for_timeout(2500)
    despues = pg.evaluate(VIS_MIMBRE, m['id'])
    n = pg.evaluate(f"{K}.inventario.cuantos('mimbre')")
    comprobar(f'{nombre}: con la lasca, Usar corta sus varas: un haz de mimbre', n == 1, f'{n}')
    comprobar(f'{nombre}: las varas se van y la cepa se queda', despues.get('recoger_mimbre_planta') and not despues.get('recoger_mimbre'), str(despues))
    mirar(pg, m['x'], m['z'])
    pg.screenshot(path=f'{SALIDA}/{pref}_2_mimbrera_cortada.png', timeout=180000)
    # un árbol de cerca: se descorteza
    poner_lasca(pg)
    a = pg.evaluate(f"(() => {{ const k = {K}; const l = k.obstaculos.filter(o => o.arbol && k.talaV.enPie(o)).sort((p, q) => Math.hypot(p.x - k.pj.x, p.z - k.pj.z) - Math.hypot(q.x - k.pj.x, q.z - k.pj.z)); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, r: l[0].r, especie: l[0].especie }} : null; }})()")
    comprobar(f'{nombre}: hay un árbol cerca', bool(a), str(a))
    if a:
        pg.evaluate(f'([x, z, r]) => {{ const k = {K}; k.pj.x = x + r + 0.5; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }}', [a['x'], a['z'], a['r']]); pg.wait_for_timeout(800)
        pg.keyboard.press('f'); pg.wait_for_timeout(2000)
        ct = 'corteza_roble' if a['especie'] == 'roble' else 'corteza'   # (17 nov: el roble da corteza de roble)
        c = pg.evaluate(f"{K}.inventario.cuantos('{ct}')")
        comprobar(f'{nombre}: sin hacha y con la lasca, Usar descorteza el {a["especie"]} (1 o 2 de {ct})', 1 <= c <= 2, f'{c}')
        comprobar(f'{nombre}: y ya no se ofrece descortezarlo', not pg.evaluate(f"{K}.talaV.usos({K}.arbolCercano()).descortezar"))
    # (oficios, 17 nov) la corteza de roble y la de las demás, en el suelo una al lado de la otra, de cerca: delante
    # del jugador según mira la cámara, las dos a su izquierda (que no las tape), un paso atrás de las rocas de la orilla
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.dist = 2.0; k.cam.pitch = 0.7; }})()"); pg.wait_for_timeout(1500)
    lado = 0.8 if pref == 'pc' else 0.4   # (en el móvil, la pantalla es estrecha: más cerca de delante)
    pg.evaluate(f"""(() => {{ const k = {K}, s = k.sueloObjetos, t = Date.now(), inv = k.inventario, lado = {lado}; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l);
      let dx = k.pj.x - k.camara.position.x, dz = k.pj.z - k.camara.position.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      k.pj.x -= dx * 1.8; k.pj.z -= dz * 1.8; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z);   // (un paso atrás, hacia donde estaba la cámara: fuera de las rocas de la orilla)
      s.suelo.dejar({{ tipo: 'corteza_roble', n: 2 }}, k.pj.x + dx * 0.6 + dz * lado, k.pj.z + dz * 0.6 - dx * lado, t, 'jugador:local', false);
      s.suelo.dejar({{ tipo: 'corteza', n: 2 }}, k.pj.x + dx * 1.3 + dz * lado, k.pj.z + dz * 1.3 - dx * lado, t, 'jugador:local', false); s.refrescar(); }})()""")
    pg.wait_for_timeout(800)
    sc = pg.evaluate(f"(() => {{ const k = {K}, o = k.sueloObjetos.suelo.objetos.filter(o => ['corteza', 'corteza_roble'].includes(o.cosa.tipo) && Math.hypot(o.x - k.pj.x, o.z - k.pj.z) < 2); return o.map(o => ({{ t: o.cosa.tipo, x: o.x, z: o.z }})); }})()")
    comprobar(f'{nombre}: la corteza de roble y la corteza, en el suelo', {o['t'] for o in sc} == {'corteza', 'corteza_roble'}, str(sc))
    comprobar(f'{nombre}: y se ven', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_corteza_roble') && !!{K}.escena.getObjectByName('suelo_corteza')"))
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SALIDA}/{pref}_2b_corteza_de_roble.png', timeout=180000)
    # (oficios, 17 nov) el cubo lleno en la mano: el menú del clic derecho ofrece vaciarlo, y vaciado queda vacío
    pg.evaluate(f"(() => {{ const k = {K}, inv = k.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l); inv.coger('cubo_agua', 1, 'mano:der'); k.pintarTodoInventario(); }})()")
    pg.wait_for_timeout(600)
    ops = pg.evaluate(f"{K}.opcionesUsar()")
    comprobar(f'{nombre}: con el cubo lleno en la mano, el menú ofrece «Vaciar el cubo»', 'Vaciar el cubo' in ops, str(ops))
    pt = pg.evaluate(f"""(() => {{ const k = {K}, v = new k.camara.position.constructor(k.pj.x, k.alturaSuelo(k.pj.x, k.pj.z) + 0.2, k.pj.z).project(k.camara);
      return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }})()""")
    pg.evaluate(f"{K}.abrirMenuUsar({pt[0]}, {pt[1]})"); pg.wait_for_timeout(500)
    menu = pg.evaluate(f"{K}.menuUsar()") or []
    comprobar(f'{nombre}: y sale en el menú, junto a ti', any('Vaciar el cubo' in m for m in menu), str(menu))
    pg.add_style_tag(content='#menuUsar:not([hidden]), #menuUsar:not([hidden]) * { visibility: visible !important; }')   # (el menú se ve en la captura)
    pg.screenshot(path=f'{SALIDA}/{pref}_2c_menu_vaciar_cubo.png', timeout=180000)
    pg.evaluate("(() => { const b = [...document.querySelectorAll('#menuUsar button')].find(b => /Vaciar el cubo/.test(b.textContent)); if (b) b.click(); })()")
    pg.wait_for_timeout(800)
    t = pg.evaluate(f"(() => {{ const l = {K}.inventario.lugares; return l['mano:der'] ? l['mano:der'].tipo : null; }})()")
    comprobar(f'{nombre}: al elegirlo, el cubo queda vacío en la mano', t == 'cubo', str(t))
    pg.evaluate(f"(() => {{ const inv = {K}.inventario; if (inv.lugares['mano:der']) inv.sacar('mano:der'); }})()")
    cubas(pg, nombre, pref)
    # un pino: la resina
    ir(pg, *PINAR)
    try: pg.wait_for_function(f"{K}.obstaculos.some(o => o.arbol && (o.especie === 'pino' || o.especie === 'abeto') && Math.hypot(o.x - {K}.pj.x, o.z - {K}.pj.z) < 60)", timeout=240000)
    except Exception: pass
    p = pg.evaluate(f"(() => {{ const k = {K}; const l = k.obstaculos.filter(o => o.arbol && (o.especie === 'pino' || o.especie === 'abeto') && k.talaV.enPie(o)).sort((p, q) => Math.hypot(p.x - k.pj.x, p.z - k.pj.z) - Math.hypot(q.x - k.pj.x, q.z - k.pj.z)); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, r: l[0].r, especie: l[0].especie }} : null; }})()")
    comprobar(f'{nombre}: en el pinar hay pinos o abetos', bool(p), str(p))
    if p:
        poner_lasca(pg)
        pg.evaluate(f'([x, z, r]) => {{ const k = {K}; k.pj.x = x + r + 0.5; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.cam.dist = 4; k.cam.pitch = 0.3; k.cam.yaw = Math.PI / 2 + 0.6; }}', [p['x'], p['z'], p['r']]); pg.wait_for_timeout(1500)
        # (primero lo descorteza: Usar hace lo primero que se puede; luego le hace el corte)
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        pg.evaluate(f"(() => {{ const inv = {K}.inventario; for (const l of ['mano:der']) if (inv.lugares[l]) inv.sacar(l); }})()")
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        u = pg.evaluate(f"{K}.talaV.usos({K}.arbolCercano())")
        comprobar(f'{nombre}: Usar le hace el corte al {p["especie"]} (la resina, sangrando)', u.get('resina') == 'sangrando', str(u))
        pg.screenshot(path=f'{SALIDA}/{pref}_3_pino_sangrado.png', timeout=180000)
        pg.evaluate(f"(id) => {{ {K}.talaV.tala.estado[id].resina = Date.now() - 1; }}", p['id'])   # (como si hubieran pasado las 4 h)
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        r = pg.evaluate(f"{K}.inventario.cuantos('resina')")
        comprobar(f'{nombre}: cuando sale, Usar coge la resina (1)', r == 1, f'{r}')
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as pw:
    nav = pw.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        recorrido(ctx.new_page(), nombre, pref)
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
