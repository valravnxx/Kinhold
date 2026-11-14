// La carpeta de las imágenes de cada cosa (panel de fabricar), dentro de docs/: las saca herramientas/iconos/sacar.py
// de los modelos del juego. Los recursos publicados no se cambian: si se vuelven a sacar, van a otra carpeta
// (iconos-v2…) y se cambia aquí. La comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_ICONOS = 'recursos/iconos-v26/';   // (v26, 14 nov: la criba de grano y el grano sin limpiar (P11; v25 la usa la rama del hierro de pantano); v24, 14 nov: la era de trillar (P11), con lo de v23; v23, 13 nov: el raspador de pieles, la piel limpia y el zurrón nuevo (P9), con lo de v22; v22: la gavilla, la col y el nabo de cosechar (P11); v20: la estaca de marcar el campo, junto con el secadero y la carne seca (v16) y las semillas silvestres (v17))
// El kit de la interfaz (estudio del 7 nov, octava versión): los huecos, los botones, el medallón, el marco y el roble,
// y los iconos de latón, renderizados en Blender con herramientas/interfaz/kit.py. Lo usan las hojas de estilo del juego
// (src/plantilla.html, con la misma carpeta) y la barra de abajo. Los recursos publicados no se cambian: si se vuelven
// a sacar, van a otra carpeta (interfaz-v2…) y se cambia aquí y en la plantilla. Lo comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_INTERFAZ = 'recursos/interfaz-v1/';
// Las imágenes de las piezas de construir (pz_<pieza>), los muebles (deco_<mueble>) y el mojón, para el menú de construir:
// herramientas/iconos/sacar.py <carpeta> conjunto=piezas. Como las otras, publicadas no se cambian.
export const CARPETA_PIEZAS = 'recursos/piezas-v2/';   // (v2, 13 nov: las de paja, que ya no se esconden)
export const CARPETA_FUENTES = 'recursos/fuentes/v1/';   // las letras del juego (EB Garamond, Alegreya SC): src/plantilla.html las carga
