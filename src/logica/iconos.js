// La carpeta de las imágenes de cada cosa (panel de fabricar), dentro de docs/: las saca herramientas/iconos/sacar.py
// de los modelos del juego. Los recursos publicados no se cambian: si se vuelven a sacar, van a otra carpeta
// (iconos-v2…) y se cambia aquí. La comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_ICONOS = 'recursos/iconos-v13/';
// El kit de la interfaz (estudio del 7 nov, octava versión): los huecos, los botones, el medallón, el marco y el roble,
// y los iconos de latón, renderizados en Blender con herramientas/interfaz/kit.py. Lo usan las hojas de estilo del juego
// (src/plantilla.html, con la misma carpeta) y la barra de abajo. Los recursos publicados no se cambian: si se vuelven
// a sacar, van a otra carpeta (interfaz-v2…) y se cambia aquí y en la plantilla. Lo comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_INTERFAZ = 'recursos/interfaz-v1/';
