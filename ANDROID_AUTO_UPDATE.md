# Cập nhật Android qua GitHub Releases

Ứng dụng kiểm tra file `update.json` của GitHub Release mới nhất sau khi mở. Khi
`versionCode` lớn hơn bản đang cài, ứng dụng hiển thị nội dung thay đổi, tải APK,
kiểm tra SHA-256 và chuyển file hợp lệ cho trình cài đặt Android.

## Thiết lập một lần

Tạo khóa phát hành cố định và lưu bản sao ở nơi an toàn. Không commit khóa hoặc
mật khẩu vào Git:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore quan-ly-chi-tieu-release.keystore -alias quanlychitieu -keyalg RSA -keysize 4096 -validity 10000
```

Trong GitHub repository, tạo bốn Actions secrets:

- `ANDROID_KEYSTORE_BASE64`: nội dung file keystore sau khi mã hóa Base64.
- `ANDROID_KEYSTORE_PASSWORD`: mật khẩu keystore.
- `ANDROID_KEY_ALIAS`: alias của khóa.
- `ANDROID_KEY_PASSWORD`: mật khẩu khóa.

Mọi APK phát hành phải dùng cùng khóa. Bản đang ký bằng debug key cần được gỡ
một lần trước khi cài bản production đầu tiên; hãy xuất dữ liệu Excel trước khi gỡ.

## Phát hành

Mở **Actions > Release Android APK > Run workflow**, nhập `version_code` lớn hơn
bản trước, `version_name` và nội dung thay đổi. Workflow kiểm thử, build APK đã
ký, tạo `update.json`, kiểm tra chữ ký và đưa cả hai file lên GitHub Releases.

Không bật **Bắt buộc cập nhật** trừ khi phiên bản cũ không còn an toàn hoặc không
tương thích với máy chủ.
