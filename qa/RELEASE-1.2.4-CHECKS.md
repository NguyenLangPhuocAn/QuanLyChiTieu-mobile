# Bàn giao APK1.2.4 — 02/11/2026

- Build source6254e9b, versionCode9; CI41410274474 thành công,624/624 test/99bộ. Build Android11m7s. Run trước41409806299 dừng ở tsc do fixtureOCR thiếu receipt_items; đã sửa fixture, không bỏ test/giảm kiểm tra. Tsc không incremental và31/31 widget local đạt sau sửa.
- File APK GitHubRelease50.012.370byte đã tải về, SHA-256 khớp update.json. apksigner verify đạt; chứng chỉ SHA-256 khớp APK1.2.3 đã tải và kiểm SHA riêng. aapt: com.mobile/1.2.4/code9, armeabi-v7a vàarm64-v8a. Bundle có API production và không có endpoint3301/3303 hoặc fixturephoto QA.
- Backend đã cập nhật theo xác nhận; health local/public200 và planning-sync thiếuJWT401 sau rollout. Chỉ thêm planning_snapshots, không sửa/reset bảng tiền; có dist cũ để quay lui. Backend source259a556, biên bản/helperf59bc40 đã push. Server stable.env và web tải không đổi.
- Source QA vẫn com.mobile.dev/Metro8081/API3303 riêng; không dùng APK production làm bằng chứng Android local. Nhập lại nguồn31 tạo đúng32 sau xác nhận,944.750→865.750đ; preview/cancel không đổi, replay2lần cùng32. Có README/40PNG/40XML/SQL/SHA ở evidence/2026-11-02-repeat-transaction.
- Cần thử trên điện thoại thật: cài đè từ1.2.3, giữ dữ liệu/đăng nhập; widget full4×2, Chi/Thu/Vay-Nợ, camera/library/mic, nhắc/quyền/OEM và4G. Nhận tiếng Việt/OCR model thật chưa nghiệm thu trong đợt này. Lắc/chuông đọc thông báo mới nhất còn trong khay, không bảo đảm banner đang nổi. Mẫu Excel/bộ lọc xuất là đề xuất chưa làm.

APK: https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/download/v1.2.4/QuanLyChiTieu-1.2.4.apk

Ghi chú người dùng: RELEASE-1.2.4.md. Chứng cứ CI và checksum/chứng chỉ ở hai file JSON cùng thư mục; không đưa APK, keystore hoặc token lên source Git.
