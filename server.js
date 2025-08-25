const WebSocket = require('ws');
const { Client } = require('pg');
const mqtt = require('mqtt');

// 🔹 Configura tu conexión PostgreSQL
const conexion = new Client({
  connectionString: 'postgresql://postgres:YDaitqxFxRtmUKspxZKhsDIAXTxTmdhJ@mainline.proxy.rlwy.net:27517/railway',
  ssl: { rejectUnauthorized: false }
});

conexion.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL');
  }
});

// 🔹 Servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });
console.log('✅ Servidor WebSocket activo en ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('🔌 Cliente WebSocket conectado');
});

// 🔹 Conexión MQTT
const mqttOptions = {
  username: 'esp8266',
  password: 'Giorpa469',
  port: 8883,
  protocol: 'mqtts'
};

const mqttClient = mqtt.connect('mqtts://45abc320943e4d708930117ef02e02c5.s1.eu.hivemq.cloud', mqttOptions);

mqttClient.on('connect', () => {
  console.log('✅ Conectado a MQTT HiveMQ');
  mqttClient.subscribe('esp32/datos', (err) => {
    if (err) console.error('❌ Error al suscribirse al topic:', err);
  });
});

mqttClient.on('message', (topic, message) => {
  // 🔹 Convertir a string
  const dataStr = message.toString();
  console.log('📡 Datos recibidos:', dataStr);

  // 🔹 Parsear CSV: AX:val,AY:val,...
  const valores = {};
  dataStr.split(',').forEach(pair => {
    const [key, val] = pair.split(':');
    valores[key] = parseInt(val);
  });

  // 🔹 Enviar a todos los clientes WebSocket
  const jsonData = JSON.stringify(valores);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });

  // 🔹 Guardar en PostgreSQL
  const { AX, AY, AZ, GX, GY, GZ } = valores;
  conexion.query(
    'INSERT INTO lecturas_mpu6050 (ax, ay, az, gx, gy, gz) VALUES ($1,$2,$3,$4,$5,$6)',
    [AX, AY, AZ, GX, GY, GZ],
    (err) => {
      if (err) console.error('❌ Error al insertar en PostgreSQL:', err.stack);
      else console.log('💾 Valores guardados en DB');
    }
  );
});
