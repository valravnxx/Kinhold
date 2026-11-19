# Prueba en navegador (Chromium sin pantalla) de la sierra de tronzar y las tablas (P10, 19 nov). En el mundo de
# verdad (Whitholm), sin servidor, primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - la sierra se ve en la mano: empuñada en la derecha, con su modelo (no el hacha), también tronzando un tronco largo
#     (y el tronco se tronza con ella); y en el cinto, con su modelo;
#   - la tabla, en la mano con su modelo;
#   - la sierra y las tablas, en el suelo; las tablas, guardadas en el acopio de troncos, encima de los troncos;
#   - en el panel de fabricar, en la pestaña «Fragua», la sierra de tronzar, y su ficha pide las barras, los mangos y el
#     mazo; en la del banco de tronco, las tablas, y su ficha pide el tronco corto y la sierra; sin salirse de lado;
#   - sin errores en la página.
# Capturas de cerca de cada cosa, en PC y en móvil.
# Uso: python3 pruebas/prueba_sierra_tablas_navegador.py <html> <carpeta_capturas>
#   - (19 nov, segunda mirada) en el cinto, la sierra cuelga alta; serrando, la mano va y viene más de 0,15 m;
#   - (19 nov, tras las capturas) la hoja no se clava en el suelo, quieto ni tronzando; tronzando, no se hacha (el cuerpo no
#     hace el gesto de talar) y la hoja va hacia delante, tendida y por encima del suelo, y la mano va y viene;
# Rota a propósito (19 nov): MUTAR=1 dibuja la sierra como el hacha (como sin su modelo): falla. MUTAR=2 deja la sierra
# como la pone la mano (sin colocarla ni serrar): fallan la hoja en el suelo y la de tronzar.
import sys, os, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_sierra_tablas'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
PASADAS = 1.4   # pasadas de sierra por segundo (src/juego/personaje.js, PASADAS_SIERRA)
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
  const cinto = j.llevado.grupo.children.filter(o => o.name === 'llevado_hacha_colgada').map(o => { let n = ''; o.traverse(m => { if (['pico', 'hacha', 'hacha_piedra', 'mazo_piedra', 'sierra'].includes(m.name)) n = m.name; }); return n; });
  const ch = h && centro(h), cp = p && centro(p);
  return { empunada: h ? h.name : null, dEmpunada: ch ? +ch.distanceTo(mano).toFixed(3) : null, pieza: !!p, generico: p ? !!p.userData.generico : null, dPieza: cp ? +cp.distanceTo(mano).toFixed(3) : null, cinto }; }'''

# la sierra empuñada: lo más bajo de la hoja sobre el suelo (m), adónde va la hoja (del mango a la otra punta) respecto al
# delante del cuerpo, lo tendida que va, la animación del cuerpo y dónde está la mano (a lo largo del delante)
SIERRA = '''() => { const K = window.__kinhold, j = K.jugador, s = j.hacha; K.escena.updateMatrixWorld(true);
  if (!s || s.name !== 'sierra' || !s.visible) return null;
  const T = j.raiz.position.clone(), v = T.clone(); let bajo = 1e9;
  s.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) bajo = Math.min(bajo, v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).y); });
  const o = s.localToWorld(T.clone().set(0, 0, 0)), p = s.localToWorld(T.clone().set(0, 0, 1)).sub(o).normalize();
  const f = T.clone().set(Math.sin(j.raiz.rotation.y), 0, Math.cos(j.raiz.rotation.y));
  const mano = j.mh.hueso.hand_r.getWorldPosition(T.clone()).sub(j.raiz.position);
  return { bajo: +(bajo - K.alturaSuelo(j.raiz.position.x, j.raiz.position.z)).toFixed(3), adelante: +p.dot(f).toFixed(2), caida: +p.y.toFixed(2), modo: j.modo, manoAdelante: +mano.dot(f).toFixed(3),
    cabeza: +(j.mh.hueso.Head.getWorldPosition(T.clone()).y - K.alturaSuelo(j.raiz.position.x, j.raiz.position.z)).toFixed(3) }; }'''

# lo más bajo de lo que cuelga del cinto, sobre el suelo (m)
BAJO_CINTO = '''() => { const K = window.__kinhold, j = K.jugador; K.escena.updateMatrixWorld(true); let bajo = 1e9; const v = j.raiz.position.clone();
  j.llevado.grupo.children.filter(o => o.name === 'llevado_hacha_colgada').forEach(o => o.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) bajo = Math.min(bajo, v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).y); }));
  return +(bajo - K.alturaSuelo(j.raiz.position.x, j.raiz.position.z)).toFixed(3); }'''

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
    if MUTAR == '1': pg.add_init_script('globalThis.__sinModelosManos = true')
    if MUTAR == '2': pg.add_init_script('globalThis.__sierraSinColocar = true')
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo && {K}.jugador.mh', timeout=300000)
    esperar(pg, 3000)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.35 if movil else 1
    # en la mano: la sierra, empuñada; la tabla, con su modelo
    equipar(pg, {'cintura': C('cordel', 1, [None]), 'mano:der': C('sierra')})
    v = pg.evaluate(VER)
    comprobar(f'{nombre}: la sierra, empuñada en la mano derecha con su modelo', v['empunada'] == 'sierra' and v['dEmpunada'] is not None and v['dEmpunada'] < 0.8, str(v))
    pg.wait_for_timeout(600)
    sq = pg.evaluate(SIERRA)
    comprobar(f'{nombre}: quieto, la hoja de la sierra no toca el suelo (tendida hacia atrás)', sq and sq['bajo'] > 0.15 and sq['adelante'] < -0.5, str(sq))
    for vista_, (g, d, a) in ({'frente': (0.45, 2.4, 0.05), 'lado': (1.3, 2.4, 0.05)} if not movil else {'frente': (0.25, 3.0, 0.05)}).items():
        mirarMano(pg, g, d, a)
        pg.screenshot(path=f'{SALIDA}/{pref}_mano_sierra_{vista_}.png', timeout=180000)
    equipar(pg, {'cintura': C('cordel', 1, [None]), 'mano:der': C('tabla', 2)})
    v = pg.evaluate(VER)
    comprobar(f'{nombre}: la tabla, en la mano derecha con su modelo', v['pieza'] and v['generico'] is False, str(v))
    if not movil:
        mirarMano(pg, 0.45, 2.2, 0.05)
        pg.screenshot(path=f'{SALIDA}/{pref}_mano_tabla.png', timeout=180000)
    # la sierra, en el cinto
    equipar(pg, {'cintura': C('cinto_cuero', 1, [C('sierra'), None, None])})
    v = pg.evaluate(VER)
    comprobar(f'{nombre}: la sierra, en el cinto con su modelo', v['cinto'] == ['sierra'], str(v))
    bajo = pg.evaluate(BAJO_CINTO)
    comprobar(f'{nombre}: en el cinto, la sierra cuelga alta (lo más bajo, a más de 0,7 m del suelo)', bajo > 0.7, f'{bajo} m')
    for vista_, g in ({'lado': -1.4, 'atras': 3.1} if not movil else {'lado': -1.4}).items():
        mirarMano(pg, g, 2.2 * D, 0.1)
        pg.screenshot(path=f'{SALIDA}/{pref}_cinto_sierra_{vista_}.png', timeout=180000)
    # tronzando un tronco largo con la sierra: la sierra en la mano mientras trabaja (sin que llegue el golpe: así se mira
    # serrar el rato que haga falta), y luego el tronco se tronza
    equipar(pg, {'cintura': C('cordel', 1, [None]), 'mano:der': C('sierra')})
    t = pg.evaluate(f"""(() => {{ const k = {K}, a = Date.now(), x = k.pj.x, z = k.pj.z + 0.9;
      const o = k.sueloObjetos.suelo.dejar({{ tipo: 'tronco_largo', n: 1 }}, x, z, a, 'vista', false, 0); k.sueloObjetos.refrescar();
      k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); k.estado.talando = {{ troceo: o.id, x, z, sierra: true }}; k.estado.golpeEn = 1e9; return o.id; }})()""")
    vistas = []
    for i, ms in enumerate([350, 300, 300]):
        pg.wait_for_timeout(ms)
        vistas.append(pg.evaluate(SIERRA))
        if i < 2:
            mirarMano(pg, 0.9 if i == 0 else 1.5, 2.6 * D, 0.15)
            pg.screenshot(path=f'{SALIDA}/{pref}_tronzar_sierra_{i + 1}.png', timeout=180000)
    ok = all(x and x['modo'] != 'talar' and x['adelante'] > 0.8 and 0.1 < x['bajo'] < 0.5 and abs(x['caida']) < 0.35 for x in vistas)
    comprobar(f'{nombre}: tronzando, se sierra (sin el gesto de hachar) con la hoja hacia delante, tendida, baja sobre el tronco y sin clavarse', ok, str(vistas))
    # (se mira en momentos fijos de la pasada, de 0,71 s: mirando el reloj, con 2–10 fotogramas por segundo, las muestras
    # caían en las mismas fases y el vaivén salía a veces de 0,05 m y a veces de 0,3)
    muestras = pg.evaluate(f'''() => {{ const f = {SIERRA}, j = {K}.jugador, r = [];
      for (let i = 0; i < 8; i++) {{ globalThis.__tiempoSierra = i / 8 / {PASADAS}; j.animar(0, 0, true); const x = f(); if (x) r.push(x); }}
      delete globalThis.__tiempoSierra; return r; }}''')
    manos = [x['manoAdelante'] for x in muestras]; cabezas = [x['cabeza'] for x in muestras]
    # (de rodillas y algo echado adelante, la cabeza entre 0,8 y 1,35 m: ni en las rodillas ni echada atrás)
    comprobar(f'{nombre}: serrando, el cuerpo derecho de rodillas (la cabeza, ni en las rodillas ni echada atrás)', cabezas and all(0.8 < c < 1.35 for c in cabezas + [v['cabeza'] for v in vistas]), str(cabezas))
    va = (max(manos) - min(manos)) if manos else 0
    comprobar(f'{nombre}: tronzando, la mano va y viene con la sierra (más de 0,15 m: que se lea)', va > 0.15, f'{va:.3f} m en {len(manos)} momentos de la pasada')
    v = pg.evaluate(VER)
    comprobar(f'{nombre}: tronzando, la sierra en la mano (no el hacha)', v['empunada'] == 'sierra', str(v))
    # (se para el trabajo del juego, que mientras se miraba ya ha podido tronzarlo, y se tronza otro, golpe a golpe)
    t = pg.evaluate(f"""(() => {{ const k = {K}; k.estado.talando = null; const a = Date.now();
      const o = k.sueloObjetos.suelo.dejar({{ tipo: 'tronco_largo', n: 1 }}, k.pj.x - 1.2, k.pj.z + 3, a, 'vista', false, 0); k.sueloObjetos.refrescar();
      k.pj.x -= 1.2; k.pj.z += 1.8; return o.id; }})()""")
    r = None
    for _ in range(12):
        r = pg.evaluate(f"(() => {{ const k = {K}; k.troceo.ultimoGolpe = {{}}; const r = k.golpeTroceo('{t}'); return r && {{ ok: r.ok, termina: r.termina, hacha: r.hacha, golpes: r.golpes, motivo: r.motivo }}; }})()")
        if not r or not r.get('ok') or r.get('termina'): break
    comprobar(f'{nombre}: con la sierra, el tronco largo se tronza en 8 golpes', r and r.get('termina') and r.get('hacha') == 'sierra' and r.get('golpes') == 8, str(r))
    pg.evaluate(f"{K}.estado.talando = null")
    # en el suelo, de cerca: la sierra y una pila de tablas
    c = pg.evaluate(f"(() => {{ const k = {K}; return {{ x: k.pj.x + 1.5, z: k.pj.z - 2.5 }}; }})()")
    pg.evaluate(f"(([x, z]) => {{ const k = {K}, s = k.sueloObjetos.suelo, a = Date.now(); s.dejar({{ tipo: 'sierra', n: 1 }}, x - 0.2, z - 0.3, a, 'vista', false); s.dejar({{ tipo: 'tabla', n: 4 }}, x + 0.1, z + 0.5, a, 'vista', false); k.sueloObjetos.refrescar(); }})", [c['x'], c['z']])
    n = pg.evaluate(f"{K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => ['sierra', 'tabla'].includes(o.cosa.tipo)).length")
    comprobar(f'{nombre}: la sierra y las tablas se dejan en el suelo', n == 2, str(n))
    # la sierra en el suelo, asentada de punta a punta: ningún trozo bajo tierra ni en el aire (en una cuesta, media hoja se hundía)
    a = pg.evaluate(f'''(() => {{ const k = {K}; k.escena.updateMatrixWorld(true); const o = k.escena.getObjectByName('suelo_sierra'); if (!o) return null;
      const v = o.position.clone(); let bajo = 1e9, alto = -1e9;
      o.traverse(m => {{ if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) {{ v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const d = v.y - k.alturaSuelo(v.x, v.z); bajo = Math.min(bajo, d); alto = Math.max(alto, d); }} }});
      return [+bajo.toFixed(3), +alto.toFixed(3)]; }})()''')
    comprobar(f'{nombre}: la sierra en el suelo, asentada (ni hundida ni en el aire)', a and a[0] > -0.02 and a[1] < 0.2, str(a))
    # las tablas en el suelo, con su modelo (antes, un hatillo de lino): un montón de 1 m de largo y bajo, asentado (alturas
    # sobre el terreno: en cuesta va inclinado)
    b = pg.evaluate(f'''(() => {{ const k = {K}, o = k.escena.getObjectByName('suelo_tabla'); if (!o) return null; const c = new o.position.constructor();
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; o.updateMatrixWorld(true);
      o.traverse(m => {{ if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) {{ c.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const h = c.y - k.alturaSuelo(c.x, c.z); c.sub(o.position).applyAxisAngle(c.clone().set(0, 1, 0), -o.rotation.y); const v = [c.x, h, c.z]; for (let j = 0; j < 3; j++) {{ mn[j] = Math.min(mn[j], v[j]); mx[j] = Math.max(mx[j], v[j]); }} }} }});
      return [+(mx[0] - mn[0]).toFixed(2), +mx[1].toFixed(2), +(mx[2] - mn[2]).toFixed(2), +mn[1].toFixed(3)]; }})()''')
    comprobar(f'{nombre}: las tablas en el suelo, con su modelo (1 m de largo, en montón bajo)', b and 0.9 < max(b[0], b[2]) < 1.15 and b[1] < 0.15 and b[3] > -0.02, str(b))
    pg.evaluate(f'{K}.jugador.raiz.visible = false')
    mirar(pg, c, 0, 0.1, 0.5, 2.4 * D, 1.3, 0)
    pg.screenshot(path=f'{SALIDA}/{pref}_suelo.png', timeout=180000)
    pg.evaluate(f'{K}.jugador.raiz.visible = true')
    # el acopio de troncos con tablas encima de los troncos
    pg.evaluate(f"""(() => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x - 3, z0 = k.pj.z + 3;
      f.estaciones['acopio:vista'] = {{ id: 'acopio:vista', tipo: 'acopio_troncos', x: x0, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ tronco_corto: 4, tronco_delgado: 2, tabla: 6 }} }};
      k.estacionesV.refrescar(); }})()""")
    a = pg.evaluate(f"(() => {{ const e = {K}.fabCliente.estaciones['acopio:vista']; return {{ x: e.x, z: e.z }}; }})()")
    pg.evaluate(f'{K}.jugador.raiz.visible = false')
    mirar(pg, a, 0, 0, 0.6, 3.6 * D, 0.55, 0)
    pg.screenshot(path=f'{SALIDA}/{pref}_acopio_tablas.png', timeout=180000)
    pg.evaluate(f'{K}.jugador.raiz.visible = true')
    # el panel: la fragua y el banco de tronco, puestos al lado
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"""(() => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x + 2, z0 = k.pj.z - 4;
      f.estaciones['fragua:vista'] = {{ id: 'fragua:vista', tipo: 'fragua', x: x0, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ barra_hierro: 2, mango: 2 }}, fuego: {{ hasta: Date.now() + 600000, combustible: 0, cenizas: false }} }};
      f.estaciones['banco:vista'] = {{ id: 'banco:vista', tipo: 'banco_tronco', x: x0 + 2.5, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ tronco_corto: 1 }} }};
      k.estacionesV.refrescar(); k.pj.x = x0 + 0.3; k.pj.z = z0 + 1.3; k.inventario.meterDonde('mazo_piedra', 1); }})()""")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('fragua:vista')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: en la pestaña «Fragua», la sierra de tronzar', 'Sierra de tronzar' in texto, texto[:300])
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    sel = '#panelFabricar .fab-carta[data-fila="sierra"]'
    if movil: pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{ block: 'center' }})"); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_fragua.png', timeout=180000)
    pg.tap(sel) if movil else pg.click(sel)
    pg.wait_for_timeout(800)
    ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha de la sierra pide las barras, los mangos y el mazo de piedra', re.search('barra', ficha, re.I) and re.search('mango', ficha, re.I) and re.search('mazo', ficha, re.I), ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_sierra_ficha.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
    pg.evaluate(f"(() => {{ const k = {K}, e = k.fabCliente.estaciones['banco:vista']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.3; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('banco:vista')"); pg.wait_for_timeout(1200)
    sel = '#panelFabricar .fab-carta[data-fila="tablas"]'
    hay = pg.evaluate(f"!!document.querySelector('{sel}')")
    comprobar(f'{nombre}: en el banco de tronco, las tablas', hay)
    if hay:
        pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{ block: 'center' }})"); pg.wait_for_timeout(400)
        pg.tap(sel) if movil else pg.click(sel)
        pg.wait_for_timeout(800)
        ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
        comprobar(f'{nombre}: la ficha de las tablas pide el tronco corto y la sierra', re.search('tronco corto', ficha, re.I) and re.search('sierra', ficha, re.I), ficha[:300])
        pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{SALIDA}/{pref}_panel_tablas.png', timeout=180000)
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
