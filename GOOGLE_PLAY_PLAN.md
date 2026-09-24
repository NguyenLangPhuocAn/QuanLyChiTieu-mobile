# Phát hành CH Play trước

> Ưu tiên cập nhật 21/09/2026: tạm hoãn phát hành cửa hàng. Thứ Sáu 25/09 thử APK kết nối từ xa tới server laptop theo [APK_REMOTE_TEST_PLAN.md](./APK_REMOTE_TEST_PLAN.md). Checklist CH Play bên dưới được giữ cho giai đoạn sau.

Cập nhật 16/09/2026. Lộ trình này thay thế ưu tiên App Store. Phiên này chỉ sửa mã nguồn và kiểm thử tự động; không mở Android, không chạy thiết bị/emulator, không upload hay phát hành.

## Phạm vi bản đầu

Thu/chi, ví, ngân sách, mục tiêu tiết kiệm có lịch góp, dự báo 1–4 tháng, kế hoạch giảm chi, chatbot hỏi đáp và gợi ý kế hoạch, nhập giọng nói, OCR thông tin hóa đơn chung. Thị trường đề xuất: Việt Nam. Chưa chốt tên công khai, package ID, loại tài khoản nhà phát triển hay mô hình Premium.

## Kiểm tra mã nguồn và việc cần làm

| Mức | Hiện trạng | Việc tiếp theo | Điều kiện đạt |
| --- | --- | --- | --- |
| P0 | `android/app/build.gradle`: release ký bằng `signingConfigs.debug` | Tạo upload key riêng, lưu an toàn ngoài Git; cấu hình release signing và Play App Signing | AAB ký bằng upload key đúng; có bản sao khóa và người chịu trách nhiệm |
| P0 | `applicationId` vẫn là `com.mobile` | Chốt package ID duy nhất trước khi tạo app trên Play Console; cập nhật native namespace và OAuth nếu đổi | Package ID trong AAB, Console và OAuth trùng nhau |
| P0 | `src/services/api.ts` chỉ có localhost/LAN | Tách cấu hình dev/production; triển khai backend và DB production, domain HTTPS, backup/restore | App Release chạy qua 4G không cần Metro, máy phát triển hoặc tunnel |
| P0 | Premium mở VNPay | Chọn Play Billing cho tính năng số, hoặc bản đầu bỏ luồng bán Premium. Không mặc định VNPay đáp ứng điều kiện thanh toán thay thế | Kiểm thử mua, hủy, pending, acknowledge, xác minh server, khôi phục và hoàn tiền |
| P0 | Xóa tài khoản hiện là vô hiệu hóa | Bổ sung quy trình xóa dữ liệu thật, ảnh và chat; thêm trang web yêu cầu xóa, nêu thời hạn và ngoại lệ lưu trữ | Người đã gỡ app vẫn gửi yêu cầu xóa được; token cũ không dùng được |
| P0 | Có Gemini và micro | Công khai dữ liệu gửi đi; xin quyền đúng lúc; đồng ý chia sẻ dữ liệu AI khi cần; ghi rõ bên xử lý và thời gian lưu | Từ chối micro/AI vẫn dùng ghi chép thủ công; không ghi âm khi về nền |
| P0 | Chatbot tạo câu trả lời bằng AI | Thêm báo cáo câu trả lời không phù hợp trong ứng dụng, kênh xử lý phản hồi và bộ lọc nội dung | Báo cáo gửi được đến nơi xử lý, có người phụ trách; không chỉ là nút giả |
| P1 | `targetSdkVersion` và `compileSdkVersion` là 36 | Giữ mức đáp ứng chính sách; xác minh artifact thực tế và mọi thư viện native | Play Console chấp nhận target; kiểm thử native 16 KB và thiết bị Android phù hợp |
| P1 | Google Sign-In đã có | Đăng ký SHA-1/SHA-256 của chứng chỉ app signing từ Play, không chỉ debug/upload key | Đăng nhập Google từ bản tải qua Play thành công |
| P1 | UI vừa đổi ở kế hoạch/tiết kiệm/chatbot | Kiểm tra màn nhỏ, chữ lớn, bàn phím, lịch góp và màn trống trên máy thật | Không cắt chữ/số tiền; nút rõ trạng thái; không cộng lẫn tiền tệ |

Các hàng trên là đánh giá từ repository, chưa phải kết quả kiểm tra một AAB production.

## Yêu cầu Google đã tra cứu

- App điện thoại mới/cập nhật hiện cần target Android 16, API 36 trở lên. Dự án đang khai báo 36, nhưng vẫn phải kiểm tra AAB. [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- Tài khoản cá nhân tạo sau 13/11/2023 phải có ít nhất 12 người tham gia thử nghiệm kín liên tục 14 ngày trước khi xin quyền production. Đạt số ngày chưa đồng nghĩa tự động được duyệt. [Thử nghiệm tài khoản mới](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).
- Tính năng số trả phí thường phải dùng Play Billing, trừ trường hợp thuộc ngoại lệ/chương trình áp dụng. Cần xác minh điều kiện theo thị trường trước khi chọn thanh toán khác. [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).
- App có tạo tài khoản cần đường dẫn xóa trong app và tài nguyên web để yêu cầu xóa tài khoản/dữ liệu. [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
- Thư viện native cần được kiểm tra khả năng hỗ trợ page size 16 KB. Không suy ra mọi thư viện đều đạt chỉ từ phiên bản React Native. [16 KB](https://developer.android.com/guide/practices/page-sizes).
- Chatbot tạo nội dung thuộc phạm vi cần rà chính sách AI, gồm cơ chế người dùng báo cáo nội dung trong app. [AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en).
- Điền Financial features declaration theo tính năng thực tế. Ghi chép vay/nợ không có nghĩa ứng dụng đang cấp khoản vay; không chọn nhầm dịch vụ tín dụng. [Khai báo tài chính](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en).

Kiểm tra lại các trang trên và thông báo riêng trong Play Console trước ngày nộp.

## Trình tự triển khai

1. **Chốt đầu vào — 1 ngày:** tài khoản cá nhân/tổ chức, thời điểm tạo tài khoản, tên ứng dụng, package ID, domain, email hỗ trợ, người giữ khóa ký, Premium có trong bản đầu hay không. Hoàn tất xác minh tài khoản và thiết bị nếu Console yêu cầu.
2. **Hoàn thiện P0 — dự kiến 5–10 ngày làm việc:** production API, xóa dữ liệu/web xóa, thông báo quyền riêng tư, báo cáo nội dung AI, quyết định và tích hợp Billing. Thời gian tăng nếu thay đổi lớn về đăng nhập hoặc thanh toán.
3. **Build và internal testing — 2–3 ngày:** tạo AAB Release, kiểm tra chữ ký, API production, crash và Google login qua Play. Không dùng APK debug để kết luận bản Play hoạt động.
4. **Closed testing:** mời nhóm thử, ghi phản hồi và sửa lỗi. Nếu thuộc diện tài khoản cá nhân mới, lên lịch tối thiểu 14 ngày liên tục với 12 tester; giữ tester tham gia khi xin quyền production. Ước lượng này tách khỏi ngày lập trình.
5. **Hồ sơ và production access — 1–2 ngày chuẩn bị, chưa tính chờ duyệt:** hoàn tất khai báo, tài khoản reviewer, mô tả kết quả thử; nộp xin quyền production nếu cần, sau đó gửi release.
6. **Phát hành:** chủ ứng dụng kiểm tra build/hồ sơ cuối cùng rồi chọn thời điểm phát hành. Theo dõi crash, ANR, lỗi API, đăng nhập và mua hàng; chuẩn bị bản sửa với versionCode mới.

Không cam kết ngày lên CH Play vì còn phụ thuộc loại tài khoản, thử nghiệm và xét duyệt.

## Build AAB trên Windows khi các P0 đã xong

Không cần Mac cho lộ trình CH Play. Chuẩn bị JDK/Android SDK đúng phiên bản dự án, upload key và cấu hình production. Các lệnh dưới đây là bước cho đợt build sau, chưa chạy trong phiên này:

```powershell
cd E:\QuanLyChiTieu\mobile
npm ci
cd android
.\gradlew.bat bundleRelease
```

Artifact dự kiến: `android/app/build/outputs/bundle/release/app-release.aab`. Trước khi chạy, thay cấu hình ký debug bằng upload key. Không ghi mật khẩu vào repository hoặc commit file keystore. Tăng versionCode mỗi lần upload mới. Lưu mapping/symbols để xử lý crash và kiểm tra native 16 KB từ artifact cuối cùng.

## Hồ sơ Play Console cần chuẩn bị

- Tên app, mô tả ngắn/dài, icon, feature graphic và screenshot từ bản Android thực tế. Không dùng bản dựng HTML thay screenshot thật để chứng minh tính năng.
- Danh mục và thông tin liên hệ; chính sách riêng tư công khai; URL yêu cầu xóa dữ liệu hoạt động.
- Data safety: lập bảng email/hồ sơ, giao dịch tài chính, ảnh hóa đơn, nội dung chat, âm thanh/dịch vụ nhận dạng, định danh và chẩn đoán nếu có. Ghi rõ mục đích, bên nhận, liên kết tài khoản, cách xóa và hành vi SDK. Không khai “không thu thập” khi backend đang lưu dữ liệu.
- App access: tài khoản demo ổn định, có dữ liệu mẫu; chỉ dẫn reviewer tới tiết kiệm, chatbot, micro, OCR và xóa tài khoản. Cung cấp qua Console, không đưa mật khẩu vào Git.
- Content rating, target audience, ads declaration, financial features và các biểu mẫu phát sinh theo Console. Nếu dùng tài sản quảng bá do AI tạo, rà yêu cầu khai báo/nhãn cho từng tài sản. [Khai báo tài sản AI](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en).

## Kịch bản QA phải chạy trước khi gửi

| Nhóm | Kịch bản |
| --- | --- |
| Cài đặt | Cài mới/cập nhật qua Play, chạy không Metro, khởi động lại, token hết hạn |
| Tài chính | Thu/chi/sửa/xóa, chuyển ví, tiền tệ khác nhau, ngân sách vượt hạn; kiểm tra người A không đọc được dữ liệu B |
| Tiết kiệm | Chưa có hạn, quá hạn, hạn hôm nay, vừa góp trong tháng, rút tiền, lịch qua năm, mục tiêu đã hoàn thành |
| Chatbot | Ba kế hoạch hướng dẫn, câu hỏi tự do, ít dữ liệu, thu thấp hơn chi, nhiều mục tiêu, AI mất kết nối, báo cáo nội dung |
| Micro/OCR | Từ chối quyền, không có dịch vụ giọng nói, tiếng Việt, mất mạng, về nền; ảnh mờ, sai tiền tệ, upload thất bại |
| Billing nếu có | Mua thành công/pending/hủy, restore, hoàn tiền, mất mạng; server xác minh trước khi mở Premium |
| Giao diện | Màn nhỏ/chữ lớn/bàn phím; scroll được lịch góp; nhãn nút dễ đọc; số tiền không bị cắt |

## Đầu ra của đợt chỉnh sửa hiện tại

UI ba màn hình giảm nền cam, bớt khung bo tròn và giảm độ đậm chữ; tiết kiệm có số thiếu, lịch góp, mức chia theo tuần và tốc độ góp lịch sử; chatbot có ba hướng kế hoạch với số liệu tính từ tài khoản. Chưa triển khai Billing, trang xóa tài khoản, backend production, báo cáo nội dung AI hoặc khóa ký release. Đây là các công việc tiếp theo, không được đánh dấu đã hoàn tất chỉ vì có tài liệu này.

App Store chuyển sang giai đoạn sau; giữ tài liệu cũ để tham khảo khi quay lại iOS.

## Kết quả xác minh mã nguồn

- Backend build thành công. Các kiểm thử savings, roadmap, financial-plans, financial-plan-reply và chatbot đã qua; có trường hợp góp đủ kỳ này rồi tải lại, rút tiền, thiếu ngày hạn, quá hạn và chuyển năm.
- Mobile TypeScript và ESLint phần sửa thành công. Test App, FinancialPlanScreen, SavingsRoadmapDetails và useVoiceInput đã qua; lịch góp mở/thu gọn được trong kiểm thử component.
- Chưa chạy UI trên Android, chưa thử micro/native hoặc tạo AAB. Kết quả này không thay thế kiểm thử thiết bị thật hay kiểm tra artifact trên Play Console.
