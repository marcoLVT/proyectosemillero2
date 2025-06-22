const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');

// 👇 Usa tu puerto correcto (COMx)
const port = new SerialPort({ path: 'COM10', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

const wss = new WebSocket.Server({ port: 8080 });
console.log('✅ Servidor WebSocket activo en ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('🔌 Cliente conectado');

  parser.on('data', (data) => {
    console.log('📡 Dato del Arduino:', data);

    ws.send(data); // 1️⃣ Enviar dato en tiempo real al navegador

    const valor = parseInt(data); // 2️⃣ Convertir a número
    if (!isNaN(valor)) {
      // 3️⃣ Insertar en base de datos
      conexion.query(
        'INSERT INTO lecturas (valor) VALUES (?)',
        [valor],
        (err, results) => {
          if (err) {
            console.error('❌ Error al insertar en DB:', err);
          } else {
            console.log('💾 Valor guardado:', valor);
          }
        }
      );
    }
  });
});

const mysql = require('mysql2');

// Configura tu conexión a MySQL
const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sensores'
});


// Conecta a la base de datos
conexion.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar con MySQL:', err);
  } else {
    console.log('✅ Conectado a MySQL');
  }
});
