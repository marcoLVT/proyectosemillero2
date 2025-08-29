require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const { Client } = require('pg');

// ======================
// 📡 Servidor HTTP
// ======================
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error cargando index.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ======================
// 🔌 WebSocket
// ======================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('💻 Cliente conectado al WebSocket');
  ws.send(JSON.stringify({ msg: "Conectado al servidor 🚀" }));
});

// ======================
// 🗄️ PostgreSQL (Railway)
// ======================
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway requiere SSL
});

pgClient.connect()
  .then(async () => {
    console.log("✅ Conectado a PostgreSQL");

    try {
      const res = await pgClient.query("SELECT * FROM lecturas ORDER BY fecha DESC LIMIT 5");
      console.log("📊 Últimos registros en la tabla lecturas:");
      console.table(res.rows);
    } catch (err) {
      console.error("❌ Error al leer lecturas:", err);
    }
  })
  .catch(err => console.error("❌ Error al conectar con PostgreSQL:", err));

// ======================
// 📡 MQTT (HiveMQ Cloud)
// ======================
const mqttOptions = {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  port: process.env.MQTT_PORT,
  protocol: "mqtts" // Conexión segura
};

const mqttClient = mqtt.connect(`mqtts://${process.env.MQTT_HOST}`, mqttOptions);

mqttClient.on("connect", () => {
  console.log("✅ Conectado a MQTT");
  mqttClient.subscribe("esp8266/mpu6050");
});

mqttClient.on("message", async (topic, message) => {
  const data = message.toString();
  console.log(`📩 Mensaje MQTT: ${data}`);

  // Enviar a todos los clientes WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });

  // Guardar en PostgreSQL
  try {
    await pgClient.query("INSERT INTO lecturas (dato, fecha) VALUES ($1, NOW())", [data]);
    console.log("💾 Guardado en PostgreSQL");
  } catch (err) {
    console.error("❌ Error al guardar en PostgreSQL:", err);
  }
});

// ======================
// 🚀 Iniciar servidor
// ======================
server.listen(PORT, () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
});
