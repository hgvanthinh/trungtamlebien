import React from 'react';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import MathInput from '../../components/exam/MathInput';
import MathDisplay from '../../components/exam/MathDisplay';

const ManualExamForm = ({
  exam,
  questions,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answers,
  handleAnswerChange,
  timeLeft,
  formatTime,
  handleSubmit,
  submitting
}) => {
  if (!questions || questions.length === 0) return null;

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
    </div>
  );
};

export default ManualExamForm;
