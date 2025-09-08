import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import mqtt from "mqtt";
import express from "express";
import pkg from "pg";
import { Parser } from "json2csv";

dotenv.config();
const { Client } = pkg;

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);

// ======================
// 📄 Servir index.html
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

// ======================
// 🔌 WebSocket
// ======================
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  console.log("💻 Cliente conectado al WebSocket");
  ws.send(JSON.stringify({ msg: "Conectado al servidor 🚀" }));
});

// ======================
// 🗄️ PostgreSQL
// ======================
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await pgClient.connect();
console.log("✅ Conectado a PostgreSQL");

// ======================
// 📡 MQTT
// ======================
const mqttOptions = {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  port: process.env.MQTT_PORT,
  protocol: "mqtts",
};

const mqttClient = mqtt.connect(`mqtts://${process.env.MQTT_HOST}`, mqttOptions);

mqttClient.on("connect", () => {
  console.log("✅ Conectado a MQTT");
  mqttClient.subscribe("esp8266/mpu6050");
});

mqttClient.on("message", async (topic, message) => {
  const data = JSON.parse(message.toString()); // Convertimos el JSON a objeto
  console.log("📩 Mensaje MQTT:", data);

  // Broadcast por WebSocket
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });

  // Guardar en PostgreSQL con columnas separadas
  const { ax, ay, az, gx, gy, gz, temp } = data;

  try {
    await pgClient.query(
    `INSERT INTO particionado (ax, ay, az, gx, gy, gz, temp, fecha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())`,
   [ax, ay, az, gx, gy, gz, temp]
  );



    console.log("💾 Guardado en PostgreSQL con columnas separadas ✅");
  } catch (err) {
    console.error("❌ Error al guardar:", err);
  }
});




// ======================
// 📥 Exportar CSV
// ======================
app.get("/export", async (req, res) => {
  try {
    const result = await pgClient.query("SELECT * FROM particionado ORDER BY fecha DESC");
    if (result.rows.length === 0) {
      return res.status(404).send("No hay datos en la tabla particionado");
    }

    const parser = new Parser();
    const csv = parser.parse(result.rows);

    res.header("Content-Type", "text/csv");
    res.attachment("lecturas.csv");
    return res.send(csv);
  } catch (err) {
    console.error("❌ Error exportando CSV:", err);
    res.status(500).send("Error exportando CSV");
  }
});

// ======================
// 🚀 Iniciar servidor
// ======================
server.listen(PORT, () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
});
