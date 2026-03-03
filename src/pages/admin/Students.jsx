import { useState, useEffect } from 'react';
import { getAllStudents, resetStudentPassword, deleteStudent } from '../../services/adminService';
import { getAllClasses, addStudentToClass, removeStudentFromClass } from '../../services/classService';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import EditStudentModal from '../../components/admin/EditStudentModal';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import CoinIcon from '../../components/common/CoinIcon';
import GoldIcon from '../../components/common/GoldIcon';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [assetsForm, setAssetsForm] = useState({ totalBehaviorPoints: 0, coins: 0, gold: 0 });
  const [isSavingAssets, setIsSavingAssets] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = students;

    // Lọc theo lớp
    if (classFilter === '__unassigned__') {
      filtered = filtered.filter(
        (student) => !student.classes || student.classes.length === 0
      );
    } else if (classFilter) {
      filtered = filtered.filter(
        (student) => student.classes && student.classes.includes(classFilter)
      );
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.fullName.toLowerCase().includes(query) ||
          student.username.toLowerCase().includes(query) ||
          student.email.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  }, [searchQuery, classFilter, students]);

  const loadStudents = async () => {
    const result = await getAllStudents();

    if (result.success) {
      setStudents(result.students);
      setFilteredStudents(result.students);
    } else {
      setToast({ type: 'error', message: result.error });
    }

    return result;
  };

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

  const loadClasses = async () => {
    const result = await getAllClasses();
    if (result.success) {
      setClasses(sortClassesAlphabetically(result.classes));
    }
    return result;
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadStudents(), loadClasses()]);
    setIsLoading(false);
  };

  const handleSelectStudent = (studentUid) => {
    setSelectedStudents((prev) =>
      prev.includes(studentUid)
        ? prev.filter((uid) => uid !== studentUid)
        : [...prev, studentUid]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.uid));
    }
  };

  const handleResetPassword = (student) => {
    setSelectedStudent(student);
    setShowResetModal(true);
  };

  const handleAssignClass = (student) => {
    setSelectedStudent(student);
    setShowAssignModal(true);
  };

  const handleEditName = (student) => {
    setSelectedStudent(student);
    setShowEditNameModal(true);
  };

  const handleEditSuccess = async (msg) => {
    setToast({ type: 'success', message: msg });
    await loadData();
  };

  const handleManageAssets = (student) => {
    setSelectedStudent(student);
    setAssetsForm({
      totalBehaviorPoints: student.totalBehaviorPoints || 0,
      coins: student.coins || 0,
      gold: student.gold || 0,
    });
    setShowAssetsModal(true);
  };

  const handleSaveAssets = async () => {
    if (!selectedStudent) return;
    setIsSavingAssets(true);
    try {
      const userRef = doc(db, 'users', selectedStudent.uid);
      await updateDoc(userRef, {
        totalBehaviorPoints: Number(assetsForm.totalBehaviorPoints) || 0,
        coins: Number(assetsForm.coins) || 0,
        gold: Number(assetsForm.gold) || 0,
      });
      setToast({ type: 'success', message: `Đã cập nhật tài sản cho ${selectedStudent.fullName}!` });
      setShowAssetsModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      console.error('Error updating assets:', error);
      setToast({ type: 'error', message: 'Lỗi khi cập nhật tài sản: ' + error.message });
    }
    setIsSavingAssets(false);
  };

  const confirmResetPassword = async (newPassword) => {
    console.log('🔄 Resetting password for:', selectedStudent.email, 'New password:', newPassword);
    const result = await resetStudentPassword(selectedStudent.email, newPassword);
    console.log('📥 Reset password result:', result);

    if (result.success) {
      setToast({ type: 'success', message: 'Đã reset mật khẩu thành công!' });
      setShowResetModal(false);
      setSelectedStudent(null);
    } else {
      console.error('❌ Reset password failed:', result.error);
      setToast({ type: 'error', message: result.error || 'Lỗi khi reset mật khẩu' });
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!confirm(`Bạn có chắc muốn xóa học sinh ${student.fullName}?`)) return;

    const result = await deleteStudent(student.uid);

    if (result.success) {
      setToast({ type: 'success', message: 'Đã xóa học sinh!' });
      await loadData();
    } else {
      setToast({ type: 'error', message: result.error });
    }
  };

  const handleToggleClass = async (classId, isInClass) => {
    if (!selectedStudent) return;

    setIsAssigning(true);
    let result;
    if (isInClass) {
      result = await removeStudentFromClass(classId, selectedStudent.uid);
    } else {
      result = await addStudentToClass(classId, selectedStudent.uid);
    }
    setIsAssigning(false);

    if (result.success) {
      setToast({
        type: 'success',
        message: isInClass ? 'Đã xóa khỏi lớp' : 'Đã thêm vào lớp',
      });
      // Reload both students and classes to ensure UI updates
      await loadData();
    } else {
      setToast({ type: 'error', message: result.error });
    }
  };

  const handleBulkAssignClass = async (classId) => {
    if (selectedStudents.length === 0) {
      alert('Vui lòng chọn ít nhất 1 học sinh');
      return;
    }

    setIsBulkAssigning(true);
    let successCount = 0;
    let errorCount = 0;

    for (const studentUid of selectedStudents) {
      const result = await addStudentToClass(classId, studentUid);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    setIsBulkAssigning(false);

    setToast({
      type: errorCount === 0 ? 'success' : 'error',
      message: `Đã thêm ${successCount} học sinh vào lớp${errorCount > 0 ? ` (${errorCount} lỗi)` : ''
        }`,
    });

    // Reload both students and classes to ensure UI updates
    await loadData();
    setShowBulkAssignModal(false);
    setSelectedStudents([]);
  };

  const getStudentClasses = (student) => {
    if (!student.classes || student.classes.length === 0) {
      return 'Chưa phân lớp';
    }
    const studentClassNames = student.classes
      .map((classId) => {
        const cls = classes.find((c) => c.id === classId);
        return cls?.name || '';
      })
      .filter((name) => name);

    return studentClassNames.length > 0 ? studentClassNames.join(', ') : 'Chưa phân lớp';
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
            Quản lý học sinh
          </h1>
          <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
            Quản lý tài khoản học sinh và phân lớp
          </p>
        </div>

        {/* Search & Filter & Bulk Actions */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#608a67] dark:text-[#8ba890]">
              <Icon name="search" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm học sinh..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Class Filter */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#608a67] dark:text-[#8ba890] pointer-events-none">
              <Icon name="class" />
            </div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="pl-10 pr-8 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="">Tất cả lớp</option>
              <option value="__unassigned__">Chưa phân lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#608a67] dark:text-[#8ba890] pointer-events-none">
              <Icon name="expand_more" />
            </div>
          </div>

          {selectedStudents.length > 0 && (
            <button
              onClick={() => setShowBulkAssignModal(true)}
              className="px-6 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Icon name="group_add" />
              <span>Phân lớp ({selectedStudents.length})</span>
            </button>
          )}
        </div>
      </div>



      {/* Students Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="clay-card p-12 text-center">
          <Icon name="person_off" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
            {searchQuery || classFilter ? 'Không tìm thấy học sinh' : 'Chưa có học sinh nào'}
          </h3>
          <p className="text-[#608a67] dark:text-[#8ba890]">
            {searchQuery || classFilter ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : 'Học sinh sẽ hiển thị ở đây sau khi đăng ký'}
          </p>
        </div>
      ) : (
        <div className="clay-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f0f5f1] dark:bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === filteredStudents.length}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-[#d0e5d4] dark:border-white/20 text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-[#111812] dark:text-white">
                    Học sinh
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-[#111812] dark:text-white">
                    Lớp học
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-[#111812] dark:text-white">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d0e5d4] dark:divide-white/10">
                {filteredStudents.map((student) => (
                  <tr key={student.uid} className="hover:bg-[#f0f5f1] dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.uid)}
                        onChange={() => handleSelectStudent(student.uid)}
                        className="w-5 h-5 rounded border-[#d0e5d4] dark:border-white/20 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.avatar ? (
                          <img
                            src={student.avatar}
                            alt={student.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Icon name="person" className="text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#111812] dark:text-white">
                              {student.fullName}
                            </p>
                            <button
                              onClick={() => handleEditName(student)}
                              className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400 transition-colors"
                              title="Đổi tên"
                            >
                              <Icon name="edit" className="text-sm" />
                            </button>
                          </div>
                          <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                            @{student.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleAssignClass(student)}
                        className="text-left hover:text-primary transition-colors"
                      >
                        <p className="text-[#111812] dark:text-white font-medium">
                          {getStudentClasses(student)}
                        </p>
                        <p className="text-xs text-[#608a67] dark:text-[#8ba890]">
                          Nhấn để phân lớp
                        </p>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleManageAssets(student)}
                          className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
                          title="Quản lý tài sản"
                        >
                          <Icon name="account_balance_wallet" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(student)}
                          className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                          title="Reset mật khẩu"
                        >
                          <Icon name="lock_reset" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                          title="Xóa học sinh"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedStudent && (
        <ResetPasswordModal
          student={selectedStudent}
          onReset={confirmResetPassword}
          onClose={() => {
            setShowResetModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Edit Student Modal */}
      {showEditNameModal && selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          onClose={() => {
            setShowEditNameModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Assign Class Modal (Single Student) */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="clay-card p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">
                  Phân lớp - {selectedStudent.fullName}
                </h2>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                  Chọn/bỏ chọn lớp học
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedStudent(null);
                }}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {classes.length === 0 ? (
                <p className="text-center text-[#608a67] dark:text-[#8ba890] py-4">
                  Chưa có lớp học nào. Vui lòng tạo lớp học trước.
                </p>
              ) : (
                classes.map((cls) => {
                  const isInClass = cls.students?.includes(selectedStudent.uid);
                  return (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[#f0f5f1] dark:bg-white/5 hover:bg-[#e0f0e5] dark:hover:bg-white/10 transition-all"
                    >
                      <div>
                        <p className="font-bold text-[#111812] dark:text-white">
                          {cls.name}
                        </p>
                        <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                          Khối {cls.grade} • {cls.studentCount || 0} học sinh
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleClass(cls.id, isInClass)}
                        disabled={isAssigning}
                        className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isInClass
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                          : 'bg-primary/20 text-primary hover:bg-primary hover:text-[#052e16]'
                          }`}
                      >
                        {isAssigning && <Icon name="progress_activity" className="animate-spin text-sm" />}
                        {isInClass ? 'Xóa khỏi lớp' : 'Thêm vào lớp'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="clay-card p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">
                  Phân lớp hàng loạt
                </h2>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                  {selectedStudents.length} học sinh được chọn
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBulkAssignModal(false);
                }}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {classes.length === 0 ? (
                <p className="text-center text-[#608a67] dark:text-[#8ba890] py-4">
                  Chưa có lớp học nào. Vui lòng tạo lớp học trước.
                </p>
              ) : isBulkAssigning ? (
                <div className="text-center py-8">
                  <Icon name="progress_activity" className="animate-spin text-4xl text-primary mx-auto mb-3" />
                  <p className="text-[#608a67] dark:text-[#8ba890]">Đang phân lớp...</p>
                </div>
              ) : (
                classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleBulkAssignClass(cls.id)}
                    disabled={isBulkAssigning}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-[#f0f5f1] dark:bg-white/5 hover:bg-primary hover:text-[#052e16] dark:hover:bg-primary transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div>
                      <p className="font-bold">
                        {cls.name}
                      </p>
                      <p className="text-sm opacity-80">
                        Khối {cls.grade} • {cls.studentCount || 0} học sinh
                      </p>
                    </div>
                    <Icon name="arrow_forward" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assets Modal */}
      {showAssetsModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="clay-card p-6 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">
                  Tài sản - {selectedStudent.fullName}
                </h2>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                  Chỉnh sửa điểm và tiền tệ của học sinh
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssetsModal(false);
                  setSelectedStudent(null);
                }}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              {/* Điểm tích lũy */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111812] dark:text-white">
                  <Icon name="star" className="text-green-500" />
                  Điểm tích lũy
                </label>
                <input
                  type="number"
                  min="0"
                  value={assetsForm.totalBehaviorPoints}
                  onChange={(e) => setAssetsForm(prev => ({ ...prev, totalBehaviorPoints: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-lg font-bold"
                />
              </div>

              {/* Xu */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111812] dark:text-white">
                  <CoinIcon size={18} />
                  Xu
                </label>
                <input
                  type="number"
                  min="0"
                  value={assetsForm.coins}
                  onChange={(e) => setAssetsForm(prev => ({ ...prev, coins: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-lg font-bold"
                />
              </div>

              {/* Đồng Vàng */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111812] dark:text-white">
                  <GoldIcon size={18} />
                  Đồng Vàng
                </label>
                <input
                  type="number"
                  min="0"
                  value={assetsForm.gold}
                  onChange={(e) => setAssetsForm(prev => ({ ...prev, gold: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-lg font-bold"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 p-4 rounded-xl bg-[#f0f5f1] dark:bg-white/5 flex items-center justify-around">
              <div className="text-center">
                <p className="text-xs text-[#608a67] dark:text-[#8ba890] mb-1">Điểm tích lũy</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{Number(assetsForm.totalBehaviorPoints) || 0}</p>
              </div>
              <div className="w-px h-10 bg-[#d0e5d4] dark:bg-white/20" />
              <div className="text-center">
                <p className="text-xs text-[#608a67] dark:text-[#8ba890] mb-1">Xu</p>
                <p className="text-xl font-bold text-yellow-500">{Number(assetsForm.coins) || 0}</p>
              </div>
              <div className="w-px h-10 bg-[#d0e5d4] dark:bg-white/20" />
              <div className="text-center">
                <p className="text-xs text-[#608a67] dark:text-[#8ba890] mb-1">Đồng Vàng</p>
                <p className="text-xl font-bold text-amber-500">{Number(assetsForm.gold) || 0}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssetsModal(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 text-[#608a67] dark:text-[#8ba890] font-semibold hover:bg-[#f0f5f1] dark:hover:bg-white/5 transition-all"
                disabled={isSavingAssets}
              >
                Hủy
              </button>
              <button
                onClick={handleSaveAssets}
                disabled={isSavingAssets}
                className="flex-1 px-4 py-3 rounded-xl bg-primary text-[#052e16] font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSavingAssets ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#052e16] border-t-transparent" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Icon name="save" />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Students;
