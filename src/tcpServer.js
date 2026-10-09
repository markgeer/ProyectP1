const net = require('net');
const db = require('./db');

const TCP_PORT = Number(process.env.TCP_PORT) || 6061;
const TCP_HOST = '0.0.0.0';
const MAX_BUFFER = 64 * 1024; // protección: no acumular más de 64 KB sin un comando completo

// Misma estructura de respuesta que la API HTTP: { statusCode, data }
const reply = (statusCode, data = null, message = null) =>
  JSON.stringify({ statusCode, data, ...(message && { message }) }) + '\n';

// ---------------------------------------------------------------
// Extrae comandos completos de la forma {comando:elemento} del buffer.
// Cuenta las llaves { } (ignorando las que estén dentro de strings),
// así funciona aunque el cliente mande el comando con o sin salto de
// línea, o aunque lleguen varios comandos juntos / partidos en pedazos.
// ---------------------------------------------------------------
function extractCommands(buffer) {
  const commands = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  let consumed = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];

    if (depth === 0) {
      if (ch === '{') { start = i; depth = 1; inString = false; escaped = false; }
      else consumed = i + 1; // ignora espacios, \r, \n entre comandos
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        commands.push(buffer.slice(start, i + 1));
        consumed = i + 1;
      }
    }
  }

  return { commands, rest: buffer.slice(consumed) };
}

// ---------------------------------------------------------------
// Procesa un comando completo: {insert:<element>} o {get:<element>}
// ---------------------------------------------------------------
function processCommand(raw) {
  const inner = raw.slice(1, -1); // quita { }
  const sep = inner.indexOf(':');
  if (sep === -1) {
    return reply(400, null, 'Formato inválido. Usa {insert:<element>} o {get:<element>}');
  }

  const command = inner.slice(0, sep).trim().toLowerCase();
  const payload = inner.slice(sep + 1).trim();

  try {
    // ---- {insert:{"name":"Laptop","price":15000,"stock":5}} ----
    if (command === 'insert') {
      const item = JSON.parse(payload);
      if (!item || typeof item !== 'object' || !item.name || item.price == null) {
        return reply(400, null, 'name y price son obligatorios');
      }
      const info = db
        .prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)')
        .run(item.name, item.price, item.stock ?? 0);
      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      return reply(201, created, 'Elemento insertado');
    }

    // ---- {get:1}  |  {get:{"id":1}}  |  {get:all} ----
    if (command === 'get') {
      if (payload.toLowerCase() === 'all') {
        return reply(200, db.prepare('SELECT * FROM products').all());
      }

      let id;
      if (payload.startsWith('{')) id = Number(JSON.parse(payload).id);
      else id = Number(payload);

      if (!Number.isInteger(id)) {
        return reply(400, null, 'Indica un id válido: {get:1} o {get:{"id":1}}');
      }
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!row) return reply(404, null, 'No encontrado');
      return reply(200, row);
    }

    return reply(400, null, `Comando '${command}' no reconocido. Usa insert o get`);
  } catch (err) {
    return reply(400, null, 'Elemento inválido (revisa el JSON): ' + err.message);
  }
}

// ---------------------------------------------------------------
// Servidor TCP
// ---------------------------------------------------------------
const tcpServer = net.createServer((socket) => {
  console.log(`Cliente TCP conectado: ${socket.remoteAddress}:${socket.remotePort}`);
  let pending = '';

  socket.on('data', (chunk) => {
    pending += chunk.toString('utf8');
    const { commands, rest } = extractCommands(pending);
    pending = rest;

    if (pending.length > MAX_BUFFER) {
      socket.write(reply(400, null, 'Comando demasiado largo'));
      pending = '';
    }

    for (const cmd of commands) {
      console.log(`Comando recibido: ${cmd}`);
      socket.write(processCommand(cmd));
    }
  });

  socket.on('end', () => console.log('Cliente TCP desconectado'));
  socket.on('error', (err) => console.error('Error en socket TCP:', err.message));
});

function startTcpServer() {
  tcpServer.listen(TCP_PORT, TCP_HOST, () => {
    console.log(`Servidor TCP escuchando en ${TCP_HOST}:${TCP_PORT}`);
  });
  return tcpServer;
}

module.exports = { startTcpServer, tcpServer, processCommand, extractCommands };