# 钓鱼志 — 开发者快速上手指南

> 目标读者：接手维护或二次开发的工程师

---

## 1. 项目总览

| 组件 | 技术 | 代码位置 |
|------|------|---------|
| iOS 客户端 | SwiftUI (iOS 17+) | `fishing-ios/` |
| 后端服务 | Node.js + Fastify | `fishing-server/` |
| 数据库 | PostgreSQL 16 + PostGIS | Docker 容器 |
| 对象存储 | MinIO | Docker named volume |
| 缓存 | Redis 7 | Docker 容器 |
| 反向代理 | Nginx | Docker 容器 |

**架构简图：**
```
iPhone App (SwiftUI + Core Data)
    │
    │ HTTP REST API (JSON)
    ▼
Nginx (:80) → Fastify (:3000) → PostgreSQL + MinIO + Redis
```

---

## 2. 本地开发环境搭建

### 2.1 前置要求

- macOS（Apple Silicon 推荐）
- Xcode 16+（含 iOS 17+ SDK）
- Docker Desktop for Mac
- Node.js 22 LTS
- XcodeGen（`brew install xcodegen`，或下载二进制到 `/tmp/xcodegen-bin/`）

### 2.2 启动后端

```bash
cd fishing-server/

# 复制环境变量
cp .env.example .env
# 编辑 .env 设置密码等

# 启动所有容器
docker compose up -d

# 查看日志
docker compose logs -f app
```

服务启动后：
- API: http://localhost:80（通过 nginx）或 http://localhost:3000（直连）
- MinIO Console: http://localhost:9001（admin/minioadmin）
- PostgreSQL: localhost:5432（fishing/fishing123）

### 2.3 启动 iOS 客户端

```bash
cd fishing-ios/

# 生成 Xcode 项目
xcodegen generate

# 用 Xcode 打开
open FishingLog.xcodeproj
```

**配置 API 地址：** 编辑 `FishingLog/Resources/Config.plist`，将 `API_BASE_URL` 改为你的后端地址。

**WeatherKit：** 需要在 Apple Developer 后台启用 WeatherKit 服务，并在 Xcode 的 Signing & Capabilities 中添加。

### 2.4 编译验证（命令行）

```bash
xcodebuild build \
  -project FishingLog.xcodeproj \
  -scheme FishingLog \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /tmp/fl-build \
  -quiet 2>&1 | tail -30
```

---

## 3. 项目结构说明

### 3.1 iOS 架构

采用 **MVVM + 离线优先** 架构：

```
View (SwiftUI)
  ↕ @Published / Binding
ViewModel (@MainActor, ObservableObject)
  ↕ async/await
Core Services (CoreDataManager, APIClient, SyncManager)
  ↕
CoreData (本地)  ←→  REST API (远端)
```

**关键设计决策：**
- 所有数据先写 CoreData，再异步同步到服务端
- `SyncManager` 监听网络状态变化，联网自动同步
- `MediaUploadManager` 独立管理媒体上传和重试
- Token 用 Keychain + UserDefaults 双重持久化（Keychain 在无签名环境可能不可靠）

### 3.2 核心文件速查

| 你要做的事 | 看哪个文件 |
|-----------|----------|
| 修改 API 接口调用 | `Core/Network/Routes/*.swift` |
| 修改数据模型 | `Core/Network/Models/*.swift` + CoreData XML |
| 修改本地存储逻辑 | `Core/CoreData/CoreDataManager.swift` |
| 修改同步逻辑 | `Core/Sync/SyncManager.swift` |
| 修改上传逻辑 | `Core/Media/MediaUploadManager.swift` |
| 修改天气获取 | `Core/Weather/WeatherService.swift` |
| 修改新建出行表单 | `Features/Trips/NewTrip/Step*.swift` |
| 修改出行详情页 | `Features/Trips/Detail/TripDetailView.swift` |
| 修改地图选点 | `Features/Trips/NewTrip/MapLocationPickerView.swift` |
| 修改视频播放 | `Features/Trips/Detail/Components/VideoPlayerView.swift` |
| 修改颜色/字体 | `DesignSystem/Colors.swift` + `Typography.swift` |
| 修改 App Icon | `Resources/Assets.xcassets/AppIcon.appiconset/` |
| 修改 API 地址 | `Resources/Config.plist` |

### 3.3 后端核心文件速查

| 你要做的事 | 看哪个文件 |
|-----------|----------|
| 修改出行 API | `src/routes/trips.js` |
| 修改媒体上传 | `src/routes/media.js` |
| 修改钓点 API | `src/routes/spots.js` |
| 修改装备 API | `src/routes/equipment.js` |
| 修改装备分类 | 直接操作生产数据库 `equipment_categories` 表 |
| 修改统计 API | `src/routes/stats.js` |
| 修改数据库表结构 | `src/db/migrate.js` |
| 修改 MinIO 配置 | `src/utils/minio.js` + `.env` |
| 修改认证逻辑 | `src/middleware/auth.js` |

---

## 4. 常见开发任务

### 4.1 给 TripEntity 添加新字段

1. **CoreData XML**：编辑 `FishingLog/Resources/FishingLog.xcdatamodeld/.../contents`，在 TripEntity 中添加 `<attribute>`
2. **CoreDataManager**：更新 `createTrip()` 和 `upsertTrip()` 方法
3. **TripModel**：在 `Trip` 结构体中添加属性 + CodingKeys + init(from decoder:)
4. **SyncManager**：在 sync payload 中添加新字段
5. **后端**：`src/db/migrate.js` 加列 + `src/routes/trips.js` 更新 schema 和 SQL
6. **生产数据库**：`ALTER TABLE fishing_trips ADD COLUMN ...`

### 4.2 添加新的 API 接口

1. **后端**：在 `src/routes/` 下对应文件添加路由
2. **iOS Model**：在 `Core/Network/Models/` 添加或修改结构体
3. **iOS Route**：在 `Core/Network/Routes/` 添加 APIClient extension 方法
4. **调用**：在 ViewModel 中调用

### 4.3 修改 UI 颜色

所有颜色定义在 `DesignSystem/Colors.swift`，使用 `Color.appBackground`、`Color.primaryGold` 等。全局深色模式在 `FishingLogApp.swift` 中设置。

### 4.4 部署到生产环境

代码通过 GitHub 同步，生产服务器已 `git clone`。

```bash
# 1. 本地 commit + push
git add -A && git commit -m "feat: xxx" && git push origin main

# 2. SSH 到生产服务器
ssh -p 11122 thomas@home.weixia.org

# 3. 拉取最新代码并重建
cd /opt/fishing-server
git pull origin main
sudo docker compose up -d --build app

# 如果改了 nginx.conf
sudo docker compose restart nginx

# 如果需要加数据库字段
docker exec fishing-server-postgres-1 psql -U fishing -d fishing -c "ALTER TABLE ..."
```

> **注意：** 生产环境的 `.env` 不在 Git 中，`git pull` 不会覆盖。如需修改环境变量，SSH 上去直接编辑。

---

## 5. 注意事项

### 必须遵守
- 所有代码注释用**中文**
- 图片上传前必须压缩（最大 1600px，JPEG 0.7）
- CoreData 操作只通过 `CoreDataManager` 进行
- 不要硬编码 API 地址（用 Config.plist）
- 不要硬编码密钥或 Token

### 踩过的坑
| 坑 | 原因 | 解决方案 |
|----|------|---------|
| MinIO 上传大文件 500 | macOS Docker VirtioFS 不支持 flock | 开发环境用 Docker named volume；生产环境挂载 NAS（`/mnt/nas/fishing`） |
| 视频无法播放 | `AVURLAssetHTTPHeaderFieldsKey` 是私有 API | 改用 presign URL，AVPlayer 直接播放 |
| 服务端日期解析失败 | PostgreSQL 返回带毫秒的 ISO8601 | 四级 fallback 解析（见 CoreDataManager.upsertTrip） |
| Keychain 存不住 Token | 无代码签名时 Keychain 静默失败 | 加 UserDefaults 兜底 |
| XcodeGen scheme 丢失 | 默认不生成 shared scheme | project.yml 中显式声明 schemes 段 |
| Xcode 26 编译失败 | `platform: iOS` 语法过时 | 改为 `supportedDestinations: [iOS]` |

---

## 6. 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 产品需求文档 | `docs/PRD.md` | 完整 PRD（v3.0） |
| iOS 项目规范 | `fishing-ios/CLAUDE.md` | iOS 代码规范 + 技术细节 |
| 服务端提示词 Phase 1 | `docs/cc-prompt-server-phase1.md` | 后端 Phase 1 实现指导 |
| 服务端提示词 Phase 2 | `docs/cc-prompt-server-phase2.md` | 后端 Phase 2 实现指导 |
| iOS 提示词 Phase 1 | `docs/cc-prompt-ios-phase1.md` | iOS Phase 1 实现指导 |
| iOS 提示词 Phase 2 | `docs/cc-prompt-ios-phase2.md` | iOS Phase 2 实现指导 |
| Phase 3 实现计划 | `fishing-ios/docs/superpowers/plans/2026-04-15-map-camera-weather.md` | 地图/拍照/天气实现计划 |
