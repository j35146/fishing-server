# Claude Code · 钓鱼志 iOS Phase 2 提示词

## 角色与目标

你是一名 iOS 工程师，正在开发「钓鱼志」App 的 SwiftUI 客户端（Phase 2）。
后端 fishing-server 已完成（Phase 1+2，75 项全部通过），iOS Phase 1（I01–I65）已全部完成。
本次任务完成 iOS **I66–I125**，共 60 项。

---

## 首要指令

1. **先读** `CLAUDE.md` 和 `REQUIREMENTS_PHASE2.md` 全文，完全理解后再开始编码
2. **按模块顺序**执行：统计 → 装备管理 → 媒体上传 → 钓点地图 → 个人中心 → 验证
3. **每完成一项**，立即将 `REQUIREMENTS_PHASE2.md` 中对应项从 `[ ]` 改为 `[x]` 并更新进度数字
4. **每完成一个模块**，运行 `bash scripts/verify.sh`，失败必须修复后才能继续
5. **禁止跳过任何项目**，每一项都必须真实实现，不得用注释 `// TODO` 代替
6. **全部完成后**运行完整 verify.sh，确保输出全部通过

---

## 工作目录

```
/Users/thomas/Desktop/Drive/AI/fishing/fishing-ios/
```

运行所有命令前先 `cd` 到此目录。

---

## 设计规范（严格遵守）

所有新 View 必须遵守以下设计系统，与 Phase 1 保持一致：

| 颜色 Token | Hex | 用途 |
|-----------|-----|------|
| `.appBackground` | #071325 | 所有页面主背景 |
| `.cardBackground` | #0D2137 | 卡片、Sheet、输入框背景 |
| `.cardElevated` | #1F2A3D | 次级卡片 / 选中态 / 浮层 |
| `.cardSurface` | #2A3548 | 最高层面板、弹窗 |
| `.primaryGold` | #E6C364 | 主按钮、CTA、重要数字、标题强调 |
| `.accentBlue` | #75D1FF | 辅色、次要指标、图标、链接 |
| `.textPrimary` | #FFFFFF | 主文字 |
| `.textSecondary` | #D7E3FC | 次要文字、描述 |
| `.textTertiary` | #B5C8E5 | 三级文字、占位符 |
| `.destructiveRed` | #EF4444 | 删除、警告 |

**布局常量**（使用 `FLMetrics`）：
- `cornerRadius` = 12
- `horizontalPadding` = 16
- `cardPadding` = 16

**强制全局深色**：`FishingLogApp.swift` 最外层已有 `.preferredColorScheme(.dark)`，无需重复设置。

---

## 后端 API 完整参考

### 认证
- `POST /api/v1/auth/login` → `{ data: { token, username } }`

### 出行
- `GET /api/v1/trips?page=&pageSize=` → 分页列表
- `POST /api/v1/trips/sync` → 批量离线同步
- `GET /api/v1/trips/:id` → 详情
- `DELETE /api/v1/trips/:id` → 删除

### 渔获
- `GET /api/v1/catches?tripId=` → 按出行查询
- `POST /api/v1/catches` → 新增渔获

### 装备
- `GET /api/v1/equipment` → 列表（支持 styleTag/status/categoryId 筛选）
- `POST /api/v1/equipment` → 新建 `{ name, brand, model, category_id, style_tags, status, purchase_date, purchase_price, notes }`
- `PUT /api/v1/equipment/:id` → 更新（同上字段，均可选）
- `DELETE /api/v1/equipment/:id` → 删除（已被出行引用时返回 400）
- `GET /api/v1/equipment/categories` → 分类列表
- `POST /api/v1/equipment/categories` → 新建分类 `{ name, sort_order }`

### 媒体
- `POST /api/v1/media/upload` → multipart/form-data，字段名 `file`；返回 `{ key, url, type, size, jobId? }`
- `GET /api/v1/media/presign/:key` → 获取预签名 URL（有效期 1 小时）
- `DELETE /api/v1/media/:key` → 删除文件
- `GET /api/v1/media/transcode/:jobId` → 转码状态查询

### 钓点
- `GET /api/v1/spots?page=&pageSize=&spot_type=&is_public=` → 列表
- `GET /api/v1/spots/nearby?lat=&lng=&radius=` → 附近钓点（radius 单位 km，默认 10）
- `POST /api/v1/spots` → 新建 `{ name, description, latitude, longitude, spot_type, is_public, photo_key }`
- `GET /api/v1/spots/:id` → 详情
- `PUT /api/v1/spots/:id` → 更新（仅本人）
- `DELETE /api/v1/spots/:id` → 删除（仅本人）

### 统计
- `GET /api/v1/stats/overview` → `{ total_trips, total_catches, total_species, total_weight_kg }`
- `GET /api/v1/stats/seasonal?year=` → `{ year, months: [{month, count}] }` 12 个月
- `GET /api/v1/stats/species` → `[{ name, count, percentage }]`（按数量降序）
- `GET /api/v1/stats/top-catches` → `[{ fish_species, weight_kg, trip_date }]` Top 10

---

## 模块十一：统计页面（I66–I76）

### StatsModel.swift

路径：`FishingLog/Core/Network/Models/StatsModel.swift`

```swift
import Foundation

// 统计概览
struct StatsOverview: Codable {
    let totalTrips: Int
    let totalCatches: Int
    let totalSpecies: Int
    let totalWeightKg: Double

    enum CodingKeys: String, CodingKey {
        case totalTrips = "total_trips"
        case totalCatches = "total_catches"
        case totalSpecies = "total_species"
        case totalWeightKg = "total_weight_kg"
    }
}

// 月度出行
struct SeasonalMonth: Codable, Identifiable {
    var id: Int { month }
    let month: Int
    let count: Int
}

struct SeasonalData: Codable {
    let year: Int
    let months: [SeasonalMonth]
}

// 鱼种分布
struct SpeciesItem: Codable, Identifiable {
    var id: String { name }
    let name: String
    let count: Int
    let percentage: Double
}

// 最大渔获
struct TopCatch: Codable, Identifiable {
    var id: String { "\(fishSpecies)-\(weightKg)" }
    let fishSpecies: String
    let weightKg: Double
    let tripDate: String

    enum CodingKeys: String, CodingKey {
        case fishSpecies = "fish_species"
        case weightKg = "weight_kg"
        case tripDate = "trip_date"
    }
}

// API 响应包装
struct StatsOverviewResponse: Codable {
    let success: Bool
    let data: StatsOverview
}

struct SeasonalResponse: Codable {
    let success: Bool
    let data: SeasonalData
}

struct SpeciesResponse: Codable {
    let success: Bool
    let data: [SpeciesItem]
}

struct TopCatchesResponse: Codable {
    let success: Bool
    let data: [TopCatch]
}
```

### StatsAPI.swift

路径：`FishingLog/Core/Network/Routes/StatsAPI.swift`

```swift
import Foundation
import Alamofire

class StatsAPI {
    static let shared = StatsAPI()
    private init() {}

    // 总览统计
    func fetchOverview() async throws -> StatsOverview {
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/stats/overview"))
            .serializingDecodable(StatsOverviewResponse.self)
            .value
        return response.data
    }

    // 季节性趋势（按年）
    func fetchSeasonal(year: Int? = nil) async throws -> SeasonalData {
        var params: Parameters = [:]
        if let year { params["year"] = year }
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/stats/seasonal"), parameters: params)
            .serializingDecodable(SeasonalResponse.self)
            .value
        return response.data
    }

    // 鱼种分布
    func fetchSpecies() async throws -> [SpeciesItem] {
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/stats/species"))
            .serializingDecodable(SpeciesResponse.self)
            .value
        return response.data
    }

    // Top 渔获
    func fetchTopCatches() async throws -> [TopCatch] {
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/stats/top-catches"))
            .serializingDecodable(TopCatchesResponse.self)
            .value
        return response.data
    }
}
```

> **注意**：`APIClient.shared.url(_:)` 是 Phase 1 已实现的辅助方法，返回拼接 baseURL 后的完整 URL。如不存在请参考 APIClient.swift 中的实现方式添加。

### StatsViewModel.swift

路径：`FishingLog/Features/Stats/StatsViewModel.swift`

```swift
import Foundation
import Combine

@MainActor
final class StatsViewModel: ObservableObject {
    @Published var overview: StatsOverview?
    @Published var seasonal: SeasonalData?
    @Published var species: [SpeciesItem] = []
    @Published var topCatches: [TopCatch] = []
    @Published var isLoading = false
    @Published var error: String?

    var selectedYear: Int = Calendar.current.component(.year, from: Date()) {
        didSet { Task { await fetchSeasonal() } }
    }

    func fetchAll() async {
        isLoading = true
        error = nil
        do {
            async let ov = StatsAPI.shared.fetchOverview()
            async let seas = StatsAPI.shared.fetchSeasonal(year: selectedYear)
            async let sp = StatsAPI.shared.fetchSpecies()
            async let tc = StatsAPI.shared.fetchTopCatches()
            (overview, seasonal, species, topCatches) = try await (ov, seas, sp, tc)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func fetchSeasonal() async {
        do {
            seasonal = try await StatsAPI.shared.fetchSeasonal(year: selectedYear)
        } catch {}
    }
}
```

### StatsView.swift

路径：`FishingLog/Features/Stats/StatsView.swift`

关键结构：
```swift
struct StatsView: View {
    @StateObject private var vm = StatsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                if vm.isLoading && vm.overview == nil {
                    ProgressView()
                        .tint(.accentBlue)
                } else if let error = vm.error, vm.overview == nil {
                    // 错误占位卡片（DestructiveRed 图标 + 错误信息 + 重试按钮）
                    ErrorPlaceholderView(message: error) {
                        Task { await vm.fetchAll() }
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            OverviewCardsView(overview: vm.overview)
                            SeasonalChartView(data: vm.seasonal, selectedYear: $vm.selectedYear)
                            SpeciesChartView(species: vm.species)
                            TopCatchListView(catches: vm.topCatches)
                        }
                        .padding(.horizontal, FLMetrics.horizontalPadding)
                        .padding(.bottom, 100) // 底部导航安全区
                    }
                }
            }
            .navigationTitle("统计")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await vm.fetchAll() }
    }
}
```

### OverviewCardsView.swift

路径：`FishingLog/Features/Stats/Components/OverviewCardsView.swift`

2×2 LazyVGrid，每个卡片：
- FLCard 背景（CardBackground）
- 数值：`.flTitle` 字体，`.primaryGold` 颜色
- 副标题：`.flCaption`，`.textSecondary` 颜色
- 四个指标：总出行 / 总渔获 / 鱼种数 / 总重量(kg)

### SeasonalChartView.swift

路径：`FishingLog/Features/Stats/Components/SeasonalChartView.swift`

```swift
import Charts
import SwiftUI

struct SeasonalChartView: View {
    let data: SeasonalData?
    @Binding var selectedYear: Int

    private let monthAbbr = ["1","2","3","4","5","6","7","8","9","10","11","12"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("月度出行趋势").font(.flHeadline).foregroundStyle(Color.textPrimary)
                Spacer()
                // 年份 Picker（当年和去年）
                Picker("年份", selection: $selectedYear) {
                    let y = Calendar.current.component(.year, from: Date())
                    Text("\(y)").tag(y)
                    Text("\(y-1)").tag(y-1)
                }
                .pickerStyle(.segmented)
                .frame(width: 140)
            }

            if let months = data?.months {
                Chart(months) { item in
                    // 面积填充（半透明 AccentBlue）
                    AreaMark(
                        x: .value("月份", monthAbbr[item.month - 1]),
                        y: .value("次数", item.count)
                    )
                    .foregroundStyle(Color.accentBlue.opacity(0.15))
                    // 折线
                    LineMark(
                        x: .value("月份", monthAbbr[item.month - 1]),
                        y: .value("次数", item.count)
                    )
                    .foregroundStyle(Color.accentBlue)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    // 数据点
                    PointMark(
                        x: .value("月份", monthAbbr[item.month - 1]),
                        y: .value("次数", item.count)
                    )
                    .foregroundStyle(Color.accentBlue)
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel().foregroundStyle(Color.textTertiary)
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel().foregroundStyle(Color.textTertiary)
                        AxisGridLine().foregroundStyle(Color.cardElevated)
                    }
                }
                .frame(height: 160)
            } else {
                // 骨架占位
                RoundedRectangle(cornerRadius: FLMetrics.cornerRadius)
                    .fill(Color.cardElevated)
                    .frame(height: 160)
            }
        }
        .padding(FLMetrics.cardPadding)
        .background(Color.cardBackground)
        .cornerRadius(FLMetrics.cornerRadius)
    }
}
```

### SpeciesChartView.swift

路径：`FishingLog/Features/Stats/Components/SpeciesChartView.swift`

使用 Swift Charts `SectorMark`（iOS 17+）绘制饼图：
- 前5种显示图例（名称 + 百分比）
- 超出5种合并为"其他"
- 无数据时显示"暂无渔获记录"占位

### TopCatchListView.swift

路径：`FishingLog/Features/Stats/Components/TopCatchListView.swift`

最多展示5条，每条：
- 左侧排名数字（PrimaryGold，粗体）
- 鱼种名称（TextPrimary）
- 右侧重量 kg（PrimaryGold，大字号）+ 日期（TextTertiary，小字）

---

## 模块十二：装备管理完整（I77–I90）

### EquipmentModel.swift 扩展字段

在现有 `EquipmentModel.swift` 中补充或修改 `EquipmentItem`：

```swift
struct EquipmentItem: Codable, Identifiable {
    let id: Int
    let name: String
    let brand: String?
    let model: String?
    let categoryId: Int?
    let categoryName: String?
    let styleTags: [String]?
    let status: String?          // "active" | "inactive" | "maintenance"
    let purchaseDate: String?
    let purchasePrice: Double?
    let notes: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, brand, model, notes
        case categoryId = "category_id"
        case categoryName = "category_name"
        case styleTags = "style_tags"
        case status
        case purchaseDate = "purchase_date"
        case purchasePrice = "purchase_price"
        case createdAt = "created_at"
    }
}

struct CreateEquipmentRequest: Encodable {
    let name: String
    let brand: String?
    let model: String?
    let categoryId: Int?
    let styleTags: [String]?
    let status: String?
    let purchaseDate: String?
    let purchasePrice: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case name, brand, model, notes
        case categoryId = "category_id"
        case styleTags = "style_tags"
        case status
        case purchaseDate = "purchase_date"
        case purchasePrice = "purchase_price"
    }
}

typealias UpdateEquipmentRequest = CreateEquipmentRequest
```

### EquipmentAPI.swift 扩展

在现有 `EquipmentAPI.swift` 中新增：

```swift
// 新建装备
func createEquipment(_ req: CreateEquipmentRequest) async throws -> EquipmentItem {
    let response = try await APIClient.shared.session
        .request(
            APIClient.shared.url("/api/v1/equipment"),
            method: .post,
            parameters: req,
            encoder: JSONParameterEncoder.default
        )
        .serializingDecodable(EquipmentItemResponse.self)
        .value
    return response.data
}

// 更新装备
func updateEquipment(id: Int, _ req: UpdateEquipmentRequest) async throws -> EquipmentItem {
    let response = try await APIClient.shared.session
        .request(
            APIClient.shared.url("/api/v1/equipment/\(id)"),
            method: .put,
            parameters: req,
            encoder: JSONParameterEncoder.default
        )
        .serializingDecodable(EquipmentItemResponse.self)
        .value
    return response.data
}

// 删除装备
func deleteEquipment(id: Int) async throws {
    try await APIClient.shared.session
        .request(
            APIClient.shared.url("/api/v1/equipment/\(id)"),
            method: .delete
        )
        .serializingDecodable(BaseResponse.self)
        .value
}
```

> `EquipmentItemResponse` 和 `BaseResponse` 需确保已定义（`{ success: Bool, data: EquipmentItem }` 和 `{ success: Bool }`）。

### GearListViewModel.swift

路径：`FishingLog/Features/Equipment/GearListViewModel.swift`

```swift
@MainActor
final class GearListViewModel: ObservableObject {
    @Published var equipments: [EquipmentItem] = []
    @Published var categories: [EquipmentCategory] = []
    @Published var selectedCategoryId: Int? = nil   // nil = 全部
    @Published var isLoading = false
    @Published var error: String?

    func refresh() async {
        isLoading = true
        error = nil
        do {
            async let cats = EquipmentAPI.shared.fetchCategories()
            async let equip = EquipmentAPI.shared.fetchEquipment(categoryId: selectedCategoryId)
            (categories, equipments) = try await (cats, equip)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func deleteEquipment(id: Int) async {
        do {
            try await EquipmentAPI.shared.deleteEquipment(id: id)
            equipments.removeAll { $0.id == id }
            // 同时删除 CoreData 缓存
            CoreDataManager.shared.deleteEquipmentById(id: id)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
```

### GearListView.swift

路径：`FishingLog/Features/Equipment/GearListView.swift`

关键结构：
- NavigationStack，背景 `.appBackground`
- navigationTitle("装备库")
- toolbar：右上角 `+` 按钮（sheet 弹出 NewEquipmentView）
- 分类 Tab 横向滚动（ScrollView(.horizontal)）：
  - "全部" + 各分类名称
  - 选中态：背景 `.primaryGold`，文字 `.on-primary`（深色）
  - 未选中：背景 `.cardElevated`，文字 `.textSecondary`
  - 胶囊样式 `.cornerRadius(99)`
- 下方 LazyVStack 装备卡片列表
- `.refreshable { await vm.refresh() }`
- `.task { await vm.refresh() }`
- 切换分类时重新 fetch

### GearCardView.swift

路径：`FishingLog/Features/Equipment/Components/GearCardView.swift`

```swift
struct GearCardView: View {
    let item: EquipmentItem
    var onEdit: () -> Void
    var onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // 左侧图标区（SF Symbol wrench.fill，cardElevated 背景）
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.cardElevated)
                .frame(width: 56, height: 56)
                .overlay(
                    Image(systemName: "wrench.fill")
                        .foregroundStyle(Color.accentBlue)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.flHeadline)
                    .foregroundStyle(Color.textPrimary)

                if let brand = item.brand, let model = item.model {
                    Text("\(brand) · \(model)")
                        .font(.flCaption)
                        .foregroundStyle(Color.textSecondary)
                } else if let brand = item.brand {
                    Text(brand).font(.flCaption).foregroundStyle(Color.textSecondary)
                }

                HStack(spacing: 6) {
                    // 分类标签
                    if let cat = item.categoryName {
                        TagBadge(text: cat, color: .accentBlue)
                    }
                    // 状态徽章
                    StatusBadge(status: item.status ?? "active")
                }
            }

            Spacer()
        }
        .padding(FLMetrics.cardPadding)
        .background(Color.cardBackground)
        .cornerRadius(FLMetrics.cornerRadius)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { onDelete() } label: {
                Label("删除", systemImage: "trash")
            }
            Button { onEdit() } label: {
                Label("编辑", systemImage: "pencil")
            }
            .tint(.accentBlue)
        }
    }
}

// 状态徽章
struct StatusBadge: View {
    let status: String
    var body: some View {
        let (text, color): (String, Color) = switch status {
            case "active": ("在用", .green)
            case "maintenance": ("维修中", .orange)
            default: ("停用", .gray)
        }
        Text(text)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.2))
            .cornerRadius(4)
    }
}
```

### NewEquipmentView.swift & EditEquipmentView.swift

路径：`FishingLog/Features/Equipment/NewEquipmentView.swift` 和 `EditEquipmentView.swift`

**NewEquipmentView** 表单字段（均使用 FLTextField 或系统 Picker）：
- 名称（必填，FLTextField）
- 品牌（可选，FLTextField）
- 型号（可选，FLTextField）
- 分类（Picker，从 `categories` 加载，选项包含"未分类"）
- 状态（Picker："在用" active / "停用" inactive / "维修中" maintenance）
- 购买日期（DatePicker，可选，displayedComponents: .date）
- 购买价格（数字键盘 TextField，可选）
- 备注（TextEditor，可选，最小高度 80）

保存逻辑：
```swift
func save() async {
    let req = CreateEquipmentRequest(
        name: name, brand: brand.isEmpty ? nil : brand,
        model: model.isEmpty ? nil : model,
        categoryId: selectedCategoryId,
        styleTags: nil, status: status,
        purchaseDate: purchaseDate, purchasePrice: price,
        notes: notes.isEmpty ? nil : notes
    )
    do {
        let item = try await EquipmentAPI.shared.createEquipment(req)
        CoreDataManager.shared.insertEquipment(item)
        dismiss()
    } catch { self.error = error.localizedDescription }
}
```

**EditEquipmentView**：接收 `item: EquipmentItem` 参数，预填所有字段，保存调 `updateEquipment(id:_:)`。

---

## 模块十三：媒体上传（I91–I103）

### MediaModel.swift

路径：`FishingLog/Core/Network/Models/MediaModel.swift`

```swift
struct MediaItem: Codable, Identifiable {
    let id: String          // MinIO key 作为 id
    let key: String
    let url: String
    let type: String        // "image" | "video"
    let size: Int?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case key, url, type, size
        case id = "key"
        case createdAt = "created_at"
    }
}

struct UploadResult: Codable {
    let key: String
    let url: String
    let type: String
    let size: Int
    let jobId: String?
}

struct UploadResultResponse: Codable {
    let success: Bool
    let data: UploadResult
}

struct PresignResponse: Codable {
    let success: Bool
    let data: PresignData
    struct PresignData: Codable {
        let url: String
    }
}
```

### MediaAPI.swift

路径：`FishingLog/Core/Network/Routes/MediaAPI.swift`

```swift
import Foundation
import Alamofire

class MediaAPI {
    static let shared = MediaAPI()
    private init() {}

    // 上传媒体文件（multipart）
    func uploadMedia(data: Data, mimeType: String, fileName: String) async throws -> UploadResult {
        let response = try await APIClient.shared.session
            .upload(
                multipartFormData: { form in
                    form.append(data, withName: "file",
                                fileName: fileName,
                                mimeType: mimeType)
                },
                to: APIClient.shared.url("/api/v1/media/upload")
            )
            .serializingDecodable(UploadResultResponse.self)
            .value
        return response.data
    }

    // 获取预签名 URL
    func getPresignedUrl(key: String) async throws -> String {
        let encodedKey = key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/media/presign/\(encodedKey)"))
            .serializingDecodable(PresignResponse.self)
            .value
        return response.data.url
    }

    // 删除媒体
    func deleteMedia(key: String) async throws {
        let encodedKey = key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key
        try await APIClient.shared.session
            .request(
                APIClient.shared.url("/api/v1/media/\(encodedKey)"),
                method: .delete
            )
            .serializingDecodable(BaseResponse.self)
            .value
    }
}
```

### MediaEntity（Core Data）

在 `FishingLog.xcdatamodeld` 添加 `MediaEntity`：

| 属性 | 类型 | 说明 |
|------|------|------|
| id | String | 服务端 key |
| localId | UUID | 本地唯一 ID |
| tripId | String | 关联出行的服务端 ID |
| tripLocalId | UUID | 关联出行的本地 ID（用于离线关联） |
| key | String | MinIO 对象 key |
| url | String | 预签名 URL（可能过期） |
| type | String | "image" / "video" |
| syncStatus | String | "pending" / "synced" / "failed" |
| createdAt | Date | 创建时间 |

### MediaUploadManager.swift

路径：`FishingLog/Core/Media/MediaUploadManager.swift`

```swift
import Foundation
import Combine

@MainActor
final class MediaUploadManager: ObservableObject {
    static let shared = MediaUploadManager()
    private init() {}

    @Published var isUploading = false
    @Published var uploadProgress: Double = 0
    @Published var lastError: String?

    // 上传单张图片，关联本地出行 ID
    func uploadImage(_ imageData: Data, tripLocalId: UUID) async {
        isUploading = true
        uploadProgress = 0
        lastError = nil

        let fileName = "photo-\(UUID().uuidString).jpg"

        do {
            let result = try await MediaAPI.shared.uploadMedia(
                data: imageData, mimeType: "image/jpeg", fileName: fileName
            )
            // 写入 CoreData
            CoreDataManager.shared.upsertMedia(MediaSaveRequest(
                key: result.key,
                url: result.url,
                type: result.type,
                tripLocalId: tripLocalId,
                syncStatus: "synced"
            ))
            uploadProgress = 1.0
        } catch {
            lastError = error.localizedDescription
            // 写入失败状态
            CoreDataManager.shared.upsertMedia(MediaSaveRequest(
                key: fileName,
                url: "",
                type: "image",
                tripLocalId: tripLocalId,
                syncStatus: "failed"
            ))
        }
        isUploading = false
    }

    // 批量上传
    func uploadImages(_ items: [(data: Data, tripLocalId: UUID)]) async {
        for item in items {
            await uploadImage(item.data, tripLocalId: item.tripLocalId)
        }
    }

    // 重试失败的媒体
    func retryFailed() async {
        let failedItems = CoreDataManager.shared.fetchFailedMedia()
        for item in failedItems {
            guard let data = try? Data(contentsOf: URL(string: item.url ?? "") ?? URL(fileURLWithPath: "")) else { continue }
            await uploadImage(data, tripLocalId: item.tripLocalId ?? UUID())
        }
    }
}

struct MediaSaveRequest {
    let key: String
    let url: String
    let type: String
    let tripLocalId: UUID
    let syncStatus: String
}
```

### PhotoPickerView.swift

路径：`FishingLog/Features/Media/PhotoPickerView.swift`

使用 `PhotosUI`（iOS 16+）：
```swift
import PhotosUI
import SwiftUI

struct PhotoPickerView: View {
    @Binding var selectedItems: [PhotosPickerItem]
    var maxSelectionCount: Int = 9

    var body: some View {
        PhotosPicker(
            selection: $selectedItems,
            maxSelectionCount: maxSelectionCount,
            matching: .images
        ) {
            Label("添加照片", systemImage: "photo.on.rectangle.angled")
                .font(.flBody)
                .foregroundStyle(Color.accentBlue)
        }
    }
}
```

### Step4SummaryView.swift 修改

在现有 Step4 基础上增加照片区域：
```swift
// 已选照片缩略图网格
if !selectedImages.isEmpty {
    LazyVGrid(columns: Array(repeating: .init(.fixed(80)), count: 3), spacing: 8) {
        ForEach(0..<selectedImages.count, id: \.self) { i in
            Image(uiImage: selectedImages[i])
                .resizable().scaledToFill()
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}
PhotoPickerView(selectedItems: $selectedItems)
```

完成保存时上传：
```swift
// 保存后触发上传
let tripLocalId = savedTrip.localId
Task {
    await MediaUploadManager.shared.uploadImages(
        imageDataArray.map { ($0, tripLocalId) }
    )
}
```

### TripMediaGridView.swift

路径：`FishingLog/Features/Trips/Detail/Components/TripMediaGridView.swift`

```swift
struct TripMediaGridView: View {
    let tripLocalId: UUID
    @State private var mediaItems: [MediaEntity] = []
    @State private var selectedIndex: Int? = nil

    var body: some View {
        if mediaItems.isEmpty { EmptyView() } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("出行相册")
                        .font(.flHeadline).foregroundStyle(Color.textPrimary)
                    Spacer()
                    Text("\(mediaItems.count) 张")
                        .font(.flCaption).foregroundStyle(Color.textTertiary)
                }
                LazyVGrid(columns: Array(repeating: .init(.flexible()), count: 3), spacing: 4) {
                    ForEach(Array(mediaItems.enumerated()), id: \.offset) { index, item in
                        AsyncImage(url: URL(string: item.url ?? "")) { img in
                            img.resizable().scaledToFill()
                        } placeholder: {
                            Color.cardElevated
                        }
                        .frame(height: 100)
                        .clipped()
                        .onTapGesture { selectedIndex = index }
                    }
                }
            }
            .fullScreenCover(item: $selectedIndex) { index in
                FullScreenImageView(items: mediaItems, startIndex: index)
            }
            .onAppear {
                mediaItems = CoreDataManager.shared.fetchMedia(for: tripLocalId)
            }
        }
    }
}
```

### FullScreenImageView.swift

路径：`FishingLog/Features/Media/FullScreenImageView.swift`

- `TabView`（.page 样式）横滑切换图片
- `AsyncImage` 加载每张图
- `MagnificationGesture` 支持双指缩放（scale 范围 1.0–4.0）
- 顶部右上角关闭按钮（xmark.circle.fill，`.textPrimary`）
- 背景纯黑 `Color.black.ignoresSafeArea()`
- 底部页数指示（当前/总数，TextTertiary）

---

## 模块十四：钓点地图（I104–I116）

### SpotModel.swift

路径：`FishingLog/Core/Network/Models/SpotModel.swift`

```swift
import Foundation
import CoreLocation

struct Spot: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let spotType: String?
    let isPublic: Bool?
    let photoUrl: String?
    let photoKey: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, latitude, longitude
        case spotType = "spot_type"
        case isPublic = "is_public"
        case photoUrl = "photo_url"
        case photoKey = "photo_key"
        case createdAt = "created_at"
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

enum SpotType: String, CaseIterable, Identifiable {
    case river, lake, reservoir, sea, other
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .river: "河流"
        case .lake: "湖泊"
        case .reservoir: "水库"
        case .sea: "海钓"
        case .other: "其他"
        }
    }
}

struct CreateSpotRequest: Encodable {
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let spotType: String
    let isPublic: Bool
    let photoKey: String?

    enum CodingKeys: String, CodingKey {
        case name, description, latitude, longitude
        case spotType = "spot_type"
        case isPublic = "is_public"
        case photoKey = "photo_key"
    }
}

struct SpotListResponse: Codable {
    let success: Bool
    let data: [Spot]
}

struct SpotDetailResponse: Codable {
    let success: Bool
    let data: Spot
}
```

### SpotAPI.swift

路径：`FishingLog/Core/Network/Routes/SpotAPI.swift`

```swift
class SpotAPI {
    static let shared = SpotAPI()
    private init() {}

    func fetchSpots(page: Int = 1, spotType: String? = nil) async throws -> [Spot] {
        var params: Parameters = ["page": page, "pageSize": 50]
        if let t = spotType { params["spot_type"] = t }
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/spots"), parameters: params)
            .serializingDecodable(SpotListResponse.self).value
        return response.data
    }

    func fetchNearbySpots(lat: Double, lng: Double, radius: Double = 10) async throws -> [Spot] {
        let params: Parameters = ["lat": lat, "lng": lng, "radius": radius]
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/spots/nearby"), parameters: params)
            .serializingDecodable(SpotListResponse.self).value
        return response.data
    }

    func createSpot(_ req: CreateSpotRequest) async throws -> Spot {
        let response = try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/spots"),
                     method: .post, parameters: req,
                     encoder: JSONParameterEncoder.default)
            .serializingDecodable(SpotDetailResponse.self).value
        return response.data
    }

    func deleteSpot(id: Int) async throws {
        try await APIClient.shared.session
            .request(APIClient.shared.url("/api/v1/spots/\(id)"),
                     method: .delete)
            .serializingDecodable(BaseResponse.self).value
    }
}
```

### SpotsViewModel.swift

路径：`FishingLog/Features/Spots/SpotsViewModel.swift`

```swift
import Foundation
import CoreLocation
import Combine

@MainActor
final class SpotsViewModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var spots: [Spot] = []
    @Published var userLocation: CLLocationCoordinate2D?
    @Published var isLoading = false
    @Published var error: String?
    @Published var displayMode: DisplayMode = .map  // .map | .list

    enum DisplayMode { case map, list }

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.requestWhenInUseAuthorization()
    }

    func refresh() async {
        isLoading = true
        error = nil
        do {
            if let loc = userLocation {
                spots = try await SpotAPI.shared.fetchNearbySpots(
                    lat: loc.latitude, lng: loc.longitude, radius: 50
                )
            } else {
                spots = try await SpotAPI.shared.fetchSpots()
            }
            CoreDataManager.shared.upsertSpots(spots)
        } catch {
            self.error = error.localizedDescription
            // 降级到本地缓存
            spots = CoreDataManager.shared.fetchSpots().map { $0.toSpot() }
        }
        isLoading = false
    }

    func addSpot(_ req: CreateSpotRequest) async {
        do {
            let spot = try await SpotAPI.shared.createSpot(req)
            spots.insert(spot, at: 0)
            CoreDataManager.shared.upsertSpots([spot])
        } catch { self.error = error.localizedDescription }
    }

    func deleteSpot(id: Int) async {
        do {
            try await SpotAPI.shared.deleteSpot(id: id)
            spots.removeAll { $0.id == id }
            CoreDataManager.shared.deleteSpotById(id: id)
        } catch { self.error = error.localizedDescription }
    }

    // CLLocationManagerDelegate
    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            self.userLocation = loc.coordinate
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestLocation()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didFailWithError error: Error) {}
}
```

### SpotsView.swift

路径：`FishingLog/Features/Spots/SpotsView.swift`

```swift
struct SpotsView: View {
    @StateObject private var vm = SpotsViewModel()
    @State private var showNewSpot = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: 0) {
                    // 地图/列表切换
                    Picker("视图", selection: $vm.displayMode) {
                        Text("地图").tag(SpotsViewModel.DisplayMode.map)
                        Text("列表").tag(SpotsViewModel.DisplayMode.list)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, FLMetrics.horizontalPadding)
                    .padding(.vertical, 8)

                    if vm.displayMode == .map {
                        SpotMapView(spots: vm.spots, userLocation: vm.userLocation)
                            .ignoresSafeArea(edges: .bottom)
                    } else {
                        SpotListView(vm: vm)
                    }
                }
            }
            .navigationTitle("钓点")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showNewSpot = true } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Color.primaryGold)
                    }
                }
            }
            .sheet(isPresented: $showNewSpot) {
                NewSpotView(vm: vm)
            }
        }
        .task { await vm.refresh() }
    }
}
```

### SpotMapView.swift

路径：`FishingLog/Features/Spots/SpotMapView.swift`

```swift
import MapKit

struct SpotMapView: View {
    let spots: [Spot]
    let userLocation: CLLocationCoordinate2D?

    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position) {
            // 用户位置
            UserAnnotation()

            // 钓点 Annotation
            ForEach(spots) { spot in
                Annotation(spot.name, coordinate: spot.coordinate) {
                    SpotAnnotationView(spot: spot)
                }
            }
        }
        .mapStyle(.hybrid(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .onAppear {
            if let loc = userLocation {
                position = .region(MKCoordinateRegion(
                    center: loc,
                    latitudinalMeters: 20000,
                    longitudinalMeters: 20000
                ))
            }
        }
    }
}
```

### SpotAnnotationView.swift

路径：`FishingLog/Features/Spots/Components/SpotAnnotationView.swift`

```swift
struct SpotAnnotationView: View {
    let spot: Spot
    @State private var showCallout = false

    var body: some View {
        Button { showCallout.toggle() } label: {
            ZStack {
                Circle()
                    .fill(Color.accentBlue)
                    .frame(width: 32, height: 32)
                    .shadow(color: Color.accentBlue.opacity(0.5), radius: 6)
                Image(systemName: spotIcon(spot.spotType))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .popover(isPresented: $showCallout) {
            // Callout：名称/类型/距离（简洁浮层）
            SpotCalloutView(spot: spot)
        }
    }

    private func spotIcon(_ type: String?) -> String {
        switch type {
        case "river": return "water.waves"
        case "lake": return "drop.fill"
        case "reservoir": return "building.2.fill"
        case "sea": return "sailboat.fill"
        default: return "location.fill"
        }
    }
}
```

### NewSpotView.swift

路径：`FishingLog/Features/Spots/NewSpotView.swift`

表单字段：
- 名称（必填 FLTextField）
- 类型（Picker：河流/湖泊/水库/海钓/其他）
- 描述（TextEditor，可选）
- 是否公开（Toggle）
- 坐标选点（小地图 + 长按 Pin 选点，或直接填写经纬度 TextField）
- 保存按钮（调 `vm.addSpot()`）

---

## 模块十五：个人中心（I117–I123）

### ProfileViewModel.swift

路径：`FishingLog/Features/Profile/ProfileViewModel.swift`

```swift
@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var username: String = ""
    @Published var totalTrips: Int = 0
    @Published var totalCatches: Int = 0

    init() {
        // 从 UserDefaults 读取登录时保存的用户名
        username = UserDefaults.standard.string(forKey: "current_username") ?? "钓友"
        // 从 CoreData 读取本地统计（快速展示，无需 API）
        totalTrips = CoreDataManager.shared.fetchTrips().count
        totalCatches = CoreDataManager.shared.fetchAllCatches().count
    }

    func logout() {
        AuthManager.shared.logout()
    }
}
```

> **注意**：`AuthManager.login()` 成功后需将 `username` 写入 `UserDefaults.standard.set(username, forKey: "current_username")`。如 Phase 1 未写入，在 `AuthManager.login()` 中补充。

### ProfileView.swift

路径：`FishingLog/Features/Profile/ProfileView.swift`

布局：
1. 顶部头像区：`person.circle.fill` SF Symbol（AccentBlue，60pt）+ 用户名（.flTitle）
2. 统计行：两个小卡片并排（总出行 / 总渔获），FLCard 样式，数值 PrimaryGold
3. 设置列表（List，.plain 样式，background 透明）：
   - "服务器设置" → SettingsView
   - "关于钓鱼志" → AboutView
4. 底部"退出登录"按钮（DestructiveRed，FLButton 样式）

### SettingsView.swift

路径：`FishingLog/Features/Profile/SettingsView.swift`

- API 地址展示（从 Config.plist 读取当前值）
- TextField 允许修改（写入 `UserDefaults.standard.set(url, forKey: "api_base_url_override")`）
- **注意**：`APIClient` 需在 baseURL 读取逻辑中优先读取 `UserDefaults` 的 override 值，若无则读 Config.plist
- 保存后提示"下次启动生效"（或立即重置 `APIClient` session）

### AboutView.swift

路径：`FishingLog/Features/Profile/AboutView.swift`

- App 名称"钓鱼志"（.flTitle，PrimaryGold）
- 版本号（从 Bundle 读取 `CFBundleShortVersionString`）
- 简介文字（TextSecondary）
- 技术栈列表（SwiftUI / Core Data / Alamofire / Swift Charts）

---

## 模块十六：验证与收尾（I124–I125）

### verify.sh 更新

在现有 `scripts/verify.sh` 中追加 Phase 2 关键文件检查：

```bash
# ===== Phase 2 文件检查 =====
check_file "FishingLog/Features/Stats/StatsView.swift"
check_file "FishingLog/Features/Stats/StatsViewModel.swift"
check_file "FishingLog/Core/Network/Models/StatsModel.swift"
check_file "FishingLog/Features/Equipment/GearListView.swift"
check_file "FishingLog/Features/Equipment/GearListViewModel.swift"
check_file "FishingLog/Features/Equipment/NewEquipmentView.swift"
check_file "FishingLog/Core/Network/Models/MediaModel.swift"
check_file "FishingLog/Core/Media/MediaUploadManager.swift"
check_file "FishingLog/Features/Media/FullScreenImageView.swift"
check_file "FishingLog/Core/Network/Models/SpotModel.swift"
check_file "FishingLog/Features/Spots/SpotsView.swift"
check_file "FishingLog/Features/Spots/SpotMapView.swift"
check_file "FishingLog/Features/Spots/SpotsViewModel.swift"
check_file "FishingLog/Features/Profile/ProfileView.swift"
check_file "FishingLog/Features/Profile/SettingsView.swift"
```

---

## 关键注意事项

### project.yml 依赖更新

Phase 2 新增框架（系统框架无需 SPM，直接 `import`）：
- `Charts`（Swift Charts，iOS 16+，系统内置，无需 SPM）
- `MapKit`（系统内置）
- `PhotosUI`（系统内置）
- `CoreLocation`（系统内置）

确认 `project.yml` 的 `Info.plist` properties 中包含：
```yaml
NSLocationWhenInUseUsageDescription: "用于显示附近钓点"
NSPhotoLibraryUsageDescription: "选取照片添加到出行记录"
NSCameraUsageDescription: "拍摄钓鱼照片"
```

### Core Data Migration

EquipmentEntity 和新增 MediaEntity / SpotEntity 需要创建新的 Model Version：
1. Editor → Add Model Version（命名 `FishingLog 2`）
2. 在新版本中添加字段 / Entity
3. 设置 Current Version 为 `FishingLog 2`
4. `CoreDataManager` 使用 `.NSMigratePersistentStoresAutomaticallyOption: true`（轻量级迁移）

### APIClient url() 方法

如 Phase 1 未实现 `url(_:)` 辅助方法，在 `APIClient.swift` 中添加：

```swift
func url(_ path: String) -> String {
    return baseURL + path
}
```

### BaseResponse 模型

如未定义，添加：
```swift
struct BaseResponse: Codable {
    let success: Bool
}
```

### MainTabView 最终状态

Phase 2 完成后，5 个 Tab 均有真实页面：
```swift
TabView {
    TripsListView().tabItem { Label("日志", systemImage: "book.fill") }
    StatsView().tabItem { Label("统计", systemImage: "chart.bar.fill") }
    GearListView().tabItem { Label("装备", systemImage: "wrench.and.screwdriver.fill") }
    SpotsView().tabItem { Label("钓点", systemImage: "map.fill") }
    ProfileView().tabItem { Label("我的", systemImage: "person.fill") }
}
.tint(.primaryGold)
.toolbarBackground(Color(hex: "#101c2e").opacity(0.9), for: .tabBar)
.toolbarBackground(.visible, for: .tabBar)
```

---

## 编译验证命令

```bash
# Phase 2 完成后运行
cd /Users/thomas/Desktop/Drive/AI/fishing/fishing-ios

# 重新生成项目
xcodegen generate

# 编译验证
xcodebuild build \
  -project FishingLog/FishingLog.xcodeproj \
  -scheme FishingLog \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/fl-build \
  CODE_SIGNING_ALLOWED=NO \
  -quiet 2>&1 | tail -30

# 文件验证
bash scripts/verify.sh
```

---

## 完成标准

1. `bash scripts/verify.sh` 输出全部 ✓（无 ✗）
2. `xcodebuild` 零 error（warning 可忽略）
3. `REQUIREMENTS_PHASE2.md` 底部进度显示 **60 / 60 项已完成**
4. `CLAUDE.md` 当前阶段更新为"iOS Phase 2 已完成"
