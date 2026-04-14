// JWT 认证中间件，兼容 "Bearer <token>" 和直接传 "<token>" 两种格式
async function authenticate(request, reply) {
  try {
    // 如果客户端没加 Bearer 前缀，自动补上
    const auth = request.headers.authorization;
    if (auth && !auth.startsWith('Bearer ')) {
      request.headers.authorization = `Bearer ${auth}`;
    }
    await request.jwtVerify();
  } catch (err) {
    request.log.warn({
      authorization: request.headers.authorization || '(无)',
      token: request.headers.token || '(无)',
      'x-token': request.headers['x-token'] || '(无)',
      allHeaders: Object.keys(request.headers).join(', '),
      errMessage: err.message,
    }, '认证失败');
    reply.code(401).send({ success: false, error: '未授权' });
  }
}

module.exports = authenticate;
