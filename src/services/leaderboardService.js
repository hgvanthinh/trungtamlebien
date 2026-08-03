// Service quản lý xếp hạng học sinh
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Cache classes map (classId -> grade)
let classesGradeMap = null;

export const seedClassesGradeMap = (classList) => {
  classesGradeMap = {};
  classList.forEach(c => {
    classesGradeMap[c.id] = parseInt(c.grade) || 0;
  });
};

const fetchClassesGradeMap = async (seedClasses = null) => {
  if (seedClasses && seedClasses.length > 0 && !classesGradeMap) {
    classesGradeMap = {};
    seedClasses.forEach(c => {
      classesGradeMap[c.id] = parseInt(c.grade) || 0;
    });
  }
  if (classesGradeMap) return classesGradeMap;
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classesGradeMap = {};
    classesSnapshot.docs.forEach(d => {
      const data = d.data();
      classesGradeMap[d.id] = parseInt(data.grade) || 0;
    });
  } catch {
    classesGradeMap = {};
  }
  return classesGradeMap;
};


/**
 * Fetch all students once - OPTIMIZED version
 * Lấy tất cả học sinh 1 lần duy nhất, cache kết quả
 */
const fetchAllStudentsOptimized = async (_forceRefresh = false, seedClasses = null) => {

  try {
    const usersRef = collection(db, 'users');
    const studentsQuery = query(usersRef, where('role', '==', 'student'));
    const studentsSnapshot = await getDocs(studentsQuery);

    const gradeMap = await fetchClassesGradeMap(seedClasses);


    const students = studentsSnapshot.docs.map((docSnapshot) => {
      const userData = docSnapshot.data();
      const userClasses = userData.classes || [];

      // Lấy grade từ classesGradeMap dựa trên class đầu tiên của học sinh
      const grade = userClasses.length > 0 ? (gradeMap[userClasses[0]] || 0) : 0;

      return {
        uid: docSnapshot.id,
        fullName: userData.fullName,
        username: userData.username,
        avatar: userData.avatar,
        totalBehaviorPoints: userData.totalBehaviorPoints || 0,
        coins: userData.coins || 0,
        pigLevel: userData.pigLevel || 0,
        grade,
        classes: userClasses,
      };
    });

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
      return { success: true, leaderboard: [], className: classData.displayName || classData.name };
    }

    // Fetch all students từ cache
    const allStudents = await fetchAllStudentsOptimized(forceRefresh);

    // Filter theo classId - client-side filtering
    const students = allStudents
      .filter(student => studentUids.includes(student.uid))
      .map(({ uid, fullName, username, avatar, totalBehaviorPoints, coins, pigLevel }) => ({
        uid,
        fullName,
        username,
        avatar,
        totalBehaviorPoints,
        coins,
        pigLevel,
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
      className: classData.displayName || classData.name,
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
export const getGradeLeaderboard = async (grade, forceRefresh = false, seedClasses = null) => {
  try {
    // Fetch all students từ cache
    const allStudents = await fetchAllStudentsOptimized(forceRefresh, seedClasses);

    // Filter theo grade - client-side filtering
    const students = allStudents
      .filter(student => student.grade === grade)
      .map(({ uid, fullName, username, avatar, totalBehaviorPoints, coins, pigLevel }) => ({
        uid,
        fullName,
        username,
        avatar,
        totalBehaviorPoints,
        coins,
        pigLevel,
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
export const getCenterLeaderboard = async (forceRefresh = false, seedClasses = null) => {
  try {
    // Fetch all students từ cache
    const studentsWithGrade = await fetchAllStudentsOptimized(forceRefresh, seedClasses);

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
 * Lấy khối (grade) của 1 học sinh dựa trên lớp đầu tiên (dùng cho game heo đất)
 */
export const getStudentGrade = async (userClasses) => {
  if (!userClasses || userClasses.length === 0) return 0;

  // Nếu đã có cache (admin đã query cả collection, hoặc seed từ trước) thì dùng luôn
  if (classesGradeMap) {
    const cached = userClasses.map(id => classesGradeMap[id] || 0).find(g => g > 0);
    if (cached) return cached;
  }

  // Học sinh KHÔNG được query cả collection 'classes' (rules chỉ cho đọc lớp của mình),
  // nên phải đọc trực tiếp từng doc lớp theo id.
  for (const classId of userClasses) {
    try {
      const snap = await getDoc(doc(db, 'classes', classId));
      const g = snap.exists() ? (parseInt(snap.data().grade) || 0) : 0;
      if (g > 0) {
        classesGradeMap = { ...(classesGradeMap || {}), [classId]: g };
        return g;
      }
    } catch {
      // không đọc được lớp này → thử lớp tiếp theo
    }
  }
  return 0;
};

/**
 * Clear cache manually (dùng khi cần force refresh)
 */
export const clearLeaderboardCache = () => {
  classesGradeMap = null;
};
