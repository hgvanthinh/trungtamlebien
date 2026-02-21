# Hướng Dẫn Tối Ưu Hóa GIF

## Kích thước hiện tại:
- **flame.gif**: 1.08 MB
- **burn.gif**: 2.05 MB
- **Tổng**: 3.13 MB

## Mục tiêu:
- **flame.gif**: ~600 KB (giảm 45%)
- **burn.gif**: ~700 KB (giảm 67%)
- **Tổng**: ~1.3 MB (tiết kiệm ~1.8 MB)

---

## Phương pháp 1: Sử dụng Công Cụ Trực Tuyến (Khuyến Nghị - Dễ Nhất)

### Ezgif.com (Miễn phí, Không cần đăng ký)

1. **Tối ưu flame.gif**:
   - Truy cập: https://ezgif.com/optimize
   - Upload `flame.gif`
   - Chọn "Optimization method": **Lossy GIF**
   - Đặt "Lossy compression level": **80-100**
   - Đặt "Colors": **128** (từ 256)
   - Click "Optimize GIF!"
   - Download file mới và đổi tên thành `flame.gif`

2. **Tối ưu burn.gif**:
   - Truy cập: https://ezgif.com/optimize
   - Upload `burn.gif`
   - Chọn "Optimization method": **Lossy GIF**
   - Đặt "Lossy compression level": **120-150** (nén mạnh hơn)
   - Đặt "Colors": **128**
   - Click "Optimize GIF!"
   - Download file mới và đổi tên thành `burn.gif`

3. **Sao lưu file gốc** (trước khi thay thế):
   ```
   public/
   ├── flame-original.gif  (backup)
   ├── burn-original.gif   (backup)
   ├── flame.gif           (file đã tối ưu)
   └── burn.gif            (file đã tối ưu)
   ```

---

## Phương pháp 2: Sử dụng Gifsicle (Command Line)

### Cài đặt Gifsicle:

**Windows** (qua Scoop):
```bash
scoop install gifsicle
```

**Hoặc tải trực tiếp**: https://www.lcdf.org/gifsicle/

### Lệnh tối ưu:

```bash
# Di chuyển vào thư mục public
cd e:\Website\trungtamdaythem-react\public

# Sao lưu file gốc
copy flame.gif flame-original.gif
copy burn.gif burn-original.gif

# Tối ưu flame.gif
gifsicle -O3 --colors 128 flame-original.gif -o flame.gif

# Tối ưu burn.gif (2 bước để nén mạnh hơn)
gifsicle -O3 --colors 128 burn-original.gif -o burn-temp.gif
gifsicle --lossy=80 burn-temp.gif -o burn.gif
del burn-temp.gif

# Kiểm tra kích thước mới
powershell -ExecutionPolicy Bypass -File check-size.ps1
```

**Giải thích tham số**:
- `-O3`: Tối ưu hóa tối đa
- `--colors 128`: Giảm bảng màu từ 256 xuống 128
- `--lossy=80`: Nén lossy ở mức 80% chất lượng

---

## Phương pháp 3: Sử dụng FFmpeg (Command Line)

### Cài đặt FFmpeg:

**Windows** (qua Scoop):
```bash
scoop install ffmpeg
```

**Hoặc tải trực tiếp**: https://ffmpeg.org/download.html

### Lệnh tối ưu:

```bash
# Di chuyển vào thư mục public
cd e:\Website\trungtamdaythem-react\public

# Sao lưu file gốc
copy flame.gif flame-original.gif
copy burn.gif burn-original.gif

# Tối ưu flame.gif (giảm 80% kích thước, giảm FPS)
ffmpeg -i flame-original.gif -vf "scale=iw*0.8:ih*0.8,fps=20" -y flame.gif

# Tối ưu burn.gif (giảm 75% kích thước, giảm FPS mạnh)
ffmpeg -i burn-original.gif -vf "scale=iw*0.75:ih*0.75,fps=15" -y burn.gif

# Kiểm tra kích thước mới
powershell -ExecutionPolicy Bypass -File check-size.ps1
```

**Giải thích tham số**:
- `scale=iw*0.8:ih*0.8`: Giảm 20% kích thước khung hình
- `fps=20`: Giảm xuống 20 khung/giây (từ 30+)
- `-y`: Ghi đè file tự động

---

## Phương pháp 4: Các Công Cụ Trực Tuyến Khác

### GIF Compressor (https://gifcompressor.com)
- Kéo thả file
- Chọn mức nén (compression level)
- Download

### CloudConvert (https://cloudconvert.com/gif-optimizer)
- Upload GIF
- Tùy chỉnh quality, colors, FPS
- Download

### TinyPNG (https://tinypng.com) *(Cũng hỗ trợ GIF)*
- Kéo thả file
- Tự động tối ưu
- Download

---

## Kiểm Tra Kết Quả

Sau khi tối ưu hóa, kiểm tra:

1. **Kích thước file**:
   ```bash
   cd e:\Website\trungtamdaythem-react\public
   powershell -ExecutionPolicy Bypass -File check-size.ps1
   ```

2. **Chất lượng hình ảnh**:
   - Mở file GIF trong trình duyệt
   - Kiểm tra độ sắc nét và màu sắc
   - Đảm bảo animation vẫn mượt mà

3. **Hiệu suất trong ứng dụng**:
   - Chạy dev server: `npm run dev`
   - Vào trang "Chế Tạo Vàng"
   - Kiểm tra tốc độ load và animation

---

## Lưu Ý Quan Trọng

- **Luôn sao lưu file gốc** trước khi tối ưu
- Mục tiêu là **chất lượng/kích thước cân bằng**, không phải nén tối đa
- Nếu chất lượng quá thấp sau tối ưu, giảm mức nén hoặc tăng số màu
- Test trên nhiều trình duyệt (Chrome, Firefox, Safari) để đảm bảo tương thích

---

## Kết Quả Mong Đợi

| File | Gốc | Tối ưu | Tiết kiệm |
|------|-----|--------|-----------|
| flame.gif | 1.08 MB | ~600 KB | ~480 KB (45%) |
| burn.gif | 2.05 MB | ~700 KB | ~1.35 MB (67%) |
| **Tổng** | **3.13 MB** | **~1.3 MB** | **~1.83 MB (59%)** |

Điều này sẽ cải thiện đáng kể tốc độ tải trang, đặc biệt trên kết nối chậm!
