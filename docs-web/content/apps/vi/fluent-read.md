# FluentRead - Plugin dịch thuật mã nguồn mở

> **Tùy chọn cài đặt trò chuyện**
>
> Trong System Settings -> Chat Settings của bảng điều khiển Uter, bạn có thể thêm
>   các tùy chọn lối tắt sau để điền dễ dàng một cú nhấp vào FluentRead trên
>   trang Token Management:

    ```json
    { "流畅阅读": "fluentread" }
    ```

> 🌊 FluentRead là một plugin dịch thuật trình duyệt mã nguồn mở, được dành riêng
>   để mang lại trải nghiệm đọc giống bản địa.

- Địa chỉ dự án: [https://github.com/Bistutu/FluentRead](https://github.com/Bistutu/FluentRead)

## 🌟 Tính năng cốt lõi

### Công cụ dịch thông minh

- **Hỗ trợ đa công cụ**: Hỗ trợ 20+ công cụ dịch
- **Dịch truyền thống**: Microsoft Translate, Google Translate, DeepL Translate, v.v.
- **Mô hình AI lớn**: OpenAI, DeepSeek, Kimi, Ollama, v.v.
- **Công cụ tùy chỉnh**: Hỗ trợ cấu hình dịch vụ dịch tùy chỉnh

### Trải nghiệm đọc đắm chìm

- **So sánh song ngữ**: Văn bản gốc và bản dịch hiển thị cạnh nhau để dễ đọc hơn
- **Chọn để dịch**: Chọn bất kỳ văn bản nào để nhận kết quả dịch tức thì
- **Sao chép một cú nhấp**: Nhanh chóng sao chép văn bản đã dịch để tăng hiệu quả đọc
- **Dịch toàn trang**: Dịch toàn bộ trang web chỉ với một cú nhấp qua nút nổi, không cần làm mới trang

### Quyền riêng tư và tùy chỉnh

- **Bảo vệ quyền riêng tư**: Tất cả dữ liệu được lưu trữ cục bộ, mã nguồn mở và minh bạch
- **Tùy chỉnh cao**: Nhiều tùy chọn tùy chỉnh để đáp ứng nhu cầu các kịch bản khác nhau
- **Hoàn toàn miễn phí**: Mã nguồn mở và miễn phí, dự án phi thương mại

## 📦 Phương thức cài đặt

| Trình duyệt     | Phương thức cài đặt                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome**  | [Chrome Web Store](https://chromewebstore.google.com/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/djnlaiohfaaifbibleebjggkghlmcpcj?hl=zh-CN&authuser=0) \| [Mirror nội địa](https://www.crxsoso.com/webstore/detail/djnlaiohfaaifbibleebjggkghlmcpcj) |
| **Edge**    | [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/kakgmllfpjldjhcnkghpplmlbnmcoflp?hl=zh-CN)                                                                                                |
| **Firefox** | [Firefox Add-ons Store](https://addons.mozilla.org/zh-CN/firefox/addon/%E6%B5%81%E7%95%85%E9%98%85%E8%AF%BB/)                                                                                                                                         |

## 🚀 Phương thức cấu hình

### Nhập cấu hình từ bảng điều khiển Uter (Khuyên dùng)

Sau khi cài đặt plugin FluentRead trong trình duyệt, việc mở bảng điều khiển Uter -> trang Token Management sẽ hiển thị lời nhắc thêm FluentRead.

![thêm gợi ý](/apps-assets/fluentread/hint.webp)

Sau khi chọn một mô hình, nhấn 'One-click fill to FluentRead', và một cửa sổ xác nhận sẽ bật lên. Hãy kiểm tra xem thông tin tương ứng có chính xác không.

![xác nhận](/apps-assets/fluentread/confirm.webp)

Sau khi xác nhận nhập, cấu hình Uter trong FluentRead sẽ được bật.

![kết quả cấu hình](/apps-assets/fluentread/fluentread.webp)

### Tự điền cấu hình thủ công trong FluentRead

![cấu hình thủ công](/apps-assets/fluentread/configuration.webp)

| Mục cấu hình  | Nội dung                                 |
| ------------------- | --------------------------------------- |
| Dịch vụ dịch | Uter                                  |
| Access Token        | Key Uter                              |
| Uter Endpoint     | Địa chỉ triển khai Uter (không có /v1) |
| Model               | Chọn từ danh sách, hoặc mô hình tùy chỉnh       |
| Custom Model        | Tên mô hình                              |
