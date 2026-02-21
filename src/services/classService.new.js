// Service quản lý lớp học - Dùng Firestore Client SDK
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Tạo lớp học mới - DÙNG FIRESTORE CLIENT SDK
 */
export const createClass = async (name, grade) => {
  try {
    const classData = {
      name: name.trim(),
      grade: parseInt(grade),
      students: [],
      studentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const classRef = await addDoc(collection(db, 'classes'), classData);

    return {
      success: true,
      classId: classRef.id,
      class: {
        id: classRef.id,
        ...classData,
      },
    };
  } catch (error) {
    console.error('Error creating class:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi tạo lớp học',
    };
  }
};

/**
 * Lấy danh sách tất cả lớp học - DÙNG FIRESTORE CLIENT SDK
 */
export const getAllClasses = async () => {
  try {
    const classesRef = collection(db, 'classes');
    const q = query(classesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const classes = [];
    querySnapshot.forEach((doc) => {
      classes.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      classes: classes,
    };
  } catch (error) {
    console.error('Error getting classes:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách lớp học',
    };
  }
};

/**
 * Thêm học sinh vào lớp - DÙNG FIRESTORE CLIENT SDK
 * Cập nhật cả 2 bên: class document và user document
 */
export const addStudentToClass = async (classId, studentUid) => {
  try {
    // 1. Thêm studentUid vào array students của class
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, {
      students: arrayUnion(studentUid),
      studentCount: increment(1),
      updatedAt: new Date().toISOString(),
    });

    // 2. Thêm classId vào array classes của user
    const userRef = doc(db, 'users', studentUid);
    await updateDoc(userRef, {
      classes: arrayUnion(classId),
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding student to class:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi thêm học sinh vào lớp',
    };
  }
};

/**
 * Xóa học sinh khỏi lớp - DÙNG FIRESTORE CLIENT SDK
 */
export const removeStudentFromClass = async (classId, studentUid) => {
  try {
    // 1. Xóa studentUid khỏi array students của class
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, {
      students: arrayRemove(studentUid),
      studentCount: increment(-1),
      updatedAt: new Date().toISOString(),
    });

    // 2. Xóa classId khỏi array classes của user
    const userRef = doc(db, 'users', studentUid);
    await updateDoc(userRef, {
      classes: arrayRemove(classId),
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing student from class:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi xóa học sinh khỏi lớp',
    };
  }
};

/**
 * Lấy danh sách học sinh của một lớp - DÙNG FIRESTORE CLIENT SDK
 */
export const getClassStudents = async (classId) => {
  try {
    // Lấy thông tin lớp
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp học không tồn tại' };
    }

    const classData = classDoc.data();
    const studentIds = classData.students || [];

    if (studentIds.length === 0) {
      return { success: true, students: [] };
    }

    // Lấy thông tin tất cả học sinh trong lớp
    const students = [];
    for (const studentId of studentIds) {
      const studentRef = doc(db, 'users', studentId);
      const studentDoc = await getDoc(studentRef);

      if (studentDoc.exists()) {
        students.push({
          uid: studentDoc.id,
          ...studentDoc.data(),
        });
      }
    }

    return {
      success: true,
      students: students,
    };
  } catch (error) {
    console.error('Error getting class students:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách học sinh',
    };
  }
};

/**
 * Xóa lớp học - DÙNG FIRESTORE CLIENT SDK
 */
export const deleteClass = async (classId) => {
  try {
    // 1. Lấy danh sách học sinh trong lớp
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp học không tồn tại' };
    }

    const studentIds = classDoc.data().students || [];

    // 2. Xóa classId khỏi tất cả user documents
    for (const studentId of studentIds) {
      const userRef = doc(db, 'users', studentId);
      await updateDoc(userRef, {
        classes: arrayRemove(classId),
      });
    }

    // 3. Xóa class document
    await deleteDoc(classRef);

    return { success: true };
  } catch (error) {
    console.error('Error deleting class:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi xóa lớp học',
    };
  }
};

/**
 * Lưu buổi học - DÙNG FIRESTORE CLIENT SDK
 */
export const saveSession = async (
  classId,
  date,
  attendance,
  testScores,
  behaviorPoints,
  scoreImage
) => {
  try {
    // 1. Lưu session document
    const sessionData = {
      classId,
      date,
      attendance: attendance || {},
      testScores: testScores || {},
      behaviorPoints: behaviorPoints || {},
      scoreImage: scoreImage || '',
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, 'sessions'), sessionData);

    // 2. Cập nhật stats cho từng học sinh
    const studentIds = Object.keys(attendance || {});

    for (const studentUid of studentIds) {
      const userRef = doc(db, 'users', studentUid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) continue;

      const userData = userDoc.data();
      const attendanceStats = userData.attendanceStats || {
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
      };

      // Cập nhật attendance stats
      const status = attendance[studentUid]?.status;
      if (status === 'present') attendanceStats.totalPresent++;
      else if (status === 'absent') attendanceStats.totalAbsent++;
      else if (status === 'late') attendanceStats.totalLate++;

      // Cập nhật behavior points
      const points = behaviorPoints[studentUid]?.points || 0;
      const currentPoints = userData.totalBehaviorPoints || 0;

      await updateDoc(userRef, {
        attendanceStats,
        totalBehaviorPoints: currentPoints + points,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving session:', error);
    return {
      success: false,
      error: error.message || 'Lỗi khi lưu buổi học',
    };
  }
};
