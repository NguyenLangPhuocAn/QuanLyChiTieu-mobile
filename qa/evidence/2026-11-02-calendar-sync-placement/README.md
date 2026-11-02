# Vị trí quản lý đồng bộ lịch — 02/11/2026

- Android 13 giả lập, `com.mobile.dev` chạy mã nguồn local qua Metro; tài khoản và API QA riêng. Không dùng APK đã phát hành làm bằng chứng.
- `04-bills-no-sync.png/xml`: Hóa đơn định kỳ không còn mục đồng bộ. Nhắc hóa đơn, sao lưu lịch, thêm lịch và kỳ FPT sắp tới vẫn hiện.
- `06-money-calendar.png/xml`: Lịch tiền không còn mục đồng bộ; Chi an toàn, khoản dự kiến và sao lưu vẫn hiện.
- `09-data.png/xml`: Dữ liệu và xuất nhập có nút **Đồng bộ lịch giữa thiết bị**, ngay sau thẻ Bản dữ liệu trên máy. Không bấm bật/tắt trong QA nên không đổi thiết lập của tài khoản thử.
- TypeScript, ESLint ba màn và 19/19 kiểm thử tập trung đạt. Chỉ di chuyển điều khiển giao diện, không thay cơ chế đồng bộ hoặc ghi tiền.
