// Service để gọi Cloud Functions cho admin
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Lấy admin token từ localStorage
const getAdminToken = () => {
  const isAdmin = localStorage.getItem('isAdmin');
  return isAdmin === 'true' ? 'admin_thaybien2025' : null;
};

// Base URL cho Cloud Functions
// Production sử dụng region asia-southeast1 (Singapore) để tối ưu tốc độ cho Việt Nam
const FUNCTIONS_URL = 'https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net';

/**
 * Lấy danh sách tất cả học sinh
 * SỬ DỤNG FIRESTORE CLIENT SDK (Hybrid Model)
 */
export const getAllStudents = async () => {
  try {
    // Kiểm tra quyền admin
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      return { success: false, error: 'Không có quyền admin' };
    }

    // Query trực tiếp từ Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);

    const students = [];
    querySnapshot.forEach((doc) => {
      students.push({
        uid: doc.id,
        ...doc.data(),
      });
    });

    return { success: true, students };
  } catch (error) {
    console.error('Error getting students:', error);
    return { success: false, error: 'Lỗi khi lấy danh sách học sinh: ' + error.message };
  }
};

/**
 * Reset mật khẩu học sinh
 * SỬ DỤNG CLOUD FUNCTION (Sensitive Operation - Bảo mật)
 * @param {string} studentEmail - Email của học sinh
 * @param {string} newPassword - Mật khẩu mới
 */
export const resetStudentPassword = async (studentEmail, newPassword) => {
  try {
    console.log('📤 resetStudentPassword called with:', { studentEmail, newPassword });

    const adminToken = getAdminToken();

    if (!adminToken) {
      return { success: false, error: 'Không có quyền admin' };
    }

    const payload = {
      adminToken,
      studentEmail,
      newPassword,
    };

    console.log('📤 Sending to Cloud Function:', payload);

    const response = await fetch(`${FUNCTIONS_URL}/resetStudentPassword`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('📥 Cloud Function response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    return { success: false, error: 'Lỗi kết nối tới server: ' + error.message };
  }
};

/**
 * Xóa tài khoản học sinh
 * SỬ DỤNG CLOUD FUNCTION (Sensitive Operation - Bảo mật)
 * Xóa cả Auth user và Firestore document
 * @param {string} studentUid - UID của học sinh
 */
export const deleteStudent = async (studentUid) => {
  try {
    const adminToken = getAdminToken();

    if (!adminToken) {
      return { success: false, error: 'Không có quyền admin' };
    }

    const response = await fetch(`${FUNCTIONS_URL}/deleteStudent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminToken,
        studentUid,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting student:', error);
    return { success: false, error: 'Lỗi kết nối tới server' };
  }
};
