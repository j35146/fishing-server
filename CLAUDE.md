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
| 对象存储 | MinIO |
| 部署 | Docker Compose |
| 认证 | JWT（30天有效期） |

## 项目结构

```
fishing-server/
  ├── CLAUDE.md               ← 本文件，每次必读
  ├── REQUIREMENTS.md         ← 功能清单，完成一项更新一项
  ├── scripts/
  │   └── verify.sh           ← 验证脚本，每个里程碑后必须运行
  ├── src/
  │   ├── app.js              ← Fastify 实例 + 插件注册
  │   ├── server.js           ← 入口，监听端口
  │   ├── config.js           ← 读取环境变量
  │   ├── db/
  │   │   ├── index.js        ← PostgreSQL 连接
  │   │   └── migrate.js      ← 建表脚本
  │   ├── routes/
  │   │   ├── auth.js
  │   │   ├── trips.js
  │   │   ├── catches.js
  │   │   └── equipment.js
  │   ├── middleware/
  │   │   └── auth.js         ← JWT 验证中间件
  │   └── utils/
  │       └── jwt.js
  ├── docker-compose.yml
  ├── Dockerfile
  ├── .env.example
  └── package.json
```

## 代码规范

- 所有注释使用**中文**
- 错误响应格式：`{ "success": false, "error": "描述" }`
- 成功响应格式：`{ "success": true, "data": ... }`
- 分页响应格式：`{ "success": true, "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 100 } }`
- 每个路由必须有 Fastify Schema 做参数校验
- 敏感配置只能通过 `.env` 注入，禁止硬编码

## 常用命令

```bash
# 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f app

# 停止服务
docker compose down

# 运行验证脚本
bash scripts/verify.sh

# 进入数据库
docker compose exec postgres psql -U fishing -d fishing
```

## 当前阶段

**Phase 1**：后端基础框架

范围内：Docker 环境、数据库建表、用户认证、出行/渔获/装备 CRUD  
范围外：媒体上传、钓点、统计、分享、导出

## 工作流程（必须遵守）

1. 每完成 REQUIREMENTS.md 中的一项，立即将其从 `[ ]` 改为 `[x]`
2. 每完成一个模块（认证/出行/渔获/装备），运行一次 `bash scripts/verify.sh`
3. 若 verify.sh 有失败项，必须修复后再继续下一个模块
4. 所有任务完成后，运行完整 verify.sh，确保全部通过

## 环境变量说明

参考 `.env.example`，开发时复制为 `.env` 使用。
首次启动时系统会自动用 `INIT_USERNAME` / `INIT_PASSWORD` 创建初始用户。
