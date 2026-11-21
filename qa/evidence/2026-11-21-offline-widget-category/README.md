# QA widget với Danh mục mới khi API ngắt — 21/11/2026

## Môi trường

- Android emulator `emulator-5554`, bản debug QA `com.mobile.dev` chạy Metro local, backend và MySQL QA riêng ở cổng 3303. Ngắt `adb reverse tcp:3303` để mất API nhưng vẫn giữ Metro; đây chưa phải bài thử tắt hẳn Wi-Fi/4G trên APK độc lập.
- Tài khoản thử `qa.bills@example.test` được nâng tạm PREMIUM để tạo Danh mục cá nhân. Sau thử, vai trò trả về BASIC. Dữ liệu chỉ nằm trong DB QA; backend production không thay đổi.

## Bước thử và kết quả

1. Khi API ngắt, tạo Danh mục Chi `QAWidgetOffline`; app [báo giữ trên máy](23-category-saved.png), [danh sách hiển thị](26-category-list.png).
2. Trên widget đầy đủ của launcher, [bộ chọn có danh mục mới](29-widget-category-picker-ready.png); chọn nó, [widget hiển thị tên](30-widget-selected-pending.png). [Form từ widget](32-widget-quick-entry-ready.png) giữ đúng Danh mục và ví; nhập 123 đ, [xem trước Chi −123 đ](37-widget-review.png), xác nhận. [Widget báo một giao dịch chờ](39-widget-saved-local.png).
3. Khôi phục API, khởi động lại app. [Màn đối chiếu](46-reconnect-ready.png) hiển thị cả Danh mục mới và giao dịch mới với lựa chọn bản máy, máy chủ hoặc để sau. Chọn bản máy; [thông báo thành công](48-sync-result-ready.png) ghi hai thay đổi. MySQL QA có Danh mục ID 41 và **một** giao dịch ID 63, `category_id=41`, `amount=-123`, đúng ví QA.
4. Sau đồng bộ, widget [tạm mất tên danh mục](50-widget-after-sync.png) do ID tạm đã đổi. Mã đã bổ sung ánh xạ ID đã đồng bộ sang lựa chọn native và nạp lại Danh mục khi cache thiếu ID được chọn. Khi tải lại với vai trò PREMIUM, [widget giữ tên danh mục](62-widget-category-retained.png); sau chỉnh sửa cuối cùng để tránh nạp lại mọi ID lịch sử, bản debug QA được cài lại và [widget vẫn giữ danh mục](70-widget-final-native.png). Vai trò BASIC chỉ thấy Danh mục hệ thống theo quy tắc hiện tại, nên thử này phải dùng PREMIUM.

## Giới hạn

- Bản debug QA cần Metro; chưa thử cold start khi tắt cả Wi-Fi/4G trên điện thoại thật.
- Chưa thử widget giữ lựa chọn sau khi app bị xóa dữ liệu hoặc tài khoản bị hạ gói; BASIC không hiển thị Danh mục cá nhân.
- Chưa thử giao dịch Thu từ widget với Danh mục mới, nhiều widget cùng lúc, và xung đột Danh mục trên UI Android. Các ca chống trùng và xung đột có trong Jest/API QA.

## SHA-256 ảnh gốc

```text
23-category-saved.png 3BE21BB9957447CE49252BE6349E4C2FBA8A19B8D72F02DE4410F7AEE593656C
26-category-list.png A0BC3E7F0C34FCABD00D97B82CE3084A1874712CF984DD5CB08F80A2C04F4C02
29-widget-category-picker-ready.png A7024D872CDA82E07E3C9846B888D06073500D0EFCCC9EBDD210F7F5D8A8B76C
30-widget-selected-pending.png 4416C0F52F6775D46B80B1AF5F30BB6650F47731F174B1E1208B83A62F2EE07B
32-widget-quick-entry-ready.png 793B31640EB87A67476A53DA78BB51F155B536222BF9B49C1F8E1C0C7A5E1C6D
37-widget-review.png D99F94CBB7C937D101D37DE039F0EFAAE4FF45659CECA84A46E8D9BAB8EF283D
39-widget-saved-local.png 04AA0061828D66F56C6B1DDD1503CF7F0805B62ECF0412D1AD223E33E79E60B8
46-reconnect-ready.png 29996226CD3F0348F52A86C69FBC4EADCE50B6B3DEF0D0BC3E9A096ED7E0F525
48-sync-result-ready.png 537C44546F44997498F4BBDBA766D42BCFD50A01DEBA85ADC8BF78FAD2F3CD57
50-widget-after-sync.png 8BC1D7A13BE94B1A28B8C68546B07A0C2169BB58813C402C73AE180C5B26B19E
62-widget-category-retained.png F394F06EF24EDCC0AE82D9137B2121C6679F1F6EE6FD834EF16C542F40510E1E
70-widget-final-native.png 4B5C273D93D382964A4C285A40E00D474E02DC9A5398FAE2BC60C3D77FAB8F7B
```
