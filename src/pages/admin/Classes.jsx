import { useState, useEffect } from 'react';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { getAllClasses, createClass, deleteClass, removeStudentFromClass } from '../../services/classService';
import { getAllStudents } from '../../services/adminService';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('6');
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, []);

  // Hàm sắp xếp lớp theo ABC (6A, 6B, 7A, 7B,...)
  const sortClassesAlphabetically = (classList) => {
    return [...classList].sort((a, b) => {
      // Tách số và chữ cái từ tên lớp (ví dụ: "6A.TTB", "10B.TTB")
      const extractParts = (name) => {
        // Tìm số và chữ cái đầu tiên (hỗ trợ "6A.TTB", "10B", etc.)
        const match = name.match(/^(\d+)([A-Za-z])/);
        if (match) {
          return { grade: parseInt(match[1], 10), letter: match[2].toUpperCase() };
        }
        return { grade: 999, letter: name };
      };

      const partA = extractParts(a.name);
      const partB = extractParts(b.name);

      // So sánh theo khối trước (số)
      if (partA.grade !== partB.grade) {
        return partA.grade - partB.grade;
      }
      // Sau đó so sánh theo chữ cái
      return partA.letter.localeCompare(partB.letter, 'vi');
    });
  };

  const fetchClasses = async () => {
    setLoading(true);
    const result = await getAllClasses();
    if (result.success) {
      setClasses(sortClassesAlphabetically(result.classes));
    }
    setLoading(false);
  };

  const fetchStudents = async () => {
    const result = await getAllStudents();
    if (result.success) {
      setStudents(result.students);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      alert('Vui lòng nhập tên lớp');
      return;
    }

    setIsCreating(true);
    const result = await createClass(newClassName, newClassGrade);
    setIsCreating(false);

    if (result.success) {
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassGrade('6');
      setToast({ type: 'success', message: 'Tạo lớp học thành công!' });
      fetchClasses();
    } else {
      setToast({ type: 'error', message: result.error || 'Lỗi khi tạo lớp' });
    }
  };

  const handleDeleteClass = async (classId, className) => {
    if (!confirm(`Bạn có chắc muốn xóa lớp ${className}?`)) return;

    const result = await deleteClass(classId);
    if (result.success) {
      fetchClasses();
      setToast({ type: 'success', message: 'Đã xóa lớp học' });
    } else {
      setToast({ type: 'error', message: result.error || 'Lỗi khi xóa lớp' });
    }
  };

  const handleManageStudents = (classItem) => {
    setSelectedClass(classItem);
    setShowManageModal(true);
  };

  const handleRemoveStudent = async (studentUid) => {
    if (!selectedClass) return;
    if (!confirm('Xóa học sinh khỏi lớp?')) return;

    const result = await removeStudentFromClass(selectedClass.id, studentUid);
    if (result.success) {
      fetchClasses();
      // Update selectedClass
      const updatedClass = classes.find((c) => c.id === selectedClass.id);
      setSelectedClass(updatedClass);
      setToast({ type: 'success', message: 'Đã xóa học sinh khỏi lớp' });
    } else {
      setToast({ type: 'error', message: result.error || 'Lỗi khi xóa học sinh' });
    }
  };

  const isStudentInClass = (studentUid) => {
    return selectedClass?.students?.includes(studentUid);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
            Quản lý lớp học
          </h1>
          <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
            Tạo và quản lý các nhóm lớp học
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-[#052e16] rounded-2xl font-bold hover:shadow-lg transition-all"
        >
          <Icon name="add" />
          <span>Tạo lớp mới</span>
        </button>
      </div>



      {/* Classes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="clay-card p-12 text-center">
          <Icon name="school" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
            Chưa có lớp học nào
          </h3>
          <p className="text-[#608a67] dark:text-[#8ba890]">
            Nhấn "Tạo lớp mới" để bắt đầu
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="clay-card p-6 hover:shadow-xl transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#111812] dark:text-white">
                    {classItem.name}
                  </h3>
                  <p className="text-[#608a67] dark:text-[#8ba890]">
                    Khối {classItem.grade}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClass(classItem.id, classItem.name);
                  }}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                >
                  <Icon name="delete" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4 text-[#608a67] dark:text-[#8ba890]">
                <Icon name="people" />
                <span>{classItem.studentCount || 0} học sinh</span>
              </div>

              <button
                onClick={() => handleManageStudents(classItem)}
                className="w-full py-2 px-4 bg-[#f0f5f1] dark:bg-white/10 text-[#111812] dark:text-white rounded-xl font-medium hover:bg-primary hover:text-[#052e16] transition-all"
              >
                Quản lý học sinh
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="clay-card p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#111812] dark:text-white mb-4">
              Tạo lớp học mới
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                  Tên lớp
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 6A, Nhóm nâng cao..."
                  className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                  Khối
                </label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                    <option key={grade} value={grade}>
                      Lớp {grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="flex-1 py-3 px-4 rounded-xl border border-[#d0e5d4] dark:border-white/20 text-[#111812] dark:text-white font-medium hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateClass}
                disabled={isCreating}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-[#052e16] font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Icon name="progress_activity" className="animate-spin" />
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  'Tạo lớp'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Students Modal */}
      {showManageModal && selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="clay-card p-6 max-w-3xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#111812] dark:text-white">
                  Danh sách học sinh - {selectedClass.name}
                </h2>
                <p className="text-[#608a67] dark:text-[#8ba890]">
                  {selectedClass.studentCount || 0} học sinh
                </p>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-2 hover:bg-[#f0f5f1] dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Students in Class Table */}
            {selectedClass.studentCount > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#d0e5d4] dark:border-white/20">
                      <th className="text-left py-3 px-4 text-sm font-bold text-[#111812] dark:text-white">
                        Học sinh
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-bold text-[#111812] dark:text-white">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((student) => isStudentInClass(student.uid))
                      .map((student) => (
                        <tr
                          key={student.uid}
                          className="border-b border-[#d0e5d4] dark:border-white/10 hover:bg-[#f0f5f1] dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 px-4">
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
                              <p className="font-bold text-[#111812] dark:text-white">
                                {student.fullName}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleRemoveStudent(student.uid)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                              title="Xóa học sinh khỏi lớp"
                            >
                              <Icon name="delete" />
                              <span className="text-sm">Xóa</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Icon name="people" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                  Lớp chưa có học sinh
                </h3>
                <p className="text-[#608a67] dark:text-[#8ba890]">
                  Thêm học sinh vào lớp để bắt đầu quản lý
                </p>
              </div>
            )}
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

export default Classes;
