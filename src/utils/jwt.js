const config = require('../config');

// JWT 工具：签发和验证通过 @fastify/jwt 插件实现
// 这里导出配置供 app.js 注册使用
module.exports = {
  secret: config.jwt.secret,
  sign: {
    expiresIn: config.jwt.expiresIn,
  },
};
