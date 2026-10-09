const Database = require('better-sqlite3');
const path = require('path');

// En pruebas se usa otra BD (variable DB_PATH) para no tocar la real
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');
const db = new Database(dbPath);

// Crear tabla si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;