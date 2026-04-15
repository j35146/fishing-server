# fishing-server 后端 API 完整文档

> 生成时间：2026-04-15
> 当前版本：Phase 1 + Phase 2 全部完成（75/75）

---

## 一、项目架构

```
fishing-server/
├── package.json              # 依赖管理
├── Dockerfile                # node:22-alpine + ffmpeg
├── docker-compose.yml        # 5 个服务编排
├── nginx.conf                # 反向代理 + MinIO 代理
├── .env.example              # 环境变量模板
├── scripts/verify.sh         # 自动化验证脚本
└── src/
    ├── server.js             # 入口：迁移 → 初始用户 → MinIO → 启动
    ├── app.js                # Fastify 实例 + 插件/路由注册
    ├── config.js             # 环境变量统一读取
    ├── db/
    │   ├── index.js          # PostgreSQL 连接池
    │   └── migrate.js        # 建表脚本（8张表 + Phase 2 扩展）
    ├── middleware/
    │   └── auth.js           # JWT 认证中间件
    ├── routes/
    │   ├── auth.js           # 登录、改密码
    │   ├── trips.js          # 出行 CRUD + 同步
    │   ├── catches.js        # 渔获 CRUD
    │   ├── equipment.js      # 装备 CRUD + 分类
    │   ├── media.js          # 媒体上传/删除/预签名
    │   ├── spots.js          # 钓点 CRUD + 附近搜索
    │   └── stats.js          # 统计数据
    └── utils/
        ├── jwt.js            # JWT 配置
        ├── minio.js          # MinIO S3 操作（上传/删除/预签名）
        └── transcode.js      # FFmpeg HLS 转码
```

---

## 二、Docker 服务

| 服务 | 镜像 | 宿主机端口 | 说明 |
|------|------|------------|------|
| app | 本地构建 (node:22-alpine + ffmpeg) | 3000 | Fastify API 服务 |
| postgres | postgis/postgis:16-3.4 | 5432 | 数据库 |
| redis | redis:7-alpine | 6379 | 缓存（预留） |
| minio | minio/minio:latest | 9000(API), 9001(控制台) | 对象存储 |
| nginx | nginx:alpine | **80** ← 客户端入口 | 反向代理 |

**客户端访问入口**：`http://<服务器IP>:80`（经端口转发后为外网端口）

### nginx 代理规则

- `/minio-proxy/*` → MinIO 文件直接代理
- `/*` → app:3000 API 服务

---

## 三、环境变量（.env）

```bash
PORT=3000                       # Fastify 监听端口
POSTGRES_HOST=postgres          # PostgreSQL 地址
POSTGRES_PORT=5432
POSTGRES_USER=fishing
POSTGRES_PASSWORD=fishing123
POSTGRES_DB=fishing
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret      # JWT 签名密钥
JWT_EXPIRES_IN=30d              # Token 有效期
INIT_USERNAME=admin             # 初始用户名
INIT_PASSWORD=change-me-123     # 初始密码
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=fishing-media
MINIO_PUBLIC_URL=               # 可选：MinIO 外网地址，用于预签名 URL
```

---

## 四、数据库表结构

### 4.1 users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | gen_random_uuid() |
| username | VARCHAR(50) UNIQUE | 用户名 |
| password_hash | VARCHAR(255) | bcrypt 哈希 |
| created_at | TIMESTAMPTZ | 创建时间 |

### 4.2 fishing_styles
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 自增 |
| name | VARCHAR(20) | 显示名（台钓、路亚） |
| code | VARCHAR(20) | 编码（TRADITIONAL、LURE） |

初始数据：`台钓/TRADITIONAL`、`路亚/LURE`

### 4.3 fishing_trips
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR(100) | 标题 |
| trip_date | DATE NOT NULL | 出行日期 |
| start_time | TIMESTAMPTZ | 开始时间 |
| end_time | TIMESTAMPTZ | 结束时间 |
| location_name | VARCHAR(200) | 地点名称 |
| spot_id | UUID | 关联钓点 |
| weather_temp | DECIMAL(4,1) | 气温 |
| weather_wind | VARCHAR(50) | 风力 |
| weather_condition | VARCHAR(50) | 天气状况 |
| companions | TEXT[] | 同行人 |
| notes | TEXT | 备注 |
| sync_status | VARCHAR(20) | 默认 'synced' |
| local_id | VARCHAR(100) UNIQUE | 客户端本地 ID（用于同步） |
| media_keys | JSONB | 默认 '[]'，媒体文件 key 列表 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 4.4 trip_fishing_styles（关联表）
| 字段 | 类型 | 说明 |
|------|------|------|
| trip_id | UUID FK → fishing_trips | |
| style_id | INTEGER FK → fishing_styles | |
| PK | (trip_id, style_id) | |

### 4.5 fish_catches
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| trip_id | UUID FK NOT NULL | 所属出行 |
| style_id | INTEGER FK | 钓法 |
| species | VARCHAR(100) | 鱼种 |
| weight_g | INTEGER | 重量（克） |
| length_cm | DECIMAL(5,1) | 长度（厘米） |
| count | INTEGER | 默认 1 |
| is_released | BOOLEAN | 默认 false |
| caught_at | TIMESTAMPTZ | 上鱼时间 |
| notes | TEXT | 备注 |
| local_id | VARCHAR(100) UNIQUE | 客户端本地 ID |
| media_keys | JSONB | 默认 '[]' |
| created_at | TIMESTAMPTZ | |

### 4.6 equipment_categories
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(50) | 分类名 |
| group_code | VARCHAR(20) | 大类编码：traditional / lure |
| sort_order | INTEGER | 排序 |

初始数据：台钓类 5 个（鱼竿、浮漂、钓台、钓箱、钓椅）+ 路亚类 4 个（鱼竿、渔轮、钓箱、路亚包）

### 4.7 equipment_library
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| category_id | INTEGER FK | 分类 |
| name | VARCHAR(100) NOT NULL | 装备名 |
| brand | VARCHAR(100) | 品牌 |
| model | VARCHAR(100) | 型号 |
| style_tags | TEXT[] | 钓法标签 |
| purchase_date | DATE | 购入日期 |
| purchase_price | DECIMAL(10,2) | 购入价格 |
| status | VARCHAR(20) | 默认 'active' |
| notes | TEXT | |
| photo_key | VARCHAR(500) | 装备照片 key |
| created_at | TIMESTAMPTZ | |

### 4.8 trip_equipment（关联表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| trip_id | UUID FK → fishing_trips | |
| equipment_id | UUID FK → equipment_library | |
| notes | TEXT | |

### 4.9 spots（Phase 2）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| user_id | UUID FK → users | 创建者 |
| name | VARCHAR(200) NOT NULL | 钓点名 |
| description | TEXT | 描述 |
| latitude | DECIMAL(10,8) | 纬度 |
| longitude | DECIMAL(11,8) | 经度 |
| spot_type | VARCHAR(20) | river/lake/reservoir/sea/other |
| is_public | BOOLEAN | 默认 false |
| photo_key | VARCHAR(500) | 照片 key |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

## 五、API 接口清单

### 通用规则

- **Base URL**：`http://<服务器>:<端口>/api/v1`
- **认证**：除 `/health` 和 `/api/v1/auth/login` 外，所有接口需要 Header 携带 token
- **认证头格式**：`Authorization: Bearer <token>` 或 `Authorization: <token>`（服务端自动兼容）
- **成功响应**：`{ "success": true, "data": ... }`
- **错误响应**：`{ "success": false, "error": "描述" }`
- **分页响应**：`{ "success": true, "data": [...], "pagination": { "page", "pageSize", "total" } }`

---

### 5.1 健康检查

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/health` | 否 | 返回 `{ "status": "ok" }` |

---

### 5.2 认证 `/api/v1/auth`

#### POST `/api/v1/auth/login` — 登录

请求体：
```json
{ "username": "admin", "password": "change-me-123" }
```

成功响应 200：
```json
{ "success": true, "data": { "token": "eyJ...", "expiresIn": "30d" } }
```

失败响应 401：
```json
{ "success": false, "error": "用户名或密码错误" }
```

#### POST `/api/v1/auth/change-password` — 修改密码（需认证）

请求体：
```json
{ "oldPassword": "旧密码", "newPassword": "新密码（≥6位）" }
```

---

### 5.3 出行记录 `/api/v1/trips`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/trips` | 分页列表，含钓法标签和渔获总数 |
| GET | `/api/v1/trips/:id` | 详情，含 styles/catches/equipment/media_urls |
| POST | `/api/v1/trips` | 创建出行 |
| PUT | `/api/v1/trips/:id` | 更新出行（style_ids 全量替换） |
| DELETE | `/api/v1/trips/:id` | 删除出行（级联删除渔获和关联） |
| POST | `/api/v1/trips/sync` | 批量同步（local_id 去重） |

#### GET 列表支持的查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认 1 |
| pageSize | int | 每页条数，默认 20 |
| styleCode | string | 钓法筛选（TRADITIONAL / LURE） |
| startDate | string | 起始日期 YYYY-MM-DD |
| endDate | string | 结束日期 YYYY-MM-DD |

#### POST 创建/PUT 更新请求体

```json
{
  "title": "周末夜钓",
  "trip_date": "2026-04-14",
  "start_time": "2026-04-14T18:00:00Z",
  "end_time": "2026-04-15T06:00:00Z",
  "location_name": "松花湖",
  "spot_id": "uuid（可选）",
  "weather_temp": 22.5,
  "weather_wind": "东南风3级",
  "weather_condition": "晴",
  "companions": ["老王", "小李"],
  "notes": "备注",
  "style_ids": [1, 2],
  "local_id": "客户端UUID（同步用）"
}
```

#### POST `/api/v1/trips/sync` 请求/响应

请求体：
```json
{
  "trips": [
    { "trip_date": "2026-04-15", "title": "离线记录", "style_ids": [1], "local_id": "abc-123" }
  ]
}
```

响应：
```json
{
  "success": true,
  "data": [
    { "local_id": "abc-123", "action": "created", "id": "uuid" }
  ]
}
```

---

### 5.4 渔获记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/trips/:tripId/catches` | 某出行的所有渔获 |
| POST | `/api/v1/trips/:tripId/catches` | 创建渔获 |
| PUT | `/api/v1/catches/:id` | 更新渔获 |
| DELETE | `/api/v1/catches/:id` | 删除渔获 |

请求体：
```json
{
  "species": "鲫鱼",
  "weight_g": 500,
  "length_cm": 28.5,
  "count": 1,
  "is_released": false,
  "caught_at": "2026-04-14T19:30:00Z",
  "notes": "浮漂钓",
  "style_id": 1,
  "local_id": "客户端UUID"
}
```

---

### 5.5 装备管理 `/api/v1/equipment`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/equipment` | 装备列表（含分类名） |
| POST | `/api/v1/equipment` | 创建装备 |
| PUT | `/api/v1/equipment/:id` | 更新装备 |
| DELETE | `/api/v1/equipment/:id` | 删除装备（被出行引用则 400） |
| GET | `/api/v1/equipment/categories` | 所有分类 |
| POST | `/api/v1/equipment/categories` | 新建分类 |

#### GET 列表支持的查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| styleTag | string | 钓法标签筛选 |
| status | string | 状态筛选（active/retired） |
| categoryId | int | 分类 ID 筛选 |
| page | int | 页码 |
| pageSize | int | 每页条数 |

---

### 5.6 媒体管理 `/api/v1/media`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/media/upload` | 上传文件（multipart/form-data） |
| GET | `/api/v1/media/presign/*` | 获取预签名 URL |
| GET | `/api/v1/media/file/*` | 直接代理返回文件流 |
| GET | `/api/v1/media/transcode/:jobId` | 查询转码状态 |
| DELETE | `/api/v1/media/*` | 删除文件 |

#### POST 上传

- Content-Type: `multipart/form-data`
- 字段名: `file`
- 图片：JPEG/PNG/HEIC，≤20MB
- 视频：MP4/MOV，≤500MB
- 视频上传后自动触发 HLS 720p 转码

成功响应 201：
```json
{
  "success": true,
  "data": {
    "key": "images/uuid.jpg",
    "url": "http://...预签名URL...",
    "type": "image",
    "size": 1234567,
    "jobId": "转码任务ID（仅视频）"
  }
}
```

#### 转码状态

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "done",
    "progress": 100,
    "hls_key": "hls/uuid/720p/index.m3u8"
  }
}
```

status 值：`pending` → `processing` → `done` / `failed`

---

### 5.7 钓点管理 `/api/v1/spots`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/spots` | 钓点列表（分页） |
| GET | `/api/v1/spots/nearby?lat=&lng=&radius=` | 附近钓点（km） |
| GET | `/api/v1/spots/:id` | 钓点详情（含 photo_url） |
| POST | `/api/v1/spots` | 创建钓点 |
| PUT | `/api/v1/spots/:id` | 更新钓点（仅限本人） |
| DELETE | `/api/v1/spots/:id` | 删除钓点（仅限本人） |

#### GET 列表查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| spot_type | string | river/lake/reservoir/sea/other |
| is_public | boolean | 是否公开 |
| page | int | 页码 |
| pageSize | int | 每页条数 |

#### POST 创建请求体

```json
{
  "name": "松花湖大坝",
  "description": "水深3-5米",
  "latitude": 43.8,
  "longitude": 126.7,
  "spot_type": "reservoir",
  "is_public": true,
  "photo_key": "images/xxx.jpg"
}
```

---

### 5.8 统计数据 `/api/v1/stats`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats/overview` | 总览：出行数、渔获数、鱼种数、总重量 |
| GET | `/api/v1/stats/seasonal?year=2026` | 按月出行次数（12个月数组） |
| GET | `/api/v1/stats/species` | 鱼种分布（name, count, percentage） |
| GET | `/api/v1/stats/top-catches` | 最大渔获 Top 10 |

#### overview 响应

```json
{
  "success": true,
  "data": {
    "total_trips": 25,
    "total_catches": 120,
    "total_species": 8,
    "total_weight_kg": 45.6
  }
}
```

---

## 六、启动流程（server.js）

1. **数据库迁移**（migrate.js）— 幂等建表
2. **创建初始用户** — users 表为空时用 INIT_USERNAME/INIT_PASSWORD 创建
3. **MinIO bucket** — 检查 `fishing-media` 不存在则创建
4. **注册 Fastify 插件** — formbody、jwt、multipart
5. **注册路由** — auth、trips、catches、equipment、media、spots、stats
6. **监听 0.0.0.0:3000**

---

## 七、认证中间件说明（middleware/auth.js）

- 兼容两种格式：`Authorization: Bearer <token>` 和 `Authorization: <token>`
- 如果客户端未加 `Bearer ` 前缀，服务端自动补上
- 验证失败统一返回 `401 { "success": false, "error": "未授权" }`
- 失败时记录 warn 日志，包含完整请求头信息用于排查

---

## 八、常用命令

```bash
# 启动服务
docker compose up -d

# 重建 app 服务（代码更新后）
docker compose up -d --build app

# 查看日志
docker compose logs -f app

# 查看非健康检查日志
docker compose logs app --tail 100 | grep -v '/health'

# 停止服务
docker compose down

# 清除数据重建
docker compose down -v && rm -rf data/postgres data/redis && docker compose up -d --build

# 运行验证脚本
bash scripts/verify.sh

# 进入数据库
docker compose exec postgres psql -U fishing -d fishing
```

---

## 九、已知注意事项

1. **PostGIS 镜像平台**：`postgis/postgis:16-3.4` 在 Apple Silicon 上以 amd64 兼容模式运行，有性能损耗但功能正常
2. **local_id 类型**：为 `VARCHAR(100)` 而非 UUID，兼容客户端发送任意格式的本地 ID
3. **MinIO 预签名 URL**：默认绑定 Docker 内部地址，如需外网访问需设置 `MINIO_PUBLIC_URL` 环境变量
4. **视频转码**：使用内存 Map 管理任务状态，服务重启后丢失（单用户私有部署，可接受）
5. **装备分类**：已按 group_code 分为 traditional（台钓）和 lure（路亚）两个大类
