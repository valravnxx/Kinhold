# Procedencia de los personajes (v2)

Los mismos modelos que la v1 (`../v1/`), sin cambios de forma, solo comprimidos para que bajen antes:

- Geometría con **meshopt** (`EXT_meshopt_compression`): normales, UV y pesos de los huesos cuantizados (`KHR_mesh_quantization`); las posiciones no, para que la ropa, el pelo y la barba sigan compartiendo un solo esqueleto. Animaciones también con meshopt.
- Texturas en **WebP** (`EXT_texture_webp`) en lugar de PNG y JPEG, con el mismo tamaño en píxeles.
- `animaciones_extra.glb` es la misma de la v1 (ya iba comprimida).

Preparados con `herramientas/preparar_personajes_v2.mjs` a partir de la v1. Huellas SHA-256 en `manifiesto.json`. En three.js hay que abrirlos con `GLTFLoader.setMeshoptDecoder`.

Autor: **Quaternius** (https://quaternius.com). Licencia **CC0 1.0** (dominio público). Textos de licencia en esta carpeta. Origen y detalle de cada paquete en `../v1/PROCEDENCIA.md`.
