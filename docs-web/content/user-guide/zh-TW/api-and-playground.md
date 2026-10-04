# 使用 API 與遊樂場

## 遊樂場

* 遊樂場用於線上簡單測試和體驗 AI 模型，使用者可以輸入問題或指令，與模型進行對話並檢視生成結果。
  ​

1. 選擇分組與模型：在輸入框右下方選擇可用的模型分組和具體模型，確認本次對話使用的模型。
2. 設定請求引數：點選引數設定按鈕，根據需要啟用並調整溫度、Top P、頻率懲罰、存在懲罰和最大 Tokens 等生成引數。
3. 填寫對話內容：在底部輸入框中輸入問題、指令或提示詞；搜尋、上傳檔案、上傳照片，截圖、拍照功能暫未實現。
4. 傳送請求：確認模型、引數和輸入內容後，點選“傳送”按鈕提交請求。
5. 檢視回復結果：模型生成完成後，可在對話區域檢視返回內容，並繼續輸入新的問題進行多輪對話。

<img alt="遊樂場頁面" src="01-playground.webp" />

## API 地址與認證

閘道器的 OpenAI 相容地址通常為：

```text
https://your-host/v1
```

使用 API 金鑰作為 Bearer Token：

```http
Authorization: Bearer YOUR_API_KEY
```

以聊天補全為例：

```bash
curl https://your-host/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## SDK 示例

### Python（OpenAI SDK）

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://your-host/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

### Claude 原生格式

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Gemini 原生格式

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## 支援的介面端點

| 介面              | 路徑                                     | 說明                                                                                              |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 聊天補全            | `POST /v1/chat/completions`            | OpenAI Chat Completions 相容介面，要求提供 `model` 和 `messages`，支援流式或普通響應。                               |
| 遊樂場聊天           | `POST /pg/chat/completions`            | 網頁遊樂場專用介面，使用登入會話選擇分組和模型，並複用統一的分流、協議轉換、計費和重試鏈路。                                                  |
| 文字補全            | `POST /v1/completions`                 | 傳統文字補全介面，要求提供 `prompt` 和 `model`。                                                               |
| 向量嵌入            | `POST /v1/embeddings`                  | 將文字或文字陣列轉換為向量，要求提供 `input`，由渠道介面卡轉換為上游格式。                                                       |
| Gemini 嵌入相容介面   | `POST /v1/engines/{model}/embeddings`  | 相容舊版 Gemini 風格的嵌入路徑，根據 URL 中的模型名處理嵌入請求。                                                         |
| 影象生成            | `POST /v1/images/generations`          | 根據提示詞生成影象，具體模型、尺寸、質量和數量取決於請求引數及已配置渠道。                                                           |
| 影象編輯            | `POST /v1/images/edits`                | 根據輸入影象和提示詞進行影象編輯，支援 JSON 和 `multipart/form-data` 請求。                                            |
| 舊版編輯介面          | `POST /v1/edits`                       | 保留的相容路徑，程式碼進入影象 Relay 處理；新客戶端建議優先使用 `/v1/images/edits`。                                          |
| 語音轉文字           | `POST /v1/audio/transcriptions`        | 將音訊轉換為文字，按照 OpenAI 音訊介面格式轉發到對應語音識別渠道。                                                           |
| 音訊翻譯            | `POST /v1/audio/translations`          | 識別音訊內容並輸出翻譯後的文字。                                                                                |
| 文字轉語音           | `POST /v1/audio/speech`                | 將輸入文字轉換為音訊。                                                                                     |
| 重排序             | `POST /v1/rerank`                      | 根據 `query` 對候選 `documents` 進行相關性排序，要求查詢內容和文件列表不為空。                                              |
| 內容稽核            | `POST /v1/moderations`                 | 對文字或其他輸入執行內容稽核；未提供模型時會使用預設稽核模型候選。                                                               |
| Responses API   | `POST /v1/responses`                   | OpenAI Responses 格式介面，支援輸入、工具和響應事件等能力。                                                          |
| Responses 壓縮    | `POST /v1/responses/compact`           | 對 Responses 請求上下文執行壓縮處理。                                                                        |
| Codex 網頁搜尋      | `POST /v1/alpha/search`                | Codex 獨立網頁搜尋格式介面，目前僅允許支援該能力的 Sub2API、優特、Codex 和高階自定義渠道處理。                                  |
| Claude Messages | `POST /v1/messages`                    | Anthropic Claude Messages 相容介面，要求提供 `model` 和訊息內容，必要時由 優特 轉換為上游協議。                         |
| 實時對話            | `GET /v1/realtime`（WebSocket）          | OpenAI Realtime 風格的雙向實時通訊介面，模型通常透過查詢引數傳入，API 金鑰可透過 Bearer Token 或 WebSocket 子協議傳遞。              |
| Gemini 原生模型呼叫   | `POST /v1beta/models/{model}:{action}` | Gemini 原生格式介面，支援模型操作路徑，例如 `generateContent`、`streamGenerateContent` 和嵌入相關操作。                    |
| Gemini 相容模型呼叫   | `POST /v1/models/{model}:{action}`     | 以 `/v1` 字首承接 Gemini 風格的模型操作請求，由 Gemini Relay 負責解析和轉換。                                           |
| 模型列表            | `GET /v1/models`                       | 預設返回 OpenAI 格式模型列表；使用 Anthropic 請求頭時返回 Claude 格式，使用 `x-goog-api-key` 或 `key` 查詢引數時返回 Gemini 格式。 |
| 模型詳情            | `GET /v1/models/{model}`               | 查詢單個模型資訊；模型不存在時返回 `model_not_found` 錯誤物件。                                                       |
| Gemini 模型列表     | `GET /v1beta/models`                   | 以 Gemini 格式返回可用模型列表，響應欄位包括 `models` 和 `nextPageToken`。                                          |
| OpenAI 格式模型列表   | `GET /v1beta/openai/models`            | 在 Gemini 相容名稱空間下，以 OpenAI 格式返回模型列表。                                                             |
