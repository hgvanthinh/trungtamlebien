import { useState } from 'react';
import Icon from '../common/Icon';

/**
 * Short Answer Input Component
 * Text input with chip display for multiple acceptable answers
 *
 * @param {number} questionNum - Question number
 * @param {string[]} answers - Array of acceptable answers
 * @param {Function} onChange - Change handler (questionNum, newAnswers) => void
 * @param {Function} onRemove - Remove question handler (questionNum) => void
 * @param {boolean} disabled - Disable inputs
 */
export function ShortAnswerInput({ questionNum, answers = [], onChange, onRemove, disabled = false }) {
  const [newAnswer, setNewAnswer] = useState('');

  const handleAddAnswer = () => {
    if (!newAnswer.trim()) return;

    const updatedAnswers = [...answers, newAnswer.trim()];
    onChange(questionNum, updatedAnswers);
    setNewAnswer('');
  };

  const handleRemoveAnswer = (index) => {
    const updatedAnswers = answers.filter((_, i) => i !== index);
    onChange(questionNum, updatedAnswers);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAnswer();
    }
  };

  return (
    <div className="clay-card p-4 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#111812] dark:text-white">
          Câu {questionNum}:
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(questionNum)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
            disabled={disabled}
          >
            <Icon name="close" className="text-sm text-gray-500" />
          </button>
        )}
      </div>

      {/* Main answer input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nhập đáp án chấp nhận được..."
          className="clay-input flex-1 px-3 py-2 rounded-lg text-sm"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleAddAnswer}
          disabled={disabled || !newAnswer.trim()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Icon name="add" className="text-sm" />
          <span className="hidden sm:inline">Thêm</span>
        </button>
      </div>

      {/* Display acceptable answers as chips */}
      {answers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Đáp án được chấp nhận ({answers.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {answers.map((answer, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
              >
                <span className="font-mono">{answer}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAnswer(index)}
                  disabled={disabled}
                  className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition"
                >
                  <Icon name="close" className="text-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-red-500 dark:text-red-400">
          <Icon name="error" className="inline mr-1" />
          Chưa có đáp án. Vui lòng thêm ít nhất 1 đáp án.
        </p>
      )}
    </div>
  );
}

export default ShortAnswerInput;
