// Service để admin quản lý học sinh - Dùng Firestore Client SDK
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Base URL cho Cloud Functions (chỉ dùng cho tác vụ nhạy cảm)
const FUNCTIONS_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/toanthaybien-2c3d2/us-central1'
  : 'https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net';

// Lấy admin token từ localStorage
const getAdminToken = () => {
  const isAdmin = localStorage.getItem('isAdmin');
  return isAdmin === 'true' ? 'admin_thaybien2025' : null;
};

/**
 * Lấy danh sách tất cả học sinh - DÙNG FIRESTORE CLIENT SDK
 * Không cần gọi Cloud Function nữa, lấy trực tiếp từ Firestore
 */
export const getAllStudents = async () => {
  try {
    // Query collection 'users' với điều kiện role = 'student'
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'student'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    const students = [];
    querySnapshot.forEach((doc) => {
      students.push({
        uid: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      students: students,
      total: students.length,
    };
  } catch (error) {
    console.error('Error getting students from Firestore:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách học sinh',
    };
  }
};

/**
 * Cập nhật thông tin học sinh - DÙNG FIRESTORE CLIENT SDK
 * @param {string} studentUid - UID của học sinh
 * @param {object} data - Dữ liệu cần cập nhật
 */
export const updateStudent = async (studentUid, data) => {
  try {
    const studentRef = doc(db, 'users', studentUid);
    await updateDoc(studentRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating student:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi cập nhật thông tin học sinh',
    };
  }
};

/**
 * Reset mật khẩu học sinh - VẪN DÙNG CLOUD FUNCTION (Tác vụ nhạy cảm)
 * @param {string} studentEmail - Email của học sinh
 * @param {string} newPassword - Mật khẩu mới
 */
export const resetStudentPassword = async (studentEmail, newPassword) => {
  try {
    const adminToken = getAdminToken();

    if (!adminToken) {
      return { success: false, error: 'Không có quyền admin' };
    }

    const response = await fetch(`${FUNCTIONS_URL}/resetStudentPassword`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminToken,
        studentEmail,
        newPassword,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: 'Lỗi kết nối tới server' };
  }
};

/**
 * Xóa tài khoản học sinh - VẪN DÙNG CLOUD FUNCTION (Tác vụ nguy hiểm)
 * Xóa Auth user + Firestore document
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
