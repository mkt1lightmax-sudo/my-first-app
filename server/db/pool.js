const { Pool } = require("@neondatabase/serverless");

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set — copy .env.example to .env and fill it in");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { get pool() { return getPool(); }, query };
