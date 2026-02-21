import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllExams,
  deleteExam,
} from '../../services/examBankService';
import { getAllClasses } from '../../services/classService';
import {
  assignExamToClass,
  getAllAssignments,
  updateAssignment,
  deleteAssignment
} from '../../services/assignmentService';
import ExamUploadModal from '../../components/exam/ExamUploadModal';
import ExamMixedModal from '../../components/exam/ExamMixedModal';
import ExamCard from '../../components/exam/ExamCard';
import AssignExamModal from '../../components/exam/AssignExamModal';
import EditAssignmentDeadlineModal from '../../components/exam/EditAssignmentDeadlineModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';

const ExamBank = () => {
  const { currentUser } = useAuth();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMixedModal, setShowMixedModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [examToAssign, setExamToAssign] = useState(null);
  const [examToEdit, setExamToEdit] = useState(null);
  const [showEditDeadlineModal, setShowEditDeadlineModal] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [showConfirmDeleteAssignment, setShowConfirmDeleteAssignment] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' or 'assignments'
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [examsResult, classesResult, assignmentsResult] = await Promise.all([
      getAllExams(),
      getAllClasses(),
      getAllAssignments(),
    ]);

    if (examsResult.success) setExams(examsResult.exams);
    if (classesResult.success) setClasses(classesResult.classes);
    if (assignmentsResult.success) setAssignments(assignmentsResult.assignments);
    setLoading(false);
  };

  const handleUploadComplete = async (result) => {
    if (result.success) {
      setToast({ type: 'success', message: result.message || 'Tạo đề thành công!' });
      loadData();
      setShowUploadModal(false);
      setShowMixedModal(false);
    }
  };


  const handleDeleteExam = (examId) => {
    setExamToDelete(examId);
    setShowConfirmDelete(true);
  };

  const confirmDeleteExam = async () => {
    if (examToDelete) {
      const result = await deleteExam(examToDelete);
      if (result.success) {
        setToast({ type: 'success', message: 'Đã xóa đề thi!' });
        loadData();
      } else {
        setToast({ type: 'error', message: result.error });
      }
      setExamToDelete(null);
    }
  };

  const handleAssignExam = (exam) => {
    setExamToAssign(exam);
    setShowAssignModal(true);
  };

  const handleEditExam = (exam) => {
    setExamToEdit(exam);
    if (exam.type === 'upload') {
      setShowUploadModal(true);
    } else if (exam.type === 'mixed_exam') {
      setShowMixedModal(true);
    }
  };

  const confirmAssignExam = async (classId, deadline) => {
    if (!examToAssign) return;

    const result = await assignExamToClass({
      examId: examToAssign.id,
      examTitle: examToAssign.title,
      examType: examToAssign.type,
      classId: classId,
      deadline: deadline,
      assignedBy: currentUser.uid,
    });

    if (result.success) {
      setToast({ type: 'success', message: 'Đã giao bài thành công!' });
      setShowAssignModal(false);
      setExamToAssign(null);
      loadData();
    } else {
      setToast({ type: 'error', message: result.error });
    }
  };

  const handleEditDeadline = (assignment) => {
    setAssignmentToEdit(assignment);
    setShowEditDeadlineModal(true);
  };

  const confirmUpdateDeadline = async (assignmentId, newDeadline) => {
    const result = await updateAssignment(assignmentId, { deadline: newDeadline });

    if (result.success) {
      setToast({ type: 'success', message: 'Đã cập nhật thời hạn!' });
      setShowEditDeadlineModal(false);
      setAssignmentToEdit(null);
      loadData();
    } else {
      setToast({ type: 'error', message: result.error });
    }
  };

  const handleDeleteAssignment = (assignment) => {
    setAssignmentToDelete(assignment);
    setShowConfirmDeleteAssignment(true);
  };

  const confirmDeleteAssignment = async () => {
    if (assignmentToDelete) {
      const result = await deleteAssignment(assignmentToDelete.id);
      if (result.success) {
        setToast({ type: 'success', message: 'Đã xóa bài giao!' });
        loadData();
      } else {
        setToast({ type: 'error', message: result.error });
      }
      setAssignmentToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
          Kho đề thi
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
          Quản lý và giao đề thi cho học sinh
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('exams')}
          className={`px-6 py-3 font-medium transition-all ${activeTab === 'exams'
            ? 'text-primary border-b-2 border-primary'
            : 'text-[#608a67] dark:text-[#8ba890] hover:text-[#111812] dark:hover:text-white'
            }`}
        >
          <Icon name="quiz" className="inline mr-2" />
          Tất cả đề thi ({exams.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-6 py-3 font-medium transition-all ${activeTab === 'assignments'
            ? 'text-primary border-b-2 border-primary'
            : 'text-[#608a67] dark:text-[#8ba890] hover:text-[#111812] dark:hover:text-white'
            }`}
        >
          <Icon name="assignment" className="inline mr-2" />
          Bài đã giao ({assignments.length})
        </button>
      </div>

      {/* Actions - Only show when on exams tab */}
      {activeTab === 'exams' && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Icon name="upload_file" />
            Tạo mới tự luận
          </button>
          <button
            onClick={() => setShowMixedModal(true)}
            className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Icon name="ballot" />
            Tạo đề trắc nghiệm
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'exams' ? (
        // Exams Grid
        exams.length === 0 ? (
          <div className="clay-card p-12 text-center">
            <Icon name="quiz" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Chưa có đề thi
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Nhấn "Tạo mới" để bắt đầu tạo đề thi
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onDelete={handleDeleteExam}
                onAssign={handleAssignExam}
                onEdit={handleEditExam}
              />
            ))}
          </div>
        )
      ) : (
        // Assignments List
        assignments.length === 0 ? (
          <div className="clay-card p-12 text-center">
            <Icon name="assignment" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Chưa có bài giao
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Giao đề thi cho lớp học để bắt đầu
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const assignedClass = classes.find(c => c.id === assignment.classId);
              const deadline = assignment.deadline?.toDate ? assignment.deadline.toDate() : new Date(assignment.deadline);
              const now = new Date();
              const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft < 0;

              return (
                <div key={assignment.id} className="clay-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name={assignment.examType === 'upload' ? 'upload_file' : 'quiz'}
                          className="text-primary"
                        />
                        <h3 className="font-bold text-[#111812] dark:text-white">
                          {assignment.examTitle}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-1 text-[#608a67] dark:text-[#8ba890]">
                          <Icon name="group" className="text-sm" />
                          <span>{assignedClass?.name || 'Lớp không xác định'}</span>
                        </div>

                        <div className={`flex items-center gap-1 ${isExpired
                          ? 'text-red-600 dark:text-red-400'
                          : daysLeft <= 1
                            ? 'text-red-600 dark:text-red-400'
                            : daysLeft <= 3
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                          <Icon name="schedule" className="text-sm" />
                          <span>
                            Hạn: {deadline.toLocaleDateString('vi-VN')} lúc {deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            {isExpired
                              ? ` (đã quá ${Math.abs(daysLeft)} ngày)`
                              : daysLeft === 0
                                ? ' (hôm nay)'
                                : ` (còn ${daysLeft} ngày)`
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditDeadline(assignment)}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Sửa thời hạn"
                      >
                        <Icon name="edit" className="text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(assignment)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Xóa bài giao"
                      >
                        <Icon name="delete" className="text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {showUploadModal && (
        <ExamUploadModal
          currentUser={currentUser}
          onClose={() => {
            setShowUploadModal(false);
            setExamToEdit(null);
          }}
          onComplete={handleUploadComplete}
          editingExam={examToEdit}
        />
      )}


      {showAssignModal && examToAssign && (
        <AssignExamModal
          exam={examToAssign}
          classes={classes}
          onClose={() => {
            setShowAssignModal(false);
            setExamToAssign(null);
          }}
          onAssign={confirmAssignExam}
        />
      )}

      {showEditDeadlineModal && assignmentToEdit && (
        <EditAssignmentDeadlineModal
          assignment={assignmentToEdit}
          onClose={() => {
            setShowEditDeadlineModal(false);
            setAssignmentToEdit(null);
          }}
          onUpdate={confirmUpdateDeadline}
        />
      )}

      {showMixedModal && (
        <ExamMixedModal
          currentUser={currentUser}
          onClose={() => {
            setShowMixedModal(false);
            setExamToEdit(null);
          }}
          onComplete={handleUploadComplete}
          editingExam={examToEdit}
        />
      )}

      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDeleteExam}
        title="Xóa đề thi"
        message="Bạn có chắc chắn muốn xóa đề thi này? Hành động này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      <ConfirmModal
        isOpen={showConfirmDeleteAssignment}
        onClose={() => setShowConfirmDeleteAssignment(false)}
        onConfirm={confirmDeleteAssignment}
        title="Xóa bài giao"
        message="Bạn có chắc chắn muốn xóa bài giao này? Học sinh sẽ không còn thấy bài này nữa."
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ExamBank;
