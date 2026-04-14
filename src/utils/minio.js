const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

// 构建 S3 客户端（兼容 MinIO）
const s3Client = new S3Client({
  endpoint: `http://${config.minio.endPoint}:${config.minio.port}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.minio.bucket;

// 上传文件到 MinIO
async function uploadFile(key, buffer, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

// 从 MinIO 删除文件
async function deleteFile(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

// 生成预签名 URL（默认 24h）
async function getPresignedUrl(key, expiresIn = 86400) {
  const url = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn });
  return url;
}

module.exports = { uploadFile, deleteFile, getPresignedUrl };
