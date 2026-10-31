# Kinhold — en el PC de valravnx (pruebas con su tarjeta gráfica): Python carga este archivo solo al empezar si su
# carpeta está en PYTHONPATH (lo pone .github/workflows/pruebas.yml, y solo en su PC). Cambia, sin tocar las pruebas,
# cómo abren el navegador: quita el «--use-gl=swiftshader» (dibujar sin tarjeta) y pone lo que eligió
# herramientas/pc_grafica/elegir_gpu.py para usar la de verdad. Y dos cosas de Windows: la cola del servidor de páginas
# y los enlaces simbólicos. En la nube (y en las sesiones) no hace nada.
import os, json

_args = os.environ.get('KINHOLD_GPU_ARGS')
if _args:
    # las pruebas sirven las páginas con un socketserver.TCPServer de una sola cola de 5: en Linux, lo que no cabe
    # espera; en Windows, se rechaza (ERR_CONNECTION_REFUSED al pedir muchas imágenes a la vez: la web, 31 oct)
    import socketserver
    socketserver.TCPServer.request_queue_size = 128
    # en Windows, un enlace simbólico pide permisos de administrador (WinError 1314): una carpeta se enlaza con una
    # «unión» (no los pide) y un archivo se copia. Lo usa la prueba de volver donde lo dejaste (31 oct).
    if os.name == 'nt':
        _symlink = os.symlink
        def _enlazar(origen, destino, target_is_directory=False, **k):
            try: return _symlink(origen, destino, target_is_directory, **k)
            except OSError as e:
                if getattr(e, 'winerror', None) != 1314: raise
                o = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(destino)), origen))
                if os.path.isdir(o):
                    import _winapi
                    return _winapi.CreateJunction(o, os.path.abspath(destino))
                import shutil
                shutil.copy2(o, destino)
        os.symlink = _enlazar
    try:
        from playwright.sync_api._generated import BrowserType
    except Exception:
        BrowserType = None
    if BrowserType is not None:
        _extra = json.loads(_args)
        _canal = os.environ.get('KINHOLD_GPU_CANAL') or None
        _oculto = os.environ.get('KINHOLD_GPU_HEADLESS', '1') != '0'
        _original = BrowserType.launch

        def _launch(self, *a, **k):
            if self.name == 'chromium':
                quitar = ('--use-gl=', '--use-angle=')
                args = [x for x in (k.get('args') or []) if not x.startswith(quitar)]
                k['args'] = args + [x for x in _extra if x not in args]
                if _canal and not k.get('channel'): k['channel'] = _canal
                if not _oculto: k['headless'] = False
            return _original(self, *a, **k)

        BrowserType.launch = _launch
