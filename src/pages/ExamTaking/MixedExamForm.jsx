import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import PdfViewerWrapper from './PdfViewerWrapper';

const MixedExamForm = ({
  exam,
  answeredCount,
  totalQuestions,
  mixedAnswers,
  submitting,
  handleMixedAbcdChange,
  handleMixedTrueFalseChange,
  handleMixedShortAnswerChange,
  handleMixedSubmit
}) => {
  const navigate = useNavigate();
  const questionTypes = exam.questionTypes || {};

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
              <PdfViewerWrapper url={exam.fileUrl} title={exam.title} layout="auto" />
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
                            className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${mixedAnswers?.abcd?.[num] === option
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
                          const isTrue = mixedAnswers?.trueFalse?.[num]?.[subItem] === true;
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
                        value={mixedAnswers?.shortAnswer?.[num] || ''}
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
    </div>
  );
};

export default MixedExamForm;
