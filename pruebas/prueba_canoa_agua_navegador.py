# Prueba en navegador (Chromium sin pantalla): la canoa al agua (P11d). En el mundo de verdad (la demo, con su terreno y
# el río de unos 14 m de ancho de las pruebas de los ríos), con la canoa en la orilla y el remo en la mano: Usar la echa
# al agua (flota sobre la superficie), Usar a su lado sube (sentado), remando (W) va bastante más deprisa que corriendo
# (6 m/s), sin remar la lleva la corriente río abajo, no se sale del agua, y Usar en la orilla baja a tierra (la canoa
# se queda a flote). Capturas de cerca en PC (1280×800) y en el móvil (390×844). La lógica y el servidor, en
# pruebas/prueba_canoa.mjs; aquí sin servidor (la misma lógica en el navegador).
# Uso: python3 pruebas/prueba_canoa_agua_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR_RODILLAS=1: sin juntar las rodillas en la canoa (se salen por la borda): tiene que fallar.
# MUTAR_CASCO=1: el casco atraviesa las rocas: tiene que fallar.
# MUTAR=1: remar no mueve la canoa más que la corriente (sin remo de verdad): tiene que fallar.
import sys, os, json, time
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
RIO = {'x': 195888, 'z': 65144, 'salida': 168}   # (el «rio» de pruebas/prueba_rios_navegador.py)
URL = f"http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida={RIO['salida']}"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def usar_texto(pg): return pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : ''; }})()")
def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")
def foto(pg, nombre):
    pg.wait_for_timeout(500); pg.screenshot(path=f'{SALIDA}/{nombre}.png')
def canoa(pg, id):
    return pg.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.porId('{id}', Date.now()); return o ? {{ x: o.x, z: o.z, agua: !!o.agua, rema: o.rema || null }} : null; }})()")

def recorrido(pg, pre, movil):
    # el río: su centro, la corriente (hacia donde baja) y la orilla (n: de la orilla al agua)
    r = pg.evaluate(f"""([xm, zm]) => {{ const k = {K}, m = k.mundoJ, pa = m.paisaje, tr = pa.riosEn(xm - 300, zm - 300, xm + 300, zm + 300);
      const c = pa.rioCerca(xm, zm, tr), co = pa.corriente(xm, zm, tr), l = Math.hypot(co.dx, co.dy) || 1;
      const ux = co.dx / l, uz = co.dy / l, x = xm - m.salida.x, z = zm - m.salida.z;
      // la orilla seca más cercana al agua, de un lado
      let d = c.ancho / 2; while (m.aguaEn(x - uz * d, z + ux * d) && d < c.ancho * 2) d += 0.25;
      return {{ x, z, ux, uz, nx: uz, nz: -ux, orilla: d, ancho: c.ancho, vel: co.vel }}; }}""", [RIO['x'], RIO['z']])
    print('  río:', json.dumps({k: round(v, 2) for k, v in r.items()}))
    # el que juega, en la orilla seca a 2,5 m del agua, mirando al río; la canoa a su lado, a 1,2 m del agua
    ox, oz = r['x'] - r['nx'] * (r['orilla'] + 2.5), r['z'] - r['nz'] * (r['orilla'] + 2.5)
    cx, cz = r['x'] - r['nx'] * (r['orilla'] + 1.2) + r['ux'] * 1.5, r['z'] - r['nz'] * (r['orilla'] + 1.2) + r['uz'] * 1.5
    id = pg.evaluate(f"""(() => {{ const k = {K}; k.pj.k = 0; k.pj.x = {ox}; k.pj.z = {oz}; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = Math.atan2({r['nx']}, {r['nz']});
      k.cam.yaw = Math.atan2(-({r['nx']}), -({r['nz']})) + 0.6; k.cam.pitch = 0.5; k.cam.dist = 7;
      const o = k.sueloObjetos.suelo.dejar({{ tipo: 'canoa', n: 1 }}, {cx}, {cz}, Date.now(), 'jugador:local', false, Math.atan2({r['ux']}, {r['uz']}) - Math.PI / 2);
      k.sueloObjetos.refrescar(); return o.id; }})()""")
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0 && Math.hypot({K}.decorado.centro.x - {K}.pj.x, {K}.decorado.centro.z - {K}.pj.z) < 1', timeout=240000)
    except Exception: print('  (el decorado no ha acabado de ponerse a tiempo)')
    pg.wait_for_timeout(2500)
    comprobar(f'{pre}la canoa está en tierra, junto al agua', not canoa(pg, id)['agua'] and not pg.evaluate(f"!!{K}.mundoJ.aguaEn({cx}, {cz})"))
    comprobar(f'{pre}en tierra, Usar no ofrece subir: la echa al agua', usar_texto(pg) == 'Echar la canoa al agua', usar_texto(pg))
    foto(pg, f'{pre}1_canoa_en_la_orilla')
    # el remo en la mano (del arcón de pruebas: aquí se prueba la canoa; sin arcón, en el recorrido del hito)
    pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: 'remo', cantidad: 1, a: 'mano:der' }}); {K}.pintarLlevas(); {K}.vestir(); return r.ok; }})()")
    if os.environ.get('MUTAR_RODILLAS') == '1': pg.evaluate('window.__mutarRodillas = true')
    if os.environ.get('MUTAR_CASCO') == '1': pg.evaluate('window.__mutarCasco = true')
    if MUTAR: pg.evaluate(f"(() => {{ const k = {K}; k.inventario().lugares['mano:der'] = null; k.vestir(); }})()")
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(700)
    c = canoa(pg, id)
    agua = pg.evaluate(f"(() => {{ const a = {K}.mundoJ.aguaEn({c['x']}, {c['z']}); return a && a.hondo; }})()") or 0
    comprobar(f'{pre}Usar la empuja al agua: flota', c['agua'] and agua >= 0.3, f"{aviso(pg)} · {agua:.2f} m de agua")
    y = pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('suelo_canoa'), a = {K}.mundoJ.aguaEn(o.position.x, o.position.z); return [o.position.y, a ? a.superficie : null]; }})()")
    comprobar(f'{pre}se ve sobre el agua (no en el fondo)', y[1] is not None and abs(y[0] - (y[1] - 0.16)) < 0.1, f'{y}')
    comprobar(f'{pre}el agua no se ve dentro del casco (la tapa que la esconde)', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_canoa').getObjectByName('tapa_agua')"))
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = Math.atan2(-({r['nx']}), -({r['nz']})) + 1.2; k.cam.dist = 8; k.cam.pitch = 0.6; }})()")
    foto(pg, f'{pre}2_canoa_a_flote')
    # subir, desde el borde del agua (lo poco hondo), lo más cerca de la canoa
    pg.evaluate(f"""(() => {{ const k = {K}, m = k.mundoJ; let best = null;
      for (let d = -1; d <= 1.5; d += 0.1) {{ const x = {r['x']} - {r['nx']} * ({r['orilla']} - d) + {r['ux']} * 1.5, z = {r['z']} - {r['nz']} * ({r['orilla']} - d) + {r['uz']} * 1.5, a = m.aguaEn(x, z);
        if (!a || a.hondo < 0.3) best = {{ x, z }}; }}
      k.pj.x = best.x; k.pj.z = best.z; k.pj.y = k.alturaSuelo(best.x, best.z); }})()""")
    pg.wait_for_timeout(400)
    # subir
    comprobar(f'{pre}Usar a su lado: subir a la canoa', usar_texto(pg) == 'Subir a la canoa', usar_texto(pg))
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(700)
    comprobar(f'{pre}sube, y rema él', canoa(pg, id)['rema'] == 'jugador:local' and pg.evaluate(f"!!{K}.miCanoa()"), aviso(pg))
    pg.wait_for_timeout(600)
    comprobar(f'{pre}va sentado (con el remo en las manos)', pg.evaluate(f"{K}.jugador.sentado === true && {K}.jugador.modo === 'sentado'"), pg.evaluate(f"{K}.jugador.modo"))
    # las rodillas, dentro del casco (0,45 m por dentro): la de sentarse en el suelo las abre y se salían por la borda
    rod = pg.evaluate(f"""(() => {{ const k = {K}, o = k.escena.getObjectByName('suelo_canoa'), h = k.jugador.mh.hueso; k.escena.updateMatrixWorld(true);
      return ['calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r', 'upperarm_l', 'upperarm_r'].map(n => {{ const p = o.worldToLocal(h[n].getWorldPosition(h[n].position.clone())); return [Math.round(p.z * 100) / 100, Math.round(p.y * 100) / 100]; }}); }})()""")
    comprobar(f'{pre}las rodillas, los pies y sus dedos, dentro del casco (a menos de 0,17 m del medio y sin salir por debajo)', all(abs(z) <= 0.17 and y >= 0.04 for z, y in rod[:6]), f'{rod[:6]} (de lado, alto)')
    comprobar(f'{pre}y mirando a lo largo de la canoa (los hombros, de través)', abs(rod[6][0] - rod[7][0]) > 0.2, f'{rod[6:]}')
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = Math.atan2(-({r['ux']}), -({r['uz']})) + 2.2; k.cam.dist = 6; k.cam.pitch = 0.45; }})()")
    foto(pg, f'{pre}3_en_la_canoa')
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = Math.atan2(-({r['ux']}), -({r['uz']})) + 1.57; k.cam.dist = 2.6; k.cam.pitch = 0.3; }})()")
    foto(pg, f'{pre}3b_en_la_canoa_de_cerca')
    # remar río arriba (contra la corriente): W con la cámara mirando río arriba (W lleva a (-sin yaw, -cos yaw))
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.rot = Math.atan2(-({r['ux']}), -({r['uz']})); k.cam.yaw = Math.atan2({r['ux']}, {r['uz']}); }})()")
    p0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z, performance.now()]")
    # (la velocidad, la que da el juego en cada fotograma: en la nube, sin tarjeta gráfica, van tan pocos fotogramas que el
    # tiempo del juego no sigue al reloj; lo andado, que sea río arriba)
    pg.keyboard.down('w'); vs = []
    for i in range(6): pg.wait_for_timeout(300); vs.append(pg.evaluate(f"{K}.pj.vel"))
    pg.keyboard.up('w')
    p1 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z, performance.now()]")
    avance = -((p1[0] - p0[0]) * r['ux'] + (p1[1] - p0[1]) * r['uz'])   # lo andado río arriba
    v = max(vs)
    comprobar(f'{pre}remando contra la corriente, más deprisa que corriendo (6 m/s)', v > 6, f'{v:.1f} m/s (corriente {r["vel"]:.1f} m/s)')
    comprobar(f'{pre}y avanza río arriba', avance > 0.5, f'{avance:.1f} m')
    comprobar(f'{pre}sigue en el agua', (pg.evaluate(f"(() => {{ const a = {K}.mundoJ.aguaEn({K}.pj.x, {K}.pj.z); return a ? a.hondo : 0; }})()") or 0) >= 0.2)
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = Math.atan2(-({r['ux']}), -({r['uz']})) + 2.4; k.cam.dist = 5.5; k.cam.pitch = 0.4; }})()")
    foto(pg, f'{pre}4_remando')
    # sin remar: a la deriva, río abajo
    p0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z, performance.now()]")
    pg.wait_for_timeout(2000)
    p1 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z, performance.now()]")
    deriva = (p1[0] - p0[0]) * r['ux'] + (p1[1] - p0[1]) * r['uz']
    comprobar(f'{pre}sin remar, la corriente la lleva río abajo', deriva > 0.2 * r['vel'] * (p1[2] - p0[2]) / 1000, f'{deriva:.2f} m en {(p1[2] - p0[2]) / 1000:.1f} s')
    # una roca en el agua, 3,5 m río arriba de la canoa: remando hacia ella, el casco no la atraviesa (se para contra ella)
    pg.evaluate(f"""(() => {{ const k = {K}; k.pj.rot = Math.atan2(-({r['ux']}), -({r['uz']})); k.cam.yaw = Math.atan2({r['ux']}, {r['uz']});
      k.obstaculos.push({{ x: k.pj.x - ({r['ux']}) * 3.5, z: k.pj.z - ({r['uz']}) * 3.5, r: 0.8, prueba_canoa: true }}); }})()""")
    pg.keyboard.down('w'); pg.wait_for_timeout(2500); pg.keyboard.up('w')
    mete = pg.evaluate(f"(() => {{ const k = {K}, m = window.__mutarCasco; window.__mutarCasco = false; const v = k.cascoMete(k.pj.x, k.pj.z, k.pj.rot, k.obstaculos.filter(o => o.prueba_canoa)); window.__mutarCasco = m; return v; }})()")
    comprobar(f'{pre}remando contra una roca, el casco no la atraviesa', mete < 0.05, f'{mete:.2f} m dentro')
    pg.evaluate(f"(() => {{ const k = {K}, i = k.obstaculos.findIndex(o => o.prueba_canoa); if (i >= 0) k.obstaculos.splice(i, 1); }})()")
    # remar hacia la orilla: encalla, no se sale del agua
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.rot = Math.atan2(-({r['nx']}), -({r['nz']})); k.cam.yaw = Math.atan2({r['nx']}, {r['nz']}); }})()")
    pg.keyboard.down('w'); pg.wait_for_timeout(2500); pg.keyboard.up('w')
    h = pg.evaluate(f"(() => {{ const a = {K}.mundoJ.aguaEn({K}.pj.x, {K}.pj.z); return a ? a.hondo : 0; }})()") or 0
    comprobar(f'{pre}remando contra la orilla, encalla en el agua (no sale a tierra)', h >= 0.2, f'{h:.2f} m de agua')
    t = usar_texto(pg)
    comprobar(f'{pre}junto a la orilla, Usar baja a tierra', t == 'Bajar a la orilla', t)
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = Math.atan2({r['ux']}, {r['uz']}) + 1.0; k.cam.dist = 6; k.cam.pitch = 0.5; }})()")
    foto(pg, f'{pre}5_en_la_orilla')
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(900)
    c = canoa(pg, id)
    h = pg.evaluate(f"(() => {{ const a = {K}.mundoJ.aguaEn({K}.pj.x, {K}.pj.z); return a ? a.hondo : 0; }})()") or 0
    comprobar(f'{pre}baja a la orilla (en seco o lo poco hondo) y la canoa se queda a flote', not pg.evaluate(f"!!{K}.miCanoa()") and h < 0.5 and c['agua'] and not c['rema'], f'{aviso(pg)} · {h:.2f} m · {c}')
    comprobar(f'{pre}ya no va sentado', pg.evaluate(f"{K}.jugador.sentado === false"))
    foto(pg, f'{pre}6_bajado')
    comprobar(f'{pre}sin errores en la página', not pg.errores, str(pg.errores[:3]))

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for pre, vista, movil in [('PC_', (1280, 800), False), ('movil_', (390, 844), True)]:
            print('PC (1280×800)' if not movil else 'Móvil (390×844)')
            pg = nav.new_page(viewport={'width': vista[0], 'height': vista[1]}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
            pg.errores = []
            pg.on('pageerror', lambda e, pg=pg: pg.errores.append(str(e)))
            pg.goto(URL)
            pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
            pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
            pg.evaluate(f'localStorage.clear()')
            recorrido(pg, pre, movil)
            pg.close()
        nav.close()
finally:
    srv.shutdown()
print(f"\n{'TODO CORRECTO' if not fallos else f'{len(fallos)} FALLOS'}")
sys.exit(1 if fallos else 0)
