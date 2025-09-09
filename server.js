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
    console.log("✅ Conectado a MQTT en Node.js");

    mqttClient.subscribe("esp8266/mpu6050", (err) => {
        if (err) console.error("❌ Error suscribiendo:", err);
        else console.log("✅ Suscrito al topic esp8266/mpu6050");
    });
});


mqttClient.on("message", async (topic, message) => {
    const data = JSON.parse(message.toString());
    console.log("📩 Mensaje MQTT:", data);

    // WebSocket broadcast
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify(data));
    });

    const { ax, ay, az, gx, gy, gz, temp, fecha } = data;

    // Separar fecha y hora
    let fechaOnly = fecha;
    let horaOnly = '';
    if (fecha.includes(' ')) {
        [fechaOnly, horaOnly] = fecha.split(' ');
    }

    try {
        await pgClient.query(
            `INSERT INTO partir (ax, ay, az, gx, gy, gz, temp, fecha, hora)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [ax, ay, az, gx, gy, gz, temp, fechaOnly, horaOnly]
        );

        console.log("💾 Guardado en PostgreSQL con fecha y hora del sensor ✅");
    } catch (err) {
        console.error("❌ Error al guardar:", err);
    }
});

mqttClient.on("error", (err) => {
    console.error("❌ Error MQTT:", err);
});
