import { useState } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import MathInput from './MathInput';

const QuestionEditor = ({ question, onSave, onCancel }) => {
  const [questionData, setQuestionData] = useState({
    type: question?.type || 'multiple_choice',
    questionText: question?.questionText || '',
    questionLatex: question?.questionLatex || '',
    points: question?.points || 1,
    imageUrl: question?.imageUrl || '',
    // Multiple choice
    options: question?.options || [
      { label: 'A', text: '', latex: '' },
      { label: 'B', text: '', latex: '' },
      { label: 'C', text: '', latex: '' },
      { label: 'D', text: '', latex: '' },
    ],
    correctAnswer: question?.correctAnswer || 'A',
    // Short answer
    correctAnswers: question?.correctAnswers || [''],
    caseSensitive: question?.caseSensitive || false,
    acceptLatex: question?.acceptLatex || false,
  });

  const [useMath, setUseMath] = useState(!!question?.questionLatex);
  const [optionUseMath, setOptionUseMath] = useState(
    question?.options?.map(opt => !!opt.latex) || [false, false, false, false]
  );

  const handleSave = () => {
    // Validation
    if (!questionData.questionText.trim() && !questionData.questionLatex) {
      alert('Vui lòng nhập nội dung câu hỏi');
      return;
    }

    if (questionData.points <= 0) {
      alert('Điểm phải lớn hơn 0');
      return;
    }

    // Type-specific validation
    if (questionData.type === 'multiple_choice') {
      const hasEmptyOption = questionData.options.some(
        (opt) => !opt.text.trim() && !opt.latex
      );
      if (hasEmptyOption) {
        alert('Vui lòng điền đầy đủ các phương án');
        return;
      }
    }

    if (questionData.type === 'short_answer') {
      if (!questionData.correctAnswers[0]?.trim()) {
        alert('Vui lòng nhập ít nhất một đáp án đúng');
        return;
      }
    }

    onSave(questionData);
  };

  return (
    <div className="space-y-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-700">
      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
        {question ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
      </h3>

      {/* Question Type */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Loại câu hỏi <span className="text-red-500">*</span>
        </label>
        <select
          value={questionData.type}
          onChange={(e) => setQuestionData({ ...questionData, type: e.target.value })}
          className="clay-input w-full px-4 py-3 rounded-xl"
        >
          <option value="multiple_choice">Trắc nghiệm (4 phương án)</option>
          <option value="true_false">Đúng/Sai</option>
          <option value="short_answer">Trả lời ngắn</option>

        </select>
      </div>

      {/* Question Text */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">
            Nội dung câu hỏi <span className="text-red-500">*</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useMath}
              onChange={(e) => setUseMath(e.target.checked)}
              className="rounded"
            />
            Dùng công thức toán
          </label>
        </div>

        {useMath ? (
          <MathInput
            value={questionData.questionLatex}
            onChange={(latex) => setQuestionData({ ...questionData, questionLatex: latex })}
            placeholder="Nhập công thức toán..."
          />
        ) : (
          <textarea
            value={questionData.questionText}
            onChange={(e) => setQuestionData({ ...questionData, questionText: e.target.value })}
            placeholder="Nhập nội dung câu hỏi..."
            rows={3}
            className="clay-input w-full px-4 py-3 rounded-xl"
          />
        )}
      </div>

      {/* Points */}
      <div className="w-32">
        <label className="block text-sm font-medium mb-2">Điểm</label>
        <input
          type="number"
          value={questionData.points}
          onChange={(e) => setQuestionData({ ...questionData, points: parseFloat(e.target.value) })}
          min={0.5}
          step={0.5}
          className="clay-input w-full px-4 py-3 rounded-xl"
        />
      </div>

      {/* Type-specific fields */}
      {questionData.type === 'multiple_choice' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Các phương án <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            {questionData.options.map((option, index) => (
              <div key={option.label} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={questionData.correctAnswer === option.label}
                  onChange={() => setQuestionData({ ...questionData, correctAnswer: option.label })}
                  className="mt-3"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs text-gray-600 dark:text-gray-400">
                      Phương án {option.label}
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={optionUseMath[index]}
                        onChange={(e) => {
                          const newUseMath = [...optionUseMath];
                          newUseMath[index] = e.target.checked;
                          setOptionUseMath(newUseMath);
                        }}
                        className="rounded"
                      />
                      Công thức
                    </label>
                  </div>
                  {optionUseMath[index] ? (
                    <MathInput
                      value={option.latex}
                      onChange={(latex) => {
                        const newOptions = [...questionData.options];
                        newOptions[index].latex = latex;
                        newOptions[index].text = ''; // Clear text when using latex
                        setQuestionData({ ...questionData, options: newOptions });
                      }}
                      placeholder={`Nhập công thức cho phương án ${option.label}...`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const newOptions = [...questionData.options];
                        newOptions[index].text = e.target.value;
                        newOptions[index].latex = ''; // Clear latex when using text
                        setQuestionData({ ...questionData, options: newOptions });
                      }}
                      placeholder={`Nhập phương án ${option.label}...`}
                      className="clay-input w-full px-4 py-2 rounded-xl"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Chọn radio button bên trái để đánh dấu đáp án đúng
          </p>
        </div>
      )}

      {questionData.type === 'true_false' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Đáp án đúng <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer clay-input px-6 py-3 rounded-xl">
              <input
                type="radio"
                name="trueFalseAnswer"
                checked={questionData.correctAnswer === true}
                onChange={() => setQuestionData({ ...questionData, correctAnswer: true })}
              />
              <span className="font-medium">Đúng</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer clay-input px-6 py-3 rounded-xl">
              <input
                type="radio"
                name="trueFalseAnswer"
                checked={questionData.correctAnswer === false}
                onChange={() => setQuestionData({ ...questionData, correctAnswer: false })}
              />
              <span className="font-medium">Sai</span>
            </label>
          </div>
        </div>
      )}

      {questionData.type === 'short_answer' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Đáp án đúng <span className="text-red-500">*</span>
            </label>
            {questionData.correctAnswers.map((answer, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => {
                    const newAnswers = [...questionData.correctAnswers];
                    newAnswers[index] = e.target.value;
                    setQuestionData({ ...questionData, correctAnswers: newAnswers });
                  }}
                  placeholder="Nhập đáp án đúng..."
                  className="clay-input flex-1 px-4 py-2 rounded-xl"
                />
                {questionData.correctAnswers.length > 1 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      const newAnswers = questionData.correctAnswers.filter((_, i) => i !== index);
                      setQuestionData({ ...questionData, correctAnswers: newAnswers });
                    }}
                  >
                    <Icon name="delete" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuestionData({
                  ...questionData,
                  correctAnswers: [...questionData.correctAnswers, ''],
                });
              }}
              className="mt-2"
            >
              <Icon name="add" className="mr-1" />
              Thêm đáp án khác
            </Button>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={questionData.caseSensitive}
                onChange={(e) =>
                  setQuestionData({ ...questionData, caseSensitive: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Phân biệt hoa thường</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={questionData.acceptLatex}
                onChange={(e) =>
                  setQuestionData({ ...questionData, acceptLatex: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Chấp nhận công thức LaTeX</span>
            </label>
          </div>
        </div>
      )}



      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-blue-200 dark:border-blue-700">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Hủy
        </Button>
        <Button variant="primary" onClick={handleSave} className="flex-1">
          {question ? 'Cập nhật' : 'Thêm câu hỏi'}
        </Button>
      </div>
    </div>
  );
};

export default QuestionEditor;
