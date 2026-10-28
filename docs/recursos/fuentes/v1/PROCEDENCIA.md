# Fuentes de la web de progreso (v1)

Fuentes libres con la licencia SIL Open Font License 1.1 (se pueden usar, incluir y redistribuir, también en un producto comercial; no se pueden vender por separado). Copiadas de los paquetes de npm `@fontsource` versión 5.3.0, solo en formato woff2 y solo los pesos y alfabetos que usa la web. La licencia de cada una está en `LICENCIA_<fuente>.txt`.

- **Cinzel Decorative** (700, 900; latino): el nombre «Kinhold». No tiene cirílico, así que solo se usa para el nombre del juego.
- **Alegreya SC** (500, 700, 800; latino y cirílico): títulos, pestañas, botones y etiquetas, en versalitas.
- **EB Garamond** (400, 600 y cursiva 400; latino y cirílico): el texto.

`fuentes.css` declara cada alfabeto con su `unicode-range`, así el navegador solo descarga los que necesita la página (el cirílico solo en ruso). Los archivos publicados no se cambian: una versión nueva va en `fuentes/v2/`.
