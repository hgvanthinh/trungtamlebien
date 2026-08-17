# ARCHITECTURE — trungtamdaythem-react

## STACK
React 19.2 · Vite 7.2 · Tailwind CSS v4.1 · React Router v7.11 · Firebase v12.7 Modular SDK
MathLive 0.108 · XLSX 0.18 · Mammoth · html2pdf.js

## CRITICAL RULES (đừng vi phạm)

| # | Rule |
|---|------|
| 1 | **Tailwind v4**: KHÔNG có `tailwind.config.js` — theme config trong `styles/index.css` với `@theme {}` |
| 2 | **React Router v7**: Dùng `createBrowserRouter` + `RouterProvider` — KHÔNG dùng `<BrowserRouter>/<Routes>` |
| 3 | **Firebase Modular**: `import { getFirestore } from 'firebase/firestore'` — KHÔNG import compat/legacy |
| 4 | **Cloud Functions**: dùng cho tác vụ cần Admin SDK (`resetStudentPassword`, `deleteStudent`) **và toàn bộ luồng TIỀN** — mọi CRUD khác dùng Firestore Client SDK |
| 6 | **TIỀN (coins/gold)**: client TUYỆT ĐỐI không ghi trực tiếp — rules đã chặn. Mọi thay đổi số dư đi qua `services/moneyApi.js` → Cloud Function. Không thêm rule nào cho client ghi `coins`/`gold`, kể cả "chỉ cho tăng" |
| 5 | **No emulators**: `src/config/firebase.js` luôn kết nối production |

## PROJECT STRUCTURE

```
src/
├── pages/admin/        # AdminStore, Teaching, ...
├── pages/             # Store, Inventory, ...
├── components/common/ # Button, Modal, ... (shared)
├── components/layout/ # Sidebar, Layout
├── hooks/             # useAuth, useFirestore, ...
├── services/firebase/ # firestore.js, auth.js, storage.js, storeService.js, inventoryService.js
├── contexts/          # Auth, Theme, User
├── config/            # firebase.js (projectId: toanthaybien-2c3d2)
└── styles/index.css   # @import "tailwindcss" + @theme
```

## FIRESTORE DATA MODEL

```
users:       { uid, email({username}@quiz.com), username, role('admin'|'student'), coins, gold, avatar, classes[] }
classes:     { id, name, students[], sessions[] }
storeItems:  { id, name, description, price, currency('coins'|'gold'), category, discontinued(bool), imageUrl, createdAt, updatedAt }
inventories: { id, userId, itemId, itemName, itemDescription, itemImageUrl, purchasePrice, purchaseCurrency, purchasedAt }
craftLogs:   { uid, userName, riskLevel, levelName, quantity, totalCost, isSuccess, goldGained, dateKey, createdAt }  # server-only
versusRewardClaims: { sessionId(docId), uid, coins, createdAt }  # server-only, chống nhận thưởng 2 lần
```

**`storeItems.discontinued`**: `true` = ngưng bán (soft delete) — item vẫn hiển thị, chủ sở hữu vẫn thấy trong inventory, nhưng người chưa mua không mua được. Khi xóa item → tự động xóa khỏi tất cả inventories + Storage.

**Storage path**: `store-items/{itemId}_{timestamp}_{filename}`

## ARCHITECTURE PATTERNS

**Firebase data flow**: `services/firebase/*.js` → custom hook → component

**Hybrid Backend**:
- Firestore Client SDK → CRUD thường (latency ~100-150ms)
- Cloud Functions → tác vụ cần Admin SDK + **toàn bộ luồng tiền**

**Luồng TIỀN (Xu / Đồng Vàng)** — `client → services/moneyApi.js → Cloud Function → Firestore`

Client không bao giờ ghi `coins`/`gold`; `firestore.rules` chặn ở tầng dưới cùng.
Function tự lấy `uid` từ ID token (không tin `uid` client gửi lên), tự đọc giá và
tự tung RNG, nên client chỉ gửi *ý định* chứ không gửi *kết quả*:

| Function | Thay cho | Server tự quyết |
|---|---|---|
| `transferCurrency` | chuyển khoản HS↔HS | duyệt tài khoản, giới hạn lượt/ngày, số dư |
| `craftGold` | chế tạo vàng | **RNG thắng/thua**, giá theo `riskLevel` |
| `purchaseItem` | mua hàng | **giá + loại tiền đọc từ `storeItems`** |
| `pigPurchase` | mua heo / mua thức ăn | khối lớp (từ `classes`), giá heo, đơn giá thức ăn |
| `smashPiggy` | đập heo | **RNG mức vàng**, trừ `smashAttempts` |
| `claimVersusReward` | thưởng thắng trận | xác minh người thắng từ `versusMatchResults`, chống nhận 2 lần |

**Envelope response** — các function tiền trả về `{ ok, data }` hoặc `{ ok: false, error }`.
Cờ trạng thái là `ok`, dữ liệu nghiệp vụ nằm **gọn trong `data`**, không trộn phẳng.
Lý do: `craftGold` có field `success` mang nghĩa *thắng/thua* và trả `0` khi thua —
nếu spread phẳng thì nó ghi đè cờ trạng thái, khiến mọi lần chế tạo thua bị client
hiểu là request lỗi. (`feedPig` là function cũ, vẫn dùng `{ success }` riêng.)

Admin vẫn sửa số dư trực tiếp qua Client SDK (rules cho admin toàn quyền) —
dùng ở trang Students/Violations/Teaching.

**Rà soát**: `node scripts/audit-economy.cjs` (chỉ đọc) — đối chiếu số dư với sổ
cái và chấm điểm rủi ro. Cần `GOOGLE_APPLICATION_CREDENTIALS`.

## CONVENTIONS

- Components: functional + named export, PascalCase file
- Hooks: `use` prefix, camelCase
- State: `useState` local · Context shared · custom hook cho Firebase
- Import order: external libs → services → components → hooks/utils
- Env vars: `import.meta.env.VITE_*` (Vite)
- Admin email: `admin@thaybien.com` · Student email: `{username}@quiz.com`
