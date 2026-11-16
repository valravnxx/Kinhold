# Prueba en navegador (Chromium sin pantalla): la canoa de un tronco (P11d). Con el hacha en la mano, junto a un tronco
# largo, el menú ofrece «Vaciar el tronco para hacer una canoa»; a golpes se desbasta (se ven las astillas y luego el
# casco aplanado); con una hoguera encendida al lado, Usar echa brasas en el hueco (se ven encendidas); mientras arden,
# Usar dice cuánto falta; pasadas, se raspa; y tras las 3 vueltas queda la canoa vaciada en el suelo. Capturas de cerca
# de cada paso en PC (1280×800) y en el móvil (390×844).
# La lógica y el servidor, en pruebas/prueba_canoa.mjs. Aquí, sin servidor (la misma lógica en el navegador), con el
# reloj adelantado para no esperar los 10 min de las brasas.
# Uso: python3 pruebas/prueba_canoa_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR=1: los golpes no hacen nada (el tronco no se vacía nunca): tiene que fallar.
import sys, os
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def abrir(nav, w, h, movil=False):
    pg = nav.new_page(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
    pg.errores = []
    pg.on('pageerror', lambda e: pg.errores.append(str(e)))
    pg.on('console', lambda m: pg.errores.append(m.text) if m.type == 'error' else None)
    pg.on('response', lambda r: pg.errores.append('404: ' + r.url) if r.status == 404 else None)
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    # el reloj de la página, adelantable (las brasas arden 10 min)
    pg.evaluate("(() => { const n = Date.now.bind(Date); window.__adelanto = 0; Date.now = () => n() + window.__adelanto; })()")
    if MUTAR: pg.evaluate(f"{K}.vaciadoLocal.paso = () => ({{ ok: true, paso: 'desbastar', termina: false, golpes: 1, faltan: 1 }})")
    pg.wait_for_timeout(800)
    return pg

def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")
def foto(pg, nombre):
    pg.wait_for_timeout(400); pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')
def camara(pg, dist=5.0, pitch=0.5, giro=0.7):
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = -Math.PI / 2 + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; k.pj.rot = Math.PI / 2; }})()")
def objeto(pg, id):
    return pg.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.porId('{id}', Date.now()); return o ? JSON.parse(JSON.stringify(o.cosa)) : null; }})()")
# golpes seguidos (lo que hace Usar a su ritmo), sin esperar el gesto; devuelve el último resultado
def golpes(pg, id, n):
    return pg.evaluate(f"""(() => new Promise(fin => {{ const k = {K}; let i = 0, ult = null, cual = '{id}';
      const uno = () => {{ k.vaciadoLocal.ultimoGolpe = {{}}; k.mandarVaciar(cual, r => {{ ult = r; if (r.objeto) cual = r.objeto; i++;
        if (!r.ok || r.termina || i >= {n}) fin({{ ok: r.ok, termina: !!r.termina, paso: r.paso || '', motivo: r.motivo || '', canoa: !!r.canoa, objeto: cual, i }}); else uno(); }}); }};
      uno(); }}))()""")
def usar_texto(pg):
    return pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : ''; }})()")

def recorrido(pg, pre):
    p = pg.evaluate(f"({{ x: {K}.pj.x, z: {K}.pj.z }})")
    x, z = p['x'], p['z']
    # el tronco largo tumbado a 1,6 m, a lo largo de x
    id = pg.evaluate(f"""(() => {{ const k = {K}; k.pj.k = 0;
      const o = k.sueloObjetos.suelo.dejar({{ tipo: 'tronco_largo', n: 1 }}, {x} + 1.6, {z}, Date.now(), 'jugador:local', false, 1.57);
      k.sueloObjetos.guardar(); k.sueloObjetos.refrescar(); return o.id; }})()""")
    camara(pg)
    sin = pg.evaluate(f"{K}.opcionesUsar()")
    pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: 'hacha_piedra', cantidad: 1, a: 'mano:der' }}); {K}.pintarLlevas(); {K}.vestir(); return r.ok; }})()")
    ops = pg.evaluate(f"{K}.opcionesUsar()")
    comprobar(f'{pre}con el hacha, junto al tronco largo, el menú ofrece vaciarlo para hacer una canoa', 'Vaciar el tronco para hacer una canoa' in ops, str(ops)[:300])
    foto(pg, f'{pre}1_tronco_largo')
    r = golpes(pg, id, 12)
    o = objeto(pg, r['objeto'])
    comprobar(f'{pre}a golpes de hacha deja de ser un tronco: canoa a medias', r['ok'] and o and o['tipo'] == 'canoa_a_medias', f'{r} {o}')
    comprobar(f'{pre}Usar sigue vaciándolo', usar_texto(pg) == 'Vaciar el tronco con el hacha', usar_texto(pg))
    pg.evaluate(f"{K}.sueloObjetos.refrescar()")
    foto(pg, f'{pre}2_desbastando')
    r = golpes(pg, r['objeto'], 60)
    comprobar(f'{pre}desbastado (40 golpes con hacha de piedra)', r['termina'] and r['paso'] == 'desbastar', str(r))
    id = r['objeto']
    comprobar(f'{pre}Usar ofrece echar brasas (vuelta 1 de 3)', usar_texto(pg) == 'Echar brasas en el hueco (vuelta 1 de 3)', usar_texto(pg))
    r = golpes(pg, id, 1)
    comprobar(f'{pre}sin hoguera al lado, no se echan: lo dice', not r['ok'] and 'hoguera encendida' in r['motivo'] and objeto(pg, id)['vaciado']['fase'] == 'brasas', str(r))
    # una hoguera encendida a 3 m (la de las estaciones de aquí)
    pg.evaluate(f"""(() => {{ const k = {K}; k.fabCliente.estaciones.hpr = {{ id: 'hpr', tipo: 'hoguera', x: {x} - 1.5, z: {z} + 2.5, fuego: {{ hasta: Date.now() + 3600e3, combustible: 0, cenizas: false }} }}; }})()""")
    r = golpes(pg, id, 1)
    comprobar(f'{pre}con la hoguera encendida al lado, echa las brasas', r['ok'] and r['paso'] == 'brasas', str(r))
    pg.evaluate(f"{K}.sueloObjetos.refrescar()")
    comprobar(f'{pre}se ven las brasas encendidas en el hueco', pg.evaluate(f"(() => {{ let n = 0; {K}.escena.traverse(o => {{ if (o.name === 'brasa') n++; }}); return n; }})()") > 5)
    comprobar(f'{pre}Usar dice cuánto les falta', 'Las brasas arden en el hueco: faltan 10 min' == usar_texto(pg), usar_texto(pg))
    camara(pg, 3.6, 0.75, 0.5); foto(pg, f'{pre}3_brasas_en_el_hueco')
    for v in range(3):
        pg.evaluate("window.__adelanto += 10 * 60 * 1000 + 1000")
        pg.evaluate(f"{K}.sueloObjetos.refrescar()")
        comprobar(f'{pre}vuelta {v + 1}: pasadas las brasas, Usar raspa', usar_texto(pg) == 'Raspar lo quemado con el hacha', usar_texto(pg))
        if v == 0: camara(pg, 3.6, 0.75, 0.5); foto(pg, f'{pre}4_quemado_para_raspar')
        r = golpes(pg, id, 30)
        comprobar(f'{pre}vuelta {v + 1}: raspado', r['termina'] and r['paso'] == 'raspar', str(r))
        if v < 2:
            r = golpes(pg, id, 1)
            comprobar(f'{pre}vuelta {v + 2}: otra vez brasas', r['ok'] and r['paso'] == 'brasas', str(r))
    o = objeto(pg, id)
    comprobar(f'{pre}queda la canoa en el suelo', o and o['tipo'] == 'canoa', str(o))
    pg.evaluate(f"(() => {{ delete {K}.fabCliente.estaciones.hpr; {K}.sueloObjetos.refrescar(); }})()")
    comprobar(f'{pre}se ve la canoa', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_canoa')"))
    camara(pg, 4.2, 0.55, 0.9); foto(pg, f'{pre}5_canoa')
    camara(pg, 3.2, 0.95, 0.2); foto(pg, f'{pre}6_canoa_por_dentro')
    # a cuerda hasta la orilla: con la cuerda en la mano, Usar la ata y va detrás del que tira
    pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: 'cuerda', cantidad: 1, a: 'mano:izq' }}); {K}.pintarLlevas(); {K}.vestir(); return r.ok; }})()")
    pg.wait_for_timeout(300)
    comprobar(f'{pre}con la cuerda en la mano, Usar ata la canoa', usar_texto(pg) == 'Atar la canoa con la cuerda', usar_texto(pg))
    comprobar(f'{pre}y no ofrece cogerla con las manos', not any('Canoa' in t and 'Coger' in t for t in pg.evaluate(f"{K}.opcionesUsar()")), str(pg.evaluate(f"{K}.opcionesUsar()")))
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(600)
    comprobar(f'{pre}la canoa queda atada a la cuerda', bool(pg.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.porId('{id}', Date.now()); return o && o.arrastra; }})()")), aviso(pg))
    pg.evaluate(f"(() => {{ {K}.pj.rot = -Math.PI / 2; }})()")
    for i in range(12):
        pg.evaluate(f"{K}.pj.x -= 0.25"); pg.wait_for_timeout(120)
    camara(pg, 6.5, 0.6, 1.6); pg.wait_for_timeout(600); foto(pg, f'{pre}7_canoa_a_cuerda')
    d = pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('suelo_canoa'); return o ? Math.hypot(o.position.x - {K}.pj.x, o.position.z - {K}.pj.z) : -1; }})()")
    comprobar(f'{pre}la canoa va detrás del que tira (a unos 2,9 m)', 2.4 < d < 3.4, f'{d:.2f}')
    comprobar(f'{pre}Usar suelta la cuerda de la canoa', usar_texto(pg) == 'Soltar la canoa', usar_texto(pg))
    # el remo (P11d), en el suelo (al final: que no se cruce con la cuerda)
    pg.evaluate(f"""(() => {{ const k = {K}; k.sueloObjetos.suelo.dejar({{ tipo: 'remo', n: 1 }}, k.pj.x - 1.4, k.pj.z + 1.2, Date.now(), 'jugador:local', false);
      k.sueloObjetos.guardar(); k.sueloObjetos.refrescar(); }})()""")
    comprobar(f'{pre}se ve el remo en el suelo', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_remo')"))
    # la cámara sobre el remo, sin el personaje encima
    pg.evaluate(f"(() => {{ const k = {K}, o = k.escena.getObjectByName('suelo_remo'); k.pj.x = o.position.x + 1.6; k.pj.z = o.position.z - 1.0; }})()")
    pg.wait_for_timeout(300); camara(pg, 2.4, 0.7, -0.6); foto(pg, f'{pre}8_remo_en_el_suelo')
    comprobar(f'{pre}sin errores en la página', not pg.errores, str(pg.errores[:3]))

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        print('PC (1280×800)')
        pg = abrir(nav, 1280, 800)
        recorrido(pg, 'PC_')
        pg.close()
        print('Móvil (390×844)')
        pg = abrir(nav, 390, 844, movil=True)
        recorrido(pg, 'movil_')
        nav.close()
finally:
    srv.shutdown()
print(f"\n{'TODO CORRECTO' if not fallos else f'{len(fallos)} FALLOS'}")
sys.exit(1 if fallos else 0)
