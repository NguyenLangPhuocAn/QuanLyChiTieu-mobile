# Nova Mini 1×1 — 29/10/2026

## Thay đổi

Thêm NovaMiniWidgetProvider và metadata/layout1×1 riêng, nút N+48dp màu cam theo theme. Mini không hiển thị số tiền, không chạy cập nhật định kỳ. Widget đầy đủ4×2 vẫn có. Đây là hai lựa chọn trong launcher; không hứa nút thu gọn có thể tự trả ô đã chiếm cho launcher.

Mini dùng cùng entryIntent/khung NovaWidgetEntryActivity: Thu/Chi, danh mục đầy đủ từ tài khoản, chọn ví, mic/camera, xem trước/xác nhận. Không tự ghi tiền. Bộ validEntry lấy ID widget còn sống từ cả hai provider, vẫn kiểm scope và nonce riêng. Kế thừa xóa nonce/lựa chọn khi widget bị xóa. Không xin quyền vẽ đè ứng dụng khác. Nút thêm widget trong Dữ liệu và xuất nhập mở lựa chọn Mini/Bản đầy đủ rồi yêu cầu launcher xác nhận.

## Môi trường và bước thử

Pixel3a Android13 API33 x86_64, com.mobile.dev build debug mới, source local/Metro8081/API QA3301 và MySQL schema QA loopback hiện có. Đăng nhập QA8, không dùng dữ liệu thật. Không đổi backend/.env/server production3000.

- 00–06: trạng thái trước cập nhật và mở danh sách launcher/tìm Nova. Danh sách có Nova Mini1×1 và Thu chi nhanh4×2; preview chưa có phiên nên dòng đăng nhập ở preview đầy đủ là dữ liệu layout, không phải lỗi phiên thật.
- 07–08: nhấn giữ preview mini để thêm lên launcher. 07 là khung chọn vị trí, 08 là icon mini đã đặt một ô; vùng bấm48dp. Không phải một ảnh mô phỏng.
- 09–10 là khung native trong suốt khi bundle debug còn đang tải, chưa phải form đã sẵn sàng. Có UiAutomator null-root lúc chuyển màn, driver thử lại và không lấy XML cũ. Chỉ11 mới thấy form. topResumedActivity xác nhận NovaWidgetEntryActivity, không phải MainActivity.
- 12–14 chuyển Thu và mở bộ chọn đủ5danh mục/icon của QA8; quay lại vẫn Thu. 15 Hủy về launcher; 16 chạm mini mở lại form Chi trống, không tự chọn ví hoặc giữ bản đã hủy. 17 Đóng về launcher.
- 18/20/25 là ảnh chuyển màn. 19/21/24/26 là trạng thái đã tải: mở MainActivity để vào Tài khoản → Dữ liệu và xuất nhập. 26 lúc đầu cache chưa tải xong;29 đã hiện0giao dịch/cập nhật trên máy.
- 27 chọn kiểu widget trong app.28 chọn Mini → launcher xác nhận đúng1×1/icon N+;29 hủy thao tác ghim, không thêm mini thứ hai.
- 30–32 chọn Bản đầy đủ → launcher xác nhận đúng4×2 → Add to home screen.33 tên file “both-widgets-home” đặt theo dự kiến, nhưng ảnh thực tế là trang launcher có hai widget đầy đủ (một cũ/một mới), mini ở trang bên cạnh. Không lấy tên file làm bằng chứng hai kích thước cùng trang.
- 34–35 chạm nút Thêm giao dịch của bản đầy đủ mới: vẫn mở đúng khung nhập riêng.36 Hủy về launcher.37 vuốt về trang chứa mini.

Chỉ mở/đổi loại/chọn danh mục/Hủy/Đóng, không xác nhận lưu giao dịch mới. SQL trước/cuối QA8 đều0giao dịch, ví1.000.000đ và12Chi/5Thu. SQL fixture QA7 trước đó giữ3giao dịch/ví1.030.000đ. Không reset/migrate hoặc seed tài khoản thật.

## Kiểm tra và giới hạn

Jest92/92 qua12bộ hiện có, không thêm test mô phỏng giao diện mini. TypeScript noEmit và ESLint hai file TS thay đổi exit0. Native installDebug/testDebugUnitTest QA x86_64 đạt2m28s; sau chỉnh resource nút48dp cài lại thành công36s. JVM11/11 thuộc BillReminderPlannerTest hiện có, không phải11test mini mới. Build log và Jest được giữ, không lưu log native chứa URI/nonce.

Chưa thử điện thoại vật lý/launcher OEM/font lớn hoặc hiệu năng release. Lượt mở nguội debug đã chờ tải bundle Metro lâu; mở lại được nhưng không dùng lượt này để kết luận tốc độ production. Mic/OCR dùng luồng cũ, không gọi model thật trong đợt này; khóa Gemini của QA rỗng. Không kiểm lại ghi tiền/offline bằng tiền thử mới vì đường lưu không đổi; bằng chứng thực tế của đường lưu ở đợt widget-popup.

Không phát hành APK production, ký release, chạy workflow release, cập nhật web tải hoặc restart3000. Health cuối200. Excel chỉH21/I21 và chiều cao hàng21 được cập nhật, các giá trị/công thức/định dạng/cấu hình khác được so sánh giữ nguyên. Giữ backendQA/Metro chạy để thử local.
