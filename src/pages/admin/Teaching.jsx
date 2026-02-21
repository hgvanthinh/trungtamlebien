import { useState, useEffect, useRef } from 'react';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { getAllClasses, getClassStudents, saveSession, resetClassPointsAndCoins, resetStudyPoints, updateStudentLabelColor } from '../../services/classService';
import { getClassLeaderboard, getGradeLeaderboard, getCenterLeaderboard } from '../../services/leaderboardService';
import TopRankBorder from '../../components/common/TopRankBorder';
import Avatar from '../../components/common/Avatar';
import rankBgImg from '../../assets/ranks/rank-bg.gif';
import rippleGif from '../../assets/ranks/ripple.gif';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Teaching = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetValues, setResetValues] = useState({ points: 0, coins: 0 });
  const [resetting, setResetting] = useState(false);

  // Undo state for reset operations
  const [resetBackup, setResetBackup] = useState(null); // { type: 'points' | 'study', data: [...] }
  const [undoing, setUndoing] = useState(false);

  // Leaderboard data
  const [gradeLeaderboard, setGradeLeaderboard] = useState(null);
  const [centerLeaderboard, setCenterLeaderboard] = useState(null);

  // Inline input states - lưu theo studentUid
  const [pointsInputs, setPointsInputs] = useState({}); // {studentUid: value}
  const [coinsInputs, setCoinsInputs] = useState({}); // {studentUid: value}
  const [studyPointsInputs, setStudyPointsInputs] = useState({}); // {studentUid: value}

  // Reset study points state
  const [resettingStudy, setResettingStudy] = useState(false);

  // Sort states
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState('points'); // 'name', 'points', 'coins' - default: points

  // Overview mode
  const [overviewMode, setOverviewMode] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  // Refs cho input fields để xử lý Enter navigation
  const pointsInputRefs = useRef({});
  const coinsInputRefs = useRef({});
  const studyPointsInputRefs = useRef({});

  // Color selection state - lưu theo studentUid
  const [studentColors, setStudentColors] = useState({}); // {studentUid: 'black' | 'blue' | 'green' | 'red'}

  // Ripple Effect State
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
    }
  }, [selectedClassId]);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSortMenu && !event.target.closest('.relative')) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  // Hàm sắp xếp lớp theo ABC (6A, 6B, 7A, 7B,...)
  const sortClassesAlphabetically = (classList) => {
    return [...classList].sort((a, b) => {
      const extractParts = (name) => {
        const match = name.match(/^(\d+)([A-Za-z])/);
        if (match) {
          return { grade: parseInt(match[1], 10), letter: match[2].toUpperCase() };
        }
        return { grade: 999, letter: name };
      };

      const partA = extractParts(a.name);
      const partB = extractParts(b.name);

      if (partA.grade !== partB.grade) {
        return partA.grade - partB.grade;
      }
      return partA.letter.localeCompare(partB.letter, 'vi');
    });
  };

  const fetchClasses = async () => {
    const result = await getAllClasses();
    if (result.success) {
      setClasses(sortClassesAlphabetically(result.classes));
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const result = await getClassStudents(selectedClassId);
    if (result.success) {
      setStudents(result.students);
      // Load màu từ dữ liệu học sinh
      const colors = {};
      result.students.forEach(student => {
        if (student.labelColor) {
          colors[student.uid] = student.labelColor;
        }
      });
      setStudentColors(colors);
    }
    setLoading(false);

    // Load leaderboards sau khi đã hiển thị students (không block UI)
    if (result.success) {
      loadLeaderboards();
    }
  };

  const loadLeaderboards = async () => {
    try {
      // Lấy khối của lớp hiện tại
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass || !selectedClass.grade) {
        return;
      }

      const grade = parseInt(selectedClass.grade);

      // Load cả 2 leaderboards song song để tăng tốc
      const [gradeResult, centerResult] = await Promise.all([
        getGradeLeaderboard(grade),
        getCenterLeaderboard()
      ]);

      if (gradeResult.success) {
        setGradeLeaderboard(gradeResult);
      }
      if (centerResult.success) {
        setCenterLeaderboard(centerResult);
      }
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    }
  };

  const getStudentRank = (studentUid, leaderboardData) => {
    if (!leaderboardData) return '-';
    // Handle both array and object with leaderboard property
    const leaderboard = Array.isArray(leaderboardData)
      ? leaderboardData
      : leaderboardData.leaderboard;
    if (!leaderboard || !Array.isArray(leaderboard)) return '-';
    const student = leaderboard.find(s => s.uid === studentUid);
    return student ? student.rank : '-';
  };

  const getTodayDate = () => {
    const today = new Date();
    return `${today.getDate()} -${today.getMonth() + 1} `;
  };

  const getTopStudents = () => {
    return [...students]
      .sort((a, b) => (b.totalBehaviorPoints || 0) - (a.totalBehaviorPoints || 0))
      .slice(0, 10);
  };

  // Get last name from full name (chữ cái cuối cùng của tên)
  const getLastName = (fullName) => {
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1];
  };

  // Get sorted students based on current sort option
  const getSortedStudents = () => {
    const studentsCopy = [...students];

    switch (sortBy) {
      case 'name':
        return studentsCopy.sort((a, b) => {
          const lastNameA = getLastName(a.fullName);
          const lastNameB = getLastName(b.fullName);
          return lastNameA.localeCompare(lastNameB, 'vi');
        });
      case 'points':
        return studentsCopy.sort((a, b) => (b.totalBehaviorPoints || 0) - (a.totalBehaviorPoints || 0));
      case 'coins':
        return studentsCopy.sort((a, b) => (b.coins || 0) - (a.coins || 0));
      default:
        return studentsCopy;
    }
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    setShowSortMenu(false);
  };

  // Xử lý Enter/ArrowDown/ArrowUp để chuyển lên/xuống ô Điểm
  const handlePointsKeyDown = (e, studentUid) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const nextStudent = sortedStudents[currentIndex + 1];
      if (nextStudent && pointsInputRefs.current[nextStudent.uid]) {
        pointsInputRefs.current[nextStudent.uid].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const prevStudent = sortedStudents[currentIndex - 1];
      if (prevStudent && pointsInputRefs.current[prevStudent.uid]) {
        pointsInputRefs.current[prevStudent.uid].focus();
      }
    }
  };

  // Xử lý Enter/ArrowDown/ArrowUp để chuyển lên/xuống ô Xu
  const handleCoinsKeyDown = (e, studentUid) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const nextStudent = sortedStudents[currentIndex + 1];
      if (nextStudent && coinsInputRefs.current[nextStudent.uid]) {
        coinsInputRefs.current[nextStudent.uid].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const prevStudent = sortedStudents[currentIndex - 1];
      if (prevStudent && coinsInputRefs.current[prevStudent.uid]) {
        coinsInputRefs.current[prevStudent.uid].focus();
      }
    }
  };

  const handlePointsChange = (studentUid, value) => {
    setPointsInputs(prev => ({
      ...prev,
      [studentUid]: value
    }));

    // Auto-ghi đè ô Xu bằng 50% điểm
    const pointsValue = parseInt(value) || 0;
    const autoCoins = Math.floor(pointsValue * 0.5);
    setCoinsInputs(prev => ({
      ...prev,
      [studentUid]: autoCoins > 0 ? String(autoCoins) : ''
    }));
  };

  const handleCoinsChange = (studentUid, value) => {
    setCoinsInputs(prev => ({
      ...prev,
      [studentUid]: value
    }));
  };

  const handleStudyPointsChange = (studentUid, value) => {
    // Cho phép nhập "Vắng", "V", "v" hoặc số
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'vắng' || normalizedValue === 'v') {
      setStudyPointsInputs(prev => ({
        ...prev,
        [studentUid]: 'Vắng'
      }));
    } else {
      setStudyPointsInputs(prev => ({
        ...prev,
        [studentUid]: value
      }));
    }
  };

  const handleColorChange = async (studentUid, color) => {
    const newColor = studentColors[studentUid] === color ? null : color; // Toggle: bỏ chọn nếu đã chọn

    // Cập nhật UI ngay lập tức
    setStudentColors(prev => ({
      ...prev,
      [studentUid]: newColor
    }));

    // Lưu vào Firebase
    const result = await updateStudentLabelColor(studentUid, newColor);
    if (!result.success) {
      // Rollback nếu lỗi
      setStudentColors(prev => ({
        ...prev,
        [studentUid]: studentColors[studentUid]
      }));
      setToast({ message: 'Lỗi khi lưu màu', type: 'error' });
    }
  };

  // Lấy class màu cho tên học sinh
  const getNameColorClass = (studentUid) => {
    const color = studentColors[studentUid];
    switch (color) {
      case 'black':
        return 'text-gray-900 dark:text-gray-100';
      case 'blue':
        return 'text-blue-600 dark:text-blue-400';
      case 'green':
        return 'text-green-600 dark:text-green-400';
      case 'red':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-[#111812] dark:text-white';
    }
  };

  // Xử lý Enter/ArrowDown/ArrowUp để chuyển lên/xuống ô Điểm học tập
  const handleStudyPointsKeyDown = (e, studentUid) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const nextStudent = sortedStudents[currentIndex + 1];
      if (nextStudent && studyPointsInputRefs.current[nextStudent.uid]) {
        studyPointsInputRefs.current[nextStudent.uid].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const prevStudent = sortedStudents[currentIndex - 1];
      if (prevStudent && studyPointsInputRefs.current[prevStudent.uid]) {
        studyPointsInputRefs.current[prevStudent.uid].focus();
      }
    }
  };

  const handleSaveSession = async () => {
    if (!selectedClassId) {
      setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      // Chuẩn bị data từ inline inputs
      const behaviorPoints = {};
      const coins = {};
      const studyPoints = {};

      Object.keys(pointsInputs).forEach(studentUid => {
        const value = parseInt(pointsInputs[studentUid]);
        if (!isNaN(value) && value !== 0) {
          behaviorPoints[studentUid] = { points: value, reason: '' };
        }
      });

      Object.keys(coinsInputs).forEach(studentUid => {
        const value = parseInt(coinsInputs[studentUid]);
        if (!isNaN(value) && value !== 0) {
          coins[studentUid] = { coins: value, reason: '' };
        }
      });

      Object.keys(studyPointsInputs).forEach(studentUid => {
        const inputValue = studyPointsInputs[studentUid];

        // Kiểm tra nếu là "Vắng"
        if (inputValue === 'Vắng') {
          studyPoints[studentUid] = { points: 'Vắng' };
        } else {
          const value = parseFloat(inputValue);
          if (!isNaN(value) && value !== 0) {
            // Làm tròn đến 1 chữ số sau dấu phẩy
            studyPoints[studentUid] = { points: Math.round(value * 10) / 10 };
          }
        }
      });

      // Save session
      const today = new Date().toISOString().split('T')[0];
      const result = await saveSession(
        selectedClassId,
        today,
        null,
        null,
        behaviorPoints,
        coins,
        null,
        studyPoints
      );

      if (result.success) {
        setToast({ message: 'Đã cập nhật điểm tích lũy, xu và điểm học tập thành công!', type: 'success' });
        // Reset inputs
        setPointsInputs({});
        setCoinsInputs({});
        setStudyPointsInputs({});
        fetchStudents(); // Reload để cập nhật điểm
      } else {
        setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error saving session:', error);
      setToast({ message: 'Lỗi khi lưu điểm', type: 'error' });
    }

    setSaving(false);
  };

  const handleResetStudyPoints = async () => {
    if (!selectedClassId) {
      setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
      return;
    }

    const selectedClass = classes.find((c) => c.id === selectedClassId);
    if (!confirm(`Reset điểm học tập cho tất cả học sinh lớp ${selectedClass?.name} về 0 ? `)) {
      return;
    }

    setResettingStudy(true);

    try {
      // Backup current study points before resetting
      const backup = students.map(s => ({
        uid: s.uid,
        studyPoints: s.studyPoints
      }));

      const studentUids = students.map(s => s.uid);
      const result = await resetStudyPoints(studentUids);

      if (result.success) {
        // Save backup for undo
        setResetBackup({ type: 'study', data: backup });
        setToast({
          message: result.message,
          type: 'success',
          showUndo: true,
          onUndo: handleUndoResetStudy
        });
        setStudyPointsInputs({});
        fetchStudents();
      } else {
        setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error resetting study points:', error);
      setToast({ message: 'Lỗi khi reset điểm học tập', type: 'error' });
    }

    setResettingStudy(false);
  };

  const handleReset = async () => {
    if (!selectedClassId) {
      setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
      return;
    }

    const selectedClass = classes.find((c) => c.id === selectedClassId);
    if (!confirm(`Reset điểm / xu cho tất cả học sinh lớp ${selectedClass?.name}?\n\nĐiểm tích lũy: ${resetValues.points} \nXu: ${resetValues.coins} `)) {
      return;
    }

    setResetting(true);

    // Backup current points and coins before resetting
    const backup = students.map(s => ({
      uid: s.uid,
      totalBehaviorPoints: s.totalBehaviorPoints,
      coins: s.coins
    }));

    const result = await resetClassPointsAndCoins(
      selectedClassId,
      parseInt(resetValues.points) || 0,
      parseInt(resetValues.coins) || 0
    );

    setResetting(false);

    if (result.success) {
      // Save backup for undo
      setResetBackup({ type: 'points', data: backup });
      setToast({
        message: result.message,
        type: 'success',
        showUndo: true,
        onUndo: handleUndoResetPoints
      });
      setShowResetModal(false);
      setResetValues({ points: 0, coins: 0 });
      fetchStudents(); // Reload students
    } else {
      setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
    }
  };

  // Undo reset points/coins
  const handleUndoResetPoints = async () => {
    // Prevent double execution
    if (undoing) {
      return;
    }

    if (!resetBackup || resetBackup.type !== 'points') {
      setToast({ message: 'Không có dữ liệu để hoàn tác', type: 'error' });
      return;
    }

    // Store backup in local variable to prevent race condition
    const backupData = resetBackup.data;

    setUndoing(true);
    setToast({ message: 'Đang hoàn tác...', type: 'info' });

    try {
      // Restore each student's points and coins
      const updatePromises = backupData.map(student => {
        const userRef = doc(db, 'users', student.uid);
        return updateDoc(userRef, {
          totalBehaviorPoints: student.totalBehaviorPoints,
          coins: student.coins
        });
      });

      await Promise.all(updatePromises);

      // Reload students first
      await fetchStudents();

      // Clear backup only after successful completion
      setResetBackup(null);
      setToast({ message: 'Đã hoàn tác reset điểm/xu thành công!', type: 'success' });
    } catch (error) {
      console.error('Error undoing reset:', error);
      setToast({ message: 'Lỗi khi hoàn tác: ' + error.message, type: 'error' });
    } finally {
      setUndoing(false);
    }
  };

  // Undo reset study points
  const handleUndoResetStudy = async () => {
    // Prevent double execution
    if (undoing) {
      return;
    }

    if (!resetBackup || resetBackup.type !== 'study') {
      setToast({ message: 'Không có dữ liệu để hoàn tác', type: 'error' });
      return;
    }

    // Store backup in local variable to prevent race condition
    const backupData = resetBackup.data;

    setUndoing(true);
    setToast({ message: 'Đang hoàn tác...', type: 'info' });

    try {
      // Restore each student's study points
      const updatePromises = backupData.map(student => {
        const userRef = doc(db, 'users', student.uid);
        return updateDoc(userRef, {
          studyPoints: student.studyPoints
        });
      });

      await Promise.all(updatePromises);

      // Reload students first
      await fetchStudents();

      // Clear backup only after successful completion
      setResetBackup(null);
      setToast({ message: 'Đã hoàn tác reset điểm học tập thành công!', type: 'success' });
    } catch (error) {
      console.error('Error undoing reset:', error);
      setToast({ message: 'Lỗi khi hoàn tác: ' + error.message, type: 'error' });
    } finally {
      setUndoing(false);
    }
  };

  // Hàm tạo hiệu ứng vết loang khi click
  const createRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = {
      x,
      y,
      id: Date.now()
    };

    setRipples(prev => [...prev, newRipple]);

    // Xóa ripple sau 1000ms (1 giây) - Chỉnh số này bằng thời lượng GIF của bạn
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-4 p-6 max-w-[1600px] mx-auto">
      {/* Inject CSS Animation cho Ripple */}
      <style>
        {`
@keyframes ripple - effect {
  0 % {
    transform: translate(-50 %, -50 %) scale(0);
              opacity: 0.8;
  }
  100 % {
    transform: translate(-50 %, -50 %) scale(4);
              opacity: 0;
  }
}
          .animate - ripple {
  animation: ripple - effect 0.6s linear;
}
`}
      </style>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          showUndo={toast.showUndo}
          onUndo={toast.onUndo}
        />
      )}

      {/* Class Selection */}
      <div className="clay-card p-4">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
        >
          <option value="">-- Chọn lớp --</option>
          {classes.map((classItem) => (
            <option key={classItem.id} value={classItem.id}>
              {classItem.name} ({classItem.studentCount} học sinh)
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
        </div>
      )}

      {!loading && selectedClassId && students.length > 0 && (
        <div className={`${overviewMode ? '' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'} `}>
          {/* Left Panel - Student Cards */}
          <div className={`${overviewMode ? '' : 'lg:col-span-8'} space - y - 4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              {/* Checkbox Chế độ xem tổng quan */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overviewMode}
                  onChange={(e) => setOverviewMode(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-[#d0e5d4] dark:border-white/20 accent-primary"
                />
                <span className="text-sm font-medium text-[#111812] dark:text-white">
                  Chế độ xem tổng quan
                </span>
              </label>

              <div className="flex gap-2">
                {/* Sort Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="px-4 py-2 rounded-lg border border-[#d0e5d4] dark:border-white/20 text-[#111812] dark:text-white text-sm font-medium hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <Icon name="sort" className="text-lg" />
                    Sắp xếp
                  </button>

                  {/* Dropdown Menu */}
                  {showSortMenu && (
                    <div className="absolute top-full left-0 mt-2 w-56 clay-card py-2 z-10 shadow-lg">
                      <button
                        onClick={() => handleSortChange('name')}
                        className={`w - full px - 4 py - 2 text - left text - sm hover: bg - [#f0f5f1] dark: hover: bg - white / 10 transition - all flex items - center gap - 2 ${sortBy === 'name' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                          } `}
                      >
                        <Icon name="sort_by_alpha" className="text-lg" />
                        <span className="text-[#111812] dark:text-white">Theo tên (A-Z)</span>
                      </button>
                      <button
                        onClick={() => handleSortChange('points')}
                        className={`w - full px - 4 py - 2 text - left text - sm hover: bg - [#f0f5f1] dark: hover: bg - white / 10 transition - all flex items - center gap - 2 ${sortBy === 'points' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                          } `}
                      >
                        <Icon name="star" className="text-lg text-green-600" />
                        <span className="text-[#111812] dark:text-white">Theo điểm tích lũy</span>
                      </button>
                      <button
                        onClick={() => handleSortChange('coins')}
                        className={`w - full px - 4 py - 2 text - left text - sm hover: bg - [#f0f5f1] dark: hover: bg - white / 10 transition - all flex items - center gap - 2 ${sortBy === 'coins' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                          } `}
                      >
                        <Icon name="paid" className="text-lg text-yellow-600" />
                        <span className="text-[#111812] dark:text-white">Theo xu</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Reset Button */}
                <button
                  onClick={() => setShowResetModal(true)}
                  className="px-4 py-2 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all flex items-center gap-2"
                >
                  <Icon name="restart_alt" className="text-lg" />
                  Reset điểm/xu
                </button>

                {/* Reset Study Points Button */}
                <button
                  onClick={handleResetStudyPoints}
                  disabled={resettingStudy}
                  className="px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingStudy ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <span>Đang reset...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="school" className="text-lg" />
                      <span>Reset học tập</span>
                    </>
                  )}
                </button>

                {/* Save Button */}
                <button
                  onClick={handleSaveSession}
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-primary text-[#052e16] text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#052e16] border-t-transparent"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span>Lưu</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Student Cards */}
            {overviewMode ? (
              /* Chế độ xem tổng quan - 4 cột (từ trên xuống, hết cột trái sang cột phải) */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-max">
                {getSortedStudents().map((student, index) => (
                  <div key={student.uid} className="clay-card p-2 flex items-center gap-2 min-w-0">
                    <span className="text-[#608a67] dark:text-[#8ba890] font-bold text-xs w-5 flex-shrink-0">
                      {index + 1}.
                    </span>
                    {/* Avatar nhỏ */}
                    <div className="w-15 h-15 flex-shrink-0">
                      <Avatar
                        src={student.avatar}
                        name={student.fullName}
                        size="sm"
                        borderUrl={student.activeAvatarBorder}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#111812] dark:text-white text-xs break-words">
                        {student.fullName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[14px]">
                        <span className="text-fuchsia-800 dark:text-fuchsia-500 font-bold">
                          {student.studyPoints === 'Vắng' || typeof student.studyPoints !== 'number' || student.studyPoints === 0 ? 'Vắng' : student.studyPoints.toFixed(1) + ' điểm'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Chế độ bình thường */
              <div className="space-y-3">
                {getSortedStudents().map((student, index) => (
                  <div
                    key={student.uid}
                    className="clay-card p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Color Radio Buttons - 2 cột, dạng 3D - Giảm kích cỡ 1/2 */}
                      <div className="flex-shrink-0 grid grid-cols-2 gap-1.5 mr-2">
                        <button
                          type="button"
                          onClick={() => handleColorChange(student.uid, 'black')}
                          className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'black'
                            ? 'bg-gray-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]'
                            : 'bg-gradient-to-b from-gray-700 to-gray-900 shadow-[0_1.5px_0_#374151,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#374151,0_1px_1px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-none'
                            }`}
                          title="Đen"
                        />
                        <button
                          type="button"
                          onClick={() => handleColorChange(student.uid, 'blue')}
                          className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'blue'
                            ? 'bg-blue-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]'
                            : 'bg-gradient-to-b from-blue-500 to-blue-700 shadow-[0_1.5px_0_#1d4ed8,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#1d4ed8,0_1px_1px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-none'
                            }`}
                          title="Xanh lam"
                        />
                        <button
                          type="button"
                          onClick={() => handleColorChange(student.uid, 'green')}
                          className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'green'
                            ? 'bg-green-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]'
                            : 'bg-gradient-to-b from-green-500 to-green-700 shadow-[0_1.5px_0_#15803d,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#15803d,0_1px_1px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-none'
                            }`}
                          title="Xanh lá"
                        />
                        <button
                          type="button"
                          onClick={() => handleColorChange(student.uid, 'red')}
                          className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'red'
                            ? 'bg-red-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]'
                            : 'bg-gradient-to-b from-red-500 to-red-700 shadow-[0_1.5px_0_#b91c1c,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#b91c1c,0_1px_1px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-none'
                            }`}
                          title="Đỏ"
                        />
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <Avatar
                          src={student.avatar}
                          name={student.fullName}
                          size="lg"
                          borderUrl={student.activeAvatarBorder}
                          border={true}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-xl font-black truncate ${getNameColorClass(student.uid)}`}>
                          <span className="text-[#608a67] dark:text-[#8ba890] mr-2">{index + 1}.</span>
                          {student.fullName}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-base">
                          <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(220, 38, 38, 0.5)' }}>
                            <Icon name="emoji_events" className="text-sm" />
                            {getStudentRank(student.uid, gradeLeaderboard)}/{getStudentRank(student.uid, centerLeaderboard)}
                          </span>
                          <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(202, 138, 4, 0.5)' }}>
                            <Icon name="paid" className="text-sm" />
                            <span>{student.coins || 0}<span className="text-amber-500 dark:text-amber-400">/{student.gold || 0}</span></span>
                          </span>
                          <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(22, 163, 74, 0.5)' }}>
                            <Icon name="star" className="text-sm" />
                            {student.totalBehaviorPoints || 0}
                          </span>
                          <span className="text-fuchsia-800 dark:text-fuchsia-500 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(37, 99, 235, 0.5)' }}>
                            {/* scale-75 sẽ thu nhỏ icon lại còn 75% kích thước gốc */}
                            <div className="transform scale-75 origin-center flex items-center">
                              <Icon name="bolt" />
                            </div>
                            {student.studyPoints === 'Vắng' || typeof student.studyPoints !== 'number' || student.studyPoints === 0 ? 'Vắng' : student.studyPoints.toFixed(1) + ' điểm'}
                          </span>
                        </div>
                      </div>

                      {/* Input fields */}
                      <div className="flex gap-2">
                        <input
                          ref={(el) => pointsInputRefs.current[student.uid] = el}
                          type="number"
                          placeholder="Điểm"
                          value={pointsInputs[student.uid] || ''}
                          onChange={(e) => handlePointsChange(student.uid, e.target.value)}
                          onKeyDown={(e) => handlePointsKeyDown(e, student.uid)}
                          className="w-22 px-3 py-2 rounded-lg border-2 border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <input
                          ref={(el) => coinsInputRefs.current[student.uid] = el}
                          type="number"
                          placeholder="Xu"
                          value={coinsInputs[student.uid] || ''}
                          onChange={(e) => handleCoinsChange(student.uid, e.target.value)}
                          onKeyDown={(e) => handleCoinsKeyDown(e, student.uid)}
                          className="w-18 px-3 py-2 rounded-lg border-2 border-yellow-300 dark:border-yellow-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                        <input
                          ref={(el) => studyPointsInputRefs.current[student.uid] = el}
                          type="text"
                          placeholder="Học tập"
                          value={studyPointsInputs[student.uid] || ''}
                          onChange={(e) => handleStudyPointsChange(student.uid, e.target.value)}
                          onKeyDown={(e) => handleStudyPointsKeyDown(e, student.uid)}
                          className="w-22 px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Leaderboard - Ẩn khi ở chế độ xem tổng quan */}
          {!overviewMode && (
            <div className="lg:col-span-4">
              <div
                onClick={createRipple}
                className="clay-card p-6 sticky top-6 relative overflow-hidden"
                style={{
                  background: `url(${rankBgImg}) center top / 200% auto no-repeat, linear-gradient(to bottom, transparent 0%, transparent 40%, #020702 40%, #020702 100%)`
                }}
              >
                {/* --- ĐOẠN MỚI: Render ảnh GIF --- */}
                {
                  ripples.map(ripple => (
                    <img
                      key={ripple.id}
                      src={rippleGif}
                      className="absolute pointer-events-none z-20 select-none"
                      style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: '300px',  // Tùy chỉnh độ to của vết loang tại đây
                        height: '300px', // Nên để hình vuông
                        transform: 'translate(-50%, -50%)', // Căn giữa tâm điểm click
                      }}
                      alt=""
                    />
                  ))
                }
                {/* -------------------------------- */}

                {/* ĐÃ SỬA: Đổi text-[#111812] thành text-white */}
                <h2
                  className="
    relative z-10 text-xl font-bold text-center
    text-lime-300 mb-6 pointer-events-none
    animate-neon-green
  "
                  style={{
                    textShadow: `
      -2px -1px 0 #4ade80,
       2px -1px 0 #4ade80,
      -1px  1px 0 #4ade80,
       1px  1px 0 #4ade80
    `
                  }}
                >

                  TOP XẾP HẠNG LỚP
                  <style jsx>{`
    @keyframes neonGreen {
      0%, 100% {
        filter:
          drop-shadow(0 0 6px rgba(132,204,22,1))
          drop-shadow(0 0 18px rgba(163,230,53,0.95))
          drop-shadow(0 0 36px rgba(34,197,94,0.85));
      }
      50% {
        filter:
          drop-shadow(0 0 12px rgba(132,204,22,1))
          drop-shadow(0 0 30px rgba(163,230,53,1))
          drop-shadow(0 0 54px rgba(34,197,94,0.95));
      }
    }

    .animate-neon-green {
      animation: neonGreen 1.6s ease-in-out infinite;
    }
  `}</style>
                </h2>



                {/* Top 5 Visual */}
                <div className="mb-8 relative z-10">
                  {/* Top 3 Row */}
                  <div className="flex justify-center items-end gap-2 mb-4">
                    {/* Rank 2 */}
                    {getTopStudents()[1] && (
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <TopRankBorder rank={2}>
                            <Avatar
                              src={getTopStudents()[1].avatar}
                              name={getTopStudents()[1].fullName}
                              size="lg"
                            />
                          </TopRankBorder>
                          {/* Vòng tròn số thứ hạng Top 2
                            - Kích thước vòng: w-6 h-6 (24px x 24px)
                            - Kích thước chữ: text-[10px] hoặc text-xs (12px)
                            - Màu nền: bg-gray-700 (xám đậm)
                            - Viền: border-2 border-white (viền trắng 2px)
                            - Có thể thay đổi: w-5 h-5 để nhỏ hơn, text-[8px] để chữ nhỏ hơn
                        */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-green-700 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">
                            2
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rank 1 */}
                    {getTopStudents()[0] && (
                      <div className="flex flex-col items-center -mt-4">
                        <div className="relative">
                          <TopRankBorder rank={1}>
                            <Avatar
                              src={getTopStudents()[0].avatar}
                              name={getTopStudents()[0].fullName}
                              size="xl"
                            />
                          </TopRankBorder>
                          {/* Vòng tròn số thứ hạng Top 1 (Vàng nổi bật)
                            - Kích thước vòng: w-7 h-7 (28px x 28px) - lớn hơn top khác
                            - Kích thước chữ: text-[11px]
                            - Màu nền: bg-yellow-600 (vàng đậm)
                            - Viền: border-2 border-white (viền trắng 2px)
                        */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-[14px] shadow-lg border-2 border-white z-20">
                            1
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rank 3 */}
                    {getTopStudents()[2] && (
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <TopRankBorder rank={3}>
                            <Avatar
                              src={getTopStudents()[2].avatar}
                              name={getTopStudents()[2].fullName}
                              size="lg"
                            />
                          </TopRankBorder>
                          {/* Vòng tròn số thứ hạng Top 3
                            - Kích thước vòng: w-6 h-6 (24px x 24px)
                            - Kích thước chữ: text-[10px]
                            - Màu nền: bg-orange-600 (cam đậm)
                            - Viền: border-2 border-white
                        */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">
                            3
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top 4-5 Row */}
                  <div className="flex justify-center items-center gap-4">
                    {getTopStudents()[3] && (
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <TopRankBorder rank={4}>
                            <Avatar
                              src={getTopStudents()[3].avatar}
                              name={getTopStudents()[3].fullName}
                              size="md"
                            />
                          </TopRankBorder>
                          {/* Vòng tròn số thứ hạng Top 4-5
                              - Kích thước vòng: w-5 h-5 (20px x 20px)
                              - Kích thước chữ: text-[9px]
                              - Màu nền: bg-gray-700 (xám đậm)
                              - Viền: border-2 border-white
                          */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">
                            4
                          </div>
                        </div>
                      </div>
                    )}

                    {getTopStudents()[4] && (
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <TopRankBorder rank={5}>
                            <Avatar
                              src={getTopStudents()[4].avatar}
                              name={getTopStudents()[4].fullName}
                              size="md"
                            />
                          </TopRankBorder>
                          {/* Vòng tròn số thứ hạng Top 5 (giống Top 4) */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[9px] shadow-lg border-2 border-white z-20">
                            5
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top 6-10 Row */}
                  <div className="flex justify-center items-center gap-3 mt-4">
                    {[5, 6, 7, 8, 9].map((index) => {
                      const student = getTopStudents()[index];
                      if (!student) return null;
                      const rank = index + 1;
                      return (
                        <div key={student.uid} className="flex flex-col items-center">
                          <div className="relative">
                            <TopRankBorder rank={rank}>
                              <Avatar
                                src={student.avatar}
                                name={student.fullName}
                                size="sm"
                              />
                            </TopRankBorder>
                            {/* Vòng tròn số thứ hạng Top 6-10
                              - Kích thước vòng: w-5 h-5 (20px x 20px)
                              - Kích thước chữ: text-[8px]
                              - Màu nền: bg-gray-700 (xám đậm)
                              - Viền: border-2 border-white
                              - Ghi chú: Có thể đổi w-4 h-4 để nhỏ hơn nữa nếu cần
                          */}
                            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">
                              {rank}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ranked List */}
                <div className="space-y-2 relative z-10">
                  {getTopStudents().map((student, index) => (
                    <div
                      key={student.uid}
                      className={`flex items-center gap-3 p-3 rounded-xl ${index === 0
                        ? 'bg-cyan-100 dark:bg-cyan-900/40'
                        : index === 1
                          ? 'bg-sky-100 dark:bg-sky-900/40'
                          : index === 2
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : index === 3
                              ? 'bg-stone-100 dark:bg-stone-800/40'
                              : index === 4
                                ? 'bg-neutral-100 dark:bg-neutral-800/40'
                                : index === 5
                                  ? 'bg-gray-100 dark:bg-gray-800/40'
                                  : index === 6
                                    ? 'bg-slate-100 dark:bg-slate-800/40'
                                    : index === 7
                                      ? 'bg-zinc-100 dark:bg-zinc-800/40'
                                      : index === 8
                                        ? 'bg-stone-50 dark:bg-stone-800/30'
                                        : 'bg-gray-50 dark:bg-gray-800/30'
                        }`}
                    >
                      <span className="text-2xl font-bold text-gray-900 dark:text-white w-8">
                        {index + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-900 dark:text-white truncate">
                        {student.fullName.split(' ').slice(-2).join(' ')}
                      </span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {student.totalBehaviorPoints || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div >
            </div >
          )}
        </div >
      )}

      {
        !loading && selectedClassId && students.length === 0 && (
          <div className="clay-card p-12 text-center">
            <Icon name="person_off" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Lớp này chưa có học sinh
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Vui lòng thêm học sinh vào lớp trước
            </p>
          </div>
        )
      }

      {/* Reset Modal */}
      {
        showResetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="clay-card max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#111812] dark:text-white">
                  Reset điểm/xu cho lớp
                </h2>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  disabled={resetting}
                >
                  <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                  Nhập giá trị mới cho điểm tích lũy và xu. Tất cả học sinh trong lớp sẽ được reset về giá trị này.
                </p>

                {/* Points Input */}
                <div>
                  <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                    Điểm tích lũy
                  </label>
                  <input
                    type="number"
                    value={resetValues.points}
                    onChange={(e) => setResetValues({ ...resetValues, points: e.target.value })}
                    className="clay-input w-full px-4 py-3 rounded-xl"
                    placeholder="Nhập điểm tích lũy..."
                    disabled={resetting}
                  />
                </div>

                {/* Coins Input */}
                <div>
                  <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                    Xu
                  </label>
                  <input
                    type="number"
                    value={resetValues.coins}
                    onChange={(e) => setResetValues({ ...resetValues, coins: e.target.value })}
                    className="clay-input w-full px-4 py-3 rounded-xl"
                    placeholder="Nhập số xu..."
                    disabled={resetting}
                  />
                </div>

                {/* Warning */}
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-xl">
                  <p className="text-orange-600 dark:text-orange-400 text-sm flex items-center gap-2">
                    <Icon name="warning" className="text-lg" />
                    <span>Hành động này sẽ reset điểm/xu của TẤT CẢ học sinh trong lớp!</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowResetModal(false)}
                    disabled={resetting}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resetting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Đang reset...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="restart_alt" />
                        <span>Reset ngay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Teaching;