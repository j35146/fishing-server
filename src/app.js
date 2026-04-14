const fastify = require('fastify');
const fastifyJwt = require('@fastify/jwt');
const fastifyFormbody = require('@fastify/formbody');
const jwtConfig = require('./utils/jwt');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const catchRoutes = require('./routes/catches');
const equipmentRoutes = require('./routes/equipment');

function buildApp(opts = {}) {
  const app = fastify(opts);

  // 注册插件
  app.register(fastifyFormbody);
  app.register(fastifyJwt, jwtConfig);

  // 健康检查（无需认证）
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // 注册路由
  app.register(authRoutes);
  app.register(tripRoutes);
  app.register(catchRoutes);
  app.register(equipmentRoutes);

  return app;
}

module.exports = buildApp;
