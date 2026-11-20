'use strict';
// Lector de archivos .dat/.ini del AO (secciones [X], claves Clave=Valor, comentarios con ').
const fs = require('fs');

function parseIni(text) {
  const out = {};
  let sec = null;
  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line[0] === "'" || line[0] === '#' || line[0] === ';') continue;
    if (line[0] === '[') {
      const end = line.indexOf(']');
      sec = (end > 0 ? line.slice(1, end) : line.slice(1)).toUpperCase();
      if (!out[sec]) out[sec] = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0 || !sec) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    let val = line.slice(eq + 1);
    const q = val.indexOf("'");
    if (q >= 0) val = val.slice(0, q);
    out[sec][key] = val.trim();
  }
  return out;
}

function readIni(path) {
  return parseIni(fs.readFileSync(path, 'utf8'));
}

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

module.exports = { parseIni, readIni, num };
