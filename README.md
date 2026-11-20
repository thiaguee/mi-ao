# Fénix AO

Servidor y cliente de un **Argentum Online estilo Fénix**, reescritos desde cero en
JavaScript (Node.js en el servidor y HTML5 en el cliente), con instalador para Windows.

- **Reglas de juego**: árbol de clases evolutivo, tabla de experiencia, vida, golpe y maná por nivel,
  tomados del código liberado de [Fénix AO](https://sourceforge.net/projects/fenixao) (GPL).
- **Mundo y recursos**: mapas, gráficos, NPCs, objetos, hechizos, música y sonidos de
  [Argentum Online Libre](https://github.com/ao-libre) (AGPL).

👉 **Leé [GUIA.md](GUIA.md)** para poner el servidor en internet y conocer los comandos de GM.

## Estructura

```
server/     Servidor (Node.js + WebSocket). Arranca con: cd server && npm install && npm start
client/     Cliente HTML5 (lo sirve el mismo servidor en http://IP:7666)
launcher/   Empaquetado para Windows (Electron + NSIS): ./crear-instalador.sh ws://IP:7666
tools/      Script de conversión de recursos y pruebas automáticas
```

## Qué incluye

- Cuentas con contraseña cifrada, creación de personaje (5 razas, 2 géneros, cabezas, dados).
- 317 mapas, más de 3.000 NPCs, 1.237 objetos y 50 hechizos.
- Movimiento, cambio de mapas, puertas, carteles, techos que se ocultan.
- Combate cuerpo a cuerpo y con arco, hechizos (daño, curación, parálisis, veneno,
  invisibilidad, revivir, invocar), meditación, hambre y sed.
- Experiencia, niveles, skills que suben con el uso y evolución de clases al estilo Fénix.
- Ciudadanos y criminales, guardias, zonas seguras, muerte y resurrección.
- Comerciantes, banco (objetos y oro) y sacerdotes.
- Chat normal, susurros, chat global y pedidos de ayuda a GMs.
- Más de 50 comandos de GM en 4 rangos. Registros de chat y de acciones de GMs.
- Guardado automático y antiflood.

## Licencia

AGPL-3.0, igual que los proyectos en los que se basa.
