'use strict';
// Guardado de personajes en archivos JSON (uno por personaje), con contraseña cifrada (scrypt).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Los personajes se guardan en AO_DATA_DIR (la aplicación de Windows usa una carpeta propia
// del usuario, así las actualizaciones no los borran) o, si no, al lado del servidor.
const DIR = path.join(process.env.AO_DATA_DIR || path.join(__dirname, '..'), 'cuentas');
fs.mkdirSync(DIR, { recursive: true });

const fileOf = (name) => path.join(DIR, name.toLowerCase().replace(/[^a-z0-9 ]/g, '_') + '.json');

function validName(name) {
  return typeof name === 'string' && /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,20}$/.test(name) && !/  /.test(name) &&
    name.trim() === name;
}

function exists(name) {
  return fs.existsSync(fileOf(name));
}

function hashPass(pass, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pass), salt, 32).toString('hex');
  return { salt, hash };
}

function checkPass(rec, pass) {
  if (!rec || !rec.pass) return false;
  const { hash } = hashPass(pass, rec.pass.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(rec.pass.hash, 'hex'));
}

function load(name) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(name), 'utf8'));
  } catch (e) {
    return null;
  }
}

function save(rec) {
  const f = fileOf(rec.name);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec));
  fs.renameSync(tmp, f);
}

function list() {
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
}

module.exports = { validName, exists, hashPass, checkPass, load, save, list, DIR };

// ---------- nombres reservados ----------
// Personajes de los dueños del servidor. Nadie puede crearlos desde el juego salvo que antes,
// en la máquina del servidor, se les haya puesto contraseña con "node tools/clave-admin.js NOMBRE".
// Esa contraseña se guarda cifrada en reservas.json (que no se sube a GitHub).
const RESERVADOS = ['tsk', 'heaveN', 'peladoh'];
const RESERVAS_PATH = path.join(process.env.AO_DATA_DIR || path.join(__dirname, '..'), 'reservas.json');

const esReservado = (name) => RESERVADOS.some((n) => n.toLowerCase() === String(name).toLowerCase());

function leerReservas() {
  try { return JSON.parse(fs.readFileSync(RESERVAS_PATH, 'utf8')); } catch (e) { return {}; }
}

function guardarReservas(r) {
  fs.writeFileSync(RESERVAS_PATH, JSON.stringify(r, null, 2));
}

// ¿La contraseña coincide con la que se reservó para ese nombre?
function reservaValida(name, pass) {
  const r = leerReservas()[String(name).toLowerCase()];
  return !!r && checkPass({ pass: r }, pass);
}

function borrarReserva(name) {
  const r = leerReservas();
  delete r[String(name).toLowerCase()];
  guardarReservas(r);
}

Object.assign(module.exports, { RESERVADOS, RESERVAS_PATH, esReservado, leerReservas, guardarReservas, reservaValida, borrarReserva });
