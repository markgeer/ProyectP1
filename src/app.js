const express = require('express');
const cors = require('cors');
const productsRouter = require('./routes/products');

// Aquí solo se CONFIGURA la app (sin escuchar en ningún puerto).
// Así Jest/Supertest pueden probarla sin levantar el servidor.
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/products', productsRouter);

app.get('/', (req, res) => {
  res.json({ statusCode: 200, data: 'WebApp API 2' });
});

// Ruta que no existe -> 404 con el mismo formato JSON
app.use((req, res) => {
  res.status(404).json({ statusCode: 404, data: null, message: 'Ruta no encontrada' });
});

// Errores (por ejemplo, un JSON mal escrito en el body) -> JSON en vez de HTML
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ statusCode: 400, data: null, message: 'JSON inválido en el body' });
  }
  console.error(err);
  res.status(500).json({ statusCode: 500, data: null, message: 'Error interno del servidor' });
});

module.exports = app;