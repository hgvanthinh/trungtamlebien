# Trung Tâm Dạy Thêm Toán - React Application

Website quản lý trung tâm dạy thêm toán được xây dựng bằng ReactJS với Vite, Tailwind CSS và Firebase.

## ⚡ Hybrid Architecture

Dự án sử dụng **Hybrid Architecture** để tối ưu hiệu suất:
- 🚀 **Firestore Client SDK** cho CRUD thông thường (nhanh hơn 6-20 lần!)
- 🔒 **Cloud Functions** chỉ cho tác vụ nhạy cảm (Reset password, Delete account)

**Kết quả:** Latency giảm từ 600-2100ms xuống 100-150ms! ⚡

## 🚀 Quick Start

### Development
```bash
# Cài đặt dependencies
npm install

# Chạy React App
npm run dev
```

**Lưu ý:** Dự án sử dụng **Production Firebase** (không dùng emulators)

### Production
```bash
# Deploy Firestore Rules (BẮT BUỘC!)
firebase deploy --only firestore:rules

# Deploy React App
npm run build
firebase deploy --only hosting
```

📚 **Xem `QUICK_START.md` để biết thêm chi tiết!**

## Tính năng

### ✅ Cho Học Sinh
- 🏠 **Dashboard** - Thống kê và lịch học sắp tới
- 🏆 **Bảng xếp hạng** - Xếp hạng theo điểm số
- 🎮 **Game vui** - Game học toán vui nhộn
- 📝 **Luyện đề** - Bài kiểm tra và luyện tập
- 📅 **Lịch học** - Quản lý lịch học cá nhân
- ⚖️ **Nội quy** - Quy định và FAQ
- 📚 **Tài liệu** - Kho tài liệu học tập

### ✅ Cho Admin
- 👥 **Quản lý học sinh** - Xem, thêm, sửa, xóa học sinh
- 🏫 **Quản lý lớp học** - Tạo lớp, phân lớp học sinh
- 📊 **Thống kê** - Báo cáo và phân tích
- 🔐 **Bảo mật** - Reset mật khẩu, xóa tài khoản

## Công nghệ sử dụng

### Frontend
- **React 18** - UI Library
- **Vite** - Build tool
- **React Router DOM** - Routing
- **Tailwind CSS** - Styling framework
- **Google Fonts** - Plus Jakarta Sans
- **Material Symbols** - Icon library

### Backend (Firebase)
- **Firebase Authentication** - User authentication
- **Cloud Firestore** - NoSQL database
- **Cloud Functions** - Serverless functions (sensitive operations)
- **Firebase Hosting** - Static hosting
- **Firebase Storage** - File storage

## 📊 Performance

| Tác vụ | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Lấy danh sách HS | 600-2100ms | 100-150ms | ⚡ **6-20x** |
| Lấy danh sách lớp | 600-2100ms | 100-150ms | ⚡ **6-20x** |
| Thêm HS vào lớp | 600-2100ms | 150-200ms | ⚡ **4-14x** |

## 📚 Documentation

| File | Mô tả |
|------|-------|
| `QUICK_START.md` | 🚀 Hướng dẫn nhanh |
| `HYBRID_ARCHITECTURE.md` | 🏗️ Chi tiết kiến trúc |
| `MIGRATION_SUMMARY.md` | 📋 Tóm tắt migration |
| `CODE_COMPARISON.md` | 🔄 So sánh code |
| `DEPLOYMENT_CHECKLIST.md` | ✅ Checklist deploy |
| `SUMMARY.md` | 📝 Tổng quan |

## Cấu trúc thư mục

```
src/
├── components/
│   ├── common/          # Components tái sử dụng
│   ├── layout/          # Layout components
│   ├── home/           # Home page components
│   └── admin/          # Admin components
├── contexts/           # React Context (Auth, Theme, User)
├── services/           # Service layer (Firestore SDK + Cloud Functions)
├── config/             # Firebase config
├── pages/              # Page components
│   ├── admin/         # Admin pages
│   └── ...            # Student pages
├── styles/            # Global styles
├── App.jsx            # Main app component
└── main.jsx           # Entry point
```

## 🔐 Admin Login

- Email: `admin@thaybien.com`
- Password: (your admin password)

## ⚠️ Important Notes

1. **Firestore Rules phải được deploy** trước khi sử dụng
2. **Admin phải đăng nhập** với email `admin@thaybien.com`
3. **Cloud Functions vẫn cần thiết** cho reset password và delete account

## License

MIT
