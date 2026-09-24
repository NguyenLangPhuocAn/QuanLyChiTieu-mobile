# Kế hoạch phát hành iOS lên App Store

> Đã chuyển ưu tiên sang **CH Play trước** theo yêu cầu mới. Xem [kế hoạch Google Play](GOOGLE_PLAY_PLAN.md). Tài liệu iOS này giữ lại cho giai đoạn sau, không còn là lộ trình phát hành hiện tại.

Ngày lập: 16/09/2026. Đây là kế hoạch triển khai; chưa build/archive iOS, chưa tạo bản ghi trên App Store Connect và chưa gửi duyệt. Không khởi chạy Android trong đợt chỉnh sửa này.

## Phạm vi bản 1.0

Ghi thu/chi, quản lý ví và ngân sách, mục tiêu tiết kiệm, dự báo 1–4 tháng, gợi ý giảm chi theo danh mục, chatbot nhập chữ/giọng nói, quét hóa đơn lấy thông tin chung. Giọng nói điền bản nháp để người dùng kiểm tra trước khi gửi; không lưu file ghi âm trong ứng dụng. Khoảng dự báo tính từ tháng hiện tại, dựa trên 4 tháng đã hoàn tất.

Phương án đề xuất: phát hành iPhone trước, thị trường Việt Nam, chọn phát hành thủ công sau khi được duyệt. Nếu giữ hỗ trợ iPad thì phải kiểm thử giao diện và chuẩn bị ảnh tương ứng. Chưa thay đổi các quyết định thương mại hoặc cấu hình phát hành trong mã nguồn.

## Những điểm cần hoàn thành từ mã nguồn hiện tại

| Ưu tiên | Hiện trạng đã thấy | Công việc | Tiêu chí nghiệm thu |
| --- | --- | --- | --- |
| P0 | `src/services/api.ts` chỉ có localhost/LAN | Tách cấu hình development/production; đưa backend lên tên miền HTTPS ổn định, giới hạn truy cập DB, sao lưu và kiểm tra phục hồi | iPhone qua 4G đăng nhập, lưu và đọc giao dịch; bản Release không gọi địa chỉ nội bộ |
| P0 | `AccountScreen.tsx` mở VNPay để nâng cấp Premium | Chốt bản miễn phí không có luồng mua Premium, hoặc triển khai StoreKit cho iOS. Nếu giữ gói trọn đời, thiết kế sản phẩm non-consumable, xác minh giao dịch phía server và khôi phục mua | Không cấp Premium chỉ dựa vào kết quả client; kiểm thử mua, hủy, mua lại, restore và hoàn tiền |
| P0 | Có Google Sign-In; chưa thấy luồng Apple tương đương | Thêm Sign in with Apple nếu giữ Google, hoặc chốt bản chỉ dùng đăng nhập tài khoản riêng. Kiểm tra OAuth client iOS, URL scheme và xử lý trùng email | Tạo tài khoản, đăng nhập lại, liên kết đúng người dùng và thu hồi token khi xóa |
| P0 | Có nút xóa nhưng `deactivateSelf` chỉ đặt `is_active=0`, `deleted_at` | Thiết kế xóa dữ liệu thực sự: giao dịch, ảnh, chat, ví, mục tiêu, token; nêu rõ thời hạn và ngoại lệ lưu trữ cần thiết | Tài khoản bị xóa không truy cập được; dữ liệu cá nhân được xóa/ẩn danh theo chính sách; kiểm tra cả file và bản sao lưu |
| P0 | Chatbot/OCR dùng Gemini; manifest quyền riêng tư chưa khai báo dữ liệu thu thập | Lập bản đồ dữ liệu, bổ sung màn hình đồng ý chia sẻ dữ liệu AI, chính sách công khai và cơ chế rút đồng ý | Từ chối AI vẫn dùng được ghi chép thủ công; không gửi dữ liệu AI trước khi đồng ý |
| P0 | Vừa thêm thư viện nhận dạng giọng nói `rn-speech-recognition@1.0.8` | Cài Pods, kiểm tra liên kết native với React Native 0.85.1 và thử trên iPhone thật | Quyền cho phép/từ chối, tiếng Việt, mất mạng, không có tiếng nói, rời màn hình và chạy nền đều hoạt động đúng |
| P1 | Tên hiển thị iOS còn `mobile`; có key vị trí rỗng | Chốt tên ứng dụng, Bundle ID riêng, Team, version 1.0.0 và build number; bỏ quyền vị trí nếu không dùng; rà icon và launch screen | Cài bản Release hiện đúng tên/icon, không hỏi quyền không liên quan |

Các quyết định thanh toán, đăng nhập và AI cần đối chiếu mục 3.1.1, 4.8 và 5.1.2(i) trong [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Phương án StoreKit ở trên giả định phát hành thông thường tại Việt Nam; không giả định được miễn trừ theo thị trường khác.

Apple yêu cầu luồng xóa tài khoản có khả năng xóa dữ liệu liên quan; chỉ vô hiệu hóa là chưa đủ. [Hướng dẫn xóa tài khoản](https://developer.apple.com/support/offering-account-deletion-in-your-app).

## Thứ tự thực hiện và thời gian dự kiến

Ước lượng kỹ thuật cho một người, khoảng 10–15 ngày làm việc sau khi có Mac, tài khoản và quyết định phạm vi. Chưa gồm thời gian đăng ký tài khoản, chờ xác minh hoặc Apple xét duyệt.

1. **Ngày 1: chốt đầu vào.** Chủ ứng dụng cung cấp tên, chủ thể phát hành, quyền sở hữu ảnh/icon, email hỗ trợ, domain, tài khoản Apple Developer/App Store Connect và quyền Team. Chốt giữ Premium/Google hay phát hành bản đơn giản trước. Không ghi mật khẩu, khóa ký hoặc tài khoản demo vào Git.
2. **Ngày 2–4: backend production và dữ liệu.** Chuẩn bị DB riêng; chạy các migration cần thiết sau backup; cấu hình secret ở server; bật HTTPS, log lỗi có che dữ liệu, giám sát và giới hạn yêu cầu chatbot/OCR. Hoàn thiện xóa tài khoản, đồng ý AI và chính sách lưu trữ. Kiểm tra người dùng A không xem dữ liệu B.
3. **Ngày 4–8: hoàn thiện iOS.** Tích hợp Apple login/StoreKit theo phạm vi đã chốt, thêm restore và xác minh entitlement. Cài dependency native, sửa lỗi build thực tế, cấu hình Release và Signing. Không nhúng API key Gemini hay thông tin DB vào app.
4. **Ngày 8–10: QA trên iPhone.** Kiểm tra luồng chính bằng dữ liệu thử nghiệm riêng, cả cài mới và cập nhật. Chốt lỗi phải sửa trước beta.
5. **Ngày 10–12: TestFlight.** Archive bản Release, validate và upload; chạy beta nội bộ rồi mời nhóm thử phù hợp. Thu phản hồi, kiểm tra crash, mất mạng và dữ liệu sau cập nhật. Build beta có thời hạn sử dụng; theo dõi trạng thái và yêu cầu xét duyệt beta trong [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).
6. **Ngày 12–15: hồ sơ và gửi duyệt.** Hoàn thành metadata, ảnh, thông tin riêng tư, tài khoản demo và ghi chú reviewer. Chỉ chọn build đã qua QA. Sau khi được duyệt, chủ ứng dụng quyết định thời điểm phát hành thủ công.

## Build trên Mac

Theo yêu cầu hiện tại, upload phải dùng Xcode 26 trở lên và SDK iOS 26 trở lên. Kiểm tra lại trước ngày nộp vì yêu cầu có thể thay đổi. Điều này không đồng nghĩa app phải có minimum deployment target là iOS 26. [Yêu cầu SDK](https://developer.apple.com/news/upcoming-requirements/).

Các bước trên Mac, chưa chạy trong phiên Windows này:

```sh
cd mobile
npm ci
bundle install
cd ios
bundle exec pod install
open mobile.xcworkspace
```

Trong Xcode: chọn Team và Bundle ID → cấu hình Release → kiểm tra endpoint production → chạy trên iPhone → Product / Archive → Validate App → Distribute App / App Store Connect. Lưu dSYM để đọc crash. Nếu phát sinh lỗi thư viện giọng nói với kiến trúc mới, sửa/đổi thư viện và chạy lại QA trước khi coi tính năng hoàn tất trên thiết bị.

## Bộ kiểm thử nghiệm thu

- Tạo tài khoản, xác minh, đăng nhập, quên mật khẩu, hết phiên, đăng xuất và xóa tài khoản.
- Thu/chi, sửa/xóa giao dịch, ví nhiều tiền tệ; không cộng lẫn VND với USD; chuyển ví và góp tiết kiệm không thành chi tiêu.
- Chọn 1/2/3/4 tháng: số hàng, tổng chênh lệch, cảnh báo và kịch bản giảm chi đổi đúng; thử tài khoản trống và ít dữ liệu.
- Micro: xin quyền lần đầu; từ chối; bật lại trong Settings; không nói; nói tiếng Việt; bấm dừng; rời chat khi đang xin quyền/đang nghe; về nền; không tự gửi; câu nhập tay không bị mất.
- OCR: ảnh rõ/mờ, không đọc được tổng, khác tiền tệ; chỉ điền thông tin chung; người dùng sửa trước khi lưu; upload ảnh thất bại không tạo giao dịch trùng.
- Premium nếu có: StoreKit sandbox, restore trên thiết bị khác, server xác minh, hủy và hoàn tiền.
- Bản Release trên mạng di động: không cần Metro, máy tính phát triển hay tunnel; kiểm tra bàn phím, màn hình nhỏ, chữ lớn và quyền ảnh/micro.

## Hồ sơ App Store Connect

Chuẩn bị tên, subtitle, mô tả tiếng Việt, keywords, danh mục, URL hỗ trợ, URL chính sách riêng tư, thông tin liên hệ, age rating và screenshot từ bản iOS thật. Chỉ quảng bá chức năng đã chạy được; mô tả là ứng dụng ghi chép và lập kế hoạch chi tiêu, tránh hứa lợi nhuận hoặc tiết kiệm chắc chắn.

Lập bảng dữ liệu thực tế gồm email/hồ sơ, dữ liệu tài chính, ảnh hóa đơn, nội dung chat, định danh và dữ liệu chẩn đoán nếu có. Phân biệt âm thanh dịch vụ hệ điều hành xử lý với văn bản gửi backend/Gemini. Khai báo mục đích, liên kết tài khoản, bên nhận, thời hạn lưu và cách xóa. Đối chiếu manifest của ứng dụng lẫn SDK; không giữ khai báo “không thu thập” nếu trái hành vi thực tế.

Trả lời câu hỏi mã hóa dựa trên thư viện thực dùng; không tự chọn miễn trừ khi chưa kiểm tra. [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/).

Ghi chú reviewer: tài khoản demo có dữ liệu mẫu không phải dữ liệu cá nhân; đường dẫn đến Kế hoạch, Chatbot/micro, quét hóa đơn, xóa tài khoản và restore nếu có. Backend và tài khoản demo phải hoạt động trong thời gian review. Cung cấp thông tin truy cập qua trường riêng của App Store Connect.

## Phát hành và theo dõi

Chỉ phát hành khi hết lỗi P0, có kết quả QA iPhone, build production hoạt động độc lập và hồ sơ khớp tính năng. Theo dõi crash, lỗi đăng nhập/API và thanh toán sau phát hành. Có quy trình hotfix với build number mới; giữ backend tương thích bản đang lưu hành vì không thể lập tức thay binary trên mọi thiết bị.

Hiện còn cần: Mac/iPhone, quyền Apple Developer, Bundle ID/tên chính thức, backend/domain production và quyết định Premium/đăng nhập. Các mục này là đầu vào cho đợt triển khai phát hành tiếp theo, không phải bằng chứng ứng dụng đã sẵn sàng nộp.

## Kết quả kiểm tra trong đợt chỉnh sửa này

- Mobile: `tsc --noEmit` và ESLint các file đã sửa thành công. Các bộ test App, FinancialPlanScreen, financialPlansService, transactionsReceiptService và useVoiceInput đã qua. Test giọng nói dùng mock native để kiểm tra bản nháp, dừng, từ chối quyền và bỏ qua kết quả phiên đã hủy.
- Backend: build thành công; 5 bộ test liên quan financial-plans, chatbot và receipt-ocr đã qua (10 test). ESLint các file backend đã sửa thành công.
- `tsc --noEmit` toàn bộ backend còn báo lỗi tại các test admin, categories, reports và transactions ngoài phạm vi chỉnh sửa; cần xử lý trước khi đặt cổng kiểm tra toàn dự án cho phát hành.
- Chưa chạy UI trên Android hoặc iOS, chưa kiểm tra micro/OCR trên thiết bị thật, chưa chạy Pods/archive/upload. Không coi các test mock là bằng chứng native đã hoạt động trên iPhone.
