const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config");

// 内网客户端（用于上传、删除）
const s3Client = new S3Client({
  endpoint: `http://${config.minio.endPoint}:${config.minio.port}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

// 公网客户端（用于生成预签名 URL）
const s3PublicClient = config.minio.publicEndPoint
  ? new S3Client({
      endpoint: config.minio.publicEndPoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
      },
      forcePathStyle: true,
    })
  : s3Client;

const BUCKET = config.minio.bucket;

async function uploadFile(key, buffer, contentType) {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

async function deleteFile(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

async function getPresignedUrl(key, expiresIn = 86400) {
  const url = await getSignedUrl(s3PublicClient, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn });
  return url;
}

module.exports = { uploadFile, deleteFile, getPresignedUrl };
