# LunaTranslator - Trình dịch GalGame mã nguồn mở

> **Tùy chọn cài đặt trò chuyện**
>
> Trong System Settings -> Chat Settings của bảng điều khiển
>   Uter, bạn có thể thêm tùy chọn lối tắt sau để điền một cú nhấp vào
>   LunaTranslator từ trang Token Management:

    ```json
    { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
    ```

> LunaTranslator
>   là một trình dịch visual novel (GalGame) mã nguồn mở và miễn phí, được dành riêng để mang lại trải nghiệm chơi visual novel ở mức độ bản địa.

- Địa chỉ dự án: [https://github.com/HIllya51/LunaTranslator](https://github.com/HIllya51/LunaTranslator)
- Tài liệu dự án: [https://docs.lunatranslator.org/en/README.html](https://docs.lunatranslator.org/en/README.html)

## Hỗ trợ tính năng

- **HOOK** Chủ yếu sử dụng HOOK để trích xuất văn bản game, thích ứng với hầu hết mọi visual novel phổ biến và ngách.

- **Dịch trong game** Với một số game, bản dịch có thể được nhúng trực tiếp vào game để có trải nghiệm đắm chìm.

- **Trình giả lập HOOK** Với hầu hết game trên NS/PSP/PSV/PS2, hỗ trợ trình giả lập HOOK cho phép đọc trực tiếp văn bản game.

- **OCR** Tích hợp các mô hình OCR độ chính xác cao, và hỗ trợ nhiều công cụ OCR trực tuyến & ngoại tuyến khác để đọc linh hoạt mọi văn bản.

- **Giao diện dịch phong phú** Hỗ trợ hầu hết mọi công cụ dịch, bao gồm dịch bằng mô hình ngôn ngữ lớn, dịch ngoại tuyến, v.v.

- **Học ngôn ngữ** Hỗ trợ tách từ tiếng Nhật và furigana kana, AnkiConnect và plugin Yomitan.

- **Tổng hợp giọng nói** Hỗ trợ số lượng lớn công cụ tổng hợp giọng nói trực tuyến & ngoại tuyến.

- **Nhận dạng giọng nói** Trên Windows 10 và Windows 11, có thể sử dụng Windows Speech Recognition.

## Phương thức cài đặt

Tải xuống và cài đặt từ [Tài liệu LunaTranslator - Tải xuống & Khởi chạy & Cập nhật](https://docs.lunatranslator.org/en/README.html)

## Tích hợp Uter vào LunaTranslator

LunaTranslator hỗ trợ tích hợp với Uter tự triển khai cục bộ. Vui lòng sử dụng Uter do chính bạn triển khai, hoặc đảm bảo rằng nhà cung cấp dịch vụ có ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ cho dịch vụ Uter của họ. Không kết nối địa chỉ API hoặc khóa từ nguồn không xác định vào môi trường sản xuất.

### Cấu hình một cú nhấp

1.  Trong `System Settings` -> `Chat Settings` của bảng điều khiển Uter, thêm tùy chọn lối tắt sau:

    ```json
    { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
    ```

    ![thêm_cấu_hình](/apps-assets/luna_translator/add_config.webp)

2.  Trong tab **`Uter`** -> `Console` -> `Token Management`, chọn token bạn muốn sử dụng trong LunaTranslator, nhấn tùy chọn thả xuống bên cạnh nút trò chuyện, chọn `LunaTranslator`, và bạn sẽ được chuyển hướng đến LunaTranslator với địa chỉ API và API Key được cấu hình tự động.

    ![chuyển hướng đến LunaTranslator](/apps-assets/luna_translator/jump_to_app.webp)

3.  Trong **`LunaTranslator`** -> `Settings` -> `Translation Settings` -> `Large Models`, sẽ xuất hiện một cấu hình giao diện mô hình lớn mới; nhấn Edit.

    ![cài đặt_api](/apps-assets/luna_translator/api_setting.webp)

4.  Nhấn nút làm mới cạnh menu thả xuống **model** để lấy danh sách mô hình của nền tảng Uter, chọn hoặc nhập tên mô hình, sau đó nhấn OK để lưu.

    ![cài đặt mô hình](/apps-assets/luna_translator/setting_model.webp)

5.  Kiểm tra xem công tắc chuyển bên cạnh cấu hình giao diện mô hình lớn **uter** đã được bật chưa. Nếu chưa được bật, hãy bật giao diện để bắt đầu sử dụng.

    ![bật cấu hình](/apps-assets/luna_translator/open_config.webp)

### Cấu hình thủ công

1.  Trong tab **`Uter`** -> `Console` -> `Token Management`, lấy API Key.

    ![lấy API Key](/apps-assets/luna_translator/copy_api_key.webp)

2.  Trong **`LunaTranslator`** -> `Settings` - `Translation Settings` -> `Large Models`, chọn Add.

    ![thêm API](/apps-assets/luna_translator/add_api.webp)

3.  Sao chép mẫu **Large Model General Interface** và thêm một giao diện mới.

    ![thêm API2](/apps-assets/luna_translator/add_api_2.webp)

4.  Trong **giao diện mới được thêm**, điền địa chỉ API và API Key tương ứng.

    ![cài đặt API1](/apps-assets/luna_translator/setting_api.webp)

    ![cài đặt API2](/apps-assets/luna_translator/setting_api2.webp)

5.  Nhấn nút làm mới cạnh menu thả xuống **model** để lấy danh sách mô hình của nền tảng Uter, chọn hoặc nhập tên mô hình, sau đó nhấn OK để lưu.

    ![cài đặt API3](/apps-assets/luna_translator/setting_api3.webp)

6.  Nhấn công tắc chuyển bên cạnh **Uter** để bật giao diện và bắt đầu sử dụng.

    ![mở API](/apps-assets/luna_translator/open_api.webp)

Để biết thêm phương thức sử dụng, vui lòng tham khảo tài liệu chính thức của LunaTranslator: [Tài liệu LunaTranslator - Giao diện dịch mô hình lớn](https://docs.lunatranslator.org/en/guochandamoxing.html)
