# C1 — Android local, 28/10/2026

Ảnh PNG gốc và XML từ emulator-5554, Pixel3a Android13/API33; `com.mobile.dev` dùng source Metro local, không dùng APK production làm bằng chứng. Native debug đã cài27/10, không build lại. Nest/MySQL QA riêng trên loopback; tài khoản4/ví4, chỉ dữ liệu thử. Không thay đồng hồ, production app, server ổn định hoặc website.

## Các mốc đã quan sát

- 00–15: thoát tài khoản QA cũ, đăng nhập fixture riêng. Native mirror được xóa khi đăng xuất; mật khẩu luôn che. Không có ảnh16 vì thao tác tìm nút thất bại.
- **17 là lỗi RenderError/useAuth sau Fast Refresh khi sửa source, không phải ảnh đạt.** 18 đã phục hồi; 19–22 dùng Full Reload và chờ dashboard ổn định. 21 là trạng thái tải. Không sửa AuthProvider hoặc tuyên bố đã sửa lỗi bản release. Các ảnh thao tác ngay sau bấm có thể còn frame cũ; dùng mốc ổn định kế tiếp và XML để kết luận.
- 23–28: vào Tài khoản → Hóa đơn định kỳ; book tài khoản mới rỗng, không tự tìm lịch sử.
- 29–36: tạo Internet QA100.000đ qua form; tổng30ngày100.000đ.
- 37–44: tạo Video QA89.000đ; **44 tổng189.000đ,2kỳ/2lịch**,28/10–26/11. Đây là mức dự kiến người dùng đặt, không tự tăng lên219k khi có cảnh báo. Chưa liên kết khoản đã chi nên vẫn được tính.
- 45–49: bấm Kiểm tra,46là tải;47lịch sử9/9,48–49mở **Cần xem lại(2)**.
- 50–51: Video có hai ID20/21, mỗi khoản89.000đ ngày28/10; cảnh báo chỉ nghi ghi lặp, có thể là hai khoản riêng.
- 52–56: Đã kiểm tra Video,53ổn định còn1cảnh báo. Internet trung vị100k, mới130k, tăng30k/30%;54–56mở bốn nguồn ID13–16 và ngày/tiền gốc.
- 57–60: Đã kiểm tra Internet,59–60xác nhận **Cần xem lại(0), Đã kiểm tra(2)**. Cuộn được giữ sau nội dung co lại;58ở vị trí thấp không dùng làm bằng chứng tiêu đề.
- 61–63: mở nhóm đã kiểm tra, xem Video và Hiện lại Video. Những lựa chọn này không phải xác nhận đã trả; native handledPeriodCount vẫn0.
- 64 là đưa task trở lại foreground, **không phải cold restart**, dù tên ảnh là process-restart. `am kill` không dừng tiến trình1357; thử run-as kill báo unknown pid và kiểm lại tiến trình vẫn còn. Không tính hai thử nghiệm này là đạt lưu qua khởi động tiến trình. 65–67trở lại màn, lịch sử đã được bỏ khi ra nền; cần bấm tìm lại. Lưu qua khởi động lại service được kiểm thử trong Jest, còn cold restart Android C1 chưa nghiệm thu.
- 68–71: tìm lại9/9 sau ra nền, giữ **Cần xem lại(1), Video**; Internet vẫn thuộc nhóm đã kiểm tra. Không có ảnh72 vì nút chưa hiện trong viewport;73cuộn rồi74mở đúng nhóm,75–76Hiện lại Internet.
- 77–79: ra Tài khoản rồi mở lại Hóa đơn;78là trạng thái tải local, UiAutomator một lần null root đã thử lại, không dùng XML cũ. Tắt đúng backend QA của buổi thử, proof backend-off xác nhận127.0.0.1:3000không truy cập.
- **80–81: bấm Lịch đã tạo khi QA backend đã tắt, tổng vẫn189.000đ/2kỳ/2lịch.** Chỉ xác nhận phép tính/lịch local trong phiên đã đăng nhập, không coi toàn bộ app đăng nhập mới hoạt động offline. Cuối buổi đưa app QA ra Home, tắt Metro riêng; giữ nhắc tắt, không dừng MySQL hoặc tiến trình khác.

## Phân biệt kiểm chứng

`api-before.json` và các proof SQL cuối đợt chỉ chứa dữ liệu QA:9giao dịch và số dư1.125.000đ không đổi. Các fixture cũ được đọc lại, không reset hoặc sửa. Native proof chỉ xuất số đếm/trạng thái, không đọc token/auth. Nhắc toàn cục vẫn tắt, không có alarm hóa đơn; hai lịch không có kỳ đã xử lý.

Jest là kiểm thử mock, gồm cả lỗi lưu/nguồn đổi/hủy/ra nền/đổi tài khoản/ngày biên/ngoại tệ/tràn số; không gán những ca này cho Android nếu không có ảnh tương ứng. `test-summary.txt` chép kết quả cuối từ log kiểm thử, không chứa credential. Android dùng API/MySQL thật và các thao tác ghi lựa chọn local thật. Không có packet trace để khẳng định số request trên thiết bị; test component xác nhận dùng chung lần tải lịch sử.

Điện thoại thật, OEM/reboot/4G, ngân hàng/AI/mic/OCR không được thử trong C1. Không phát hành APK/web hoặc triển khai API mới lên server ổn định. SHA256SUMS bảo toàn byte ảnh/XML và proof; `.gitattributes` tắt chuyển đổi newline riêng thư mục này.

Tổng bằng chứng: **80PNG gốc và 80XML**. Có ảnh lỗi/loading như mô tả, không coi toàn bộ ảnh là ca đạt.
