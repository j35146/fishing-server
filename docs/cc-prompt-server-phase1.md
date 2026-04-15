# fishing-server · Phase 1 初始化提示词（Harness Engineering）

> 供 Claude Code 使用。这是 Phase 1 的 Initializer Prompt，负责搭建完整后端基础框架。

---

## 开始前必读

**第一步：立即读取以下两个文件，完全理解后再开始编码。**

```
CLAUDE.md          ← 项目规范、技术栈、工作流程
REQUIREMENTS.md    ← 功能清单（共 44 项，初始全部未完成）
```

---

## 你的任务

按照 `REQUIREMENTS.md` 中的 44 个需求项，完整实现 fishing-server Phase 1 后端服务。

**工作规则（必须遵守）：**

1. **按模块顺序执行**：基础 → 数据库 → 认证 → 出行 → 渔获 → 装备 → MinIO
2. **完成即标记**：每完成 `REQUIREMENTS.md` 中的一项，立即将 `[ ]` 改为 `[x]`，并更新底部进度数字
3. **模块自验证**：每完成一个完整模块，运行 `bash scripts/verify.sh`；有失败必须当场修复，不得跳过
4. **禁止提前宣告完成**：必须 verify.sh 全部通过后才能声明 Phase 1 完成

---

## 实现细节

### 模块一：项目基础（R01–R07）

**package.json** 依赖：
```json
{
  "dependencies": {
    "fastify": "^4",
    "@fastify/jwt": "^8",
    "@fastify/formbody": "^7",
    "pg": "^8",
    "ioredis": "^5",
    "bcrypt": "^5",
    "minio": "^7",
    "dotenv": "^16",
    "uuid": "^9"
  }
}
```

**Dockerfile**：
- 基础镜像：`node:22-alpine`
- 工作目录：`/app`
- 只复制必要文件（`.dockerignore` 排除 `node_modules`、`.env`、`data/`）
- 健康检查：`CMD curl -f http://localhost:3000/health || exit 1`

**docker-compose.yml** 服务：

| 服务 | 镜像 | 内部端口 | 数据挂载 |
|------|------|---------|---------|
| app | 本地构建 | 3000 | - |
| postgres | postgis/postgis:16-3.4 | 5432 | `./data/postgres` |
| redis | redis:7-alpine | 6379 | `./data/redis` |
| minio | minio/minio:latest | 9000,9001 | `./data/minio` |
| nginx | nginx:alpine | 80 | `./nginx.conf` |

- app 依赖 postgres 和 redis 的健康检查（`service_healthy`）
- 统一网络：`fishing-net`（bridge）
- nginx 将 `/` 反向代理到 `app:3000`

**nginx.conf**：
```nginx
server {
    listen 80;
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### 模块二：数据库建表（R08–R16）

`src/db/migrate.js` 使用 `IF NOT EXISTS` 建表，启动时自动运行。

建表顺序（注意外键依赖）：
1. `users`
2. `fishing_styles` → 插入初始数据
3. `fishing_trips`
4. `trip_fishing_styles`
5. `fish_catches`
6. `equipment_categories` → 插入初始数据
7. `equipment_library`
8. `trip_equipment`

完整 DDL 如下：

```sql
-- users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- fishing_styles
CREATE TABLE IF NOT EXISTS fishing_styles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL
);
INSERT INTO fishing_styles (name, code)
  SELECT '台钓', 'TRADITIONAL' WHERE NOT EXISTS (SELECT 1 FROM fishing_styles WHERE code='TRADITIONAL');
INSERT INTO fishing_styles (name, code)
  SELECT '路亚', 'LURE' WHERE NOT EXISTS (SELECT 1 FROM fishing_styles WHERE code='LURE');

-- fishing_trips
CREATE TABLE IF NOT EXISTS fishing_trips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(100),
  trip_date         DATE NOT NULL,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  location_name     VARCHAR(200),
  spot_id           UUID,
  weather_temp      DECIMAL(4,1),
  weather_wind      VARCHAR(50),
  weather_condition VARCHAR(50),
  companions        TEXT[],
  notes             TEXT,
  sync_status       VARCHAR(20) DEFAULT 'synced',
  local_id          UUID UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- trip_fishing_styles
CREATE TABLE IF NOT EXISTS trip_fishing_styles (
  trip_id  UUID REFERENCES fishing_trips(id) ON DELETE CASCADE,
  style_id INTEGER REFERENCES fishing_styles(id),
  PRIMARY KEY (trip_id, style_id)
);

-- fish_catches
CREATE TABLE IF NOT EXISTS fish_catches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID REFERENCES fishing_trips(id) ON DELETE CASCADE NOT NULL,
  style_id    INTEGER REFERENCES fishing_styles(id),
  species     VARCHAR(100),
  weight_g    INTEGER,
  length_cm   DECIMAL(5,1),
  count       INTEGER DEFAULT 1,
  is_released BOOLEAN DEFAULT FALSE,
  caught_at   TIMESTAMPTZ,
  notes       TEXT,
  local_id    UUID UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- equipment_categories
CREATE TABLE IF NOT EXISTS equipment_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  sort_order INTEGER DEFAULT 0
);
-- 预设分类（幂等插入）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM equipment_categories) THEN
    INSERT INTO equipment_categories (name, sort_order) VALUES
      ('鱼竿',1),('鱼轮',2),('鱼线',3),('鱼钩',4),
      ('鱼饵',5),('浮漂',6),('铅坠',7),('配件',8),('其他',9);
  END IF;
END $$;

-- equipment_library
CREATE TABLE IF NOT EXISTS equipment_library (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    INTEGER REFERENCES equipment_categories(id),
  name           VARCHAR(100) NOT NULL,
  brand          VARCHAR(100),
  model          VARCHAR(100),
  style_tags     TEXT[],
  purchase_date  DATE,
  purchase_price DECIMAL(10,2),
  status         VARCHAR(20) DEFAULT 'active',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- trip_equipment
CREATE TABLE IF NOT EXISTS trip_equipment (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID REFERENCES fishing_trips(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment_library(id),
  notes        TEXT
);
```

---

### 模块三：认证（R17–R23）

**`src/server.js` 启动初始化流程：**
1. 运行 `migrate.js`
2. 检查 `users` 表是否为空，若空则创建初始用户（bcrypt hash 密码）
3. 检查 MinIO bucket，不存在则创建
4. 注册 Fastify 插件和路由
5. 监听端口

**健康检查路由**（无需认证）：
```
GET /health → 200 { status: "ok" }
```

**认证路由**（`/api/v1/auth`）：
- `POST /login`：返回 `{ success: true, data: { token, expiresIn: "30d" } }`
- `POST /change-password`：需 JWT 认证

**JWT Middleware**（`src/middleware/auth.js`）：
- 提取 `Authorization: Bearer <token>`
- 验证失败返回 `{ success: false, error: "未授权" }`，状态码 401

---

### 模块四：出行记录（R24–R32）

**`GET /api/v1/trips` 返回结构：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "...",
      "trip_date": "2026-04-14",
      "location_name": "...",
      "styles": [{"id":1,"name":"台钓","code":"TRADITIONAL"}],
      "catch_count": 3
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 5 }
}
```

**`GET /api/v1/trips/:id` 返回结构：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "...所有字段",
    "styles": [...],
    "catches": [...],
    "equipment": [...]
  }
}
```

**`POST /api/v1/trips/sync` 逻辑：**
```js
for (const trip of trips) {
  const existing = await db.query('SELECT id FROM fishing_trips WHERE local_id=$1', [trip.local_id])
  if (existing.rows.length > 0) {
    // UPDATE
    result.push({ local_id: trip.local_id, action: 'updated', id: existing.rows[0].id })
  } else {
    // INSERT
    result.push({ local_id: trip.local_id, action: 'created', id: newId })
  }
}
```

---

### 模块五：渔获记录（R33–R36）

标准 CRUD，参数校验使用 Fastify Schema。

---

### 模块六：装备管理（R37–R43）

**`DELETE /api/v1/equipment/:id` 防删检查：**
```sql
SELECT COUNT(*) FROM trip_equipment WHERE equipment_id = $1
```
若 count > 0，返回 400：`{ success: false, error: "该装备已被出行记录引用，无法删除" }`

---

## 验证流程

每完成一个模块后执行：

```bash
docker compose up -d
bash scripts/verify.sh
```

- 绿色 PASS：继续下一模块
- 红色 FAIL：当场修复，再次运行验证，直到通过

---

## 完成标准

`bash scripts/verify.sh` 输出 **"✓ 全部通过"** 且 `REQUIREMENTS.md` 所有 44 项为 `[x]`。
