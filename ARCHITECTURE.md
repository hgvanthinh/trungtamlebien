# ARCHITECTURE — trungtamdaythem-react

## STACK
React 19.2 · Vite 7.2 · Tailwind CSS v4.1 · React Router v7.11 · Firebase v12.7 Modular SDK
MathLive 0.108 · XLSX 0.18 · Mammoth · html2pdf.js · socket.io-client 4.x

## CRITICAL RULES (đừng vi phạm)

| # | Rule |
|---|------|
| 1 | **Tailwind v4**: KHÔNG có `tailwind.config.js` — theme config trong `styles/index.css` với `@theme {}` |
| 2 | **React Router v7**: Dùng `createBrowserRouter` + `RouterProvider` — KHÔNG dùng `<BrowserRouter>/<Routes>` |
| 3 | **Firebase Modular**: `import { getFirestore } from 'firebase/firestore'` — KHÔNG import compat/legacy |
| 4 | **game-server/**: Dùng `firebase-admin`, KHÔNG dùng Firebase Modular SDK |
| 5 | **Game engine**: Camera + player position dùng RAF + `el.style.transform` trực tiếp — KHÔNG dùng React state |
| 6 | **Cloud Functions**: Chỉ dùng cho `resetStudentPassword` và `deleteStudent` — mọi CRUD khác dùng Firestore Client SDK |
| 7 | **No emulators**: `src/config/firebase.js` luôn kết nối production |

## PROJECT STRUCTURE

```
src/
├── pages/admin/        # AdminStore, Teaching, ...
├── pages/             # Store, Inventory, GameLobby, BombGame, ...
├── components/common/ # Button, Modal, ... (shared)
├── components/layout/ # Sidebar, Layout
├── hooks/             # useAuth, useFirestore, ...
├── services/firebase/ # firestore.js, auth.js, storage.js, storeService.js, inventoryService.js
├── services/api/      # socket.js (Socket.IO client)
├── contexts/          # Auth, Theme, User
├── config/            # firebase.js (projectId: toanthaybien-2c3d2)
└── styles/index.css   # @import "tailwindcss" + @theme

game-server/           # Node.js port 3001 — Express + Socket.IO + firebase-admin
```

## FIRESTORE DATA MODEL

```
users:       { uid, email({username}@quiz.com), username, role('admin'|'student'), coins, gold, avatar, classes[] }
classes:     { id, name, students[], sessions[] }
storeItems:  { id, name, description, price, currency('coins'|'gold'), category, discontinued(bool), imageUrl, createdAt, updatedAt }
inventories: { id, userId, itemId, itemName, itemDescription, itemImageUrl, purchasePrice, purchaseCurrency, purchasedAt }
```

**`storeItems.discontinued`**: `true` = ngưng bán (soft delete) — item vẫn hiển thị, chủ sở hữu vẫn thấy trong inventory, nhưng người chưa mua không mua được. Khi xóa item → tự động xóa khỏi tất cả inventories + Storage.

**Storage path**: `store-items/{itemId}_{timestamp}_{filename}`

## ARCHITECTURE PATTERNS

**Firebase data flow**: `services/firebase/*.js` → custom hook → component

**Hybrid Backend**:
- Firestore Client SDK → mọi CRUD (latency ~100-150ms)
- Cloud Functions → chỉ reset password + delete account (cần Admin SDK)

**Game real-time** (`/game-lobby`, `/game/:roomId`):
- Client ↔ game-server (port 3001) qua Socket.IO
- Auth: Firebase ID token verify phía server
- Rendering: RAF loop + direct DOM (`el.style.transform`) cho 60fps — không dùng React state cho game state animation
- Map 29×13, viewport 15×13, camera follow lerp, player interpolation easeOutQuad 118ms
- Xu: -10 khi bắt đầu, +100 người thắng (Firestore transaction)

## CONVENTIONS

- Components: functional + named export, PascalCase file
- Hooks: `use` prefix, camelCase
- State: `useState` local · Context shared · custom hook cho Firebase
- Import order: external libs → services → components → hooks/utils
- Env vars: `import.meta.env.VITE_*` (Vite)
- Admin email: `admin@thaybien.com` · Student email: `{username}@quiz.com`
