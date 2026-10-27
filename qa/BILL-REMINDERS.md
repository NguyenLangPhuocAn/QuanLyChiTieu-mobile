# Nhắc từng hóa đơn trên Android — 27/10/2026

Đợt A của kế hoạch nhắc khoản dễ bỏ sót. Chưa bao gồm tự phát hiện ứng viên từ lịch sử, tăng giá/nghi thu hai lần, backup/sync lịch hoặc tích hợp dự báo. Không phát hành APK production hoặc đổi backend/web trong đợt này.

## Source đã triển khai

- Bật nhắc trong Hóa đơn định kỳ; mặc định tắt theo tài khoản/backend. Xin POST_NOTIFICATIONS khi người dùng chủ động bật; từ chối không bật ngầm hoặc ghi tiền. Chọn giờ bằng hộp thoại Android.
- Mốc trước3ngày, trước1ngày và đúng hạn; mỗi ngày gộp các lịch cần kiểm tra thành một thông báo. Có tắt riêng từng lịch mà không tạm dừng lịch hoặc đổi thanh toán.
- Nội dung chỉ hiện số khoản, không có tên dịch vụ/số tiền. Màn khóa dùng public version chung. Bấm thông báo xác thực owner rồi mở đúng nhóm ngày trong Hóa đơn định kỳ; có Xem tất cả kỳ.
- Scheduler/receiver/channel/notificationId riêng, không ghi đè lời nhắc kiểm tra tài chính chung. Native chỉ giữ bản sao ngày/chu kỳ/cờ/trạng thái kỳ; không lưu tên, tiền, ghi chú hoặc dữ liệu ngân hàng trong mirror.
- Paid/skip/pause/archive/opt-out loại kỳ khỏi nhắc. Giao dịch gốc không bị tạo/sửa/xóa. Book AsyncStorage vẫn là dữ liệu gốc; lỗi mirror không làm rollback hóa đơn đã lưu và có trạng thái đồng bộ để thử lại.
- Khóa đã gửi bền theo owner/lịch/kỳ/mốc, giữ400ngày, ghi claim trước notify. Boot/cập nhật app/đổi giờ/múi giờ tái đặt từ mirror; chỉ bù mốc của hôm nay, không phát lại cả loạt ngày đã lỡ.
- Đăng xuất/đổi owner hủy alarm/thông báo và bỏ mirror active. Kết quả đọc cũ và link từ tài khoản khác không được áp dụng. Restore offline chưa thành công không bị coi là đăng xuất.
- App trở lại foreground đồng bộ book hợp lệ. Dữ liệu local hỏng hoặc sync lỗi hủy mirror để tránh nhắc dữ liệu cũ; không ghi đè dữ liệu hỏng.

## Kiểm tra tự động

- Jest **72/72 qua 8 bộ**:31 domain/storage,13 UI hóa đơn,8 session nhắc,5 linking,3 settings,8 App/financialPlanning và4 AuthContext. Lần cuối56,326giây. Provider/native trong Jest là mock.
- JVM10/10 cho planner thật: cuối tháng, năm nhuận, gộp nhiều due date/mốc cùng ngày, kỳ đã xử lý, khóa đã gửi, không replay ngày cũ, catch-up hôm nay, múi giờ, không có lịch và anchor tuần cũ.
- MetroQA3/3: cấu hình local, cấu hình production giữ nguyên và fallback tải bundle thường riêng QA.
- TypeScript noEmit và ESLint file đổi max-warnings0 đạt. Bộ settings ban đầu timeout5giây khi máy đang build; đặt20giây riêng bộUI như các bộ màn hình hiện có, lần cuối đạt. Không gọi Gemini hoặc sửa API tiền.
- Debug app `com.mobile.dev` build/install đạt; bản trước bổ sung desugar4phút6giây/283tasks, bản cuối có desugar8phút11giây/284tasks và planner10/10. MainActivity dùng RNScreensFragmentFactory, cập nhật intent khi task được tái dùng; manifest nhận host bills và PendingIntent dùng VIEW/BROWSABLE để Android13 chấp nhận.

## QA trực tiếp

Ảnh gốc/XML và các bằng chứng đặt trong `qa/evidence/2026-10-27-bill-reminders/`. Dùng Metro local, Nest/MySQL QA riêng; bản com.mobile production giữ nguyên.

- Đã thấy công tắc mặc định tắt; từ chối quyền không bật nhắc. Bật lại qua rationale và hộp thoại Android thành công; native mirror và alarm hiện diện.
- Thêm hai lịch QA cùng ngày27/10, chỉ tạo nghĩa vụ dự kiến. Native mirror có4lịch (1archived,3eligible),2kỳ đã xử lý; ví/giao dịch tiền kiểm tra riêng bằng SQL.
- Đặt15:56, Home rồi am kill: tiến trình JS dừng trước giờ hẹn. Khoảng15:57 nhận thông báo hệ điều hành thật cho2khoản; ledger tăng0→2. Không phát broadcast giả, không chỉnh đồng hồ. Cài lại debug giữ ledger2, không phát lại mốc cũ.
- Lần bấm thông báo đầu mở nhầm Tổng quan: lưu ảnh lỗi45–46. Sau sửa intent/manifest, replay intent chẩn đoán58–59 mở nhóm đúng (đây là synthetic). Đổi ngày Internet QA qua28/10 bằng UI tạo mốc mới; ledger tăng2→3. Thông báo thật69 và thao tác bấm70 mở đúng nhóm Phi dịch vụ hôm nay/Internet ngàymai trong71–72. Phân biệt rõ bằng chứng synthetic và bấm thông báo thật.
- Bỏ qua Phi dịch vụ qua hộp thoại xác nhận73–75; native giữ trạng thái kỳ, nhóm còn Internet. SQL sau thử vẫn đúng2giao dịch/số dư6.590.000đ, từng ID/nội dung/khoản tiền không đổi. Không tạo thanh toán mới.
- Cuối buổi tắt nhắc bằng UI78–79: không còn alarm/postedDay. Sau build có desugar, phiên Metro cũ bị treo; đổi host debug sang localhost qua ADB reverse, mở phiên cached mới và chờ source chạy. Ảnh95 xác nhận Tổng quan thật, tài khoản/dữ liệu QA vẫn giữ. Các ảnh80–94 là giai đoạn chờ/công cụ dev, không coi là ca chức năng đạt.

## Giới hạn

Cấu hình Android bổ sung coreLibraryDesugaring cho java.time vì minSdk24. Dùng desugar_jdk_libs2.1.5 theo [hướng dẫn Android](https://developer.android.com/studio/write/java8-support) và [changelog thư viện Google](https://github.com/google/desugar_jdk_libs/blob/master/CHANGELOG.md). Đây là cấu hình hỗ trợ API cũ, chưa phải bằng chứng thử trên Android24/25.

- Alarm không chính xác chịu giới hạn Android/Doze/OEM và có thể trễ. Force-stop trong Settings/adb am force-stop khác am kill: hệ thống có thể chặn nền tới khi mở lại app. Không yêu cầu quyền exact alarm hoặc hứa đúng từng phút.
- Lời nhắc chỉ nói có khoản cần kiểm tra; không khẳng định chưa thanh toán ngoài ứng dụng. Trạng thái Paid hiện là snapshot liên kết, chưa tự đối chiếu khi giao dịch gốc sửa/xóa.
- Chưa có mốc quá hạn riêng, ngày nhắc tùy chỉnh theo từng lịch, nhắc lại sau (snooze) hoặc cấu hình quiet hours riêng. Giờ nhận mặc định20:00, người dùng có thể đổi. Lịch năm hiện cũng dùng3/1/0ngày.
- Chưa thử điện thoại vật lý, reboot/quyền kênh/OEM dài ngày hoặc độ bền qua nhiều cập nhật production. Các mục đó cần nghiệm thu riêng.
- Hành vi giảm số đếm/hủy một thông báo còn nằm trên khay sau thay đổi đã có source kiểm tra activeNotifications; đợt UI này xử lý kỳ sau khi bấm (thông báo đã auto-cancel), chưa nghiệm thu riêng ca sửa số đếm ngay trên khay.
- Hai kho AS/native không cùng một giao dịch nguyên tử; native kiểm lại mirror trước gửi, có resync khi foreground và cảnh báo sync. Không tuyên bố loại bỏ mọi cửa sổ lỗi nếu hệ điều hành dừng app đúng giữa lúc lưu AS và cập nhật mirror.

## Tái hiện local

Theo `qa/LOCAL-ANDROID.md`. Dùng `NOVA_QA_EVIDENCE_SET=2026-10-27-bill-reminders` với `qa/android-ui.cjs`; driver không dùng cây UI cũ khi Android dump bị lỗi. `node qa/bill-reminder-proof.cjs ten-buoc` chỉ đọc mirror của com.mobile.dev và lưu số đếm, không đọc token/AS/user production.

Môi trường local gặp ProtocolException khi RN tải multipart progress bundle. Metro QA loại Accept multipart riêng request.bundle để dùng nhánh tải thường được RN hỗ trợ; không sửa dependencies hoặc metro.config production. Ảnh khởi động/chờ trước khi xử lý lỗi này không được tính là luồng đạt.
