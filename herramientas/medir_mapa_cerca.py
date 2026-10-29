# Kinhold — mide el visor del mapa (vista «Como en el juego») en PC (1280×800) y en móvil emulado (390×844):
# lo que tarda en generarse el mundo y en hacerse el trozo de cerca (tiempo en que el juego se queda parado),
# triángulos, llamadas de dibujo por fotograma, número de cosas puestas y memoria de JavaScript.
# Sirve para planificar el terreno por trozos (hito «El juego en el mundo de verdad»).
# Lo que depende de la tarjeta gráfica (fotogramas por segundo) no vale aquí: esta máquina y las de GitHub Actions
# dibujan sin tarjeta (SwiftShader). Los tiempos de construir son de su procesador, no del de un móvil.
# Uso: python3 herramientas/medir_mapa_cerca.py [html] [salida.json]
import sys, os, json, subprocess, time, socket
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'docs/jugar/mapa/v13.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else None
# cuenta las llamadas de dibujo de WebGL en cada fotograma (no depende de la tarjeta)
CONTAR = """(() => { const c = { n: 0, ultimos: [] }; window.__dibujos = c;
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype])
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = P[f]; if (o) P[f] = function () { c.n++; return o.apply(this, arguments); }; }
  const marca = () => { c.ultimos.push(c.n); if (c.ultimos.length > 30) c.ultimos.shift(); c.n = 0; requestAnimationFrame(marca); }; requestAnimationFrame(marca); })()"""
LLAMADAS = 'Math.max(...window.__dibujos.ultimos.slice(-5))'
MEM = 'performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null'
_s = socket.socket(); _s.bind(('', 0)); PUERTO = _s.getsockname()[1]; _s.close()
SERVIDOR = subprocess.Popen([sys.executable, '-m', 'http.server', str(PUERTO)], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
URL = f'http://localhost:{PUERTO}/' + os.path.relpath(RUTA, RAIZ).replace(os.sep, '/') + '?recursosMH=/docs/recursos/personajes/taller-v7/'
res = {}
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-precise-memory-info"])
        for nombre, opc in [('pc', dict(viewport={'width': 1280, 'height': 800})), ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
            ctx = nav.new_context(locale='es-ES', **opc); pg = ctx.new_page(); pg.add_init_script(CONTAR)
            pg.goto(URL); pg.wait_for_function('window.__mapa && window.__mapa.listo', timeout=300000)
            m = {'ms_generar_mundo': pg.evaluate('window.__mapa.msGenerar'), 'mem_mapa_MB': pg.evaluate(MEM)}
            # el centro de la región 2 (Rudmere), el mismo sitio que la prueba del mapa
            W, H = opc['viewport']['width'], opc['viewport']['height']
            m0 = pg.evaluate('(() => { const m = window.__mapa.mapa, c = m.centros[1], k = m.lado / m.N; return [(c % m.N + 0.5) * k, (Math.floor(c / m.N) + 0.5) * k]; })()')
            pg.evaluate(f'window.__mapa.ampliar(4, {m0[0]}, {m0[1]})')
            pg.wait_for_timeout(300)
            if nombre == 'pc': pg.mouse.click(W / 2, H / 2)
            else: pg.touchscreen.tap(W / 2, H / 2)
            pg.wait_for_timeout(300)
            pg.evaluate("document.getElementById('btnCerca').click()")
            pg.wait_for_function('window.__cerca && window.__cerca.listo', timeout=300000)
            m['lejos_4km'] = pg.evaluate('window.__cerca.medidas'); m['mem_lejos_MB'] = pg.evaluate(MEM)
            pg.evaluate("document.getElementById('btnJuego').click()"); pg.wait_for_timeout(4000)
            m['cerca'] = pg.evaluate('window.__cerca.juego'); m['llamadas_dibujo'] = pg.evaluate(LLAMADAS); m['mem_juego_MB'] = pg.evaluate(MEM)
            # rehacer el trozo de cerca a 100 m: lo que el juego queda parado cada vez que se cruza el borde
            rehacer = []
            for k in range(3):
                pg.evaluate(f'(() => {{ const v = window.__cerca.vj; window.__cerca.juegoEn(v.pos.x + 100, v.pos.z, 0); }})()'); pg.wait_for_timeout(2500)
                rehacer.append(pg.evaluate('window.__cerca.juego.ms'))
            m['ms_rehacer_cerca'] = rehacer; m['mem_tras_rehacer_MB'] = pg.evaluate(MEM)
            res[nombre] = m; print(nombre, json.dumps(m, ensure_ascii=False))
            ctx.close()
        nav.close()
finally:
    SERVIDOR.terminate()
if SALIDA: json.dump(res, open(SALIDA, 'w'), indent=1, ensure_ascii=False)
