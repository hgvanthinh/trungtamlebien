import { useState, useRef } from 'react';
import Icon from '../common/Icon';

/**
 * Short Answer Grid Input - Excel-like table for entering short answer questions
 * Each question can have one primary answer displayed in the main input
 */
export function ShortAnswerGridInput({ maxQuestions = 6, value = {}, onChange }) {
  const [focusedCell, setFocusedCell] = useState(null);
  const inputRefs = useRef({});

  const questions = Array.from({ length: maxQuestions }, (_, i) => i + 1);

  const handleAnswerChange = (questionNum, newAnswer) => {
    const newValue = { ...value };

    if (!newAnswer.trim()) {
      delete newValue[questionNum];
    } else {
      // Keep existing alternative answers if any, just update the first one
      const existing = Array.isArray(newValue[questionNum]) ? newValue[questionNum] : [];
      newValue[questionNum] = [newAnswer.trim(), ...existing.slice(1)].filter(Boolean);
    }

    onChange(newValue);
  };

  const handleKeyDown = (e, questionNum) => {
    const currentIndex = questionNum - 1;

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < maxQuestions - 1) {
          const nextInput = inputRefs.current[questionNum + 1];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          const prevInput = inputRefs.current[questionNum - 1];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
        break;
    }
  };

  const handlePaste = (e, questionNum) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    // Split by newlines and assign to consecutive questions
    const lines = pastedText.split('\n').map(line => line.trim()).filter(Boolean);

    const newValue = { ...value };
    lines.forEach((line, index) => {
      const targetQuestion = questionNum + index;
      if (targetQuestion <= maxQuestions) {
        newValue[targetQuestion] = [line];
      }
    });

    onChange(newValue);
  };

  const addAlternativeAnswer = (questionNum) => {
    const existing = value[questionNum] || [];
    const newAnswer = prompt('Nhập đáp án thay thế:', '');

    if (newAnswer && newAnswer.trim()) {
      const updated = { ...value };
      updated[questionNum] = [...existing, newAnswer.trim()];
      onChange(updated);
    }
  };

  const removeAlternativeAnswer = (questionNum, answerIndex) => {
    const existing = value[questionNum] || [];
    const updated = { ...value };
    updated[questionNum] = existing.filter((_, i) => i !== answerIndex);

    if (updated[questionNum].length === 0) {
      delete updated[questionNum];
    }

    onChange(updated);
  };

  const clearAll = () => {
    if (confirm('Xóa tất cả đáp án tự luận?')) {
      onChange({});
    }
  };

  const fillCount = Object.keys(value).length;

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Đã nhập: <span className="font-bold text-primary">{fillCount}/{maxQuestions}</span> câu
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
        >
          <Icon name="delete" className="inline text-xs mr-1" />
          Xóa hết
        </button>
      </div>

      {/* Excel-like Grid */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-[60px_1fr] bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 font-bold text-sm">
          <div className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 text-center">
            Câu
          </div>
          <div className="px-3 py-2 text-center">
            Đáp án (có thể nhập nhiều đáp án thay thế)
          </div>
        </div>

        {/* Data Rows */}
        <div>
          {questions.map((num) => {
            const answers = value[num] || [];
            const primaryAnswer = answers[0] || '';
            const alternativeAnswers = answers.slice(1);

            return (
              <div
                key={num}
                className="grid grid-cols-[60px_1fr] border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div className="px-3 py-3 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 text-center font-medium text-sm self-start">
                  {num}
                </div>
                <div className="px-2 py-2 space-y-2">
                  {/* Primary answer input */}
                  <div className="flex gap-2">
                    <input
                      ref={(el) => (inputRefs.current[num] = el)}
                      type="text"
                      value={primaryAnswer}
                      onChange={(e) => handleAnswerChange(num, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, num)}
                      onFocus={() => setFocusedCell(num)}
                      onPaste={(e) => handlePaste(e, num)}
                      placeholder="Nhập đáp án..."
                      className="flex-1 px-3 py-2 font-mono text-sm bg-transparent focus:bg-purple-50 dark:focus:bg-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded border border-gray-300 dark:border-gray-600"
                    />
                    {primaryAnswer && (
                      <button
                        type="button"
                        onClick={() => addAlternativeAnswer(num)}
                        className="px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition flex items-center gap-1"
                        title="Thêm đáp án thay thế"
                      >
                        <Icon name="add" className="text-sm" />
                        <span className="hidden sm:inline">Thêm</span>
                      </button>
                    )}
                  </div>

                  {/* Alternative answers */}
                  {alternativeAnswers.length > 0 && (
                    <div className="pl-3 space-y-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Đáp án thay thế:</p>
                      <div className="flex flex-wrap gap-2">
                        {alternativeAnswers.map((alt, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-mono"
                          >
                            <span>{alt}</span>
                            <button
                              type="button"
                              onClick={() => removeAlternativeAnswer(num, index + 1)}
                              className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5 transition"
                            >
                              <Icon name="close" className="text-xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>💡 <strong>Mẹo nhập nhanh:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li>Nhập đáp án và nhấn <strong>Enter</strong> để xuống câu tiếp theo</li>
          <li>Click <strong>"Thêm"</strong> để nhập đáp án thay thế cho cùng 1 câu</li>
          <li>Paste từ Excel/Word: Ctrl+V (mỗi dòng = 1 câu)</li>
          <li>Ví dụ đáp án thay thế: "2", "hai", "two" đều đúng</li>
        </ul>
      </div>
    </div>
  );
}

export default ShortAnswerGridInput;
