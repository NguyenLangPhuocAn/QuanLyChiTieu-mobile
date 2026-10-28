# Quy ước làm việc đã thống nhất

- Sau mỗi đợt thay đổi đã kiểm tra, commit và push mã nguồn lên GitHub. Kiểm tra HEAD khớp origin và không bỏ sót file mới; ghi rõ nếu push lỗi. Không đưa mật khẩu, token, file .env hoặc dữ liệu người dùng vào Git.
- Khi test Android trên máy này, dùng bản phát triển local/Metro. Ưu tiên app QA tách riêng bằng `-PQA_ISOLATED_APP=true` để giữ bản release và dữ liệu cũ. Không lấy APK production cũ làm bằng chứng cho source mới.
- Kiểm tra trực tiếp từng luồng đã sửa, lưu ảnh chụp màn hình gốc và biên bản có bước thử/kết quả/giới hạn. Chỉ đưa ảnh dữ liệu thử không nhạy cảm lên Git.
- Không phát hành APK, cập nhật web tải hay thay server ổn định cho mỗi thay đổi nhỏ; gom bản và chờ người dùng chốt cập nhật. Bản debug local phục vụ yêu cầu kiểm thử không phải bản phát hành cho điện thoại thật.

- Theo yêu cầu ngày28/10/2026: tất cả file sao lưu dùng file thường, không mã hóa/không hỏi mật khẩu. Chỉ thay đổi lại khi người dùng yêu cầu mới.
