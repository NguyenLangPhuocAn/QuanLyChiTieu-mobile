# Mic gọn và chọn nguồn ảnh widget — 30/10/2026

## Hành vi

- Mic trên widget chỉ mở thanh ở cuối màn hình: khởi động/đang thu/đang xử lý, câu nghe được và Dừng/Hủy. Chưa hiện form số tiền/ví. Trong form hiện có, thanh thu tại chỗ, không có ô nhập câu nói hoặc màn nhập riêng.
- Câu hợp lệ sau khi kết thúc mới điền tiền/thu-chi/ngày/ghi chú, giữ danh mục phù hợp. Không tự chọn ví hoặc tự lưu. Hủy thu giữ bản nhập tay, bỏ kết quả muộn.
- Nút ảnh (trong form và ngoài widget) mở Chụp ảnh/Chọn từ thư viện/Hủy. Cùng luồng OCR, chỉnh từng món và kiểm tra/xác nhận; ảnh nguồn không tự đính kèm. Hủy menu/thư viện/camera không đổi bản nhập. Khóa mở menu/đọc ảnh lặp, chặn callback sau rời form/đổi tài khoản.

## Android local và bằng chứng

- Android13/com.mobile.dev/source Metro8081/API3302/MySQL QA8. Không dùng APK production cũ.
- 00/04/17: menu đủ hai nguồn. 01 mở Photo Picker thật nhưng ảnh/XML chỉ lưu local ngoài Git vì có thumbnail media cũ. 02 Hủy thư viện về form. 03 cuộn tới công cụ,05 camera native thật,06 Back về form. Helper android-ui bổ sung đúng package PhotoPickerActivity để điều khiển picker đã mở.
- 07–08 micro QA đang bị USER_FIXED/tắt quyền từ lượt cũ: thanh Nói lại, không tính là thu âm. Đã cấp RECORD_AUDIO riêng com.mobile.dev trên emulator để thử; 09 khởi động,10 Hủy trong form giữ dữ liệu,11 Home.
- 12 là bản thanh giữa màn hình trước chỉnh cuối. 13 đã thu gọn xuống cuối nhưng còn Fast Refresh;14 đã hết lượt nghe/Nói lại, không tính là đang thu. 15 Hủy về Home.16 còn loading lúc mở ảnh,17 mới là menu sẵn sàng.18 Hủy menu,19 Home.
- **20-recording-bar-clean**: thanh cuối màn hình có trạng thái native Đang thu âm, không có ô tiền/ví, không Fast Refresh.21 Hủy về launcher, không còn thu âm. QA giữ quyền micro đã cấp để có thể thử tiếp; không thay quyền app production hoặc điện thoại thật.
- PNG/XML là ảnh gốc. sql-unchanged.json đối chiếu sâu với đợt form:4ví/tx27–30/loan1–2/ví8=1.023.750đ giữ nguyên. Không bấm lưu giao dịch.

## Kiểm thử và giới hạn

- Jest30/30 qua WidgetQuickEntry và useVoiceInput, gồm5ca mới: compact mic/chỉ điền khi kết thúc, hủy/giữ nhập tay/kết quả muộn, đọc ảnh thư viện/không đính kèm, Hủy menu/thư viện và callback nguồn ảnh sau đóng. Các ca API/native trong Jest là mock.
- TypeScript noEmit/ESLint exit0, node--check helper đạt. Không thêm dependency/native, không build/cài/phát hành APK, không sửa .env/web hoặc deploy/restart server3000.
- Đã thử trạng thái mic native, mở/hủy nguồn ảnh thật. Chưa nghiệm thu nhận tiếng Việt từ âm thanh thực tế, chọn ảnh thư viện rồi OCR bằng model thật hoặc máy vật lý. Không gọi kết quả mô phỏng transcript là nghe thật. Camera/thư viện điền món/tiền/không đính kèm được kiểm trong Jest.
