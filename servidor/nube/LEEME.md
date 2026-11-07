# Servidor de prueba de Kinhold en internet (hito 1f)

Para jugar en línea desde dos aparatos sin tener un ordenador encendido en casa. Decidido por valravnx el 27 oct:
un alojamiento en la nube con una cuenta suya. Aquí está todo preparado; solo hace falta crear la cuenta y la
máquina, y pegar un texto.

**Dónde:** Hetzner Cloud (es lo que salió de la medición, `servidor/medidas/LEEME.md`): el plan más pequeño,
**CX23** (2 vCPU, 4 GB), sobra para la prueba. Precio comprobado el 28 oct 2026 (en cloudtally.eu, no en la
página de Hetzner): 5,49 €/mes sin IVA, con 20 TB de tráfico incluidos. Hetzner cobra aparte la IPv4 pública:
mira el precio en la misma pantalla al crear la máquina. Se paga por horas: si borras la máquina, deja de
cobrarse.

## Pasos (unos 10 minutos)

1. Crea la cuenta en **hetzner.com** → *Cloud* (piden datos de pago y a veces una verificación).
2. En la consola de Hetzner Cloud: **nuevo proyecto** (por ejemplo «Kinhold») y dentro **añadir servidor**:
   - **Ubicación:** la que quieras de Europa (Alemania o Finlandia).
   - **Imagen:** **Ubuntu 24.04**.
   - **Tipo:** vCPU compartida, x86, **CX23**.
   - **Red:** con **IPv4 pública** marcada (hace falta: la dirección del juego sale de ella).
   - **Claves SSH:** si no tienes ninguna, sáltalo (Hetzner te manda la contraseña de root por correo).
   - **Cloud config:** pega **entero** el contenido de [`cloud-config.yaml`](cloud-config.yaml) (empieza por
     `#cloud-config`).
   - **Nombre:** por ejemplo `kinhold`. Pulsa **crear y comprar**.
   Los nombres de los botones pueden cambiar un poco; lo importante es Ubuntu 24.04, CX23, IPv4 y el cloud config.
3. Apunta la **IP** que sale (por ejemplo `65.21.10.20`). Espera **5 minutos** (la máquina instala Node.js, Caddy
   y el juego ella sola).
4. Abre en el navegador **`https://65-21-10-20.sslip.io`** (tu IP con guiones en vez de puntos). Te lleva a la demo
   con el servidor ya puesto. Haz lo mismo en el otro aparato (o mándale ese enlace a la otra persona) y entrad
   en **Jugar en línea** o **Duelo en línea**.

El mundo se guarda en la máquina (`/var/lib/kinhold/`): sigue ahí aunque se reinicie o se actualice.

**En marcha desde el 30 oct** (lo creó valravnx): CX23 en Falkenstein, Ubuntu 24.04, https://2-31-141-224.sslip.io. Desde el 1 nov, con la dirección propia **https://juego.playkinhold.com** (`/etc/kinhold-dominio`); Caddy sigue sirviendo también la de sslip.io, que llevan dentro las versiones ya publicadas.
El juego es siempre en línea (valravnx, 30 oct): la demo de la web de GitHub entra también a este servidor (la
dirección está en `src/mundo/direccion_servidor.js`; si cambia la IP, se cambia ahí).

**Ojo:** el servidor aún no tiene cuentas ni contraseñas (llegan en el hito 11). Como la web es pública, cualquiera
que abra la demo entra en este mundo y puede construir.

## Si algo no va

- **El enlace da error de certificado o no carga:** espera unos minutos más (el certificado HTTPS lo pide Caddy
  solo, a Let's Encrypt y, si este falla, a ZeroSSL; sslip.io es compartido por mucha gente y a veces Let's
  Encrypt lo limita). Si tras 15 minutos sigue igual, entra en la máquina (abajo) y mira
  `journalctl -u caddy -n 50`.
- **Entrar en la máquina:** en la consola de Hetzner, el botón de consola del servidor (se abre en el navegador),
  o desde un ordenador `ssh root@65.21.10.20`. Lo que hizo la instalación está en `/var/log/kinhold-instalar.log`.
- **Ver el servidor del juego:** `systemctl status kinhold` y `journalctl -u kinhold -f` (quién entra y sale).
- **Al día solo** (desde el 31 oct, lo pidió valravnx): cada 5 minutos el servidor mira si en main hay una versión
  nueva de la demo y, si la hay, se pone al día él solo (`auto_actualizar.sh`, que lanza `actualizar.sh`). Con lo
  demás que se sube (el diario, la web) no hace nada, para no reiniciarse sin necesidad. Al ponerse al día, los que
  estén jugando se desconectan unos segundos y el juego vuelve a conectar solo. Lo que ha hecho:
  `journalctl -u kinhold-actualizar`. Para pararlo: `systemctl disable --now kinhold-actualizar.timer`.
  **Para encenderlo en el servidor que ya está en marcha (una vez):** en la consola de Hetzner, como root,
  `bash /opt/kinhold/servidor/nube/actualizar.sh`; esa actualización deja puesto el temporizador. Las máquinas nuevas
  lo traen de serie.
- **Poner la última versión del juego a mano** (ya no hace falta, pero vale): `bash /opt/kinhold/servidor/nube/actualizar.sh`.
  No borra el mundo.
- **Con un dominio propio** (si algún día compras uno): apúntalo a la IP y lanza
  `KINHOLD_DOMINIO=juego.tudominio.com bash /opt/kinhold/servidor/nube/instalar.sh`.
- **El admin, por la cuenta y su correo** (panel de depuración: F9 en el juego o el botón «Admin»; revisión del 1 nov y
  valravnx, 2 nov): el panel sale solo a quien ha entrado con una cuenta cuyo correo **confirmado** sea el que diga la
  máquina. El nombre de usuario ya no cuenta (así nadie se hace admin por quedarse antes el nombre «valravnx»), y
  **sin poner el correo en la máquina no hay admin**. En la consola de Hetzner, como root, una vez (cambia
  `tu@correo.com` por el correo de tu cuenta; para varios, separados por comas):
  ```
  mkdir -p /etc/kinhold && echo "KINHOLD_ADMIN_CORREO=tu@correo.com" > /etc/kinhold/admin.env && chmod 600 /etc/kinhold/admin.env && systemctl restart kinhold
  ```
  Luego entra en el juego con tu cuenta y confirma ese correo (si no lo estaba). `KINHOLD_ADMIN_CUENTA=` y la clave
  `KINHOLD_ADMIN=` de antes ya no se usan (si están en ese archivo, no hacen nada). Lo que se ha pedido con el panel
  (quién, con qué cuenta, qué y si valió) queda en `/var/lib/kinhold/admin.jsonl`.
- **El correo de las cuentas (Resend; valravnx, 2 nov).** Al crear una cuenta hay que dar un correo (uno por cuenta) y
  confirmarlo con un código de 6 cifras que llega a él (caduca a los 15 minutos; otro, como pronto al minuto, y como
  mucho 5 por hora). **Sin confirmarlo no se entra en el mundo.** Las cuentas de antes lo añaden y lo confirman al entrar.
  Los códigos los manda el servidor con [Resend](https://resend.com) desde `cuentas@playkinhold.com`.
  **Mientras no esté la clave de Resend en la máquina, no se manda ningún correo:** el código queda en el registro del
  servidor. Para verlo, en la consola de Hetzner, como root: `journalctl -u kinhold | grep 'código de verificación'`
  (sale el usuario, el código y el correo a medias).
  Pasos, una vez:
  1. En Resend (ya hecho el 2 nov): cuenta creada y dominio `playkinhold.com` añadido (región Irlanda, eu-west-1) con la
     configuración automática de Cloudflare.
  2. En Cloudflare, en los DNS de `playkinhold.com`, tienen que estar los registros que pidió Resend: `send` (MX y TXT de
     SPF, o los CNAME que dé Resend), `resend._domainkey` (TXT, DKIM) y, si lo pone, `_dmarc`. Todos **sin proxy** («DNS
     only»). Esperar a que en Resend, en *Domains*, el dominio salga **Verified**.
  3. En Resend, *API Keys* → *Create API Key*: permiso **Sending access** y dominio solo `playkinhold.com`. Copiar la
     clave (empieza por `re_`; solo se ve una vez). **Nunca va al repositorio ni a ningún mensaje.**
  4. En la consola de Hetzner, como root (cambiando `re_xxx` por la clave):
     ```
     mkdir -p /etc/kinhold && echo "RESEND_API_KEY=re_xxx" > /etc/kinhold/correo.env && chmod 600 /etc/kinhold/correo.env && bash /opt/kinhold/servidor/nube/actualizar.sh
     ```
     (`actualizar.sh` pone el servicio al día para que lea ese archivo y lo reinicia.) Al arrancar, el registro dice
     `correo: Resend`; sin la clave, `correo: sin clave de Resend, los códigos van al registro`. Para mandar desde otra
     dirección del dominio, añadir en ese archivo `KINHOLD_CORREO_DE=Kinhold <otra@playkinhold.com>`.
  Cada código pedido (sin el código) y cada confirmación quedan en `/var/lib/kinhold/seguridad.jsonl`, con el correo a
  medias. Si Resend no responde o rechaza el correo, el jugador ve «No se ha podido mandar el correo» y puede pedir otro.
- **Empezar el mundo de cero (wipe):** `systemctl stop kinhold && find /var/lib/kinhold -maxdepth 1 \( -name '*.json' -o -name '*.jsonl' \) ! -name cuentas.jsonl ! -name seguridad.jsonl -delete && systemctl start kinhold`.
  Borra lo construido, lo que lleva cada uno y lo del suelo, las fichas de cada navegador y dónde estaba cada uno: todos
  vuelven a empezar como nuevos, en la salida. **Las cuentas se quedan** (`cuentas.jsonl`): cada uno entra con su
  usuario y su contraseña y es el mismo personaje, empezando de cero. Para borrar también las cuentas, el `rm -f
  /var/lib/kinhold/*.json /var/lib/kinhold/*.jsonl` de antes.
- **Cuentas** (usuario y contraseña): en `/var/lib/kinhold/cuentas.jsonl`, una por línea, con la contraseña resumida
  (scrypt con sal; nunca en claro). Tras 5 contraseñas mal seguidas a una cuenta, o 20 fallos desde la misma dirección,
  se espera 15 minutos. Cuentas nuevas (2 nov): como mucho 3 por dirección y hora y 30 en total por hora, y entre una y
  la siguiente desde la misma dirección una espera que crece (1 min, 2, 4…, recordando 24 h); las IPv6 cuentan por su
  bloque /64. La dirección es la última que pasa Caddy en `X-Forwarded-For`. Contraseñas de 10 caracteres o más, sin
  las más usadas (`src/logica/claves_comunes.js`).
- **Fichas de cada navegador** (`fichas.jsonl`): las de un personaje con cuenta caducan a los 30 días (hay que volver a
  entrar); «Salir en todos los aparatos», en el menú, deja sin valer todas las de ese personaje.
- **Registro de seguridad**: `/var/lib/kinhold/seguridad.jsonl`, una línea por alta, entrada, fallo, salida en todos
  los aparatos y ficha caducada, con la hora, el usuario y la dirección (nunca la contraseña ni la ficha). El wipe de
  arriba no lo borra. Verlo: `tail -n 50 /var/lib/kinhold/seguridad.jsonl`.
- `KINHOLD_PRUEBAS_ALTAS=libres` quita los límites de altas: **solo para las pruebas**; nunca en este servidor (si
  estuviera, lo dice la línea de arranque en `journalctl -u kinhold`).

## Copia de seguridad (auditoría del 4 nov)

Una vez al día (03:41 UTC, más o menos 10 minutos; si la máquina estaba apagada, al encenderla) `kinhold-copia.timer`
lanza `copia.sh`: todo `/var/lib/kinhold` (el mundo, los objetos, las posiciones, las fichas, las cuentas, las
tierras y los registros) en un `kinhold-<fecha>.tar.gz` en `/var/backups/kinhold`, donde quedan **las últimas 14**,
y esa carpeta, igual (también las 14), **fuera de la máquina**. Se hace con el servidor en marcha. Lo ponen
`instalar.sh` y `actualizar.sh` (o sea, entra solo con la próxima versión de la demo).

**Falta una cosa que solo puede hacer valravnx: el sitio de fuera.** Mientras no esté, la copia se hace en la
máquina pero sale con error (`systemctl --failed`), porque si se pierde la máquina se pierde con ella. Propuesta
sencilla: una **Storage Box** de Hetzner (en la consola de Hetzner, *Storage Boxes*, la más pequeña sobra; mira el
precio allí). Los nombres de los botones pueden cambiar un poco.

1. Crea la Storage Box y, en su configuración, activa el **acceso por SSH**. Apunta su usuario (`u123456`).
2. En la máquina del juego (consola de Hetzner o `ssh root@…`), una clave solo para la copia:
   ```
   mkdir -p /etc/kinhold && ssh-keygen -t ed25519 -N "" -C kinhold-copia -f /etc/kinhold/copia_clave
   ssh-copy-id -p 23 -s -i /etc/kinhold/copia_clave.pub u123456@u123456.your-storagebox.de
   ```
   (la segunda pide una vez la contraseña de la Storage Box; también se puede pegar `copia_clave.pub` en la consola).
3. Dile dónde:
   ```
   printf 'KINHOLD_COPIA_DESTINO=u123456@u123456.your-storagebox.de:kinhold\nKINHOLD_COPIA_PUERTO=23\n' > /etc/kinhold/copia.env
   chmod 600 /etc/kinhold/copia.env /etc/kinhold/copia_clave
   ```
4. Pruébalo a mano: `bash /opt/kinhold/servidor/nube/copia.sh` tiene que acabar en «Copia fuera de la máquina al día».

Vale cualquier otro sitio al que se llegue por SSH con rsync (otra máquina, un NAS), o una carpeta montada de otro
disco (`KINHOLD_COPIA_DESTINO=/mnt/otro/kinhold`).

- **Ver las copias**: `ls -lh /var/backups/kinhold` y `journalctl -u kinhold-copia -n 20`.
- **Restaurar** (para el servidor, deja lo de antes en `/var/lib/kinhold.antes-<fecha>` sin borrarlo, pone la copia
  y lo vuelve a arrancar): `bash /opt/kinhold/servidor/nube/restaurar.sh --ultima`, o con el archivo de una copia.
  Si la máquina se ha perdido: en una nueva (pasos de arriba), pon otra vez la clave y `copia.env` y trae las copias
  con `rsync -e "ssh -p 23 -i /etc/kinhold/copia_clave" u123456@u123456.your-storagebox.de:kinhold/ /var/backups/kinhold/`.
- **Si falta algo del mundo** (valravnx, 7 nov: se le borró lo de su base): `node /opt/kinhold/servidor/revisar_mundo.mjs`
  (solo lee, con el servidor en marcha) dice por cada tierra cuántas construcciones, piezas, puestos y cosas del suelo
  tiene, si algo ha quedado enterrado bajo el terreno de hoy y si alguna acción que salió bien ya no sale al rehacer el
  mundo con el código de hoy (el servidor también lo avisa al arrancar, en `journalctl -u kinhold`). Para mirar una
  copia: sácala en una carpeta (`tar -xzf <copia> -C /tmp/copia`) y `node … revisar_mundo.mjs /tmp/copia`.
- Dentro van las cuentas (las contraseñas, solo resumidas) y los correos: la carpeta y cada copia son solo de root.
- La prueba: `node pruebas/prueba_copia_servidor.mjs` (el servidor de verdad: una cuenta, 16 días de copias, se
  pierde todo, se trae de «fuera», se restaura y la cuenta vuelve a entrar).

## Qué hay en esta carpeta

- `cloud-config.yaml` — lo que se pega al crear la máquina: clona el juego y lanza `instalar.sh`.
- `instalar.sh` — instala Node.js 22, Caddy, el juego en `/opt/kinhold`, el servicio `kinhold` (arranca solo y
  vuelve a arrancar si se cae) y el cortafuegos (solo SSH, HTTP y HTTPS; el puerto del juego no se ve desde fuera).
  Repetirlo no hace daño.
- `actualizar.sh` — trae lo último de main y reinicia el servidor (y deja puesto el temporizador de abajo).
- `auto_actualizar.sh`, `kinhold-actualizar.service.plantilla` y `kinhold-actualizar.timer` — el servidor al día solo
  con cada versión nueva de la demo. Su prueba: `node pruebas/prueba_auto_actualizar.mjs` (un repositorio de mentira
  y una copia corta como la del servidor).
- `copia.sh`, `restaurar.sh`, `kinhold-copia.service.plantilla` y `kinhold-copia.timer` — la copia de seguridad
  diaria y cómo volver a ella (arriba, «Copia de seguridad»).
- `Caddyfile.plantilla` y `kinhold.service.plantilla` — lo que rellena `instalar.sh`. Caddy pone el HTTPS (la web
  pública va por HTTPS y solo puede conectar con `wss://`), pasa el WebSocket al juego y manda a quien abre la
  dirección a la demo con `?servidor=wss://…`.
- La prueba: `node pruebas/prueba_nube.mjs` (Caddy de verdad delante del servidor del juego, con HTTPS local, y
  dos clientes que se ven a través de él).

No comprobado: la instalación entera en una máquina de Hetzner de verdad (aquí no hay una), las descargas de
NodeSource y del repositorio de Caddy (desde aquí no se pueden abrir) y el certificado real con sslip.io.
