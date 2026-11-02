// Las contraseñas más usadas o filtradas que pasan del largo mínimo (cuentas más seguras, valravnx, 2 nov). Guardada en el
// juego: no se pregunta a ningún sitio de fuera. Lista propia (sin copiar ninguna lista ajena): las que más salen en las
// filtraciones públicas, en inglés, español y ruso, filas del teclado, y las del propio juego; y además cada palabra base
// con los añadidos de siempre (números y años al final, un signo). Se compara sin mayúsculas.
// Las de menos de 10 caracteres ya no valen por el largo (src/logica/cuentas.js), así que no hace falta tenerlas.
// Lógica pura (la usan el servidor y la pantalla de la cuenta).

const SUELTAS = [
  '1234567890', '0987654321', '12345678910', '1234567891', '1234512345', '123123123123', '1122334455', '1212121212',
  '123456789a', 'a123456789', '123456789q', 'q123456789', '1234567890q', '12345qwert', '12345abcde', 'abcde12345',
  'qwertyuiop', 'qwertyuiop1', 'qwertyuiop123', 'asdfghjkl1', 'asdfghjklñ', 'zxcvbnm123', 'zxcvbnmasd', 'qazwsxedc1',
  'qazwsxedcrfv', '1qaz2wsx3edc', '1qaz2wsx3e', '1q2w3e4r5t', '1q2w3e4r5t6y', 'q1w2e3r4t5', 'q1w2e3r4t5y6', 'a1b2c3d4e5',
  '1a2b3c4d5e', 'qwerty1234', 'qwerty12345', 'qwerty123456', 'qwertyqwerty', 'asdasdasd1', 'asdfasdfasdf', 'qweasdzxc1',
  'qweasdzxc123', 'zaq12wsxcde3', '1qazxsw23edc', 'passw0rd123', 'p@ssw0rd123', 'p@ssword123', 'passwordpassword',
  'iloveyou12', 'iloveyou123', 'iloveyou1234', 'loveyou123', 'trustno1234', 'letmein123', 'letmein1234', 'welcome123',
  'welcome1234', 'administrator', 'administrador', 'admin12345', 'admin123456', 'adminadmin', 'adminadmin1',
  'changeme123', 'default123', 'computer123', 'internet123', 'sunshine123', 'princess123', 'football123', 'baseball123',
  'basketball', 'basketball1', 'whatever123', 'dragon12345', 'monkey12345', 'master12345', 'shadow12345', 'michael123',
  'jennifer123', 'charlie123', 'qwerty123qwe', 'iloveyou!!',
  // español
  'contraseña', 'contraseña1', 'contraseña12', 'contraseña123', 'contrasena', 'contrasena1', 'contrasena123',
  'micontraseña', 'micontrasena', 'tucontraseña', 'teamo12345', 'teamomucho', 'tequiero123', 'tequieromucho',
  'princesa123', 'mariposa123', 'estrella123', 'corazon123', 'chocolate1', 'chocolate123', 'familia123',
  'abcdefghij', 'holahola12', 'holamundo1', 'holamundo123', 'españa1234', 'espana1234', 'mexico1234', 'argentina1',
  'argentina123', 'colombia123', 'venezuela1', 'madrid1234', 'barcelona1', 'barcelona123', 'sevilla1234',
  // ruso (también las que salen al escribir en inglés con el teclado ruso)
  'йцукенгшщз', 'йцукенгшщзхъ', 'фывапролдж', 'ячсмитьбю', 'пароль1234', 'пароль12345', 'парольпароль', 'qwertyйцукен',
  'gfhjkm1234', 'gfhjkm12345', 'ghbdtn1234', 'ytpyf.11234', 'zxcvbnm,./', 'любовь1234', 'наташа1234', 'привет1234',
  // del juego
  'kinhold123', 'kinhold1234', 'kinhold2026', 'playkinhold', 'playkinhold1', 'kinholdkinhold', 'valravnx123',
];

// palabra base + añadido (solo cuentan las que llegan al largo mínimo)
const BASES = ['password', 'contraseña', 'contrasena', 'qwerty', 'kinhold', 'iloveyou', 'teamo', 'tequiero', 'admin',
  'welcome', 'letmein', 'princesa', 'pass', 'clave', 'secreto', 'usuario', 'jugador', 'abc', 'abcd', 'abcdef', 'пароль',
  'qwerty123', 'asdfgh', 'zxcvbn', 'monkey', 'dragon', 'master', 'shadow', 'sunshine', 'football', 'hola', 'amor', 'gfhjkm'];
const COLAS = ['', '1', '12', '123', '1234', '12345', '123456', '1234567', '!', '!!', '1!', '123!', '01', '007', '69', '99',
  '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'];

const LISTA = new Set(SUELTAS.map(c => c.normalize('NFC').toLowerCase()));
for (const b of BASES) for (const c of COLAS) LISTA.add((b + c).normalize('NFC').toLowerCase());

export const CLAVES_COMUNES = LISTA;
export const esClaveComun = (c) => typeof c === 'string' && LISTA.has(c.normalize('NFC').toLowerCase());
