const config = require('./config');
const migrate = require('./db/migrate');
const db = require('./db');
const bcrypt = require('bcrypt');
const Minio = require('minio');
const buildApp = require('./app');

async function start() {
  // 1. 数据库迁移
  await migrate();

  // 2. 创建初始用户（仅当 users 表为空时）
  const userCount = await db.query('SELECT COUNT(*) FROM users');
  if (parseInt(userCount.rows[0].count, 10) === 0) {
    const hash = await bcrypt.hash(config.initUser.password, 10);
    await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [config.initUser.username, hash]
    );
    console.log(`初始用户 "${config.initUser.username}" 已创建`);
  }

  // 3. MinIO bucket 初始化
  try {
    const minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    const bucketExists = await minioClient.bucketExists(config.minio.bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(config.minio.bucket);
      console.log(`MinIO bucket "${config.minio.bucket}" 已创建`);
    } else {
      console.log(`MinIO bucket "${config.minio.bucket}" 已存在`);
    }
  } catch (err) {
    console.warn('MinIO 初始化失败（服务可能未就绪），跳过：', err.message);
  }

  // 4. 启动 Fastify
  const app = buildApp({ logger: true });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`服务已启动，端口: ${config.port}`);
}

start().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
