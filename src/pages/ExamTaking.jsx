import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getExamById,
  getExamQuestions,
  createSubmission,
  saveAnswer,
  submitExam,
  submitUploadExam,
  submitMultipleChoiceExam,
  submitMixedExam,
} from '../services/examBankService';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import Toast from '../components/common/Toast';
import MathInput from '../components/exam/MathInput';
import MathDisplay from '../components/exam/MathDisplay';
import StudentSubmissionUpload from '../components/exam/StudentSubmissionUpload';

const ExamTaking = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submissionId, setSubmissionId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [mcAnswers, setMcAnswers] = useState({}); // Đáp án trắc nghiệm mới

  // Mixed exam answers
  const [mixedAnswers, setMixedAnswers] = useState({
    abcd: {},
    trueFalse: {},
    shortAnswer: {}
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    loadExam();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [examId]);

  const loadExam = async () => {
    setLoading(true);

    // Load exam
    const examResult = await getExamById(examId);
    if (!examResult.success) {
      alert(examResult.error);
      navigate('/exams');
      return;
    }

    const examData = examResult.exam;
    setExam(examData);

    // Upload type hoặc multiple_choice - just show PDF/image
    if (examData.type === 'upload' || examData.type === 'multiple_choice') {
      setLoading(false);
      return;
    }

    // Manual type - load questions
    const questionsResult = await getExamQuestions(examId);
    if (!questionsResult.success) {
      alert(questionsResult.error);
      navigate('/exams');
      return;
    }

    setQuestions(questionsResult.questions);

    // Create submission
    const submissionResult = await createSubmission(
      examId,
      currentUser.uid,
      userProfile.fullName,
      userProfile.classes[0], // Use first class
      assignmentId // Thêm assignmentId
    );

    if (!submissionResult.success) {
      alert(submissionResult.error);
      navigate('/exams');
      return;
    }

    setSubmissionId(submissionResult.submissionId);

    // Start timer
    setTimeLeft(examData.duration * 60); // Convert to seconds
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setLoading(false);
  };

  const handleAnswerChange = async (questionId, answer) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    // Auto-save
    if (submissionId) {
      await saveAnswer(submissionId, questionId, answer);
    }
  };

  const handleSubmit = async () => {
    if (!submissionId) return;

    if (!confirm('Bạn có chắc muốn nộp bài?')) return;

    setSubmitting(true);

    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const result = await submitExam(submissionId, duration);

    if (result.success) {
      setToast({
        message: `Đã nộp bài! Điểm: ${result.autoGradedScore}/${result.maxScore}`,
        type: 'success'
      });
      setTimeout(() => navigate('/exams'), 1500);
    } else {
      setToast({
        message: result.error,
        type: 'error'
      });
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Đang tải đề thi...</p>
      </div>
    );
  }

  // Handle upload submission complete
  const handleUploadComplete = async (fileData) => {
    try {
      const result = await submitUploadExam(
        examId,
        currentUser.uid,
        userProfile.fullName,
        userProfile.classes[0], // Use first class
        fileData,
        assignmentId // Thêm assignmentId
      );

      if (result.success) {
        setToast({
          message: `Nộp bài thành công! Đã giảm ${fileData.compressionRatio}% dung lượng.`,
          type: 'success'
        });
        setTimeout(() => {
          setShowUploadModal(false);
          navigate('/exams');
        }, 1500);
      } else {
        setToast({
          message: 'Lỗi: ' + result.error,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Lỗi khi nộp bài: ' + error.message);
    }
  };

  // Handle multiple choice submission
  const handleMcAnswerChange = (questionNum, answer) => {
    setMcAnswers(prev => ({
      ...prev,
      [questionNum]: answer
    }));
  };

  const handleMcSubmit = async () => {
    const answeredCount = Object.keys(mcAnswers).length;
    const totalQuestions = exam.totalQuestions || 0;

    if (answeredCount < totalQuestions) {
      if (!confirm(`Bạn mới trả lời ${answeredCount}/${totalQuestions} câu. Bạn có chắc muốn nộp bài?`)) {
        return;
      }
    } else {
      if (!confirm('Bạn có chắc muốn nộp bài?')) {
        return;
      }
    }

    setSubmitting(true);

    const result = await submitMultipleChoiceExam(
      examId,
      currentUser.uid,
      userProfile.fullName,
      userProfile.classes?.[0] || '',
      mcAnswers,
      assignmentId
    );

    if (result.success) {
      setToast({
        message: `Nộp bài thành công! Điểm: ${result.correctCount}/${result.totalQuestions} câu đúng`,
        type: 'success'
      });
      setTimeout(() => navigate('/exams'), 2000);
    } else {
      setToast({
        message: 'Lỗi: ' + result.error,
        type: 'error'
      });
      setSubmitting(false);
    }
  };

  // Multiple choice type - show file + answer form
  if (exam.type === 'multiple_choice') {
    const totalQuestions = exam.totalQuestions || 0;
    const answeredCount = Object.keys(mcAnswers).length;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{exam.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {answeredCount}/{totalQuestions} câu đã trả lời
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/exams')}
            >
              <Icon name="arrow_back" className="mr-2" />
              Quay lại
            </Button>
            <Button
              variant="primary"
              onClick={handleMcSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Đang nộp...
                </>
              ) : (
                <>
                  <Icon name="send" className="mr-2" />
                  Nộp bài
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden pb-24">
          {/* Exam File View */}
          <div className="clay-input p-3 rounded-2xl mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="description" className="text-primary text-lg" />
              <h2 className="font-semibold text-sm">Đề thi</h2>
            </div>
            {exam.fileType === 'pdf' ? (
              <div className="space-y-3">
                <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                  <object
                    data={exam.fileUrl}
                    type="application/pdf"
                    className="w-full h-[50vh]"
                    aria-label="PDF Viewer"
                  >
                    <div className="p-6 text-center">
                      <Icon name="picture_as_pdf" className="text-6xl text-red-500 mb-4" />
                      <p className="text-sm font-medium mb-3">Trình duyệt không hỗ trợ xem PDF trực tiếp</p>
                      <a
                        href={exam.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl font-medium"
                      >
                        <Icon name="open_in_new" />
                        Mở PDF trong tab mới
                      </a>
                    </div>
                  </object>
                </div>
                <a
                  href={exam.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-medium"
                >
                  <Icon name="fullscreen" />
                  Mở toàn màn hình
                </a>
              </div>
            ) : (
              <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
            )}
          </div>

          {/* Answer Form */}
          <div className="clay-input p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="edit_note" className="text-primary text-lg" />
              <h2 className="font-semibold">Phiếu trả lời</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => (
                <div key={num} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="font-medium text-sm w-8">Câu {num}:</span>
                  <div className="flex gap-1 flex-1">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleMcAnswerChange(num, option)}
                        className={`flex-1 py-1.5 text-sm font-medium rounded transition-all ${mcAnswers[num] === option
                            ? 'bg-primary text-white'
                            : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                          }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Submit Button */}
          <button
            onClick={handleMcSubmit}
            disabled={submitting}
            className="fixed bottom-6 right-6 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-2xl flex items-center gap-2 z-40 active:scale-95 transition-transform disabled:opacity-50"
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <Icon name="send" className="text-xl" />
            )}
            <span className="font-bold">Nộp bài</span>
          </button>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {/* Left: Exam File */}
          <div className="lg:col-span-2">
            <div className="clay-input p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="description" className="text-primary" />
                <h2 className="font-semibold">Đề thi</h2>
              </div>
              {exam.fileType === 'pdf' ? (
                <iframe
                  src={exam.fileUrl}
                  className="w-full h-[80vh] rounded-xl"
                  title={exam.title}
                />
              ) : (
                <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
              )}
            </div>
          </div>

          {/* Right: Answer Form */}
          <div className="lg:col-span-1">
            <div className="clay-input p-6 rounded-2xl sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="edit_note" className="text-primary" />
                  <h2 className="font-semibold">Phiếu trả lời</h2>
                </div>
                <span className="text-sm text-gray-500">
                  {answeredCount}/{totalQuestions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Answer grid */}
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-sm w-12">Câu {num}:</span>
                    <div className="flex gap-1 flex-1">
                      {['A', 'B', 'C', 'D'].map((option) => (
                        <button
                          key={option}
                          onClick={() => handleMcAnswerChange(num, option)}
                          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mcAnswers[num] === option
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                            }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit button */}
              <button
                onClick={handleMcSubmit}
                disabled={submitting}
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Đang nộp...
                  </>
                ) : (
                  <>
                    <Icon name="send" />
                    Nộp bài ({answeredCount}/{totalQuestions})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

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
  }

  // Mixed exam type - show file + 3-section answer form
  if (exam.type === 'mixed_exam') {
    const questionTypes = exam.questionTypes || {};
    const totalQuestions = exam.totalQuestions || 0;

    // Calculate answered count
    const answeredCount =
      Object.keys(mixedAnswers.abcd).length +
      Object.keys(mixedAnswers.trueFalse).length +
      Object.keys(mixedAnswers.shortAnswer).filter(k => mixedAnswers.shortAnswer[k]?.trim()).length;

    const handleMixedAbcdChange = (num, option) => {
      setMixedAnswers({
        ...mixedAnswers,
        abcd: { ...mixedAnswers.abcd, [num]: option }
      });
    };

    const handleMixedTrueFalseChange = (questionNum, subItem, value) => {
      setMixedAnswers({
        ...mixedAnswers,
        trueFalse: {
          ...mixedAnswers.trueFalse,
          [questionNum]: {
            ...(mixedAnswers.trueFalse[questionNum] || {}),
            [subItem]: value
          }
        }
      });
    };

    const handleMixedShortAnswerChange = (num, text) => {
      setMixedAnswers({
        ...mixedAnswers,
        shortAnswer: { ...mixedAnswers.shortAnswer, [num]: text }
      });
    };

    const handleMixedSubmit = async () => {
      setSubmitting(true);

      const result = await submitMixedExam(examId, mixedAnswers, {
        studentUid: currentUser.uid,
        studentName: userProfile?.displayName || currentUser.email,
        classId: userProfile?.classId || '',
        assignmentId: assignmentId
      });

      if (result.success) {
        setToast({ type: 'success', message: 'Nộp bài thành công!' });
        setTimeout(() => {
          navigate(`/exam-result/${result.submissionId}`);
        }, 1500);
      } else {
        setToast({ type: 'error', message: 'Lỗi: ' + result.error });
      }
      setSubmitting(false);
    };

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{exam.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {answeredCount}/{totalQuestions} câu đã trả lời
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/exams')}>
              <Icon name="arrow_back" className="mr-2" />
              Quay lại
            </Button>
            <Button variant="primary" onClick={handleMixedSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Đang nộp...
                </>
              ) : (
                <>
                  <Icon name="send" className="mr-2" />
                  Nộp bài
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Exam File */}
          <div className="lg:col-span-2">
            <div className="clay-input p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="description" className="text-primary" />
                <h2 className="font-semibold">Đề thi</h2>
              </div>
              {exam.fileType === 'pdf' ? (
                <iframe
                  src={exam.fileUrl}
                  className="w-full h-[80vh] rounded-xl"
                  title={exam.title}
                />
              ) : (
                <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
              )}
            </div>
          </div>

          {/* Right: Answer Form - 3 Sections */}
          <div className="lg:col-span-1">
            <div className="clay-input p-6 rounded-2xl sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="edit_note" className="text-primary" />
                  <h2 className="font-semibold">Phiếu trả lời</h2>
                </div>
                <span className="text-sm text-gray-500">
                  {answeredCount}/{totalQuestions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Answer sections */}
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Section 1: ABCD Multiple Choice */}
                {questionTypes.abcd?.enabled && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Icon name="check_circle" className="text-sm" />
                      PHẦN I: TRẮC NGHIỆM (Câu 1-{questionTypes.abcd.count})
                    </h3>
                    {Array.from({ length: questionTypes.abcd.count }, (_, i) => i + 1).map((num) => (
                      <div key={num} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="font-medium text-xs w-12">Câu {num}:</span>
                        <div className="flex gap-1 flex-1">
                          {['A', 'B', 'C', 'D'].map((option) => (
                            <button
                              key={option}
                              onClick={() => handleMixedAbcdChange(num, option)}
                              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${mixedAnswers.abcd[num] === option
                                  ? 'bg-blue-500 text-white shadow-md'
                                  : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                                }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section 2: True/False */}
                {questionTypes.trueFalse?.enabled && (
                  <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Icon name="toggle_on" className="text-sm" />
                      PHẦN II: ĐÚNG/SAI
                    </h3>
                    {Array.from({ length: questionTypes.trueFalse.count }, (_, i) => i + 1).map((num) => (
                      <div key={num} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                        <span className="font-medium text-xs block">Câu {num}:</span>
                        <div className="grid grid-cols-4 gap-1">
                          {['a', 'b', 'c', 'd'].map((subItem) => {
                            const isTrue = mixedAnswers.trueFalse[num]?.[subItem] === true;
                            return (
                              <button
                                key={subItem}
                                onClick={() => handleMixedTrueFalseChange(num, subItem, !isTrue)}
                                className={`py-1.5 text-xs font-medium rounded transition-all ${isTrue
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                                  }`}
                              >
                                {subItem.toUpperCase()}
                                <div className="text-[10px]">{isTrue ? 'Đ' : 'S'}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section 3: Short Answer */}
                {questionTypes.shortAnswer?.enabled && (
                  <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Icon name="edit" className="text-sm" />
                      PHẦN III: TRẢ LỜI NGẮN
                    </h3>
                    {Array.from({ length: questionTypes.shortAnswer.count }, (_, i) => i + 1).map((num) => (
                      <div key={num} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="font-medium text-xs block mb-1">Câu {num}:</label>
                        <input
                          type="text"
                          value={mixedAnswers.shortAnswer[num] || ''}
                          onChange={(e) => handleMixedShortAnswerChange(num, e.target.value)}
                          placeholder="Nhập đáp án..."
                          className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={handleMixedSubmit}
                disabled={submitting}
                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Đang nộp...
                  </>
                ) : (
                  <>
                    <Icon name="send" />
                    Nộp bài ({answeredCount}/{totalQuestions})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

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
  }

  // Upload type - show PDF/image + submission form
  if (exam.type === 'upload') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">{exam.title}</h1>
          <Button
            variant="secondary"
            onClick={() => navigate('/exams')}
            className="sm:w-auto w-full"
          >
            <Icon name="arrow_back" className="mr-2" />
            Quay lại
          </Button>
        </div>

        {/* Description */}
        {exam.description && (
          <div className="mb-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">{exam.description}</p>
          </div>
        )}

        {/* Mobile: PDF View + Floating Button */}
        <div className="lg:hidden pb-20">
          {/* PDF/Image Viewer - Full Width */}
          <div className="clay-input p-3 rounded-2xl mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="description" className="text-primary text-lg" />
              <h2 className="font-semibold text-sm">Đề thi</h2>
            </div>
            {exam.fileType === 'pdf' ? (
              <div className="space-y-3">
                {/* PDF Viewer - Using object tag for better mobile support */}
                <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                  <object
                    data={exam.fileUrl}
                    type="application/pdf"
                    className="w-full h-[70vh]"
                    aria-label="PDF Viewer"
                  >
                    {/* Fallback for browsers that don't support PDF viewing */}
                    <div className="p-6 text-center">
                      <Icon name="picture_as_pdf" className="text-6xl text-red-500 mb-4" />
                      <p className="text-sm font-medium mb-3">Trình duyệt không hỗ trợ xem PDF trực tiếp</p>
                      <a
                        href={exam.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition"
                      >
                        <Icon name="open_in_new" />
                        Mở PDF trong tab mới
                      </a>
                    </div>
                  </object>
                </div>

                {/* Quick Link - Always show for convenience */}
                <a
                  href={exam.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                >
                  <Icon name="fullscreen" />
                  Mở toàn màn hình
                </a>
              </div>
            ) : (
              <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
            )}
          </div>

          {/* Floating Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-transform"
          >
            <Icon name="upload" className="text-3xl" />
          </button>

          {/* Upload Modal - Fullscreen on Mobile */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
              <div className="bg-white dark:bg-gray-900 w-full max-h-[90vh] overflow-y-auto rounded-t-3xl shadow-2xl animate-slide-up">
                <div className="p-4">
                  <StudentSubmissionUpload
                    examId={examId}
                    studentUid={currentUser?.uid}
                    onUploadComplete={handleUploadComplete}
                    onCancel={() => setShowUploadModal(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Side-by-Side Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {/* Left: Exam View (PDF/Image) */}
          <div className="lg:col-span-2">
            <div className="clay-input p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="description" className="text-primary" />
                <h2 className="font-semibold">Đề thi</h2>
              </div>
              {exam.fileType === 'pdf' ? (
                <iframe
                  src={exam.fileUrl}
                  className="w-full h-[80vh] rounded-xl"
                  title={exam.title}
                />
              ) : (
                <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
              )}
            </div>
          </div>

          {/* Right: Submission Form */}
          <div className="lg:col-span-1">
            <div className="clay-input p-6 rounded-2xl sticky top-4">
              <StudentSubmissionUpload
                examId={examId}
                studentUid={currentUser?.uid}
                onUploadComplete={handleUploadComplete}
                onCancel={() => navigate('/exams')}
              />
            </div>
          </div>
        </div>

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
  }

  // Manual type - interactive exam
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{exam.title}</h1>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div
            className={`px-4 py-2 rounded-xl font-mono text-lg font-bold ${timeLeft < 300
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'clay-input'
              }`}
          >
            <Icon name="schedule" className="inline mr-2" />
            {formatTime(timeLeft)}
          </div>

          {/* Submit Button */}
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            Nộp bài
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6 clay-input p-4 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">
            Câu {currentQuestionIndex + 1}/{questions.length}
          </span>
          <span className="text-sm text-gray-500">
            {Object.keys(answers).length}/{questions.length} câu đã trả lời
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="clay-input p-6 rounded-2xl mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Câu {currentQuestionIndex + 1}</h2>
          <span className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium">
            {currentQuestion.points} điểm
          </span>
        </div>

        {/* Question Text */}
        <div className="mb-6 text-lg">
          {currentQuestion.questionLatex ? (
            <MathDisplay latex={currentQuestion.questionLatex} />
          ) : (
            <p>{currentQuestion.questionText}</p>
          )}
        </div>

        {/* Answer Input */}
        <div className="space-y-3">
          {currentQuestion.type === 'multiple_choice' &&
            currentQuestion.options.map((option) => (
              <label
                key={option.label}
                className="flex items-start gap-3 clay-input p-4 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  checked={answers[currentQuestion.id]?.selected === option.label}
                  onChange={() =>
                    handleAnswerChange(currentQuestion.id, { selected: option.label })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <span className="font-semibold mr-2">{option.label}.</span>
                  {option.latex ? (
                    <MathDisplay latex={option.latex} />
                  ) : (
                    <span>{option.text}</span>
                  )}
                </div>
              </label>
            ))}

          {currentQuestion.type === 'true_false' && (
            <div className="flex gap-4">
              <label className="flex-1 flex items-center gap-3 clay-input p-4 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  checked={answers[currentQuestion.id]?.selected === true}
                  onChange={() => handleAnswerChange(currentQuestion.id, { selected: true })}
                />
                <span className="font-medium">Đúng</span>
              </label>
              <label className="flex-1 flex items-center gap-3 clay-input p-4 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  checked={answers[currentQuestion.id]?.selected === false}
                  onChange={() => handleAnswerChange(currentQuestion.id, { selected: false })}
                />
                <span className="font-medium">Sai</span>
              </label>
            </div>
          )}

          {currentQuestion.type === 'short_answer' && (
            <div>
              {currentQuestion.acceptLatex ? (
                <MathInput
                  value={answers[currentQuestion.id]?.latex || ''}
                  onChange={(latex) =>
                    handleAnswerChange(currentQuestion.id, {
                      ...answers[currentQuestion.id],
                      latex,
                    })
                  }
                  placeholder="Nhập đáp án (có thể dùng công thức)..."
                />
              ) : (
                <input
                  type="text"
                  value={answers[currentQuestion.id]?.text || ''}
                  onChange={(e) =>
                    handleAnswerChange(currentQuestion.id, { text: e.target.value })
                  }
                  placeholder="Nhập đáp án..."
                  className="clay-input w-full px-4 py-3 rounded-xl"
                />
              )}
            </div>
          )}

          {currentQuestion.type === 'essay' && (
            <div>
              <textarea
                value={answers[currentQuestion.id]?.text || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, { text: e.target.value })}
                placeholder="Nhập câu trả lời..."
                rows={8}
                className="clay-input w-full px-4 py-3 rounded-xl"
                maxLength={
                  currentQuestion.maxWords > 0 ? currentQuestion.maxWords : undefined
                }
              />
              {currentQuestion.maxWords > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {answers[currentQuestion.id]?.text?.length || 0}/{currentQuestion.maxWords} ký tự
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mb-6">
        <Button
          variant="secondary"
          onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
          disabled={currentQuestionIndex === 0}
        >
          <Icon name="arrow_back" className="mr-2" />
          Câu trước
        </Button>

        <Button
          variant="secondary"
          onClick={() =>
            setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))
          }
          disabled={currentQuestionIndex === questions.length - 1}
        >
          Câu sau
          <Icon name="arrow_forward" className="ml-2" />
        </Button>
      </div>

      {/* Question Grid */}
      <div className="clay-input p-4 rounded-xl">
        <p className="text-sm font-medium mb-3">Danh sách câu hỏi:</p>
        <div className="grid grid-cols-10 gap-2">
          {questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`aspect-square rounded-lg font-medium text-sm transition ${index === currentQuestionIndex
                ? 'bg-primary text-white'
                : answers[q.id]
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-gray-200 dark:bg-gray-700'
                }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

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

export default ExamTaking;
