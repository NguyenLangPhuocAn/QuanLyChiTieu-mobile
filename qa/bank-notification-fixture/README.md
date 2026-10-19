# Bank notification fixture

Ứng dụng Android tối giản dùng trên máy ảo để kiểm tra luồng đọc thông báo ngân hàng của Sổ Thu Chi Nova.

Build bằng Gradle wrapper của dự án chính:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
..\..\android\gradlew.bat -p . assembleDebug
```

Sau khi cài APK, cấp quyền thông báo cho fixture, bật “Ngân hàng thử nghiệm” trong Nova và chạy:

```powershell
.\send-test-notifications.ps1
```

Kịch bản phát cả tiền ra, tiền vào, thông báo chỉ có số dư và OTP. Kết quả đúng là Nova đưa hai giao dịch hợp lệ vào hàng chờ, không dùng số dư làm số tiền, chặn OTP và không ghi giao dịch cho đến khi người dùng xác nhận.

Ứng dụng này không kết nối ngân hàng, không lưu thông tin đăng nhập và không được đóng gói trong APK chính.
