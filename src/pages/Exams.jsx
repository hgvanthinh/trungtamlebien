import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAssignmentsForStudent } from '../services/assignmentService';
import { getExamById, getStudentSubmissions } from '../services/examBankService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import { useNavigate } from 'react-router-dom';

const Exams = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available'); // available, completed

  useEffect(() => {
    loadData();
  }, [userProfile]);

  const loadData = async () => {
    if (!userProfile?.classes || userProfile.classes.length === 0 || !currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Load assignments for student's classes
    const assignmentsResult = await getAssignmentsForStudent(userProfile.classes);
    if (assignmentsResult.success) {
      setAssignments(assignmentsResult.assignments);

      // Load exam details for each assignment
      const examDetails = {};
      for (const assignment of assignmentsResult.assignments) {
        const examResult = await getExamById(assignment.examId);
        if (examResult.success) {
          examDetails[assignment.examId] = examResult.exam;
        }
      }
      setExams(examDetails);
    }

    // Load student submissions
    if (currentUser?.uid) {
      const submissionsResult = await getStudentSubmissions(currentUser.uid);
      if (submissionsResult.success) {
        setSubmissions(submissionsResult.submissions);
      }
    }

    setLoading(false);
  };

  const hasSubmittedAssignment = (assignmentId) => {
    return submissions.some((s) => s.assignmentId === assignmentId);
  };

  // Lấy submission MỚI NHẤT cho assignment (điểm tính theo lần làm cuối)
  const getSubmissionForAssignment = (assignmentId) => {
    const subs = submissions.filter(
      (s) => s.assignmentId === assignmentId && s.status !== 'in_progress'
    );
    if (subs.length === 0) return undefined;
    // Sắp xếp theo submittedAt giảm dần, lấy cái đầu tiên
    return subs.sort((a, b) => {
      const aTime = a.submittedAt?.seconds ?? 0;
      const bTime = b.submittedAt?.seconds ?? 0;
      return bTime - aTime;
    })[0];
  };

  // Đếm số lần đã làm của một assignment
  const getAttemptCount = (assignmentId) => {
    return submissions.filter((s) => s.assignmentId === assignmentId && s.status !== 'in_progress').length;
  };

  // Filter valid assignments (exam exists and not expired)
  const isValidAssignment = (assignment) => {
    const exam = exams[assignment.examId];
    if (!exam) return false; // Exam deleted

    // Check if deadline passed
    if (assignment.deadline) {
      const deadline = assignment.deadline.toDate();
      const now = new Date();
      if (deadline < now) return false; // Expired
    }

    return true;
  };

  const availableAssignments = assignments.filter((a) =>
    !hasSubmittedAssignment(a.id) && isValidAssignment(a)
  );
  const completedAssignments = assignments.filter((a) => {
    // Only show completed assignments if exam still exists
    const exam = exams[a.examId];
    return hasSubmittedAssignment(a.id) && exam;
  });

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
      <div>
        <h1 className="text-3xl font-bold text-[#111812] dark:text-white">Đề thi</h1>
        <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
          Danh sách bài thi được giao
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-6 py-3 rounded-xl font-bold transition ${activeTab === 'available'
            ? 'bg-primary text-[#052e16]'
            : 'bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
        >
          <Icon name="pending_actions" className="inline mr-2" />
          Chưa làm ({availableAssignments.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-6 py-3 rounded-xl font-bold transition ${activeTab === 'completed'
            ? 'bg-primary text-[#052e16]'
            : 'bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
        >
          <Icon name="check_circle" className="inline mr-2" />
          Đã làm ({completedAssignments.length})
        </button>
      </div>

      {/* Assignments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'available' ? (
          availableAssignments.length === 0 ? (
            <div className="col-span-full clay-card p-12 text-center">
              <Icon name="check_circle" className="text-6xl text-green-500 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                Hoàn thành!
              </h3>
              <p className="text-[#608a67] dark:text-[#8ba890]">
                Bạn đã hoàn thành tất cả bài thi được giao
              </p>
            </div>
          ) : (
            availableAssignments.map((assignment) => {
              const exam = exams[assignment.examId];
              if (!exam) return null;

              const deadline = assignment.deadline?.toDate();
              const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : 0;

              return (
                <Card key={assignment.id} className="hover:shadow-lg transition">
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`p-2 rounded-lg ${exam.type === 'upload'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                        <Icon
                          name={exam.type === 'upload' ? 'picture_as_pdf' : 'edit_note'}
                          className={exam.type === 'upload' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#111812] dark:text-white mb-1 line-clamp-2">
                          {exam.title}
                        </h3>
                      </div>
                    </div>

                    {/* Stats */}
                    {exam.type === 'manual' && (
                      <div className="flex gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Icon name="quiz" className="text-primary" />
                          <span className="font-bold">{exam.totalQuestions}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="star" className="text-yellow-500" />
                          <span className="font-bold">{exam.totalPoints}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="schedule" className="text-blue-500" />
                          <span className="font-bold">{exam.duration}p</span>
                        </div>
                      </div>
                    )}

                    {/* Deadline */}
                    <div className={`mb-3 p-2 rounded-lg text-xs ${daysLeft <= 1
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : daysLeft <= 3
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}>
                      <Icon name="event" className="inline mr-1" />
                      Hạn: {deadline?.toLocaleDateString('vi-VN')} lúc {deadline?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      {daysLeft > 0 && ` (còn ${daysLeft} ngày)`}
                      {daysLeft === 0 && ' (hôm nay)'}
                    </div>

                    {/* Action */}
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/exam/${exam.id}?assignmentId=${assignment.id}`)}
                      className="w-full"
                    >
                      {exam.type === 'upload' ? 'Xem đề' : 'Bắt đầu làm bài'}
                    </Button>
                  </div>
                </Card>
              );
            })
          )
        ) : completedAssignments.length === 0 ? (
          <div className="col-span-full clay-card p-12 text-center">
            <Icon name="pending_actions" className="text-6xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Chưa có bài nào
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Bạn chưa hoàn thành bài thi nào
            </p>
          </div>
        ) : (
          completedAssignments.map((assignment) => {
            const exam = exams[assignment.examId];
            const submission = getSubmissionForAssignment(assignment.id);
            if (!exam || !submission) return null;

            return (
              <Card key={assignment.id} className="hover:shadow-lg transition">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#111812] dark:text-white mb-2 line-clamp-2">
                        {exam.title}
                      </h3>
                      {/* Chỉ hiển thị trạng thái cho bài tự luận */}
                      {exam.type === 'upload' && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${submission.status === 'graded'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                            }`}
                        >
                          {submission.status === 'graded' ? (
                            <>
                              <Icon name="check_circle" className="text-xs" />
                              Đã chấm
                            </>
                          ) : (
                            <>
                              <Icon name="pending" className="text-xs" />
                              Chờ chấm
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {submission.totalScore || 0}/{submission.maxScore}
                      </p>
                      <p className="text-xs text-[#608a67] dark:text-[#8ba890]">điểm</p>
                    </div>
                  </div>

                  {/* Submitted date + số lần làm */}
                  <div className="text-xs text-[#608a67] dark:text-[#8ba890] mb-3 flex items-center justify-between">
                    <span>
                      <Icon name="schedule" className="inline mr-1" />
                      Nộp: {submission.submittedAt ? new Date(submission.submittedAt.seconds * 1000).toLocaleDateString('vi-VN') : 'N/A'}
                    </span>
                    {getAttemptCount(assignment.id) > 1 && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                        Lần {getAttemptCount(assignment.id)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/exam/${exam.id}/result/${submission.id}`)}
                      className="flex-1"
                    >
                      <Icon name="visibility" className="inline mr-1" />
                      Xem kết quả
                    </Button>
                    {/* Nút Làm lại - chỉ hiện nếu bài chưa hết hạn */}
                    {isValidAssignment(assignment) && (
                      <Button
                        variant="primary"
                        onClick={() => navigate(`/exam/${exam.id}?assignmentId=${assignment.id}`)}
                        className="flex-1"
                      >
                        <Icon name="replay" className="inline mr-1" />
                        Làm lại
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Exams;
