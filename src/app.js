const fastify = require('fastify');
const fastifyJwt = require('@fastify/jwt');
const fastifyFormbody = require('@fastify/formbody');
const fastifyMultipart = require('@fastify/multipart');
const jwtConfig = require('./utils/jwt');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const catchRoutes = require('./routes/catches');
const equipmentRoutes = require('./routes/equipment');
const mediaRoutes = require('./routes/media');
const spotRoutes = require('./routes/spots');
const statsRoutes = require('./routes/stats');

function buildApp(opts = {}) {
  const app = fastify(opts);

  // 注册插件
  app.register(fastifyFormbody);
  app.register(fastifyJwt, jwtConfig);
  app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } });

  // 健康检查（无需认证）
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // 注册路由
  app.register(authRoutes);
  app.register(tripRoutes);
  app.register(catchRoutes);
  app.register(equipmentRoutes);
  app.register(mediaRoutes);
  app.register(spotRoutes);
  app.register(statsRoutes);

  return app;
}

module.exports = buildApp;
