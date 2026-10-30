# Lịch tiền / Chi an toàn và widget đầy đủ — 30/10/2026

## Môi trường

Pixel3a Android13 API33/emulator-5554, com.mobile.dev debug/source Metrolocal/API3302/MySQL QA8/wallet8. Không dùng APK production cũ làm bằng chứng. Backend3000/.env/web/release không đổi. Tiền thậtQA giữ4giao dịch27–30,2khoản vay1–2/ví1023750 từ đợt trước. Chỉ tạo1hóa đơn và2khoản dự kiến local, không ghi thêm tiền.

## Lịch tiền và phép tính

16: book trống, tiền1023750/30 =34125/ngày. 18–24 nhập qua form hóa đơn thật Tien nha QA300000/tháng/ngày30/10/2026, nhắc global không bật. 25: mức24125, dành300000. 28–33 nhập/xem trước/xác nhận Luong QA5000000/ngày30/10;34 vẫn24125, dù số dư dự kiến cuối ngày5723750. Không coi lương chưa nhận là tiền chi được.

37–43 nhập/xem trước/xác nhận Chi du kien QA800000 cùng ngày. 44: mức0, thiếu76250 và nguy cơ trước khoản thu trong ngày. 45 mở cách tính, thấy1023750−300000−800000−0, chia30/làm tròn xuống. 50–51 xác nhận bỏ qua riêng kỳ30/10, không xóa lịch tháng sau;52 quay lại tự tải, mức7458/ngày, còn223750, không còn giữ300000. UI header ban đầu16 có nút Back quá rộng; đã chỉnh,25/44/52 là header đúng. Câu nguy cơ sau đó được sửa để chỉ nói chi trước thu khi chính ngày đó có thu dự kiến, kiểm thử tập trung cuối đạt.

## Widget Android

56/64 nút trong app yêu cầu đúng provider Thu chi nhanh. Các thử58–63 chưa xóa mini, không tính là thành công. 64–67 phiên đầu launcher nhận4×4 quá cao. Chỉnh minHeight/minResizeHeight210→110, padding/header/hàng và giấu0chờ; build/cài x86_64. 68 xóa bảng cao,70 xóa mini thành công qua draganddrop khi launcher đã sẵn sàng. 76–77 lần chạm dòng bị che bởi thanh tab chưa điều hướng,78–79 cuộn tới dòng thật rồi mở.

80 dialog pin đúng4×2;82/97 là bảng gọn thực tế. 83–86 chọn Thu và Lương trong5danh mục, popup có Khoản thu/Lương, không tự chọn ví;87Hủy về launcher.88–89 chọn Vay/Nợ từ native, popup Vay/Cho vay/tên/ngày, không hiện danh mục thường;90Hủy.91–94 chọn Chi/Khác trong12danh mục, popupKhoản chi/Khác;95Hủy.96hiện tiền đúngChi26250/Thu0 (loại loan khỏi thu/chi thường),97che lại. Nút mic/camera có trên bảng, không gọi AI/nhận dạng thật trong đợt này. SQL final khớp before hoàn toàn. Bàn giao một bảng đầy đủ, không mini, không thêm khoản tiền.

## Chẩn đoán và kiểm tra

00–12 là frame khởi động/blank/lỗi load asset, không phải nghiệm thu sẵn sàng. Build CMake tạo rồi xóa thư mục tạm làm các Metro cũ chết ENOENT. Đã thêm resolver.blockList loại android build/.cxx/.gradle và Node2/2 chứng minh bỏ cây tạm nhưng giữ src/JS. Đã chạy lại Metro8082, sau thấy coldstart native mặc định tìm8081; mở QA8081 với cùng configAPI3302 và force-stop/relaunch riêngQA,13 trở đi đúng source/QA8. Không dừng/restart backend3000 hoặc3301/3302; không đổi.env. WiFi/data luôn1/1.

Hồi quy128/128qua16suite; sau chỉnh copy/header/guard cuối33/33qua5suite. Có14ca mới:7engine,3store,3screen,1loanlink. TypeScript/ESLint đạt. Lượt store đầu lỗi vì testmock thiếu AsyncStorage.clear, sửa testmap/get/set rồi10/10 đạt; không gọi đó là lỗi app. Debug build/cài296task/12m43 (4ABI), JVM11planner cũ0lỗi; resourcecuối/x86_64cài278task/32s. Không gọi11JVM là testwidgetmới. Không có native/release performance benchmark.

## Giới hạn

Chưa sync book giữa thiết bị hoặc backup/sync khoản dự kiến mới. Chỉ tính tiền tệ tài khoản, không tự gộp/đổi ngoại tệ hay thay ngân sách danh mục. Chưa kiểm máy thật/OEM/4G/AI/mic/OCR thật. Giữ provider Mini để tương thích dữ liệu người đã có; chỉ QA đã gỡ mini. Không ký/phát hành APK production/deploy/web. Log/PNG/XML gốc và SHA đi kèm, không có token/mật khẩu/nonce.
