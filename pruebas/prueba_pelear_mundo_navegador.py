# Prueba en navegador: pelear en cualquier sitio del mundo de verdad (hito «El juego en el mundo de verdad»: «el duelo
# en el mundo: pelear en cualquier sitio, sin escena aparte»), en la demo, sin servidor, en PC y en móvil.
#  - el rival de práctica anda por donde andarías tú: no se mete donde cubre (no nada), no atraviesa los árboles, no
#    sube por los cortados y aparece en un sitio al que se llega andando;
#  - en la orilla de un río o del mar: el rival viene a por ti y, si te metes a nado, se queda en la orilla;
#  - nadando no se lucha: al meterte donde cubre se guarda el arma (con su aviso) y C no la saca;
#  - capturas de cerca de la pelea en la orilla, con el rival fijado.
# Uso: python3 pruebas/prueba_pelear_mundo_navegador.py <html de la demo> <carpeta de capturas>
# MUTAR=1: el rival atraviesa todo y se lucha nadando (window.__mutarPelea): tiene que fallar.
import sys, os, re, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_pelear_mundo'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos/personajes')):
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o) and (c in ('v1', 'taller-anim-v1', 'taller-carga-v3', 'taller-dormir-v1', 'taller-sentarse-v1') or re.fullmatch(r'taller-v\d+', c)): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ|FUENTES) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def handle(self):
        try: super().handle()
        except Exception: pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR') == '1'
# (siempre en la misma salida, ?salida=0: con la salida al azar fallaba a ratos según dónde se cayera; 6 nov)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
C = K + '.combate'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# lo hondo (m de agua) en un punto; 1,25 m o más: ya se nada (src/logica/nado.js)
HONDO = "((x, z) => { const a = window.__kinhold.mundoJ.aguaEn(x, z); return a ? a.hondo : 0; })"
# una orilla cerca de la salida: un punto seco y llano (andable a 2 m alrededor, sin árboles a 3 m) a 3-6 m del agua
# donde ya se nada (al menos 2 m de hondo), con el agua honda también 4 m más allá
ORILLA = f"""(() => {{
  const k = window.__kinhold, m = k.mundoJ, hondo = {HONDO};
  for (let r = 10; r < 20000; r += 20) for (let a = 0; a < 6.283; a += 20 / r) {{
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!m.dentro(x, z) || hondo(x, z) < 1.6) continue;
    // hacia la salida, el primer punto seco (a menos de 60 m)
    for (let d = 1; d <= 60; d += 1) {{
      const tx = x - Math.cos(a) * d, tz = z - Math.sin(a) * d;
      if (hondo(tx, tz) > 0) continue;
      // el agua donde ya se nada, a menos de 25 m de la orilla, y honda también 3 m más allá
      let w = null;
      for (let e = 2; e <= 25 && !w; e += 1) {{ const wx = tx + Math.cos(a) * e, wz = tz + Math.sin(a) * e;
        if (hondo(wx, wz) >= 1.6 && hondo(wx + Math.cos(a) * 3, wz + Math.sin(a) * 3) >= 1.6) w = [wx, wz]; }}
      // el jugador, 2 m tierra adentro, en llano: andable y sin agua honda a 2 m alrededor
      const px = tx - Math.cos(a) * 2, pz = tz - Math.sin(a) * 2;
      let ok = !!w && hondo(px, pz) === 0;
      for (let b = 0; b < 8 && ok; b++) {{ const bx = px + Math.cos(b * 0.785) * 2, bz = pz + Math.sin(b * 0.785) * 2; ok = hondo(bx, bz) < 0.5 && m.andable(px, pz, bx, bz); }}
      if (ok) return {{ tierra: [px, pz], agua: w, rumbo: a, r }};
      break;
    }}
  }}
  return null;
}})()"""

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        if MUTAR: pg.add_init_script('window.__mutarPelea = true')
        pg.goto(URL)
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=240000)
        comprobar('la demo arranca sin error', not pg.evaluate('window.__demo.error'), str(pg.evaluate('window.__demo.error')))
        pg.wait_for_function(f'{K}.mundoListo', timeout=240000)
        pg.evaluate(f"{K}.cambiarModo('mover')")

        # ---------- el paso del rival, contra el terreno ----------
        # contra un árbol: andar hacia su tronco se queda fuera de él
        arbol = pg.evaluate(f"""(() => {{ const k = {K}, s = k.mundoJ.salida || [0, 0];
          const os = k.obstaculos.filter(o => o.arbol && !o.oculto && o.r > 0.1).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
          for (const o of os) {{ const x0 = o.x + o.r + 1.2, z0 = o.z;
            if (!k.mundoJ.andable(x0, z0, o.x, o.z)) continue;   // de un árbol en una cuesta empinada ya no se sabría si es por el árbol
            // a pasos de rival (0,2 m), hacia el tronco y más allá: nunca dentro
            let x = x0, z = z0, d = Infinity;
            for (let i = 0; i < 30; i++) {{ const p = k.andarHasta(x, z, x - 0.2, z); x = p.x; z = p.z; d = Math.min(d, Math.hypot(x - o.x, z - o.z)); }}
            return {{ r: o.r, d }}; }}
          return null; }})()""")
        comprobar('el rival no atraviesa los árboles', arbol is not None and arbol['d'] >= arbol['r'] - 0.01, json.dumps(arbol))
        # un cortado: un paso que sube más de lo que se anda no se da
        cortado = pg.evaluate(f"""(() => {{ const k = {K}, m = k.mundoJ;
          // (por anillos, cada vez más lejos: según la salida, el primer cortado puede estar a varios kilómetros)
          for (let r = 10; r < 12000; r += r < 1500 ? 5 : 20) for (let a = 0; a < 6.283; a += (r < 1500 ? 5 : 20) / r) {{
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            for (let b = 0; b < 8; b++) {{ const ux = Math.cos(b * 0.785), uz = Math.sin(b * 0.785);
              if (m.dentro(x, z) && !m.andable(x, z, x + ux * 0.5, z + uz * 0.5) && m.dentro(x + ux * 0.5, z + uz * 0.5) && m.altura(x + ux * 0.5, z + uz * 0.5) > m.altura(x, z)) {{
                const p = k.andarHasta(x, z, x + ux * 0.5, z + uz * 0.5);
                return {{ x, z, sube: m.altura(p.x, p.z) - m.altura(x, z), quiere: m.altura(x + ux * 0.5, z + uz * 0.5) - m.altura(x, z), llega: Math.hypot(p.x - x - ux * 0.5, p.z - z - uz * 0.5) < 0.01 }}; }} }}
          }}
          return null; }})()""")
        comprobar('el rival no sube por los cortados', cortado is not None and not cortado['llega'], json.dumps(cortado))

        # ---------- en la orilla ----------
        o = pg.evaluate(ORILLA)
        comprobar('hay una orilla con agua honda cerca de la salida', o is not None, json.dumps(o))
        if not o: ctx.close(); continue
        print('  orilla', json.dumps(o))
        (tx, tz), (ax, az), rumbo = o['tierra'], o['agua'], o['rumbo']
        paso = pg.evaluate(f"([tx, tz, ax, az]) => {{ const p = {K}.andarHasta(tx, tz, ax, az); return {{ hondo: {HONDO}(p.x, p.z), x: p.x, z: p.z }}; }}", [tx, tz, ax, az])
        comprobar('un paso del rival hacia donde cubre no se da', paso['hondo'] < 1.25, json.dumps(paso))
        # el jugador en la orilla, de espaldas al agua (la cámara mira desde el agua hacia tierra)
        pg.evaluate(f"""([x, z, a]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.k = 0; k.pj.y = k.alturaSuelo(x, z);
          k.cam.yaw = Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI; k.cam.pitch = 0.35; k.cam.dist = 7; }}""", [tx, tz, rumbo])
        try: pg.wait_for_function(f'{K}.mundoListo', timeout=180000)
        except Exception: pass
        if movil: pg.click('#btnArma')
        else: pg.keyboard.press('c')
        pg.wait_for_function(f'{C}.activo', timeout=60000)
        pg.evaluate(f'{C}.llamarRival()')
        n = pg.evaluate(f'{C}.rivales.length')
        comprobar('sale un rival de práctica en la orilla', n == 1, str(n))
        if n:
            sale = pg.evaluate(f"""(() => {{ const k = {K}, L = {C}.rivales[0].L; return {{ x: L.x, z: L.z, hondo: {HONDO}(L.x, L.z), llega: k.mundoJ.andable(k.pj.x, k.pj.z, L.x, L.z),
              arbol: k.obstaculos.some(o => !o.oculto && Math.hypot(o.x - L.x, o.z - L.z) < o.r) }}; }})()""")
            comprobar('el rival aparece donde se anda (seco, sin árbol encima, al que se llega)', sale['hondo'] < 1.25 and not sale['arbol'] and sale['llega'], json.dumps(sale))
            # se deja venir al rival y se fija
            pg.wait_for_function(f"(() => {{ const L = {C}.rivales[0].L; return Math.hypot(L.x - {K}.pj.x, L.z - {K}.pj.z) < 3.5; }})()", timeout=240000)
            # la captura: desde tierra, mirando al agua, con la lámina del río o del mar ya dibujada
            try: pg.wait_for_function(f'{K}.mundoJ.agua.cerca({K}.pj.x, {K}.pj.z)', timeout=120000)
            except Exception: pass
            pg.evaluate(f"([a]) => {{ const k = {K}; k.cam.yaw = Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI + 0.6; k.cam.pitch = 0.28; k.cam.dist = 6.5; }}", [rumbo])
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_orilla.png')
        # ---------- a nado ----------
        # lo que pisa el rival, en cada fotograma, desde que te metes en el agua
        pg.evaluate(f"""(() => {{ window.__rivalHondo = 0; const h = {HONDO}; const mira = () => {{ for (const x of {C}.rivales) if (!x.L.fuera) window.__rivalHondo = Math.max(window.__rivalHondo, h(x.L.x, x.L.z)); requestAnimationFrame(mira); }}; mira(); }})()""")
        pg.evaluate(f"([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; }}", [ax, az])
        pg.wait_for_function(f"{K}.nado.modo === 'nadar'", timeout=120000)
        pg.wait_for_timeout(600)
        nada = pg.evaluate(f"({{ activo: {C}.activo, aviso: document.getElementById('aviso').textContent }})")
        comprobar('al meterte donde cubre se guarda el arma, con su aviso', not nada['activo'] and 'Nadando' in nada['aviso'], json.dumps(nada, ensure_ascii=False))
        if movil: pg.click('#btnArma')
        else: pg.keyboard.press('c')
        pg.wait_for_timeout(600)
        comprobar('nadando, el arma no se saca', not pg.evaluate(f'{C}.activo'))
        # el rival viene a por ti: unos segundos de juego (a pocos fotogramas, bastante más de reloj)
        pg.wait_for_function(f"(() => {{ window.__f = (window.__f || 0) + 1; return window.__f > 40; }})()", polling='raf', timeout=240000)
        pg.wait_for_timeout(2000)
        rh = pg.evaluate('window.__rivalHondo')
        comprobar('el rival no se mete a nado detrás de ti (se queda en la orilla)', n > 0 and rh < 1.25, f'lo más hondo que pisó: {rh:.2f} m')
        comprobar('sin errores en la página', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()

print('\nFALLAN:', len(fallos)) if fallos else print('\nTodo correcto')
sys.exit(1 if fallos else 0)
