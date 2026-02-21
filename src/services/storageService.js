import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Nén ảnh xuống dưới 200KB
 * @param {File} file - File ảnh gốc
 * @param {number} maxSizeKB - Kích thước tối đa (KB)
 * @returns {Promise<Blob>} - Blob ảnh đã nén
 */
const compressImage = async (file, maxSizeKB = 200) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize nếu ảnh quá lớn (giữ tỷ lệ, max 1200px)
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Thử nén với quality giảm dần cho đến khi đạt được kích thước mong muốn
        let quality = 0.9;
        const targetSize = maxSizeKB * 1024; // Convert to bytes

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Không thể nén ảnh'));
                return;
              }

              // Nếu kích thước đã đủ nhỏ hoặc quality đã quá thấp thì dừng
              if (blob.size <= targetSize || quality <= 0.1) {
                resolve(blob);
              } else {
                // Giảm quality và thử lại
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => {
        reject(new Error('Không thể đọc ảnh'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Không thể đọc file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Upload avatar cho user
 * @param {string} userId - ID của user
 * @param {File} file - File ảnh cần upload
 * @returns {Promise<string>} - URL của ảnh đã upload
 */
export const uploadAvatar = async (userId, file) => {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WebP)');
    }

    // Validate file size before compression (max 10MB để tránh ảnh quá lớn)
    const maxOriginalSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxOriginalSize) {
      throw new Error('Kích thước ảnh gốc không được vượt quá 10MB');
    }

    // Nén ảnh xuống dưới 200KB
    let compressedBlob;
    try {
      compressedBlob = await compressImage(file, 200);
    } catch (compressError) {
      throw new Error('Không thể nén ảnh: ' + compressError.message);
    }

    // Kiểm tra kích thước sau khi nén
    const finalSizeKB = (compressedBlob.size / 1024).toFixed(2);
    console.log(`Ảnh sau khi nén: ${finalSizeKB}KB (gốc: ${(file.size / 1024).toFixed(2)}KB)`);

    // Tạo tên file unique
    const timestamp = Date.now();
    const fileName = `${timestamp}_avatar.jpg`; // Luôn lưu dạng JPG sau khi nén
    const storageRef = ref(storage, `avatars/${userId}/${fileName}`);

    // Upload file đã nén
    const snapshot = await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/jpeg',
    });

    // Lấy download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return { success: true, url: downloadURL, size: compressedBlob.size };
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return { success: false, error: error.message || 'Upload ảnh thất bại' };
  }
};

/**
 * Xóa avatar cũ
 * @param {string} avatarUrl - URL của ảnh cần xóa
 */
export const deleteAvatar = async (avatarUrl) => {
  try {
    if (!avatarUrl || !avatarUrl.includes('firebasestorage')) {
      return { success: true }; // Không phải ảnh từ Firebase Storage
    }

    // Extract path from URL
    const urlParts = avatarUrl.split('/o/')[1];
    if (!urlParts) return { success: true };

    const filePath = decodeURIComponent(urlParts.split('?')[0]);
    const fileRef = ref(storage, filePath);

    await deleteObject(fileRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting avatar:', error);
    // Không throw error vì việc xóa ảnh cũ không quan trọng bằng upload ảnh mới
    return { success: false, error: error.message };
  }
};

/**
 * Upload nhiều file (dùng cho tài liệu, bài tập, etc)
 * @param {string} folder - Thư mục chứa file
 * @param {File} file - File cần upload
 * @returns {Promise<Object>} - Thông tin file đã upload
 */
export const uploadFile = async (folder, file) => {
  try {
    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('Kích thước file không được vượt quá 50MB');
    }

    // Tạo tên file unique
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);

    // Upload file
    const snapshot = await uploadBytes(storageRef, file);

    // Lấy download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      url: downloadURL,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { success: false, error: error.message || 'Upload file thất bại' };
  }
};
