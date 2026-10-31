# Prueba en navegador real (Chromium sin pantalla) del hito 1 de Kinhold.
# Construye una cabaña usando el propio juego, comprueba el estado y saca capturas.
# Se sirve por HTTP con la misma estructura que la web (jugar/construccion/ y recursos/personajes/taller-v12/), porque el
# personaje del taller se carga de un .glb aparte. MUTAR=1 apunta a una carpeta de modelos que no existe: tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v20'), f'{sitio}/recursos/personajes/taller-v20')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html' + ('?recursosMH=../../no-existe/' if os.environ.get('MUTAR') else '')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def esperar(pg, ms=400):
    pg.wait_for_timeout(ms)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    # ---------- PC ----------
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    pg.evaluate('localStorage.clear(); window.__kinhold.reiniciar()')
    esperar(pg, 800)

    K = 'window.__kinhold'
    def ev(js): return pg.evaluate(js)
    def poner(clase, tipo, x, z, planta=0, girar=0):
        ev(f"{K}.cambiarModo('construir'); {K}.estado.planta={planta}; {K}.seleccionar('{clase}','{tipo}');")
        for _ in range(girar): ev(f"{K}.girar()")
        ev(f"{K}.apuntar({x},{z})")
        v = ev(f"{K}.estado.candidato && {K}.estado.candidato.v")
        ev(f"{K}.colocar()")
        ev(f"{K}.terminarObras()")  # se construye por obras: aquí se terminan al momento (con acciones)
        return v

    print('PC: cabaña completa')
    v = poner('mojon', 'mojon', -3, -6)
    comprobar('mojón colocado', ev(f"!!{K}.mundo.mojon"))
    # cimientos 2x3 con la primera pieza en (1,1) sin giro
    for i in range(2):
        for j in range(3):
            v = poner('pieza', 'cim_piedra', 2*i+1, 2*j+1)
    comprobar('6 cimientos en una sola construcción', ev(f"{K}.mundo.construcciones.length===1 && {K}.mundo.construcciones[0].piezas.size===6"))
    # muros perimetrales
    poner('pieza', 'muro_tronco_puerta', 1, 0)
    poner('pieza', 'muro_tronco', 3, 0)
    poner('pieza', 'muro_tronco', 1, 6)
    poner('pieza', 'muro_tronco_ventana', 3, 6)
    for j in range(3):
        poner('pieza', 'muro_tronco' if j != 1 else 'muro_tronco_ventana', 0, 2*j+1)
        poner('pieza', 'muro_tronco', 4, 2*j+1)
    poner('pieza', 'puerta_varas', 1, 0)
    n = ev(f"{K}.mundo.construcciones[0].piezas.size")
    comprobar('muros y puerta colocados', n == 6 + 10 + 1, f'piezas={n}')
    # altillo en la planta 1 sobre las casillas del fondo
    for i in range(2):
        poner('pieza', 'suelo_tronco', 2*i+1, 5, planta=1)
    # tejado: lado izquierdo sube hacia +x (dir 3), derecho hacia -x (dir 1)
    for j in range(3):
        poner('pieza', 'tejado_paja', 1, 2*j+1, planta=1, girar=3)
        poner('pieza', 'tejado_paja', 3, 2*j+1, planta=1, girar=1)
    n = ev(f"{K}.mundo.construcciones[0].piezas.size")
    comprobar('altillo y tejado', n == 17 + 2 + 6, f'piezas={n}')
    rell = ev(f"(() => {{ let n=0; const r=window.__kinhold; return [...r.mundo.construcciones[0].piezas.values()].filter(p=>p.hueco==='r').length; }})()")
    ocultas = ev(f"[...document.querySelectorAll('#pestanas button')].map(b=>b.dataset.cat).includes('oculto')")
    comprobar('el hastial manual ya no aparece en el menú', not ocultas)
    # escalera hacia el altillo y decoración
    poner('pieza', 'escalera_mano', 1, 3, planta=0, girar=0)
    poner('deco', 'mesa', 3, 2)
    poner('deco', 'cama_paja', 1.2, 4.6)
    poner('deco', 'barril', 3.5, 4.5)
    poner('deco', 'candil', 0.6, 1.0)
    comprobar('decoración colocada', ev(f"{K}.mundo.decoracion.length") == 4)
    # empalizada con portón y cerca
    for x in [-5, -3, 7, 9]:
        poner('pieza', 'empalizada', x, -4)
    rots = ev(f"{K}.mundo.construcciones.map(c=>+c.rot.toFixed(3))")
    comprobar('girar tejados no tuerce construcciones nuevas', all(r == 0 for r in rots), f'giros={rots}')
    if os.environ.get('MUTAR_HIERBA'): ev('window.__sinDespejar = true')
    # cobertizo de una caída con pendiente continua de 2 casillas
    poner('pieza', 'cim_piedra', -11, 1)
    poner('pieza', 'cim_piedra', -11, 3)
    for x, z in [(-11, 0), (-11, 4), (-12, 1), (-12, 3), (-10, 1), (-10, 3)]:
        poner('pieza', 'muro_tabla', x, z)
    poner('pieza', 'tejado_tablilla', -11, 1, planta=1)
    poner('pieza', 'tejado_tablilla', -11, 3, planta=1)
    nt = ev(f"{K}.mundo.construcciones.find(c=>c.piezas.size>=10 && [...c.piezas.values()].some(p=>p.tipo==='tejado_tablilla')).piezas.size")
    comprobar('cobertizo de tablas con dos tramos de tejado', nt == 10, f'piezas={nt}')
    # la hierba, las flores y las matas no asoman por lo construido (estilo v5: hierba densa también en el centro)
    hb = ev(f"""(() => {{
      const ims = []; {K}.escena.traverse(o => {{ if (o.isInstancedMesh && ['hierba', 'flores', 'matorrales'].includes(o.name)) ims.push(o); }});
      const celdas = [];
      for (const c of {K}.mundo.construcciones) for (const p of c.piezas.values()) if (p.k === 0 && p.hueco === 'f') {{
        const co = Math.cos(c.rot), si = Math.sin(c.rot), lx = (p.i + 0.5) * 2, lz = (p.j + 0.5) * 2;
        celdas.push([c.ox + lx * co + lz * si, c.oz - lx * si + lz * co, c.rot]);
      }}
      let total = 0, dentro = 0, visibles = 0;
      for (const im of ims) for (let i = 0; i < im.count; i++) {{
        const a = im.instanceMatrix.array, e = i * 16; total++;
        if (Math.hypot(a[e], a[e + 1], a[e + 2]) < 1e-6) continue; visibles++;
        const x = a[e + 12], z = a[e + 14];
        for (const [cx, cz, r] of celdas) {{ const dx = x - cx, dz = z - cz, co = Math.cos(r), si = Math.sin(r);
          if (Math.abs(dx * co - dz * si) < 0.95 && Math.abs(dx * si + dz * co) < 0.95) {{ dentro++; break; }} }}
      }}
      return {{ total, visibles, dentro, celdas: celdas.length, mallas: ims.length }};
    }})()""")
    comprobar('hierba densa y ninguna planta asomando por los cimientos', hb['mallas'] == 3 and hb['total'] > 3000 and hb['celdas'] > 0 and hb['dentro'] == 0, json.dumps(hb))
    # un corral con cerca
    for z in [9, 11]:
        poner('pieza', 'cerca', 8, z)
    ev(f"{K}.cambiarModo('mover')")
    ev(f"{K}.pj.x=2; {K}.pj.z=-3; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=0.7; {K}.cam.dist=19")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/01_cabana_vista_general.png')

    print('PC: interior (tejado oculto)')
    ev(f"{K}.pj.x=2; {K}.pj.z=3; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=1.05; {K}.cam.dist=13")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/02_interior_sin_tejado.png')

    print('PC: decoración bajo el altillo (va al suelo de tu planta, no al de arriba)')
    # valravnx: estando debajo de un piso, la cama se ponía en el piso de arriba. Se apunta con el ratón a la casilla
    # de debajo del altillo (que se pinta por delante en la pantalla) y la mesa tiene que ir al cimiento de abajo.
    ev(f"{K}.pj.x=1; {K}.pj.z=5; {K}.pj.k=0; {K}.pj.y=0.3; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=1.05; {K}.cam.dist=13")
    esperar(pg, 600)
    ev(f"{K}.cambiarModo('construir'); {K}.seleccionar('deco','mesa')")
    sp = ev(f"{K}.proyectar(3, 0.3, 4.6)")
    pu = ev(f"{K}.apuntarPantalla({sp['x']}, {sp['y']})")
    comprobar('en la planta baja, bajo el altillo, la decoración apunta al suelo de abajo', pu is not None and pu['ySuperficie'] < 1.2, json.dumps(pu))
    esperar(pg, 500)
    pg.screenshot(path=f'{SALIDA}/02b_decoracion_bajo_el_altillo.png')
    ev(f"{K}.pj.k=1; {K}.pj.y=2.62")
    esperar(pg, 300)
    pu1 = ev(f"{K}.apuntarPantalla({sp['x']}, {sp['y']})")
    comprobar('y estando arriba, al suelo del altillo', pu1 is not None and pu1['ySuperficie'] > 2.4, json.dumps(pu1))
    ev(f"{K}.cambiarModo('mover'); {K}.pj.k=0; {K}.pj.y=0")

    print('PC: puerta y escalera')
    ev(f"{K}.pj.x=1; {K}.pj.z=-0.8; {K}.pj.k=0")
    esperar(pg, 300)
    if os.environ.get('MUTAR_TIRONES'): ev('window.__rehacerTodo = true')
    ev("window.__rehechos.todo = 0; window.__rehechos.pieza = 0")
    ev(f"{K}.llevar(); {K}.usar()")
    abierta = ev(f"[...{K}.mundo.construcciones[0].piezas.values()].find(p=>p.hueco==='p').abierta")
    comprobar('la puerta se abre con Usar', abierta is True)
    # valravnx, 28 oct: abrir o cerrar puertas daba tirones (se rehacía todo lo construido): solo se rehace esa pieza
    rh = ev("window.__rehechos")
    comprobar('al abrir la puerta solo se rehace esa pieza (nada entero)', rh['todo'] == 0 and rh['pieza'] == 1, json.dumps(rh))
    ev("window.__rehacerTodo = false")
    ev(f"{K}.pj.x=1; {K}.pj.z=3.4")
    esperar(pg, 300)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('la escalera sube a la planta 1', ev(f"{K}.pj.k") == 1, f"planta={ev(f'{K}.pj.k')}")
    esperar(pg, 600)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('y vuelve a bajar', ev(f"{K}.pj.k") == 0)

    print('PC: rechazo por carga')
    poner('pieza', 'cim_piedra', 13, 1)
    poner('pieza', 'muro_zarzo', 13, 0)
    poner('pieza', 'tejado_paja', 13, 1, planta=1)
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','muro_tronco'); {K}.apuntar(13,0)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('muro de troncos sobre zarzo rechazado con punto débil', (not v['ok']) and bool(v.get('debil')), json.dumps(v, ensure_ascii=False))
    ev(f"{K}.pj.x=11; {K}.pj.z=-3; {K}.cam.yaw=Math.PI+0.35; {K}.cam.pitch=0.7; {K}.cam.dist=11")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/03_rechazo_por_carga.png')

    print('PC: desmontar con cascada')
    ev(f"{K}.cambiarModo('desmontar'); {K}.pj.x=12; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.25; {K}.cam.pitch=0.6; {K}.cam.dist=11")
    esperar(pg, 900)
    pt = ev(f"{K}.proyectar(13, 0.8, 0)")
    ev(f"{K}.apuntarPieza({pt['x']}, {pt['y']})")
    pd = ev(f"{K}.estado.pendienteDesmontar && {{caen: {K}.estado.pendienteDesmontar.caen, key: {K}.estado.pendienteDesmontar.key}}")
    comprobar('al desmontar el muro de zarzo cae el tejado de encima', bool(pd) and pd['caen'] == 1, json.dumps(pd))
    esperar(pg, 300)
    pg.screenshot(path=f'{SALIDA}/04_desmontar_cascada.png')
    antes = ev(f"{K}.mundo.materiales.vara")
    ev(f"{K}.confirmarDesmontaje()")
    despues = ev(f"{K}.mundo.materiales.vara")
    comprobar('recupera 3 varas (75% de 4)', despues - antes == 3, f'{antes} → {despues}')
    reg = ev(f"{K}.registroAcciones.entradas.map(e => [e.autor, e.tipo, e.ok])")
    tipos = {t for _, t, okk in reg if okk}
    comprobar('lo construido, abierto y desmontado queda en el registro de acciones con su autor',
              {'mojon', 'colocar', 'usar', 'desmontar'} <= tipos and all(a == 'jugador:local' for a, _, _ in reg) and reg[-1][1] == 'desmontar',
              f'{len(reg)} acciones: ' + ', '.join(sorted(tipos)))

    print('PC: quitar un mueble con el ratón (clic, mover el ratón hasta «Confirmar» y confirmar)')
    poner('deco', 'barril', -6, 3)
    ndeco = ev(f"{K}.mundo.decoracion.length")
    barril = ev(f"{K}.mundo.decoracion.at(-1)")
    ev(f"{K}.cambiarModo('desmontar'); {K}.pj.x=-6; {K}.pj.z=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.7; {K}.cam.dist=9")
    esperar(pg, 900)
    pt = ev(f"{K}.proyectar({barril['x']}, {barril['y']} + 0.4, {barril['z']})")
    pg.mouse.move(pt['x'], pt['y'])
    pg.mouse.click(pt['x'], pt['y'])
    esperar(pg, 200)
    comprobar('el clic elige el barril y pide confirmar', ev(f"!!({K}.estado.pendienteDesmontar && {K}.estado.pendienteDesmontar.deco)") and pg.is_visible('#btnConfirmar'))
    caja = pg.locator('#btnConfirmar').bounding_box()
    # el ratón cruza el suelo (y lo que haya) camino del botón
    pg.mouse.move(caja['x'] + caja['width'] / 2, caja['y'] + caja['height'] / 2, steps=25)
    comprobar('al mover el ratón hacia «Confirmar» el barril sigue elegido', ev(f"!!({K}.estado.pendienteDesmontar && {K}.estado.pendienteDesmontar.deco && {K}.estado.pendienteDesmontar.deco.id === {barril['id']})") and pg.is_visible('#btnConfirmar'))
    pg.screenshot(path=f'{SALIDA}/04b_quitar_mueble_confirmar.png')
    pg.click('#btnConfirmar')
    comprobar('confirmando, el barril se quita', ev(f"{K}.mundo.decoracion.length") == ndeco - 1 and not ev(f"{K}.mundo.decoracion.some(d => d.id === {barril['id']})"))
    # con nada elegido, pasar el ratón sigue enseñando qué se quitaría
    pg.mouse.move(pt['x'] + 40, pt['y'] + 40); pg.mouse.move(pt['x'], pt['y'])
    comprobar('sin nada elegido, el botón de confirmar no aparece al pasar el ratón', not pg.is_visible('#btnConfirmar'))

    print('PC: cobertizo de pendiente continua')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-6; {K}.pj.z=1; {K}.cam.yaw=-Math.PI/2+0.5; {K}.cam.pitch=0.5; {K}.cam.dist=14")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/08_cobertizo_pendiente_continua.png')
    ev(f"{K}.pj.x=2; {K}.pj.z=12; {K}.cam.yaw=0.5; {K}.cam.pitch=0.55; {K}.cam.dist=15")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/09_cabana_desde_atras.png')

    print('PC: primer plano de muros')
    ev(f"{K}.pj.x=2.2; {K}.pj.z=-3.2; {K}.pj.rot=0; {K}.cam.yaw=Math.PI+0.45; {K}.cam.pitch=0.32; {K}.cam.dist=7.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/10_primer_plano_fachada.png')
    ev(f"{K}.pj.x=2; {K}.pj.z=9.5; {K}.cam.yaw=0.35; {K}.cam.pitch=0.32; {K}.cam.dist=8")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/11_primer_plano_trasera_ventana.png')

    print('PC: guardado')
    ev("location.reload()")
    pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    esperar(pg, 600)
    n2 = ev(f"{K}.mundo.construcciones.reduce((a,c)=>a+c.piezas.size,0)")
    comprobar('la partida se conserva al recargar', n2 > 20, f'piezas={n2}')

    print('PC: casa de dos plantas con tejado (madera más resistente)')
    res = ev("""(() => {
      const K = window.__kinhold, m = K.mundo;
      const c = { id: m.siguienteId++, ox: -15, oz: -3, rot: 0, piezas: new Map() }; m.construcciones.push(c);
      const H = { cim_tronco: 'f', suelo_tronco: 'f', muro_tronco: 'e', muro_tronco_puerta: 'e', muro_tronco_ventana: 'e', tejado_paja: 'r', escalera_mano: 'l' };
      const fallos = [];
      const pon = (tipo, i, j, k, d = 0, dir = 0) => { const p = { tipo, hueco: H[tipo], i, j, k, dir, abierta: false }; if (H[tipo] === 'e') p.d = d;
        const r = m.colocar({ construccion: c, nueva: false, pieza: p }); if (!r.ok) fallos.push(`${tipo} ${i},${j},${k}: ${r.motivo}`); };
      for (const k in m.materiales) m.materiales[k] += 500;
      const N = 4, M = 4;
      const celdas = []; for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) celdas.push([i, j]);
      const borde = ([i, j]) => Math.min(i, N - 1 - i, j, M - 1 - j); celdas.sort((a, b) => borde(a) - borde(b)); // de fuera hacia dentro
      for (const [i, j] of celdas) pon('cim_tronco', i, j, 0);
      for (let k = 0; k < 2; k++) {
        if (k) for (const [i, j] of celdas) if (!(i === 0 && j === 1)) pon('suelo_tronco', i, j, k);
        for (let i = 0; i < N; i++) { pon(k === 0 && i === 1 ? 'muro_tronco_puerta' : 'muro_tronco', i, 0, k, 0); pon(i === 2 ? 'muro_tronco_ventana' : 'muro_tronco', i, M, k, 0); }
        for (let j = 0; j < M; j++) { pon('muro_tronco', 0, j, k, 1); pon(j === 1 ? 'muro_tronco_ventana' : 'muro_tronco', N, j, k, 1); }
      }
      pon('escalera_mano', 0, 1, 0);
      // tejado a dos aguas: la mitad de delante sube hacia atrás y la de atrás hacia delante
      for (const [i, j] of celdas) pon('tejado_paja', i, j, 2, 0, j < M / 2 ? 0 : 2);
      K.reconstruir();
      return { fallos, n: c.piezas.size };
    })()""")
    comprobar('casa de 4×4, dos plantas y tejado de troncos: entra entera (también las esquinas del tejado)', not res['fallos'], json.dumps(res, ensure_ascii=False)[:300])
    # rehacer lo construido copia los modelos ya hechos en vez de hacerlos otra vez (valravnx, 28 oct: tirones en línea
    # al terminar obras y al abrir puertas): la segunda vez no se hace ningún modelo nuevo, y tarda mucho menos
    if os.environ.get('MUTAR_TIRONES'): ev('window.__sinCopiarModelos = true')
    t_rehacer = ev(f"""(() => {{ const K = {K}; K.reconstruir(); const h0 = window.__modelos.hechos, c0 = window.__modelos.copiados;
      const t = (f, k) => {{ const t0 = performance.now(); for (let i = 0; i < k; i++) f(); return (performance.now() - t0) / k; }};
      const con = t(() => K.reconstruir(), 3); const sinCopias = !!window.__sinCopiarModelos; window.__sinCopiarModelos = true; const sin = t(() => K.reconstruir(), 3); window.__sinCopiarModelos = sinCopias;
      return {{ nuevos: window.__modelos.hechos - h0, copiados: window.__modelos.copiados - c0, con: Math.round(con), sin: Math.round(sin) }}; }})()""")
    comprobar('rehacerlo todo otra vez no hace modelos nuevos: los copia', t_rehacer['nuevos'] == 0 and t_rehacer['copiados'] > 50, json.dumps(t_rehacer))
    comprobar('y tarda menos de la mitad que haciéndolos de cero', t_rehacer['con'] * 2 < t_rehacer['sin'], f"{t_rehacer['con']} ms frente a {t_rehacer['sin']} ms")
    ev('window.__sinCopiarModelos = false')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-11; {K}.pj.z=-5; {K}.cam.yaw=Math.PI+0.7; {K}.cam.pitch=0.5; {K}.cam.dist=24")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/12_casa_dos_plantas.png')
    ev(f"{K}.pj.x=-11; {K}.pj.z=8; {K}.cam.yaw=0.7; {K}.cam.pitch=0.5; {K}.cam.dist=24")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/13_casa_dos_plantas_detras.png')

    print('PC: escalera de tablas (se sube andando)')
    for x, z in [(9, -13), (9, -11), (11, -13), (11, -11)]:
        poner('pieza', 'cim_piedra', x, z)
    poner('pieza', 'muro_tronco', 9, -10)
    poner('pieza', 'muro_tronco', 11, -10)
    poner('pieza', 'muro_tronco', 12, -11)
    poner('pieza', 'suelo_tronco', 9, -11, planta=1)
    poner('pieza', 'suelo_tronco', 11, -11, planta=1)
    v = poner('pieza', 'escalera_tabla', 9, -13)
    comprobar('escalera de tablas colocada desde el menú', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','suelo_tronco'); {K}.apuntar(9,-13)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('encima de la escalera no deja poner suelo (hueco abierto)', not v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    def andar(tecla, cond, maximo=6000):
        pg.keyboard.down(tecla)
        t = 0
        while t < maximo and not ev(cond):
            pg.wait_for_timeout(100); t += 100
        pg.keyboard.up(tecla)
        return t
    # abajo, delante de la escalera, mirando hacia donde sube (+z)
    ev(f"{K}.pj.x=9; {K}.pj.z=-14.6; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.45; {K}.cam.dist=9")
    esperar(pg, 400)
    andar('w', f"{K}.pj.z > -13")
    esperar(pg, 200)
    ymedio, kmedio = ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('a media escalera vas subiendo', 0.3 < ymedio < 2.4, f'y={ymedio:.2f} planta={kmedio}')
    ev(f"{K}.cam.yaw=Math.PI/2+0.9; {K}.cam.pitch=0.35; {K}.cam.dist=8")
    esperar(pg, 500)
    pg.screenshot(path=f'{SALIDA}/15_escalera_subiendo.png')
    ev(f"{K}.cam.yaw=Math.PI")
    andar('w', f"{K}.pj.z > -11.2")
    esperar(pg, 600)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('andando se llega arriba: planta 1, sobre el suelo', k == 1 and abs(y - 2.62) < 0.1, f'planta={k} y={y:.2f}')
    ev(f"{K}.cam.yaw=Math.PI/2+0.9; {K}.cam.pitch=0.5; {K}.cam.dist=9")
    esperar(pg, 500)
    pg.screenshot(path=f'{SALIDA}/16_escalera_arriba.png')
    ev(f"{K}.cam.yaw=Math.PI")
    andar('s', f"{K}.pj.z < -14.3")
    esperar(pg, 600)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('y andando hacia atrás se vuelve a bajar a la planta 0', k == 0 and y < 0.2, f'planta={k} y={y:.2f}')
    # por debajo del tramo alto: entrando por detrás a ras de suelo no te sube
    ev(f"{K}.pj.x=10.4; {K}.pj.z=-12.3; {K}.pj.k=0; {K}.pj.y=0.12")
    esperar(pg, 200)
    ev(f"{K}.cam.yaw=Math.PI/2")
    andar('w', f"{K}.pj.x < 9.6", 3000)
    esperar(pg, 300)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('por debajo del tramo alto se pasa sin subir', k == 0 and y < 0.3, f'planta={k} y={y:.2f}')
    ev(f"{K}.pj.x=10.2; {K}.pj.z=-15; {K}.pj.k=0; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.4; {K}.cam.dist=8.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/14_escalera_de_tablas.png')

    print('PC: barandilla (medio muro en el borde del suelo de arriba)')
    # el suelo de arriba (casillas de z=-11) da a la casilla de x=11, z=-13, que no tiene suelo en la planta 1
    v = poner('pieza', 'medio_muro', 11, -12, planta=1)
    comprobar('medio muro colocado como barandilla en la planta 1', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    def arriba_en(x, z):
        ev(f"{K}.pj.x={x}; {K}.pj.z={z}; {K}.pj.k=1; {K}.pj.y=2.62")
        esperar(pg, 300)
    # control: por el borde sin barandilla (hacia +x) sí se cae a la planta 0
    arriba_en(11, -11)
    ev(f"{K}.cam.yaw=-Math.PI/2")
    andar('w', f"{K}.pj.k === 0", 2500)
    esperar(pg, 300)
    comprobar('sin barandilla, por el borde se cae a la planta 0', ev(f"{K}.pj.k") == 0, f"planta={ev(f'{K}.pj.k')} x={ev(f'{K}.pj.x'):.2f}")
    # con barandilla (hacia -z) no se pasa
    arriba_en(11, -11)
    ev(f"{K}.cam.yaw=0")
    andar('w', f"{K}.pj.k === 0 || {K}.pj.z < -12.2", 2000)
    esperar(pg, 300)
    k, z = ev(f"{K}.pj.k"), ev(f"{K}.pj.z")
    comprobar('con la barandilla no se cae: sigue en la planta 1, antes del borde', k == 1 and z > -12, f'planta={k} z={z:.2f}')
    # desde fuera y desde abajo, para ver la barandilla en el borde
    ev(f"{K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI-0.5; {K}.cam.pitch=0.25; {K}.cam.dist=7")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/21_barandilla_planta_1.png')

    print('PC: trampilla en el hueco de la escalera de tablas')
    # MUTAR_TRAMPILLA=1: la trampilla cerrada no tapa nada (como antes de esta pieza): la prueba tiene que fallar
    poner('pieza', 'suelo_tronco', 11, -13, planta=1)  # suelo a un lado de la escalera: la bisagra va ahí
    v = poner('pieza', 'trampilla', 9, -13, planta=1)
    comprobar('trampilla colocada desde el menú en el hueco de la escalera', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','trampilla'); {K}.apuntar(11,-11)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('donde no hay escalera no deja ponerla', not v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    if os.environ.get('MUTAR_TRAMPILLA'):
        ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.hueco === 't').forEach(p => p.abierta = true); {K}.reconstruir()")
    trampilla = f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].find(p => p.hueco === 't')"
    comprobar('la bisagra va en el lado con suelo (+x)', ev(f"{trampilla}.dir") == 1, str(ev(f"{trampilla}.dir")))
    comprobar('sale cerrada', ev(f"{trampilla}.abierta") is False or os.environ.get('MUTAR_TRAMPILLA') is not None)
    # cerrada: desde abajo no se sube por la escalera
    ev(f"{K}.pj.x=9; {K}.pj.z=-14.6; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.45; {K}.cam.dist=9")
    esperar(pg, 400)
    andar('w', f"{K}.pj.k === 1", 2500)
    esperar(pg, 300)
    k, y, z = ev(f"{K}.pj.k"), ev(f"{K}.pj.y"), ev(f"{K}.pj.z")
    comprobar('con la trampilla cerrada no se sube por la escalera', k == 0 and y < 0.3 and z < -13.8, f'planta={k} y={y:.2f} z={z:.2f}')
    # cerrada: arriba se pisa como el suelo
    arriba_en(9, -13)
    esperar(pg, 400)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('arriba, encima de la trampilla cerrada, se queda en la planta 1', k == 1 and abs(y - 2.62) < 0.1, f'planta={k} y={y:.2f}')
    ev(f"{K}.pj.x=9.3; {K}.pj.z=-11.4; {K}.pj.rot=Math.PI; {K}.cam.yaw=0.5; {K}.cam.pitch=0.75; {K}.cam.dist=5.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/39_trampilla_cerrada.png')
    # desde abajo, junto a la escalera, Usar la abre; abierta se sube andando
    ev(f"{K}.pj.x=9; {K}.pj.z=-14.6; {K}.pj.k=0; {K}.pj.y=0")
    esperar(pg, 300)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('desde abajo, Usar abre la trampilla', ev(f"{trampilla}.abierta") is True)
    ev(f"{K}.cam.yaw=Math.PI")
    andar('w', f"{K}.pj.z > -11.2")
    esperar(pg, 600)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('abierta, la escalera vuelve a subir a la planta 1', k == 1 and abs(y - 2.62) < 0.1, f'planta={k} y={y:.2f}')
    ev(f"{K}.pj.rot=Math.PI; {K}.cam.yaw=0.5; {K}.cam.pitch=0.75; {K}.cam.dist=5.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/40_trampilla_abierta.png')
    # encima de la escalera no deja cerrarla; fuera de ella, sí (desde arriba)
    ev(f"{K}.pj.x=9; {K}.pj.z=-12.4; {K}.pj.k=1; {K}.pj.y=2.0")
    esperar(pg, 200)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('estando en la escalera no se cierra', ev(f"{trampilla}.abierta") is True)
    arriba_en(9.5, -11.3)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('desde arriba, fuera de la escalera, Usar la cierra', ev(f"{trampilla}.abierta") is False)

    print('PC: contraventanas en los muros con ventana')
    v = poner('pieza', 'contraventana', 3, 6)
    comprobar('contraventana colocada en el muro de troncos con ventana', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    v = poner('pieza', 'contraventana', 3, 0)
    comprobar('en un muro sin ventana no se pone', bool(v) and not v['ok'], json.dumps(v, ensure_ascii=False))
    for x, z in [(15, -13)]:
        poner('pieza', 'cim_piedra', x, z)
    v = poner('pieza', 'muro_tabla_ventana', 15, -14)
    comprobar('muro de tablas con ventana colocado desde el menú', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    poner('pieza', 'muro_tabla', 14, -13)
    v = poner('pieza', 'contraventana', 15, -14)
    comprobar('y su contraventana', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    cvs = f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.hueco === 'w')"
    def foto_tablas(nombre):  # el jugador a un lado, para que no tape la ventana
        ev(f"{K}.pj.x=13.6; {K}.pj.z=-15.2; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI-0.5; {K}.cam.pitch=0.22; {K}.cam.dist=4.6")
        esperar(pg, 900)
        pg.screenshot(path=f'{SALIDA}/{nombre}.png')
    def foto_troncos(nombre):
        ev(f"{K}.pj.x=1.5; {K}.pj.z=7.1; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=0.4; {K}.cam.yaw=0.5; {K}.cam.pitch=0.22; {K}.cam.dist=4.6")
        esperar(pg, 900)
        pg.screenshot(path=f'{SALIDA}/{nombre}.png')
    # va por fuera: el lado del muro que no da al cimiento (aquí, hacia -z: el muro está en z=-14 y el cimiento detrás)
    zh = ev(f"(() => {{ const zs = []; const v = new ({K}.escena.position.constructor)(); {K}.escena.traverse(o => {{ if (o.name === 'hoja' && o.parent) {{ let r = o; while (r && !(r.userData && r.userData.key)) r = r.parent; if (r && r.userData.key.startsWith('w:')) {{ o.getWorldPosition(v); if (Math.abs(v.x - 15) < 1.2 && Math.abs(v.z + 14) < 1) zs.push(+v.z.toFixed(3)); }} }} }}); return zs; }})()")
    comprobar('la contraventana va por fuera del muro, no por el lado del cimiento', len(zh) == 2 and all(z < -14.05 for z in zh), json.dumps(zh))
    foto_tablas('41_contraventana_tablas_cerrada')
    ev(f"{K}.pj.x=15.2; {K}.pj.z=-15.0")
    esperar(pg, 300)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('la contraventana se abre con Usar', ev(f"{cvs}.find(p => p.k === 0 && p.tipo === 'contraventana' && p.abierta) !== undefined"))
    foto_tablas('42_contraventana_tablas_abierta')
    foto_troncos('43_contraventana_troncos_cerrada')
    ev(f"{K}.pj.x=3.2; {K}.pj.z=7.0")
    esperar(pg, 300)
    ev(f"{K}.llevar(); {K}.usar()")
    foto_troncos('44_contraventana_troncos_abierta')
    comprobar('las dos abiertas', ev(f"{cvs}.every(p => p.abierta)"), json.dumps(ev(f"{cvs}.map(p => p.abierta)")))
    ev(f"{K}.pj.x=3.2; {K}.pj.z=7.0")
    esperar(pg, 300)
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('y se vuelve a cerrar', ev(f"{cvs}.filter(p => p.abierta).length") == 1)

    print('PC: tejado de teja')
    for x, z in [(1, -17), (3, -17), (1, -15), (3, -15)]:
        poner('pieza', 'cim_piedra', x, z)
    for x in [1, 3]:
        poner('pieza', 'muro_tronco_puerta' if x == 1 else 'muro_tronco', x, -18)
        poner('pieza', 'muro_tronco', x, -14)
    for z in [-17, -15]:
        poner('pieza', 'muro_tronco', 0, z)
        poner('pieza', 'muro_tronco_ventana' if z == -15 else 'muro_tronco', 4, z)
    tejas0 = ev(f"{K}.mundo.materiales.teja")
    vs = [poner('pieza', 'tejado_teja', x, z, planta=1, girar=0 if z == -17 else 2) for x in [1, 3] for z in [-17, -15]]
    comprobar('tejado de teja a dos aguas colocado desde el menú (4 tramos)', all(v and v['ok'] for v in vs), json.dumps(vs, ensure_ascii=False)[:300])
    nte = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'tejado_teja' && !p.obra).length")
    comprobar('los 4 tramos terminados y cobradas 40 tejas', nte == 4 and tejas0 - ev(f"{K}.mundo.materiales.teja") == 40, f'tramos={nte} tejas {tejas0} → {ev(f"{K}.mundo.materiales.teja")}')
    comprobar('la teja sale en la barra de materiales', 'teja' in ev("document.getElementById('materiales').textContent"))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0; {K}.pj.x=-0.6; {K}.pj.z=-19.8; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI-0.7; {K}.cam.pitch=0.45; {K}.cam.dist=12")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/45_tejado_teja.png')
    ev(f"{K}.pj.x=2.0; {K}.pj.z=-18.8; {K}.pj.rot=Math.PI*0.75; {K}.cam.yaw=Math.PI-0.55; {K}.cam.pitch=0.85; {K}.cam.dist=6")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/46_tejado_teja_de_cerca.png')
    ev(f"{K}.pj.x=5.5; {K}.pj.z=-12.5; {K}.cam.yaw=0.8; {K}.cam.pitch=0.4; {K}.cam.dist=11")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/47_tejado_teja_detras.png')

    print('PC: el tejado terminado se pisa (un solo andamio para todo el tejado)')
    # valravnx, 31 oct: «los tejados deben poder ser pisables para poder construir tejados con un solo andamio, por
    # ahora los atraviesas y caes». Se sale del andamio (planta 1, a 2,62 m) al alero del tramo de z=-17 (sube hacia +z)
    # y se anda por él hasta la cumbrera.
    if os.environ.get('MUTAR_TEJADO'): ev('window.__sinPisarTejados = true')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=1.2; {K}.pj.z=-17.8; {K}.pj.k=1; {K}.pj.y=2.62; {K}.pj.rot=0; {K}.cam.yaw=Math.PI+0.9; {K}.cam.pitch=0.35; {K}.cam.dist=7")
    esperar(pg, 900)
    y_alero = ev(f"{K}.pj.y"); k_alero = ev(f"{K}.pj.k")
    for paso_z in range(1, 9):  # andando: de 20 en 20 cm (de golpe, un escalón de más de 0,8 m no se sube)
        ev(f"{K}.pj.z={-17.8 + 0.2 * paso_z:.2f}"); esperar(pg, 300)
    esperar(pg, 600)
    y_cumbre = ev(f"{K}.pj.y"); k_cumbre = ev(f"{K}.pj.k")
    comprobar('en el alero del tejado no se cae: sigue en la planta 1, sobre la paja/teja', k_alero == 1 and 2.6 < y_alero < 3.2, f'k={k_alero} y={y_alero:.2f}')
    comprobar('andando hacia la cumbrera se sube por la pendiente (unos 0,96 m en 1,6 m)', k_cumbre == 1 and 0.8 < y_cumbre - y_alero < 1.1, f'k={k_cumbre} y={y_alero:.2f} → {y_cumbre:.2f}')
    pg.screenshot(path=f'{SALIDA}/47b_de_pie_en_el_tejado.png')
    ev(f"{K}.pj.x=6.5; {K}.pj.z=-17"); esperar(pg, 900)
    comprobar('fuera del tejado, se cae al suelo', ev(f"{K}.pj.k") == 0 and ev(f"{K}.pj.y") < 0.5, f"k={ev(f'{K}.pj.k')} y={ev(f'{K}.pj.y'):.2f}")

    print('PC: menú de Usar con clic derecho (elegir qué usar si hay varias cosas al alcance)')
    # valravnx, 31 oct: «poder hacer clic derecho y seleccionar qué quieres usar si es que hay varias opciones en la zona».
    # Junto a la puerta de varas de la cabaña, con una piedra en el suelo al lado: Usar a secas abre la puerta; con el
    # menú se coge la piedra sin tocar la puerta.
    ev(f"{K}.pj.x=1; {K}.pj.z=-0.7; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=0; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=0.5; {K}.cam.dist=7")
    ev(f"{K}.sueloObjetos.suelo.dejar({{ tipo: 'piedra', n: 1 }}, 1.6, -0.9, Date.now(), {K}.AUTOR_LOCAL, true); {K}.sueloObjetos.refrescar()")
    esperar(pg, 600)
    ops = ev(f"{K}.opcionesUsar()")
    comprobar('al alcance: la puerta y la piedra del suelo', any('Puerta de varas' in o for o in ops) and any('Coger del suelo' in o for o in ops), json.dumps(ops, ensure_ascii=False))
    if os.environ.get('MUTAR_MENU'): ev("document.getElementById('btnUsar').addEventListener('contextmenu', e => e.stopImmediatePropagation(), true)")
    pg.click('#btnUsar', button='right')
    esperar(pg, 400)
    menu = ev(f"{K}.menuUsar()")
    comprobar('clic derecho en Usar abre el menú con las dos cosas', menu is not None and len(menu) >= 2, json.dumps(menu, ensure_ascii=False))
    pg.screenshot(path=f'{SALIDA}/47c_menu_usar.png')
    puerta0 = ev(f"[...{K}.mundo.construcciones[0].piezas.values()].find(p => p.tipo === 'puerta_varas').abierta || false")
    piedras0 = ev(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'piedra').length")
    if menu: pg.locator('#menuUsar button', has_text='Coger del suelo').first.click()
    esperar(pg, 500)
    puerta1 = ev(f"[...{K}.mundo.construcciones[0].piezas.values()].find(p => p.tipo === 'puerta_varas').abierta || false")
    piedras1 = ev(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'piedra').length")
    comprobar('elegir «Coger del suelo» coge la piedra y no toca la puerta; el menú se cierra', piedras1 == piedras0 - 1 and puerta1 == puerta0 and ev(f"{K}.menuUsar()") is None, f'piedras {piedras0} → {piedras1}, puerta {puerta0} → {puerta1}')
    pg.click('#btnUsar')
    esperar(pg, 400)
    comprobar('Usar a secas sigue haciendo lo de siempre (abre la puerta)', ev(f"[...{K}.mundo.construcciones[0].piezas.values()].find(p => p.tipo === 'puerta_varas').abierta || false") != puerta1)
    pg.click('#btnUsar')

    print('PC: remate de tejado (esquinas): casa en L con limatesa y limahoya')
    # lejos de lo demás, dentro de la tierra (mojón en -3,-6, radio 20): ala de 3×2 y ala de 2×1 que sale de su punta
    celdasL = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2), (2, 2)]
    wx = lambda i: -7 + 2 * i
    wz = lambda j: -24 + 2 * j
    for i, j in celdasL:
        poner('pieza', 'cim_piedra', wx(i), wz(j))
    hayL = set(celdasL)
    for i, j in celdasL:
        for di, dj in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            if (i + di, j + dj) not in hayL:
                poner('pieza', 'muro_tabla', wx(i) + di, wz(j) + dj)
    tejadoL = [('tejado_tablilla', 0, 0, 0), ('tejado_tablilla', 1, 0, 0), ('remate_tablilla', 2, 0, 1), ('tejado_tablilla', 0, 1, 2),
               ('tejado_tablilla', 2, 1, 1), ('tejado_tablilla', 1, 2, 3), ('tejado_tablilla', 2, 2, 1)]
    tablas0 = ev(f"{K}.mundo.materiales.tabla")
    vs = [poner('pieza', t, wx(i), wz(j), planta=1, girar=d) for t, i, j, d in tejadoL]
    # el rincón, el último: el fantasma ya se ve como limahoya antes de ponerlo
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','remate_tablilla'); {K}.girar(); {K}.girar(); {K}.girar(); {K}.apuntar({wx(1)},{wz(1)})")
    comprobar('el fantasma del remate en el rincón tiene forma de limahoya', ev(f"{K}.fantasmaForma") == 'hoya', str(ev(f"{K}.fantasmaForma")))
    vs.append(poner('pieza', 'remate_tablilla', wx(1), wz(1), planta=1, girar=3))
    comprobar('casa en L: tramos y remates colocados desde el menú', all(v and v['ok'] for v in vs), json.dumps(vs, ensure_ascii=False)[:300])
    rem = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'remate_tablilla' && !p.obra).map(p => p.dir).sort().join()")
    comprobar('los dos remates terminados, con su dirección', rem == '1,3', rem)
    comprobar('cobradas las tablas de 6 tramos y 2 remates (18 + 4)', tablas0 - ev(f"{K}.mundo.materiales.tabla") == 22, f'{tablas0} → {ev(f"{K}.mundo.materiales.tabla")}')
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0; {K}.pj.x=0.5; {K}.pj.z=-27; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI-0.75; {K}.cam.pitch=0.55; {K}.cam.dist=12")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/48_remate_esquina.png')
    ev(f"{K}.pj.x=-3; {K}.pj.z=-23; {K}.cam.yaw=Math.PI-0.75; {K}.cam.pitch=0.95; {K}.cam.dist=6.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/49_remate_esquina_de_cerca.png')
    ev(f"{K}.pj.x=-9.5; {K}.pj.z=-17; {K}.pj.rot=0; {K}.cam.yaw=-0.75; {K}.cam.pitch=0.6; {K}.cam.dist=10")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/50_remate_rincon.png')

    print('PC: los muebles del piso de arriba no se ven desde abajo con el techo puesto')
    # un taburete arriba, sobre el suelo de la planta 1 (casilla de z=-11), y otro abajo, debajo de ese suelo
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.pj.k=1; {K}.seleccionar('deco','taburete'); {K}.apuntar(10.4, -10.6, 2.62); {K}.colocar()")
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=0; {K}.pj.k=0; {K}.seleccionar('deco','taburete'); {K}.apuntar(9.6, -10.6, 0); {K}.colocar()")
    ev(f"{K}.cambiarModo('mover')")
    ids = ev(f"(() => {{ const ds = {K}.mundo.decoracion.filter(d => d.tipo === 'taburete' && Math.abs(d.z + 10.6) < 0.01); return {{ arriba: (ds.find(d => d.y > 1) || {{}}).id, abajo: (ds.find(d => d.y < 1) || {{}}).id }}; }})()")
    comprobar('taburetes colocados arriba y abajo', ids.get('arriba') is not None and ids.get('abajo') is not None, json.dumps(ids))
    visible = lambda i: ev(f"(() => {{ let v = null; {K}.escena.traverse(x => {{ if (x.userData && x.userData.deco && x.userData.deco.id === {i}) v = x.visible; }}); return v; }})()")
    ev(f"{K}.pj.x=10; {K}.pj.z=-10.5; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI*0.75; {K}.cam.pitch=0.6; {K}.cam.dist=8")
    esperar(pg, 500)
    comprobar('abajo, bajo el suelo de arriba: el mueble de arriba no se ve y el de abajo sí',
              visible(ids['arriba']) is False and visible(ids['abajo']) is True, f"arriba={visible(ids['arriba'])} abajo={visible(ids['abajo'])}")
    pg.screenshot(path=f'{SALIDA}/21b_abajo_sin_muebles_de_arriba.png')
    ev(f"{K}.pj.x=10; {K}.pj.z=-11.2; {K}.pj.k=1; {K}.pj.y=2.62")
    esperar(pg, 500)
    comprobar('arriba, el mueble de arriba se ve', visible(ids['arriba']) is True)
    ev(f"{K}.pj.x=16; {K}.pj.z=-20; {K}.pj.k=0; {K}.pj.y=0")
    esperar(pg, 400)
    comprobar('fuera, al aire libre, se ven los dos', visible(ids['arriba']) is True and visible(ids['abajo']) is True)
    ev(f"{K}.mundo.quitarDecoracion({ids['arriba']}); {K}.mundo.quitarDecoracion({ids['abajo']}); {K}.reconstruir()")

    print('PC: WASD con la distribución de teclado rusa y sin teclas pegadas al perder el foco')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=16; {K}.pj.z=-20; {K}.pj.k=0; {K}.cam.yaw=0")
    esperar(pg, 200)
    z0 = ev(f"{K}.pj.z")
    # con la distribución rusa, la tecla W escribe «ц»: el juego tiene que leer la tecla física (KeyW)
    ev("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ц', code: 'KeyW' }))")
    # hasta que se mueva (no un tiempo fijo: a 1-2 fps sin tarjeta gráfica el juego va a cámara lenta)
    t = 0
    while t < 6000 and abs(ev(f"{K}.pj.z") - z0) < 0.6:
        pg.wait_for_timeout(100); t += 100
    z1 = ev(f"{K}.pj.z")
    ev("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ц', code: 'KeyW' }))")
    comprobar('con la distribución rusa, W (que escribe «ц») mueve al personaje', abs(z1 - z0) >= 0.6, f'z: {z0:.2f} → {z1:.2f}')
    comprobar('y al soltarla no queda ninguna tecla pulsada', ev(f"{K}.teclas.length") == 0, json.dumps(ev(f"{K}.teclas")))
    # tecla pulsada y la ventana pierde el foco (otra pestaña, una notificación): no se queda andando sola
    ev("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD' }))")
    esperar(pg, 300)
    ev("window.dispatchEvent(new Event('blur'))")
    esperar(pg, 100)
    x1 = ev(f"{K}.pj.x"); esperar(pg, 600); x2 = ev(f"{K}.pj.x")
    comprobar('al perder el foco se sueltan las teclas: no sigue andando', ev(f"{K}.teclas.length") == 0 and abs(x2 - x1) < 0.05, f'x: {x1:.2f} → {x2:.2f}')

    print('PC: portillo de la cerca (se abre con Usar)')
    # dentro de la tierra (mojón en -3,-6, radio 20) y lejos de lo demás
    for x in [-10, -6]:
        poner('pieza', 'cerca', x, 12)
    v = poner('pieza', 'cerca_portillo', -8, 12)
    comprobar('portillo colocado entre dos tramos de cerca', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    pc = ev(f"""(() => {{ for (const c of {K}.mundo.construcciones) for (const p of c.piezas.values()) if (p.tipo === 'cerca_portillo') {{
        const lx = p.d === 0 ? (p.i + 0.5) * 2 : p.i * 2, lz = p.d === 0 ? p.j * 2 : (p.j + 0.5) * 2;
        const co = Math.cos(c.rot), si = Math.sin(c.rot);
        return {{ x: c.ox + lx * co + lz * si, z: c.oz - lx * si + lz * co, d: p.d, cercas: [...c.piezas.values()].filter(q => q.tipo === 'cerca').length }}; }} return null; }})()""")
    comprobar('portillo en la misma rejilla que la cerca, en línea con ella', pc is not None and pc['d'] == 0 and pc['cercas'] == 2, json.dumps(pc))
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x={pc['x']}; {K}.pj.z={pc['z']}+1.4; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=0")
    esperar(pg, 300)
    andar('w', f"{K}.pj.z < {pc['z']} - 0.5", 1500)
    comprobar('cerrado no deja pasar', ev(f"{K}.pj.z") > pc['z'], f"z={ev(f'{K}.pj.z'):.2f} portillo={pc['z']:.2f}")
    ev(f"{K}.pj.rot=Math.PI; {K}.cam.yaw=0.6; {K}.cam.pitch=0.35; {K}.cam.dist=6")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/22_portillo_cerrado.png')
    ev(f"{K}.llevar(); {K}.usar()")
    abierto = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].find(p => p.tipo === 'cerca_portillo').abierta")
    comprobar('Usar abre el portillo', abierto is True)
    comprobar('y queda en el registro de acciones', ev(f"{K}.registroAcciones.entradas.at(-1).tipo === 'usar' && {K}.registroAcciones.entradas.at(-1).ok"))
    ev(f"{K}.cam.yaw=0")
    andar('w', f"{K}.pj.z < {pc['z']} - 0.8", 2500)
    comprobar('abierto se pasa al otro lado', ev(f"{K}.pj.z") < pc['z'] - 0.5, f"z={ev(f'{K}.pj.z'):.2f}")
    ev(f"{K}.pj.x={pc['x']}+0.6; {K}.pj.z={pc['z']}+1.8; {K}.pj.rot=Math.PI; {K}.cam.yaw=0.7; {K}.cam.pitch=0.4; {K}.cam.dist=6")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/23_portillo_abierto.png')

    print('PC: obras (marco, material y tiempo)')
    # lejos de lo demás, dentro de la tierra (mojón en -3,-6, radio 20)
    def marco(tipo, x, z, planta=0):
        ev(f"{K}.cambiarModo('construir'); {K}.estado.planta={planta}; {K}.seleccionar('pieza','{tipo}'); {K}.apuntar({x},{z})")
        ev(f"{K}.colocar()")
    antes = ev(f"{K}.mundo.materiales.tronco")
    poner('pieza', 'cim_tronco', -15, -11)
    poner('pieza', 'cim_tronco', -13, -11)
    marco('muro_tronco', -15, -12)
    marco('muro_tronco_ventana', -16, -11)
    marco('poste', -12, -12)
    obras = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.obra).map(p => p.tipo)")
    comprobar('colocar pone solo el marco: queda como obra', sorted(obras) == ['muro_tronco', 'muro_tronco_ventana', 'poste'], json.dumps(obras))
    comprobar('el marco no cobra material (solo los dos cimientos terminados)', antes - ev(f"{K}.mundo.materiales.tronco") == 4, f"{antes} → {ev(f'{K}.mundo.materiales.tronco')}")
    comprobar('la obra se dibuja con su armazón', ev(f"(() => {{ let n = 0; {K}.escena.traverse(o => {{ if (o.name === 'armazon') n++; }}); return n; }})()") == 3)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-12.5; {K}.pj.z=-13.2; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=0.4; {K}.cam.yaw=Math.PI+0.9; {K}.cam.pitch=0.45; {K}.cam.dist=7.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/27_obras_marcos.png')
    # Usar junto al poste: le lleva el material y se pone a construir; moverse lo para
    oc = ev(f"{K}.obraCercana()")
    comprobar('Usar encuentra la obra más cercana (el poste)', oc is not None and oc['key'].startswith('v:'), json.dumps(oc))
    # obras con lo que llevas: con las manos vacías no se le lleva nada, aunque el arcón esté lleno
    ev(f"for (const l of ['mano:der','mano:izq','hombro']) if ({K}.inventario.lugares[l]) {K}.accionInventario({{ tipo: 'soltar', de: l }})")
    t0 = ev(f"{K}.mundo.materiales.tronco")
    ev(f"{K}.usar()")
    aviso = ev("document.getElementById('aviso').textContent")
    comprobar('sin llevar el tronco, Usar no le lleva nada ni se pone a construir, y dice qué le falta', t0 == ev(f"{K}.mundo.materiales.tronco") and not ev(f"!!{K}.obrando") and 'Le falta' in aviso and 'arcón' in aviso, aviso)
    # el arcón de pruebas tiene los materiales de obra, contados: se coge un tronco corto con las manos
    ev(f"{K}.panelInventario.abrir()")
    nb = ev("document.querySelectorAll('.inv-materiales [data-arcon]').length")
    ev("document.querySelector('.inv-materiales [data-tipo=tronco_corto]').click()")
    ev("document.querySelector('.inv-manos') && document.querySelector('.inv-manos').click()")
    lleva = ev(f"{K}.inventario.cuantos('tronco_corto')")
    comprobar('en el arcón están los 10 materiales de obra; un tronco corto se coge con las manos y sale del arcón', nb == 10 and lleva == 1 and t0 - ev(f"{K}.mundo.materiales.tronco") == 1, f'botones={nb} lleva={lleva}')
    esperar(pg, 400)
    pg.screenshot(path=f'{SALIDA}/27b_arcon_materiales.png')
    ev(f"{K}.panelInventario.cerrar()")
    ev(f"{K}.usar()")
    comprobar('con el tronco en las manos, Usar se lo lleva al poste (1 tronco) y se pone a construir', t0 - ev(f"{K}.mundo.materiales.tronco") == 1 and ev(f"{K}.inventario.cuantos('tronco_corto')") == 0 and ev(f"!!{K}.obrando"))
    esperar(pg, 1500)
    pg.screenshot(path=f'{SALIDA}/28_obra_construyendo.png')
    prog = ev(f"(() => {{ const c = {K}.mundo.construcciones.find(c => c.id === {oc['c']}); const p = c.piezas.get('{oc['key']}'); return p.obra ? p.obra.trabajo : -1; }})()")
    # sin tarjeta gráfica van 2 fotogramas por segundo y la captura tarda: puede que ya esté terminada (-1)
    comprobar('el trabajo avanza con el tiempo', prog > 0 or prog == -1, 'ya terminada' if prog == -1 else f'{prog:.1f} s')
    try: pg.wait_for_function(f"!{K}.obrando", timeout=90000)
    except Exception: pass
    fin = ev(f"(() => {{ const c = {K}.mundo.construcciones.find(c => c.id === {oc['c']}); const p = c.piezas.get('{oc['key']}'); return !p.obra; }})()")
    comprobar('al acabar el tiempo de la pieza (7 s de trabajo), el poste queda terminado', fin)
    comprobar('cada rato de trabajo queda en el registro con su autor', ev(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'trabajar' && e.datos.clave === '{oc['key']}' && e.autor === 'jugador:local' && e.ok).length") >= 2)
    ev(f"{K}.pj.x=-14.6; {K}.pj.z=-13.4; {K}.llevar(); {K}.usar()")
    esperar(pg, 600)
    teclas_antes = ev(f"!!{K}.obrando")
    pg.keyboard.down('s'); esperar(pg, 400); pg.keyboard.up('s')
    comprobar('moverse deja la obra', teclas_antes and not ev(f"{K}.obrando"))
    ev(f"{K}.pj.x=-15.6; {K}.pj.z=-13.6; {K}.pj.rot=0.6; {K}.cam.yaw=Math.PI+0.5; {K}.cam.pitch=0.3; {K}.cam.dist=4.2")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/29_obra_muro_de_cerca.png')

    print('PC: obra en alto: subir los troncos rodándolos por dos varas con una cuerda')
    ev(f"{K}.terminarObras()")
    marco('muro_tronco', -15, -12, 1)
    alta = ev(f"(() => {{ for (const c of {K}.mundo.construcciones) for (const [k, p] of c.piezas) if (p.obra && p.k === 1) return {{ c: c.id, key: k }}; return null; }})()")
    comprobar('el marco de un muro en la planta 1 se pone', alta is not None)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-15; {K}.pj.z=-13.4; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=2.2; {K}.cam.pitch=0.3; {K}.cam.dist=9")
    t0 = ev(f"{K}.mundo.materiales.tronco")
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('Usar desde el suelo se pone a subir los troncos (no se entregan a mano)', ev(f"{K}.obrando && {K}.obrando.subir") == 'tronco' and ev(f"{K}.rampa && {K}.rampa.visible"), json.dumps(ev(f"{K}.obrando && {K}.obrando.subir")))
    entregado = f"{K}.mundo.construcciones.find(c => c.id === {alta['c']}).piezas.get('{alta['key']}').obra.entregado"
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/30_subiendo_tronco_varas.png')
    # sin tarjeta gráfica cada rato puede llegar a 5 s: la subida avanza a saltos y puede que ya vaya por otro tronco
    comprobar('el tronco va subiendo por las varas', ev(f"{K}.rampa ? {K}.rampa.meta : 1") > 0 or ev(f"{entregado}.tronco || 0") >= 1)
    try: pg.wait_for_function(f"({entregado}.tronco || 0) >= 1", timeout=60000)
    except Exception: pass
    comprobar('sola, rodándolo, sube un tronco (10 s de trabajo) y queda entregado', ev(f"{entregado}.tronco || 0") >= 1 and t0 - ev(f"{K}.mundo.materiales.tronco") >= 1)
    comprobar('cada rato subiendo queda en el registro con su autor y el método', ev(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'subir' && e.ok && e.autor === 'jugador:local' && e.datos.metodo === 'varas').length") >= 2)
    pg.keyboard.down('s'); esperar(pg, 400); pg.keyboard.up('s')
    esperar(pg, 200)
    comprobar('moverse deja de subir y quita las varas', not ev(f"{K}.obrando") and not ev(f"{K}.rampa"))

    print('PC: andamio pegado al muro (se sube con Usar y se trabaja desde su plataforma)')
    ev(f"{K}.terminarObras()")
    poner('pieza', 'andamio', -15, -13)
    poner('pieza', 'andamio', -15, -13, 1)
    anda = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'andamio' && !p.obra).map(p => [p.k, p.dir])")
    comprobar('dos andamios apilados, pegados al muro y mirando hacia él', sorted(anda) == [[0, 0], [1, 0]], json.dumps(anda))
    marco('muro_zarzo', -15, -12, 2)
    alto2 = ev(f"(() => {{ for (const c of {K}.mundo.construcciones) for (const [k, p] of c.piezas) if (p.obra && p.k === 2) return {{ c: c.id, key: k }}; return null; }})()")
    comprobar('el marco de un muro de zarzo en la planta 2', alto2 is not None)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-15; {K}.pj.z=-14.2; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=0; {K}.cam.yaw=Math.PI+0.7; {K}.cam.pitch=0.32; {K}.cam.dist=9")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/31_andamio_pegado_al_muro.png')
    it = ev(f"{K}.interactivoCercano()")
    comprobar('al pie del andamio, Usar lo encuentra', it is not None and it['key'].startswith('l:'), json.dumps(it))
    ev(f"{K}.llevar(); {K}.usar()"); esperar(pg, 500)
    try: pg.wait_for_function(f"Math.abs({K}.pj.y - 2.62) < 0.1", timeout=15000)
    except Exception: pass
    comprobar('Usar sube a la plataforma del andamio (planta 1, a la altura de su suelo)', ev(f"{K}.pj.k") == 1 and abs(ev(f"{K}.pj.y") - 2.62) < 0.1, f"k={ev(f'{K}.pj.k')} y={ev(f'{K}.pj.y'):.2f}")
    ev(f"{K}.llevar(); {K}.usar()"); esperar(pg, 500)
    try: pg.wait_for_function(f"Math.abs({K}.pj.y - 5.12) < 0.1", timeout=15000)
    except Exception: pass
    comprobar('arriba, con otro andamio encima, Usar sube a ese (planta 2)', ev(f"{K}.pj.k") == 2 and abs(ev(f"{K}.pj.y") - 5.12) < 0.1, f"k={ev(f'{K}.pj.k')} y={ev(f'{K}.pj.y'):.2f}")
    v0 = ev(f"{K}.mundo.materiales.vara")
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('desde el andamio se lleva lo ligero a la obra de la planta 2 y se construye', v0 - ev(f"{K}.mundo.materiales.vara") == 4 and ev(f"!!{K}.obrando"), f"{v0} → {ev(f'{K}.mundo.materiales.vara')}")
    ev(f"{K}.cam.yaw=Math.PI+0.5; {K}.cam.pitch=0.25; {K}.cam.dist=6")
    esperar(pg, 1500)
    pg.screenshot(path=f'{SALIDA}/32_trabajando_desde_el_andamio.png')
    try: pg.wait_for_function(f"!{K}.obrando", timeout=90000)
    except Exception: pass
    fin2 = ev(f"!{K}.mundo.construcciones.find(c => c.id === {alto2['c']}).piezas.get('{alto2['key']}').obra")
    comprobar('el muro de la planta 2 queda terminado, trabajado desde el andamio', fin2)
    ev(f"{K}.llevar(); {K}.usar()"); esperar(pg, 500)
    try: pg.wait_for_function(f"{K}.pj.y < 0.3", timeout=15000)
    except Exception: pass
    comprobar('en lo alto de la pila, Usar baja hasta el pie', ev(f"{K}.pj.k") == 0 and ev(f"{K}.pj.y") < 0.3)

    print('PC: polea en una viga (una persona sola sube los troncos)')
    for planta in (0, 1):
        poner('pieza', 'poste', -14, -12, planta)
        if planta: poner('pieza', 'poste', -12, -12, planta)
    poner('pieza', 'viga', -13, -12, 1)
    poner('pieza', 'polea', -13, -12, 1)
    npolea = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'polea' && !p.obra).length")
    comprobar('la polea se cuelga de la viga', npolea == 1)
    marco('muro_tronco', -13, -12, 1)
    alta3 = ev(f"(() => {{ for (const c of {K}.mundo.construcciones) for (const [k, p] of c.piezas) if (p.obra && p.k === 1 && p.tipo === 'muro_tronco') return {{ c: c.id, key: k }}; return null; }})()")
    comprobar('el marco de un muro de troncos en la planta 1, entre los postes', alta3 is not None)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-12.8; {K}.pj.z=-13.4; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.3; {K}.cam.dist=11")
    t0 = ev(f"{K}.mundo.materiales.tronco")
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('con polea, Usar se pone a subir los troncos con ella (no con varas)', ev(f"{K}.obrando && {K}.obrando.metodo") == 'polea' and ev(f"{K}.rampa && {K}.rampa.tipo") == 'polea', json.dumps(ev(f"{K}.obrando && {K}.obrando.metodo")))
    entregado3 = f"{K}.mundo.construcciones.find(c => c.id === {alta3['c']}).piezas.get('{alta3['key']}').obra.entregado"
    # para la captura se deja la subida quieta a media altura (sin tarjeta gráfica cada rato llega a 5 s y el tronco
    # sube de golpe)
    ev(f"{K}.fijarSubida(0.6)")
    comprobar('el tronco sube en vertical colgado de la polea', (ev(f"{K}.rampa ? {K}.rampa.yTronco : 0") or 0) > 0.9, f"y={ev(f'{K}.rampa ? {K}.rampa.yTronco : 0')}")
    pg.screenshot(path=f'{SALIDA}/33_subiendo_tronco_polea.png')
    # de cerca: la polea, el tronco colgando y el cabo de tirar (la polea cuelga a 4,4-5 m: el personaje se pone en la
    # plataforma del andamio de al lado para que la cámara llegue; el cabo va hasta sus manos)
    ev(f"{K}.pj.x=-14.35; {K}.pj.z=-12.6; {K}.pj.k=1; {K}.pj.y=2.62; {K}.pj.rot=1.0; {K}.cam.yaw=Math.PI-0.35; {K}.cam.pitch=0.1; {K}.cam.dist=4.5")
    esperar(pg, 1500)
    pg.screenshot(path=f'{SALIDA}/34_polea_de_cerca.png')
    ev(f"{K}.pj.x=-12.8; {K}.pj.z=-13.4; {K}.pj.k=0; {K}.pj.y=0; {K}.seguirSubida()")
    try: pg.wait_for_function(f"({entregado3}.tronco || 0) >= 1", timeout=60000)
    except Exception: pass
    comprobar('sola, con la polea, sube un tronco (5 s de trabajo) y queda entregado', ev(f"{entregado3}.tronco || 0") >= 1 and t0 - ev(f"{K}.mundo.materiales.tronco") >= 1)
    comprobar('cada rato con la polea queda en el registro con su autor y el método', ev(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'subir' && e.ok && e.autor === 'jugador:local' && e.datos.metodo === 'polea').length") >= 2)
    pg.keyboard.down('s'); esperar(pg, 400); pg.keyboard.up('s')
    esperar(pg, 200)
    comprobar('moverse deja de subir y quita la cuerda', not ev(f"{K}.obrando") and not ev(f"{K}.rampa"))
    ev(f"{K}.terminarObras()")

    print('PC: polipasto con torno en una viga (sola, un tronco; lo muy pesado, entre dos)')
    for planta in (0, 1):
        poner('pieza', 'poste', -18, -12, planta)
        poner('pieza', 'poste', -16, -12, planta)
    poner('pieza', 'viga', -17, -12, 1)
    poner('pieza', 'polipasto', -17, -12, 1)
    npp = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'polipasto' && !p.obra).length")
    comprobar('el polipasto se cuelga de la viga', npp == 1)
    marco('muro_tronco', -17, -12, 1)
    alta4 = ev(f"(() => {{ for (const c of {K}.mundo.construcciones) for (const [k, p] of c.piezas) if (p.obra && p.k === 1 && p.tipo === 'muro_tronco') return {{ c: c.id, key: k }}; return null; }})()")
    comprobar('el marco de un muro de troncos en la planta 1, bajo el polipasto', alta4 is not None)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-16.8; {K}.pj.z=-13.6; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.3; {K}.cam.dist=11")
    t0 = ev(f"{K}.mundo.materiales.tronco")
    ev(f"{K}.llevar(); {K}.usar()")
    comprobar('con el polipasto más cerca de la obra que la polea, Usar sube los troncos con él y pone el torno', ev(f"{K}.obrando && {K}.obrando.metodo") == 'polipasto' and ev(f"{K}.rampa && {K}.rampa.tipo") == 'polipasto' and ev(f"{K}.rampa.torno"), json.dumps(ev(f"{K}.rampa")))
    entregado4 = f"{K}.mundo.construcciones.find(c => c.id === {alta4['c']}).piezas.get('{alta4['key']}').obra.entregado"
    ev(f"{K}.fijarSubida(0)"); esperar(pg, 300)
    y_abajo = ev(f"{K}.rampa.yMoton")
    ev(f"{K}.fijarSubida(0.7)"); esperar(pg, 300)
    y_arriba = ev(f"{K}.rampa.yMoton")
    comprobar('el motón de abajo baja hasta la carga y sube con ella', y_abajo is not None and y_arriba is not None and y_arriba > y_abajo + 0.3, f"{y_abajo} → {y_arriba}")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/35_subiendo_tronco_polipasto.png')
    # de cerca: el torno, la carga y el polipasto
    ev(f"{K}.cam.yaw=Math.PI+0.9; {K}.cam.pitch=0.12; {K}.cam.dist=4.2")
    esperar(pg, 1500)
    pg.screenshot(path=f'{SALIDA}/36_polipasto_y_torno_de_cerca.png')
    ev(f"{K}.seguirSubida()")
    try: pg.wait_for_function(f"({entregado4}.tronco || 0) >= 1", timeout=60000)
    except Exception: pass
    comprobar('sola, con el polipasto, sube un tronco como con polea y queda entregado', ev(f"{entregado4}.tronco || 0") >= 1 and t0 - ev(f"{K}.mundo.materiales.tronco") >= 1)
    comprobar('cada rato con el polipasto queda en el registro con su autor y el método', ev(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'subir' && e.ok && e.autor === 'jugador:local' && e.datos.metodo === 'polipasto').length") >= 2)
    pg.keyboard.down('s'); esperar(pg, 400); pg.keyboard.up('s')
    esperar(pg, 200)
    comprobar('moverse deja de subir, quita el torno y el motón vuelve arriba', not ev(f"{K}.obrando") and not ev(f"{K}.rampa") and ev(f"[...{K}.escena.getObjectsByProperty ? {K}.escena.getObjectsByProperty('name', 'moton_bajo') : []].every(o => o.position.y > 1)"))
    ev(f"{K}.terminarObras()")
    # de cerca, recogido (apartado del muro hacia fuera): el personaje sube a un andamio pegado al muro para que la
    # cámara llegue a la altura de la viga
    poner('pieza', 'andamio', -17, -13, 0)
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-17.6; {K}.pj.z=-13.2; {K}.pj.k=1; {K}.pj.y=2.62; {K}.pj.rot=1.0; {K}.cam.yaw=0.35; {K}.cam.pitch=0.12; {K}.cam.dist=4.8")
    esperar(pg, 1500)
    pg.screenshot(path=f'{SALIDA}/37_polipasto_recogido_de_cerca.png')
    ev(f"{K}.cam.yaw=-0.45; {K}.cam.pitch=0.02; {K}.cam.dist=3.6")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/38_polipasto_motones_de_cerca.png')
    ev(f"{K}.pj.k=0; {K}.pj.y=0; {K}.pj.x=-17; {K}.pj.z=-15")

    print('PC: chimenea (hogar interior) sobre cimiento de piedra, con fuego, luz y humo por el tejado')
    # MUTAR_CHIMENEA=1: el hogar no se choca (se entra en el fuego): la prueba tiene que fallar
    if os.environ.get('MUTAR_CHIMENEA'): ev('window.__sinChoqueHogar = true')
    # casita de 2×1 en la rejilla de la cabaña (casillas x = 7 y 9, z = 3): la de x = 7 de piedra y la de x = 9 de troncos;
    # delante de la chimenea, sin muro, para verla desde fuera
    poner('pieza', 'cim_piedra', 7, 3); poner('pieza', 'cim_tronco', 9, 3)
    for x, z in [(7, 4), (9, 4), (6, 3), (10, 3)]:
        poner('pieza', 'muro_tronco', x, z)
    poner('pieza', 'muro_tronco_puerta', 9, 2); poner('pieza', 'puerta_varas', 9, 2)
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=0; {K}.seleccionar('pieza','hogar'); {K}.apuntar(9,3)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('sobre el cimiento de troncos no deja ponerla', not v['ok'] and 'piedra' in v.get('motivo', ''), json.dumps(v, ensure_ascii=False))
    piedra0 = ev(f"{K}.mundo.materiales.piedra")
    v = poner('pieza', 'hogar', 7, 3)
    comprobar('chimenea colocada desde el menú sobre el cimiento de piedra', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    for x in (7, 9):
        poner('pieza', 'tejado_paja', x, 3, planta=1)
    chim = f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].find(p => p.tipo === 'hogar')"
    comprobar('terminada, gasta sus piedras y queda encendida, arrimada al muro de atrás', piedra0 - ev(f"{K}.mundo.materiales.piedra") == 10 and ev(f"!{chim}.apagado && {chim}.dir === 0"), f"dir={ev(f'{chim}.dir')}")
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=8; {K}.pj.z=0.5; {K}.pj.k=0; {K}.pj.y=0")
    esperar(pg, 500)
    f = ev("window.__fuegos()")
    comprobar('el fuego alumbra (una luz encendida de las dos que hay) y su humo sube', f['chimeneas'] == 1 and f['luces'] == 2 and f['encendidas'] == 1, json.dumps(f))
    alto = ev(f"(() => {{ const o = {K}.escena.getObjectsByProperty('name', 'humo'); let y = 1e9; for (const m of o) y = Math.min(y, m.getWorldPosition(m.position.clone()).y); return [o.length, y]; }})()")
    comprobar('el humo sale por encima del tejado (cumbrera a 3,7 m)', alto[0] >= 5 and alto[1] > 3.9, json.dumps(alto))
    # por fuera, el cañón sale por el tejado con el humo
    ev(f"{K}.pj.x=8.2; {K}.pj.z=-1.5; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI+0.45; {K}.cam.pitch=0.12; {K}.cam.dist=9")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/48_chimenea_por_fuera.png')
    # dentro, delante del fuego: no se puede entrar en el hogar
    ev(f"{K}.pj.x=7; {K}.pj.z=2.6; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.25")
    esperar(pg, 300)
    andar('w', f"{K}.pj.z > 3.6", 1500)
    esperar(pg, 200)
    zc = ev(f"{K}.pj.z")
    comprobar('no se entra en el fuego (el hogar se choca)', zc < 3.0, f'z={zc:.2f}')
    ev(f"{K}.pj.x=6.5; {K}.pj.z=0.9; {K}.pj.rot=0.5; {K}.cam.yaw=Math.PI-0.5; {K}.cam.pitch=0.18; {K}.cam.dist=3.2")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/49_chimenea_encendida_de_cerca.png')
    # Usar la apaga (solo se rehace ella, no todo lo construido) y la vuelve a encender
    todo0 = ev("window.__rehechos.todo")
    ev(f"{K}.pj.x=7.2; {K}.pj.z=2.4")
    esperar(pg, 200)
    comprobar('junto al hogar, Usar ofrece el fuego', (ev(f"{K}.interactivoCercano()") or {}).get('tipo') == 'fuego')
    ev(f"{K}.llevar(); {K}.usar()")
    esperar(pg, 400)
    f = ev("window.__fuegos()")
    comprobar('Usar apaga el fuego: sin llamas, sin humo y sin luz', ev(f"{chim}.apagado") is True and f['chimeneas'] == 0 and f['encendidas'] == 0 and ev(f"{K}.escena.getObjectsByProperty('name', 'humo').length") == 0, json.dumps(f))
    comprobar('apagar no rehace todo lo construido', ev("window.__rehechos.todo") == todo0)
    ev(f"{K}.pj.x=6.5; {K}.pj.z=0.9; {K}.pj.rot=0.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/50_chimenea_apagada_de_cerca.png')
    ev(f"{K}.pj.x=7.2; {K}.pj.z=2.4")
    ev(f"{K}.llevar(); {K}.usar()")
    esperar(pg, 300)
    comprobar('y la vuelve a encender', ev(f"!{chim}.apagado") and ev("window.__fuegos()")['encendidas'] == 1)
    ev(f"{K}.pj.x=8; {K}.pj.z=0.5")

    print('PC: adarve detrás de la empalizada, con escalera de mano y de tablas')
    # MUTAR_ADARVE=1: el adarve no se choca (se pasa por debajo y se salta la empalizada desde arriba): tiene que fallar
    if os.environ.get('MUTAR_ADARVE'): ev('window.__sinChoqueAdarve = true')
    # detrás (lado +z) de las empalizadas de x = 7 y 9: casillas que empiezan en su borde (z = -4 o -5, según la rejilla
    # en la que hayan quedado); A = z del centro de esas casillas, y todo lo demás se coloca a partir de A. Las escaleras,
    # en las casillas de delante (z = A + 2), subiendo hacia -z
    def poner_dir(tipo, x, z, d):
        ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=0; {K}.seleccionar('pieza','{tipo}'); {K}.estado.dir={d}; {K}.apuntar({x},{z})")
        v = ev(f"{K}.estado.candidato && {K}.estado.candidato.v")
        ev(f"{K}.colocar(); {K}.terminarObras()")
        return v
    def asentar(maximo=4000):  # espera a que el personaje deje de subir o bajar (con la máquina lenta, tarda)
        t, y0 = 0, None
        while t < maximo:
            y = ev(f"{K}.pj.y")
            if y0 is not None and abs(y - y0) < 0.003: return
            y0 = y; pg.wait_for_timeout(150); t += 150
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=0; {K}.seleccionar('pieza','adarve'); {K}.apuntar(1,-9)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('lejos de una empalizada no deja ponerlo', not v['ok'] and 'empalizada' in v.get('motivo', ''), json.dumps(v, ensure_ascii=False))
    tabla0 = ev(f"{K}.mundo.materiales.tabla")
    v = poner_dir('adarve', 7, -3.5, 0)
    comprobar('adarve colocado desde el menú detrás de la empalizada', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    v = poner_dir('adarve', 9, -3.5, 1)
    adv = f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'adarve')"
    A = ev(f"(() => {{ const c = {K}.mundo.construcciones.find(c => [...c.piezas.values()].some(p => p.tipo === 'adarve')); const p = [...c.piezas.values()].find(p => p.tipo === 'adarve'); return c.oz + (p.j + 0.5) * 2; }})()") or -4
    comprobar('dos tramos seguidos, terminados, arrimados solos a la empalizada (-z: dir 2), giren como giren', bool(v) and v['ok'] and ev(f"{adv}.length") == 2 and ev(f"{adv}.every(p => !p.obra && p.dir === 2)") and tabla0 - ev(f"{K}.mundo.materiales.tabla") == 8, json.dumps([v, ev(f"{adv}.map(p => [p.dir, !!p.obra])")], ensure_ascii=False))
    # el fantasma de una escalera que sube hacia el adarve ya sale corta
    ev(f"{K}.seleccionar('pieza','escalera_mano'); {K}.estado.dir=0; {K}.apuntar(7,{A + 2})")  # la de mano se apoya hacia -SUBE[dir]
    f1 = ev(f"{K}.fantasmaForma")
    ev(f"{K}.apuntar(1,-9)")
    f2 = ev(f"{K}.fantasmaForma")
    comprobar('el fantasma de la escalera de mano sale corta delante del adarve, y larga en otro sitio', f1 == 'adarve' and f2 is None, f'{f1} {f2}')
    v1 = poner_dir('escalera_mano', 7, A + 2, 0)
    v2 = poner_dir('escalera_tabla', 9, A + 2, 2)
    comprobar('escalera de mano y de tablas delante del adarve, subiendo hacia él', bool(v1) and v1['ok'] and bool(v2) and v2['ok'], json.dumps([v1, v2], ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover')")
    # por debajo del piso no se pasa (cam.yaw = 0: W va hacia -z)
    ev(f"{K}.pj.x=6.6; {K}.pj.z={A + 3.4}; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=0; {K}.cam.pitch=0.3; {K}.cam.dist=6")
    esperar(pg, 300)
    andar('w', f"{K}.pj.z < {A - 0.6}", 2500)
    zb = ev(f"{K}.pj.z")
    comprobar('por debajo del adarve no se pasa', zb > A + 1.0 and ev(f"{K}.pj.k") == 0, f'z={zb:.2f}')
    # escalera de mano: Usar sube al adarve
    ev(f"{K}.pj.x=7; {K}.pj.z={A + 2.4}")
    esperar(pg, 200)
    it = ev(f"{K}.interactivoCercano()") or {}
    comprobar('junto a la escalera de mano, Usar ofrece subir', it.get('tipo') == 'escalera')
    ev(f"{K}.llevar(); {K}.usar()")
    asentar()
    ya, ka = ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('Usar sube al piso del adarve (1,8 m)', ka == 1 and abs(ya - 1.8) < 0.05, f'y={ya:.2f} planta={ka}')
    # arriba, la empalizada no se salta: te quedas detrás de las puntas
    andar('w', f"{K}.pj.z < {A - 1.6}", 2500)
    asentar()
    za, ya = ev(f"{K}.pj.z"), ev(f"{K}.pj.y")
    comprobar('arriba, la empalizada no se salta', za > A - 0.7 and abs(ya - 1.8) < 0.05, f'z={za:.2f} y={ya:.2f}')
    # por el adarve hasta el tramo de al lado, sin bajar (cam.yaw = -π/2: W va hacia +x)
    ev(f"{K}.cam.yaw=-Math.PI/2")
    andar('w', f"{K}.pj.x > 9.2", 3000)
    asentar()
    xa, ya, ka = ev(f"{K}.pj.x"), ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('se anda por los dos tramos seguidos sin bajar', xa > 9.2 and ka == 1 and abs(ya - 1.8) < 0.05, f'x={xa:.2f} y={ya:.2f} planta={ka}')
    ev(f"{K}.pj.x=9.3; {K}.pj.z={A - 0.4}; {K}.pj.rot=Math.PI; {K}.cam.yaw=0.45; {K}.cam.pitch=0.25; {K}.cam.dist=4.2")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/52_en_el_adarve.png')
    # bajar por la escalera de tablas, andando (cam.yaw = π: W va hacia +z)
    ev(f"{K}.pj.x=9; {K}.pj.z={A + 0.3}; {K}.cam.yaw=Math.PI")
    andar('w', f"{K}.pj.z > {A + 3.4}", 3000)
    asentar()
    yb, kb = ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('se baja andando por la escalera de tablas', kb == 0 and yb < 0.3, f'y={yb:.2f} planta={kb}')
    # y se sube por ella: a media escalera vas subiendo y arriba quedas en el adarve
    ev(f"{K}.cam.yaw=0")
    andar('w', f"{K}.pj.z < {A + 2}", 2500)
    ym = ev(f"{K}.pj.y")
    andar('w', f"{K}.pj.z < {A + 0.3}", 2500)
    asentar()
    yb, kb = ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('se sube andando por la escalera de tablas hasta el adarve', 0.2 < ym < 1.7 and kb == 1 and abs(yb - 1.8) < 0.05, f'medio={ym:.2f} y={yb:.2f} planta={kb}')
    # bajar por la de mano con Usar
    ev(f"{K}.pj.x=7; {K}.pj.z={A + 0.6}")
    esperar(pg, 200)
    ev(f"{K}.llevar(); {K}.usar()")
    asentar()
    comprobar('Usar en el adarve, junto a la escalera de mano, baja al suelo', ev(f"{K}.pj.k") == 0 and ev(f"{K}.pj.y") < 0.2)
    # vistas: por dentro (las dos escaleras), de cerca y desde fuera (asoma la cabeza por encima de las puntas)
    ev(f"{K}.pj.x=11.2; {K}.pj.z={A + 4.6}; {K}.pj.rot=-2.5; {K}.cam.yaw=0.75; {K}.cam.pitch=0.22; {K}.cam.dist=8")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/53_adarve_y_escaleras.png')
    ev(f"{K}.pj.x=10.9; {K}.pj.z={A + 2.3}; {K}.pj.rot=-2.4; {K}.cam.yaw=0.8; {K}.cam.pitch=0.35; {K}.cam.dist=4.5")
    esperar(pg, 1200)
    pg.screenshot(path=f'{SALIDA}/54_adarve_de_cerca.png')
    ev(f"{K}.pj.x=8.3; {K}.pj.z={A - 0.4}; {K}.pj.k=1; {K}.pj.y=1.8; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI+0.35; {K}.cam.pitch=0.2; {K}.cam.dist=6")
    esperar(pg, 1200)
    comprobar('el personaje sigue en el adarve', ev(f"{K}.pj.k") == 1 and abs(ev(f"{K}.pj.y") - 1.8) < 0.05)
    pg.screenshot(path=f'{SALIDA}/55_asomado_desde_fuera.png')
    ev(f"{K}.pj.x=8; {K}.pj.z=0.5; {K}.pj.k=0; {K}.pj.y=0; window.__sinChoqueAdarve = false")

    print('PC: todos los muebles en fila, de cerca (estilo v5)')
    nd = ev(f"{K}.mundo.decoracion.length")
    muebles = ev(f"Object.keys({K}.DECORACION || {{}})") or ['cama_paja', 'cama_madera', 'mesa', 'banco', 'taburete', 'arcon', 'barril', 'estanteria', 'candil', 'alfombra', 'estandarte']
    for i, t in enumerate(muebles):
        poner('deco', t, -11 + i * 1.6, -12)
    comprobar('los 11 muebles colocados en fila', ev(f"{K}.mundo.decoracion.length") == nd + len(muebles), f'{len(muebles)} muebles')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-3; {K}.pj.z=-9.5; {K}.pj.y=0; {K}.pj.k=0; {K}.cam.yaw=0.35; {K}.cam.pitch=0.5; {K}.cam.dist=10")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/24_muebles_en_fila.png')
    ev(f"{K}.pj.x=-8.5; {K}.pj.z=-10.5; {K}.cam.yaw=0.2; {K}.cam.pitch=0.45; {K}.cam.dist=5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/25_muebles_camas_mesa_de_cerca.png')
    ev(f"{K}.pj.x=0.5; {K}.pj.z=-10.5; {K}.cam.yaw=0.2; {K}.cam.pitch=0.4; {K}.cam.dist=5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/26_muebles_estanteria_antorcha_de_cerca.png')

    print('PC: personaje del taller (camisa y calzas de lino; anda, corre y tala)')
    try:
        pg.wait_for_function(f'{K}.jugador.mh || {K}.jugador.error', timeout=180000)
    except Exception:
        pass
    mh = ev(f"!!{K}.jugador.mh")
    comprobar('carga el personaje del taller (no el muñeco)', mh, ev(f"{K}.jugador.error || ''"))
    if mh:
        vis = ev(f"""(() => {{ const v = {{}}; {K}.jugador.mh.modelo.traverse(n => {{ if (n.isMesh) v[n.name] = n.visible; }}); return v; }})()""")
        comprobar('lleva camisa y calzas', vis.get('hombre_capa_camisa') and vis.get('hombre_capa_calzas'))
        comprobar('sin túnica ni armadura, y descalzo (como empieza el GDD: se ven los pies, no los zapatos)', vis.get('hombre_pies') and not vis.get('hombre_capa_zapatos') and not any(vis.get(f'hombre_capa_{c}') for c in ['tunica', 'gambeson', 'cota', 'sobreveste']),
                  ', '.join(k for k, x in vis.items() if x))
        modos = ev(f"(() => {{ const j = {K}.jugador, r = []; for (const [v, t] of [[1.0, false], [3.6, false], [6, false], [0, false], [0, true]]) {{ j.animar(v, 0.016, t); r.push(j.modo + ':' + j.mh.acciones[j.modo].timeScale.toFixed(2)); }} return r; }})()")
        comprobar('andar, correr, quieto y talar según la velocidad', [m.split(':')[0] for m in modos] == ['andar', 'correr', 'correr', 'quieto', 'talar'], ', '.join(modos))
        # a 3,6 m/s (la velocidad normal) la carrera va casi a su ritmo natural (medido al cargar): sin resbalar ni cámara lenta
        nat = ev(f'{K}.jugador.mh.velocidad.correr || 0')
        r36 = float(modos[1].split(':')[1])
        comprobar('la animación se acelera con la velocidad (a su medida natural, tope 1,6×)', nat > 0 and abs(r36 - 3.6 / nat) < 0.02 and 0.8 < r36 < 1.3 and modos[2].endswith('1.60'),
                  f"{', '.join(modos)} · natural {nat:.2f} m/s")
        # junto a un árbol, con un hacha en la mano: Usar tala; moverse lo para (la tala entera: prueba_tala_navegador.py)
        ev(f"""(() => {{ const K = {K}; K.cambiarModo('mover'); K.accionInventario({{ tipo: 'coger', objeto: 'hacha_mano', cantidad: 1, a: 'mano:der' }}); const a = K.obstaculos.filter(o => o.arbol).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
            const d = Math.hypot(a.x, a.z); K.pj.k = 0; K.pj.x = a.x - a.x / d * (a.r + 0.6); K.pj.z = a.z - a.z / d * (a.r + 0.6); K.pj.y = 0;
            K.cam.yaw = Math.atan2(-a.x, -a.z) + 0.9; K.cam.pitch = 0.3; K.cam.dist = 4.2; }})()""")
        esperar(pg, 300)
        ev(f"{K}.llevar(); {K}.usar()")
        esperar(pg, 1200)
        comprobar('Usar junto a un árbol: tala', ev(f"!!{K}.estado.talando && {K}.jugador.modo === 'talar'"), ev(f"{K}.jugador.modo"))
        comprobar('el botón Usar se enciende junto al árbol', ev("document.getElementById('btnUsar').classList.contains('activo')"))
        pg.screenshot(path=f'{SALIDA}/17_personaje_talando.png')
        pg.keyboard.down('w'); esperar(pg, 500)
        comprobar('moverse deja de talar', ev(f"!{K}.estado.talando && {K}.jugador.modo !== 'talar'"), ev(f"{K}.jugador.modo"))
        pg.keyboard.up('w')
        ev(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
        # de cerca, quieto y andando, junto a la cabaña
        ev(f"{K}.pj.x=2; {K}.pj.z=-2.5; {K}.pj.k=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI*0.95; {K}.cam.pitch=0.25; {K}.cam.dist=3.6")
        esperar(pg, 1500)
        pg.screenshot(path=f'{SALIDA}/18_personaje_de_cerca.png')
        ev(f"{K}.pj.rot=Math.PI*0.2; {K}.cam.yaw=Math.PI*1.2")
        esperar(pg, 900)
        pg.screenshot(path=f'{SALIDA}/19_personaje_de_espaldas.png')
        pg.keyboard.down('Shift'); pg.keyboard.down('a'); esperar(pg, 700)
        pg.screenshot(path=f'{SALIDA}/20_personaje_corriendo.png')
        comprobar('corre con Mayús', ev(f"{K}.jugador.modo") == 'correr', ev(f"{K}.jugador.modo"))
        pg.keyboard.up('a'); pg.keyboard.up('Shift')

    print('PC: barra de construcción')
    ev(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','muro_entramado'); {K}.pj.x=2; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.3; {K}.cam.pitch=0.85; {K}.cam.dist=15; {K}.estado.planta=0; {K}.apuntar(-1, 3)")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/05_barra_construccion_pc.png')

    # memoria gráfica (valravnx: pantalla en blanco tras un rato construyendo, a más de 80 fps): rehacer las piezas no
    # deja mallas viejas ocupando la tarjeta gráfica
    if os.environ.get('MUTAR_FUGA'): ev('window.__sinLiberar = true')
    memoria = f"(() => {{ {K}.render(); return {K}.renderer.info.memory.geometries; }})()"
    g0 = ev(memoria)
    for _ in range(20): ev(f"{K}.reconstruir()")
    for _ in range(10): ev(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','muro_tronco'); {K}.seleccionar('pieza','muro_tabla')")
    ev(f"{K}.cambiarModo('mover')")
    g1 = ev(memoria)
    comprobar('rehacer las piezas no deja memoria gráfica ocupada', g1 <= g0 + 5, f'geometrías {g0} → {g1} tras 20 reconstrucciones')
    comprobar('sin errores en consola (PC)', len(errores) == 0, '; '.join(errores[:3]))
    estado = pg.evaluate("localStorage.getItem('kinhold_h1_v1')")
    # sin nada construido, toda la hierba, las flores y las matas vuelven a verse (y las matas vuelven a chocar)
    vuelve = ev(f"""(() => {{ {K}.reiniciar(); let total = 0, visibles = 0;
      {K}.escena.traverse(o => {{ if (o.isInstancedMesh && ['hierba', 'flores', 'matorrales'].includes(o.name)) for (let i = 0; i < o.count; i++) {{
        const a = o.instanceMatrix.array, e = i * 16; total++; if (Math.hypot(a[e], a[e + 1], a[e + 2]) > 1e-6) visibles++; }} }});
      return {{ total, visibles, ocultas: {K}.estado.plantasOcultas, matasOcultas: {K}.obstaculos.filter(o => o.oculto).length }}; }})()""")
    comprobar('al quitarlo todo, la hierba y las matas vuelven', vuelve['total'] > 3000 and vuelve['visibles'] == vuelve['total'] and vuelve['ocultas'] == 0 and vuelve['matasOcultas'] == 0, json.dumps(vuelve))
    pg.close()

    # ---------- Móvil ----------
    print('Móvil')
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    mv = ctx.new_page()
    # al doble de resolución y sin tarjeta gráfica, cada fotograma puede tardar segundos con la casa entera a la vista,
    # y un clic espera al siguiente: 30 s no siempre llegan en una máquina de 2 núcleos
    mv.set_default_timeout(120000)
    err2 = []
    mv.on('pageerror', lambda e: err2.append(str(e)))
    mv.goto(URL)
    # sin tarjeta gráfica y con la pantalla al doble de resolución, arrancar puede pasar de 20 s si la máquina va cargada
    mv.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    mv.evaluate(f"localStorage.setItem('kinhold_h1_v1', {json.dumps(estado)}); location.reload()")
    mv.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    mv.wait_for_timeout(800)
    comprobar('joystick visible en táctil', mv.is_visible('#joystick'))
    mv.evaluate(f"{K}.pj.x=1; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.5; {K}.cam.pitch=0.85; {K}.cam.dist=20")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06_movil_mover.png')
    mv.evaluate(f"{K}.pj.x=10.2; {K}.pj.z=-15; {K}.pj.k=0; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.5; {K}.cam.dist=11")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06b_movil_escalera.png')
    mv.evaluate(f"{K}.pj.x=-12.8; {K}.pj.z=-14.5; {K}.pj.k=0; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.3; {K}.cam.dist=10")
    mv.wait_for_timeout(900)
    comprobar('móvil: el andamio y la polea se cargan del guardado', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'andamio' || p.tipo === 'polea').length") >= 3)
    mv.screenshot(path=f'{SALIDA}/06c_movil_andamio_y_polea.png')
    mv.evaluate(f"{K}.pj.x=14.0; {K}.pj.z=-16.4; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI-0.3; {K}.cam.pitch=0.3; {K}.cam.dist=5.5")
    mv.wait_for_timeout(900)
    comprobar('móvil: la contraventana y la trampilla se cargan del guardado', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.hueco === 'w' || p.hueco === 't').length") >= 3)
    mv.screenshot(path=f'{SALIDA}/06d_movil_contraventana.png')
    mv.evaluate(f"{K}.pj.x=9.4; {K}.pj.z=-11.4; {K}.pj.k=1; {K}.pj.y=2.62; {K}.cam.yaw=0.5; {K}.cam.pitch=0.8; {K}.cam.dist=6")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06e_movil_trampilla.png')
    # en el móvil, dejar pulsado Usar abre el menú de Usar (junto a la puerta de la cabaña)
    mv.evaluate(f"{K}.pj.x=1; {K}.pj.z=-0.7; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=0.5; {K}.cam.dist=7")
    mv.wait_for_timeout(600)
    mv.evaluate("document.getElementById('btnUsar').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))")
    mv.wait_for_timeout(900)
    mmenu = mv.evaluate(f"{K}.menuUsar()")
    comprobar('móvil: dejar pulsado Usar abre el menú', mmenu is not None and len(mmenu) >= 1, json.dumps(mmenu, ensure_ascii=False))
    mv.screenshot(path=f'{SALIDA}/06f_movil_menu_usar.png')
    mv.evaluate("document.getElementById('btnUsar').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }))")
    mv.evaluate("document.getElementById('btnUsar').click()")
    comprobar('móvil: al soltar tras dejarlo pulsado no se usa nada (solo abre el menú)', mv.evaluate(f"{K}.menuUsar()") is not None)
    mv.evaluate(f"{K}.pj.x=3.5; {K}.pj.z=-20.8; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI-0.3; {K}.cam.pitch=0.7; {K}.cam.dist=11")
    mv.wait_for_timeout(900)
    comprobar('móvil: el tejado de teja se carga del guardado', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'tejado_teja').length") == 4)
    comprobar('móvil: los remates de tejado se cargan del guardado', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'remate_tablilla').length") == 2)
    mv.screenshot(path=f'{SALIDA}/06f_movil_tejado_teja.png')
    mv.evaluate(f"{K}.pj.x=0.5; {K}.pj.z=-27; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI-0.75; {K}.cam.pitch=0.6; {K}.cam.dist=13")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06g_movil_remate_esquina.png')
    mv.evaluate(f"{K}.pj.x=7.7; {K}.pj.z=0.2; {K}.pj.k=0; {K}.pj.y=0; {K}.pj.rot=-0.3; {K}.cam.yaw=Math.PI+0.15; {K}.cam.pitch=0.2; {K}.cam.dist=4.5")
    mv.wait_for_timeout(1200)
    comprobar('móvil: la chimenea se carga del guardado, encendida', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'hogar' && !p.apagado).length") == 1 and mv.evaluate("window.__fuegos().encendidas") == 1)
    mv.screenshot(path=f'{SALIDA}/06h_movil_chimenea.png')
    mv.evaluate(f"{K}.pj.x=8.2; {K}.pj.z=-1.5; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.2; {K}.cam.dist=13")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06i_movil_chimenea_por_fuera.png')
    mv.evaluate(f"{K}.pj.x=8.3; {K}.pj.z={A - 0.3}; {K}.pj.k=1; {K}.pj.y=1.8; {K}.pj.rot=Math.PI; {K}.cam.yaw=0.5; {K}.cam.pitch=0.25; {K}.cam.dist=6")
    mv.wait_for_timeout(1200)
    comprobar('móvil: los adarves se cargan del guardado', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].filter(p => p.tipo === 'adarve' && !p.obra).length") == 2 and mv.evaluate(f"{K}.pj.k") == 1)
    mv.screenshot(path=f'{SALIDA}/06j_movil_adarve.png')
    mv.click('#modos button[data-modo=construir]', no_wait_after=True)  # el clic no navega; con la máquina cargada, esperar «navegaciones» agotaba los 30 s
    mv.evaluate(f"{K}.seleccionar('pieza','cim_tronco'); {K}.apuntar(-2, 2)")
    mv.wait_for_timeout(700)
    comprobar('botón Colocar visible al construir en táctil', mv.is_visible('#btnColocar'))
    try:
        mv.wait_for_function(f'{K}.jugador.mh || {K}.jugador.error', timeout=180000)
    except Exception:
        pass
    comprobar('carga el personaje del taller en el móvil', mv.evaluate(f"!!{K}.jugador.mh"))
    mv.screenshot(path=f'{SALIDA}/07_movil_construir.png')
    mv.click('#btnColocar', no_wait_after=True)
    mv.evaluate(f"{K}.cambiarModo('mover'); {K}.pj.x=-1; {K}.pj.z=4.2; {K}.pj.k=0; {K}.pj.rot=Math.PI*0.9; {K}.cam.yaw=Math.PI*0.1; {K}.cam.pitch=0.55; {K}.cam.dist=7")
    mv.wait_for_timeout(900)
    comprobar('móvil: Colocar pone el marco de la obra', mv.evaluate(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].some(p => p.tipo === 'cim_tronco' && p.obra)"))
    mv.screenshot(path=f'{SALIDA}/07d_movil_obra.png')
    mv.click('#modos button[data-modo=mover]', no_wait_after=True)
    mv.evaluate(f"{K}.pj.x=2; {K}.pj.z=-2.5; {K}.pj.k=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI*0.95; {K}.cam.pitch=0.3; {K}.cam.dist=4.5")
    mv.wait_for_timeout(1200)
    mv.screenshot(path=f'{SALIDA}/07b_movil_personaje_de_cerca.png')
    comprobar('sin errores en consola (móvil)', len(err2) == 0, '; '.join(err2[:3]))
    # pérdida del dibujo 3D (valravnx: pantalla en blanco en el móvil con los botones vivos): aviso, recarga sola y lo
    # construido sigue ahí; si vuelve a pasar enseguida, no recarga en bucle (ofrece un botón)
    print('Móvil: se pierde el dibujo 3D')
    piezas = mv.evaluate(f"{K}.mundo.construcciones.reduce((n, c) => n + c.piezas.size, 0)")
    if os.environ.get('MUTAR_CONTEXTO'): mv.evaluate('window.__sinRecargar = true')
    perder = "(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); })()"
    mv.evaluate("window.__marca = 1"); mv.evaluate(perder)
    mv.wait_for_timeout(300)
    hay_aviso = mv.is_visible('#avisoContexto')
    try:
        mv.wait_for_function('window.__kinhold !== undefined && window.__marca === undefined', timeout=20000); recargo = True
    except Exception:
        recargo = False
    comprobar('al perder el dibujo 3D avisa y recarga sola', hay_aviso and recargo)
    if recargo:
        mv.wait_for_timeout(800)
        despues = mv.evaluate(f"{K}.mundo.construcciones.reduce((n, c) => n + c.piezas.size, 0)")
        comprobar('después de recargar sigue lo construido', despues == piezas and piezas > 0, f'{piezas} → {despues}')
        # «enseguida» = menos de 20 s desde la pérdida anterior; con el servidor cargado la recarga puede tardar más,
        # así que se marca la pérdida anterior como de ahora mismo para probar la regla y no el reloj
        mv.evaluate("sessionStorage.setItem('kinhold_contexto', String(Date.now()))")
        mv.evaluate("window.__marca = 1"); mv.evaluate(perder); mv.wait_for_timeout(2500)
        try: mv.wait_for_selector('#avisoContexto button', state='visible', timeout=15000)  # a pocos fps tarda más
        except Exception: pass
        comprobar('si vuelve a pasar enseguida no recarga en bucle: ofrece Recargar', mv.evaluate('window.__marca === 1') and mv.is_visible('#avisoContexto button'))
        mv.screenshot(path=f'{SALIDA}/07c_movil_dibujo_perdido.png')
    nav.close()

print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
