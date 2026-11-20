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
