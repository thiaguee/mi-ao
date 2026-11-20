# Norway AO — Guía para el dueño del servidor

Esta guía explica, sin tecnicismos, cómo poner tu servidor en internet para que
cualquiera pueda jugar, y cómo usar tus poderes de GM.

---

## 1. Qué hay en este proyecto

| Carpeta | Qué es |
|---|---|
| `server/` | El **servidor**: el programa que queda prendido en internet y maneja el mundo. |
| `client/` | El **juego** que ven los jugadores (gráficos, mapas, música, sonidos). |
| `launcher/` | Lo que arma el **instalador para Windows** (`NorwayAO-Instalador.exe`). |
| `instalar-servidor.sh` | Un script que instala todo en el servidor alquilado con un solo comando. |

Las reglas del juego (clases que evolucionan, fórmulas de vida, golpe y maná,
experiencia, etc.) están tomadas del código liberado de **Norway AO**. El mundo,
los gráficos, los mapas y la música son los de **Argentum Online Libre**.
Ambos tienen licencia libre (GPL/AGPL), así que podés usarlos.

---

## 2. Poner el servidor en internet (una sola vez)

### Paso 1: alquilar un servidor (VPS)

Cualquiera de estas empresas sirve: **Hetzner**, **Contabo**, **DigitalOcean**,
**Vultr**. Elegí:

- Sistema operativo: **Ubuntu 24.04**
- Memoria: **2 GB** o más
- Lugar: el más cercano a tus jugadores (por ejemplo, São Paulo o Estados Unidos)

Cuesta unos 5 dólares por mes. Cuando lo creás te van a dar una **IP**
(cuatro números, como `123.45.67.89`) y una **contraseña de root**.

### Paso 2: conectarte al servidor

En tu PC con Windows, abrí **PowerShell** (buscalo en el menú Inicio) y escribí
(cambiando la IP por la tuya):

```
ssh root@123.45.67.89
```

Te va a pedir la contraseña. Al escribirla no se ve nada en pantalla, es normal.

### Paso 3: instalar el juego

Copiá y pegá estos comandos, uno por uno (cambiando la dirección por la de tu repositorio):

```
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO norwayao
```

```
cd norwayao
```

```
bash instalar-servidor.sh
```

Tarda unos 10 minutos. Al terminar te muestra dos links:

- `http://TU_IP:7666/descargar` → el **instalador para Windows**, que es lo que les pasás a los jugadores.
- `http://TU_IP:7666` → para **jugar desde el navegador**, sin instalar nada.

### Paso 4: crear los personajes administradores primero

Los personajes **Thiago** y **Lautaro** quedan como **ADMINISTRADORES** apenas se crean.
Creen esos dos personajes **antes** de pasarle el link a nadie. Si no, otra persona podría
crear un personaje con ese nombre y quedarse con los poderes.

Para sumar o sacar administradores después, usá `/DARGM nombre nivel` adentro del juego,
o editá la lista `gms` en `server/config.json`.

---

## 3. Tus poderes de GM

**Clic derecho en el mapa = te teletransportás ahí.**

Escribís los comandos en el chat del juego (Enter, el comando y Enter otra vez).
Con `/GMAYUDA` ves la lista completa adentro del juego.

### Moverte y vigilar
| Comando | Qué hace |
|---|---|
| `/IR nombre` | Te lleva al lado de un jugador. |
| `/SUM nombre` | Trae a un jugador al lado tuyo. |
| `/TELEP YO mapa x y` | Te teletransporta (por ejemplo `/TELEP YO 1 58 45` va a Ullathorpe). |
| `/TELEP nombre mapa x y` | Teletransporta a otro jugador. |
| `/TELEPLOC` | Te lleva al último lugar donde hiciste clic. |
| `/INVISIBLE` | Nadie te ve. |
| `/CAMINAR` | Atravesás paredes. |
| `/DONDE nombre` · `/INFO nombre` | Dónde está un jugador y sus datos. |
| `/ONLINE` · `/ONLINEGM` | Quién está conectado. |
| `/SOS` | Ver los pedidos de ayuda (los jugadores te escriben con `/GM mensaje`). |

### Castigar
| Comando | Qué hace |
|---|---|
| `/CARCEL nombre minutos` | Lo manda a la cárcel. |
| `/SILENCIAR nombre minutos` | No puede hablar (con `0` le sacás el castigo). |
| `/ECHAR nombre` | Lo desconecta. |
| `/BAN nombre` · `/UNBAN nombre` | Banear y desbanear. |

### Crear y regalar
| Comando | Qué hace |
|---|---|
| `/CI numero cantidad` | Crea un objeto (por ejemplo, `/CI 38 100` crea 100 pociones rojas). |
| `/BUSCAROBJ texto` | Busca el número de un objeto (por ejemplo, `/BUSCAROBJ espada`). |
| `/ACC numero` | Crea un NPC o monstruo al lado tuyo. |
| `/BUSCARNPC texto` | Busca el número de un NPC (por ejemplo, `/BUSCARNPC dragon`). |
| `/ORO nombre cantidad` | Da oro. |
| `/NIVEL nombre nivel` · `/EXP nombre cantidad` | Sube de nivel o da experiencia. |
| `/SKILLS nombre valor` | Pone todos los skills en ese valor. |
| `/HECHIZO nombre numero` | Le enseña un hechizo. |
| `/CLASE nombre numero` | Le cambia la clase. |
| `/MOD nombre HP 500` | Cambia vida, maná, energía, atributos, oro o golpe (HP, MAN, STA, ATRIB, ORO, BANCO, GOLPE). |
| `/REVIVIR nombre` · `/CURARU nombre` | Revive o cura completo. |

### Otros
| Comando | Qué hace |
|---|---|
| `/GOD` | Sos invulnerable y matás de un golpe. |
| `/MATAR` · `/RMATA` | Mata el NPC que señalaste, o todos los monstruos alrededor. |
| `/LIMPIAR` | Borra los objetos tirados en el mapa. |
| `/LLUVIA` | Activa o desactiva la lluvia. |
| `/RMSG texto` | Mensaje para todo el servidor en el chat. |
| `/ANUNCIO texto` | Cartel grande en la pantalla de todos. |
| `/MOTD texto` | Cambia el mensaje de bienvenida. |
| `/DARGM nombre nivel` | Nombra GMs: 1 Consejero, 2 Semidiós, 3 Dios, 4 Admin, 0 le saca el cargo. |
| `/GRABAR` | Guarda todos los personajes ya. (Igual se guardan solos cada 5 minutos.) |
| `/APAGAR` | Apaga el servidor (se vuelve a prender solo a los pocos segundos). |

---

## 4. Configuración (`server/config.json`)

En el servidor podés editar este archivo con `nano server/config.json`
(se guarda con Ctrl+O y Enter, y se sale con Ctrl+X). Después reiniciá con
`systemctl restart norwayao`.

| Opción | Para qué sirve |
|---|---|
| `nombreServidor` | El nombre que aparece en el juego. |
| `multiplicadorExp` | Cuánto rinde la experiencia. Viene en `50` (50 veces más que el original). |
| `multiplicadorOro` | Lo mismo para el oro que tiran los monstruos. Viene en `50`. |
| `oroInicial` | Oro con el que arranca cada personaje nuevo (viene en `1000`). |
| `respawnSegundos` | Cuánto tardan en reaparecer los monstruos. |
| `chatGlobal` | `true` o `false` para permitir el comando `/GLOBAL`. |
| `gms` | Lista de GMs por rango (también se maneja con `/DARGM`). |
| `motd` | Mensajes de bienvenida. |

Los personajes se guardan en `server/cuentas/` (un archivo por personaje) y los
registros (chat, comandos de GM, conexiones) en `server/logs/`.

---

## 5. Cómo se juega

Hay dos modos de teclas. Se cambia con el botón **⌨** del panel derecho y viene en **Moderno**.

| Acción | Moderno | Clásico |
|---|---|---|
| Caminar | WASD o flechas | Flechas |
| Tomar pociones (potear) | Seleccioná la poción y apretá **Espacio** | Seleccioná la poción y apretá U |
| Atacar | Ctrl | Ctrl |
| Agarrar del piso | Q | A |
| Meditar | F | M |
| Lanzar hechizo | Pestaña Hechizos → Lanzar → clic en el objetivo | Igual |
| Equipar · Tirar | E · T | E · T |
| Macro de hechizos | **F7** (elegí el hechizo, F7 lo tira solo a los bichos y se potea) | F7 |
| Mapa del mundo | M | Botón MAPA |
| Hablar | Enter | Enter |
| Mirar · Interactuar | Clic · Doble clic | Clic · Doble clic |

Con doble clic comerciás con los vendedores, usás el banco, te revive el sacerdote y abrís puertas.
Con arco: equipá el arco y las flechas, apretá Ctrl y hacé clic en el objetivo.

### Clases (como en Fénix)

Todos empiezan como **Ciudadano**:

- Nivel 3: Trabajador o Luchador.
- Nivel 6:
  - El Trabajador elige entre Experto en minerales, Experto en madera, Pescador, Sastre o Alquimista.
  - El Luchador elige entre Con uso de maná o Sin uso de maná.
- Nivel 9:
  - Con maná: Hechicero, Orden sagrada, Naturalista o Sigiloso.
  - Sin maná: Caballero o Bandido.
- Nivel 12:
  - Hechicero: Mago o Nigromante.
  - Orden sagrada: Paladín o Clérigo.
  - Naturalista: Bardo o Druida.
  - Sigiloso: Asesino o Cazador.
  - Caballero: Arquero o Guerrero.
  - Bandido: Pirata o Ladrón.

---

## 6. Jugar en tu PC (sin alquilar nada)

1. Entrá a la página de descargas: **https://github.com/thiaguee/mi-ao/releases/latest**
2. Abajo, en **Assets**, descargá **`NorwayAO-Instalador.exe`**.
3. Ejecutalo e instalá. Si Windows avisa "Windows protegió su PC": **Más información** → **Ejecutar de todas formas**.
4. Se crea el ícono **Norway AO** en el escritorio. Abrilo y jugá.

La aplicación trae el servidor adentro: no hace falta instalar nada más ni abrir el navegador.
Así juega solamente tu PC. Para que entren otros jugadores hace falta el servidor alquilado (punto 2).

Cada vez que se suben cambios al proyecto, GitHub arma solo un instalador nuevo y lo publica en esa misma página.
