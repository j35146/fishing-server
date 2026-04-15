# Claude Code · 钓鱼志 iOS Phase 1 提示词

## 角色与目标

你是一名 iOS 工程师，正在开发「钓鱼志」App 的 SwiftUI 客户端（Phase 1）。
后端 fishing-server 已完成（Phase 1+2，75 项全部通过）。
本次任务完成 iOS **I01–I65**，共 65 项。

---

## 首要指令

1. **先读** `CLAUDE.md` 和 `REQUIREMENTS.md` 全文，完全理解后再开始编码
2. **按模块顺序**执行：基础 → 设计系统 → 认证 → 网络层 → Core Data → 列表 → 新建 → 详情 → 同步 → 验证
3. **每完成一项**，立即将 `REQUIREMENTS.md` 中对应项从 `[ ]` 改为 `[x]` 并更新进度数字
4. **每完成一个模块**，运行 `bash scripts/verify.sh`，失败必须修复后才能继续
5. **全部完成后**运行完整 verify.sh，确保输出"✓ 全部通过"

---

## 模块一：项目基础（I01–I08）

### 1.1 安装 XcodeGen

```bash
which xcodegen || brew install xcodegen
```

### 1.2 project.yml

在 `fishing-ios/` 根目录创建：

```yaml
name: FishingLog
options:
  bundleIdPrefix: com.jiangfeng
  deploymentTarget:
    iOS: "17.0"
  xcodeVersion: "15.4"
  defaultConfig: Debug
  createIntermediateGroups: true

configs:
  Debug: debug
  Release: release

settings:
  base:
    SWIFT_VERSION: "5.9"
    ENABLE_PREVIEWS: YES

packages:
  Alamofire:
    url: https://github.com/Alamofire/Alamofire
    from: "5.9.0"

targets:
  FishingLog:
    type: application
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: FishingLog
        excludes:
          - "**/.DS_Store"
    resources:
      - path: FishingLog/Resources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.jiangfeng.fishinglog
        INFOPLIST_FILE: FishingLog/Resources/Info.plist
        TARGETED_DEVICE_FAMILY: "1"
        DEVELOPMENT_TEAM: ""
        CODE_SIGNING_ALLOWED: NO
    dependencies:
      - package: Alamofire
    info:
      path: FishingLog/Resources/Info.plist
      properties:
        CFBundleDisplayName: 钓鱼志
        NSCameraUsageDescription: 拍摄钓鱼照片和视频
        NSPhotoLibraryUsageDescription: 选取照片添加到出行记录
        NSPhotoLibraryAddUsageDescription: 保存钓鱼照片到相册
        UILaunchScreen:
          UIColorName: ""
```

### 1.3 Info.plist 与 Config.plist

**`FishingLog/Resources/Info.plist`**（project.yml 会自动生成，只需创建空文件占位即可）

**`FishingLog/Resources/Config.plist`**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>API_BASE_URL</key>
    <string>http://localhost</string>
</dict>
</plist>
```

### 1.4 FishingLogApp.swift

```swift
import SwiftUI

@main
struct FishingLogApp: App {
    // 注入全局依赖
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var coreDataManager = CoreDataManager.shared
    @StateObject private var syncManager = SyncManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(coreDataManager)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { _, newPhase in
                    // I64: 进入前台触发同步
                    if newPhase == .active && authManager.isLoggedIn {
                        syncManager.syncIfNeeded()
                    }
                }
        }
    }
}
```

### 1.5 生成项目

```bash
cd /Users/thomas/Desktop/Drive/AI/fishing/fishing-ios
xcodegen generate
```

---

## 模块二：设计系统（I09–I14）

### Colors.swift

```swift
import SwiftUI

extension Color {
    // 背景层
    static let appBackground   = Color(hex: "#071325")  // 深海蓝黑主背景
    static let cardBackground  = Color(hex: "#0D2137")  // 卡片主背景
    static let cardElevated    = Color(hex: "#1F2A3D")  // 卡片次级（选中/浮层）
    static let cardSurface     = Color(hex: "#2A3548")  // 最高层（弹窗/底栏）
    // 主色 / 辅色（以 Stitch 设计稿为准）
    static let primaryGold     = Color(hex: "#E6C364")  // 金色主色（CTA/重要数字/标题）
    static let accentBlue      = Color(hex: "#75D1FF")  // 浅蓝辅色（次要数据/图标/链接）
    // 文字
    static let textPrimary     = Color(hex: "#FFFFFF")
    static let textSecondary   = Color(hex: "#D7E3FC")  // 次要文字（浅蓝白）
    static let textTertiary    = Color(hex: "#B5C8E5")  // 三级文字（更淡）
    // 功能色
    static let destructiveRed  = Color(hex: "#EF4444")

    // Hex 初始化器
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// 尺寸常量
enum FLMetrics {
    static let cornerRadius: CGFloat = 12
    static let horizontalPadding: CGFloat = 16
    static let cardPadding: CGFloat = 16
}
```

### Typography.swift

```swift
import SwiftUI

extension Font {
    static let flTitle     = Font.system(size: 28, weight: .bold)
    static let flHeadline  = Font.system(size: 17, weight: .semibold)
    static let flBody      = Font.system(size: 15, weight: .regular)
    static let flCaption   = Font.system(size: 12, weight: .regular)
    static let flLabel     = Font.system(size: 13, weight: .medium)
}
```

### FLCard.swift

```swift
import SwiftUI

struct FLCard<Content: View>: View {
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .padding(FLMetrics.cardPadding)
            .background(Color.cardBackground)
            .cornerRadius(FLMetrics.cornerRadius)
    }
}
```

### FLButton.swift

```swift
import SwiftUI

struct FLPrimaryButton: View {
    let title: String
    let isLoading: Bool
    let action: () -> Void

    init(_ title: String, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading { ProgressView().tint(.white) }
                Text(title).font(.flHeadline).foregroundColor(.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.primaryGold)
            .cornerRadius(FLMetrics.cornerRadius)
        }
        .disabled(isLoading)
    }
}

struct FLSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).font(.flHeadline).foregroundColor(.textPrimary)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color.cardBackground)
                .cornerRadius(FLMetrics.cornerRadius)
                .overlay(RoundedRectangle(cornerRadius: FLMetrics.cornerRadius)
                    .stroke(Color.textSecondary.opacity(0.3), lineWidth: 1))
        }
    }
}
```

### FLTextField.swift

```swift
import SwiftUI

struct FLTextField: View {
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        TextField(placeholder, text: $text)
            .keyboardType(keyboardType)
            .foregroundColor(.textPrimary)
            .padding(12)
            .background(Color.cardBackground)
            .cornerRadius(FLMetrics.cornerRadius)
            .overlay(RoundedRectangle(cornerRadius: FLMetrics.cornerRadius)
                .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1))
    }
}
```

### SyncBadge.swift

```swift
import SwiftUI

enum SyncStatus: String {
    case synced  = "synced"
    case pending = "pending"
    case failed  = "failed"

    var icon: String {
        switch self {
        case .synced:  return "checkmark.circle.fill"
        case .pending: return "arrow.triangle.2.circlepath.circle.fill"
        case .failed:  return "exclamationmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .synced:  return .green
        case .pending: return .accentBlue
        case .failed:  return .destructiveRed
        }
    }
}

struct SyncBadge: View {
    let status: SyncStatus

    var body: some View {
        Image(systemName: status.icon)
            .foregroundColor(status.color)
            .font(.system(size: 14))
    }
}
```

---

## 模块三：认证（I15–I21）

### KeychainManager.swift

```swift
import Foundation
import Security

final class KeychainManager {
    static let shared = KeychainManager()
    private let tokenKey = "com.jiangfeng.fishinglog.token"

    func saveToken(_ token: String) {
        let data = token.data(using: .utf8)!
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: tokenKey,
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func getToken() -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: tokenKey,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func deleteToken() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: tokenKey
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

### AuthManager.swift

```swift
import Foundation
import Combine

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()
    @Published var isLoggedIn: Bool = false

    private init() {
        // 启动时检查 Keychain 中是否有有效 token
        isLoggedIn = KeychainManager.shared.getToken() != nil
    }

    func login(username: String, password: String) async throws {
        let token = try await APIClient.shared.login(username: username, password: password)
        KeychainManager.shared.saveToken(token)
        isLoggedIn = true
    }

    func logout() {
        KeychainManager.shared.deleteToken()
        isLoggedIn = false
    }
}
```

### LoginView.swift

参考设计稿 `abyssal_glass/screen.png`，深海暗色风格：

```swift
import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: 32) {
                // Logo 区
                VStack(spacing: 8) {
                    Image(systemName: "figure.fishing")
                        .font(.system(size: 64))
                        .foregroundColor(.accentBlue)
                    Text("钓鱼志").font(.flTitle).foregroundColor(.textPrimary)
                    Text("记录每一次出行").font(.flBody).foregroundColor(.textSecondary)
                }
                .padding(.top, 80)

                // 表单区
                VStack(spacing: 16) {
                    FLTextField(placeholder: "用户名", text: $username)
                    SecureFieldFL(placeholder: "密码", text: $password)
                }
                .padding(.horizontal, FLMetrics.horizontalPadding)

                // 登录按钮
                FLPrimaryButton("登录", isLoading: isLoading) {
                    Task { await performLogin() }
                }
                .padding(.horizontal, FLMetrics.horizontalPadding)

                Spacer()
            }
        }
        .alert("登录失败", isPresented: .constant(errorMessage != nil)) {
            Button("确认") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func performLogin() async {
        guard !username.isEmpty, !password.isEmpty else {
            errorMessage = "请输入用户名和密码"; return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await authManager.login(username: username, password: password)
        } catch {
            errorMessage = "用户名或密码错误"
        }
    }
}

// SecureField 包装，保持样式一致
struct SecureFieldFL: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        SecureField(placeholder, text: $text)
            .foregroundColor(.textPrimary)
            .padding(12)
            .background(Color.cardBackground)
            .cornerRadius(FLMetrics.cornerRadius)
            .overlay(RoundedRectangle(cornerRadius: FLMetrics.cornerRadius)
                .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1))
            .padding(.horizontal, 0)
    }
}
```

### ContentView.swift + MainTabView.swift

```swift
// ContentView.swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        if authManager.isLoggedIn {
            MainTabView()
        } else {
            LoginView()
        }
    }
}

// MainTabView.swift
import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            TripsListView()
                .tabItem { Label("日志", systemImage: "book.fill") }

            PlaceholderView(title: "统计", icon: "chart.bar.fill")
                .tabItem { Label("统计", systemImage: "chart.bar.fill") }

            PlaceholderView(title: "装备", icon: "wrench.and.screwdriver.fill")
                .tabItem { Label("装备", systemImage: "wrench.and.screwdriver.fill") }

            PlaceholderView(title: "钓点", icon: "map.fill")
                .tabItem { Label("钓点", systemImage: "map.fill") }

            PlaceholderView(title: "我的", icon: "person.fill")
                .tabItem { Label("我的", systemImage: "person.fill") }
        }
        .accentColor(.primaryGold)
        .tint(.primaryGold)
    }
}

// 占位页
struct PlaceholderView: View {
    let title: String
    let icon: String

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 48))
                    .foregroundColor(.textSecondary)
                Text(title).font(.flHeadline).foregroundColor(.textSecondary)
                Text("敬请期待").font(.flCaption).foregroundColor(.textSecondary.opacity(0.6))
            }
        }
    }
}
```

---

## 模块四：网络层（I22–I28）

### APIClient.swift

```swift
import Foundation
import Alamofire

final class APIClient {
    static let shared = APIClient()

    private let baseURL: String
    private lazy var session: Session = {
        let interceptor = AuthInterceptor()
        return Session(interceptor: interceptor)
    }()

    private init() {
        // 从 Config.plist 读取 base URL
        if let path = Bundle.main.path(forResource: "Config", ofType: "plist"),
           let dict = NSDictionary(contentsOfFile: path),
           let url = dict["API_BASE_URL"] as? String {
            baseURL = url
        } else {
            baseURL = "http://localhost"
        }
    }

    // MARK: - 通用请求
    func request<T: Decodable>(
        _ path: String,
        method: HTTPMethod = .get,
        parameters: Parameters? = nil,
        encoding: ParameterEncoding = JSONEncoding.default
    ) async throws -> T {
        let url = "\(baseURL)/api/v1\(path)"
        return try await withCheckedThrowingContinuation { continuation in
            session.request(url, method: method, parameters: parameters, encoding: encoding)
                .validate()
                .responseDecodable(of: APIResponse<T>.self) { response in
                    switch response.result {
                    case .success(let apiResponse):
                        if let data = apiResponse.data {
                            continuation.resume(returning: data)
                        } else {
                            continuation.resume(throwing: AppError.serverError("无数据"))
                        }
                    case .failure(let error):
                        if response.response?.statusCode == 401 {
                            Task { await AuthManager.shared.logout() }
                            continuation.resume(throwing: AppError.unauthorized)
                        } else {
                            continuation.resume(throwing: AppError.networkError(error.localizedDescription))
                        }
                    }
                }
        }
    }

    // MARK: - 登录（无需 token）
    func login(username: String, password: String) async throws -> String {
        let url = "\(baseURL)/api/v1/auth/login"
        struct LoginResponse: Decodable { let token: String }
        return try await withCheckedThrowingContinuation { continuation in
            AF.request(url, method: .post,
                       parameters: ["username": username, "password": password],
                       encoding: JSONEncoding.default)
                .validate()
                .responseDecodable(of: APIResponse<LoginResponse>.self) { response in
                    switch response.result {
                    case .success(let r):
                        if let token = r.data?.token {
                            continuation.resume(returning: token)
                        } else {
                            continuation.resume(throwing: AppError.serverError("Token 为空"))
                        }
                    case .failure:
                        continuation.resume(throwing: AppError.unauthorized)
                    }
                }
        }
    }
}

// MARK: - 统一响应结构
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: String?
}

// MARK: - Token 自动注入
final class AuthInterceptor: RequestInterceptor {
    func adapt(_ urlRequest: URLRequest, for session: Session,
               completion: @escaping (Result<URLRequest, Error>) -> Void) {
        var request = urlRequest
        if let token = KeychainManager.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        completion(.success(request))
    }
}
```

### APIError.swift

```swift
import Foundation

enum AppError: LocalizedError {
    case unauthorized
    case notFound
    case serverError(String)
    case networkError(String)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .unauthorized:       return "未授权，请重新登录"
        case .notFound:           return "资源不存在"
        case .serverError(let m): return "服务器错误：\(m)"
        case .networkError(let m):return "网络错误：\(m)"
        case .decodingError:      return "数据解析失败"
        }
    }
}
```

### Models

**TripModel.swift**
```swift
import Foundation

struct Trip: Codable, Identifiable {
    let id: String
    let localId: String?
    let title: String?
    let tripDate: String        // "YYYY-MM-DD"
    let locationName: String?
    let weatherTemp: Double?
    let weatherWind: String?
    let weatherCondition: String?
    let companions: [String]?
    let notes: String?
    let syncStatus: String?
    let styles: [FishingStyle]?
    let catches: [FishCatch]?
    let catchCount: Int?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, notes, styles, catches
        case localId = "local_id"
        case tripDate = "trip_date"
        case locationName = "location_name"
        case weatherTemp = "weather_temp"
        case weatherWind = "weather_wind"
        case weatherCondition = "weather_condition"
        case companions
        case syncStatus = "sync_status"
        case catchCount = "catch_count"
        case updatedAt = "updated_at"
    }
}

struct FishCatch: Codable, Identifiable {
    let id: String
    let localId: String?
    let tripId: String?
    let species: String?
    let weightG: Int?
    let lengthCm: Double?
    let count: Int?
    let isReleased: Bool?
    let styleCode: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, species, count, notes
        case localId    = "local_id"
        case tripId     = "trip_id"
        case weightG    = "weight_g"
        case lengthCm   = "length_cm"
        case isReleased = "is_released"
        case styleCode  = "style_code"
    }
}

struct FishingStyle: Codable, Identifiable {
    let id: Int
    let name: String
    let code: String
}
```

**EquipmentModel.swift**
```swift
import Foundation

struct Equipment: Codable, Identifiable {
    let id: String
    let name: String
    let brand: String?
    let model: String?
    let categoryName: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, name, brand, model, status
        case categoryName = "category_name"
    }
}

struct EquipmentCategory: Codable, Identifiable {
    let id: Int
    let name: String
}
```

### TripAPI.swift

```swift
import Foundation

extension APIClient {
    // 分页获取出行列表
    func fetchTrips(page: Int = 1, pageSize: Int = 50) async throws -> [Trip] {
        struct PagedData: Decodable { let list: [Trip]? ; let items: [Trip]? }
        let result: PagedData = try await request(
            "/trips?page=\(page)&pageSize=\(pageSize)",
            method: .get,
            parameters: nil,
            encoding: URLEncoding.default
        )
        return result.list ?? result.items ?? []
    }

    // 批量同步
    func syncTrips(_ items: [[String: Any]]) async throws -> [[String: Any]] {
        struct SyncResult: Decodable { let results: [[String: AnyCodable]]? }
        // 直接用 Alamofire 发送，绕过泛型限制
        let url = "\(baseURL)/api/v1/trips/sync"
        return try await withCheckedThrowingContinuation { continuation in
            session.request(url, method: .post,
                            parameters: ["trips": items],
                            encoding: JSONEncoding.default)
                .validate()
                .responseJSON { response in
                    switch response.result {
                    case .success(let json):
                        if let dict = json as? [String: Any],
                           let data = dict["data"] as? [[String: Any]] {
                            continuation.resume(returning: data)
                        } else {
                            continuation.resume(returning: [])
                        }
                    case .failure(let error):
                        continuation.resume(throwing: AppError.networkError(error.localizedDescription))
                    }
                }
        }
    }

    // 删除出行
    func deleteTrip(id: String) async throws {
        let _: EmptyResponse = try await request("/trips/\(id)", method: .delete)
    }
}

struct EmptyResponse: Decodable {}
```

### EquipmentAPI.swift

```swift
import Foundation

extension APIClient {
    func fetchEquipment() async throws -> [Equipment] {
        struct EqList: Decodable { let list: [Equipment]?; let items: [Equipment]? }
        let result: EqList = try await request("/equipment?pageSize=200", method: .get,
                                               parameters: nil, encoding: URLEncoding.default)
        return result.list ?? result.items ?? []
    }

    func fetchCategories() async throws -> [EquipmentCategory] {
        return try await request("/equipment/categories", method: .get,
                                 parameters: nil, encoding: URLEncoding.default)
    }
}
```

---

## 模块五：Core Data（I29–I35）

### FishingLog.xcdatamodeld

在 `FishingLog/Resources/FishingLog.xcdatamodeld/` 目录下创建 `.xccurrentversion` 和 `FishingLog.xcdatamodel/contents`：

**FishingLog.xcdatamodel/contents**（XML 格式）：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<model type="com.apple.IDECoreDataModeler.DataModel" documentVersion="1.0"
       lastSavedToolsVersion="21513" systemVersion="22A380"
       minimumToolsVersion="Automatic" sourceLanguage="Swift" usedWithSwiftData="NO"
       userDefinedModelVersionIdentifier="">

    <!-- TripEntity -->
    <entity name="TripEntity" representedClassName="TripEntity" syncable="YES">
        <attribute name="id"               optional="NO" attributeType="String"/>
        <attribute name="localId"          optional="YES" attributeType="UUID"/>
        <attribute name="title"            optional="YES" attributeType="String"/>
        <attribute name="tripDate"         optional="NO"  attributeType="Date" usesScalarValueType="NO"/>
        <attribute name="locationName"     optional="YES" attributeType="String"/>
        <attribute name="weatherTemp"      optional="YES" attributeType="Double" usesScalarValueType="YES"/>
        <attribute name="weatherWind"      optional="YES" attributeType="String"/>
        <attribute name="weatherCondition" optional="YES" attributeType="String"/>
        <attribute name="companions"       optional="YES" attributeType="Transformable"
                   valueTransformerName="NSSecureUnarchiveFromData" customClassName="[String]"/>
        <attribute name="notes"            optional="YES" attributeType="String"/>
        <attribute name="syncStatus"       optional="NO"  attributeType="String" defaultValueString="pending"/>
        <attribute name="styleIds"         optional="YES" attributeType="String"/>
        <attribute name="styleNames"       optional="YES" attributeType="String"/>
        <attribute name="updatedAt"        optional="YES" attributeType="Date" usesScalarValueType="NO"/>
        <attribute name="createdAt"        optional="YES" attributeType="Date" usesScalarValueType="NO"/>
        <relationship name="catches" optional="YES" toMany="YES"
                      deletionRule="Cascade" destinationEntity="CatchEntity"
                      inverseName="trip" inverseEntity="CatchEntity"/>
    </entity>

    <!-- CatchEntity -->
    <entity name="CatchEntity" representedClassName="CatchEntity" syncable="YES">
        <attribute name="id"         optional="NO"  attributeType="String"/>
        <attribute name="localId"    optional="YES" attributeType="UUID"/>
        <attribute name="species"    optional="YES" attributeType="String"/>
        <attribute name="weightG"    optional="YES" attributeType="Integer 32" usesScalarValueType="YES"/>
        <attribute name="lengthCm"   optional="YES" attributeType="Double" usesScalarValueType="YES"/>
        <attribute name="count"      optional="NO"  attributeType="Integer 16" defaultValueString="1" usesScalarValueType="YES"/>
        <attribute name="isReleased" optional="NO"  attributeType="Boolean" defaultValueString="NO" usesScalarValueType="YES"/>
        <attribute name="styleCode"  optional="YES" attributeType="String"/>
        <attribute name="notes"      optional="YES" attributeType="String"/>
        <attribute name="createdAt"  optional="YES" attributeType="Date" usesScalarValueType="NO"/>
        <relationship name="trip" optional="YES" maxCount="1"
                      deletionRule="Nullify" destinationEntity="TripEntity"
                      inverseName="catches" inverseEntity="TripEntity"/>
    </entity>

    <!-- EquipmentEntity -->
    <entity name="EquipmentEntity" representedClassName="EquipmentEntity" syncable="YES">
        <attribute name="id"           optional="NO"  attributeType="String"/>
        <attribute name="name"         optional="NO"  attributeType="String"/>
        <attribute name="brand"        optional="YES" attributeType="String"/>
        <attribute name="model"        optional="YES" attributeType="String"/>
        <attribute name="categoryName" optional="YES" attributeType="String"/>
        <attribute name="status"       optional="YES" attributeType="String"/>
    </entity>

    <!-- StyleEntity -->
    <entity name="StyleEntity" representedClassName="StyleEntity" syncable="YES">
        <attribute name="id"   optional="NO"  attributeType="Integer 16" usesScalarValueType="YES"/>
        <attribute name="name" optional="NO"  attributeType="String"/>
        <attribute name="code" optional="NO"  attributeType="String"/>
    </entity>

</model>
```

**.xccurrentversion**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>_XCCurrentVersionName</key>
    <string>FishingLog.xcdatamodel</string>
</dict>
</plist>
```

### CoreDataManager.swift

```swift
import CoreData
import Foundation

@MainActor
final class CoreDataManager: ObservableObject {
    static let shared = CoreDataManager()

    lazy var container: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "FishingLog")
        container.loadPersistentStores { _, error in
            if let error { fatalError("Core Data 加载失败：\(error)") }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        return container
    }()

    var context: NSManagedObjectContext { container.viewContext }

    // MARK: - 保存
    func saveContext() {
        guard context.hasChanges else { return }
        try? context.save()
    }

    // MARK: - Trip CRUD
    func fetchTrips() -> [TripEntity] {
        let req = TripEntity.fetchRequest()
        req.sortDescriptors = [NSSortDescriptor(key: "tripDate", ascending: false)]
        return (try? context.fetch(req)) ?? []
    }

    func fetchPendingTrips() -> [TripEntity] {
        let req = TripEntity.fetchRequest()
        req.predicate = NSPredicate(format: "syncStatus == %@", "pending")
        return (try? context.fetch(req)) ?? []
    }

    func upsertTrip(from trip: Trip) {
        let req = TripEntity.fetchRequest()
        req.predicate = NSPredicate(format: "id == %@", trip.id)
        let entity = (try? context.fetch(req))?.first ?? TripEntity(context: context)
        entity.id           = trip.id
        entity.localId      = trip.localId.flatMap { UUID(uuidString: $0) }
        entity.title        = trip.title
        entity.locationName = trip.locationName
        entity.syncStatus   = "synced"
        entity.notes        = trip.notes
        if let dateStr = trip.tripDate as String? {
            entity.tripDate = ISO8601DateFormatter().date(from: dateStr + "T00:00:00Z")
                           ?? parseDateString(dateStr)
        }
        entity.styleNames = trip.styles?.map(\.name).joined(separator: ",")
        entity.styleIds   = trip.styles?.map { String($0.id) }.joined(separator: ",")
        saveContext()
    }

    func createTrip(localId: UUID, date: Date, locationName: String?,
                    title: String?, styleIds: String, styleNames: String,
                    weatherTemp: Double?, weatherCondition: String?,
                    companions: [String], notes: String?) -> TripEntity {
        let entity = TripEntity(context: context)
        entity.id           = localId.uuidString   // 临时用 localId 作为 id
        entity.localId      = localId
        entity.tripDate     = date
        entity.locationName = locationName
        entity.title        = title
        entity.styleIds     = styleIds
        entity.styleNames   = styleNames
        entity.weatherTemp  = weatherTemp ?? 0
        entity.weatherCondition = weatherCondition
        entity.companions   = companions as NSObject
        entity.notes        = notes
        entity.syncStatus   = "pending"
        entity.createdAt    = Date()
        entity.updatedAt    = Date()
        saveContext()
        return entity
    }

    func deleteTrip(_ entity: TripEntity) {
        context.delete(entity)
        saveContext()
    }

    // MARK: - Catch CRUD
    func fetchCatches(for trip: TripEntity) -> [CatchEntity] {
        let req = CatchEntity.fetchRequest()
        req.predicate = NSPredicate(format: "trip == %@", trip)
        return (try? context.fetch(req)) ?? []
    }

    func createCatch(trip: TripEntity, species: String, weightG: Int,
                     lengthCm: Double, count: Int, isReleased: Bool,
                     styleCode: String?, notes: String?) -> CatchEntity {
        let entity = CatchEntity(context: context)
        entity.id         = UUID().uuidString
        entity.localId    = UUID()
        entity.species    = species
        entity.weightG    = Int32(weightG)
        entity.lengthCm   = lengthCm
        entity.count      = Int16(count)
        entity.isReleased = isReleased
        entity.styleCode  = styleCode
        entity.notes      = notes
        entity.createdAt  = Date()
        entity.trip       = trip
        saveContext()
        return entity
    }

    func deleteCatch(_ entity: CatchEntity) {
        context.delete(entity)
        saveContext()
    }

    // MARK: - Equipment 缓存
    func upsertEquipments(_ equipments: [Equipment]) {
        equipments.forEach { eq in
            let req = EquipmentEntity.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", eq.id)
            let entity = (try? context.fetch(req))?.first ?? EquipmentEntity(context: context)
            entity.id           = eq.id
            entity.name         = eq.name
            entity.brand        = eq.brand
            entity.model        = eq.model
            entity.categoryName = eq.categoryName
            entity.status       = eq.status
        }
        saveContext()
    }

    func fetchEquipments() -> [EquipmentEntity] {
        let req = EquipmentEntity.fetchRequest()
        req.predicate = NSPredicate(format: "status == %@ OR status == nil", "active")
        req.sortDescriptors = [NSSortDescriptor(key: "categoryName", ascending: true),
                               NSSortDescriptor(key: "name", ascending: true)]
        return (try? context.fetch(req)) ?? []
    }

    // MARK: - 工具方法
    private func parseDateString(_ str: String) -> Date? {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: str)
    }
}
```

---

## 模块六：出行列表（I36–I42）

### TripsListViewModel.swift

```swift
import Foundation
import Combine

@MainActor
final class TripsListViewModel: ObservableObject {
    @Published var trips: [TripEntity] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let coreData = CoreDataManager.shared

    func loadLocal() {
        trips = coreData.fetchTrips()
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let remote = try await APIClient.shared.fetchTrips()
            remote.forEach { coreData.upsertTrip(from: $0) }
            trips = coreData.fetchTrips()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

### TripsListView.swift

参考设计稿 `home_blue_final/screen.png`：

```swift
import SwiftUI

struct TripsListView: View {
    @StateObject private var viewModel = TripsListViewModel()
    @State private var showNewTrip = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if viewModel.trips.isEmpty && !viewModel.isLoading {
                    EmptyTripsView { showNewTrip = true }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.trips, id: \.id) { trip in
                                NavigationLink(destination: TripDetailView(trip: trip)) {
                                    TripCardView(trip: trip)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, FLMetrics.horizontalPadding)
                        .padding(.top, 8)
                    }
                    .refreshable { await viewModel.refresh() }
                }
            }
            .navigationTitle("钓鱼志")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showNewTrip = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.primaryGold)
                    }
                }
            }
            .sheet(isPresented: $showNewTrip) {
                NewTripView { await viewModel.refresh() }
            }
            .task { viewModel.loadLocal(); await viewModel.refresh() }
        }
    }
}

// 空状态
struct EmptyTripsView: View {
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "fish").font(.system(size: 64))
                .foregroundColor(.textSecondary.opacity(0.4))
            Text("还没有出行记录").font(.flHeadline).foregroundColor(.textSecondary)
            Text("点击下方按钮记录你的第一次出行").font(.flBody).foregroundColor(.textSecondary.opacity(0.7))
            FLPrimaryButton("立即新建", action: onNew).frame(width: 200)
        }
        .padding(.horizontal, 40)
    }
}
```

### TripCardView.swift

参考设计稿 `home_blue_final/screen.png` 卡片样式：

```swift
import SwiftUI

struct TripCardView: View {
    let trip: TripEntity

    private var displayDate: String {
        guard let date = trip.tripDate else { return "未知日期" }
        let fmt = DateFormatter(); fmt.dateStyle = .medium; fmt.locale = Locale(identifier: "zh_CN")
        return fmt.string(from: date)
    }

    private var styleTagNames: [String] {
        (trip.styleNames ?? "").split(separator: ",").map(String.init)
    }

    private var syncStatus: SyncStatus {
        SyncStatus(rawValue: trip.syncStatus ?? "pending") ?? .pending
    }

    var body: some View {
        FLCard {
            VStack(alignment: .leading, spacing: 10) {
                // 顶部：日期 + 同步状态
                HStack {
                    Text(displayDate).font(.flCaption).foregroundColor(.textSecondary)
                    Spacer()
                    SyncBadge(status: syncStatus)
                }

                // 地点
                Text(trip.locationName ?? "未记录地点")
                    .font(.flHeadline).foregroundColor(.textPrimary)
                    .lineLimit(1)

                // 钓法标签 + 渔获数
                HStack(spacing: 8) {
                    ForEach(styleTagNames, id: \.self) { tag in
                        Text(tag).font(.flCaption).foregroundColor(.appBackground)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.accentBlue)
                            .cornerRadius(6)
                    }
                    Spacer()
                    let catchCount = trip.catches?.count ?? 0
                    Label("\(catchCount) 尾", systemImage: "fish.fill")
                        .font(.flCaption).foregroundColor(.textSecondary)
                }
            }
        }
    }
}
```

---

## 模块七：新建出行（I43–I51）

### NewTripViewModel.swift

```swift
import Foundation
import Combine

@MainActor
final class NewTripViewModel: ObservableObject {
    // 步骤控制
    @Published var currentStep = 0

    // Step1 数据
    @Published var tripDate = Date()
    @Published var selectedStyleCodes: Set<String> = []   // "TRADITIONAL" / "LURE"
    @Published var locationName = ""
    @Published var title = ""
    @Published var weatherTemp = ""
    @Published var weatherCondition = ""
    @Published var companions = ""

    // Step2 渔获
    @Published var catches: [NewCatchForm] = []

    // Step3 装备
    @Published var availableEquipments: [EquipmentEntity] = []
    @Published var selectedEquipmentIds: Set<String> = []

    // 状态
    @Published var isSaving = false
    @Published var errorMessage: String?

    var step1Valid: Bool { !selectedStyleCodes.isEmpty }

    func loadEquipments() async {
        // 先从缓存读，再从网络更新
        availableEquipments = CoreDataManager.shared.fetchEquipments()
        do {
            let remote = try await APIClient.shared.fetchEquipment()
            CoreDataManager.shared.upsertEquipments(remote)
            availableEquipments = CoreDataManager.shared.fetchEquipments()
        } catch { /* 缓存数据已可用，忽略网络错误 */ }
    }

    func save() async -> Bool {
        isSaving = true
        defer { isSaving = false }

        let localId = UUID()
        let styleIds   = selectedStyleCodes.joined(separator: ",")
        let styleNames = selectedStyleCodes.map { $0 == "LURE" ? "路亚" : "台钓" }.joined(separator: ",")
        let companionList = companions.split(separator: "，").map(String.init)

        // 写入 CoreData
        let tripEntity = CoreDataManager.shared.createTrip(
            localId: localId,
            date: tripDate,
            locationName: locationName.isEmpty ? nil : locationName,
            title: title.isEmpty ? nil : title,
            styleIds: styleIds,
            styleNames: styleNames,
            weatherTemp: Double(weatherTemp),
            weatherCondition: weatherCondition.isEmpty ? nil : weatherCondition,
            companions: companionList,
            notes: nil
        )

        // 保存渔获
        catches.forEach {
            _ = CoreDataManager.shared.createCatch(
                trip: tripEntity, species: $0.species,
                weightG: $0.weightG, lengthCm: $0.lengthCm,
                count: $0.count, isReleased: $0.isReleased,
                styleCode: $0.styleCode, notes: nil
            )
        }

        // 触发同步
        SyncManager.shared.syncIfNeeded()
        return true
    }
}

// 渔获表单临时模型
struct NewCatchForm: Identifiable {
    let id = UUID()
    var species = ""
    var weightG = 0
    var lengthCm = 0.0
    var count = 1
    var isReleased = false
    var styleCode: String? = nil
}
```

### NewTripView.swift（4步容器）

```swift
import SwiftUI

struct NewTripView: View {
    let onComplete: () async -> Void
    @StateObject private var vm = NewTripViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: 0) {
                    // 进度条
                    StepProgressBar(currentStep: vm.currentStep, totalSteps: 4)
                        .padding(.horizontal, FLMetrics.horizontalPadding)
                        .padding(.top, 16)

                    // 步骤内容
                    TabView(selection: $vm.currentStep) {
                        Step1BasicInfoView(vm: vm).tag(0)
                        Step2CatchesView(vm: vm).tag(1)
                        Step3EquipmentView(vm: vm).tag(2)
                        Step4SummaryView(vm: vm).tag(3)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.easeInOut, value: vm.currentStep)

                    // 底部按钮
                    HStack(spacing: 12) {
                        if vm.currentStep > 0 {
                            FLSecondaryButton("上一步") { vm.currentStep -= 1 }
                        }
                        if vm.currentStep < 3 {
                            FLPrimaryButton("下一步") { vm.currentStep += 1 }
                                .disabled(vm.currentStep == 0 && !vm.step1Valid)
                                .opacity(vm.currentStep == 0 && !vm.step1Valid ? 0.5 : 1)
                        } else {
                            FLPrimaryButton("完成保存", isLoading: vm.isSaving) {
                                Task {
                                    if await vm.save() {
                                        await onComplete()
                                        dismiss()
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, FLMetrics.horizontalPadding)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("新建出行")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") { dismiss() }
                        .foregroundColor(.textSecondary)
                }
            }
        }
    }
}

struct StepProgressBar: View {
    let currentStep: Int
    let totalSteps: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<totalSteps, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(i <= currentStep ? Color.primaryGold : Color.cardBackground)
                    .frame(height: 4)
            }
        }
    }
}
```

### Step1BasicInfoView.swift

```swift
import SwiftUI

struct Step1BasicInfoView: View {
    @ObservedObject var vm: NewTripViewModel
    private let styles = [("台钓", "TRADITIONAL"), ("路亚", "LURE")]

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // 出行日期（必填）
                FLCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("出行日期 *", systemImage: "calendar")
                            .font(.flLabel).foregroundColor(.accentBlue)
                        DatePicker("", selection: $vm.tripDate, displayedComponents: .date)
                            .datePickerStyle(.compact).labelsHidden()
                            .tint(.primaryGold)
                    }
                }

                // 钓法（必填）
                FLCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("钓法 *（可多选）", systemImage: "figure.fishing")
                            .font(.flLabel).foregroundColor(.accentBlue)
                        HStack(spacing: 12) {
                            ForEach(styles, id: \.1) { name, code in
                                Toggle(name, isOn: Binding(
                                    get: { vm.selectedStyleCodes.contains(code) },
                                    set: { on in
                                        if on { vm.selectedStyleCodes.insert(code) }
                                        else  { vm.selectedStyleCodes.remove(code) }
                                    }
                                ))
                                .toggleStyle(.button).tint(.primaryGold)
                            }
                        }
                    }
                }

                // 地点
                FLCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("钓场/地点", systemImage: "location.fill")
                            .font(.flLabel).foregroundColor(.textSecondary)
                        FLTextField(placeholder: "如：西湖、黑木河口", text: $vm.locationName)
                    }
                }

                // 天气
                FLCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("天气", systemImage: "cloud.sun.fill")
                            .font(.flLabel).foregroundColor(.textSecondary)
                        HStack(spacing: 12) {
                            FLTextField(placeholder: "温度 ℃", text: $vm.weatherTemp)
                                .keyboardType(.decimalPad).frame(maxWidth: 100)
                            FLTextField(placeholder: "天气状况（晴/阴/雨/雪）", text: $vm.weatherCondition)
                        }
                    }
                }

                // 同行人
                FLCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("同行钓友", systemImage: "person.2.fill")
                            .font(.flLabel).foregroundColor(.textSecondary)
                        FLTextField(placeholder: "多人用顿号分隔，如：小明、小红", text: $vm.companions)
                    }
                }
            }
            .padding(.horizontal, FLMetrics.horizontalPadding)
            .padding(.vertical, 16)
        }
    }
}
```

### Step2CatchesView.swift

```swift
import SwiftUI

struct Step2CatchesView: View {
    @ObservedObject var vm: NewTripViewModel
    @State private var showAddCatch = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(vm.catches) { catch_ in
                        FLCard {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(catch_.species.isEmpty ? "未命名" : catch_.species)
                                        .font(.flHeadline).foregroundColor(.textPrimary)
                                    Text("\(catch_.count) 尾 · \(catch_.weightG)g\(catch_.isReleased ? " · 放流" : "")")
                                        .font(.flCaption).foregroundColor(.textSecondary)
                                }
                                Spacer()
                                Button {
                                    vm.catches.removeAll { $0.id == catch_.id }
                                } label: {
                                    Image(systemName: "trash").foregroundColor(.destructiveRed)
                                }
                            }
                        }
                    }

                    Button { showAddCatch = true } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill").foregroundColor(.primaryGold)
                            Text("添加渔获").foregroundColor(.primaryGold).font(.flHeadline)
                        }
                        .frame(maxWidth: .infinity).padding()
                        .background(Color.primaryGold.opacity(0.1))
                        .cornerRadius(FLMetrics.cornerRadius)
                    }
                }
                .padding(.horizontal, FLMetrics.horizontalPadding)
                .padding(.vertical, 16)
            }
        }
        .sheet(isPresented: $showAddCatch) {
            AddCatchSheet(styleCodes: Array(vm.selectedStyleCodes)) { newCatch in
                vm.catches.append(newCatch)
            }
        }
    }
}

struct AddCatchSheet: View {
    let styleCodes: [String]
    let onAdd: (NewCatchForm) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var form = NewCatchForm()
    @State private var weightStr = ""
    @State private var lengthStr = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        FLCard {
                            VStack(spacing: 12) {
                                FLTextField(placeholder: "鱼种名称（必填）", text: $form.species)
                                HStack {
                                    FLTextField(placeholder: "重量 (g)", text: $weightStr).keyboardType(.numberPad)
                                    FLTextField(placeholder: "体长 (cm)", text: $lengthStr).keyboardType(.decimalPad)
                                }
                                HStack {
                                    Text("数量").font(.flBody).foregroundColor(.textPrimary)
                                    Spacer()
                                    Stepper("\(form.count)", value: $form.count, in: 1...99)
                                        .foregroundColor(.textPrimary)
                                }
                                HStack {
                                    Text("已放流").font(.flBody).foregroundColor(.textPrimary)
                                    Spacer()
                                    Toggle("", isOn: $form.isReleased).tint(.primaryGold)
                                }
                                if !styleCodes.isEmpty {
                                    HStack {
                                        Text("钓法归属").font(.flBody).foregroundColor(.textPrimary)
                                        Spacer()
                                        Picker("", selection: $form.styleCode) {
                                            Text("不指定").tag(Optional<String>.none)
                                            ForEach(styleCodes, id: \.self) { code in
                                                Text(code == "LURE" ? "路亚" : "台钓").tag(Optional(code))
                                            }
                                        }.tint(.primaryGold)
                                    }
                                }
                            }
                        }
                    }
                    .padding(FLMetrics.horizontalPadding)
                }
            }
            .navigationTitle("添加渔获")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") { dismiss() }.foregroundColor(.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("添加") {
                        form.weightG = Int(weightStr) ?? 0
                        form.lengthCm = Double(lengthStr) ?? 0
                        onAdd(form)
                        dismiss()
                    }
                    .disabled(form.species.isEmpty)
                    .foregroundColor(form.species.isEmpty ? .textSecondary : .primaryGold)
                }
            }
        }
    }
}
```

### Step3EquipmentView.swift

```swift
import SwiftUI

struct Step3EquipmentView: View {
    @ObservedObject var vm: NewTripViewModel

    var grouped: [String: [EquipmentEntity]] {
        Dictionary(grouping: vm.availableEquipments) { $0.categoryName ?? "其他" }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(grouped.keys.sorted(), id: \.self) { category in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(category).font(.flLabel).foregroundColor(.textSecondary)
                            .padding(.horizontal, 4)
                        ForEach(grouped[category] ?? [], id: \.id) { eq in
                            let isSelected = vm.selectedEquipmentIds.contains(eq.id ?? "")
                            Button {
                                if isSelected { vm.selectedEquipmentIds.remove(eq.id ?? "") }
                                else { vm.selectedEquipmentIds.insert(eq.id ?? "") }
                            } label: {
                                FLCard {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(eq.name ?? "").font(.flBody).foregroundColor(.textPrimary)
                                            if let brand = eq.brand {
                                                Text(brand).font(.flCaption).foregroundColor(.textSecondary)
                                            }
                                        }
                                        Spacer()
                                        if isSelected {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundColor(.primaryGold)
                                        }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, FLMetrics.horizontalPadding)
            .padding(.vertical, 16)
        }
        .task { await vm.loadEquipments() }
    }
}
```

### Step4SummaryView.swift

```swift
import SwiftUI

struct Step4SummaryView: View {
    @ObservedObject var vm: NewTripViewModel

    private let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .long; f.locale = Locale(identifier: "zh_CN"); return f
    }()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FLCard {
                    VStack(alignment: .leading, spacing: 12) {
                        SummaryRow(label: "日期", value: dateFmt.string(from: vm.tripDate))
                        SummaryRow(label: "地点", value: vm.locationName.isEmpty ? "未填写" : vm.locationName)
                        SummaryRow(label: "钓法", value: vm.selectedStyleCodes
                            .map { $0 == "LURE" ? "路亚" : "台钓" }.joined(separator: "、"))
                        SummaryRow(label: "渔获数量", value: "\(vm.catches.count) 条记录")
                        SummaryRow(label: "所用装备", value: "\(vm.selectedEquipmentIds.count) 件")
                        if !vm.weatherCondition.isEmpty {
                            SummaryRow(label: "天气", value: vm.weatherCondition)
                        }
                    }
                }
                Text("保存后将在后台自动同步到服务器")
                    .font(.flCaption).foregroundColor(.textSecondary)
            }
            .padding(.horizontal, FLMetrics.horizontalPadding)
            .padding(.vertical, 16)
        }
    }
}

struct SummaryRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).font(.flCaption).foregroundColor(.textSecondary)
            Spacer()
            Text(value).font(.flBody).foregroundColor(.textPrimary)
        }
    }
}
```

---

## 模块八：行程详情（I52–I58）

### TripDetailViewModel.swift

```swift
import Foundation

@MainActor
final class TripDetailViewModel: ObservableObject {
    @Published var trip: TripEntity
    @Published var catches: [CatchEntity] = []
    @Published var isDeleting = false

    init(trip: TripEntity) {
        self.trip = trip
        catches = CoreDataManager.shared.fetchCatches(for: trip)
    }

    func deleteTrip() async throws {
        isDeleting = true
        defer { isDeleting = false }
        // 如果已同步到服务器，调 API 删除
        if trip.syncStatus == "synced", let id = trip.id {
            try await APIClient.shared.deleteTrip(id: id)
        }
        CoreDataManager.shared.deleteTrip(trip)
    }
}
```

### TripDetailView.swift

参考设计稿 `detail_blue_final/screen.png`：

```swift
import SwiftUI

struct TripDetailView: View {
    @StateObject private var vm: TripDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteAlert = false

    private let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .long; f.locale = Locale(identifier: "zh_CN"); return f
    }()

    init(trip: TripEntity) {
        _vm = StateObject(wrappedValue: TripDetailViewModel(trip: trip))
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // 顶部信息卡
                    FLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            if let date = vm.trip.tripDate {
                                Text(dateFmt.string(from: date))
                                    .font(.flCaption).foregroundColor(.textSecondary)
                            }
                            Text(vm.trip.locationName ?? "未记录地点")
                                .font(.flTitle).foregroundColor(.textPrimary)

                            // 钓法标签
                            HStack(spacing: 8) {
                                ForEach((vm.trip.styleNames ?? "").split(separator: ",").map(String.init), id: \.self) { name in
                                    Text(name).font(.flCaption).foregroundColor(.appBackground)
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(Color.accentBlue).cornerRadius(6)
                                }
                            }

                            // 天气
                            if let cond = vm.trip.weatherCondition, !cond.isEmpty {
                                HStack(spacing: 8) {
                                    Image(systemName: "cloud.sun.fill").foregroundColor(.accentBlue)
                                    Text(cond).font(.flBody).foregroundColor(.textSecondary)
                                    if vm.trip.weatherTemp != 0 {
                                        Text("·  \(Int(vm.trip.weatherTemp))℃")
                                            .font(.flBody).foregroundColor(.textSecondary)
                                    }
                                }
                            }
                        }
                    }

                    // 渔获记录
                    if !vm.catches.isEmpty {
                        SectionHeader(title: "渔获记录", icon: "fish.fill")
                        ForEach(vm.catches, id: \.id) { catch_ in
                            FLCard {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(catch_.species ?? "未知鱼种")
                                            .font(.flHeadline).foregroundColor(.textPrimary)
                                        HStack(spacing: 8) {
                                            if catch_.weightG > 0 {
                                                Text("\(catch_.weightG)g").font(.flCaption).foregroundColor(.textSecondary)
                                            }
                                            Text("×\(catch_.count)").font(.flCaption).foregroundColor(.textSecondary)
                                        }
                                    }
                                    Spacer()
                                    if catch_.isReleased {
                                        Text("放流").font(.flCaption).foregroundColor(.primaryGold)
                                            .padding(.horizontal, 8).padding(.vertical, 3)
                                            .overlay(RoundedRectangle(cornerRadius: 6)
                                                .stroke(Color.primaryGold, lineWidth: 1))
                                    }
                                }
                            }
                        }
                    }

                    // 同行钓友
                    if let companions = vm.trip.companions as? [String], !companions.isEmpty {
                        SectionHeader(title: "同行钓友", icon: "person.2.fill")
                        FLCard {
                            Text(companions.joined(separator: "、"))
                                .font(.flBody).foregroundColor(.textPrimary)
                        }
                    }

                    // 备注
                    if let notes = vm.trip.notes, !notes.isEmpty {
                        SectionHeader(title: "备注", icon: "text.alignleft")
                        FLCard {
                            Text(notes).font(.flBody).foregroundColor(.textPrimary)
                        }
                    }
                }
                .padding(.horizontal, FLMetrics.horizontalPadding)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle(vm.trip.locationName ?? "行程详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) { showDeleteAlert = true } label: {
                        Label("删除出行", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert("确认删除", isPresented: $showDeleteAlert) {
            Button("删除", role: .destructive) {
                Task {
                    try? await vm.deleteTrip()
                    dismiss()
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("删除后无法恢复，确认删除此次出行记录？")
        }
    }
}

struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon).foregroundColor(.accentBlue).font(.flLabel)
            Text(title).font(.flLabel).foregroundColor(.textSecondary)
        }
        .padding(.horizontal, 4)
    }
}
```

---

## 模块九：同步机制（I59–I64）

### SyncManager.swift

```swift
import Foundation
import Network
import Combine

@MainActor
final class SyncManager: ObservableObject {
    static let shared = SyncManager()
    @Published var isSyncing = false

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.jiangfeng.fishinglog.network")
    private var wasConnected = false

    private init() {
        // 监测网络变化
        monitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            Task { @MainActor in
                if isConnected && !(self?.wasConnected ?? true) {
                    // 网络从断开变为连接，触发同步
                    self?.syncIfNeeded()
                }
                self?.wasConnected = isConnected
            }
        }
        monitor.start(queue: monitorQueue)
    }

    func syncIfNeeded() {
        guard AuthManager.shared.isLoggedIn else { return }
        let pending = CoreDataManager.shared.fetchPendingTrips()
        guard !pending.isEmpty else { return }
        Task { await sync(trips: pending) }
    }

    private func sync(trips: [TripEntity]) async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        // 构建同步请求体
        let items: [[String: Any]] = trips.compactMap { trip in
            guard let date = trip.tripDate else { return nil }
            let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
            return [
                "local_id"      : trip.localId?.uuidString ?? UUID().uuidString,
                "trip_date"     : fmt.string(from: date),
                "location_name" : trip.locationName as Any,
                "title"         : trip.title as Any,
                "notes"         : trip.notes as Any,
                "style_ids"     : (trip.styleIds ?? "").split(separator: ",")
                                    .compactMap { Int($0) },
                "updated_at"    : ISO8601DateFormatter().string(from: trip.updatedAt ?? Date())
            ]
        }

        do {
            let results = try await APIClient.shared.syncTrips(items)
            // 更新同步状态
            for result in results {
                guard let localIdStr = result["local_id"] as? String,
                      let serverId   = result["id"] as? String else { continue }
                let req = TripEntity.fetchRequest()
                req.predicate = NSPredicate(format: "localId == %@",
                                            UUID(uuidString: localIdStr) as CVarArg? ?? "")
                if let entity = try? CoreDataManager.shared.context.fetch(req).first {
                    entity.id         = serverId
                    entity.syncStatus = "synced"
                }
            }
            CoreDataManager.shared.saveContext()
        } catch {
            // 标记为 failed，下次重试
            trips.forEach { $0.syncStatus = "failed" }
            CoreDataManager.shared.saveContext()
        }
    }
}
```

---

## 模块十：验证脚本（I65）

### scripts/verify.sh

```bash
#!/bin/bash
set -e

PASS=0; FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

check() {
    local desc="$1"; shift
    if "$@" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $desc"; ((PASS++))
    else
        echo -e "${RED}✗${NC} $desc"; ((FAIL++))
    fi
}

cd "$(dirname "$0")/.."
echo "=== 钓鱼志 iOS Phase 1 验证 ==="

# 1. XcodeGen 可用
check "XcodeGen 已安装" which xcodegen

# 2. 关键文件存在
check "project.yml 存在"           test -f project.yml
check "CLAUDE.md 存在"             test -f CLAUDE.md
check "REQUIREMENTS.md 存在"       test -f REQUIREMENTS.md
check "Config.plist 存在"          test -f FishingLog/Resources/Config.plist
check "Colors.swift 存在"          test -f "FishingLog/DesignSystem/Colors.swift"
check "AuthManager.swift 存在"     test -f "FishingLog/Core/Auth/AuthManager.swift"
check "KeychainManager.swift 存在" test -f "FishingLog/Core/Auth/KeychainManager.swift"
check "APIClient.swift 存在"       test -f "FishingLog/Core/Network/APIClient.swift"
check "CoreDataManager.swift 存在" test -f "FishingLog/Core/CoreData/CoreDataManager.swift"
check "SyncManager.swift 存在"     test -f "FishingLog/Core/Sync/SyncManager.swift"
check "LoginView.swift 存在"       test -f "FishingLog/Features/Auth/LoginView.swift"
check "TripsListView.swift 存在"   test -f "FishingLog/Features/Trips/List/TripsListView.swift"
check "TripDetailView.swift 存在"  test -f "FishingLog/Features/Trips/Detail/TripDetailView.swift"
check "NewTripView.swift 存在"     test -f "FishingLog/Features/Trips/NewTrip/NewTripView.swift"

# 3. Core Data 模型检查
check "xcdatamodeld 存在"          test -d "FishingLog/Resources/FishingLog.xcdatamodeld"
check "TripEntity 定义存在"        grep -r "TripEntity"     "FishingLog/Resources/"
check "CatchEntity 定义存在"       grep -r "CatchEntity"    "FishingLog/Resources/"
check "EquipmentEntity 定义存在"   grep -r "EquipmentEntity" "FishingLog/Resources/"

# 4. XcodeGen 生成
check "xcodegen generate 成功" xcodegen generate

# 5. 编译（需要 Xcode）
echo "⏳ 编译中，可能需要几分钟..."
check "xcodebuild 编译无 error" xcodebuild build \
    -project FishingLog/FishingLog.xcodeproj \
    -scheme FishingLog \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath /tmp/fl-build \
    CODE_SIGNING_ALLOWED=NO \
    -quiet

# 汇总
echo ""
echo "==============================="
echo -e "通过: ${GREEN}$PASS${NC}  失败: ${RED}$FAIL${NC}"
if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}✓ 全部通过${NC}"
else
    echo -e "${RED}✗ 有 $FAIL 项未通过，请修复后重新验证${NC}"
    exit 1
fi
```

---

## 验收标准

`bash scripts/verify.sh` 输出 **"✓ 全部通过"**，REQUIREMENTS.md I01–I65 全部 65 项标记 `[x]`。

---

## 补充说明

1. **AnyCodable**：`TripAPI.swift` 中如果需要 `AnyCodable`，可以手写一个简单版本，或直接用 `responseJSON` 绕过
2. **设计稿参考**：`/Users/thomas/Desktop/Drive/AI/fishing/stitch/` 各文件夹内 `screen.png` 是视觉标准，`code.html` 是 HTML 参考，尽量还原配色和布局
3. **Xcode 版本**：确保使用 Xcode 15+（支持 iOS 17 SDK）
4. **模拟器**：verify.sh 中的编译目标是 `generic/platform=iOS Simulator`，无需指定具体设备
