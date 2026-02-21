// Service quản lý xếp hạng học sinh
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Cache leaderboard data (5 phút)
let leaderboardCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Lấy thông tin lớp học của học sinh để xác định khối
 * (Deprecated - kept for backward compatibility)
 */
const getStudentGrade = async (classIds) => {
  if (!classIds || classIds.length === 0) return null;

  try {
    // Lấy tất cả classes song song để tăng tốc
    const classPromises = classIds.map(async (classId) => {
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDoc(classRef);
      if (classDoc.exists()) {
        return parseInt(classDoc.data().grade) || 0;
      }
      return 0;
    });

    const grades = await Promise.all(classPromises);
    return Math.max(...grades);
  } catch (error) {
    // Nếu không có quyền đọc classes, trả về null (silent fail - đây là expected behavior)
    return null;
  }
};

/**
 * Fetch all students once - OPTIMIZED version
 * Lấy tất cả học sinh 1 lần duy nhất, cache kết quả
 */
const fetchAllStudentsOptimized = async (forceRefresh = false) => {
  // Check cache
  if (!forceRefresh && leaderboardCache && cacheTimestamp) {
    const cacheAge = Date.now() - cacheTimestamp;
    if (cacheAge < CACHE_DURATION) {
      return leaderboardCache;
    }
  }

  try {
    const usersRef = collection(db, 'users');
    const studentsQuery = query(usersRef, where('role', '==', 'student'));
    const studentsSnapshot = await getDocs(studentsQuery);

    const students = [];

    for (const docSnapshot of studentsSnapshot.docs) {
      const userData = docSnapshot.data();

      // Lấy grade từ classes nếu chưa có denormalized field
      let grade = userData.gradeLevel || 0;
      if (!grade && userData.classes && userData.classes.length > 0) {
        grade = await getStudentGrade(userData.classes);
      }

      students.push({
        uid: docSnapshot.id,
        fullName: userData.fullName,
        username: userData.username,
        avatar: userData.avatar,
        totalBehaviorPoints: userData.totalBehaviorPoints || 0,
        coins: userData.coins || 0,
        grade: grade,
        classes: userData.classes || [],
      });
    }

    // Update cache
    leaderboardCache = students;
    cacheTimestamp = Date.now();

    return students;
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

/**
 * Lấy bảng xếp hạng theo lớp - OPTIMIZED
 */
export const getClassLeaderboard = async (classId, forceRefresh = false) => {
  try {
    // Lấy class info
    const classRef = doc(db, 'classes', classId);
    const classDoc = await getDoc(classRef);

    if (!classDoc.exists()) {
      return { success: false, error: 'Lớp không tồn tại' };
    }

    const classData = classDoc.data();
    const studentUids = classData.students || [];

    if (studentUids.length === 0) {
      return { success: true, leaderboard: [], className: classData.name };
    }

    // Fetch all students từ cache
    const allStudents = await fetchAllStudentsOptimized(forceRefresh);

    // Filter theo classId - client-side filtering
    const students = allStudents
      .filter(student => studentUids.includes(student.uid))
      .map(({ uid, fullName, username, avatar, totalBehaviorPoints, coins }) => ({
        uid,
        fullName,
        username,
        avatar,
        totalBehaviorPoints,
        coins,
      }));

    // Sắp xếp theo điểm giảm dần
    students.sort((a, b) => b.totalBehaviorPoints - a.totalBehaviorPoints);

    // Thêm rank
    const leaderboard = students.map((student, index) => ({
      ...student,
      rank: index + 1,
    }));

    return {
      success: true,
      leaderboard,
      className: classData.name,
      totalStudents: students.length
    };
  } catch (error) {
    console.error('Error getting class leaderboard:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy bảng xếp hạng theo khối - OPTIMIZED
 */
export const getGradeLeaderboard = async (grade, forceRefresh = false) => {
  try {
    // Fetch all students từ cache
    const allStudents = await fetchAllStudentsOptimized(forceRefresh);

    // Filter theo grade - client-side filtering
    const students = allStudents
      .filter(student => student.grade === grade)
      .map(({ uid, fullName, username, avatar, totalBehaviorPoints, coins }) => ({
        uid,
        fullName,
        username,
        avatar,
        totalBehaviorPoints,
        coins,
      }));

    if (students.length === 0) {
      return { success: true, leaderboard: [], grade, totalStudents: 0 };
    }

    // Sắp xếp theo điểm giảm dần
    students.sort((a, b) => b.totalBehaviorPoints - a.totalBehaviorPoints);

    // Thêm rank
    const leaderboard = students.map((student, index) => ({
      ...student,
      rank: index + 1,
    }));

    return {
      success: true,
      leaderboard,
      grade,
      totalStudents: students.length
    };
  } catch (error) {
    console.error('Error getting grade leaderboard:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy bảng xếp hạng toàn trung tâm - OPTIMIZED
 * Khối cao nhất luôn ở top, sau đó mới đến khối thấp hơn
 */
export const getCenterLeaderboard = async (forceRefresh = false) => {
  try {
    // Fetch all students từ cache
    const studentsWithGrade = await fetchAllStudentsOptimized(forceRefresh);

    // Nhóm theo khối
    const gradeGroups = {};
    studentsWithGrade.forEach(student => {
      const grade = student.grade;
      if (!gradeGroups[grade]) {
        gradeGroups[grade] = [];
      }
      gradeGroups[grade].push(student);
    });

    // Sắp xếp từng khối theo điểm
    Object.keys(gradeGroups).forEach(grade => {
      gradeGroups[grade].sort((a, b) => b.totalBehaviorPoints - a.totalBehaviorPoints);
    });

    // Lấy danh sách khối và sắp xếp từ cao đến thấp
    const grades = Object.keys(gradeGroups).map(Number).sort((a, b) => b - a);

    // Ghép các khối lại theo thứ tự khối cao đến thấp
    const leaderboard = [];
    let currentRank = 1;

    grades.forEach(grade => {
      const studentsInGrade = gradeGroups[grade];
      studentsInGrade.forEach(student => {
        leaderboard.push({
          ...student,
          rank: currentRank++,
          gradeRank: studentsInGrade.indexOf(student) + 1,
        });
      });
    });

    return {
      success: true,
      leaderboard,
      totalStudents: leaderboard.length,
      grades
    };
  } catch (error) {
    console.error('Error getting center leaderboard:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy tất cả bảng xếp hạng cho học sinh - OPTIMIZED
 * Fetch data 1 lần, filter nhiều cách
 */
export const getAllLeaderboards = async (studentClasses, studentGrade, forceRefresh = false) => {
  try {
    // Fetch all students once từ cache
    await fetchAllStudentsOptimized(forceRefresh);

    const results = {};

    // Xếp hạng theo lớp (lấy lớp đầu tiên nếu học nhiều lớp)
    if (studentClasses && studentClasses.length > 0) {
      const classResult = await getClassLeaderboard(studentClasses[0], false); // reuse cache
      results.classLeaderboard = classResult;
    }

    // Xếp hạng theo khối
    if (studentGrade) {
      const gradeResult = await getGradeLeaderboard(studentGrade, false); // reuse cache
      results.gradeLeaderboard = gradeResult;
    }

    // Xếp hạng toàn trung tâm
    const centerResult = await getCenterLeaderboard(false); // reuse cache
    results.centerLeaderboard = centerResult;

    return { success: true, ...results };
  } catch (error) {
    console.error('Error getting all leaderboards:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear cache manually (dùng khi cần force refresh)
 */
export const clearLeaderboardCache = () => {
  leaderboardCache = null;
  cacheTimestamp = null;
};
