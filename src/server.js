const app = require('./app');
const { startTcpServer } = require('./tcpServer');

const PORT_HTTP = process.env.PORT || 3000;

// --- 1. SERVIDOR HTTP (EXPRESS) ---
app.listen(PORT_HTTP, '0.0.0.0', () => {
  console.log(`Servidor HTTP corriendo en http://0.0.0.0:${PORT_HTTP}`);
});

// --- 2. SERVIDOR TCP (SOCKET, puerto 6061) ---
// Vive en el mismo proceso y el mismo contenedor que la API HTTP.
startTcpServer();