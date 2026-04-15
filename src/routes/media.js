const crypto = require('crypto');
const path = require('path');
const authenticate = require('../middleware/auth');
const { uploadFile, deleteFile, getPresignedUrl } = require('../utils/minio');
const { jobs, transcodeToHLS } = require('../utils/transcode');

// 允许的图片类型及扩展名
const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
};

// 允许的视频类型及扩展名
const VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;    // 20MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;   // 500MB

async function mediaRoutes(fastify) {
  // 所有媒体路由需要认证
  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/media/upload — 上传媒体文件
  fastify.post('/api/v1/media/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: '未上传文件' });
    }

    const mimetype = data.mimetype;
    const isImage = IMAGE_TYPES[mimetype];
    const isVideo = VIDEO_TYPES[mimetype];

    if (!isImage && !isVideo) {
      return reply.code(400).send({
        success: false,
        error: '不支持的文件类型，仅支持 JPEG/PNG/HEIC 图片和 MP4/MOV 视频',
      });
    }

    // 读取文件内容
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 检查文件大小
    if (isImage && buffer.length > MAX_IMAGE_SIZE) {
      return reply.code(400).send({ success: false, error: '图片大小不能超过 20MB' });
    }
    if (isVideo && buffer.length > MAX_VIDEO_SIZE) {
      return reply.code(400).send({ success: false, error: '视频大小不能超过 500MB' });
    }

    // 生成存储 key
    const uuid = crypto.randomUUID();
    const ext = isImage || isVideo;
    const dir = isImage ? 'images' : 'videos';
    const key = `${dir}/${uuid}${ext}`;

    // 上传到 MinIO
    await uploadFile(key, buffer, mimetype);

    // 视频异步转码
    let jobId = null;
    if (isVideo) {
      jobId = await transcodeToHLS(key, buffer);
    }

    // 生成预签名 URL
    const url = await getPresignedUrl(key);

    const responseData = { key, url, type: isImage ? 'image' : 'video', size: buffer.length };
    if (jobId) {
      responseData.jobId = jobId;
    }

    reply.code(201);
    return { success: true, data: responseData };
  });

  // GET /api/v1/media/transcode/:jobId — 查询转码状态
  fastify.get('/api/v1/media/transcode/:jobId', async (request, reply) => {
    const { jobId } = request.params;
    const job = jobs.get(jobId);

    if (!job) {
      return reply.code(404).send({ success: false, error: '转码任务不存在' });
    }

    return { success: true, data: { jobId, ...job } };
  });

  // GET /api/v1/media/presign/:key — 获取预签名 URL
  fastify.get('/api/v1/media/presign/*', async (request) => {
    const key = request.params['*'];
    const url = await getPresignedUrl(key);
    return { success: true, data: { url } };
  });

  // GET /api/v1/media/file/:key — 直接返回文件流（通过 API 代理，无需预签名）
  fastify.get('/api/v1/media/file/*', async (request, reply) => {
    const key = request.params['*'];
    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const config = require('../config');
      const { S3Client } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        endpoint: `http://${config.minio.endPoint}:${config.minio.port}`,
        region: 'us-east-1',
        credentials: { accessKeyId: config.minio.accessKey, secretAccessKey: config.minio.secretKey },
        forcePathStyle: true,
      });
      const resp = await s3.send(new GetObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
      }));
      reply.header('Content-Type', resp.ContentType || 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(resp.Body);
    } catch (e) {
      return reply.code(404).send({ success: false, error: '文件不存在' });
    }
  });

  // DELETE /api/v1/media/:key — 删除媒体文件
  fastify.delete('/api/v1/media/*', async (request) => {
    const key = request.params['*'];
    await deleteFile(key);
    return { success: true };
  });
}

module.exports = mediaRoutes;
