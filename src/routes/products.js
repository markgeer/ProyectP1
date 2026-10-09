const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const router = express.Router();

// Helper para respuesta estándar
const response = (statusCode, data = null, message = null) => ({
  statusCode,
  data,
  ...(message && { message })
});

// Validaciones de datos (errores típicos del usuario)
const isValidName = (v) => typeof v === 'string' && v.trim() !== '';
const isValidPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isValidStock = (v) => Number.isInteger(v) && v >= 0;

// 1. GET todos
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products').all();
  res.status(200).json(response(200, rows));
});

// 2. GET por id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json(response(404, null, 'No encontrado'));
  res.status(200).json(response(200, row));
});

// 3. POST crear
router.post('/', (req, res) => {
  const { name, price, stock } = req.body ?? {}; // req.body puede venir vacío
  if (!name || price == null) {
    return res.status(400).json(response(400, null, 'name y price son obligatorios'));
  }
  if (!isValidName(name)) return res.status(400).json(response(400, null, 'name debe ser texto no vacío'));
  if (!isValidPrice(price)) return res.status(400).json(response(400, null, 'price debe ser un número mayor o igual a 0'));
  if (stock != null && !isValidStock(stock)) {
    return res.status(400).json(response(400, null, 'stock debe ser un entero mayor o igual a 0'));
  }
  const info = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)')
    .run(name, price, stock ?? 0);
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(response(201, created));
});

// 4. PUT actualizar
router.put('/:id', (req, res) => {
  const { name, price, stock } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json(response(404, null, 'No encontrado'));

  if (name != null && !isValidName(name)) return res.status(400).json(response(400, null, 'name debe ser texto no vacío'));
  if (price != null && !isValidPrice(price)) return res.status(400).json(response(400, null, 'price debe ser un número mayor o igual a 0'));
  if (stock != null && !isValidStock(stock)) {
    return res.status(400).json(response(400, null, 'stock debe ser un entero mayor o igual a 0'));
  }

  db.prepare('UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?')
    .run(name ?? existing.name, price ?? existing.price, stock ?? existing.stock, req.params.id);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.status(200).json(response(200, updated));
});

// 5. DELETE por id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json(response(404, null, 'No encontrado'));
  res.status(200).json(response(200, true, 'Eliminado'));
});

// 6. GET contar
router.get('/count/total', (req, res) => {
  const { total } = db.prepare('SELECT COUNT(*) as total FROM products').get();
  res.status(200).json(response(200, total));
});

// 7. GET buscar por nombre
router.get('/search/:name', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE name LIKE ?').all(`%${req.params.name}%`);
  res.status(200).json(response(200, rows));
});

// 8. POST vaciar BD
router.post('/clear', (req, res) => {
  db.prepare('DELETE FROM products').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'products'").run();
  res.status(200).json(response(200, true, 'BD vaciada'));
});

// 9. POST backup BD
router.post('/backup', (req, res) => {
  const source = path.join(__dirname, '..', '..', 'app.db');
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `backup_${timestamp}.db`);

  try {
    // Usa la API de backup de better-sqlite3 (segura en caliente)
    db.backup(dest)
      .then(() => res.status(200).json(response(200, dest, 'Backup creado')))
      .catch(err => res.status(500).json(response(500, null, err.message)));
  } catch (err) {
    res.status(500).json(response(500, null, err.message));
  }
});

// 10. GET health
router.get('/health/check', (req, res) => {
  res.status(200).json(response(200, 'OK'));
});

module.exports = router;