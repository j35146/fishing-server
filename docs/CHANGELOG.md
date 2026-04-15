# 钓鱼志 — 开发变更日志

> 记录各开发阶段的 Agent 分工和变更内容

---

## Agent 1：服务端 Phase 1（R01–R44）

**日期：** 2026-04-14
**范围：** 后端基础框架搭建

**完成内容：**
- Docker Compose 编排（PostgreSQL + Redis + MinIO + Nginx + App）
- 数据库建表（users, fishing_styles, fishing_trips, fish_catches, equipment_categories, equipment_library, trip_equipment, trip_fishing_styles）
- 用户认证（JWT 登录、中间件）
- 出行 CRUD API（含批量同步接口 /trips/sync）
- 渔获 CRUD API
- 装备 CRUD API（含分类管理）
- 验证脚本 verify.sh

**产出文件：** `fishing-server/` 全部初始代码

---

## Agent 2：服务端 Phase 2（R45–R75）

**日期：** 2026-04-14
**范围：** 媒体上传 + 钓点 + 统计

**完成内容：**
- MinIO S3 客户端封装（双客户端：内部上传 + 外部 presign）
- 媒体上传接口（multipart，支持图片/视频）
- FFmpeg HLS 转码（视频异步处理）
- 钓点 CRUD API（含 Haversine 附近搜索）
- 统计 API（overview/seasonal/species/top-catches）
- spots 表创建（PostGIS 支持）

**产出文件：** `src/routes/media.js`, `src/routes/spots.js`, `src/routes/stats.js`, `src/utils/minio.js`, `src/utils/transcode.js`

---

## Agent 3：iOS Phase 1 + Phase 2（I01–I125）

**日期：** 2026-04-14
**范围：** iOS 客户端完整功能

### Phase 1（I01–I65）
- 项目初始化（XcodeGen + SwiftUI）
- 设计系统（深色主题、颜色/字体/组件）
- 登录（Keychain Token 存储）
- 出行列表/详情/新建（4步表单）
- 渔获录入
- 装备选择
- Core Data 离线存储
- 自动同步（SyncManager + NWPathMonitor）

### Phase 2（I66–I125）
- 统计图表（Swift Charts：overview/seasonal/species/top-catches）
- 装备管理完整版（CRUD + 台钓/路亚分类）
- 媒体上传（照片选取 + Alamofire multipart）
- 钓点地图模块（MapKit + 列表/地图双视图）
- 个人中心（设置/关于）
- 全屏图片浏览

**产出文件：** `fishing-ios/FishingLog/` 全部初始代码（约 60 个 Swift 文件）

---

## Agent 4：Bug 修复 + Phase 3 功能（当前 Agent）

**日期：** 2026-04-15
**范围：** 生产环境部署调试 + 3 个新功能 + 文档完善

### Bug 修复（6 项）

| Bug | 根因 | 修复方案 |
|-----|------|---------|
| 照片上传 HTTP 500 | macOS Docker VirtioFS bind mount 不支持 MinIO flock | MinIO 改用 Docker named volume |
| 日期显示"未知日期" | 服务端返回带毫秒 ISO8601，客户端拼接解析失败 | 四级 fallback 日期解析 |
| 出行记录无法删除 | API 删除失败 throw 跳过本地 CoreData 删除 | `try await` → `try? await` |
| 杀进程后需重新登录 | Keychain 在无签名环境静默失败 | 加 UserDefaults 兜底存储 |
| 视频无法播放 | AVURLAssetHTTPHeaderFieldsKey 私有 API 不稳定 | 改用 presign URL 直接播放 |
| 视频缩略图不显示 | 视频数据无法 UIImage(data:) | 视频用占位图标替代 |

### 生产环境适配

| 改动 | 说明 |
|------|------|
| Config.plist API 地址 | 172.16.5.106 → home.weixia.org:35146 |
| nginx client_max_body_size | 50M → 500M |
| JWT 有效期 | 30d → 3650d（10 年） |
| 401 自动登出 | 移除（单用户不需要） |
| media/file 代理接口 | 部署到生产服务器 |
| App Icon | 添加 1024×1024 图标到 Assets.xcassets |

### Phase 3 新功能

**功能 1：地图选点**
- `MapLocationPickerView.swift` — 全屏地图搜索 + 点击选点 + 反向地理编码
- `Step1BasicInfoView.swift` — 地点改为手动输入 + 地图选坐标 + 自动获取名称
- `TripDetailView.swift` — 有坐标时展示内嵌小地图
- 服务端 `fishing_trips` 表 + sync 接口支持 latitude/longitude
- CoreData TripEntity 新增 latitude/longitude/spotId 属性

**功能 2：拍照/录像 + 视频播放**
- `CameraPickerView.swift` — UIImagePickerController 包装（拍照/录像）
- `Step4SummaryView.swift` — 菜单式媒体添加（拍照/录像/相册，支持图片+视频）
- `VideoPlayerView.swift` — 全屏视频播放器（presign URL + AVPlayer）
- `TripMediaGridView.swift` — 视频项显示占位图标 + 播放按钮
- `MediaUploadManager.swift` — 泛化为支持任意媒体类型
- `NewTripViewModel.swift` — TripMediaItem 模型替代 photoDataArray
- `project.yml` — 添加 NSMicrophoneUsageDescription

**功能 3：WeatherKit 天气自动获取**
- `WeatherService.swift` — WeatherKit 封装（当日实时 + 历史日级天气）
- `NewTripViewModel.fetchWeather()` — 根据坐标和日期获取天气
- `Step1BasicInfoView.swift` — 天气卡片增加"自动获取"按钮
- `FishingLog.entitlements` — WeatherKit capability
- `project.yml` — CODE_SIGN_ENTITLEMENTS 配置

**功能 4：媒体分享**
- `FullScreenImageView.swift` — 左上角分享按钮，下载原图后系统分享
- `VideoPlayerView.swift` — 左上角分享按钮，下载视频到临时文件后分享
- `ShareSheet` — UIActivityViewController 包装（共用组件）

### 装备库优化
- `EquipmentModel.swift` — 新增 `styleTag` 属性（大写，匹配数据库 style_tags）
- `EquipmentAPI.swift` — fetchEquipment 增加 styleTag 参数
- `GearListViewModel.swift` — 按大类（台钓/路亚）筛选装备，修复"全部"显示所有装备的 bug
- `EquipmentDetailView.swift` — 新建装备详情页（名称、品牌、型号、购入日期/价格、备注、编辑入口）
- `GearListView.swift` — 卡片包 NavigationLink，点击进入详情页
- 购入日期仅显示日期（支持 ISO8601/yyyy-MM-dd 多格式解析）
- 生产数据库：删除浮漂(id=2)和路亚包(id=9)分类，台钓/路亚各新增"其它"分类
- 生产数据库：批量导入 33 条装备数据（CSV → SQL）

### 其他改动
- `Step2CatchesView.swift` — 渔获数量从 Stepper 改为手动输入
- `project.yml` — `platform: iOS` → `supportedDestinations: [iOS]`（兼容 Xcode 26）
- `project.yml` — 添加显式 schemes 配置 + 移除 CODE_SIGNING_ALLOWED: NO

### 文档更新
- `fishing-ios/CLAUDE.md` — 全面更新（Phase 3 功能 + CoreData 模型 + 生产环境信息）
- `fishing-server/CLAUDE.md` — 全面更新（完整 API 列表 + Phase 3 变更 + 生产环境信息）
- `docs/PRD.md` — v2.0 → v3.0（颜色值 + 数据库 + 媒体方案 + 阶段状态）
- `docs/DEVELOPMENT.md` — 新建（开发者快速上手指南）
- `docs/CHANGELOG.md` — 新建（本文件，4 个 Agent 完整变更记录）
