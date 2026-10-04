# 概覽與資料看板

## 概覽頁

* 登入後點選左側導航欄按鈕「概覽」進入概覽頁 `/dashboard/overview`。
  可檢視快速開始嚮導、用量與健康狀態、API 資訊、公告、FAQ 和執行時間等卡片。

### 快速開始嚮導

1. 點選「建立 API 金鑰」進入 `/keys`。
2. 在錢包中新增額度（如果啟用了計費）。
3. 開啟遊樂場或使用你的客戶端傳送第一個請求驗證路由。

<img alt="快速開始頁" src="01-overview-get-started.webp" />

### 用量與健康狀態

頁面會根據當前賬戶和例項資料彙總餘額、消耗、請求數、成功率、延遲、吞吐量等指標。

<img alt="概覽資訊頁1" src="02-overview-info-1.webp" />

### API 資訊、公告、FAQ 和執行時間

頁面可檢視API 資訊、公告、FAQ、執行時間等資訊。

<img alt="概覽資訊頁2" src="03-overview-info-2.webp" />

<Callout type="info">
  這些卡片由 Root 在「系統設定」 → 「控制檯內容」中配置。
</Callout>

## 資料看板

* 登入後點選左側導航欄按鈕「資料看板」進入資料看板頁 `/dashboard/models`。
  可檢視模型呼叫分析和分流；使用者統計請前往 `/dashboard/users`（僅限 Admin 和 Root 使用者）。

### 模型呼叫分析

按時間範圍、模型和分組檢視呼叫次數、Token、消耗分佈和效能指標。

<img alt="資料看板資訊頁1" src="04-dashboard-info-1.webp" />

### 分流

檢視使用者、API 金鑰、分組、模型和渠道之間的請求流向。

<img alt="資料看板資訊頁2" src="05-dashboard-info-2.webp" />

### 使用者統計

僅Admin 和 Root 可進入 `/dashboard/users` 檢視使用者分析；普通使用者的導航中不會顯示此分割槽。

<img alt="資料看板資訊頁3" src="06-dashboard-info-3.webp" />
