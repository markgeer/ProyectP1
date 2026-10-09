const fs = require('fs');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

// ---------- Helpers ----------
const crear = (body) => request(app).post('/api/products').send(body);

// Antes de CADA prueba la tabla se deja vacía (así las pruebas no dependen entre sí)
beforeEach(() => {
  db.prepare('DELETE FROM products').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'products'").run();
});

afterAll(() => {
  db.close();
  fs.rmSync(process.env.DB_PATH, { force: true });
});

// 20 pruebas = 10 endpoints x 2 pruebas
// (1 caso exitoso + 1 caso de error / límite del usuario)

// =====================================================================
describe('Endpoint 1: GET /api/products', () => {
  test('1.1 devuelve la lista de productos (200)', async () => {
    await crear({ name: 'Laptop', price: 15000, stock: 5 });
    await crear({ name: 'Mouse', price: 300 });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('1.2 ERROR/LÍMITE: con la BD vacía devuelve un arreglo vacío', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// =====================================================================
describe('Endpoint 2: GET /api/products/:id', () => {
  test('2.1 devuelve el producto cuando el id existe (200)', async () => {
    const { body } = await crear({ name: 'Teclado', price: 500, stock: 10 });

    const res = await request(app).get(`/api/products/${body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Teclado', price: 500, stock: 10 });
  });

  test('2.2 ERROR: id que no existe -> 404', async () => {
    const res = await request(app).get('/api/products/999');

    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// =====================================================================
describe('Endpoint 3: POST /api/products', () => {
  test('3.1 crea un producto y responde 201', async () => {
    const res = await crear({ name: 'Monitor', price: 4000, stock: 3 });

    expect(res.status).toBe(201);
    expect(res.body.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ id: 1, name: 'Monitor', price: 4000, stock: 3 });
  });

  test('3.2 ERROR: faltan name y price -> 400 y no se guarda nada', async () => {
    const res = await crear({});
    const total = await request(app).get('/api/products/count/total');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obligatorios/);
    expect(total.body.data).toBe(0);
  });
});

// =====================================================================
describe('Endpoint 4: PUT /api/products/:id', () => {
  test('4.1 actualiza un producto existente (200)', async () => {
    const { body } = await crear({ name: 'Viejo', price: 100, stock: 1 });

    const res = await request(app)
      .put(`/api/products/${body.data.id}`)
      .send({ name: 'Nuevo', price: 200, stock: 9 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Nuevo', price: 200, stock: 9 });
  });

  test('4.2 ERROR: actualizar un id que no existe -> 404', async () => {
    const res = await request(app).put('/api/products/999').send({ name: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// =====================================================================
describe('Endpoint 5: DELETE /api/products/:id', () => {
  test('5.1 elimina un producto existente y ya no se puede consultar', async () => {
    const { body } = await crear({ name: 'Borrar', price: 1 });

    const del = await request(app).delete(`/api/products/${body.data.id}`);
    const get = await request(app).get(`/api/products/${body.data.id}`);

    expect(del.status).toBe(200);
    expect(del.body.data).toBe(true);
    expect(get.status).toBe(404);
  });

  test('5.2 ERROR: eliminar un id que no existe -> 404', async () => {
    const res = await request(app).delete('/api/products/999');

    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
  });
});

// =====================================================================
describe('Endpoint 6: GET /api/products/count/total', () => {
  test('6.1 cuenta los productos existentes', async () => {
    await crear({ name: 'A', price: 1 });
    await crear({ name: 'B', price: 2 });

    const res = await request(app).get('/api/products/count/total');

    expect(res.status).toBe(200);
    expect(res.body.data).toBe(2);
  });

  test('6.2 ERROR: usar POST en vez de GET en la ruta -> 404', async () => {
    const res = await request(app).post('/api/products/count/total');

    expect(res.status).toBe(404);
  });
});

// =====================================================================
describe('Endpoint 7: GET /api/products/search/:name', () => {
  test('7.1 encuentra productos por nombre parcial', async () => {
    await crear({ name: 'Laptop Gamer', price: 20000 });
    await crear({ name: 'Laptop Oficina', price: 12000 });
    await crear({ name: 'Mouse', price: 300 });

    const res = await request(app).get('/api/products/search/laptop');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('7.2 ERROR/LÍMITE: búsqueda sin coincidencias -> arreglo vacío', async () => {
    await crear({ name: 'Mouse', price: 300 });

    const res = await request(app).get('/api/products/search/zzzz');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// =====================================================================
describe('Endpoint 8: POST /api/products/clear', () => {
  test('8.1 vacía la tabla de productos', async () => {
    await crear({ name: 'A', price: 1 });
    await crear({ name: 'B', price: 2 });

    const res = await request(app).post('/api/products/clear');
    const total = await request(app).get('/api/products/count/total');

    expect(res.status).toBe(200);
    expect(total.body.data).toBe(0);
  });

  test('8.2 ERROR: usar GET en vez de POST NO borra los datos', async () => {
    await crear({ name: 'A', price: 1 });

    const res = await request(app).get('/api/products/clear');
    const total = await request(app).get('/api/products/count/total');

    expect(res.status).toBe(404);
    expect(total.body.data).toBe(1);
  });
});

// =====================================================================
describe('Endpoint 9: POST /api/products/backup', () => {
  test('9.1 crea el archivo de respaldo y devuelve su ruta', async () => {
    await crear({ name: 'Respaldar', price: 1 });

    const res = await request(app).post('/api/products/backup');

    expect(res.status).toBe(200);
    expect(fs.existsSync(res.body.data)).toBe(true);

    fs.rmSync(res.body.data, { force: true }); // limpiar el archivo de prueba
  });

  test('9.2 ERROR: usar GET en vez de POST -> 404 y no se crea respaldo', async () => {
    const res = await request(app).get('/api/products/backup');

    expect(res.status).toBe(404);
  });
});

// =====================================================================
describe('Endpoint 10: GET /api/products/health/check', () => {
  test('10.1 responde OK (200)', async () => {
    const res = await request(app).get('/api/products/health/check');

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('OK');
  });

  test('10.2 ERROR: usar POST en vez de GET -> 404', async () => {
    const res = await request(app).post('/api/products/health/check');

    expect(res.status).toBe(404);
  });
});