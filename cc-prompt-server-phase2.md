# Claude Code · 钓鱼志后端 Phase 2 提示词

## 角色与目标

你是一名 Node.js 后端工程师，正在开发「钓鱼志」App 的后端服务（Phase 2）。  
Phase 1（R01–R44）已完成并通过验证。本次任务完成 **R45–R75**，共 31 项。

## 首要指令

1. **先读** `CLAUDE.md` 和 `REQUIREMENTS.md` 全文，了解当前代码结构和已完成内容
2. **按模块顺序**执行：模块八 → 模块九 → 模块十 → 模块十一 → 模块十二
3. **每完成一项**，立即将 `REQUIREMENTS.md` 中对应项从 `[ ]` 改为 `[x]` 并更新进度数字
4. **每完成一个模块**，运行 `bash scripts/verify.sh` 验证，失败则修复后再继续
5. **全部完成后**运行完整 verify.sh，确保 Phase 2 全部通过

---

## 模块八：媒体上传（R45–R55）

### 安装依赖

```bash
npm install @fastify/multipart @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 新文件

**`src/utils/minio.js`**  
封装 MinIO S3 客户端操作（使用 `@aws-sdk/client-s3`）：
- `uploadFile(key, buffer, contentType)` → 上传到 MinIO
- `deleteFile(key)` → 删除文件
- `getPresignedUrl(key, expiresIn=86400)` → 生成预签名 URL（默认 24h）
- 客户端配置从 `config.js` 读取（MINIO_ENDPOINT、MINIO_ACCESS_KEY、MINIO_SECRET_KEY、MINIO_BUCKET）

**`src/routes/media.js`**  
- `POST /api/v1/media/upload`
  - 使用 `@fastify/multipart` 解析 multipart/form-data
  - 图片（image/jpeg、image/png、image/heic）≤ 20MB，存入 `images/{uuid}.{ext}`
  - 视频（video/mp4、video/quicktime）≤ 500MB，存入 `videos/{uuid}.{ext}`
  - 视频上传完成后，调用 `transcodeToHLS(key, buffer)` 异步处理（不等待）
  - 返回 `{ success: true, data: { key, url, type, size } }`
- `GET /api/v1/media/presign/:key` → 返回 `{ url }`（24h 有效）
- `DELETE /api/v1/media/:key` → 从 MinIO 删除，返回 `{ success: true }`

### 数据库迁移

在 `src/db/migrate.js` 末尾追加（如果列不存在才添加）：
```sql
ALTER TABLE fishing_trips ADD COLUMN IF NOT EXISTS media_keys JSONB DEFAULT '[]';
ALTER TABLE fish_catches ADD COLUMN IF NOT EXISTS media_keys JSONB DEFAULT '[]';
ALTER TABLE equipment_library ADD COLUMN IF NOT EXISTS photo_key VARCHAR(500);
```

### 修改 trips 路由

`GET /api/v1/trips/:id` 返回前，将 `media_keys` 中每个 key 转为预签名 URL，追加 `media_urls` 字段。

---

## 模块九：视频转码 HLS（R56–R61）

### 新文件

**`src/utils/transcode.js`**  
```js
// 转码任务内存存储
const jobs = new Map(); // jobId → { status, progress, hls_key, error }

async function transcodeToHLS(videoKey, buffer) {
  // 1. 生成 jobId
  // 2. 写临时文件到 /tmp/
  // 3. 用 child_process.spawn 运行 ffmpeg 转为 HLS 720p
  //    ffmpeg -i input.mp4 -vf scale=-2:720 -c:v libx264 -c:a aac 
  //           -hls_time 10 -hls_list_size 0 output.m3u8
  // 4. 转码完成后将 m3u8 和 ts 文件上传到 MinIO hls/{uuid}/ 目录
  // 5. 更新 jobs Map 状态
  // 6. 清理 /tmp/ 临时文件
}

module.exports = { jobs, transcodeToHLS };
```

在 `src/routes/media.js` 增加：
- `GET /api/v1/media/transcode/:jobId` → 返回 `{ jobId, status, progress, hls_key }`

---

## 模块十：钓点管理（R62–R69）

### 数据库迁移

在 `src/db/migrate.js` 追加：
```sql
CREATE TABLE IF NOT EXISTS spots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  spot_type VARCHAR(20) NOT NULL DEFAULT 'other' 
    CHECK (spot_type IN ('river','lake','reservoir','sea','other')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  photo_key VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 新文件

**`src/routes/spots.js`**

- `POST /api/v1/spots` → 创建钓点（name, description, latitude, longitude, spot_type, is_public, photo_key）
- `GET /api/v1/spots` → 列出钓点（分页 page/pageSize，支持 `spot_type` / `is_public` 筛选）
- `GET /api/v1/spots/:id` → 详情，photo_key 转为预签名 URL
- `PUT /api/v1/spots/:id` → 更新（仅限 user_id 匹配）
- `DELETE /api/v1/spots/:id` → 删除（仅限 user_id 匹配）
- `GET /api/v1/spots/nearby` → Query 参数：`lat`, `lng`, `radius`（km，默认 10）
  - Haversine 公式实现（直接在 SQL 中用三角函数计算，无需 PostGIS）：
  ```sql
  SELECT *, 
    6371 * acos(
      cos(radians($1)) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians($2)) + 
      sin(radians($1)) * sin(radians(latitude))
    ) AS distance_km
  FROM spots
  WHERE 6371 * acos(...) < $3
  ORDER BY distance_km
  ```

---

## 模块十一：统计数据（R70–R74）

### 新文件

**`src/routes/stats.js`**

- `GET /api/v1/stats/overview`
  ```sql
  SELECT 
    COUNT(DISTINCT t.id) AS total_trips,
    COUNT(c.id) AS total_catches,
    COUNT(DISTINCT c.fish_species) AS total_species,
    COALESCE(SUM(c.weight_kg), 0) AS total_weight_kg
  FROM fishing_trips t
  LEFT JOIN fish_catches c ON c.trip_id = t.id
  WHERE t.user_id = $1
  ```

- `GET /api/v1/stats/seasonal?year=2024`
  ```sql
  -- 返回12个月数组，无数据的月份补0
  SELECT EXTRACT(MONTH FROM trip_date) AS month, COUNT(*) AS count
  FROM fishing_trips
  WHERE user_id = $1 AND EXTRACT(YEAR FROM trip_date) = $2
  GROUP BY month ORDER BY month
  ```

- `GET /api/v1/stats/species`
  ```sql
  SELECT fish_species AS name, COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS percentage
  FROM fish_catches c
  JOIN fishing_trips t ON t.id = c.trip_id
  WHERE t.user_id = $1
  GROUP BY fish_species ORDER BY count DESC
  ```

- `GET /api/v1/stats/top-catches`
  ```sql
  SELECT c.fish_species, c.weight_kg, t.trip_date
  FROM fish_catches c
  JOIN fishing_trips t ON t.id = c.trip_id
  WHERE t.user_id = $1 AND c.weight_kg IS NOT NULL
  ORDER BY c.weight_kg DESC LIMIT 10
  ```

---

## 模块十二：验证脚本更新（R75）

在 `scripts/verify.sh` 末尾追加 Phase 2 验证函数并调用：

```bash
verify_phase2() {
  # 媒体
  check "媒体 presign 端点存在" \
    curl -sf -o /dev/null -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/v1/media/presign/test-key" || true

  # 钓点
  SPOT=$(curl -sf -X POST http://localhost:3000/api/v1/spots \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"测试钓点","latitude":31.2304,"longitude":121.4737,"spot_type":"river","is_public":false}')
  SPOT_ID=$(echo $SPOT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
  check "钓点创建" [ -n "$SPOT_ID" ]
  check "钓点详情" curl -sf "http://localhost:3000/api/v1/spots/$SPOT_ID" -H "Authorization: Bearer $TOKEN"
  check "附近钓点" curl -sf "http://localhost:3000/api/v1/spots/nearby?lat=31.23&lng=121.47&radius=10" -H "Authorization: Bearer $TOKEN"
  curl -sf -X DELETE "http://localhost:3000/api/v1/spots/$SPOT_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

  # 统计
  check "统计 overview" curl -sf "http://localhost:3000/api/v1/stats/overview" -H "Authorization: Bearer $TOKEN"
  check "统计 seasonal" curl -sf "http://localhost:3000/api/v1/stats/seasonal" -H "Authorization: Bearer $TOKEN"
  check "统计 species" curl -sf "http://localhost:3000/api/v1/stats/species" -H "Authorization: Bearer $TOKEN"
  check "统计 top-catches" curl -sf "http://localhost:3000/api/v1/stats/top-catches" -H "Authorization: Bearer $TOKEN"
}

verify_phase2
```

---

## 注意事项

1. **路由注册**：在 `src/app.js` 注册 `media`、`spots`、`stats` 三个新路由模块
2. **认证**：所有新接口均需 JWT 认证（`preHandler: [fastify.authenticate]`）
3. **错误处理**：上传文件类型/大小不符时返回 400，文件不存在时返回 404
4. **FFmpeg 路径**：Alpine 镜像中 ffmpeg 在 `/usr/bin/ffmpeg`
5. **临时文件**：转码用 `/tmp/fishing-transcode/` 目录，用完立即清理
6. **并发安全**：转码 job UUID 用 `crypto.randomUUID()`

## 验收标准

`bash scripts/verify.sh` 输出 **"✓ 全部通过"**，REQUIREMENTS.md Phase 2 全部 31 项标记 `[x]`。
