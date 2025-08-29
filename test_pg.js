require('dotenv').config();
const { Client } = require('pg');

console.log("DATABASE_URL:", process.env.DATABASE_URL); // Para verificar que se está leyendo

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario para Railway
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Conectado a PostgreSQL en Railway correctamente!");
    const res = await client.query("SELECT NOW()");
    console.log("⏱ Hora del servidor:", res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error("❌ Error conectando a PostgreSQL:", err);
  }
}

testConnection();
