# Widget: chọn danh mục có tìm kiếm và icon · 12/11/2026

Thử trên Pixel 3a giả lập Android 13, app QA riêng `com.mobile.dev` cài từ mã local. Backend QA cổng 3303 và tài khoản/ví/danh mục thử trong cơ sở dữ liệu QA riêng; không dùng tài khoản hoặc app production. Metro cổng 8081 cung cấp JavaScript cho bản debug.

| Bước | Kết quả | Ảnh |
| --- | --- | --- |
| Trên launcher, bấm danh mục Chi | Mở bộ chọn cùng cấu trúc với form: ô tìm, danh sách danh mục và icon thật của từng danh mục. | `14-picker-icons.png` |
| Gõ `Di` | Danh sách Chi lọc còn `Di chuyển`, vẫn hiện icon. Bài Jest còn kiểm tra `di lai` không dấu khớp `Đi lại`. | `15-search-di.png` |
| Chọn `Di chuyển` | Cửa sổ đóng về launcher; widget hiện tên đã chọn. Không tạo giao dịch. | `16-selected-expense.png` |
| Chuyển sang Thu | Bộ chọn chỉ hiện hai danh mục Thu và icon; chọn `Lương` thì widget đổi sang `Lương`. | `19-income-picker-loaded.png`, `20-selected-income.png` |
| Dừng riêng backend QA 3303 | Bộ chọn Thu vẫn mở với danh mục/icon đã cache. Chọn `Thưởng` khi backend tắt thì widget đổi ngay. | `21-offline-picker.png`, `22-offline-selected.png` |
| Đổi về Chi | `Di chuyển` vẫn được giữ riêng cho Chi. | `23-expense-preserved.png` |

Backend QA 3303 và backend chính 3000 đều được kiểm tra `/health` = 200 sau phép thử. Cấu hình API tạm dùng cho QA đã khôi phục trước commit. Ảnh được chọn chỉ chứa dữ liệu giả lập; không chứa email, token hoặc mật khẩu QA.

Giới hạn: bản debug cần Metro khi mở nguội. Icon có thể hiện biểu tượng mặc định nếu ảnh danh mục chưa từng tải và máy đang mất mạng; giao dịch thật và APK ký chưa nằm trong phép thử UI này.
