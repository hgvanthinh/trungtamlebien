import { useState, useEffect } from 'react';
import { getAllAssignments, deleteAssignment } from '../../services/assignmentService';
import { getExamById } from '../../services/examBankService';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllClasses, getClassStudents } from '../../services/classService';
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
  const [studentNameMap, setStudentNameMap] = useState({});
  const [classStudents, setClassStudents] = useState([]);
  const [filterStatus, setFilterStatus] = useState('submitted');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load assignments + classes song song
    const [assignmentsResult, classesResult] = await Promise.all([
      getAllAssignments(),
      getAllClasses(),
    ]);

    // Cập nhật classes ngay
    if (classesResult.success) {
      const classMap = {};
      classesResult.classes.forEach(cls => { classMap[cls.id] = cls; });
      setClasses(classMap);
    }

    if (assignmentsResult.success) {
      const assignmentsList = assignmentsResult.assignments;
      setAssignments(assignmentsList);
      setLoading(false); // ✅ Hiện danh sách ngay, không chờ exam/count

      // Dedupe examIds để không gọi lại cùng 1 exam nhiều lần
      const uniqueExamIds = [...new Set(assignmentsList.map(a => a.examId))];

      // Load tất cả exam details song song
      const examResults = await Promise.all(
        uniqueExamIds.map(examId => getExamById(examId))
      );
      const examDetails = {};
      uniqueExamIds.forEach((examId, i) => {
        const res = examResults[i];
        if (res.success) {
          examDetails[examId] = res.exam;
        } else {
          const fallback = assignmentsList.find(a => a.examId === examId);
          examDetails[examId] = {
            title: fallback?.examTitle || 'Đề thi đã bị xóa',
            type: fallback?.examType || 'upload',
            deleted: true,
          };
        }
      });
      setExams(examDetails);

      // Lazy stream submission counts — cập nhật từng cái khi có kết quả
      assignmentsList.forEach(assignment => {
        getSubmissionCount(assignment.id).then(count => {
          setSubmissionCounts(prev => ({ ...prev, [assignment.id]: count }));
        });
      });
    } else {
      setLoading(false);
    }
  };

  const getSubmissionCount = async (assignmentId) => {
    try {
      const submissionsRef = collection(db, 'examSubmissions');
      const q = query(
        submissionsRef,
        where('assignmentId', '==', assignmentId)
      );
      const snapshot = await getDocs(q);
      const uniqueStudents = new Set();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'in_progress') {
          uniqueStudents.add(data.studentUid);
        }
      });
      return uniqueStudents.size;
    } catch (error) {
      console.error('Error getting submission count:', error);
      return 0;
    }
  };

  const handleViewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    setFilterStatus('submitted');
    setLoadingSubmissions(true);

    // Load student name map for this class
    const classStudentsResult = await getClassStudents(assignment.classId);
    if (classStudentsResult.success) {
      setClassStudents(classStudentsResult.students);
      const map = {};
      classStudentsResult.students.forEach(s => { map[s.uid] = s.fullName; });
      setStudentNameMap(map);
    } else {
      setClassStudents([]);
    }

    try {
      const submissionsRef = collection(db, 'examSubmissions');
      const q = query(
        submissionsRef,
        where('assignmentId', '==', assignment.id)
      );
      const snapshot = await getDocs(q);

      const allSubmissions = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(sub => sub.status !== 'in_progress');

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

  const handleConvertToPoints = async () => {
    if (!submissions || submissions.length === 0) {
      setToast({ type: 'warning', message: 'Không có bài nộp nào để quy đổi' });
      return;
    }

    const examType = exams[selectedAssignment?.examId]?.type;
    const unconvertedSubmissions = submissions.filter(s => {
      if (s.convertedToPoints) return false;
      const score = examType === 'upload' ? (s.totalScore || 0) : ((s.totalScore / (s.maxScore || 1)) * 10);
      return score > 0;
    });

    if (unconvertedSubmissions.length === 0) {
      setToast({ type: 'info', message: 'Tất cả bài nộp có điểm đã được quy đổi' });
      return;
    }

    setIsConverting(true);
    let successCount = 0;
    const updatePromises = [];

    try {
      for (const submission of unconvertedSubmissions) {
        // Prepare score logic
        const score = examType === 'upload' ? (submission.totalScore || 0) : ((submission.totalScore / (submission.maxScore || 1)) * 10);
        const pointsToAdd = Math.floor(score * 2);

        if (pointsToAdd > 0) {
          // Update user accumulative points
          const userRef = doc(db, 'users', submission.studentUid);
          updatePromises.push(updateDoc(userRef, {
            totalBehaviorPoints: increment(pointsToAdd)
          }));

          // Mark submission as converted
          const submissionRef = doc(db, 'examSubmissions', submission.id);
          updatePromises.push(updateDoc(submissionRef, {
            convertedToPoints: true
          }));

          successCount++;
        }
      }

      await Promise.all(updatePromises);

      // Update local state
      setSubmissions(prev => prev.map(s => {
        if (unconvertedSubmissions.find(us => us.id === s.id)) {
          return { ...s, convertedToPoints: true };
        }
        return s;
      }));

      setToast({ type: 'success', message: `Đã quy đổi điểm cho ${successCount} học sinh` });
    } catch (error) {
      console.error('Error converting to points:', error);
      setToast({ type: 'error', message: 'Lỗi khi quy đổi điểm sang điểm tích luỹ' });
    } finally {
      setIsConverting(false);
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

  // View submissions detail
  if (selectedAssignment) {
    const exam = exams[selectedAssignment.examId];
    const cls = classes[selectedAssignment.classId];

    // Filter submissions
    const submittedUids = new Set(submissions.map(s => s.studentUid));
    const notSubmittedList = classStudents
      .filter(s => !submittedUids.has(s.uid))
      .map(s => ({
        isNotSubmitted: true,
        studentUid: s.uid,
        studentName: s.fullName || 'Học sinh chưa có tên',
        id: `unsubmitted-${s.uid}`
      }));

    let displayedList = submissions;
    if (filterStatus === 'not_submitted') {
      displayedList = notSubmittedList;
    } else if (filterStatus === 'all') {
      displayedList = [...submissions, ...notSubmittedList];
    }

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
          <button
            onClick={handleConvertToPoints}
            disabled={isConverting}
            className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-xl font-bold hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting ? (
              <div className="w-5 h-5 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Icon name="generating_tokens" />
            )}
            Quy đổi sang điểm tích lũy
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setFilterStatus('all')}
            className={`clay-card p-4 cursor-pointer transition-all ${filterStatus === 'all' ? 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10' : 'hover:-translate-y-1 hover:shadow-lg'}`}
          >
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Tổng HS</p>
            <p className="text-2xl font-bold text-[#111812] dark:text-white">
              {classStudents.length || cls?.studentCount || 0}
            </p>
          </div>
          <div
            onClick={() => setFilterStatus('submitted')}
            className={`clay-card p-4 cursor-pointer transition-all ${filterStatus === 'submitted' ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/10' : 'hover:-translate-y-1 hover:shadow-lg'}`}
          >
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Đã nộp</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {submissions.length}
            </p>
          </div>
          <div
            onClick={() => setFilterStatus('not_submitted')}
            className={`clay-card p-4 cursor-pointer transition-all ${filterStatus === 'not_submitted' ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : 'hover:-translate-y-1 hover:shadow-lg'}`}
          >
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Chưa nộp</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {Math.max(0, (classStudents.length || cls?.studentCount || 0) - submissions.length)}
            </p>
          </div>
        </div>

        {/* Submissions List */}
        {loadingSubmissions ? (
          <div className="text-center py-12">
            <p className="text-[#608a67] dark:text-[#8ba890]">Đang tải dữ liệu...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="clay-card p-12 text-center">
            <Icon name="pending_actions" className="text-6xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Chưa có dữ liệu
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              {filterStatus === 'submitted'
                ? 'Chưa có học sinh nào nộp bài'
                : 'Không có học sinh nào trong danh sách này'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedList.map((submission) => (
              <div key={submission.id} className="clay-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-[#111812] dark:text-white mb-1">
                      {studentNameMap[submission.studentUid] || submission.studentName}
                    </h3>

                    {submission.isNotSubmitted ? (
                      <div className="flex items-center gap-3 text-sm text-[#608a67] dark:text-[#8ba890]">
                        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                          <Icon name="cancel" className="text-xs" />
                          Chưa nộp bài
                        </span>
                      </div>
                    ) : (
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
                        {/* Hiển thị trạng thái đã quy đổi */}
                        {submission.convertedToPoints && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            Đã quy đổi
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!submission.isNotSubmitted && (
                    <>
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
                          onClick={() => {
                            const uploadSubmissions = submissions.filter(() => true); // all submissions in this view
                            const currentIndex = uploadSubmissions.findIndex(s => s.id === submission.id);
                            navigate(`/admin/grade-submissions/${submission.id}`, {
                              state: {
                                submissionsList: uploadSubmissions.map(s => s.id),
                                currentIndex,
                                assignmentId: selectedAssignment.id,
                                className: cls?.name,
                                examTitle: exam?.title,
                              }
                            });
                          }}
                          className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1"
                        >
                          <Icon name="grading" className="text-sm" />
                          Chấm
                        </button>
                      )}
                    </>
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
            Chấm bài
          </h1>
          <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
            Danh sách bài đã giao và bài nộp của học sinh
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/grade-stats')}
          className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all flex items-center gap-2"
        >
          <Icon name="bar_chart" />
          Thống kê điểm
        </button>
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
