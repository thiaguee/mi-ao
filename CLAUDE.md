# Norway AO — guía rápida para Claude

Argentum Online estilo Fénix reescrito en JS. Servidor Node.js + WebSocket (`ws`), cliente HTML5 servido por el mismo servidor en `http://localhost:7666`. Sin frameworks ni build en el cliente.

## Reglas para ahorrar contexto
- NO explores el repo: usá el mapa de abajo e ir directo al archivo.
- Los `.dat` grandes (`obj.dat`, `npcs.dat`, `hechizos.dat`) se buscan con Grep por número o nombre; nunca leerlos enteros.
- Nunca leer assets: `client/assets/**`, `server/data/mapas/**`, `*.png`, `*.map`, `*.wav`, `*.mp3`, `*.xlsx`, `*.zip`.
- `client/js/main.js` y `server/src/player.js` son largos: leé solo el rango que necesites (Grep primero, después Read con offset/limit).
- Respuestas cortas; no repitas código que no cambió.

## Arquitectura
- `server/src/main.js`: HTTP + WebSocket, config, loop. Arma el objeto `world` mezclando (`Object.assign`) los módulos de sistema; cada módulo exporta funciones que se cuelgan de `world`.
- Protocolo: mensajes JSON `{ t: 'tipo', ... }` (ej. `create`, `login`, `move`, `talk`, `attack`). Cliente en `client/js/net.js`.
- Datos: `server/src/gamedata.js` carga `server/data/dat/*.dat` (formato INI, parser en `ini.js`) y los JSON de `server/data/`.

## Dónde está cada sistema (server/src)
| Sistema | Archivo |
|---|---|
| Personaje, stats, inventario, muerte | `player.js` |
| Combate y NPCs (IA, tipos) | `combat.js` |
| Hechizos | `spells.js` (+ `data/hechizos-clases.json`) |
| Clic / usar / hablar con NPCs | `interact.js` |
| Comandos de GM | `commands.js`, `npcsgm.js` |
| Mapas, movimiento, mundo | `world.js`, `teleports.js` |
| Cuentas | `accounts.js` |
| Misiones / quests | `misiones.js` (+ `data/misiones.json`, `tools/misiones.py`) |
| Clanes, guerra, torneo, ranking | `clanes.js`, `guerra.js`, `torneo.js`, `ranking.js` |
| Facción, nobleza | `faccion.js`, `nobleza.js` |
| Tiendas, estructuras | `tiendas.js`, `estructuras.js` |
| Panel /TESTEO | `testeo.js` |

Cliente (`client/js`): `engine.js` y `capas.js` (render), `mapas.js`/`mapdata.js`, `audio.js`, `assets.js`, `main.js` (UI principal) y una `*ui.js` por pantalla.

## Convenciones
- Objetos, NPCs y hechizos propios usan números desde **2000** (los de AO Libre van por debajo).
- Código y comentarios en español rioplatense.
- No tocar `server/config.json`, `server/cuentas/`, `logs/` ni los JSON de estado (están en `.gitignore`).

## Correr y probar
- Servidor: `cd server && npm install && npm start` (Windows: `JUGAR-EN-MI-PC.bat`).
- Prueba rápida del servidor: `node tools/bot-test.js ws://localhost:7666 Probador`.
- Prueba visual (Playwright): `node tools/ui-test.js <carpeta-capturas>`.
- Después de cambiar lógica del servidor, correr un bot en vez de describir el resultado.
