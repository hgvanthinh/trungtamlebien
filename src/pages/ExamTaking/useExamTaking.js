import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  getExamById,
  getExamQuestions,
  createSubmission,
  saveAnswer,
  submitExam,
  submitUploadExam,
  submitMultipleChoiceExam,
  submitMixedExam,
} from '../../services/examBankService';

export const useExamTaking = (examId, assignmentId, currentUser, userProfile, navigate) => {
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
  const [isSubmitted, setIsSubmitted] = useState(false); // Track if submission is intentional
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

    // Prevent accidental exit - Browser level
    const handleBeforeUnload = (e) => {
      if (!isSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [examId, isSubmitted]);

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
    if (examData.type === 'upload' || examData.type === 'multiple_choice' || examData.type === 'mixed_exam') {
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

    // If resumed, restore answers
    if (submissionResult.answers) {
      setAnswers(submissionResult.answers);
    }

    // Start timer
    const totalTime = examData.duration * 60;
    const usedTime = submissionResult.duration || 0;
    setTimeLeft(Math.max(0, totalTime - usedTime));

    startTimeRef.current = Date.now() - (usedTime * 1000);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }

        // Cập nhật duration trong Firestore sau mỗi 30s để resume chính xác
        const currentSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (currentSeconds % 30 === 0 && submissionResult.submissionId) {
          updateDoc(doc(db, 'examSubmissions', submissionResult.submissionId), {
            duration: currentSeconds
          });
        }

        return prev - 1;
      });
    }, 1000);

    setLoading(false);
  };

  const handleManualAnswerChange = async (questionId, answer) => {
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

    setIsSubmitted(true);
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

  // Upload Submit
  const handleUploadComplete = async (fileData) => {
    try {
      setIsSubmitted(true);
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

  // MC Submit
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

    setIsSubmitted(true);
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

  // Mixed Submit
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
    if (!confirm('Bạn có chắc muốn nộp bài?')) return;

    setIsSubmitted(true);
    setSubmitting(true);

    const result = await submitMixedExam(examId, mixedAnswers, {
      studentUid: currentUser.uid,
      studentName: userProfile?.fullName || currentUser.email,
      classId: userProfile?.classes?.[0] || '',
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


  return {
    exam,
    loading,
    questions,
    answers,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    timeLeft,
    submitting,
    showUploadModal,
    setShowUploadModal,
    toast,
    setToast,
    mcAnswers,
    mixedAnswers,
    
    // Handlers
    handleManualAnswerChange,
    handleSubmit,
    formatTime,
    handleUploadComplete,
    handleMcAnswerChange,
    handleMcSubmit,
    handleMixedAbcdChange,
    handleMixedTrueFalseChange,
    handleMixedShortAnswerChange,
    handleMixedSubmit,
  };
};
