# REQUIREMENTS.md · Phase 1 功能清单

> 状态说明：`[ ]` 未完成 / `[x]` 已完成
> 每完成一项立即更新本文件，不得提前宣告完成。

---

## 模块一：项目基础

- [x] R01 · `package.json` 初始化，依赖包含：fastify、@fastify/jwt、pg、bcrypt、dotenv、redis
- [x] R02 · `Dockerfile` 基于 node:22-alpine 构建，生产镜像可用
- [x] R03 · `docker-compose.yml` 包含：app、postgres(postgis)、redis、minio、nginx 五个服务
- [x] R04 · postgres / redis 健康检查通过后，app 服务才启动
- [x] R05 · 所有服务挂载 `./data/` 数据目录
- [x] R06 · `.env.example` 包含所有必要环境变量
- [x] R07 · `src/config.js` 统一读取环境变量并做缺省值处理

---

## 模块二：数据库

- [x] R08 · `src/db/index.js` PostgreSQL 连接池正常工作
- [x] R09 · `src/db/migrate.js` 建表：users
- [x] R10 · `src/db/migrate.js` 建表：fishing_styles，并插入初始数据（台钓、路亚）
- [x] R11 · `src/db/migrate.js` 建表：fishing_trips
- [x] R12 · `src/db/migrate.js` 建表：trip_fishing_styles
- [x] R13 · `src/db/migrate.js` 建表：fish_catches
- [x] R14 · `src/db/migrate.js` 建表：equipment_categories，并插入初始数据（鱼竿等9类）
- [x] R15 · `src/db/migrate.js` 建表：equipment_library
- [x] R16 · `src/db/migrate.js` 建表：trip_equipment

---

## 模块三：认证

- [x] R17 · 首次启动自动创建初始用户（来自 `.env` 的 INIT_USERNAME/INIT_PASSWORD）
- [x] R18 · `POST /api/v1/auth/login` 用户名密码正确时返回 JWT token
- [x] R19 · `POST /api/v1/auth/login` 密码错误时返回 401
- [x] R20 · `POST /api/v1/auth/change-password` 修改密码成功
- [x] R21 · `POST /api/v1/auth/change-password` 旧密码错误时返回 400
- [x] R22 · 未携带 token 访问受保护接口时返回 401
- [x] R23 · 携带无效 token 时返回 401

---

## 模块四：出行记录

- [x] R24 · `GET /api/v1/trips` 返回分页列表，含渔获总数和钓法标签
- [x] R25 · `GET /api/v1/trips` 支持 `styleCode` 筛选
- [x] R26 · `GET /api/v1/trips` 支持 `startDate` / `endDate` 日期范围筛选
- [x] R27 · `GET /api/v1/trips/:id` 返回出行详情，含钓法数组、渔获列表、装备列表
- [x] R28 · `POST /api/v1/trips` 创建出行记录，正确关联钓法（style_ids）
- [x] R29 · `PUT /api/v1/trips/:id` 更新出行记录，style_ids 全量替换
- [x] R30 · `DELETE /api/v1/trips/:id` 删除出行记录
- [x] R31 · `POST /api/v1/trips/sync` 批量同步：local_id 存在则更新，不存在则新建
- [x] R32 · `POST /api/v1/trips/sync` 返回每条记录的处理结果（created/updated）

---

## 模块五：渔获记录

- [x] R33 · `GET /api/v1/trips/:tripId/catches` 返回该出行所有渔获
- [x] R34 · `POST /api/v1/trips/:tripId/catches` 创建渔获记录
- [x] R35 · `PUT /api/v1/catches/:id` 更新渔获记录
- [x] R36 · `DELETE /api/v1/catches/:id` 删除渔获记录

---

## 模块六：装备管理

- [x] R37 · `GET /api/v1/equipment` 返回装备列表，含分类名称
- [x] R38 · `GET /api/v1/equipment` 支持 `styleTag` / `status` / `categoryId` 筛选
- [x] R39 · `POST /api/v1/equipment` 创建装备
- [x] R40 · `PUT /api/v1/equipment/:id` 更新装备
- [x] R41 · `DELETE /api/v1/equipment/:id` 删除装备，若被出行引用则返回 400
- [x] R42 · `GET /api/v1/equipment/categories` 返回所有分类
- [x] R43 · `POST /api/v1/equipment/categories` 新建自定义分类

---

## 模块七：MinIO 初始化

- [x] R44 · 首次启动时自动检查并创建 MinIO bucket（`fishing-media`）

---

## 完成进度

**44 / 44 项已完成**

> 提示：每完成一项请同步更新上方数字。
