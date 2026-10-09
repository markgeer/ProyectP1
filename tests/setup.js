// Se ejecuta ANTES de cada archivo de pruebas.
// Usa una base de datos temporal distinta para no tocar app.db (la real).
const os = require('os');
const path = require('path');

process.env.DB_PATH = path.join(
  os.tmpdir(),
  `webapp-test-${process.pid}-${Math.random().toString(36).slice(2)}.db`
);