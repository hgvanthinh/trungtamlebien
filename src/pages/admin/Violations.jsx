import { useState, useEffect, useRef } from 'react';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { getAllClasses, getClassStudents, saveViolations, resetViolations } from '../../services/classService';

const Violations = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline input states - lưu theo studentUid
  const [violationInputs, setViolationInputs] = useState({}); // {studentUid: value}
  const [paymentInputs, setPaymentInputs] = useState({}); // {studentUid: value}

  // Sort states
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState('debt'); // 'name', 'debt', 'total'

  // Overview mode
  const [overviewMode, setOverviewMode] = useState(false);

  // Reset state
  const [resetting, setResetting] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  // Tổng cả lớp (tổng tiền nộp phạt trong session)
  const [classTotalPayment, setClassTotalPayment] = useState(0);

  // Refs cho input fields để xử lý Enter navigation
  const violationInputRefs = useRef({});
  const paymentInputRefs = useRef({});

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
    }
    setLoading(false);
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
      case 'debt':
        return studentsCopy.sort((a, b) => (b.penaltyDebt || 0) - (a.penaltyDebt || 0));
      case 'total':
        return studentsCopy.sort((a, b) => (b.totalViolationAmount || 0) - (a.totalViolationAmount || 0));
      default:
        return studentsCopy;
    }
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    setShowSortMenu(false);
  };

  // Xử lý Enter/ArrowDown/ArrowUp để chuyển lên/xuống ô Vi phạm
  const handleViolationKeyDown = (e, studentUid) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const nextStudent = sortedStudents[currentIndex + 1];
      if (nextStudent && violationInputRefs.current[nextStudent.uid]) {
        violationInputRefs.current[nextStudent.uid].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const prevStudent = sortedStudents[currentIndex - 1];
      if (prevStudent && violationInputRefs.current[prevStudent.uid]) {
        violationInputRefs.current[prevStudent.uid].focus();
      }
    }
  };

  // Xử lý Enter/ArrowDown/ArrowUp để chuyển lên/xuống ô Nộp phạt
  const handlePaymentKeyDown = (e, studentUid) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const nextStudent = sortedStudents[currentIndex + 1];
      if (nextStudent && paymentInputRefs.current[nextStudent.uid]) {
        paymentInputRefs.current[nextStudent.uid].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedStudents = getSortedStudents();
      const currentIndex = sortedStudents.findIndex(s => s.uid === studentUid);
      const prevStudent = sortedStudents[currentIndex - 1];
      if (prevStudent && paymentInputRefs.current[prevStudent.uid]) {
        paymentInputRefs.current[prevStudent.uid].focus();
      }
    }
  };

  const handleViolationChange = (studentUid, value) => {
    setViolationInputs(prev => ({
      ...prev,
      [studentUid]: value
    }));
  };

  const handlePaymentChange = (studentUid, value) => {
    const oldValue = parseInt(paymentInputs[studentUid]) || 0;
    const newValue = parseInt(value) || 0;

    // Cập nhật tổng cả lớp: trừ giá trị cũ, cộng giá trị mới
    setClassTotalPayment(prev => prev - oldValue + newValue);

    setPaymentInputs(prev => ({
      ...prev,
      [studentUid]: value
    }));
  };

  const handleUseClassTotal = () => {
    setClassTotalPayment(0);
    setToast({ message: 'Đã sử dụng tổng tiền cả lớp', type: 'success' });
  };

  const handleSave = async () => {
    if (!selectedClassId) {
      setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      // Chuẩn bị data từ inline inputs
      const violations = {};
      const payments = {};

      Object.keys(violationInputs).forEach(studentUid => {
        const value = parseInt(violationInputs[studentUid]);
        if (!isNaN(value) && value > 0) {
          violations[studentUid] = { amount: value };
        }
      });

      Object.keys(paymentInputs).forEach(studentUid => {
        const value = parseInt(paymentInputs[studentUid]);
        if (!isNaN(value) && value > 0) {
          payments[studentUid] = { amount: value };
        }
      });

      // Save violations
      const result = await saveViolations(violations, payments);

      if (result.success) {
        setToast({ message: 'Đã cập nhật thông tin vi phạm thành công!', type: 'success' });
        // Reset inputs
        setViolationInputs({});
        setPaymentInputs({});
        fetchStudents(); // Reload để cập nhật
      } else {
        setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error saving violations:', error);
      setToast({ message: 'Lỗi khi lưu vi phạm', type: 'error' });
    }

    setSaving(false);
  };

  const handleReset = async () => {
    if (!selectedClassId) {
      setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
      return;
    }

    const selectedClass = classes.find((c) => c.id === selectedClassId);
    if (!confirm(`Bạn có chắc muốn reset TẤT CẢ thông tin vi phạm của lớp ${selectedClass?.name} về 0?\n\nHành động này sẽ đặt Nợ phạt, Đã nộp và Tổng vi phạm của tất cả học sinh về 0.`)) {
      return;
    }

    setResetting(true);

    try {
      const studentUids = students.map(s => s.uid);
      const result = await resetViolations(studentUids);

      if (result.success) {
        setToast({ message: 'Đã reset thông tin vi phạm thành công!', type: 'success' });
        setViolationInputs({});
        setPaymentInputs({});
        setClassTotalPayment(0);
        fetchStudents();
      } else {
        setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error resetting violations:', error);
      setToast({ message: 'Lỗi khi reset vi phạm', type: 'error' });
    }

    setResetting(false);
  };

  return (
    <div className="flex flex-col gap-4 p-6 max-w-[1600px] mx-auto">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
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
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-[#111812] dark:text-white flex items-center gap-2">
                <Icon name="gavel" className="text-red-500" />
                Quản lý vi phạm
              </h2>

              {/* Tổng cả lớp */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50">
                <Icon name="account_balance_wallet" className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-[#111812] dark:text-white">
                  Tổng cả lớp: <span className="font-bold text-blue-600 dark:text-blue-400">{classTotalPayment}k</span>
                </span>
                <button
                  onClick={handleUseClassTotal}
                  disabled={classTotalPayment === 0}
                  className="ml-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sử dụng
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Overview Mode Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overviewMode}
                  onChange={(e) => setOverviewMode(e.target.checked)}
                  className="w-4 h-4 rounded border-[#d0e5d4] dark:border-white/20 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-[#111812] dark:text-white">Chế độ xem tổng quan</span>
              </label>

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
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-all flex items-center gap-2 ${sortBy === 'name' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                        }`}
                    >
                      <Icon name="sort_by_alpha" className="text-lg" />
                      <span className="text-[#111812] dark:text-white">Theo tên (A-Z)</span>
                    </button>
                    <button
                      onClick={() => handleSortChange('debt')}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-all flex items-center gap-2 ${sortBy === 'debt' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                        }`}
                    >
                      <Icon name="money_off" className="text-lg text-red-600" />
                      <span className="text-[#111812] dark:text-white">Theo nợ phạt</span>
                    </button>
                    <button
                      onClick={() => handleSortChange('total')}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-all flex items-center gap-2 ${sortBy === 'total' ? 'bg-[#f0f5f1] dark:bg-white/10 font-bold' : ''
                        }`}
                    >
                      <Icon name="warning" className="text-lg text-orange-600" />
                      <span className="text-[#111812] dark:text-white">Theo tổng vi phạm</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700/50 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {resetting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                    <span>Đang reset...</span>
                  </>
                ) : (
                  <>
                    <Icon name="restart_alt" className="text-lg" />
                    <span>Reset</span>
                  </>
                )}
              </button>

              {/* Save Button */}
              <button
                onClick={handleSave}
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
            /* Overview Mode - 3 columns layout */
            <div className="columns-3 gap-3" style={{ columnFill: 'balance' }}>
              {getSortedStudents().map((student, index) => (
                <div
                  key={student.uid}
                  className="clay-card p-3 mb-3 break-inside-avoid hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    {/* Compact Avatar */}
                    <div className="flex-shrink-0">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-[#d0e5d4] dark:border-white/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-[#d0e5d4] dark:border-white/20">
                          <Icon name="person" className="text-primary text-sm" />
                        </div>
                      )}
                    </div>

                    {/* Compact Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[#111812] dark:text-white truncate">
                        <span className="text-[#608a67] dark:text-[#8ba890] mr-1">{index + 1}.</span>
                        {student.fullName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          Nợ: {student.penaltyDebt || 0}k
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-bold">
                          Nộp: {student.paidAmount || 0}k
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 font-bold">
                          Tổng: {student.totalViolationAmount || 0}k
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Normal Mode */
            <div className="space-y-3">
              {getSortedStudents().map((student, index) => (
                <div
                  key={student.uid}
                  className="clay-card p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.fullName}
                          className="w-14 h-14 rounded-full object-cover border-2 border-[#d0e5d4] dark:border-white/20"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border-2 border-[#d0e5d4] dark:border-white/20">
                          <Icon name="person" className="text-primary text-xl" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-[#111812] dark:text-white truncate">
                        <span className="text-[#608a67] dark:text-[#8ba890] mr-2">{index + 1}.</span>
                        {student.fullName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                          <Icon name="money_off" className="text-base" />
                          Nợ: {student.penaltyDebt || 0}k
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                          <Icon name="payments" className="text-base" />
                          Nộp: {student.paidAmount || 0}k
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">
                          <Icon name="warning" className="text-base" />
                          Tổng: {student.totalViolationAmount || 0}k
                        </span>
                      </div>
                    </div>

                    {/* Input fields */}
                    <div className="flex gap-2">
                      <input
                        ref={(el) => violationInputRefs.current[student.uid] = el}
                        type="number"
                        placeholder="Vi phạm"
                        value={violationInputs[student.uid] || ''}
                        onChange={(e) => handleViolationChange(student.uid, e.target.value)}
                        onKeyDown={(e) => handleViolationKeyDown(e, student.uid)}
                        className="w-34 px-3 py-2 rounded-lg border-2 border-red-300 dark:border-red-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                      <input
                        ref={(el) => paymentInputRefs.current[student.uid] = el}
                        type="number"
                        placeholder="Nộp phạt"
                        value={paymentInputs[student.uid] || ''}
                        onChange={(e) => handlePaymentChange(student.uid, e.target.value)}
                        onKeyDown={(e) => handlePaymentKeyDown(e, student.uid)}
                        className="w-34 px-3 py-2 rounded-lg border-2 border-green-300 dark:border-green-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && selectedClassId && students.length === 0 && (
        <div className="clay-card p-12 text-center">
          <Icon name="person_off" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
            Lớp này chưa có học sinh
          </h3>
          <p className="text-[#608a67] dark:text-[#8ba890]">
            Vui lòng thêm học sinh vào lớp trước
          </p>
        </div>
      )}
    </div>
  );
};

export default Violations;
