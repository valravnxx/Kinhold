# La naturaleza de Meshy (meshy-v1)

- Las siete especies de árbol del mundo (abeto, pino, abedul, roble, haya, fresno y encina), adultas y jóvenes, el
  matorral, el arbusto de las bayas, la roca, la peña, el canto rodado, la mata de hierba, las flores, las ortigas, los
  juncos y los helechos: hechos con Meshy (generador de modelos 3D con IA, plan Premium de valravnx) el 10 y 11 nov de
  2026 por su API, desde GitHub Actions (`herramientas/meshy/encargo.py`, acción «modelos»): primero una imagen con el
  prompt de estilo de valravnx (`herramientas/meshy/estilo.md`, la maqueta en miniatura) y la cosa, y de ella el modelo,
  sin el remallado de Meshy.
- Preparados para el juego con `herramientas/meshy/preparar_naturaleza.mjs` (medidas en `naturaleza_lista.json`): a la
  medida de los de código, el pie en el suelo, tres mallas por modelo («cerca» con la textura en WebP; «medio» y «lejos»
  con el color de la textura en los vértices y menos triángulos), el pie oscurecido y meshopt.
- Licencia: la de las condiciones de Meshy para la cuenta de valravnx (no comprobado aquí el texto exacto).
- Los tres juncos de las riberas y la marisma (valravnx, 13 nov 2026: «haz con meshy tanto los juncos recolectables, juncos
  cortados y juncos que no valen para recoger»): `junco_recoger` (la mata que se corta), `junco_cortado` (lo que queda
  hasta que vuelve a crecer) y `junco_adorno` (la mata rala y seca que no vale), hechos igual, con Meshy y el prompt de
  estilo, el 13 nov de 2026 (unos 117 créditos), y preparados con `herramientas/meshy/preparar_naturaleza.mjs`.
