# 🚀 Deployment Checklist - Hybrid Architecture

## ✅ Pre-Deployment Checklist

### 1. Code Changes
- [x] ✅ Refactor `adminService.js` - Chuyển `getAllStudents` sang Firestore SDK
- [x] ✅ Refactor `classService.js` - Chuyển tất cả CRUD sang Firestore SDK
- [x] ✅ Giữ lại Cloud Functions cho sensitive operations
- [x] ✅ Cập nhật Firestore Rules
- [x] ✅ Thêm comments và documentation

### 2. Testing (Local)
- [ ] 🔄 Chạy Firebase Emulators
- [ ] 🔄 Test lấy danh sách học sinh
- [ ] 🔄 Test lấy danh sách lớp học
- [ ] 🔄 Test tạo lớp học mới
- [ ] 🔄 Test thêm/xóa học sinh khỏi lớp
- [ ] 🔄 Test reset mật khẩu (Cloud Function)
- [ ] 🔄 Test xóa tài khoản (Cloud Function)

---

## 📝 Deployment Steps

### Step 1: Deploy Firestore Rules (BẮT BUỘC!)
```bash
firebase deploy --only firestore:rules
```

**Verify:**
- [ ] Rules deployed successfully
- [ ] Admin có thể query collection `users`
- [ ] Admin có thể query collection `classes`
- [ ] Admin có thể query collection `sessions`

### Step 2: Test với Production Firestore
```bash
# Chạy React app với production Firestore
npm run build
npm run preview
```

**Test:**
- [ ] Login với admin account
- [ ] Lấy danh sách học sinh (phải nhanh hơn trước)
- [ ] Lấy danh sách lớp học
- [ ] Thêm/xóa học sinh khỏi lớp

### Step 3: Deploy Cloud Functions (Optional)
```bash
# Chỉ deploy 2 functions còn lại
firebase deploy --only functions:resetStudentPassword,functions:deleteStudent
```

**Note:** Nếu Cloud Functions đã tồn tại và không thay đổi, có thể bỏ qua step này.

### Step 4: Deploy React App
```bash
npm run build
firebase deploy --only hosting
```

---

## 🧪 Post-Deployment Testing

### Test trên Production:
- [ ] ✅ Login với admin account
- [ ] ✅ Lấy danh sách học sinh (check latency)
- [ ] ✅ Lấy danh sách lớp học
- [ ] ✅ Tạo lớp học mới
- [ ] ✅ Thêm học sinh vào lớp
- [ ] ✅ Xóa học sinh khỏi lớp
- [ ] ✅ Reset mật khẩu học sinh (Cloud Function)
- [ ] ✅ Xóa tài khoản học sinh (Cloud Function)

### Performance Check:
- [ ] ✅ Latency lấy danh sách học sinh < 200ms
- [ ] ✅ Latency lấy danh sách lớp < 200ms
- [ ] ✅ Latency thêm/xóa học sinh < 300ms
- [ ] ✅ Không có lỗi trong Console

---

## 🐛 Troubleshooting

### Lỗi: "Missing or insufficient permissions"
**Nguyên nhân:** Firestore Rules chưa được deploy  
**Giải pháp:**
```bash
firebase deploy --only firestore:rules
```

### Lỗi: "Admin không có quyền"
**Nguyên nhân:** Chưa đăng nhập với admin account  
**Giải pháp:** Login với email `admin@thaybien.com`

### Lỗi: "Cloud Function không tìm thấy"
**Nguyên nhân:** Cloud Functions chưa được deploy  
**Giải pháp:**
```bash
firebase deploy --only functions
```

### Latency vẫn cao
**Nguyên nhân:** Có thể do:
1. Firestore Rules chưa được deploy
2. Vẫn đang gọi Cloud Functions
3. Network chậm

**Giải pháp:**
1. Kiểm tra Network tab trong DevTools
2. Verify Firestore Rules đã deploy
3. Check code có đang gọi đúng service functions

---

## 📊 Performance Metrics

### Trước Migration:
- Lấy danh sách học sinh: ~600-2100ms
- Lấy danh sách lớp: ~600-2100ms
- Thêm học sinh vào lớp: ~600-2100ms

### Sau Migration (Expected):
- Lấy danh sách học sinh: ~100-150ms ⚡
- Lấy danh sách lớp: ~100-150ms ⚡
- Thêm học sinh vào lớp: ~150-200ms ⚡

**Improvement: 6-20x faster!** 🎉

---

## 🔐 Security Checklist

- [x] ✅ Firestore Rules chỉ cho phép admin query collections
- [x] ✅ Học sinh không thể thay đổi `role`, `email`, `classes`
- [x] ✅ Reset mật khẩu phải qua Cloud Function
- [x] ✅ Xóa tài khoản phải qua Cloud Function
- [x] ✅ Admin token được kiểm tra trong service functions

---

## 📚 Documentation

- [x] ✅ `HYBRID_ARCHITECTURE.md` - Chi tiết về kiến trúc
- [x] ✅ `MIGRATION_SUMMARY.md` - Tóm tắt migration
- [x] ✅ `DEPLOYMENT_CHECKLIST.md` - Checklist này
- [x] ✅ Comments trong code

---

## ✨ Final Notes

1. **Backup trước khi deploy:**
   ```bash
   # Export Firestore data
   gcloud firestore export gs://[BUCKET_NAME]/[EXPORT_FOLDER]
   ```

2. **Monitor sau khi deploy:**
   - Firebase Console > Firestore > Usage
   - Firebase Console > Functions > Logs
   - React App > Console errors

3. **Rollback nếu cần:**
   ```bash
   # Rollback Firestore Rules
   firebase deploy --only firestore:rules
   
   # Rollback Hosting
   firebase hosting:rollback
   ```

---

**Ready to deploy? Let's go! 🚀**
