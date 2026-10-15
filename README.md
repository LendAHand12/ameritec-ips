# Ameritec IPS

- `client/` — React + Vite + Tailwind CSS v4 + shadcn/ui (Base UI)
- `server/` — Express 5 + MongoDB (Mongoose) + Nodemailer + Multer

## Cài đặt

```bash
npm run install:all
cp server/.env.example server/.env   # điền MONGODB_URI, JWT_SECRET, SMTP_*, ADMIN_*
npm run seed:admin --prefix server   # tạo/đặt lại mật khẩu admin (bảng admins riêng)
npm run dev                          # client: http://localhost:5173, server: http://localhost:5000
```

Thêm component shadcn: `cd client && npx shadcn@latest add <component>`

## Luồng tài khoản

1. **Đăng ký** (`/register`), 5 bước: thông tin tài khoản → giấy tờ tuỳ thân (mặt trước/sau) → Face ID (FaceTec, làm sau) → bật Google 2FA → xem lại & gửi.
2. Server gửi **mã 6 số** về email → user nhập ở `/verify-email`.
3. Tài khoản ở trạng thái **pending** cho đến khi admin duyệt.
4. **Đăng nhập** bằng email hoặc SĐT + mật khẩu → mã Google Authenticator.

**Mã giới thiệu:** vào bất kỳ trang nào với `?ref=CODE` thì mã được lưu vào `localStorage` (ghi đè mã cũ) và tự điền khi đăng ký.

**Email** luôn được trim + chuyển chữ thường ở cả client và server; SĐT lưu dạng E.164 (`+84901234567`).

## API

| Method | Path                              | Mô tả                                        |
| ------ | --------------------------------- | -------------------------------------------- |
| POST   | `/api/auth/register/check`        | Kiểm tra bước 1 (email/SĐT trùng, mã giới thiệu) |
| POST   | `/api/auth/register/2fa/setup`    | Tạo secret + QR Google Authenticator          |
| POST   | `/api/auth/register/2fa/verify`   | Xác nhận mã 2FA → `twoFactorToken`            |
| POST   | `/api/auth/register`              | Gửi đăng ký (multipart: `documentFront`, `documentBack`, `supportingDocument` tuỳ chọn) |
| POST   | `/api/auth/verify-email`          | Xác minh email bằng mã 6 số                   |
| POST   | `/api/auth/resend-verification`   | Gửi lại mã (chờ 60s giữa các lần)            |
| POST   | `/api/auth/login`                 | Đăng nhập (`method: email \| phone`)          |
| POST   | `/api/auth/login/2fa`             | Nhập mã 2FA → set cookie phiên               |
| POST   | `/api/auth/logout`                | Đăng xuất                                     |
| GET    | `/api/auth/me`                    | User hiện tại                                 |
| POST   | `/api/admin/auth/login`           | (admin) Đăng nhập admin — cookie `admin_token` riêng |
| POST   | `/api/admin/auth/logout`          | (admin) Đăng xuất                             |
| GET    | `/api/admin/auth/me`              | (admin) Admin hiện tại                        |
| GET    | `/api/admin/users`                | (admin) Danh sách user — lọc `q`, `kycStatus`, `accountStatus`, `registeredWithin`, `submittedWithin` (số ngày), `page`, `limit` |
| GET    | `/api/admin/users/stats`          | (admin) Số lượng theo trạng thái KYC + số tài khoản bị khoá |
| GET    | `/api/admin/users/export`         | (admin) Xuất CSV theo bộ lọc hoặc `ids=a,b,c`  |
| GET    | `/api/admin/users/:id`            | (admin) Chi tiết user (không che thông tin)   |
| GET    | `/api/admin/users/:id/identity/:side` | (admin) Ảnh giấy tờ `front` / `back` / `supporting`      |
| PATCH  | `/api/admin/users/:id/approve`    | (admin) Duyệt                                 |
| PATCH  | `/api/admin/users/:id/reject`     | (admin) Từ chối (`{ reason }`)                |
| PATCH  | `/api/admin/users/:id/lock`       | (admin) Khoá tài khoản (`{ reason }` tuỳ chọn) — user không đăng nhập được |
| PATCH  | `/api/admin/users/:id/unlock`     | (admin) Mở khoá                               |
| GET    | `/api/trade/config`               | Giá cổ phần, phương thức thanh toán của user, số dư hoa hồng |
| GET    | `/api/trade/portfolio`            | Cổ phần đang nắm giữ + đơn gần đây (dashboard) |
| GET/POST | `/api/trade/orders`             | Danh sách / tạo đơn (`{ shareType, amount }`) |
| POST   | `/api/trade/orders/:id/pay`       | `{ method: 'bep20', txHash }` hoặc `{ method: 'zelle', reference? }` |
| POST   | `/api/trade/orders/:id/refresh`   | Kiểm tra lại đơn BEP20 đang xác minh         |
| POST   | `/api/trade/orders/:id/cancel`    | Huỷ đơn chưa thanh toán                       |
| GET    | `/api/trade/orders/:id/certificate` | Tải certificate                             |
| GET    | `/api/referrals/summary`          | Mã giới thiệu, số thành viên F1–F3, tổng hoa hồng, cổ phần F1 đã mua |
| GET    | `/api/referrals/network`          | Cây mạng lưới tới F3 (tên che dạng "Michael T.") |
| GET    | `/api/referrals/commissions`      | Lịch sử hoa hồng (`q` mã đơn, `days`, `page`) — `/export` ra CSV |
| GET    | `/api/referrals/commissions/chart` | Hoa hồng theo ngày (`range=7D/30D/3M/1Y/ALL`) |
| GET    | `/api/admin/orders` (+ `/stats`, `/:id`) | (admin) Danh sách / thống kê / chi tiết đơn |
| PATCH  | `/api/admin/orders/:id/approve` · `/reject` | (admin) Duyệt / từ chối thanh toán   |
| POST   | `/api/admin/orders/:id/certificate` | (admin) Upload certificate (PDF/JPG/PNG/WEBP, 10 MB) |
| GET/PUT | `/api/admin/settings`            | (admin) Giá cổ phần, % hoa hồng, cấu hình BEP20/Zelle |
| POST   | `/api/admin/settings/zelle-qr`    | (admin) Upload QR Zelle                       |

## Mua cổ phần (Trade)

1. User chọn **Share A / Share B** (giá do admin cài ở *Operational Parameters*), nhập số USDT → tạo đơn (chỉ bán nguyên cổ phần).
2. Trang thanh toán `/trade/orders/:id`:
   - **USDT BEP20**: chuyển vào ví nhận do admin cài, dán TX hash → server tự kiểm tra on-chain (đúng token USDT, đúng ví, đủ tiền, giao dịch sau khi tạo đơn, đủ `BSC_MIN_CONFIRMATIONS`, mỗi TX hash chỉ dùng 1 lần) → đơn **Completed** tự động. Đơn đang chờ xác nhận được kiểm tra lại mỗi phút.
   - **Zelle** (chỉ user có SĐT +1): chuyển kèm mã đơn trong memo → bấm *I've paid* → admin kiểm tra và Approve/Reject ở `/admin/transactions`.
3. Admin upload **certificate** cho từng đơn đã hoàn tất; user tải ở trang đơn.
4. Đơn hoàn tất → **chỉ** người giới thiệu trực tiếp (F1) nhận **% hoa hồng** (admin cài) vào *Commission balance* (sổ cái `wallettransactions`, mỗi đơn chỉ trả 1 lần).

**Admin** nằm ở bảng `admins` riêng (không dùng chung `users`), đăng nhập tại `/admin/login`, phiên riêng (cookie `admin_token`, mặc định 8 giờ). Phiên user không vào được API admin và ngược lại.

Ảnh giấy tờ lưu ở `server/storage/kyc` (riêng tư, chỉ admin xem qua API). `server/uploads` là thư mục public tại `/uploads`.
