# Ví cuộn ngang và font số tiền — 30/10/2026

- Dùng thẻ ví rộng138dp theo MainScreen: icon, tên một dòng, số dư theo tiền tệ, viền/nền cam khi chọn. Vuốt ngang trực tiếp trong form, không có màn chọn trung gian. Giữ lọc ví tiết kiệm của Vay/Nợ và không tự chọn ví đầu.
- Ô số tiền có nhãn riêng/placeholder0, font28/600/tabular-nums, căn giữa theo chiều dọc và đơn vị tiền13 ở bên phải. Giữ nguyên chuẩn hóa VND/ngoại tệ, payload và bước xác nhận/chống trùng.
- Android13 com.mobile.dev/source Metro8081/API3302/MySQL QA8. 00 đang Fast Refresh, không tính là ảnh sẵn sàng;01 vuốt sang các ví cuối,02 chọn Ví tiền mặt,03–04 nhập1.250.000/đóng bàn phím và xem font,05 vuốt ngược,06 preview vẫn đúng Ví tiền mặt/−1.250.000.07 đóng chưa lưu về launcher,08 mở form rỗng để bàn giao local.
- PNG/XML gốc, không sửa ảnh. Chỉ xem trước, không bấm Xác nhận lưu. sql-unchanged.json đối chiếu sâu với kết quả SQL đợt form trước:4ví,tx27–30,loan1–2/ví8=1.023.750đ đều giữ nguyên. Không tạo dữ liệu QA mới.
- Jest20/20 WidgetQuickEntry (hồi quy hiện có), TypeScript noEmit/ESLint exit0. Không thêm test chỉ kiểm style. Không chạy lại49test hoặc bộ backend và không coi các kết quả cũ là kiểm thử mới.
- Không đổi native/dependency/build/cài/phát hành APK, không sửa .env/web hoặc deploy/restart server ổn định. Chưa thử máy thật/OEM/font lớn hoặc model OCR/mic thật trong đợt giao diện này.
