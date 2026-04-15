# 钓鱼志后端服务 · CLAUDE.md

> Claude Code 每次会话开始前必须完整读取本文件。

---

## 项目概述

个人钓鱼记录 App 的后端 API 服务。单用户，私有部署。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js 22 LTS |
| 框架 | Fastify |
| 数据库 | PostgreSQL 16 + PostGIS |
| 缓存 | Redis 7 |
| 对象存储 | MinIO（Docker named volume，非 bind mount） |
| 部署 | Docker Compose |
| 认证 | JWT（3650 天有效期，约 10 年） |
| 反向代理 | Nginx（client_max_body_size 500M） |

## 项目结构

```
fishing-server/
  ├── CLAUDE.md               ← 本文件，每次必读
  ├── REQUIREMENTS.md         ← Phase 1 功能清单（R01–R44，全部完成）
  ├── scripts/
  │   └── verify.sh           ← 验证脚本
  ├── src/
  │   ├── app.js              ← Fastify 实例 + 插件注册（multipart 500MB 限制）
  │   ├── server.js           ← 入口，监听端口
  │   ├── config.js           ← 读取环境变量
  │   ├── db/
  │   │   ├── index.js        ← PostgreSQL 连接池
  │   │   └── migrate.js      ← 建表 + 初始数据（fishing_styles, equipment_categories）
  │   ├── routes/
  │   │   ├── auth.js         ← 登录（JWT 签发）
  │   │   ├── trips.js        ← 出行 CRUD + 批量同步（含 latitude/longitude）
  │   │   ├── catches.js      ← 渔获 CRUD
  │   │   ├── equipment.js    ← 装备 CRUD + 分类
  │   │   ├── media.js        ← 媒体上传 + presign + 文件代理(/media/file/*)
  │   │   ├── spots.js        ← 钓点 CRUD + 附近搜索
  │   │   └── stats.js        ← 统计 API（overview/seasonal/species/top-catches）
  │   ├── middleware/
  │   │   └── auth.js         ← JWT 验证中间件
  │   └── utils/
  │       ├── jwt.js          ← JWT 工具函数
  │       ├── minio.js        ← MinIO S3 客户端（双客户端：内部上传 + 外部 presign）
  │       └── transcode.js    ← FFmpeg HLS 转码（视频用）
  ├── docker-compose.yml      ← 容器编排（5 个服务）
  ├── nginx.conf              ← 反向代理配置
  ├── Dockerfile
  ├── .env                    ← 环境变量（生产）
  ├── .env.example            ← 环境变量模板
  └── package.json
```

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| users | 用户 | username, password_hash |
| fishing_styles | 钓法字典 | name(台钓/路亚), code(TRADITIONAL/LURE) |
| fishing_trips | 出行记录 | trip_date, location_name, **latitude**, **longitude**, weather_*, local_id, sync_status |
| trip_fishing_styles | 出行-钓法关联 | trip_id, style_id |
| fish_catches | 渔获记录 | trip_id, species, weight_g, length_cm, count, is_released |
| equipment_categories | 装备分类 | name, group_code(traditional/lure), sort_order |
| equipment_library | 装备库 | name, brand, model, category_id, style_tags, status |
| trip_equipment | 出行-装备关联 | trip_id, equipment_id |
| spots | 钓点 | name, latitude, longitude, spot_type, user_id |

> **注意：** `fishing_trips` 的 `latitude` 和 `longitude` 是 Phase 3 新增的字段（DECIMAL(10,8) 和 DECIMAL(11,8)），用于存储出行地点坐标。

## API 接口总览

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/auth/login | 登录，返回 JWT |

### 出行
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/trips | 列表（分页，返回 latitude/longitude） |
| POST | /api/v1/trips | 新建 |
| GET | /api/v1/trips/:id | 详情（含 styles/catches/equipment） |
| PUT | /api/v1/trips/:id | 更新 |
| DELETE | /api/v1/trips/:id | 删除 |
| POST | /api/v1/trips/sync | **批量离线同步**（核心接口，含 latitude/longitude） |

### 渔获
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/trips/:id/catches | 列表 |
| POST | /api/v1/catches | 新建 |
| DELETE | /api/v1/catches/:id | 删除 |

### 装备
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/equipment | 列表（支持 styleTag/status/categoryId 筛选） |
| POST | /api/v1/equipment | 新建 |
| PUT | /api/v1/equipment/:id | 更新 |
| DELETE | /api/v1/equipment/:id | 删除（已被出行引用返回 400） |
| GET | /api/v1/equipment/categories | 分类列表 |

### 媒体
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/media/upload | 上传（multipart，支持 JPEG/PNG/HEIC/MP4/MOV） |
| GET | /api/v1/media/presign/* | 获取预签名 URL（视频播放用） |
| GET | /api/v1/media/file/* | **文件流代理**（图片加载用，带 Token 认证） |
| GET | /api/v1/media/transcode/:jobId | 查询转码状态 |
| DELETE | /api/v1/media/* | 删除媒体文件 |

### 钓点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/spots | 列表（分页 + spot_type 筛选） |
| GET | /api/v1/spots/nearby | 附近钓点（lat/lng/radius） |
| POST | /api/v1/spots | 新建 |
| GET | /api/v1/spots/:id | 详情 |
| PUT | /api/v1/spots/:id | 更新（仅本人） |
| DELETE | /api/v1/spots/:id | 删除（仅本人） |

### 统计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/stats/overview | 总览（出行次数/渔获数/鱼种数） |
| GET | /api/v1/stats/seasonal | 月度出行趋势（?year=） |
| GET | /api/v1/stats/species | 鱼种分布 |
| GET | /api/v1/stats/top-catches | 最大渔获 Top 10 |

## 代码规范

- 所有注释使用**中文**
- 错误响应格式：`{ "success": false, "error": "描述" }`
- 成功响应格式：`{ "success": true, "data": ... }`
- 分页响应格式：`{ "success": true, "data": [...], "pagination": { "page", "pageSize", "total" } }`
- 每个路由必须有 Fastify Schema 做参数校验
- 敏感配置只能通过 `.env` 注入，禁止硬编码
- PostgreSQL DECIMAL 类型通过 node-pg 返回时可能是 String，iOS 端需灵活解码

## 常用命令

```bash
# 启动所有服务
docker compose up -d

# 重建 app 容器（代码更新后）
docker compose up -d --build app

# 查看日志
docker compose logs -f app

# 重启 nginx（改了 nginx.conf 后）
docker compose restart nginx

# 进入数据库
docker compose exec postgres psql -U fishing -d fishing

# 查看表结构
docker compose exec postgres psql -U fishing -d fishing -c "\d fishing_trips"
```

## 生产环境

| 服务 | 地址 |
|------|------|
| API | http://home.weixia.org:35146 |
| SSH | `ssh -p 11122 thomas@home.weixia.org` |
| 代码位置 | /opt/fishing-server/ |
| MinIO | Docker named volume `fishing-server_minio-data` |

### 生产环境 .env 关键配置
```
JWT_EXPIRES_IN=3650d
MINIO_PUBLIC_URL=（按实际外网地址配置）
INIT_USERNAME=Thomas
```

## 开发阶段

| 阶段 | 范围 | 状态 |
|------|------|------|
| Phase 1（R01–R44） | Docker 环境、建表、认证、出行/渔获/装备 CRUD | ✅ 已完成 |
| Phase 2（R45–R75） | 媒体上传、视频转码、钓点 CRUD、统计 API | ✅ 已完成 |
| Phase 3（iOS 联调修复） | trips 加 lat/lng、media/file 代理接口、MinIO named volume、nginx 500M | ✅ 已完成 |

### Phase 3 服务端变更（2026-04-15）
- `fishing_trips` 表新增 `latitude DECIMAL(10,8)` 和 `longitude DECIMAL(11,8)`
- `trips.js`：sync/create/update/list 接口支持 latitude/longitude
- `media.js`：新增 `GET /api/v1/media/file/*` 文件流代理（S3 → 客户端，带 Token 认证）
- `docker-compose.yml`：MinIO 从 bind mount (`./data/minio:/data`) 改为 named volume (`minio-data:/data`)
- `nginx.conf`：`client_max_body_size` 50M → 500M
- `.env`：`JWT_EXPIRES_IN` 30d → 3650d
