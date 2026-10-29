# Widget nhập nhanh — 29/10/2026

## Source và môi trường

Android13/Pixel3a emulator5554, app com.mobile.dev local qua Metro QA8081. Native mới được build/cài debug, không dùng APK production cũ. Nest source QA3301/MySQL schema loopback riêng, QAuser7/ví7:2danh mục chi (8Ăn uống,9Đi lại),1thu (10Lương), ví1.000.000đ và0giao dịch. Helper chỉ seed fixture mới một lần trong transaction; không reset/migrate schema hoặc đổi QA6. Server3000/.env/APK/web không sửa.

## Bằng chứng đã thử

- 03–06: đăng nhập QA mới, cache danh mục và widget2hàng [23,96][851,724], chữ/nút không chồng. 07 danh mục Chi chỉ có2mục chi. Lần đầu chọn xong về app (08), đã sửa taskAffinity/flags và build lại;13 chọn Lương rồi trở lại đúng launcher.09 là trang launcher khác không có widget; driver từ chối tìm nút,10 vuốt đúng trang. Không sửa ảnh để che những lần chưa đạt.
- 11–13 chọn Thu/Lương;15 mở form đúng Lương QA/Khoản thu và đóng16 không ghi.18 chuyển Chi, nhớ Đi lại QA. Widget chỉ mang scope/type/category/action/event, không wallet/amount; form vẫn để người dùng kiểm tra/chọn ví.
- 19 chỉ là frame chuyển,20 mới là dialog quyền micro.21 từ chối quyền để không thu âm môi trường.23–25 là câu bàn phím thiếu đơn vị và nút chưa điền được; không tính là pass.26 nhập câu mẫu chi25nghìn,27 xem preview,28 Điền vào form có25.000 và Đi lại QA, không Lưu. Đây là kiểm tra quyền/từ chối/chỉnh transcript/parse/điền, không phải nghiệm thu âm thanh tiếng Việt thật. Bộ Jest kiểm riêng emitter nhận dạng/giữ danh mục/không tự lưu.
- Khi form đang cuộn và bàn phím còn mở,29 chưa đóng được form;30–32 bấm camera widget giữ nguyên form cũ và báo chưa lưu, không mất25k.33–37 gặp ANR SystemUI của emulator; Wait chưa phục hồi. Reboot riêng emulator, không reset app/data.38 launcher sau reboot,39 vẫn giữ Chi/Đi lại và che tiền.
- 40 tải bundle lạnh,41 mới mở com.android.camera2/CaptureActivity từ widget. AVD xác nhận camera trước/sau emulated (không webcam thật).42 Shutter,43 review,44 Done trả ảnh về OCR;45 báo lỗi vì runner QA đặt GEMINI_API_KEY trống. Không gọi Gemini thật/không giả kết quả nhận dạng ảnh.46 đóng lỗi;49 panel ảnh rỗng với Thêm ảnh hóa đơn/Quét ảnh bằng AI, không có ảnh/Đổi ảnh/Bỏ ảnh.50 mở lựa chọn thêm ảnh thủ công;51Back không đóng dialog cancelablefalse,52–53 vẫn dialog;54 bấm nút Hủy mới đóng. Không tính thao tác Back là hủy thành công.
- SQL before/after-choices-voice/after-camera/final: QA7 luôn0giao dịch/ví1triệu, vì chưa bấm Lưu. previous-fixture before/after: QA6 giữ1khoản chi25k/ví975k. Không lấySQL0 làm bằng chứng lưu giao dịch thành công; lưu dữ liệu trích xuất/noupload được kiểm Jest với API mock.

## Kiểm thử và bản dựng

Jest cuối76/76 qua8bộ,8ca bổ sung so với68 trước đó: danh mục cashflow phù hợp, URLaction/ID, chọn Thu/Chi đúng loại, mic giữ danh mục, camera cả2loại không upload ảnh và3ca kiểm nguồn widget/validator lỗi/phản hồi muộn. API/native/model trong Jest được mock. Lần setup trước timeout5s khi môi trường emulator/Metro tải nặng; giữ log thất bại và chạy lại toàn bộ với --testTimeout=30000, đạt76/76 trong72,506s. Không sửa assertion hoặc dữ liệu để làm test qua. TypeScript --noEmit và ESLint file đổi exit0.

android-build-final.txt: installDebug/testDebugUnitTest QA x86_64 thành công2m53s/284tasks,11test JVM planner hiện có/0failures/0errors; không gọi đó là11test widget. Có build đầu trước sửa task chooser, sau sửa đã build/cài lại. Không ký production, không chạy GitHubRelease/web/deploy. Cold Metro không phải benchmark APK release.

## Giới hạn

Bổ sung nguồn liên kết: native giữ mã ngẫu nhiên riêng theo widget/tài khoản, kiểm mã + scope + widget còn tồn tại trước khi navigation nhận hành động. 57 là thử link không có mã bằng ADB từ UID ngoài: Android13 từ chối intent không khớp filter, không phải bằng chứng độc lập cho nhánh validator trảfalse. Các test giả lập validator false/lỗi/phản hồi muộn được ghi rõ là Jest. Sau build/cài native cuối2m53s,58–59 đang chuyển màn,60 có Options/Shutter và focus com.android.camera2/CaptureActivity từ nút widget thật (xác nhận đường có mã vẫn hoạt động).61 Back hủy camera về form Đi lại QA, không gọi OCR lần nữa;62 đóng bản nháp,63 launcher có Chi/Đi lại QA và che tiền. Không xuất shared prefs/link có mã riêng vào Git.

Chưa nghiệm thu mic tiếng Việt, Gemini/OCR ảnh thật,4G/OEM/font lớn cho widget mới trên điện thoại vật lý. Widget chọn từ cache: danh mục chưa tải cần mở app online; danh mục khác loại/không còn trong dữ liệu form không được tin mù. Category cache ở native giờ có ID/tên/loại, không có JWT/ghi chú/tên hoặc số dư ví. Chọn danh mục không cần server. Đổi tài khoản/backend dùng cơ chế clear prefs hiện có; kiểm tra logout map rỗng là mốc đợt trước, không chạy lại như test mới hôm nay. Offline vẫn chỉ đồng bộ khi active/resume, chưa upload bền ảnh sau mất mạng và chưa sync sau force-stop. C2b lịch tiền/chi an toàn và đồng bộ lịch giữa thiết bị chưa hoàn tất.

## Trạng thái bàn giao local

Ảnh 64 xác nhận app đã về Tổng quan, không còn form nhập đang mở; tài khoản QA7 vẫn đăng nhập để tiếp tục thử. SQL cuối vẫn 0 giao dịch/ví 1.000.000đ; QA6 giữ 1 giao dịch/ví 975.000đ. Giữ Metro 8081 và backend QA 3301 chạy cho bản local này; production PID3764/port3000 giữ nguyên và kiểm tra health trả HTTP200. Không ký/phát hành APK hoặc cập nhật website.
