require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,

  // PostgreSQL
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    user: process.env.POSTGRES_USER || 'fishing',
    password: process.env.POSTGRES_PASSWORD || 'fishing123',
    database: process.env.POSTGRES_DB || 'fishing',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  // 初始用户
  initUser: {
    username: process.env.INIT_USERNAME || 'admin',
    password: process.env.INIT_PASSWORD || 'change-me-123',
  },

  // MinIO
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'fishing-media',
    publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT || null,
    useSSL: false,
  },
};
