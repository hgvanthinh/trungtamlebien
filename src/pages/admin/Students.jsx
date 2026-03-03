import { useState, useEffect, useCallback } from 'react';
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

  // ── Asset editing mode ──────────────────────────────────────────────────────
  // showAssetsMode: whether the assets columns are visible (only allowed when filtered)
  const [showAssetsMode, setShowAssetsMode] = useState(false);
  // assetsForms: { [uid]: { totalBehaviorPoints, coins, gold } }
  const [assetsForms, setAssetsForms] = useState({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  // savingUid: uid of a single student being saved (if any)
  const [savingUid, setSavingUid] = useState(null);

  // Whether filtering/search is active
  const isFiltered = searchQuery.trim() !== '' || classFilter !== '';

  // When assets mode is on but user clears filters → auto-close mode
  useEffect(() => {
    if (!isFiltered && showAssetsMode) {
      setShowAssetsMode(false);
    }
  }, [isFiltered, showAssetsMode]);

  // Populate / sync assetsForms whenever the visible list changes while mode is on
  const buildAssetsForms = useCallback((list) => {
    const forms = {};
    list.forEach((s) => {
      forms[s.uid] = {
        totalBehaviorPoints: s.totalBehaviorPoints ?? 0,
        coins: s.coins ?? 0,
        gold: s.gold ?? 0,
      };
    });
    return forms;
  }, []);

  const handleToggleAssetsMode = () => {
    if (!showAssetsMode) {
      // Opening: populate forms from current filtered list
      setAssetsForms(buildAssetsForms(filteredStudents));
    }
    setShowAssetsMode((v) => !v);
  };

  const handleAssetsFormChange = (uid, field, value) => {
    setAssetsForms((prev) => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value },
    }));
  };

  // Save a single student's assets
  const handleSaveOne = async (student) => {
    const form = assetsForms[student.uid];
    if (!form) return;
    setSavingUid(student.uid);
    try {
      const userRef = doc(db, 'users', student.uid);
      await updateDoc(userRef, {
        totalBehaviorPoints: Number(form.totalBehaviorPoints) || 0,
        coins: Number(form.coins) || 0,
        gold: Number(form.gold) || 0,
      });
      setToast({ type: 'success', message: `Đã lưu tài sản: ${student.fullName}` });
      // Update local state
      setStudents((prev) =>
        prev.map((s) =>
          s.uid === student.uid
            ? { ...s, totalBehaviorPoints: Number(form.totalBehaviorPoints) || 0, coins: Number(form.coins) || 0, gold: Number(form.gold) || 0 }
            : s
        )
      );
    } catch (err) {
      setToast({ type: 'error', message: `Lỗi lưu ${student.fullName}: ${err.message}` });
    }
    setSavingUid(null);
  };

  // Save all visible students at once
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    let ok = 0;
    let fail = 0;
    for (const student of filteredStudents) {
      const form = assetsForms[student.uid];
      if (!form) continue;
      try {
        const userRef = doc(db, 'users', student.uid);
        await updateDoc(userRef, {
          totalBehaviorPoints: Number(form.totalBehaviorPoints) || 0,
          coins: Number(form.coins) || 0,
          gold: Number(form.gold) || 0,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    // Update local state in one pass
    setStudents((prev) =>
      prev.map((s) => {
        const form = assetsForms[s.uid];
        if (!form) return s;
        return {
          ...s,
          totalBehaviorPoints: Number(form.totalBehaviorPoints) || 0,
          coins: Number(form.coins) || 0,
          gold: Number(form.gold) || 0,
        };
      })
    );
    setToast({
      type: fail === 0 ? 'success' : 'error',
      message: `Đã lưu ${ok} học sinh${fail > 0 ? ` (${fail} lỗi)` : ''}`,
    });
    setIsSavingAll(false);
    setShowAssetsMode(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = students;

    if (classFilter === '__unassigned__') {
      filtered = filtered.filter(
        (student) => !student.classes || student.classes.length === 0
      );
    } else if (classFilter) {
      filtered = filtered.filter(
        (student) => student.classes && student.classes.includes(classFilter)
      );
    }

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

    // If assets mode is active, re-sync new students that appear in the filtered list
    if (showAssetsMode) {
      setAssetsForms((prev) => {
        const updated = { ...prev };
        filtered.forEach((s) => {
          if (!updated[s.uid]) {
            updated[s.uid] = {
              totalBehaviorPoints: s.totalBehaviorPoints ?? 0,
              coins: s.coins ?? 0,
              gold: s.gold ?? 0,
            };
          }
        });
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (partA.grade !== partB.grade) return partA.grade - partB.grade;
      return partA.letter.localeCompare(partB.letter, 'vi');
    });
  };

  const loadClasses = async () => {
    const result = await getAllClasses();
    if (result.success) setClasses(sortClassesAlphabetically(result.classes));
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

  const confirmResetPassword = async (newPassword) => {
    const result = await resetStudentPassword(selectedStudent.email, newPassword);
    if (result.success) {
      setToast({ type: 'success', message: 'Đã reset mật khẩu thành công!' });
      setShowResetModal(false);
      setSelectedStudent(null);
    } else {
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
      setToast({ type: 'success', message: isInClass ? 'Đã xóa khỏi lớp' : 'Đã thêm vào lớp' });
      await loadData();
    } else {
      setToast({ type: 'error', message: result.error });
    }
  };

  const handleBulkAssignClass = async (classId) => {
    if (selectedStudents.length === 0) { alert('Vui lòng chọn ít nhất 1 học sinh'); return; }
    setIsBulkAssigning(true);
    let successCount = 0, errorCount = 0;
    for (const studentUid of selectedStudents) {
      const result = await addStudentToClass(classId, studentUid);
      if (result.success) successCount++; else errorCount++;
    }
    setIsBulkAssigning(false);
    setToast({
      type: errorCount === 0 ? 'success' : 'error',
      message: `Đã thêm ${successCount} học sinh vào lớp${errorCount > 0 ? ` (${errorCount} lỗi)` : ''}`,
    });
    await loadData();
    setShowBulkAssignModal(false);
    setSelectedStudents([]);
  };

  const getStudentClasses = (student) => {
    if (!student.classes || student.classes.length === 0) return 'Chưa phân lớp';
    const names = student.classes
      .map((cid) => classes.find((c) => c.id === cid)?.name || '')
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Chưa phân lớp';
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111812] dark:text-white">Quản lý học sinh</h1>
          <p className="text-[#608a67] dark:text-[#8ba890] mt-1">Quản lý tài khoản học sinh và phân lớp</p>
        </div>

        {/* Search & Filter & Actions */}
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
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
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#608a67] dark:text-[#8ba890] pointer-events-none">
              <Icon name="expand_more" />
            </div>
          </div>

          {/* Tài sản button — only when filtered */}
          {isFiltered && !isLoading && filteredStudents.length > 0 && (
            <button
              onClick={handleToggleAssetsMode}
              className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${showAssetsMode
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/40'
                  : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30'
                }`}
            >
              <Icon name="account_balance_wallet" />
              <span>Tài sản</span>
              {showAssetsMode && (
                <span className="text-xs bg-white/30 rounded-full px-1.5 py-0.5">
                  {filteredStudents.length} HS
                </span>
              )}
            </button>
          )}

          {/* Bulk assign */}
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

      {/* ── Assets mode action bar ─────────────────────────────────────────── */}
      {showAssetsMode && (
        <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <Icon name="account_balance_wallet" />
            <span>
              Chế độ chỉnh sửa tài sản —{' '}
              <strong>{filteredStudents.length}</strong> học sinh đang hiển thị
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Icon name="save" />
                  <span>Lưu tất cả</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowAssetsMode(false)}
              disabled={isSavingAll}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold text-sm transition-all disabled:opacity-50"
            >
              <Icon name="close" />
              <span>Đóng</span>
            </button>
          </div>
        </div>
      )}

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
            {searchQuery || classFilter
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
              : 'Học sinh sẽ hiển thị ở đây sau khi đăng ký'}
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
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-[#d0e5d4] dark:border-white/20 text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-[#111812] dark:text-white">Học sinh</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-[#111812] dark:text-white">Lớp học</th>
                  {/* Asset columns header */}
                  {showAssetsMode && (
                    <>
                      <th className="px-3 py-4 text-center text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Icon name="star" className="text-sm" />
                          Điểm tích lũy
                        </div>
                      </th>
                      <th className="px-3 py-4 text-center text-xs font-bold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <CoinIcon size={14} />
                          Xu
                        </div>
                      </th>
                      <th className="px-3 py-4 text-center text-xs font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <GoldIcon size={14} />
                          Đồng Vàng
                        </div>
                      </th>
                      <th className="px-3 py-4 text-center text-xs font-bold text-[#608a67] dark:text-[#8ba890]"></th>
                    </>
                  )}
                  {!showAssetsMode && (
                    <th className="px-6 py-4 text-center text-sm font-bold text-[#111812] dark:text-white">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d0e5d4] dark:divide-white/10">
                {filteredStudents.map((student) => {
                  const form = assetsForms[student.uid];
                  const isSavingThis = savingUid === student.uid;

                  return (
                    <tr
                      key={student.uid}
                      className={`transition-colors ${showAssetsMode ? 'bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10' : 'hover:bg-[#f0f5f1] dark:hover:bg-white/5'}`}
                    >
                      {/* Checkbox */}
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.uid)}
                          onChange={() => handleSelectStudent(student.uid)}
                          className="w-5 h-5 rounded border-[#d0e5d4] dark:border-white/20 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>

                      {/* Student info */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {student.avatar ? (
                            <img src={student.avatar} alt={student.fullName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Icon name="person" className="text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-[#111812] dark:text-white">{student.fullName}</p>
                              <button
                                onClick={() => handleEditName(student)}
                                className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400 transition-colors"
                                title="Đổi tên"
                              >
                                <Icon name="edit" className="text-sm" />
                              </button>
                            </div>
                            <p className="text-sm text-[#608a67] dark:text-[#8ba890]">@{student.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleAssignClass(student)}
                          className="text-left hover:text-primary transition-colors"
                        >
                          <p className="text-[#111812] dark:text-white font-medium">{getStudentClasses(student)}</p>
                          <p className="text-xs text-[#608a67] dark:text-[#8ba890]">Nhấn để phân lớp</p>
                        </button>
                      </td>

                      {/* ── Asset inputs (only in assets mode) ── */}
                      {showAssetsMode && form ? (
                        <>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0"
                              value={form.totalBehaviorPoints}
                              onChange={(e) => handleAssetsFormChange(student.uid, 'totalBehaviorPoints', e.target.value)}
                              disabled={isSavingThis || isSavingAll}
                              className="w-24 px-2 py-1.5 rounded-lg border border-green-300 dark:border-green-700/50 bg-white dark:bg-white/10 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 font-bold text-sm text-center disabled:opacity-50"
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0"
                              value={form.coins}
                              onChange={(e) => handleAssetsFormChange(student.uid, 'coins', e.target.value)}
                              disabled={isSavingThis || isSavingAll}
                              className="w-24 px-2 py-1.5 rounded-lg border border-yellow-300 dark:border-yellow-700/50 bg-white dark:bg-white/10 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold text-sm text-center disabled:opacity-50"
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0"
                              value={form.gold}
                              onChange={(e) => handleAssetsFormChange(student.uid, 'gold', e.target.value)}
                              disabled={isSavingThis || isSavingAll}
                              className="w-24 px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-white/10 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-sm text-center disabled:opacity-50"
                            />
                          </td>
                          {/* Per-row save */}
                          <td className="px-2 py-3">
                            <button
                              onClick={() => handleSaveOne(student)}
                              disabled={isSavingThis || isSavingAll}
                              title="Lưu học sinh này"
                              className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSavingThis
                                ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent" />
                                : <Icon name="save" className="text-base" />
                              }
                            </button>
                          </td>
                        </>
                      ) : !showAssetsMode ? (
                        /* Normal action buttons */
                        <td className="px-6 py-3">
                          <div className="flex justify-center gap-2">
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
                      ) : null}
                    </tr>
                  );
                })}
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
          onClose={() => { setShowResetModal(false); setSelectedStudent(null); }}
        />
      )}

      {/* Edit Student Modal */}
      {showEditNameModal && selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          onClose={() => { setShowEditNameModal(false); setSelectedStudent(null); }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Assign Class Modal */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="clay-card p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">
                  Phân lớp - {selectedStudent.fullName}
                </h2>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">Chọn/bỏ chọn lớp học</p>
              </div>
              <button
                onClick={() => { setShowAssignModal(false); setSelectedStudent(null); }}
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
                    <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl bg-[#f0f5f1] dark:bg-white/5 hover:bg-[#e0f0e5] dark:hover:bg-white/10 transition-all">
                      <div>
                        <p className="font-bold text-[#111812] dark:text-white">{cls.name}</p>
                        <p className="text-sm text-[#608a67] dark:text-[#8ba890]">Khối {cls.grade} • {cls.studentCount || 0} học sinh</p>
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
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">Phân lớp hàng loạt</h2>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">{selectedStudents.length} học sinh được chọn</p>
              </div>
              <button
                onClick={() => setShowBulkAssignModal(false)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {classes.length === 0 ? (
                <p className="text-center text-[#608a67] dark:text-[#8ba890] py-4">Chưa có lớp học nào.</p>
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
                      <p className="font-bold">{cls.name}</p>
                      <p className="text-sm opacity-80">Khối {cls.grade} • {cls.studentCount || 0} học sinh</p>
                    </div>
                    <Icon name="arrow_forward" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default Students;
