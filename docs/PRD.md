# 钓鱼志 App — 产品需求文档（PRD）

> 版本：v3.0  
> 日期：2026-04-15（Phase 3 更新）  
> 作者：姜峰  
> 平台：iOS（SwiftUI）+ Ubuntu 后端

---

## 目录

1. [项目概述](#1-项目概述)
2. [UI设计规范](#2-ui设计规范)
3. [页面结构](#3-页面结构)
4. [功能模块详述](#4-功能模块详述)
5. [技术架构](#5-技术架构)
6. [数据库设计](#6-数据库设计)
7. [API接口规范](#7-api接口规范)
8. [离线同步机制](#8-离线同步机制)
9. [非功能性需求](#9-非功能性需求)
10. [开发阶段规划](#10-开发阶段规划)

---

## 1. 项目概述

### 1.1 产品定位

个人钓鱼记录工具，用于系统化记录每次钓鱼出行的完整信息，包括渔获、装备、钓点、照片视频，并提供数据统计与外部分享能力。

### 1.2 基本约束

| 项目 | 说明 |
|------|------|
| 用户规模 | 单用户，个人私有使用 |
| 社交功能 | 无 |
| 客户端 | iOS（SwiftUI 原生，最低支持 iOS 17） |
| 服务端 | Ubuntu 24.04 LTS（全新虚拟机，Docker Compose 部署） |
| 外置存储 | 服务器挂载外置磁盘，供 MinIO 使用 |

### 1.3 核心功能

- 出行日志记录（支持离线）
- 渔获记录（含放流标记）
- 装备库管理
- 钓点地图
- 数据统计分析
- 照片/视频上传与在线播放
- 生成外部分享链接
- 导出 PDF / Excel

---

## 2. UI 设计规范

### 2.1 视觉风格

| 属性 | 规范 |
|------|------|
| 整体风格 | 深海暗色调，沉浸感强 |
| 主背景色 AppBackground | `#071325`（深海蓝黑） |
| 卡片背景 CardBackground | `#0D2137` |
| 卡片次级 CardElevated | `#1F2A3D` |
| 最高层面板 CardSurface | `#2A3548` |
| 主强调色 PrimaryGold | `#E6C364`（金）|
| 辅色 AccentBlue | `#75D1FF`（蓝）|
| 主文字色 TextPrimary | `#FFFFFF` |
| 次要文字色 TextSecondary | `#D7E3FC` |
| 三级文字 TextTertiary | `#B5C8E5` |
| 警告色 DestructiveRed | `#EF4444` |
| 圆角半径 | `12px` |
| 基准宽度 | `390px`（iPhone 14 基准） |

### 2.2 设计稿文件

位置：`/Users/thomas/Desktop/Drive/AI/fishing/stitch/`

| 文件夹 | 对应页面 | 内容 |
|--------|---------|------|
| `home_blue_final` | 日志首页 | `screen.png` + `code.html` |
| `detail_blue_final` | 行程详情 | `screen.png` + `code.html` |
| `gear_blue_final` | 装备库 | `screen.png` + `code.html` |
| `stats_blue_final_v2` | 统计概览 | `screen.png` + `code.html` |
| `spots_blue_final_v2` | 发现钓点 | `screen.png` + `code.html` |
| `abyssal_glass` | 启动页/引导页 | `screen.png` + `code.html` |

---

## 3. 页面结构

### 3.1 底部导航栏（全局，5 Tab）

| Tab | 图标 | 页面 | 路由 |
|-----|------|------|------|
| 日志 | 📓 | 日志首页 | `/` |
| 统计 | 📊 | 统计概览 | `/stats` |
| 装备 | 🎣 | 装备库 | `/gear` |
| 钓点 | 📍 | 发现钓点 | `/spots` |
| 我的 | 👤 | 个人中心 | `/profile` |

### 3.2 完整页面清单

```
Tab: 日志
  ├── 日志首页（列表）
  ├── 新建出行（多步骤表单）
  │     ├── Step1：基本信息
  │     ├── Step2：渔获记录
  │     ├── Step3：选择装备
  │     └── Step4：上传媒体
  └── 行程详情页

Tab: 统计
  └── 统计概览（图表仪表盘）

Tab: 装备
  ├── 装备库列表
  ├── 新建/编辑装备
  └── 装备分类管理

Tab: 钓点
  ├── 钓点地图+列表
  ├── 新建/编辑钓点
  └── 钓点详情（关联历史出行）

Tab: 我的
  ├── 个人设置
  ├── 数据导出（PDF / Excel）
  └── 关于
```

---

## 4. 功能模块详述

### 4.1 出行日志

#### 4.1.1 日志首页
- 按日期倒序展示出行卡片
- 卡片内容：封面图、钓场名称、日期、渔获数量、鱼种标签
- 支持筛选：按钓法（台钓/路亚）、按钓点、按日期范围
- 右上角新建按钮

#### 4.1.2 新建出行（必填 / 选填）

| 字段 | 是否必填 | 说明 |
|------|---------|------|
| 出行日期 | ✅ 必填 | 日期选择器 |
| 钓法 | ✅ 必填 | 多选：台钓 / 路亚 |
| 钓场/地点 | 选填 | 地图搜索选点 + 手动输入名称（支持反向地理编码自动获取） |
| 标题 | 选填 | 不填则自动生成，如"2026-04-14 钓鱼" |
| 开始/结束时间 | 选填 | 时间选择器 |
| 天气状况 | 选填 | 手动填写或 WeatherKit 自动获取：温度（℃）、天气（晴/阴/雨/雪） |
| 同行人 | 选填 | 文字输入，支持多人 |
| 装备选择 | 选填 | 从装备库筛选（详见 4.4） |
| 照片/视频 | 选填 | 相机拍摄或相册选取 |
| 备注 | 选填 | 自由文本 |

#### 4.1.3 行程详情页
- 顶部封面大图
- 钓场名称、日期、天气数据
- 同行钓友头像列表
- 渔获记录列表（可展开：鱼种、重量、体长、钓法归属、是否放流）
- 所用装备列表
- 照片相册（九宫格，点击全屏）
- 视频列表（HLS 在线播放，支持进度拖拽）
- 地图小卡片（钓点位置）
- 右上角分享按钮（生成外链）
- 编辑入口

---

### 4.2 渔获记录

每条渔获字段：

| 字段 | 说明 |
|------|------|
| 鱼种 | 文字输入，支持历史记录补全 |
| 钓法归属 | 选择本次出行已选钓法之一（台钓/路亚） |
| 重量（克） | 数字输入，可选 |
| 体长（cm） | 数字输入，可选 |
| 数量 | 默认1，支持批量 |
| 是否放流 | 开关（路亚常用） |
| 钓获时间 | 可选 |
| 备注 | 可选 |

规则：
- 归属于一次出行，每次出行可记录多条渔获
- 放流与保留在统计时分别计算

---

### 4.3 钓法分类

| 钓法 | 代码 | 说明 |
|------|------|------|
| 台钓 | `TRADITIONAL` | 固定浮漂、手竿为主 |
| 路亚 | `LURE` | 假饵、路亚竿为主，常见放流 |

- 每次出行可同时选择多种钓法（多选）
- 每条渔获记录归属于其中一种钓法

---

### 4.4 装备管理

#### 4.4.1 装备库

**分类（按大类区分，存于 `equipment_categories` 表）**

| 台钓分类 | 路亚分类 |
|---------|---------|
| 鱼竿 | 鱼竿 |
| 钓台 | 渔轮 |
| 钓箱 | 钓箱 |
| 钓椅 | 其它 |
| 其它 | |

**装备字段**

| 字段 | 必填 | 说明 |
|------|------|------|
| 名称 | ✅ | 装备名称 |
| 分类 | ✅ | 从分类列表选择 |
| 适用钓法标签 | ✅ | 多选：台钓 / 路亚 / **公共**（三者均可） |
| 品牌 | 选填 | 文字输入 |
| 型号 | 选填 | 文字输入 |
| 购入日期 | 选填 | 日期选择器 |
| 购入价格 | 选填 | 数字输入 |
| 照片 | 选填 | 1张，存 MinIO |
| 状态 | ✅ | 在用 / 退休 / 丢失 |
| 备注 | 选填 | 自由文本 |

**装备列表展示**
- 按分类分组
- 支持按钓法标签筛选（台钓/路亚/公共）
- 支持按状态筛选
- 搜索功能

#### 4.4.2 出行装备选择

- 进入"选择装备"页面时，根据本次已选钓法自动筛选：
  - 已标注对应钓法标签的装备
  - 已标注"公共"标签的装备
- 支持手动搜索添加未筛出的装备
- 每件装备可填写本次使用备注

---

### 4.5 钓点管理

**钓点字段**

| 字段 | 必填 | 说明 |
|------|------|------|
| 名称 | ✅ | 钓点名称 |
| GPS 位置 | ✅ | 地图点选 或 手动输入坐标 |
| 水域类型 | ✅ | 江河 / 湖泊 / 水库 / 坑塘 / 其他 |
| 备注 | 选填 | 自由文本 |
| 出行次数 | 自动 | 系统统计，不可手动修改 |

**功能**
- 钓点列表（按出行次数倒序）
- 地图模式：所有钓点在 MapKit 地图上标注
- 钓点详情：查看关联历史出行记录

---

### 4.6 媒体管理

#### 照片
- 来源：相机拍照 / 相册选取
- 客户端压缩：长边 ≤ 1600px，JPEG 质量 0.7
- 存储：MinIO 对象存储，key 格式 `images/{uuid}.jpg`
- 加载方式：通过 `/api/v1/media/file/{key}` 代理接口（带 Token 认证）
- 归属层级：出行级

#### 视频
- 来源：相机录像（720p，最长 5 分钟）/ 相册选取
- 上传：原始文件直接上传至 MinIO，key 格式 `videos/{uuid}.mp4`
- 播放方式：iOS 通过 presign URL + AVPlayer 直接播放（无需 HLS 转码）
- 缩略图：客户端网格中显示占位图标（不下载视频提取帧）

#### 分享
- 图片/视频全屏查看时左上角有分享按钮
- 图片：下载原图后通过 UIActivityViewController 分享
- 视频：下载完整视频到临时文件后分享
- 支持 AirDrop、保存到相册、微信等所有系统分享目标

#### 离线媒体处理
- 离线时媒体数据存入 CoreData（localImageData 字段）
- 联网后 SyncManager 自动触发 MediaUploadManager.retryFailed() 重试上传

---

### 4.7 数据统计

#### 概览卡片
- 总出行次数（示例：142）
- 总钓获条数（示例：584）
- 鱼种数量（示例：28种）
- 放流总数

#### 渔获统计
- 年度/月度渔获趋势折线图
- 鱼种分布饼图（Top 10）
- 最大单鱼记录
- 放流 vs 保留比例

#### 出行统计
- 月度出行频次柱状图
- 最常去钓点 Top 5
- 台钓 vs 路亚出行占比
- 同行人出行次数统计

#### 装备统计
- 使用频次排行（按出行次数）
- 各分类装备数量
- 装备总价值

#### 时间筛选
- 支持：按年 / 按月 / 自定义区间

---

### 4.8 外部分享

- 出行详情页右上角"生成分享链接"
- 服务端生成唯一 Token URL：`https://your-domain.com/share/{token}`
- 分享页（无需登录，浏览器直接访问）内容：
  - 基本信息（日期、钓点、天气、同行人）
  - 渔获列表
  - 照片相册（懒加载）
  - 视频在线播放
- 支持过期设置：永不过期 / 7天 / 30天
- 支持随时撤销链接
- 分享页响应式布局，移动端友好

---

### 4.9 数据导出

| 类型 | 内容 | 入口 |
|------|------|------|
| PDF | 单次出行记录（信息+渔获+装备+照片最多9张） | 出行详情页 |
| Excel | 全部数据（出行列表 + 渔获明细 + 装备记录，3个Sheet） | 「我的」页面 |

---

## 5. 技术架构

### 5.1 整体架构

```
iPhone App（SwiftUI）
  ├── 本地 Core Data（离线存储）
  └── 后台同步管理器（联网后自动上传）
           │
           │ HTTPS / REST API（JSON）
           ▼
      Nginx（反向代理 + HTTPS + 静态资源）
           │
      Fastify API Server（Node.js）
           │
    ┌──────┼──────────┐
    │      │          │
PostgreSQL  Redis     MinIO
+PostGIS  （缓存）   （文件存储 → 外置磁盘）
                       ├── /photos/
                       ├── /videos/raw/
                       └── /videos/hls/
```

### 5.2 技术选型

| 层级 | 技术 | 版本 |
|------|------|------|
| 操作系统 | Ubuntu | 24.04 LTS |
| 容器编排 | Docker Compose | 最新稳定版 |
| 反向代理 | Nginx | 最新稳定版 |
| 后端框架 | Node.js + Fastify | Node 22 LTS |
| 关系数据库 | PostgreSQL + PostGIS | PG 16 |
| 缓存 | Redis | 7.x |
| 对象存储 | MinIO | 最新稳定版 |
| 视频处理 | FFmpeg | 最新稳定版 |
| iOS 框架 | SwiftUI | iOS 17+ |
| iOS 地图 | MapKit | 系统自带 |
| iOS 网络 | Alamofire + Combine | 最新版 |
| iOS 本地存储 | Core Data | 系统自带 |
| iOS 视频播放 | AVPlayer（presign URL 直接播放） | 系统自带 |
| iOS 天气 | WeatherKit | iOS 16+（需开发者账号） |
| iOS 相机 | UIImagePickerController | 系统自带 |

### 5.3 服务器端口规划

| 服务 | 端口 |
|------|------|
| Nginx | 80 / 443 |
| Fastify | 3000（内部） |
| PostgreSQL | 5432（内部） |
| Redis | 6379（内部） |
| MinIO API | 9000（内部） |
| MinIO Console | 9001（内部） |

### 5.4 生产环境目录结构

```
/opt/fishing-server/           # 生产服务器（Ubuntu 24.04）
  ├── src/                     # Fastify 后端源码
  │   ├── routes/              # API 路由（trips/media/spots/equipment/stats）
  │   ├── utils/               # 工具（minio.js/transcode.js）
  │   ├── middleware/          # 认证中间件
  │   └── config.js            # 配置读取
  ├── docker-compose.yml       # 容器编排
  ├── nginx.conf               # 反向代理
  ├── Dockerfile
  └── .env                     # 环境变量
```

### 5.5 生产环境访问

| 服务 | 地址 |
|------|------|
| API | http://home.weixia.org:35146 |
| SSH | `ssh -p 11122 thomas@home.weixia.org` |
| MinIO Console | 内网 :9001 |

---

## 6. 数据库设计

### 6.1 表总览

```
users                    # 用户（单条记录）
fishing_styles           # 钓法字典（台钓/路亚）
fishing_trips            # 出行记录主表
trip_fishing_styles      # 出行-钓法（多对多）
fish_catches             # 渔获记录
equipment_categories     # 装备分类
equipment_library        # 装备库
trip_equipment           # 出行-装备（多对多）
fishing_spots            # 钓点库
media                    # 照片/视频
share_links              # 外部分享链接
```

### 6.2 核心表字段

#### users
```sql
id            UUID PRIMARY KEY
username      VARCHAR(50) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
created_at    TIMESTAMPTZ DEFAULT NOW()
```

#### fishing_styles
```sql
id    SERIAL PRIMARY KEY
name  VARCHAR(20)    -- 台钓 / 路亚
code  VARCHAR(20)    -- TRADITIONAL / LURE
```

#### fishing_trips
```sql
id                UUID PRIMARY KEY
title             VARCHAR(100)
trip_date         DATE NOT NULL
start_time        TIMESTAMPTZ
end_time          TIMESTAMPTZ
location_name     VARCHAR(200)
latitude          DECIMAL(10,8)            -- 纬度（Phase 3 新增）
longitude         DECIMAL(11,8)            -- 经度（Phase 3 新增）
spot_id           UUID                     -- 关联钓点
weather_temp      DECIMAL(4,1)             -- ℃
weather_wind      VARCHAR(50)
weather_condition VARCHAR(50)              -- 晴/阴/雨/雪
companions        TEXT[]                   -- 同行人数组
notes             TEXT
media_keys        JSONB DEFAULT '[]'       -- 媒体文件 key 列表
local_id          VARCHAR(100) UNIQUE      -- 客户端离线ID
sync_status       VARCHAR(20) DEFAULT 'synced'
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

#### trip_fishing_styles
```sql
trip_id   UUID REFERENCES fishing_trips(id)
style_id  INTEGER REFERENCES fishing_styles(id)
PRIMARY KEY (trip_id, style_id)
```

#### fish_catches
```sql
id            UUID PRIMARY KEY
trip_id       UUID REFERENCES fishing_trips(id) NOT NULL
style_id      INTEGER REFERENCES fishing_styles(id)  -- 钓法归属
species       VARCHAR(100)
weight_g      INTEGER
length_cm     DECIMAL(5,1)
count         INTEGER DEFAULT 1
is_released   BOOLEAN DEFAULT FALSE      -- 是否放流
caught_at     TIMESTAMPTZ
notes         TEXT
local_id      UUID
created_at    TIMESTAMPTZ DEFAULT NOW()
```

#### equipment_categories
```sql
id         SERIAL PRIMARY KEY
name       VARCHAR(50) NOT NULL
sort_order INTEGER DEFAULT 0
```

#### equipment_library
```sql
id             UUID PRIMARY KEY
category_id    INTEGER REFERENCES equipment_categories(id)
name           VARCHAR(100) NOT NULL
brand          VARCHAR(100)
model          VARCHAR(100)
style_tags     TEXT[]     -- ['TRADITIONAL','LURE','COMMON']（公共=COMMON）
purchase_date  DATE
purchase_price DECIMAL(10,2)
photo_path     VARCHAR(500)
status         VARCHAR(20) DEFAULT 'active'   -- active/retired/lost
notes          TEXT
created_at     TIMESTAMPTZ DEFAULT NOW()
```

#### trip_equipment
```sql
id           UUID PRIMARY KEY
trip_id      UUID REFERENCES fishing_trips(id)
equipment_id UUID REFERENCES equipment_library(id)
notes        TEXT
```

#### fishing_spots
```sql
id           UUID PRIMARY KEY
name         VARCHAR(200) NOT NULL
location     GEOMETRY(Point, 4326)
water_type   VARCHAR(50)   -- 江河/湖泊/水库/坑塘/其他
notes        TEXT
visit_count  INTEGER DEFAULT 0   -- 自动统计
created_at   TIMESTAMPTZ DEFAULT NOW()
```

#### media
```sql
id               UUID PRIMARY KEY
trip_id          UUID REFERENCES fishing_trips(id)
type             VARCHAR(10)      -- photo / video
minio_path       VARCHAR(500)
thumbnail_path   VARCHAR(500)
hls_path         VARCHAR(500)     -- .m3u8 路径（视频专用）
file_size        BIGINT
duration_sec     INTEGER
taken_at         TIMESTAMPTZ
transcode_status VARCHAR(20) DEFAULT 'pending'  -- pending/processing/done/failed
local_id         UUID
created_at       TIMESTAMPTZ DEFAULT NOW()
```

#### share_links
```sql
id          UUID PRIMARY KEY
trip_id     UUID REFERENCES fishing_trips(id)
token       VARCHAR(64) UNIQUE NOT NULL
expires_at  TIMESTAMPTZ           -- NULL = 永不过期
view_count  INTEGER DEFAULT 0
created_at  TIMESTAMPTZ DEFAULT NOW()
```

---

## 7. API 接口规范

### 7.1 基础规范

- 协议：HTTPS
- 格式：JSON
- 认证：`Authorization: Bearer {jwt_token}`
- 路径前缀：`/api/v1/`

### 7.2 接口清单

#### 认证
```
POST   /api/v1/auth/login          # 登录，返回 JWT
POST   /api/v1/auth/refresh        # 刷新 Token
```

#### 出行记录
```
GET    /api/v1/trips               # 列表（分页+筛选）
POST   /api/v1/trips               # 新建
GET    /api/v1/trips/:id           # 详情
PUT    /api/v1/trips/:id           # 更新
DELETE /api/v1/trips/:id           # 删除
POST   /api/v1/trips/sync          # 批量离线同步
```

#### 渔获
```
GET    /api/v1/trips/:id/catches   # 列表
POST   /api/v1/trips/:id/catches   # 新建
PUT    /api/v1/catches/:id         # 更新
DELETE /api/v1/catches/:id         # 删除
```

#### 装备
```
GET    /api/v1/equipment           # 列表（支持标签/状态筛选）
POST   /api/v1/equipment           # 新建
PUT    /api/v1/equipment/:id       # 更新
DELETE /api/v1/equipment/:id       # 删除
GET    /api/v1/equipment/categories  # 分类列表
POST   /api/v1/equipment/categories  # 新建分类
```

#### 钓点
```
GET    /api/v1/spots               # 列表
POST   /api/v1/spots               # 新建
PUT    /api/v1/spots/:id           # 更新
DELETE /api/v1/spots/:id           # 删除
```

#### 媒体
```
POST   /api/v1/media/upload        # 上传（multipart/form-data）
GET    /api/v1/media/:id/status    # 查询视频转码状态
DELETE /api/v1/media/:id           # 删除
```

#### 分享
```
POST   /api/v1/trips/:id/share     # 生成分享链接
DELETE /api/v1/share/:token        # 撤销链接
GET    /share/:token               # 公开分享页（无需认证）
```

#### 统计
```
GET    /api/v1/stats/overview      # 概览数据
GET    /api/v1/stats/catches       # 渔获统计
GET    /api/v1/stats/trips         # 出行统计
GET    /api/v1/stats/equipment     # 装备统计
```

#### 导出
```
GET    /api/v1/export/pdf/:trip_id # 单次出行 PDF
GET    /api/v1/export/excel        # 全部数据 Excel
```

---

## 8. 离线同步机制

### 8.1 工作流程

```
离线状态（无网络）：
  新建/编辑操作 → 写入本地 Core Data
  照片/视频 → 存本地沙盒，标记"待上传"

恢复联网（App 进入前台自动触发）：
  Step 1：上传待上传媒体文件 → 获取服务器路径
  Step 2：推送本地日志数据（含媒体路径）到服务器
  Step 3：服务器返回成功 → 本地标记"已同步"
  Step 4：拉取服务器最新数据，合并到本地
```

### 8.2 同步字段

每条本地记录包含：
- `local_id`：客户端生成的 UUID
- `updated_at`：最后修改时间
- `sync_status`：`synced` / `pending` / `conflict`

### 8.3 冲突策略

单用户系统，采用**最后修改时间优先**（Last-Write-Wins）。

### 8.4 同步状态 UI

| 状态 | 图标 | 说明 |
|------|------|------|
| 已同步 | ✅ | 数据已上传服务器 |
| 同步中 | ⏳ | 正在上传 |
| 同步失败 | ❌ | 点击可重试 |

---

## 9. 非功能性需求

### 9.1 性能
- API 响应 P95 < 500ms（不含文件上传）
- 视频转码：后台异步处理，不阻塞 App
- 列表接口默认分页：每页 20 条

### 9.2 安全
- JWT 有效期：3650 天（约 10 年，单用户无需频繁重登）
- HTTP（内网部署，非公网暴露）
- 密码：bcrypt 加密存储
- iOS Token 存储：Keychain（主）+ UserDefaults（兜底）

### 9.3 存储
- 照片：客户端压缩（长边 ≤ 1600px，JPEG 0.7）后上传
- 视频：原始文件直接上传，720p 品质
- MinIO 存储：生产环境挂载 NAS（`/mnt/nas/fishing`）；开发环境用 Docker named volume（避免 macOS VirtioFS 锁问题）
- 生产环境 nginx `client_max_body_size 500M`

### 9.4 备份
- 数据库：建议每日 `pg_dump` 自动备份至外置磁盘
- 媒体文件：外置磁盘定期手动备份

### 9.5 兼容性
- iOS 最低版本：iOS 17
- 服务端：Ubuntu 24.04 LTS + Docker

---

## 10. 开发阶段与完成状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| 服务端 Phase 1（R01–R44） | 环境搭建 + 数据库 + 认证 + 出行/渔获/装备 CRUD | ✅ 已完成 |
| 服务端 Phase 2（R45–R75） | 媒体上传 + 统计 + 钓点 + 视频转码 | ✅ 已完成 |
| iOS Phase 1（I01–I65） | 登录 + 出行 CRUD + 渔获 + 装备选择 + Core Data + 离线同步 | ✅ 已完成 |
| iOS Phase 2（I66–I125） | 统计图表 + 装备管理 + 媒体上传 + 钓点地图 + 个人中心 | ✅ 已完成 |
| iOS Phase 3 | 地图选点 + 拍照/录像 + 视频播放 + WeatherKit + 媒体分享 | ✅ 已完成 |

### Phase 3 详细变更记录（2026-04-15）

**新增功能：**
- 地图搜索选点（MapKit MKLocalSearch + 反向地理编码）
- 地点名称手动输入 + 自动获取按钮
- 出行详情页内嵌小地图
- 拍照（UIImagePickerController）
- 录像（720p，最长 5 分钟）
- 相册选取支持图片+视频
- 全屏视频播放器（presign URL + AVPlayer）
- WeatherKit 天气自动获取（当日实时 + 历史日级）
- 图片/视频全屏分享按钮

**Bug 修复：**
- 照片上传 500（MinIO bind mount → named volume）
- 日期显示"未知日期"（ISO8601 毫秒解析）
- 出行记录无法删除（API 失败不阻塞本地删除）
- 杀进程后重新登录（Token 加 UserDefaults 兜底）
- 视频无法播放（弃用私有 API，改 presign URL）

**后端变更：**
- `fishing_trips` 表新增 `latitude`/`longitude` 列
- trips sync/GET 接口支持经纬度读写
- `media.js` 新增 `/api/v1/media/file/*` 文件代理接口
- nginx `client_max_body_size` 50M → 500M
- JWT 有效期 30d → 3650d
- MinIO 从 bind mount 改为 Docker named volume

### 待开发功能（Future）
- 外部分享页面（响应式 Web，生成分享链接）
- PDF / Excel 导出
- HLS 视频转码（当前直接播放原始文件）
- 渔获历史记录补全（鱼种输入建议）
- 装备使用频次统计

---

*文档结束 · 钓鱼志 PRD v3.0*
