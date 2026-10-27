# QA nhắc hóa đơn — 27/10/2026

Pixel3a emulator Android13/API33, app debug riêng com.mobile.dev từ source/Metro local. Nest/MySQL QA riêng, tài khoản và giao dịch giả. Không thử APK production hoặc điện thoại vật lý. Ảnh PNG gốc do ADB screencap, không ghép hoặc vẽ lại. Manifest SHA-256 đi kèm để đối chiếu.

## Bằng chứng chính

| Bước/ảnh | Thao tác và kết quả |
|---|---|
| 00–08 | Khởi động/chờ/lỗi Metro dev. Chưa tính đạt. Xác định MultipartStreamReader ProtocolException; QA Metro dùng bundle thường, không thay cấu hình production. |
| 09–13 | Session phục hồi, vào Tài khoản/Hóa đơn định kỳ. Nhắc mặc định tắt. |
| 14–15 | Từ chối POST_NOTIFICATIONS: không bật ngầm, hiện hướng dẫn. |
| 16–18 | Bật lại, rationale và quyền Android; native đã đồng bộ, có alarm. |
| 19–25 | Tạo Internet QA120.000đ, lịch tháng27/10. Không tạo khoản chi. |
| 26–33 | Tạo Phi dich vu QA90.000đ, lịch tháng27/10. Bước32/33 có thao tác tool chồng thời gian; chỉ ảnh cuối/book/native là bằng chứng lưu, không dùng XML32 làm bằng chứng độc lập. |
| 34–41 | Chọn giờ15:56. Dump34 có cây cũ do lỗi Android; PNG giữ nguyên. Bước35 chụp lại picker thật. Driver sau đó đã thêm retry/focus guard. |
| 42–44 | Home rồi am kill com.mobile.dev trước giờ hẹn, pid không còn. 43 còn chờ; 44 khoảng15:57 nhận thông báo thật gộp2khoản. Native ledger0→2, không phát broadcast thử hoặc chỉnh đồng hồ. |
| 45–46 | Lỗi: bấm thông báo lại mở Tổng quan, chưa đạt. Đã sửa MainActivity.onNewIntent/setIntent và intent filter bills; giữ ảnh lỗi. |
| 47–57 | Giai đoạn chờ/debug điều hướng. 49–50 vào nhầm danh mục;53–54 mở nhầm form thêm giao dịch trống do row nằm gần nút nổi;55–56 về launcher. Không điền/lưu khoản tiền. 57 replay intent thất bại trước khi thêm host bills, không tính thành công. |
| 58–59 | Replay intent chẩn đoán sau sửa host/category được Android chấp nhận, mở nhóm ngày27/10. Đây là **synthetic**, không dùng thay bằng chứng bấm thông báo thật. |
| 60–68 | Xem tất cả, mở lịch, sửa Internet QA qua28/10 bằng date picker và lưu. Tạo mốc trước1ngày mới hôm nay, ledger2→3. |
| 69–72 | Thông báo thật mới hiện2khoản. Bấm trên khay70 mở đúng nhóm: Phi dịch vụ27/10 và Internet28/10. 71 có banner Refreshing của debug,72 chụp lại. |
| 73–75 | Bỏ qua Phi dịch vụ bằng xác nhận. Nhóm còn Internet; native handled2→3. SQL giữ2giao dịch/ví6.590.000đ. |
| 76–79 | Thoát bộ lọc và tắt nhắc qua UI. Native enabled=false, postedDay=null, alarmVisible=false. |
| 80–85 | Cài lại debug có desugar, chờ bundle. Metro QA không trả lời status nên khởi động lại đúng tiến trình QA; status chạy lại. Mở Dev Menu và chọn Reload. Đây là ảnh chờ/công cụ dev, chưa tính là màn chức năng đạt. |
| 86–94 | Đổi host debug sang localhost:8081 qua ADB reverse theo hướng dẫn Dev Menu. HTTP local trả bundle200; phiên tải cũ còn treo sau khi đổi Metro. Home, chờ vào nền, am kill xác nhận tiến trình cached đã dừng rồi mở lại. 93–94 vẫn đang chờ render, không tính đạt. |
| 95 | Tổng quan thật sau cài desugar và phiên source local mới: tài khoản QA, ví QA và2khoản chi giữ nguyên. Native ledger3/handled3, nhắc vẫn tắt. |

Các tên file là tên lúc chụp, có thể chưa phản ánh kết quả quan sát; bảng này phân biệt đúng ca lỗi, chờ và ca đạt. XML là dump ngay trước screencap nên chuyển cảnh có thể làm nội dung lệch thời điểm; không dùng XML thiếu node để suy diễn. Không coi số lượng ảnh là số ca kiểm thử.

## Kiểm tra khác

- Jest72/72 qua8bộ,56,326giây; planner JVM thật10/10; MetroQA3/3; TypeScript noEmit/ESLint file đổi max-warnings0 đạt. Không chạy toàn bộ app/backend hoặc Gemini thật trong batch này.
- Native debug cuối có coreLibraryDesugaring2.1.5 build/install thành công8phút11giây/284tasks, JVM planner10/10. Bản trước cấu hình này đạt4phút6giây/283tasks. Cài đè debug giữ ledger đã gửi; bản com.mobile production giữ nguyên. Chưa thử API24/25 trực tiếp.
- database-before/after.json do inspector chỉ đọc DB QA, xác nhận từng ID/khoản tiền/nội dung không đổi. Native proof chỉ giữ số đếm, không token/owner hash/nội dung tiền.
- Chưa thử máy vật lý, reboot/OEM/Doze dài ngày, logout trực tiếp trên thiết bị, thay đổi số đếm khi thông báo vẫn còn trên khay. Đổi tài khoản/race đã có unit test; không thay thế nghiệm thu máy thật.
- Không phát hành APK, sửa web tải hoặc server ổn định. Cấu hình nhắc QA đã trả tắt trước khi kết thúc.

Source và giới hạn chi tiết: [BILL-REMINDERS](../../BILL-REMINDERS.md).
