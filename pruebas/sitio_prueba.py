# La base común de las pruebas de navegador (P6, «Orden»): el sitio de archivos y su servidor, en un solo sitio.
# Antes, cada prueba montaba su sitio a su manera: unas enlazaban docs/recursos entero y otras copiaban carpeta a
# carpeta (la naturaleza, cada personaje, los iconos…), con lo que una carpeta nueva de recursos había que añadirla
# prueba por prueba, y la que se olvidaba fallaba o probaba otra cosa que la web.
# Ahora: el sitio es como la web publicada (docs/): cada página en jugar/<carpeta>/prueba.html y los recursos
# enlazados, no copiados (docs/recursos entero, más lo de iconos.js que viva fuera de recursos/).
#
#   from sitio_prueba import montar_sitio, servir, puerto_libre, ARGS
#   sitio = montar_sitio({'demo': RUTA})                # o {'demo': DEMO, 'personaje': PERSONAJE}
#   srv = servir(sitio)                                  # srv.server_address[1] es el puerto; srv.url('jugar/demo/prueba.html')
#
# Lo que la prueba escriba en el sitio (mundo.jsonl, objetos.json…) va en su raíz, que es suya y temporal; nada
# debe escribirse dentro de recursos/ (es el de docs/). shutil.rmtree(sitio) quita el enlace, no docs/recursos.
import os, re, shutil, socket, tempfile, threading, functools, http.server, socketserver

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DOCS = os.path.join(RAIZ, 'docs')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]


def _carpetas_interfaz():
    # las carpetas de iconos, interfaz, piezas y letras que pide el juego (src/logica/iconos.js)
    texto = open(os.path.join(RAIZ, 'src/logica/iconos.js'), encoding='utf-8').read()
    return [c.strip('/') for c in re.findall(r"CARPETA_(?:ICONOS|INTERFAZ|FUENTES|PIEZAS) = '([^']+)'", texto)]


def _enlazar(origen, destino, sin):
    # enlaza origen en destino; si hay que quitar algo de dentro (sin), la carpeta se hace de verdad y se baja un nivel
    if not sin:
        os.symlink(origen, destino); return
    os.makedirs(destino)
    for e in sorted(os.listdir(origen)):
        if e in sin: continue
        dentro = [x[len(e) + 1:] for x in sin if x.startswith(e + '/')]
        if dentro: _enlazar(os.path.join(origen, e), os.path.join(destino, e), dentro)
        else: os.symlink(os.path.join(origen, e), os.path.join(destino, e))


def montar_sitio(paginas, sin=()):
    """paginas: {carpeta: ruta del html}. sin: rutas dentro de recursos/ que no se sirven (para las pruebas que
    comprueban que sin un recurso fallan, como MUTAR_HOMBRO). Devuelve la carpeta temporal del sitio."""
    sitio = tempfile.mkdtemp()
    for carpeta, html in paginas.items():
        os.makedirs(os.path.join(sitio, 'jugar', carpeta), exist_ok=True)
        shutil.copy(os.path.abspath(html), os.path.join(sitio, 'jugar', carpeta, 'prueba.html'))
    _enlazar(os.path.join(DOCS, 'recursos'), os.path.join(sitio, 'recursos'), [x.strip('/') for x in sin])
    for c in _carpetas_interfaz():   # (hoy todas cuelgan de recursos/; si alguna sale de ahí, también se enlaza)
        destino = os.path.join(sitio, c)
        if not os.path.exists(destino) and os.path.isdir(os.path.join(DOCS, c)):
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            os.symlink(os.path.join(DOCS, c), destino)
    return sitio


class _Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def handle(self):   # la página cerrada a medias de una descarga no ensucia la salida
        try: super().handle()
        except Exception: pass


class _Servidor(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True
    def url(self, ruta=''):
        return f'http://127.0.0.1:{self.server_address[1]}/{ruta.lstrip("/")}'


def servir(sitio):
    """Sirve el sitio en 127.0.0.1 en un puerto libre, en un hilo aparte. Devuelve el servidor."""
    srv = _Servidor(('127.0.0.1', 0), functools.partial(_Silencioso, directory=sitio))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def puerto_libre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close()
    return p
