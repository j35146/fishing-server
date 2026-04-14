const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { uploadFile } = require('./minio');

// 转码任务内存存储
const jobs = new Map();

const TRANSCODE_DIR = '/tmp/fishing-transcode';

// 确保临时目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 清理目录
function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 异步转码视频为 HLS 720p
async function transcodeToHLS(videoKey, buffer) {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(TRANSCODE_DIR, jobId);

  jobs.set(jobId, { status: 'pending', progress: 0, hls_key: null, error: null });

  // 异步执行，不阻塞上传返回
  setImmediate(async () => {
    try {
      ensureDir(jobDir);

      // 写入临时视频文件
      const ext = path.extname(videoKey) || '.mp4';
      const inputPath = path.join(jobDir, `input${ext}`);
      fs.writeFileSync(inputPath, buffer);

      const outputDir = path.join(jobDir, 'hls');
      ensureDir(outputDir);
      const outputPath = path.join(outputDir, 'index.m3u8');

      jobs.set(jobId, { status: 'processing', progress: 10, hls_key: null, error: null });

      // 运行 ffmpeg 转码
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', inputPath,
          '-vf', 'scale=-2:720',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-hls_time', '10',
          '-hls_list_size', '0',
          '-hls_segment_filename', path.join(outputDir, 'seg_%03d.ts'),
          outputPath,
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg 退出码: ${code}`));
        });

        ffmpeg.on('error', reject);
      });

      jobs.set(jobId, { status: 'processing', progress: 70, hls_key: null, error: null });

      // 上传 HLS 文件到 MinIO
      const hlsPrefix = `hls/${jobId}/720p`;
      const hlsFiles = fs.readdirSync(outputDir);

      for (const file of hlsFiles) {
        const filePath = path.join(outputDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
        await uploadFile(`${hlsPrefix}/${file}`, fileBuffer, contentType);
      }

      const hlsKey = `${hlsPrefix}/index.m3u8`;
      jobs.set(jobId, { status: 'done', progress: 100, hls_key: hlsKey, error: null });

    } catch (err) {
      jobs.set(jobId, { status: 'failed', progress: 0, hls_key: null, error: err.message });
    } finally {
      // 清理临时文件
      cleanDir(jobDir);
    }
  });

  return jobId;
}

module.exports = { jobs, transcodeToHLS };
