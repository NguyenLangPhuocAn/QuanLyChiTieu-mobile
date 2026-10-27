# Rà soát kế hoạch — 27/10/2026

Đối chiếu kế hoạch gốc PLAN-2026-10-21-BANK-MIC-RECURRING-BETA.md, sprint18/10, nhật ký, source và bằng chứng QA. Đây là bản chụp kết quả rà soát; kế hoạch tổng thể gốc ở thư mục dự án bên ngoài hai repo. Không thay hành vi app, chạy lại test hoặc phát hành trong lần rà này.

## Kết luận

**Chưa hoàn tất toàn bộ kế hoạch mở rộng.** Lõi hóa đơn đã qua kiểm tra Android emulator/API/MySQL QA thật; nhắc từng hóa đơn và phát hiện khoản dễ bỏ sót mới là thiết kế. Ngân hàng/AI/mic đã có source nhưng còn nghiệm thu tích hợp và điện thoại vật lý.

| Phần | Đã có | Chưa được xác nhận/triển khai |
|---|---|---|
| P0 lắc/chuông | Snapshot mới nhất, lifecycle/chống lặp, chỉ markProcessed sau Save/enqueue | OEM/quyền/nhóm/vuốt bỏ/phát lại trên máy thật; không hứa nhận biết chính xác banner heads-up |
| P1 AI ngân hàng | Consent, Gemini/schema, đối chiếu, loading/hủy/cache, fallback nhập tay | Môi trường thử bật cờ, Gemini thật/đa ngân hàng, độ chính xác/độ trễ; không tự đổi production |
| P2 cờ backend | `src/features/feature-flags.service.ts`, JWT/whitelist GET /features, mặc định AI tắt | Cờ DB/admin đổi khi server chạy là mở rộng tùy nhu cầu, không chặn nhắc local |
| P3 hóa đơn local | Tuần/tháng/năm, fixed/variable, pause/skip/reopen/archive, liên kết khoản đã ghi có xác nhận/chống trùng | Nhắc native từng kỳ, đề xuất tự động, mở form tạo nháp từ kỳ, sync/backup/tích hợp dự báo và kiểm lại giao dịch gốc |
| Nhắc khoản dễ quên | [Nghiên cứu/thiết kế](RECURRING-REMINDERS-RESEARCH.md) | Chưa có hành vi mới; detector cũ không đủ để tự gửi nhắc |
| P4 mic | `useVoiceInput`, transcript, phân tích/xem trước/điền nháp trong MainScreen | Quyền, nhận dạng tiếng Việt, hủy/mất dịch vụ trên điện thoại thật |
| P5 tốc độ | Có tối ưu được ghi nhận trước đây | Chưa có p50/p95 Wi-Fi/4G trên điện thoại thật; thời gian Metro debug không thay thế được |
| P6 dùng thử | Có kế hoạch nhóm nhỏ | Chưa có bằng chứng đợt tuyển/đo sử dụng nhóm trong tài liệu |

## Chỗ phải làm rõ trong plan

1. **MVP lịch sử khác mở rộng hiện tại.** Sprint18/10 ghi sourceMVP và release1.2.0; không dùng mốc đó để nói module hóa đơn mới hoặc AI mới đã nằm trong APK đang dùng. Bản release quan sát trên emulator26/10 là1.2.3/code8; không truy vấn release mới nhất trên GitHub trong lần rà này.
2. **Ba loại nhắc khác nhau:** gợi ý kỳ trong màn hình; nhắc kiểm tra tài chính chung ngoài app; nhắc cụ thể từng hóa đơn/kỳ. Chỉ hai loại đầu đã có nền source cũ; module hóa đơn mới chưa nối loại thứ ba.
3. **Mic và cờ không phải viết lại từ đầu.** Plan cần trạng thái “có source, chờ nghiệm thu”; service cờ thật nằm trong features, không ở đường dẫn ví dụ config cũ.
4. **Không lấy con số test cũ làm kết quả mới.** QA26/10 là50/50 Jest mục tiêu + Metro2/2,97 PNG gốc; model test ngân hàng23/10 là100/100 mobile và73/73 backend, đều mock. Không có lần chạy toàn bộ mới ngày27/10.
5. **Lịch/backup/dự báo còn tách rời.** Backup và chi an toàn của MVP không đồng nghĩa đã chứa lịch hóa đơn mới. Liên kết đã trả là snapshot, cần xử lý khi giao dịch gốc sửa/xóa.
6. **Detector cũ cần sửa trước khi tự nhắc.** Bậc tiền10.000, khóa chưa có tiền tệ và cửa sổ20–40ngày chỉ phù hợp hạn chế; không đủ cho ngoại tệ/tăng giá/chu kỳ quý/năm hoặc phân biệt mua thường xuyên với nghĩa vụ.

## Thứ tự thực hiện tiếp

- **Đợt A:** nhắc ngoài app cho lịch đã xác nhận; gộp cùng ngày, giờ người dùng chọn, mở đúng hóa đơn/kỳ, hủy khi paid/skip/pause/archive, chống trùng theo tài khoản/backend/kỳ/mốc. Scheduler/ID riêng, không ghi đè nhắc chung. Test boot/đổi giờ/đổi tài khoản/quyền bị tắt; không tự ghi tiền.
- **Đợt B:** phát hiện ứng viên có bằng chứng, đúng tiền tệ/chu kỳ; Theo dõi/Không phải định kỳ/Để sau có ghi nhớ. Chỉ thêm lịch sau xác nhận, gom trong Hóa đơn định kỳ. Đồng thời xử lý liên kết gốc bị sửa/xóa trước khi coi trạng thái thanh toán đáng tin cậy.
- **Đợt C:** tăng tiền/nghi trùng kỳ/tổng hợp thuê bao nhỏ; đưa lịch vào backup và dự báo. Dùng thử/gia hạn thiếu lịch sử cần người dùng xác nhận ngày, không tự suy ra thông tin không có.
- **Nghiệm thu:** Android local + QA thật, chụp từng bước, đối chiếu số dư/giao dịch. Sau đó điện thoại vật lý cho nhắc nền, ngân hàng/Gemini, mic/OCR và Wi-Fi/4G; commit/push mỗi đợt đã kiểm tra. Chưa xác nhận hạn hoàn thành mới, không tái sử dụng ngày18/10. APK production/web/server giữ nguyên tới khi được chốt.

## Bằng chứng đã đọc

- [QA hóa đơn](RECURRING-BILLS.md), [biên bản/97 ảnh](evidence/2026-10-26-recurring/README.md), [kết quả có cấu trúc](evidence/2026-10-26-recurring/verification.json).
- [Ngân hàng/AI source23/10](BANK-NOTIFICATIONS.md), nghiên cứu nhắc khoản dễ quên bên trên.
- Mobile source/QA `5b7f58c`, nghiên cứu `b4788fe`; backend source AI `017d678`, QA harness `5b3ce03`. Trước khi sửa tài liệu, HEAD hai repo khớp refs/heads/main từ git ls-remote, không có thay đổi source chưa lưu.

Không build/ký/phát hành APK, không restart/bật cờ/deploy production, không sửa web tải hoặc .env trong lần rà kế hoạch này.
