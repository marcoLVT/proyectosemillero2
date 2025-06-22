const IS_RENDER = process.env.RENDER === 'true';

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const { Client } = require('pg');

// Configura tu conexión PostgreSQL con los datos de Railway
const conexion = new Client({
  connectionString: 'postgresql://postgres:YDaitqxFxRtmUKspxZKhsDIAXTxTmdhJ@mainline.proxy.rlwy.net:27517/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

conexion.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL');
  }
});

// Configura el parser solo si no estás en Render
let parser = null;

if (!IS_RENDER) {
  try {
    const port = new SerialPort({ path: 'COM10', baudRate: 9600 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  } catch (error) {
    console.warn('⚠️ SerialPort deshabilitado (Render):', error.message);
  }
}

const wss = new WebSocket.Server({ port: 8080 });
console.log('✅ Servidor WebSocket activo en ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('🔌 Cliente conectado');

  if (parser) {
    parser.on('data', (data) => {
      console.log('📡 Dato del Arduino:', data);

      ws.send(data); // Enviar al navegador

      const valor = parseInt(data);
      if (!isNaN(valor)) {
        // Insertar en PostgreSQL
        conexion.query(
          'INSERT INTO lecturas (valor) VALUES ($1)',
          [valor],
          (err, res) => {
            if (err) {
              console.error('❌ Error al insertar en PostgreSQL:', err.stack);
            } else {
              console.log('💾 Valor guardado:', valor);
            }
          }
        );
      }
    });
  }
});
