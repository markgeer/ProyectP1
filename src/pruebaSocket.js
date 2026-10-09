const net = require('net');

// 👉 Cambia esta IP por la IP pública de tu EC2 (o usa 'localhost' para probar en tu PC)
const HOST = process.argv[2] || 'localhost';
const PORT = 6061;

const client = new net.Socket();
let paso = 'insert';

client.connect(PORT, HOST, () => {
  console.log(`--- CONECTADO AL SERVIDOR TCP (${HOST}:${PORT}) ---`);

  // 1. Probar inserción: el elemento es el mismo body de la práctica 1
  const producto = { name: 'laptop2', price: 15000, stock: 5 };
  const mensajeInsert = `{insert:${JSON.stringify(producto)}}`;

  console.log('Enviando comando:', mensajeInsert);
  client.write(mensajeInsert);
});

client.on('data', (data) => {
  console.log('Respuesta recibida:', data.toString());

  if (paso === 'insert') {
    paso = 'get';
    // 2. Probar consulta del elemento 1
    const mensajeGet = '{get:1}';
    console.log('Enviando comando:', mensajeGet);
    client.write(mensajeGet);
  } else {
    client.destroy(); // Finalizar prueba
  }
});

client.on('close', () => console.log('--- PRUEBA TCP FINALIZADA ---'));
client.on('error', (err) => console.error('Error TCP:', err.message));