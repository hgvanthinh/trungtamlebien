# ARCHITECTURE.md

## TECH STACK SUMMARY

### Core Framework
- **React 19.2** - Latest React with concurrent features and server components support
- **Vite 7.2** - Next-generation build tool with HMR and optimized bundling

### Styling
- **Tailwind CSS v4.1**
  - ⚠️ **CRITICAL**: V4 uses CSS-first configuration (`@theme` in CSS files)
  - NO `tailwind.config.js` - Configuration via `@import "tailwindcss"` and `@theme` directive
  - Utility-first approach with JIT compilation

### Routing
- **React Router v7.11**
  - ⚠️ **CRITICAL**: V7 uses Data Router pattern (`createBrowserRouter`, `RouterProvider`)
  - Loader/Action API for data fetching
  - NO `<BrowserRouter>` or `<Routes>` pattern - use `createBrowserRouter` instead

### Backend & Services
- **Firebase v12.7** (Modular SDK)
  - **Firestore**: NoSQL database
  - **Authentication**: User management
  - **Storage**: File uploads
  - ⚠️ Use modular imports: `import { getFirestore } from 'firebase/firestore'`

### Specialized Libraries
- **MathLive 0.108** - Interactive math equation editor
- **XLSX 0.18** - Excel file parsing/generation
- **Mammoth** - DOCX to HTML conversion
- **html2pdf.js** - PDF generation from HTML
- **socket.io-client 4.x** - Real-time client (dùng cho Game Lobby + BombGame)
- **socket.io 4.x** (game-server) - WebSocket server
- **firebase-admin** (game-server) - Server-side Firebase Auth token verification

---

## PROJECT STRUCTURE

```
src/
├── pages/              # Route-level components
│   ├── admin/         # Admin dashboard pages
│   └── public/        # Public-facing pages (GameLobby.jsx, BombGame.jsx)
├── components/        # Reusable UI components
│   ├── common/       # Shared components (Button, Modal, etc.)
│   └── features/     # Feature-specific components
├── hooks/            # Custom React hooks
├── services/         # External service integrations
│   ├── firebase/    # Firebase config & utilities
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── firestore.js
│   │   └── storage.js
│   └── api/         # API wrappers
│       └── socket.js # Socket.IO client (game server connection)
├── contexts/         # React Context providers
├── utils/           # Helper functions
├── assets/          # Static assets (images, fonts)
└── styles/          # Global styles (Tailwind imports)
    └── index.css    # @import "tailwindcss" + @theme config

game-server/            # Node.js game server (chạy riêng port 3001)
├── server.js          # Express + Socket.IO + Firebase Admin
├── .env               # GOOGLE_APPLICATION_CREDENTIALS, PORT
└── package.json       # ESM ("type": "module"), nodemon dev
```

### Key Features

#### Game Đặt Bom — Bomberman (`/game-lobby`, `/game/:roomId`)
- **Lobby** (`/game-lobby`): Tạo/tham gia phòng qua Socket.IO, toggle ready, host bắt đầu game
- **BombGame** (`/game/:roomId`): Game Bomberman multiplayer real-time
  - Map `29×13` ô, viewport `15×13` với **camera follow** smooth (RAF lerp)
  - **Player movement animation**: client-side interpolation `easeOutQuad` 118ms (khớp server cooldown 130ms)
  - Bomb timer 3s, explosion range 3, chain reaction, block phá được
  - Avatar nhân vật = `userProfile.avatar` từ Firestore (fallback: chữ cái đầu tên)
  - SVG inline cho tất cả tiles (floor/wall/block/bomb/explosion) — không cần file PNG
  - Mini-map real-time + toggle ẩn/hiện tên nhân vật
  - Mobile D-Pad + bomb button, LAN test qua `VITE_GAME_SERVER_URL`
- **Xu mechanics**: -10 Xu khi bắt đầu, +100 Xu cho người thắng (Firestore transaction)
- **Spawn**: 12 vị trí trải đều, safe zone 2 ô xung quanh
- **Giới hạn**: Không giới hạn số người/phòng (maxPlayers = 99)

#### Store & Inventory System
- **Admin Store Management** (`/admin/store`): Admins can create, edit, and delete store items
  - Upload item images to Firebase Storage
  - Set item name, description, and price (in Xu or Đồng vàng)
  - Select item category (currently: Viền Avatar)
  - All items are always available (no stock/quantity limits)
- **Student Store** (`/store`): Students can browse and purchase items
  - Filter items by currency type (Xu/Đồng vàng)
  - View item details, category, and prices
  - Purchase items using available Xu or Đồng vàng
  - Items can be purchased multiple times (e.g., avatars, cosmetics)
- **Student Inventory** (`/inventory`): Students can view their purchased items
  - Display all owned items with purchase date and category
  - Show item details and original price
- **Data Structure**:
  - `storeItems` collection: Item metadata (name, description, price, currency, category, imageUrl)
  - `inventories` collection: Student purchases (userId, itemId, purchaseDate)
  - User profile fields: `coins` (Xu), `gold` (Đồng vàng)

### Data Flow Patterns

**Pattern 1 — Firebase (CRUD):**
```
Firebase Service → Custom Hook → Component → UI
```
```javascript
// services/firebase/firestore.js
export const getTeachings = async () => { ... }
// hooks/useTeachings.js → pages/admin/Teaching.jsx
```

**Pattern 2 — Socket.IO (Real-time Game):**
```
Client                          game-server (port 3001)
  connectToGameServer()  ──────▶  verify Firebase ID token
  socket.emit('room:create') ──▶  createRoom() → io.emit('rooms:list')
  socket.emit('room:start')  ──▶  initGameState() → io.emit('game:start')
  socket.emit('game:move')   ──▶  throttle 130ms → broadcastState()
                             ◀──  socket.emit('game:state', publicState)
  setGameState(gs)  (React)        RAF loop renders smooth animation
```
```javascript
// src/services/api/socket.js
export async function connectToGameServer(photoURL = '') {
  const idToken = await auth.currentUser.getIdToken(true);
  socket.auth = { token: idToken, photoURL };
  socket.connect();
}
export const movePlayer = (roomId, dir) => socket.emit('game:move', { roomId, dir });
export const placeBomb  = (roomId)      => socket.emit('game:bomb', { roomId });
```

---

## CONVENTIONS

### Styling Rules
- **PRIMARY**: Use Tailwind utility classes directly in JSX
- **AVOID**: CSS Modules, styled-components, inline styles
- **EXCEPTION 1**: Complex animations hoặc third-party overrides may use scoped CSS
- **EXCEPTION 2 (Game Engine)**: `BombGame.jsx` dùng `el.style.transform` trực tiếp qua `ref` trong RAF loop (60fps) để tránh React re-render overhead. Camera + player position KHÔNG dùng React state.

```jsx
// ✅ GOOD (UI thông thường)
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  Submit
</button>

// ✅ GOOD (Game engine — RAF direct DOM)
rafRef.current = requestAnimationFrame(() => {
  mapDivRef.current.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
});

// ❌ AVOID (ngoài game engine)
<button style={{ padding: '8px 16px' }}>Submit</button>
```

### Component Conventions
- **Type**: Functional Components only (no class components)
- **Export**: Named exports preferred for better refactoring

```jsx
// ✅ GOOD
export function TeachingCard({ title, description }) {
  return <div>...</div>
}

// ❌ AVOID
export default ({ title, description }) => <div>...</div>
```

### State Management
- **Local State**: `useState` for component-level state
- **Shared State**: React Context + `useContext`
- **Server State**: Custom hooks wrapping Firebase calls
- **Form State**: Controlled components with `useState`

### Naming Conventions
- **Components**: PascalCase (`TeachingCard.jsx`, `AdminLayout.jsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.js`, `useFirestore.js`)
- **Utils**: camelCase (`formatDate.js`, `validateEmail.js`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`, `ROLES`)
- **Files**: Match component name (`TeachingCard.jsx` exports `TeachingCard`)

### Import Order
```javascript
// 1. External libraries
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. Services
import { getTeachings } from '@/services/firebase/firestore'

// 3. Components
import { Button } from '@/components/common/Button'

// 4. Utils/Hooks
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/date'
```

---

## DEVELOPMENT RULES (AI CODE GENERATION)

### 1. Tailwind CSS v4 Compliance
- ✅ Use utility classes: `bg-blue-500`, `text-lg`, `flex items-center`
- ❌ DO NOT generate `tailwind.config.js` files
- ✅ Theme customization goes in CSS via `@theme` directive:
  ```css
  @import "tailwindcss";

  @theme {
    --color-primary: #3b82f6;
    --font-sans: 'Inter', system-ui;
  }
  ```

### 2. Firebase Modular SDK (v9+ Syntax)
```javascript
// ✅ CORRECT (Modular)
import { getFirestore, collection, getDocs } from 'firebase/firestore'
const db = getFirestore()
const snapshot = await getDocs(collection(db, 'teachings'))

// ❌ WRONG (Compat/Legacy)
import firebase from 'firebase/app'
firebase.firestore().collection('teachings').get()
```

### 3. React Router v7 Data Router Pattern
```javascript
// ✅ CORRECT (v7 Pattern)
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/admin',
    element: <AdminLayout />,
    loader: adminLoader,
    children: [
      { path: 'teachings', element: <Teaching /> }
    ]
  }
])

export function App() {
  return <RouterProvider router={router} />
}

// ❌ WRONG (v5/v6 Pattern)
<BrowserRouter>
  <Routes>
    <Route path="/admin" element={<AdminLayout />} />
  </Routes>
</BrowserRouter>
```

### 4. React 19 Best Practices
- Use `use` hook for Suspense integration when available
- Prefer `useTransition` for non-urgent updates
- Leverage automatic batching (no manual `unstable_batchedUpdates`)

### 5. Code Generation Priorities
1. **Security First**: Validate all Firebase operations, sanitize user inputs
2. **Performance**: Lazy load routes, memoize expensive computations
3. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation
4. **Error Handling**: Try-catch for async operations, user-friendly error messages
5. **Type Safety**: Use JSDoc comments for better IDE support (no TypeScript in this project)

### 6. Firebase Security Rules (Reference)
```javascript
// Always implement Firestore rules for production:
// - Authenticate users before writes
// - Validate data structure
// - Implement role-based access (admin vs user)
```

---

## SPECIAL LIBRARY USAGE

### MathLive (Math Equations)
```jsx
import { MathfieldElement } from 'mathlive'

<math-field
  onInput={(e) => setValue(e.target.value)}
>
  {initialValue}
</math-field>
```

### XLSX (Excel Import/Export)
```javascript
import * as XLSX from 'xlsx'

// Read Excel
const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(sheet)

// Write Excel
const ws = XLSX.utils.json_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
XLSX.writeFile(wb, 'output.xlsx')
```

---

## ANTI-PATTERNS (AVOID)

❌ **DO NOT**:
- Use `create-react-app` patterns (this is Vite)
- Import entire Firebase SDK (`import firebase from 'firebase'`)
- Use `<BrowserRouter>` with React Router v7
- Generate `tailwind.config.js` for v4
- Use class components or legacy lifecycle methods
- Commit Firebase config with real credentials (use `.env`)
- Dùng `useState` + CSS transition cho camera/player game — phải dùng RAF + ref (xem Exception 2)
- Dùng Firebase Modular SDK trong `game-server/` — server dùng `firebase-admin` (Admin SDK)

✅ **DO**:
- Use Vite's `import.meta.env` for environment variables
- Leverage Vite's fast HMR during development
- Follow modular imports for tree-shaking
- Keep components small and focused (single responsibility)
- Document complex Firebase queries with comments
- Các animation game-critical (player move, camera) → RAF + `el.style.transform` trực tiếp
- Game server auth: verify Firebase ID token qua `admin.auth().verifyIdToken(token)`

---

## DEPLOYMENT CHECKLIST

- [ ] Environment variables set (Firebase config, API keys)
- [ ] Firestore security rules deployed
- [ ] Firebase Authentication providers configured
- [ ] Build optimization (`vite build`)
- [ ] Test production build locally (`vite preview`)
- [ ] Analytics/monitoring setup (Firebase Analytics)

---

**Last Updated**: 2026-02-21
**Maintained By**: Development Team
**AI Context Ready**: ✅ This file is optimized for AI code generation assistants.
