// Service quản lý lớp học - SỬ DỤNG FIRESTORE CLIENT SDK (Hybrid Model)
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Kiểm tra quyền admin
 */
const checkAdminPermission = () => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin) {
    throw new Error('Không có quyền admin');
  }
};

/**
 * Tạo lớp học mới
 */
export const createClass = async (name, grade) => {
  try {
    checkAdminPermission();

    const classesRef = collection(db, 'classes');
    const docRef = await addDoc(classesRef, {
      name,
      grade,
      students: [],
      studentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      classId: docRef.id,
      message: 'Tạo lớp học thành công',
    };
  } catch (error) {
    console.error('Error creating class:', error);
    return { success: false, error: error.message || 'Lỗi khi tạo lớp học' };
  }
};

/**
 * Lấy danh sách tất cả lớp học (chỉ admin)
 */
export const getAllClasses = async () => {
  try {
    checkAdminPermission();

    const classesRef = collection(db, 'classes');
    const querySnapshot = await getDocs(classesRef);

    const classes = [];
    querySnapshot.forEach((doc) => {
      classes.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return { success: true, classes };
  } catch (error) {
    console.error('Error getting classes:', error);
    return { success: false, error: error.message || 'Lỗi khi lấy danh sách lớp' };
  }
};

/**
 * Lấy danh sách lớp học của một học sinh cụ thể
 * Học sinh có thể gọi hàm này để lấy thông tin các lớp mình tham gia
 */
export const getStudentClasses = async (classIds) => {
  try {
    if (!classIds || classIds.length === 0) {
      return { success: true, classes: [] };
    }

    const classes = [];
    for (const classId of classIds) {
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDoc(classRef);
      if (classDoc.exists()) {
        classes.push({
          id: classDoc.id,
          ...classDoc.data(),
        });
      }
    }

    return { success: true, classes };
  } catch (error) {
    console.error('Error getting student classes:', error);
    return { success: false, error: error.message || 'Lỗi khi lấy danh sách lớp' };
  }
};

/**
 * Thêm học sinh vào lớp
 */
export const addStudentToClass = async (classId, studentUid) => {
  try {
    checkAdminPermission();

    // Cập nhật class document
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, {
      students: arrayUnion(studentUid),
      studentCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Cập nhật user document
    const userRef = doc(db, 'users', studentUid);
    await updateDoc(userRef, {
      classes: arrayUnion(classId),
    });

    return { success: true, message: 'Đã thêm học sinh vào lớp' };
  } catch (error) {
    console.error('Error adding student to class:', error);
    return { success: false, error: error.message || 'Lỗi khi thêm học sinh' };
  }
};

/**
 * Xóa học sinh khỏi lớp
 */
export const removeStudentFromClass = async (classId, studentUid) => {
  try {
    checkAdminPermission();

    // Cập nhật class document
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, {
      students: arrayRemove(studentUid),
      studentCount: increment(-1),
      updatedAt: serverTimestamp(),
    });

    // Cập nhật user document
    const userRef = doc(db, 'users', studentUid);
    await updateDoc(userRef, {
      classes: arrayRemove(classId),
    });

    return { success: true, message: 'Đã xóa học sinh khỏi lớp' };
  } catch (error) {
    console.error('Error removing student from class:', error);
    return { success: false, error: error.message || 'Lỗi khi xóa học sinh' };
  }
};

/**
 * Lưu buổi học (điểm danh + điểm số)
 */
export const saveSession = async (classId, date, attendance, testScores, behaviorPoints, coinsAdjustment, scoreImage = null, studyPointsAdjustment = null) => {
  try {
    checkAdminPermission();

    // 1. Lưu session document
    const sessionsRef = collection(db, 'sessions');
    const docRef = await addDoc(sessionsRef, {
      classId,
      date,
      attendance: attendance || null,
      testScores: testScores || null,
      behaviorPoints: behaviorPoints || null,
      coinsAdjustment: coinsAdjustment || null,
      studyPointsAdjustment: studyPointsAdjustment || null,
      scoreImage: scoreImage || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Cập nhật điểm tích lũy cho từng học sinh
    if (behaviorPoints && Object.keys(behaviorPoints).length > 0) {
      for (const [studentUid, pointData] of Object.entries(behaviorPoints)) {
        const userRef = doc(db, 'users', studentUid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentPoints = userData.totalBehaviorPoints || 0;
          const newPoints = currentPoints + (pointData.points || 0);

          await updateDoc(userRef, {
            totalBehaviorPoints: newPoints,
          });
        }
      }
    }

    // 3. Cập nhật xu cho từng học sinh
    if (coinsAdjustment && Object.keys(coinsAdjustment).length > 0) {
      for (const [studentUid, coinData] of Object.entries(coinsAdjustment)) {
        const userRef = doc(db, 'users', studentUid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentCoins = userData.coins || 0;
          let newCoins = currentCoins + (coinData.coins || 0);

          // Không cho phép âm
          if (newCoins < 0) {
            newCoins = 0;
          }

          await updateDoc(userRef, {
            coins: newCoins,
          });
        }
      }
    }

    // 4. Cập nhật điểm học tập cho từng học sinh
    if (studyPointsAdjustment && Object.keys(studyPointsAdjustment).length > 0) {
      for (const [studentUid, data] of Object.entries(studyPointsAdjustment)) {
        const userRef = doc(db, 'users', studentUid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentStudyPoints = userData.studyPoints || 0;
          const newStudyPoints = currentStudyPoints + (data.points || 0);

          await updateDoc(userRef, {
            studyPoints: newStudyPoints,
          });
        }
      }
    }

    return {
      success: true,
      sessionId: docRef.id,
      message: 'Đã cập nhật điểm tích lũy và xu thành công',
    };
  } catch (error) {
    console.error('Error saving session:', error);
    return { success: false, error: error.message || 'Lỗi khi lưu điểm' };
  }
};

/**
 * Lấy danh sách học sinh của lớp
 */
export const getClassStudents = async (classId) => {
  try {
    checkAdminPermission();

    // Lấy thông tin lớp học
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp học không tồn tại' };
    }

    const classData = classDoc.data();
    const studentUids = classData.students || [];

    if (studentUids.length === 0) {
      return { success: true, students: [] };
    }

    // Lấy thông tin các học sinh song song để tăng tốc
    const studentPromises = studentUids.map(async (uid) => {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        return {
          uid: userDoc.id,
          ...userDoc.data(),
        };
      }
      return null;
    });

    const studentsResults = await Promise.all(studentPromises);
    const students = studentsResults.filter(s => s !== null);

    return { success: true, students };
  } catch (error) {
    console.error('Error getting class students:', error);
    return { success: false, error: error.message || 'Lỗi khi lấy danh sách học sinh' };
  }
};

/**
 * Xóa lớp học
 */
export const deleteClass = async (classId) => {
  try {
    checkAdminPermission();

    // Lấy thông tin lớp học trước khi xóa
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp học không tồn tại' };
    }

    const classData = classDoc.data();
    const studentUids = classData.students || [];

    // Xóa classId khỏi tất cả học sinh
    for (const uid of studentUids) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        classes: arrayRemove(classId),
      });
    }

    // Xóa lớp học
    await deleteDoc(classRef);

    return { success: true, message: 'Đã xóa lớp học' };
  } catch (error) {
    console.error('Error deleting class:', error);
    return { success: false, error: error.message || 'Lỗi khi xóa lớp học' };
  }
};

/**
 * Reset điểm tích lũy và xu cho tất cả học sinh trong lớp
 */
export const resetClassPointsAndCoins = async (classId, points, coins) => {
  try {
    checkAdminPermission();

    // Lấy danh sách học sinh trong lớp
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp học không tồn tại' };
    }

    const classData = classDoc.data();
    const studentUids = classData.students || [];

    if (studentUids.length === 0) {
      return { success: false, error: 'Lớp học chưa có học sinh' };
    }

    // Reset điểm và xu cho từng học sinh
    for (const uid of studentUids) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        totalBehaviorPoints: points,
        coins: coins,
      });
    }

    return {
      success: true,
      message: `Đã reset điểm/xu cho ${studentUids.length} học sinh`,
    };
  } catch (error) {
    console.error('Error resetting class points and coins:', error);
    return { success: false, error: error.message || 'Lỗi khi reset điểm/xu' };
  }
};

/**
 * Lưu thông tin vi phạm và nộp phạt cho học sinh
 * @param {Object} violations - {studentUid: {amount: number}} - Tiền vi phạm mới (nghìn đồng)
 * @param {Object} payments - {studentUid: {amount: number}} - Tiền nộp phạt (nghìn đồng)
 */
export const saveViolations = async (violations, payments) => {
  try {
    checkAdminPermission();

    const updatePromises = [];

    // Xử lý vi phạm mới
    if (violations && Object.keys(violations).length > 0) {
      for (const [studentUid, data] of Object.entries(violations)) {
        const amount = parseInt(data.amount) || 0;
        if (amount > 0) {
          const userRef = doc(db, 'users', studentUid);
          updatePromises.push(
            updateDoc(userRef, {
              penaltyDebt: increment(amount),
              totalViolationAmount: increment(amount),
            })
          );
        }
      }
    }

    // Xử lý nộp phạt
    if (payments && Object.keys(payments).length > 0) {
      for (const [studentUid, data] of Object.entries(payments)) {
        const amount = parseInt(data.amount) || 0;
        if (amount > 0) {
          const userRef = doc(db, 'users', studentUid);
          updatePromises.push(
            updateDoc(userRef, {
              penaltyDebt: increment(-amount),
              paidAmount: increment(amount),
            })
          );
        }
      }
    }

    // Thực hiện tất cả updates song song
    await Promise.all(updatePromises);

    return {
      success: true,
      message: 'Đã cập nhật thông tin vi phạm thành công',
    };
  } catch (error) {
    console.error('Error saving violations:', error);
    return { success: false, error: error.message || 'Lỗi khi lưu vi phạm' };
  }
};

/**
 * Reset điểm học tập cho tất cả học sinh trong lớp về 0
 */
export const resetStudyPoints = async (studentUids) => {
  try {
    checkAdminPermission();

    if (!studentUids || studentUids.length === 0) {
      return { success: false, error: 'Không có học sinh nào để reset' };
    }

    const updatePromises = studentUids.map((studentUid) => {
      const userRef = doc(db, 'users', studentUid);
      return updateDoc(userRef, {
        studyPoints: 0,
      });
    });

    await Promise.all(updatePromises);

    return {
      success: true,
      message: `Đã reset điểm học tập cho ${studentUids.length} học sinh`,
    };
  } catch (error) {
    console.error('Error resetting study points:', error);
    return { success: false, error: error.message || 'Lỗi khi reset điểm học tập' };
  }
};

/**
 * Cập nhật màu nhãn cho học sinh
 * @param {string} studentUid - UID của học sinh
 * @param {string|null} color - Màu ('black', 'blue', 'green', 'red') hoặc null để xóa
 */
export const updateStudentLabelColor = async (studentUid, color) => {
  try {
    checkAdminPermission();

    const userRef = doc(db, 'users', studentUid);
    await updateDoc(userRef, {
      labelColor: color || null,
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating student label color:', error);
    return { success: false, error: error.message || 'Lỗi khi cập nhật màu' };
  }
};

/**
 * Reset tất cả vi phạm của học sinh trong lớp về 0
 */
export const resetViolations = async (studentUids) => {
  try {
    checkAdminPermission();

    if (!studentUids || studentUids.length === 0) {
      return { success: false, error: 'Không có học sinh nào để reset' };
    }

    const updatePromises = studentUids.map((studentUid) => {
      const userRef = doc(db, 'users', studentUid);
      return updateDoc(userRef, {
        penaltyDebt: 0,
        paidAmount: 0,
        totalViolationAmount: 0,
      });
    });

    await Promise.all(updatePromises);

    return {
      success: true,
      message: 'Đã reset thông tin vi phạm thành công',
    };
  } catch (error) {
    console.error('Error resetting violations:', error);
    return { success: false, error: error.message || 'Lỗi khi reset vi phạm' };
  }
};

