// JWT 认证中间件
async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ success: false, error: '未授权' });
  }
}

module.exports = authenticate;
