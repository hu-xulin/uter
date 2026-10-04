# Kiểm thử mô hình

Trước khi tích hợp một mô hình ngôn ngữ lớn vào Uter, hãy làm theo từng bước trong chương này để kiểm tra «có kết nối được không, có dùng được không, có ổn định không, tính tiền có chính xác không», nhằm tránh sự cố sau khi lên production.

## Chuẩn bị trước khi test

Trước khi bắt đầu, hãy xác nhận bạn đã có đủ các thông tin sau. Thiếu một mục sẽ khiến bước đầu tiên thất bại.

| Mục | Mô tả | Lấy ở đâu |
| --- | --- | --- |
| **Địa chỉ API (Base URL)** | Có dạng `https://uter.ai/v1`; hãy dùng địa chỉ hiển thị trong bảng điều khiển (có thể là tên miền riêng của bạn) | Bảng điều khiển → Hồ sơ / tài liệu tích hợp |
| **Khóa API (token)** | Có dạng `sk-xxxxxxxx`. Đây là thông tin xác thực, tương đương mật khẩu: tuyệt đối không lộ, không viết vào mã front-end, không commit vào kho mã nguồn | Bảng điều khiển → Quản lý token → Tạo token |
| **Hạn mức (quota) của tài khoản** | Đơn vị tính tiền: 500 nghìn token ≈ 1 USD. Mỗi lượt gọi sẽ trừ hạn mức; hết hạn mức thì yêu cầu bị từ chối | Bảng điều khiển → Mức sử dụng / số dư; hoặc `GET /v1/dashboard/billing/usage` |
| **Tên mô hình** | Tên đăng ký của mô hình bạn muốn test (có thể khác tên chính thức của nhà cung cấp) | Trường `id` trả về từ API liệt kê mô hình `GET /v1/models` |

<Callout type="warn">
  Khóa API tương đương mật khẩu: chỉ dùng ở phía máy chủ hoặc trong trình quản lý bí mật, tuyệt đối không gửi xuống trình duyệt, không ghi bản rõ vào nhật ký, không commit vào Git.
</Callout>

Token có bốn trạng thái trong bảng điều khiển: đang bật, đã tắt, đã hết hạn và đã cạn. Khi hạn mức đã dùng hết, token ở trạng thái «đã cạn» và mọi lượt gọi đều báo thiếu hạn mức. Nên kiểm tra trạng thái ở trang quản lý token trước khi test.

## Các chiều cần kiểm tra

Trước khi dùng một mô hình trong production, hãy kiểm tra lần lượt chín chiều sau. Bốn chiều đầu trả lời câu hỏi «có dùng được không», năm chiều sau trả lời «có ổn định không và tính tiền có đúng không».

1. **Kết nối và xác thực** — địa chỉ có đúng không, khóa còn hiệu lực không, có bị chặn bởi giới hạn IP không.
2. **Danh sách mô hình và khả dụng** — mô hình mục tiêu có thực sự tồn tại và dùng được không.
3. **Đối thoại cơ bản** — một yêu cầu tối giản có trả về bình thường không.
4. **Tham số và tính năng nâng cao** — streaming, temperature, max_tokens, tools/function calling, thị giác (đa phương thức), chế độ JSON, lệnh hệ thống.
5. **Đầu ra dạng luồng (SSE)** — có trả về từng ký tự một không, có phân tích được không.
6. **Hiệu năng và độ trễ** — độ trễ tới ký tự đầu tiên (TTFT), tổng thời gian, hành vi với ngữ cảnh dài.
7. **Ổn định và giới hạn tần suất** — hành vi khi chạy song song, khi thử lại, và khi gặp 429.
8. **Hạn mức và đối soát tính tiền** — có trừ tiền đúng không, số dư có giảm không.
9. **Lỗi và biên** — khi tham số sai, đầu vào quá dài hoặc mô hình không khả dụng, thông báo lỗi có rõ ràng và xử lý được trong mã không.

## Thực hiện từng bước

Các ví dụ dưới đây giả định:

- Địa chỉ cơ sở `BASE=https://uter.ai/v1` (hãy thay bằng địa chỉ thật của bạn)
- Khóa `TOKEN=sk-your-token-here` (hãy thay bằng khóa đầy đủ lấy từ bảng điều khiển)

Tất cả ví dụ dùng `curl` — sau khi thay thế, dán trực tiếp vào terminal để chạy. Nếu máy bạn đi qua proxy, hãy thêm `--noproxy '*'` để bỏ qua proxy.

### Bước 1 · Kiểm tra kết nối tối thiểu và xác thực

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

Tiêu chí đạt:

- Trả về JSON có `object: "list"` và vài giá trị `id` → kết nối và xác thực OK.
- Trả về `{"error":{"message":"That token isn't valid.","type":"...","code":"..."}}` kèm HTTP 401 → khóa sai hoặc đã bị tắt (xem bảng xử lý sự cố).
- Không kết nối được / bị timeout → địa chỉ sai hoặc mạng không tới được (xem bảng xử lý sự cố).

<Callout type="info">
  Một số API gốc của các nhà cung cấp dùng cơ chế xác thực riêng, chỉ cần thiết khi bạn dùng SDK chính thức tương ứng: Claude dùng `POST /v1/messages` với `x-api-key: $TOKEN` và `anthropic-version: 2023-06-01`; Gemini dùng `GET /v1beta/models` với `x-goog-api-key: $TOKEN` hoặc thêm `?key=$TOKEN` vào URL.
</Callout>

### Bước 2 · Liệt kê mô hình khả dụng và xác nhận có mô hình mục tiêu

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

Tìm `id` của mô hình bạn muốn test (ví dụ `gpt-4o`, `claude-3-5-sonnet-20241022` hoặc tên do nền tảng đặt).

<Callout type="warn">
  Nếu không có mô hình bạn cần trong danh sách, nghĩa là mô hình đó chưa được mở cho tài khoản của bạn — hãy liên hệ nền tảng. Đừng tự đoán tên rồi gọi, kết quả chắc chắn là 404 hoặc báo không có kênh khả dụng.
</Callout>

### Bước 3 · Một lượt đối thoại tối giản (không streaming)

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "thay bằng id mô hình của bạn",
    "messages": [{"role": "user", "content": "Hãy tự giới thiệu trong một câu."}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

Tiêu chí đạt: `choices[0].message.content` có nội dung hợp lệ và `usage` có `prompt_tokens` / `completion_tokens` → đối thoại cơ bản hoạt động.

### Bước 4 · Kiểm tra đầu ra dạng luồng (SSE)

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "thay bằng id mô hình của bạn",
    "messages": [{"role": "user", "content": "Đếm từ 1 đến 10."}],
    "stream": true
  }'
```

Tiêu chí đạt: terminal phải hiện từng mảnh `data: {...}` theo dòng và kết thúc bằng `data: [DONE]`. Trả về đúng từng ký tự một nghĩa là streaming hoạt động.

<Callout type="info">
  Với `curl`, cần thêm `-N` (tắt bộ đệm) mới thấy được hiệu ứng từng ký tự. Phía SDK thì hãy chắc chắn `stream: true` đã bật và không có bộ đệm toàn bộ phản hồi.
</Callout>

### Bước 5 · Tính năng nâng cao: gọi hàm (Function Calling)

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "thay bằng id mô hình của bạn",
    "messages": [{"role": "user", "content": "Thời tiết Bắc Kinh hiện tại thế nào?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Tra cứu thời tiết của một thành phố",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

Tiêu chí đạt: phản hồi chứa `choices[0].message.tool_calls` (mô hình quyết định gọi `get_weather`) thay vì tự bịa câu trả lời → gọi hàm hoạt động.

<Callout type="warn">
  Nếu sản phẩm của bạn phụ thuộc vào function calling, chế độ JSON hoặc đầu vào hình ảnh, hãy test riêng từng tính năng, đừng mặc định «chat được thì tất cả đều dùng được».
</Callout>

### Bước 6 · Kiểm tra đa phương thức (thị giác) — chỉ khi mô hình hỗ trợ ảnh

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "thay bằng id mô hình có hỗ trợ thị giác",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Trong ảnh này có gì?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

Tiêu chí đạt: phản hồi mô tả đúng nội dung ảnh → thị giác hoạt động. Ảnh phải là URL truy cập được từ Internet; nền tảng không đọc được tệp cục bộ của bạn.

### Bước 7 · Độ trễ và mốc hiệu năng (chạy 3~5 lần rồi lấy trung bình)

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "lan $i first_byte=%{time_starttransfer}s total=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"thay bằng id mô hình của bạn","messages":[{"role":"user","content":"xin chào"}],"max_tokens":128}'
done
```

Chú ý **thời gian tới ký tự đầu (TTFT)** và **tổng thời gian**, rồi so với SLA của bạn. Với ngữ cảnh dài, nên test thêm một prompt dài (ví dụ 8k / 32k token) để xem độ trễ có tăng tuyến tính hay không.

### Bước 8 · Đối soát hạn mức và tính tiền

Ghi lại số dư trước khi gọi và sau khi gọi, xác nhận chênh lệch xấp xỉ bằng mức tiêu thụ thực tế.

```bash
# trước khi gọi
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# (ở giữa, chạy lượt đối thoại ở Bước 3)

# sau khi gọi
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Bạn cũng có thể đối chiếu trực tiếp trường `usage` của một phản hồi (`prompt_tokens` + `completion_tokens`) với quy tắc tính tiền.

### Bước 9 · Biên và khả năng đọc của lỗi

Cố ý tạo một lỗi để xác nhận thông báo rõ ràng và bắt được trong mã:

```bash
# max_tokens quá lớn / tham số không hợp lệ
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"thay bằng id mô hình của bạn","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

Tiêu chí đạt: trả về lỗi có cấu trúc `{"error":{"message":...,"type":...,"code":...}}` kèm mã HTTP 4xx rõ ràng, thay vì phản hồi rỗng hoặc stack 500 → lỗi xử lý được bình thường.

## Bảng xử lý sự cố

| # | Triệu chứng | Nguyên nhân khả dĩ | Cách khắc phục |
| --- | --- | --- | --- |
| **A1** | `401` + `That token isn't valid.` | Khóa bị sao chép thiếu, gõ sai, hoặc đã bị tắt | Sao chép lại khóa đầy đủ từ bảng điều khiển; xác nhận trạng thái là «đang bật», không bị cắt cụt và không có khoảng trắng thừa |
| **A2** | `401` + `This token has expired. Please create a new one.` | Khóa có thời hạn và đã hết | Tạo khóa mới trong bảng điều khiển; với khóa dùng lâu dài nên đặt thời hạn là «không bao giờ hết hạn» |
| **A3** | `403` + `Your IP is not in the token's allowed list` | Khóa có danh sách IP cho phép và IP đầu ra hiện tại không nằm trong đó | Thêm IP công cộng đầu ra của bạn vào danh sách trong bảng điều khiển, hoặc tạm thời tắt giới hạn IP (chỉ dùng cho môi trường test) |
| **A4** | Không kết nối được / `Could not resolve host` / timeout lâu | Sai Base URL, chứng thư tự ký, truy cập từ mạng nội bộ | Kiểm tra lại Base URL (phải là `https://tên-miền-của-bạn/v1`); nếu máy chạy qua proxy khi gỡ lỗi thì thêm `--noproxy '*'`; xác nhận mạng tới được |
| **B1** | `Your quota is insufficient.` HTTP 403 | Hạn mức tài khoản hoặc khóa đã cạn | Nạp tiền / nâng hạn mức trong bảng điều khiển; hoặc kiểm tra hạn mức còn lại qua `GET /v1/dashboard/billing/usage` |
| **B2** | `No available channel for model "xxx" in group "default".` | Mô hình đó chưa được cấu hình kênh khả dụng cho tài khoản của bạn | Liên hệ nền tảng để xác nhận khả năng sử dụng, hoặc chọn tên mô hình có trong danh sách `/v1/models`. Đừng đoán tên mô hình |
| **B3** | `404` / `model not found` | Sai tên mô hình, hoặc mô hình chưa mở cho bạn | Dùng Bước 2 để liệt kê mô hình và sao chép chính xác `id` được trả về |
| **C1** | `429` + yêu cầu bị giới hạn | Chạm giới hạn tần suất ở cấp khóa hoặc cấp nền tảng | Giảm mức song song / thêm cơ chế thử lại có backoff (backoff luỹ tiến); kiểm tra giới hạn RPM/TPM của khóa; dồn tác vụ hàng loạt ra các khung giờ khác nhau |
| **C2** | Thỉnh thoảng `5xx` / timeout thượng nguồn, thử lại là thành công | Dao động từ mô hình thượng nguồn | Cài đặt thử lại kèm backoff; nền tảng đã tự thử lại, nhưng phía client vẫn nên có phương án dự phòng |
| **D1** | Đầu ra streaming tràn ra một lần thay vì từng ký tự | Bộ đệm phía client (ví dụ curl thiếu `-N`, hoặc SDK chưa bật stream) | Thêm `-N` cho curl; kiểm tra `stream: true` và không có bộ đệm toàn bộ phản hồi trong SDK |
| **D2** | Tiếng Việt hoặc ký tự đặc biệt hiển thị lỗi | Không khai báo encoding hoặc lỗi phân tích | Dùng UTF-8 cho cả yêu cầu lẫn phản hồi; nếu `python3 -m json.tool` hiển thị bình thường thì phía máy chủ ổn, vấn đề nằm ở encoding của terminal |
| **D3** | Nội dung phản hồi bị cắt | `max_tokens` quá nhỏ, hoặc mô hình đã đạt giới hạn đầu ra | Tăng `max_tokens`; với nội dung dài nên nhận theo từng đoạn qua streaming |
| **E1** | Mức trừ tiền không như kỳ vọng (trừ nhiều hoặc trừ ít) | Cơ sở tính tiền có thể bao gồm token ẩn (chuỗi suy luận, lệnh gọi công cụ), hoặc các mô hình có hệ số khác nhau | Lấy trường `usage` của phản hồi làm chuẩn đối chiếu; khi có nghi vấn hãy liên hệ nền tảng để xác nhận quy tắc tính tiền |
| **E2** | function calling không kích hoạt / chế độ JSON không có tác dụng | Mô hình không hỗ trợ tính năng đó | Kiểm tra riêng ở Bước 5; đừng phụ thuộc vào tính năng không được hỗ trợ, hãy có phương án giảm cấp trong sản phẩm |
| **F1** | `400` kèm thông báo kiểu «thông báo» bằng tiếng Trung | Nguồn cung cấp thượng nguồn thay đổi tạm thời (nhà cung cấp gửi thông báo trong nội dung lỗi), không phải do bạn sai | Sau khi xác nhận định dạng yêu cầu của bạn không sai, hãy liên hệ nền tảng kèm nguyên văn lỗi |

<Callout type="idea">
  Hai kinh nghiệm đáng nhớ: khi gặp «không có kênh khả dụng / không tìm thấy mô hình», hãy kiểm tra tên mô hình thật bằng `GET /v1/models` trước, rồi liên hệ nền tảng — **90% trường hợp «mô hình không dùng được» đều do hai nguyên nhân này, không phải do mã**. Khi gặp `401` / `403`, hãy kiểm tra trạng thái khóa và danh sách IP trước, rồi mới kiểm tra Base URL — **phần lớn sự cố xác thực đến từ «sao chép thiếu / sai địa chỉ / chưa tắt giới hạn»**.
</Callout>

### Xử lý lỗi 400 (Bad Request)

`400` nghĩa là «bản thân yêu cầu có vấn đề»: máy chủ đã nhận yêu cầu nhưng nội dung hoặc tham số không hợp lệ nên bị từ chối. Nó khác với xác thực (401), hạn mức (403) và giới hạn tần suất (429).

Trước tiên hãy xác định nguồn gốc dựa trên cách diễn đạt của thông báo:

| Nội dung bạn thấy | Thường đến từ | Cần làm gì |
| --- | --- | --- |
| Tiếng Trung, giọng như thông báo của nền tảng | Nền tảng kiểm tra yêu cầu trước khi chuyển tiếp | Sửa tham số yêu cầu theo hướng dẫn |
| Tiếng Anh, giọng như lỗi của OpenAI / Claude / Gemini | Nhà cung cấp thượng nguồn (tham số không phù hợp yêu cầu của mô hình đó) | Sửa tham số theo hướng dẫn (ví dụ bổ sung messages, đưa giá trị về trong giới hạn) |
| Tiếng Trung, giọng như «thông báo» | Nguồn cung cấp thượng nguồn thay đổi tạm thời | Không phải lỗi của bạn — liên hệ nền tảng kèm nguyên văn lỗi |

Các lỗi 400 thường gặp từ phía nền tảng:

| Nội dung bạn thấy | Ý nghĩa | Cách xử lý |
| --- | --- | --- |
| `Invalid request: <chi tiết>` | Nền tảng kiểm tra body của yêu cầu thất bại | Đọc phần sau dấu hai chấm và sửa theo đó |
| `Invalid request: unable to determine which model you want to use.` | Không phân tích được mô hình cần dùng | Kiểm tra `"model": "<tên mô hình>"` đã được điền đúng chính tảa |
| `model field is required` | Thiếu trường `model` | Bổ sung tham số `model` |
| Thông báo «không phải JSON hợp lệ» | Body của yêu cầu có cú pháp JSON sai | Kiểm tra dấu nháy, dấu phẩy, ký tự thoát, nhất là với tiếng Việt và ký tự xuống dòng |

<Callout type="info">
  Nếu thấy các thông báo kiểu «cấu hình mô hình» hoặc «chưa cấu hình giá», đó là vấn đề phía nền tảng — hãy liên hệ họ, bạn không cần sửa yêu cầu.
</Callout>

Các lỗi 400 thường gặp từ mô hình thượng nguồn:

- `messages is required` / `messages must be a non-empty array` — thiếu `messages` hoặc mảng rỗng
- `temperature must be between 0 and 2` / `max_tokens too large` — tham số vượt giới hạn
- `Unknown parameter: 'xxx'` — đã gửi trường mà mô hình không hỗ trợ
- `1 validation error for ...` — kiểu của trường hoặc trường bắt buộc không khớp

Chẩn đoán trong 30 giây (thêm `-i` cho curl để xem phản hồi đầy đủ):

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<tên mô hình>","messages":[{"role":"user","content":"hi"}]}'
```

Hãy chú ý trường `message` trong phản hồi — thường đã ghi rõ nguyên nhân trực tiếp.

## Danh sách kiểm tra trước khi lên production

Sao chép danh sách dưới đây và tick từng mục trước khi chuyển traffic production:

- [ ] **Địa chỉ cơ sở** đã được cố định trong cấu hình (biến môi trường / trung tâm cấu hình), không hard-code ở front-end.
- [ ] **Khóa API** đã sao chép đầy đủ từ bảng điều khiển, trạng thái «đang bật», chưa hết hạn và hạn mức đủ dùng.
- [ ] Nếu khóa bật danh sách IP, IP đầu ra của máy chủ production đã được thêm.
- [ ] `GET /v1/models` trả về mô hình mục tiêu và `id` khớp với mã nguồn bạn viết.
- [ ] Đối thoại không streaming chạy được, lấy được `content` và `usage`.
- [ ] Streaming (SSE) chạy được, phân tích được các mảnh `data:` và `[DONE]`.
- [ ] Mọi **tính năng nâng cao** mà sản phẩm phụ thuộc (tools / JSON / thị giác / ngữ cảnh dài) đã được kiểm tra riêng.
- [ ] Đã ghi lại mốc độ trễ (TTFT / tổng thời gian) và đáp ứng SLA của bạn.
- [ ] Client đã có cơ chế **thử lại có backoff khi bị giới hạn** và **thử lại dự phòng khi thượng nguồn trả 5xx**.
- [ ] Phản hồi lỗi được xử lý theo cấu trúc qua `error.message` / `error.code` / mã HTTP, và không ghi thông tin xác thực vào nhật ký.
- [ ] Mức trừ hạn mức đã được đối chiếu với trường `usage` và khớp với dự kiến.
- [ ] Môi trường production không in ra và không commit khóa API (đã dùng trình quản lý bí mật hoặc biến môi trường).
- [ ] Đã xác nhận với nền tảng về **khả năng sử dụng và quy tắc tính tiền** của mô hình mục tiêu.

## Phụ lục

### Tổng quan các giao diện được hỗ trợ (chủ yếu tương thích OpenAI)

| Khả năng | Phương thức và đường dẫn | Ghi chú |
| --- | --- | --- |
| Liệt kê mô hình | `GET /v1/models` | Xem các mô hình bạn được dùng sau khi xác thực |
| Xem mô hình | `GET /v1/models/:model` | Thông tin của một mô hình |
| Đối thoại | `POST /v1/chat/completions` | Giao diện chính; hỗ trợ stream / tools / thị giác |
| Hoàn thiện văn bản | `POST /v1/completions` | Hoàn thiện kiểu cũ (một số mô hình hỗ trợ) |
| Vector | `POST /v1/embeddings` | Chuyển văn bản thành vector |
| Hình ảnh | `POST /v1/images/generations`, `/v1/images/edits` | Tạo ảnh từ văn bản / chỉnh sửa ảnh |
| Âm thanh | `POST /v1/audio/transcriptions`, `/translations`, `/speech` | Chuyển giọng nói / dịch / tổng hợp giọng nói |
| Xếp hạng lại | `POST /v1/rerank` | Xếp hạng lại kết quả truy xếp |
| Kiểm duyệt | `POST /v1/moderations` | Kiểm tra an toàn nội dung |
| Claude gốc | `POST /v1/messages` | Xác thực bằng `x-api-key` |
| Giọng nói thời gian thực | `GET /v1/realtime` (WebSocket) | Chế độ Realtime |
| Gemini gốc | `/v1beta/models/*` | Xác thực bằng `x-goog-api-key` |
| Mức sử dụng / đăng ký | `GET /v1/dashboard/billing/usage`, `/subscription` | Tự tra cứu hạn mức |

### Định dạng phản hồi lỗi thống nhất

Mọi lỗi API của nền tảng đều theo cấu trúc kiểu OpenAI, giúp client xử lý thống nhất:

```json
{
  "error": {
    "message": "lý do lỗi dễ hiểu",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "mã lỗi, tùy chọn",
    "param": "tên tham số có vấn đề, tùy chọn"
  }
}
```

Kết hợp với mã HTTP (401 xác thực / 403 hạn mức hoặc quyền / 404 mô hình / 429 giới hạn tần suất / 5xx thượng nguồn) sẽ bao phủ hầu hết logic xử lý của client.

### Nhắc nhở bảo mật (bắt buộc)

- **Khóa API chính là mật khẩu**: chỉ dùng ở máy chủ hoặc trong trình quản lý bí mật, tuyệt đối không gửi xuống trình duyệt, không ghi bản rõ vào nhật ký, không commit vào Git.
- **Che thông tin trong nhật ký**: nhật ký kiểm toán của nền tảng không ghi khóa của bạn ở dạng rõ, nhưng khi client của bạn tự in phản hồi, hãy tránh ghi header `Authorization` vào nhật ký.
- **Giới hạn tần suất và thử lại**: hãy cài đặt thử lại có backoff, tránh để một đợt thử lại dây chuyền biến giới hạn tần suất thành sự cố toàn diện.
