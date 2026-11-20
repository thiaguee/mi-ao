// Pone (o cambia) la contraseña de un personaje reservado de los dueños: tsk, heaveN o peladoh.
// Se corre EN LA MÁQUINA DEL SERVIDOR, así la contraseña nunca pasa por GitHub ni por internet:
//
//     node tools/clave-admin.js heaveN
//
// - Si el personaje todavía no existe, la contraseña queda reservada: después entrás al juego,
//   creás el personaje con ese nombre y esa contraseña, y nadie más puede crearlo.
// - Si el personaje ya existe, se le cambia la contraseña (sirve si alguien la olvidó o se la robaron).
//
// Si el servidor guarda los datos en otra carpeta, indicala con AO_DATA_DIR, igual que al servidor.
'use strict';
const path = require('path');
const accounts = require(path.join(__dirname, '..', 'server', 'src', 'accounts'));

// Sin consola interactiva (contraseña pasada por una tubería): se leen las líneas de a una
let lineas = null;
function leerLineas() {
  if (!lineas) {
    lineas = new Promise((resolve) => {
      let buf = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (d) => { buf += d; });
      process.stdin.on('end', () => resolve(buf.split(/\r?\n/)));
    });
  }
  return lineas;
}

function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(texto);
    if (!stdin.isTTY) {
      leerLineas().then((l) => { process.stdout.write('\n'); resolve(l.length ? l.shift() : ''); });
      return;
    }
    let pass = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(pass);
        }
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(1); } // Ctrl+C
        if (c === '\u007f' || c === '\b') pass = pass.slice(0, -1);
        else pass += c;
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  const pedido = process.argv[2];
  const nombre = accounts.RESERVADOS.find((n) => n.toLowerCase() === String(pedido || '').toLowerCase());
  if (!nombre) {
    console.log(`Uso: node tools/clave-admin.js NOMBRE   (nombres reservados: ${accounts.RESERVADOS.join(', ')})`);
    process.exit(1);
  }
  const pass = await preguntarOculto(`Contraseña nueva para ${nombre} (no se ve al escribir): `);
  if (pass.length < 8) { console.log('Usá al menos 8 caracteres. No se cambió nada.'); process.exit(1); }
  const otra = await preguntarOculto('Repetila: ');
  if (pass !== otra) { console.log('Las contraseñas no coinciden. No se cambió nada.'); process.exit(1); }

  const rec = accounts.load(nombre);
  if (rec) {
    rec.pass = accounts.hashPass(pass);
    accounts.save(rec);
    console.log(`Listo: se cambió la contraseña de ${rec.name}.`);
    console.log('Si está conectado, la contraseña nueva vale desde la próxima vez que entre.');
  } else {
    const r = accounts.leerReservas();
    r[nombre.toLowerCase()] = accounts.hashPass(pass);
    accounts.guardarReservas(r);
    console.log(`Listo: ${nombre} quedó reservado. Entrá al juego y creá el personaje "${nombre}" con esa contraseña.`);
  }
})();
