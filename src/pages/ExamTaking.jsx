import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/common/Toast';

// Subcomponents
import UploadExamForm from './ExamTaking/UploadExamForm';
import MultipleChoiceExamForm from './ExamTaking/MultipleChoiceExamForm';
import MixedExamForm from './ExamTaking/MixedExamForm';
import ManualExamForm from './ExamTaking/ManualExamForm';

// Hook
import { useExamTaking } from './ExamTaking/useExamTaking';

const ExamTaking = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const {
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
  } = useExamTaking(examId, assignmentId, currentUser, userProfile, navigate);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Đang tải đề thi...</p>
      </div>
    );
  }

  // --- Render logic based on exam.type ---

  if (exam.type === 'upload') {
    return (
      <>
        <UploadExamForm
          exam={exam}
          examId={examId}
          currentUser={currentUser}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
          handleUploadComplete={handleUploadComplete}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (exam.type === 'multiple_choice') {
    const totalQuestions = exam.totalQuestions || 0;
    const answeredCount = Object.keys(mcAnswers).length;

    return (
      <>
        <MultipleChoiceExamForm
          exam={exam}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          mcAnswers={mcAnswers}
          submitting={submitting}
          handleMcAnswerChange={handleMcAnswerChange}
          handleMcSubmit={handleMcSubmit}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (exam.type === 'mixed_exam') {
    const totalQuestions = exam.totalQuestions || 0;
    const answeredCount =
      Object.keys(mixedAnswers.abcd).length +
      Object.keys(mixedAnswers.trueFalse).length +
      Object.keys(mixedAnswers.shortAnswer).filter(k => mixedAnswers.shortAnswer[k]?.trim()).length;

    return (
      <>
        <MixedExamForm
          exam={exam}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          mixedAnswers={mixedAnswers}
          submitting={submitting}
          handleMixedAbcdChange={handleMixedAbcdChange}
          handleMixedTrueFalseChange={handleMixedTrueFalseChange}
          handleMixedShortAnswerChange={handleMixedShortAnswerChange}
          handleMixedSubmit={handleMixedSubmit}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // Manual type default
  return (
    <>
      <ManualExamForm
        exam={exam}
        questions={questions}
        currentQuestionIndex={currentQuestionIndex}
        setCurrentQuestionIndex={setCurrentQuestionIndex}
        answers={answers}
        handleAnswerChange={handleManualAnswerChange}
        timeLeft={timeLeft}
        formatTime={formatTime}
        handleSubmit={handleSubmit}
        submitting={submitting}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default ExamTaking;
