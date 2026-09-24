# Thử APK kết nối server laptop từ xa

Cập nhật 21/09/2026. Ưu tiên hiện tại: thử nội bộ vào thứ Sáu 25/09/2026, dự kiến 19:00 giờ Việt Nam. Chưa upload CH Play. Không mở Android Studio hoặc giả lập trong đợt chuẩn bị; kiểm tra trực quan và kết nối thật sẽ dùng điện thoại khi bắt đầu buổi thử.

## Kết quả cần đạt

Điện thoại tắt Wi-Fi, dùng 4G/5G → URL HTTPS → backend trên laptop → MySQL. APK mở được khi Metro không chạy. Thử đăng nhập, đọc ví, ghi một khoản nhỏ bằng tài khoản thử, kiểm tra số dư và xem ảnh. Đối chiếu lịch sử trên server để chắc chắn chỉ ghi một lần.

Laptop cần bật và không ngủ trong buổi thử. Database và backend chạy trên laptop; tunnel/proxy đưa cổng backend ra HTTPS. Không mở cổng MySQL ra Internet. Đây là thử nghiệm phụ thuộc laptop, chưa phải hạ tầng phát hành lâu dài.

## Trước thứ Sáu

- Tiếp tục sửa app và chạy kiểm thử; chưa khởi chạy tunnel hay build/cài APK trong bước chuẩn bị này.
- Backend có `GET /health`, hỗ trợ `PORT`/`HOST`; đọc `backend/LAPTOP_SERVER.md` để khởi động và kiểm tra.
- Mobile đã tách cấu hình ở `src/config/api.config.json`: `local` giữ các địa chỉ phát triển; `remote` chỉ dùng một URL HTTPS, không tự thử lại qua localhost/LAN.
- Có script `scripts/configure-api.cjs` để chọn cấu hình. Không đưa mật khẩu, access token, Gemini key hoặc ngrok token vào URL/app.
- Chuẩn bị tài khoản thử và sao lưu MySQL + `uploads` trước khi kiểm thử có ghi dữ liệu. Chưa tạo/kiểm tra bản sao lưu trong đợt này.

## Thứ Sáu: thứ tự thực hiện

Kiểm tra chỉ đọc ngày 21/09: lệnh `java -version` trả Java 17.0.12; có Gradle wrapper/JAR, Android SDK platform 36, Build Tools 36.0.0 và NDK 27.1.12297006 khớp `android/build.gradle`. Wrapper cấu hình Gradle 9.3.1. Chưa chạy Gradle nên chưa xác nhận tải dependency, cấu hình native hay build release thành công. Chưa có `android/local.properties`; khi build phải có đường dẫn SDK qua biến môi trường hoặc cấu hình riêng của máy. Không đưa đường dẫn máy cá nhân vào Git.

Backend đã build thành công sau lượt kiểm tra ngày 21/09. Đây là kiểm tra biên dịch, chưa xác nhận dịch vụ đang chạy hoặc database truy cập được.

Máy đã có biến `ANDROID_HOME`; `JAVA_HOME` chưa đặt, nhưng lệnh Java 17 có trên PATH. Chưa thay đổi biến môi trường hoặc chạy Gradle. Với bộ cấu hình hiện tại, bước đầu là kiểm tra build thực tế, chưa có bằng chứng cần cài lại SDK.

1. **Kiểm tra laptop**: nguồn điện, mạng, MySQL; ghi nhận cổng đang dùng và tránh chạy hai backend trùng cổng. Kiểm tra các biến cần thiết có tồn tại, không in giá trị bí mật ra log.
2. **Khởi động backend**: build bản mới rồi chạy theo `LAPTOP_SERVER.md`; gọi `/health` trên localhost, sau đó thử đăng nhập và đọc ví để xác minh cả database.
3. **Lấy URL HTTPS**: repo hiện có `backend/scripts/start-ngrok.cjs` và package ngrok. Xác minh tài khoản/cấu hình có thể sử dụng rồi mới chạy. Script hiện lấy `NGROK_AUTHTOKEN` từ biến môi trường của tiến trình; không mặc định rằng nó tự đọc `.env`. Nếu thiếu thông tin tài khoản hoặc chưa có URL, cần hoàn thành bước này trước khi cấu hình APK. Không mua gói trong buổi thử.
4. **Kiểm tra URL từ ngoài mạng laptop**: điện thoại dùng 4G/5G mở `https://DIA_CHI_BACKEND/health`, phải nhận marker `quan-ly-chi-tieu`, không phải trang cảnh báo HTML. Sau đó chọn URL thật trong mobile bằng lệnh dưới đây.
5. **Build APK có bundle JS**: dùng bản release để không cần Metro. Cấu hình release hiện vẫn dùng debug signing; chỉ coi đây là APK thử nội bộ, không phải bản phát hành CH Play. Kiểm tra công cụ build/JDK/SDK và build bằng terminal khi bắt đầu buổi thử, không khởi chạy giả lập. Không tạo khóa phát hành hay đổi package ID chỉ để thử kết nối.
6. **Cài trên điện thoại thật**: người dùng thực hiện/cho kết nối thiết bị khi tới bước này. Ghi lại đường dẫn APK, thời gian build và URL được đóng gói. Không gỡ app đang dùng nếu chưa xác nhận dữ liệu cần giữ.
7. **Thử kịch bản dưới đây**; ghi kết quả thực tế và lỗi còn lại, không chỉ dựa vào test mock.

Trong thư mục `mobile`, sau khi có URL thật:

```powershell
node scripts/configure-api.cjs --remote https://DIA_CHI_BACKEND
node scripts/check-api.cjs
```

Lệnh kiểm tra chỉ gọi `GET /health`, không đăng nhập hoặc ghi dữ liệu. Nó báo riêng lỗi kết nối, HTTP, trang HTML của tunnel và marker backend không đúng. Chạy trên laptop đạt chưa chứng minh điện thoại truy cập được; vẫn cần kiểm tra bằng 4G. Trước khi chọn URL, có thể kiểm tra riêng bằng `node scripts/check-api.cjs --url https://DIA_CHI_BACKEND`.

Cần build lại APK sau khi đổi URL:

```powershell
# Chạy từ thư mục mobile/android trong buổi thử
.\gradlew.bat assembleRelease
```

Artifact dự kiến: `mobile/android/app/build/outputs/apk/release/app-release.apk`; chỉ xác nhận tồn tại và cài được sau khi build thực tế. Không dùng `run-android` trong bước chuẩn bị.

Quay lại cấu hình phát triển:

```powershell
node scripts/configure-api.cjs --local
```

Thao tác này chỉ sửa cấu hình cho lần bundle/build kế tiếp; APK đã cài vẫn dùng URL được đóng gói trước đó.

## Kịch bản kiểm tra

| Bước | Điều kiện đạt |
|---|---|
| Mở APK khi Metro tắt và điện thoại dùng 4G | Không đòi dev server; gọi đúng URL HTTPS |
| Đăng nhập tài khoản thử, đóng/mở app | Khôi phục phiên; không mất đăng nhập chỉ vì mất mạng tạm thời |
| Tạo/sửa giao dịch số nguyên và có phần lẻ | Số tiền gửi, lịch sử và số dư ví khớp; không nhân 100 lần |
| Chuyển giữa hai ví cùng tiền tệ | Nguồn giảm, đích tăng, lịch sử có đúng một lần chuyển |
| Góp/rút mục tiêu và trả một phần nợ | Ví, khoản còn lại và lịch sử liên kết khớp |
| Kế hoạch → bản nháp ngân sách | Giữ danh mục và hạn mức; chọn ví đúng tiền tệ; chỉ tạo sau bấm Lưu |
| Avatar, icon danh mục và hóa đơn | Ảnh tải được qua HTTPS; không còn đường dẫn localhost trong kết quả |
| Tắt mạng giữa thao tác ghi | App báo kết quả chưa rõ; kiểm tra lịch sử trước khi bấm lại |
| Tắt backend rồi bật lại | App báo lỗi và thử lại được; không tự chuyển sang LAN/localhost |
| Google/giọng nói/OCR/chatbot | Kiểm tra riêng; ghi rõ cấu hình OAuth/quyền hoặc dịch vụ bên ngoài còn thiếu |

## Sau buổi thử

Ghi lỗi theo bước tái hiện, ảnh màn hình nếu người dùng cung cấp, kết quả đối chiếu số dư và URL/timestamp của APK. Dừng tunnel khi kết thúc nếu không còn cần truy cập từ xa. Chỉ chuyển sang kế hoạch CH Play sau khi bản APK dùng từ xa ổn định và người dùng yêu cầu.
