// La carpeta de las imágenes de cada cosa (panel de fabricar), dentro de docs/: las saca herramientas/iconos/sacar.py
// de los modelos del juego. Los recursos publicados no se cambian: si se vuelven a sacar, van a otra carpeta
// (iconos-v2…) y se cambia aquí. La comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_ICONOS = 'recursos/iconos-v32/';   // (v32, 16 nov: el remo de la canoa (P11d), con lo de v31; v31, 16 nov: la canoa de un tronco y la canoa a medias (P11d), con lo de v30; v30, 15 nov: la rodaja de tronco (P11c), con lo de v29; v29, 14 nov: el cubo de agua (P11b), con lo de v28; v28, 14 nov: la criba del hierro de pantano (P10), con lo de v26; v25 y v27 las usó su rama; v26, 14 nov: la criba de grano y el grano sin limpiar (P11; v25 la usa la rama del hierro de pantano); v24, 14 nov: la era de trillar (P11), con lo de v23; v23, 13 nov: el raspador de pieles, la piel limpia y el zurrón nuevo (P9), con lo de v22; v22: la gavilla, la col y el nabo de cosechar (P11); v20: la estaca de marcar el campo, junto con el secadero y la carne seca (v16) y las semillas silvestres (v17))
// El kit de la interfaz (estudio del 7 nov, octava versión): los huecos, los botones, el medallón, el marco y el roble,
// y los iconos de latón, renderizados en Blender con herramientas/interfaz/kit.py. Lo usan las hojas de estilo del juego
// (src/plantilla.html, con la misma carpeta) y la barra de abajo. Los recursos publicados no se cambian: si se vuelven
// a sacar, van a otra carpeta (interfaz-v2…) y se cambia aquí y en la plantilla. Lo comprueba pruebas/prueba_iconos.mjs.
export const CARPETA_INTERFAZ = 'recursos/interfaz-v1/';
// Las imágenes de las piezas de construir (pz_<pieza>), los muebles (deco_<mueble>) y el mojón, para el menú de construir:
// herramientas/iconos/sacar.py <carpeta> conjunto=piezas. Como las otras, publicadas no se cambian.
export const CARPETA_PIEZAS = 'recursos/piezas-v5/';   // (v5, 15 nov: el muro de entramado con su puerta y su ventana (P11c), con lo de v4; v4, 15 nov: el portón de empalizada sin hierro (P11c), con lo de v3; v3, 15 nov: la empalizada, que ya no se esconde (P11c); v2, 13 nov: las de paja, que ya no se esconden)
export const CARPETA_FUENTES = 'recursos/fuentes/v1/';   // las letras del juego (EB Garamond, Alegreya SC): src/plantilla.html las carga
