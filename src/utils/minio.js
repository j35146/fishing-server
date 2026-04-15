const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

const internalEndpoint = `http://${config.minio.endPoint}:${config.minio.port}`;

// 内部客户端：用于上传/删除（Docker 内部通信）
const s3Client = new S3Client({
  endpoint: internalEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

// 外部客户端：用于生成预签名 URL（签名绑定外网可达地址）
// MINIO_PUBLIC_URL 示例: http://192.168.1.100:9000
const publicEndpoint = process.env.MINIO_PUBLIC_URL || internalEndpoint;
const s3PublicClient = new S3Client({
  endpoint: publicEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.minio.bucket;

// 上传文件到 MinIO（内部客户端）
async function uploadFile(key, buffer, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

// 从 MinIO 删除文件（内部客户端）
async function deleteFile(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

// 生成预签名 URL（外部客户端，签名绑定外网地址，24h 有效）
async function getPresignedUrl(key, expiresIn = 86400) {
  const url = await getSignedUrl(s3PublicClient, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn });
  return url;
}

module.exports = { uploadFile, deleteFile, getPresignedUrl };
