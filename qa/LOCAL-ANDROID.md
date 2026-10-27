# Chạy Android local để kiểm thử

App kiểm thử tách riêng: `com.mobile.dev`, version có hậu tố `-dev`. App production `com.mobile` và dữ liệu của nó được giữ nguyên. Không dùng workflow phát hành cho buổi test này.

## Chuẩn bị

1. Mở AVD `Pixel_3a_API_33_x86_64` (Android 13/API 33).
2. Chạy các script database QA trong repo backend theo `scripts/RECURRING-BILLS-QA.md`. Cổng 3000 phải đang trống; không thay thế hoặc dừng server khác để chạy QA. Không mở tunnel cho server QA.
3. Trong mobile, chạy `node node_modules/react-native/cli.js start --config qa/metro.local.cjs --host 127.0.0.1 --port 8081 --max-workers 2`.
4. Chạy `adb -s emulator-5554 reverse tcp:8081 tcp:8081`.
   Trong Dev Menu → Change Bundle Location, dùng `localhost:8081` cho đường ADB reverse. Nếu đổi tiến trình Metro giữa một lượt tải đang treo, kiểm tra status/bundle trước khi reload; ảnh trắng hoặc banner tải không phải bằng chứng app đã mở thành công.
5. Trong android, chạy `gradlew :app:installDebug -PQA_ISOLATED_APP=true -PreactNativeArchitectures=x86_64 --no-daemon --max-workers=2`. Có thể giới hạn heap JVM còn 1 GB khi máy ít RAM. Đây là cài bản debug phục vụ test, không ký/phát hành APK production.
6. Mở `com.mobile.dev/com.mobile.MainActivity`. Lần Metro biên dịch đầu có thể chờ lâu; chờ kết thúc trước khi kiểm tra luồng. Không lấy thời gian này làm thời gian mở APK phát hành.

`qa/metro.local.cjs` chỉ chuyển API config sang local khi dùng riêng lệnh Metro trên. File cấu hình production không bị sửa. `node --test qa/metro.local.test.cjs` kiểm tra điều này.

## Ảnh và thao tác

- `node qa/android-ui.cjs screen 10-ten-buoc` lưu PNG gốc từ Android và cây UI XML, đồng thời in nhãn/bounds để chọn thao tác tiếp theo.
- Các lệnh `tap x y 11-ten-buoc`, `text NoiDung 12-ten-buoc`, `back 13-ten-buoc`, `swipe x1 y1 x2 y2 14-ten-buoc` thao tác rồi chụp trạng thái mới. Chỉ dùng tọa độ từ trạng thái vừa quan sát.
- Hai lệnh `node qa/type-local-login.cjs email` và `password` chỉ nhập tài khoản QA sau khi đã focus đúng ô. Giá trị mật khẩu không được in log; không chụp/lưu mật khẩu chưa che.
- Ảnh nằm trong `qa/evidence/2026-10-26-recurring/`. Chỉ lưu dữ liệu thử; không đưa ảnh tài khoản cá nhân hoặc token vào Git.
- Có thể đặt `NOVA_QA_EVIDENCE_SET=2026-10-27-bill-reminders` để lưu đợt mới riêng. Driver kiểm tra app QA/system dialog đang focus và không dùng dump cũ khi Android báo lỗi; vẫn phải xem lại ảnh mới sau chuyển màn.
- Khi kết thúc, đối chiếu database bằng script inspector và ghi kết quả thực tế, phần chưa kiểm tra vào biên bản. Dừng đúng tiến trình QA do mình khởi chạy khi không cần nữa; không dừng server khác.
