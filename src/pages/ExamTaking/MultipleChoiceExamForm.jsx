import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import PdfViewerWrapper from './PdfViewerWrapper';

const MultipleChoiceExamForm = ({
  exam,
  answeredCount,
  totalQuestions,
  mcAnswers,
  submitting,
  handleMcAnswerChange,
  handleMcSubmit
}) => {
  const navigate = useNavigate();

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
            <PdfViewerWrapper url={exam.fileUrl} title={exam.title} layout="mobile" />
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
              <PdfViewerWrapper url={exam.fileUrl} title={exam.title} layout="desktop" />
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
    </div>
  );
};

export default MultipleChoiceExamForm;
