// Decisiones tomadas en el personaje, para revisar.
export const VERSION_PERSONAJE = 'Personaje · v5 (Quaternius o taller propio con MakeHuman)';
export const REGISTRO_PERSONAJE = [
  'v2, por qué: el personaje esculpido por código de la v1 daba grima. Pedro: nada de inventos, usar bases ya hechas. Se usan los paquetes libres (CC0, se pueden usar y vender sin pagar ni citar) de Quaternius: Universal Base Characters, Modular Character Outfits – Fantasy y Universal Animation Library. Licencias junto a los modelos, en recursos/personajes/v1/ de la web.',
  'Cómo se monta: de la base se usa solo la cabeza y el cuello (el resto lo tapa la ropa, como indica el propio paquete), más la ropa, el pelo y la barba. Todo comparte el mismo esqueleto de 65 huesos, así que la ropa y las armaduras que vengan después se ponen y se quitan como capas.',
  'Personalización de prueba: hombre o mujer, ropa de campesino o de explorador, peinado, color del pelo, tono de piel y barba. El color de piel y de pelo se tiñe sobre las texturas del paquete.',
  'Animaciones del paquete (no hechas a mano): quieto, andar, talar, en guardia, golpe de espada y andar cargando, entre otras 26.',
  'Texturas reducidas para el navegador: 1024 px el color y 512 el relieve. Un personaje pesa unos 4 MB la primera vez (pelo, cabeza, ropa) más 4,4 MB de animaciones compartidas por todos.',
  'v3: en el móvil iba a 10 fps. Cambios: en pantallas táctiles empieza en calidad «ligera» (material sencillo con el color, sin relieve ni brillo), resolución de partida 1× y puede bajar hasta 0,5×; la ropa, el pelo y la barba comparten un solo esqueleto (antes cada malla calculaba el suyo).',
  'v3: interruptores de prueba de rendimiento (calidad, sombras, cabaña y suelo) para ver en tu móvil qué es lo que pesa, mirando los fps de arriba.',
  'v3: el traje de explorador ya no se ofrece: es demasiado de fantasía. Se buscan ropas de recreación histórica.',
  'v4: corrección. «Me va de 10» era que va perfecto, no 10 fps: vuelve la calidad alta por defecto también en el móvil, con la resolución de antes. La calidad ligera y los interruptores siguen como opción.',
  'v5: nueva opción «Base del personaje»: además del paquete de Quaternius, el taller propio. El cuerpo es de MakeHuman (libre, CC0) y la ropa, el pelo, la barba, la cofia, la piel y los ojos están hechos por código en el proyecto, sin paquetes de fuera. Así se puede hacer la ropa que queramos.',
  'v5: el taller propio usa las mismas animaciones de Quaternius, pasadas a su esqueleto: el reposo de MakeHuman (brazos en «A») se lleva a la postura del origen y en cada fotograma se copia el giro de cada hueso respecto a su reposo. La pelvis copia además los botes y agachadas, escalados por la altura.',
  'v5, provisional: en el taller propio solo hay un hombre (túnica, calzas, barba pintada) y una mujer (vestido y cofia con toca); el pelo, la piel y la ropa aún no se pueden cambiar. Pedro: «decente para usar de placeholder». Queda una claridad en la barbilla del hombre.',
  'Pendiente de decidir contigo: si el estilo de estas bases te vale como punto de partida para todo el juego (incluido el combate), y qué ropa medieval falta (gambesón, cota de malla, capas).',
]
