# QA Danh mục offline — 20–21/11/2026

## Môi trường và cách tạo mất kết nối

- Android emulator `emulator-5554`, app QA `com.mobile.dev` chạy JS từ Metro local. API cổng 3303 dùng MySQL QA tách biệt. Ngắt `adb reverse tcp:3303` để mô phỏng API không truy cập được trong khi Metro vẫn hoạt động; nối lại đúng cổng đó. Không sửa production.
- Tài khoản QA được chuyển tạm từ BASIC sang PREMIUM để kiểm tra danh mục cá nhân, rồi đã trả về BASIC. Tên danh mục thử `QAOfflineNov20`; không dùng dữ liệu cá nhân.

## Các bước và kết quả

1. Mở [form tạo danh mục](13-offline-create-form.png), ngắt API rồi lưu danh mục Chi `QAOfflineNov20`. App báo dữ liệu được giữ trên máy; danh mục xuất hiện trong [danh sách](19-offline-category-visible.png). Force-stop và mở lại app khi API vẫn ngắt; [danh mục còn](32-category-survived-restart.png).
2. Nối API và đưa app trở lại foreground. Màn [đối chiếu](34-reconnect-choice.png) hiển thị danh mục mới và ba lựa chọn bản máy, bản máy chủ hoặc để sau. Chọn bản máy; app [báo lưu thành công](36-sync-result.png). MySQL QA có đúng một danh mục mới, ID 39, `is_active=true`.
3. Ngắt API, sửa danh mục trên máy. Khi nối lại, màn [đối chiếu sửa](45-edit-review-shown.png) hiện tên trên máy và tên trên máy chủ. Chọn bản máy; app [báo thành công](47-edit-synced.png). MySQL QA ghi ID 39, tên `qaofflinenov20edit`.
4. Ngắt API, xóa cùng danh mục. Khi nối lại, [đối chiếu xóa](55-delete-review-shown.png) hiện bản máy chủ trước khi xác nhận. Chọn bản máy; app [báo thành công](57-delete-synced.png). MySQL QA giữ ID 39 nhưng `is_active=false`, không còn trong danh sách đang dùng.
5. API QA riêng kiểm mã chống trùng: hai lần POST cùng `client_request_id` trả cùng ID; đổi nội dung với cùng mã và sửa/xóa dựa trên bản gốc cũ trả 409. 14 ca Jest backend và HTTP QA đạt. 7 ca Jest hàng chờ mobile kiểm gửi lại sau mất phản hồi, xung đột, khóa xóa danh mục đang dùng bởi giao dịch chờ, và gửi giao dịch sau khi ID tạm được đổi sang ID server.

## Giới hạn

- Ngắt API, không tắt Wi-Fi/dữ liệu hoàn toàn vì bản debug cần Metro. Chưa kiểm trên APK độc lập hoặc điện thoại thật.
- Chưa thử xung đột danh mục và giao dịch dùng danh mục mới trên UI Android; các tình huống đó đã có ca Jest/backend QA. Chưa thử icon tải lên khi offline: UI chặn chọn icon trong chế độ này và nêu rõ có thể thêm khi có mạng.
- Backend mới và migration chỉ áp dụng cho MySQL QA; backend production, APK phát hành và web tải APK chưa thay đổi.

## SHA-256 ảnh gốc

```text
13-offline-create-form.png DC216AD5E0D9BBE53C3145FB9739E3F1D17CCBC4CD016B7E000F46A680F825A9
19-offline-category-visible.png E97004FE3CBEC42C08632F6E4529040F33C294144C1C828FA122AA42EAA603A8
32-category-survived-restart.png 92877F9DBA504ADD862814DA6CA4F875120B94E43656D7B60EEE1BBAC4E2844C
34-reconnect-choice.png CDDA19F7274FA7537980609294921A14362F58971D968C3330351ADC2144B70D
36-sync-result.png 881033811177B490A2D01F28AC5AB9ACB656B2CFCCB66BC460D4A57807E22EFE
45-edit-review-shown.png B5B14AFB66162E11F4D074643696CB1DC9FCF214D2924F4672989E574A845860
47-edit-synced.png 47A433A58063C8EEB800516539A6AD89DA8B71B66592319BC6FE4DD2BFD8C2E7
55-delete-review-shown.png 788DCB25F879B1C9DFA0C1D6CCFB26E2691CDD75E242EDA82BFB0E4E5472728C
57-delete-synced.png 1003A4CF09C601AEF1734BEC6A7A15FC51349F26396BA3DC987E96BE4EBDBAB5
```
