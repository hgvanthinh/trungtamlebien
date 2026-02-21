import { useState, useEffect } from 'react';
import { getAllAssignments, deleteAssignment } from '../../services/assignmentService';
import { getExamById } from '../../services/examBankService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllClasses } from '../../services/classService';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useNavigate } from 'react-router-dom';

const GradeSubmissions = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState({});
  const [classes, setClasses] = useState({});
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load assignments
    const assignmentsResult = await getAllAssignments();
    if (assignmentsResult.success) {
      setAssignments(assignmentsResult.assignments);

      // Load exam details - only fetch if exam still exists
      const examDetails = {};
      for (const assignment of assignmentsResult.assignments) {
        // Try to get exam details, but don't fail if exam is deleted
        const examResult = await getExamById(assignment.examId);
        if (examResult.success) {
          examDetails[assignment.examId] = examResult.exam;
        } else {
          // If exam is deleted, create a placeholder with info from assignment
          examDetails[assignment.examId] = {
            title: assignment.examTitle || 'Đề thi đã bị xóa',
            type: assignment.examType || 'upload',
            deleted: true
          };
        }
      }
      setExams(examDetails);

      // Load submission counts
      const counts = {};
      for (const assignment of assignmentsResult.assignments) {
        const count = await getSubmissionCount(assignment.id);
        counts[assignment.id] = count;
      }
      setSubmissionCounts(counts);
    }

    // Load classes
    const classesResult = await getAllClasses();
    if (classesResult.success) {
      const classMap = {};
      classesResult.classes.forEach(cls => {
        classMap[cls.id] = cls;
      });
      setClasses(classMap);
    }

    setLoading(false);
  };

  const getSubmissionCount = async (assignmentId) => {
    try {
      const submissionsRef = collection(db, 'examSubmissions');
      const q = query(submissionsRef, where('assignmentId', '==', assignmentId));
      const snapshot = await getDocs(q);

      // Đếm số học sinh unique (không đếm trùng nếu 1 HS nộp nhiều lần)
      const uniqueStudents = new Set();
      snapshot.docs.forEach(doc => {
        uniqueStudents.add(doc.data().studentUid);
      });
      return uniqueStudents.size;
    } catch (error) {
      console.error('Error getting submission count:', error);
      return 0;
    }
  };

  const handleViewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    setLoadingSubmissions(true);

    try {
      const submissionsRef = collection(db, 'examSubmissions');
      const q = query(submissionsRef, where('assignmentId', '==', assignment.id));
      const snapshot = await getDocs(q);

      const allSubmissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Lọc chỉ lấy bài nộp mới nhất của mỗi học sinh
      const latestByStudent = {};
      allSubmissions.forEach(submission => {
        const studentUid = submission.studentUid;
        const submittedAt = submission.submittedAt?.seconds || 0;

        if (!latestByStudent[studentUid] || submittedAt > (latestByStudent[studentUid].submittedAt?.seconds || 0)) {
          latestByStudent[studentUid] = submission;
        }
      });

      const submissionsList = Object.values(latestByStudent);
      setSubmissions(submissionsList);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }

    setLoadingSubmissions(false);
  };

  const handleDeleteAssignment = (assignment) => {
    setAssignmentToDelete(assignment);
    setShowConfirmDelete(true);
  };

  const confirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;

    const result = await deleteAssignment(assignmentToDelete.id);
    if (result.success) {
      setToast({ type: 'success', message: 'Đã xóa bài giao thành công!' });
      loadData();
    } else {
      setToast({ type: 'error', message: result.error || 'Lỗi khi xóa bài giao' });
    }
    setAssignmentToDelete(null);
    setShowConfirmDelete(false);
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

  // View submissions detail
  if (selectedAssignment) {
    const exam = exams[selectedAssignment.examId];
    const cls = classes[selectedAssignment.classId];

    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedAssignment(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Icon name="arrow_back" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#111812] dark:text-white">
              {exam?.title}
            </h1>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Lớp: {cls?.name} • Hạn: {selectedAssignment.deadline?.toDate().toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="clay-card p-4">
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Tổng HS</p>
            <p className="text-2xl font-bold text-[#111812] dark:text-white">
              {cls?.studentCount || 0}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Đã nộp</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {submissions.length}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Chưa nộp</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(cls?.studentCount || 0) - submissions.length}
            </p>
          </div>
        </div>

        {/* Submissions List */}
        {loadingSubmissions ? (
          <div className="text-center py-12">
            <p className="text-[#608a67] dark:text-[#8ba890]">Đang tải bài nộp...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="clay-card p-12 text-center">
            <Icon name="pending_actions" className="text-6xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Chưa có bài nộp
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Chưa có học sinh nào nộp bài
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div key={submission.id} className="clay-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-[#111812] dark:text-white mb-1">
                      {submission.studentName}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-[#608a67] dark:text-[#8ba890]">
                      <span className="flex items-center gap-1">
                        <Icon name="schedule" className="text-xs" />
                        {submission.submittedAt ? new Date(submission.submittedAt.seconds * 1000).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                      {/* Hiển thị số ảnh nếu là bài nhiều ảnh */}
                      {submission.files && submission.files.length > 1 && (
                        <span className="flex items-center gap-1">
                          <Icon name="image" className="text-xs" />
                          {submission.files.length} ảnh
                        </span>
                      )}
                      {/* Chỉ hiển thị trạng thái cho bài tự luận */}
                      {exam?.type === 'upload' && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${submission.status === 'graded'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                            }`}
                        >
                          {submission.status === 'graded' ? 'Đã chấm' : 'Chờ chấm'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-xl font-bold text-primary">
                      {exam?.type === 'upload'
                        ? (submission.totalScore || 0)
                        : `${submission.totalScore || 0}/${submission.maxScore || 0}`
                      }
                    </p>
                    <p className="text-xs text-[#608a67] dark:text-[#8ba890]">điểm</p>
                  </div>
                  {/* Chỉ hiển thị nút Chấm cho bài tự luận */}
                  {exam?.type === 'upload' && (
                    <button
                      onClick={() => navigate(`/admin/grade-submissions/${submission.id}`)}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                    >
                      <Icon name="grading" className="inline mr-1" />
                      Chấm
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main list view
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
          Chấm bài
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
          Danh sách bài đã giao và bài nộp của học sinh
        </p>
      </div>

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="clay-card p-12 text-center">
          <Icon name="assignment" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
            Chưa có bài giao
          </h3>
          <p className="text-[#608a67] dark:text-[#8ba890]">
            Chưa có bài thi nào được giao cho học sinh
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const exam = exams[assignment.examId];
            const cls = classes[assignment.classId];
            const submissionCount = submissionCounts[assignment.id] || 0;
            const totalStudents = cls?.studentCount || 0;
            const deadline = assignment.deadline?.toDate();
            const isExpired = deadline && deadline < new Date();

            return (
              <div key={assignment.id} className="clay-card p-5 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-xl ${exam?.type === 'upload'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                    }`}>
                    <Icon
                      name={exam?.type === 'upload' ? 'picture_as_pdf' : 'edit_note'}
                      className={`text-xl ${exam?.type === 'upload'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-green-600 dark:text-green-400'
                        }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#111812] dark:text-white">
                        {exam?.title || assignment.examTitle || 'Đề thi'}
                      </h3>
                      {exam?.deleted && (
                        <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full">
                          Đề đã xóa
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm mb-3">
                      <span className="flex items-center gap-1 text-[#608a67] dark:text-[#8ba890]">
                        <Icon name="groups" className="text-sm" />
                        {cls?.name}
                      </span>
                      <span className={`flex items-center gap-1 ${isExpired
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                        }`}>
                        <Icon name="event" className="text-sm" />
                        Hạn: {deadline?.toLocaleDateString('vi-VN')}
                        {isExpired && ' (Hết hạn)'}
                      </span>
                      <span className="flex items-center gap-1 text-[#608a67] dark:text-[#8ba890]">
                        <Icon name="schedule" className="text-sm" />
                        {assignment.createdAt ? new Date(assignment.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${totalStudents > 0 ? (submissionCount / totalStudents) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-[#111812] dark:text-white whitespace-nowrap">
                        {submissionCount}/{totalStudents}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewSubmissions(assignment)}
                      className="px-4 py-2 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Icon name="visibility" />
                      Xem chi tiết
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(assignment)}
                      className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center gap-2"
                    >
                      <Icon name="delete" />
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDeleteAssignment}
        title="Xóa bài đã giao"
        message="Bạn có chắc chắn muốn xóa bài giao này? Các bài nộp của học sinh cũng sẽ bị xóa."
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

export default GradeSubmissions;
