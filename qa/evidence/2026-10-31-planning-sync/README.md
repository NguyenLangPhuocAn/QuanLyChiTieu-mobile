# Đồng bộ lịch tiền và một file sao lưu — 31/10/2026

Source và QA local đã kiểm. Chưa phát hành APK, cập nhật web tải, triển khai bảng mới hoặc đổi server ổn định3000. Thiết bị thật và hai điện thoại vật lý chưa thử.

## Thay đổi

- Một vùng lưu local chứa cả lịch hóa đơn, khoản thu/chi dự kiến và trạng thái đồng bộ. Đọc dữ liệu cũ, chuyển khi có thay đổi; không xóa khóa cũ. Các thao tác sửa lịch/nhập file/nhận cloud dùng chung hàng đợi, ghi cả hai phần một lần.
- Đồng bộ theo tài khoản/backend, mặc định tắt. Xem trước nội dung hai bản rồi xác nhận dùng bản trên máy hoặc tài khoản. Khi đã bật, app mở/có mạng sẽ kiểm sau thay đổi, trở lại app, kết nối lại và mỗi30giây. Chưa có worker chạy khi force-stop. Nếu hai bên cùng sửa, giữ hai bản để chọn toàn bộ một bản; chưa ghép từng dòng.
- PUT có revision và transaction MySQL. Replay cùng nội dung không ghi lần nữa, xung đột khác nội dung409. Trạng thái nhắc từng lịch không truyền từ điện thoại khác; giữ lựa chọn local cho lịch đã có, lịch mới nhận mặc định tắt.
- File JSON thường v3 gồm book+plans; v2 vẫn nhận, giữ plans trên máy. Chọn file tự xem trước số lượng, tên, tiền và ngày. Khôi phục phải xác nhận và kiểm lại file/local; không cộng dồn. Lỗi ghi đĩa không thay nửa bộ lịch. Đổi tài khoản/ra nền/rời màn bỏ xác nhận cũ.

## Kiểm thử tự động

- Mobile: `npx jest --runInBand --testTimeout=30000`,97 bộ,611/611 đạt. Một lượt trước đạt610/611 do WidgetQuickEntry vượt giới hạn5giây khi máy bận; giữ log lượt đó, không sửa assertion để vượt kiểm thử. Lượt đầu trước hai ca bổ sung đã đạt609/609.
- Có19 ca mới ở planningSync/planningBackup/PlanningSyncControls và BillBookBackupFlow: migration/concurrent local edits, opt-in, push/pull, conflict/stale version, disable giữa GET, mất mạng/corrupt/disk full, v2/v3/atomic restore, xem trước tên/ngày, đổi tài khoản và callback cũ.
- Backend:52 bộ,377/377 đạt, gồm18 ca mới về payload/ngày/tiền/ID/liên kết, CAS/replay, cô lập tài khoản và bảng chưa triển khai.
- TypeScript và ESLint file đổi đạt ở hai repo; Prisma schema validate và node--check hai helper QA đạt. Không build native hoặc APK mới trong đợt này. Các kiểm thử gọi model bên ngoài vẫn là mock.

## API/MySQL thật

Runner mới3303, schema QA local được kiểm tên/host và tài khoảnQA8; thêm đúng bảng planning_snapshots vào schema đó, không reset/migrate database đang dùng. JWT thiếu trả401; ghi200; hai yêu cầu khác nhau cùng revision trả200/409; trùng ID trả400; user7 không đổi khi body giả userId7 gửi bằng JWT8. Gửi lại cùng bản không tăng revision. File api-results.json ghi kết quả.

SQL trước/sau giữ4ví,4giao dịch27–30,2khoản vay1–2. Ví8 giữ1.023.750đ, ba ví phụ0đ. Không gọi API tạo/cập nhật/xóa giao dịch để kiểm đồng bộ.

## Android13 local

App `com.mobile.dev`, source từ Metro8081 với config QA trỏ API3303. Không dùng APK production cũ để chứng minh source mới.

1. 06–13: thêm lương QA5triệu bằng form và xác nhận. Chi an toàn vẫn34.125đ/ngày, SQL giữ nguyên.
2. 20: khoản dự kiến còn sau khởi động lại. 22–26: xem hai bản, xác nhận giữ bản local; cloud revision3→4, một khoản dự kiến.
3. Helper device-b gọi API thật bằng cùng tài khoản để mô phỏng máyB, thêm lịch100k và chi dự kiến80k, revision5. 27–29: trở lại app tự nhận, hiện cả hai; Chi an toàn28.125đ/ngày, còn843.750đ. Đây là một giả lập cộng client API, không phải hai điện thoại thật.
4. 33–35: Android SAF lưu file thật. Đọc file từ Downloads, kiểm JSON v3/1lịch/2khoản, nhắc tắt. Android thêm đuôi.json theo MIME; exported-planning-v3.json giữ nội dung kiểm tra.
5. 36–38: chọn lại file tự hiện preview, không bấm đọc riêng. 39–40 Hủy giữ bản hiện có;41–42 xác nhận khôi phục thành công. Không đổi tiền hoặc nhân đôi lịch.
6. 43–53: nguồn cuối bổ sung tên/tiền/ngày của từng khoản dự kiến trong preview. Mở lại app vẫn có lịch, chọn file lại;53 là giao diện cuối đã kiểm trực quan. Ca callback đổi tài khoản được thử trong mock.

## Sự cố và giới hạn

- Lượt14–15 gặp ANR đồng thời app/SystemUI/NavigationBar; không coi là đạt. Reboot guest chưa ổn. Mở AVD bằng renderer phần mềm, cold boot và `-read-only` để tránh sửa dữ liệu gốc/khóa AVD. Session tạm vẫn cho đọc/ghi QA và lưu file trong phiên, nhưng thay đổi trong phiên không cam kết giữ sau khi đóng emulator. Một thao tác dọn khóa AVD bị policy chặn nên không thực hiện; chuyển sang cách mở tạm được hỗ trợ.
- 16 là frame trắng khi chưa tải source xong,17 trở đi là app sẵn sàng. Chụp25 còn đang gửi;26 mới là đã bật. Không dùng các frame trung gian làm kết quả cuối.
- Unit dùng mock cho lỗi đĩa/mất mạng/callback và hai local store. Chưa nghiệm thu offline bằng airplane mode, OEM,4G, force-stop background sync hoặc khôi phục dữ liệu người dùng thật. Các giới hạn mic/OCR/ảnh offline/Vay-Nợ offline trước đó không đổi.
- Cần triển khai bảng/API sau khi chốt đợt cập nhật. Server cũ giữ local và báo chưa đồng bộ được. GET hiện lấy snapshot; tối ưu chỉ hỏi revision khi chưa đổi được ghi kế hoạch, chưa làm.

Kế hoạch nhập lại khoản gần đây, nhớ ghép cột/ví Excel và nhớ phạm vi xuất được ghi riêng; chưa triển khai. PNG/XML là ảnh gốc với dữ liệu QA. SHA256SUMS.txt dùng để đối chiếu file và index Git.
