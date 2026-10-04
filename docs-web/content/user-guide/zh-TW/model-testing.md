# 模型測試

準備在 Uter 接入某個大模型時，請依本章逐項驗證「能不能連、能不能用、用得穩不穩、算得準不準」，避免上線後踩坑。

## 測試前置

開始測試前，請先確認已具備以下資訊。缺任何一項都會導致第一步失敗。

| 項目 | 說明 | 在哪裡拿 |
| --- | --- | --- |
| **API 接入網址（Base URL）** | 形如 `https://uter.ai/v1`，以控制台提供的網址為準（可能是你的專屬網域） | 控制台 → 個人設定 / 接入文件 |
| **API 金鑰（Token / API Key）** | 形如 `sk-xxxxxxxx`。這是驗證憑證，等同密碼，請勿外洩、勿寫進前端程式碼、勿提交到程式碼倉庫 | 控制台 → 權杖管理 → 建立權杖 |
| **帳號配額（Quota）** | 計費單位：50 萬 Token ≈ 1 美元。每次呼叫會扣配額，配額不足會被拒 | 控制台 → 用量 / 餘額；或介面 `GET /v1/dashboard/billing/usage` |
| **模型名稱** | 你要測的模型在平台裡的註冊名稱（不一定等於官方原名） | 列出模型介面 `GET /v1/models` 回傳的 `id` |

<Callout type="warn">
  金鑰等同密碼：只在伺服器端或金鑰管理系統中使用，絕不下發到瀏覽器、絕不明文寫入日誌、絕不提交 Git。
</Callout>

金鑰在控制台有「啟用 / 停用 / 已過期 / 已耗盡」四種狀態。若額度已用完，金鑰處於「已耗盡」，任何呼叫都會提示額度不足。建議測試前先在權杖管理頁確認狀態。

## 測試維度

正式使用某個模型前，建議依下列九個維度逐一驗證。前 4 項是「能不能用」，後 5 項是「用得穩不穩、算得準不準」。

1. **連線與驗證** —— 網址對不對、金鑰有沒有效、IP 限制有沒有攔。
2. **模型列表與可用性** —— 目標模型是否真實存在且可用。
3. **基礎對話能力** —— 一次最簡請求能否正常回傳。
4. **參數與進階能力** —— 串流、temperature、max_tokens、tools/function calling、視覺多模態、JSON 模式、系統提示詞。
5. **串流輸出（SSE）** —— 是否逐字回傳、能否正確解析。
6. **效能與延遲** —— 首字延遲（TTFT）、整句耗時、長上下文表現。
7. **穩定性與限流** —— 併發、重試、429 限流下的表現。
8. **配額與計費校驗** —— 呼叫後扣費是否準確、餘額是否下降。
9. **錯誤與邊界** —— 參數非法、超長輸入、模型不可用時的錯誤是否清晰、可被程式碼處理。

## 分步操作

以下範例統一約定：

- 接入網址 `BASE=https://uter.ai/v1`（請替換成你實際的網址）
- 金鑰 `TOKEN=sk-your-token-here`（請替換成你控制台拿到的完整金鑰）

所有範例用 `curl`。替換後用終端機直接貼上即可執行。本機若有設定代理，請加 `--noproxy '*'` 略過代理。

### Step 1 · 最小連線 + 驗證測試

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

判定標準：

- 回傳一段 JSON（含 `object: "list"` 與若干 `id`）→ 連線 + 驗證 OK。
- 回傳 `{"error":{"message":"該令牌無效。","type":"...","code":"..."}}` 且 HTTP 401 → 金鑰錯誤或被停用（見排查表）。
- 完全連不上 / 逾時 → 網址錯誤或網路不通（見排查表）。

<Callout type="info">
  部分廠商原生介面也支援各自的驗證方式，僅當你用對應官方 SDK 時才需要：Claude 用 `POST /v1/messages` 加 `x-api-key: $TOKEN` 與 `anthropic-version: 2023-06-01`；Gemini 用 `GET /v1beta/models` 加 `x-goog-api-key: $TOKEN` 或在網址後帶 `?key=$TOKEN`。
</Callout>

### Step 2 · 列出可用模型，確認目標模型存在

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

找到你要測的模型 `id`（例如 `gpt-4o`、`claude-3-5-sonnet-20241022` 或平台自訂名稱）。

<Callout type="warn">
  如果列表裡沒有你要的模型，代表該模型尚未為你開通，請直接聯絡平台。不要自己猜名字硬調，必然 404 或提示無可用渠道。
</Callout>

### Step 3 · 一次最簡對話（非串流）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替換為你的模型id",
    "messages": [{"role": "user", "content": "用一句話介紹你自己。"}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

判定標準：`choices[0].message.content` 有正常文字、`usage` 欄位有 `prompt_tokens` / `completion_tokens` → 基礎對話能力 OK。

### Step 4 · 串流輸出（SSE）測試

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替換為你的模型id",
    "messages": [{"role": "user", "content": "數到 10。"}],
    "stream": true
  }'
```

判定標準：終端機應逐行捲動 `data: {...}` 片段，最後以 `data: [DONE]` 結束。能正確逐字回傳 = 串流 OK。

<Callout type="info">
  用 `curl` 必須加 `-N`（停用緩衝）才能看到逐字效果；SDK 側則要確認已開啟 `stream: true` 且沒有做整體緩衝。
</Callout>

### Step 5 · 進階能力：工具呼叫（Function Calling）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替換為你的模型id",
    "messages": [{"role": "user", "content": "北京現在天氣怎麼樣？"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "查詢城市天氣",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

判定標準：回傳結果出現 `choices[0].message.tool_calls`（模型決定呼叫 `get_weather`），而不是自己編答案 → 工具呼叫 OK。

<Callout type="warn">
  若產品依賴 function calling、JSON 模式或視覺輸入，請務必單獨測試，不要假設「能聊天就都能用」。
</Callout>

### Step 6 · 多模態（視覺）測試（僅當模型支援圖片）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替換為支援視覺的模型id",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "這張圖裡有什麼？"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

判定標準：回傳對圖片內容的正確描述 → 視覺 OK。注意圖片必須是公網可存取的 URL，平台不會讀取你本機的檔案。

### Step 7 · 延遲與效能基準（建議跑 3~5 次取均值）

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "第$i次 首字節=%{time_starttransfer}s 總耗時=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"替換為你的模型id","messages":[{"role":"user","content":"你好"}],"max_tokens":128}'
done
```

關注首字節時間（TTFT）與總耗時，與你的產品 SLA 比對。長上下文場景建議再測一次長 prompt（例如 8k / 32k tokens），觀察是否線性變慢。

### Step 8 · 配額與計費校驗

呼叫前記一次餘額，呼叫後再記一次，確認差額約等於本次實際消耗。

```bash
# 呼叫前
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# （中間跑一次 Step 3 的對話）

# 呼叫後
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

也可直接看單次回應的 `usage` 欄位（`prompt_tokens` + `completion_tokens`），與計費口徑核對。

### Step 9 · 邊界與錯誤可讀性

故意製造一次錯誤，確認錯誤訊息清晰、可被程式碼擷取：

```bash
# 超長 max_tokens / 非法參數
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"替換為你的模型id","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

判定標準：回傳結構化的 `{"error":{"message":...,"type":...,"code":...}}` 與明確的 HTTP 狀態碼（4xx），而不是空白或 500 堆疊資訊 → 錯誤可被正常處理。

## 常見問題排查表

| # | 現象（你看到的） | 可能原因 | 解決方案 |
| --- | --- | --- | --- |
| **A1** | `401` + `該令牌無效。` | 金鑰複製不全 / 打錯 / 已被停用 | 從控制台重新複製完整金鑰；確認狀態為「啟用」，複製時不要截斷、不要帶多餘空格 |
| **A2** | `401` + `該令牌已過期，請重新建立一個。` | 金鑰設定了過期時間且已到期 | 控制台重新產生新金鑰；長期使用的金鑰建議把過期時間設為「永不過期」 |
| **A3** | `403` + `您的 IP 不在權杖允許存取的清單中` | 該金鑰設定了 IP 白名單，你目前的出口 IP 不在清單內 | 在控制台把出口公網 IP 加入金鑰白名單；或暫時關閉 IP 限制（僅測試環境） |
| **A4** | 完全連不上 / `Could not resolve host` / 長時間逾時 | Base URL 寫錯、自簽憑證、內網存取 | 核對 Base URL（應為 `https://你的網域/v1`）；本機偵錯若走代理需加 `--noproxy '*'`；確認網路可達 |
| **B1** | `您的額度不足。` HTTP 403 | 帳號或金鑰配額耗盡 | 控制台儲值 / 提升配額；或用 `GET /v1/dashboard/billing/usage` 核對剩餘額度 |
| **B2** | `分組「default」下模型「xxx」沒有可用渠道。` | 該模型在你的帳號下尚未設定可用渠道 | 聯絡平台確認該模型是否可用；或改用 `/v1/models` 列表裡確認可用的模型名稱。不要猜模型名硬調 |
| **B3** | `404` / `model not found` | 模型名寫錯，或該模型尚未為你開通 | 用 Step 2 列模型，嚴格複製回傳的 `id` |
| **C1** | `429` + 請求被限流 | 觸發了金鑰級或平台級限流 | 降低併發 / 加退避重試（指數退避）；確認金鑰的 RPM/TPM 限額；批次任務錯開 |
| **C2** | 偶發 `5xx` / 上游逾時，重試後成功 | 上游模型波動 | 實作失敗重試 + 退避；平台會自動重試，但客戶端也應有兜底 |
| **D1** | 串流輸出一次全出來、不是逐字 | 客戶端緩衝（如 curl 沒加 `-N`，或 SDK 沒開 stream） | curl 加 `-N`；SDK 確認 `stream: true` 且未做整體緩衝 |
| **D2** | 中文 / 特殊字元亂碼 | 未宣告編碼或解析出錯 | 請求與回應均按 UTF-8；`python3 -m json.tool` 正常顯示即伺服器端 OK，問題在本機終端機編碼 |
| **D3** | 回傳內容被截斷 | `max_tokens` 設太小，或模型達到輸出上限 | 調大 `max_tokens`；長文改用串流分段接收 |
| **E1** | 扣費與預期不符（多扣 / 少扣） | 計費口徑可能含思維鏈、工具呼叫等隱藏 token，或不同模型計費倍率不同 | 以單次回應 `usage` 欄位為準核對；有疑問聯絡平台核對計費規則 |
| **E2** | function calling 不觸發 / JSON 模式不生效 | 該模型未開放對應能力 | 用 Step 5 單獨驗證；不支援的能力不要強依賴，需在產品層降級 |
| **F1** | `400` + 中文「公告式」提示 | 上游模型供應臨時變動（供應商在錯誤裡發通知），不是你請求寫錯 | 確認自己的請求格式無誤後，直接聯絡平台並附上錯誤原文即可 |

<Callout type="idea">
  兩條最值得記住的經驗：凡是報「沒有可用渠道 / 模型找不到」，先用 `GET /v1/models` 核對真實模型名稱，再聯絡平台確認——**90% 的「模型用不了」都是這兩個原因**，不是程式碼問題。凡是 `401/403`，先核對金鑰狀態與 IP 白名單，再核對 Base URL——**驗證類問題幾乎都出在「複製不全 / 網址錯 / 限制沒關」**。
</Callout>

### 遇到 400 報錯怎麼辦（Bad Request）

`400` 表示「請求本身有問題」：伺服器收到了你的請求，但請求內容或參數不合法，被直接拒絕。它和驗證（401）、配額（403）、限流（429）不是一類。

先按錯誤文案判斷來源：

| 你看到的提示 | 通常來源 | 該怎麼做 |
| --- | --- | --- |
| 中文、像平台提示 | 平台在轉發前校驗請求 | 按提示修改請求參數 |
| 英文、像 OpenAI / Claude / Gemini 的錯誤 | 上游模型商回傳（參數不符合該模型要求） | 按提示修改參數（如補充 messages、調整越界值） |
| 中文、像「通知 / 公告」 | 上游模型供應臨時變動 | 不是你寫錯，直接聯絡平台並提供錯誤原文 |

平台側常見的 400 提示：

| 你看到的提示 | 含義 | 解決 |
| --- | --- | --- |
| `請求不合法：<具體錯誤>` | 平台校驗請求本體失敗 | 看冒號後的具體說明，照著改 |
| `請求不合法，無法識別您要使用哪個模型。` | 沒解析出要用的模型 | 確認請求裡 `"model": "模型名稱"` 已填寫且拼寫正確 |
| `model field is required` | 沒傳 `model` 欄位 | 補上 `model` 參數 |
| 提示「不是合法 JSON」 | 請求本體 JSON 格式有誤 | 檢查引號、逗號、跳脫，尤其是中文與換行 |

<Callout type="info">
  如果你看到類似「模型設定」「價格未設定」這類提示，屬於平台側問題，直接聯絡平台處理即可，無需你修改請求。
</Callout>

上游模型常見的 400 提示：

- `messages is required` / `messages must be a non-empty array` —— 漏了 `messages` 或為空
- `temperature must be between 0 and 2` / `max_tokens too large` —— 參數越界
- `Unknown parameter: 'xxx'` —— 傳了該模型不支援的欄位
- `1 validation error for ...` —— 欄位型別或必填項不符

30 秒定位（curl 加 `-i` 看完整回應）：

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<模型名稱>","messages":[{"role":"user","content":"hi"}]}'
```

重點看回應裡的 `message`——它通常已寫明直接原因。

## 上線前檢查清單

複製下面清單，逐項打勾後再切正式流量：

- [ ] **接入網址**已固化到設定（環境變數 / 設定中心），未硬編碼到前端。
- [ ] **金鑰**從控制台完整複製，狀態為「啟用」，未過期，配額充足。
- [ ] 若金鑰開了 IP 白名單，正式伺服器出口 IP 已加入。
- [ ] `GET /v1/models` 能列出目標模型，且 `id` 與程式碼裡寫的一致。
- [ ] 非串流對話跑通，能拿到 `content` 與 `usage`。
- [ ] 串流（SSE）跑通，能正確解析 `data:` 片段與 `[DONE]`。
- [ ] 產品依賴的**進階能力**（tools / JSON / 視覺 / 長上下文）已逐項驗證通過。
- [ ] 記錄了延遲基準（TTFT / 總耗時），符合產品 SLA。
- [ ] 客戶端實作了**限流退避重試**與**上游 5xx 兜底重試**。
- [ ] 錯誤回應依 `error.message` / `error.code` / HTTP 狀態碼做結構化處理，不會把原始憑證印到日誌。
- [ ] 配額扣費已用 `usage` 欄位核對，與預期一致。
- [ ] 正式環境不印出、不提交金鑰（已接入金鑰管理 / 環境變數）。
- [ ] 已與平台確認目標模型的**可用性與計費規則**。

## 附錄

### 支援的介面總覽（以 OpenAI 相容為主）

| 能力 | 方法與路徑 | 說明 |
| --- | --- | --- |
| 列出模型 | `GET /v1/models` | 驗證後查看你可用的模型 |
| 檢索模型 | `GET /v1/models/:model` | 查看單一模型資訊 |
| 對話 | `POST /v1/chat/completions` | 主介面，支援 stream / tools / 視覺 |
| 文字補全 | `POST /v1/completions` | 舊版補全（部分模型支援） |
| 向量 | `POST /v1/embeddings` | 文字向量化 |
| 繪圖 | `POST /v1/images/generations`、`/v1/images/edits` | 文生圖 / 改圖 |
| 語音 | `POST /v1/audio/transcriptions`、`/translations`、`/speech` | 轉寫 / 翻譯 / 合成 |
| 重排 | `POST /v1/rerank` | 檢索重排 |
| 內容審查 | `POST /v1/moderations` | 內容安全審查 |
| Claude 原生 | `POST /v1/messages` | 用 `x-api-key` 驗證 |
| 即時語音 | `GET /v1/realtime`（WebSocket） | Realtime 模式 |
| Gemini 原生 | `/v1beta/models/*` | 用 `x-goog-api-key` 驗證 |
| 用量 / 訂閱 | `GET /v1/dashboard/billing/usage`、`/subscription` | 自助查配額 |

### 錯誤回應統一格式

平台所有 API 錯誤均為 OpenAI 風格結構，方便統一處理：

```json
{
  "error": {
    "message": "人類可讀的錯誤原因",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "可選的錯誤碼",
    "param": "可選的問題參數名"
  }
}
```

搭配 HTTP 狀態碼（401 驗證 / 403 配額或權限 / 404 模型 / 429 限流 / 5xx 上游）即可涵蓋絕大多數客戶端處理邏輯。

### 安全提醒（務必遵守）

- **金鑰 = 密碼**：只在伺服器端 / 金鑰管理裡使用，絕不下發到瀏覽器、絕不明文進日誌、絕不提交 Git。
- **日誌遮蔽**：平台稽核不會記錄你的金鑰明文；但你自己的客戶端列印回應時，也要避免把 `Authorization` 標頭寫進日誌。
- **限流與重試**：務必實作退避重試，避免雪崩式重試把限流打成全面不可用。
