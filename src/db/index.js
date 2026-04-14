const { Pool } = require('pg');
const config = require('../config');

// PostgreSQL 连接池
const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 10,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
