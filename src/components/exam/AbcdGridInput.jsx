import { useState, useRef, useEffect } from 'react';
import Icon from '../common/Icon';

/**
 * ABCD Grid Input - Excel-like table for entering multiple choice answers
 * Supports keyboard navigation (Tab, Enter, Arrow keys)
 */
export function AbcdGridInput({ maxQuestions = 12, value = {}, onChange }) {
  const [focusedCell, setFocusedCell] = useState(null);
  const inputRefs = useRef({});

  // Create array of question numbers
  const questions = Array.from({ length: maxQuestions }, (_, i) => i + 1);

  const handleAnswerChange = (questionNum, answer) => {
    const upperAnswer = answer.toUpperCase();

    // Only allow A, B, C, D or empty
    if (upperAnswer && !['A', 'B', 'C', 'D'].includes(upperAnswer)) {
      return;
    }

    const newValue = { ...value };
    if (upperAnswer) {
      newValue[questionNum] = upperAnswer;
    } else {
      delete newValue[questionNum];
    }

    onChange(newValue);
  };

  const handleKeyDown = (e, questionNum) => {
    const currentIndex = questionNum - 1;

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        // Move to next row
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
        // Move to previous row
        if (currentIndex > 0) {
          const prevInput = inputRefs.current[questionNum - 1];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
        break;

      case 'Tab':
        // Let default tab behavior work
        break;

      default:
        // Auto-advance on letter input (A, B, C, D)
        if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
          setTimeout(() => {
            if (currentIndex < maxQuestions - 1) {
              const nextInput = inputRefs.current[questionNum + 1];
              if (nextInput) {
                nextInput.focus();
                nextInput.select();
              }
            }
          }, 0);
        }
        break;
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    // Parse pasted data - support multiple formats
    // Format 1: "1.A 2.B 3.C" or "1A 2B 3C"
    // Format 2: "A\nB\nC" (newline separated)
    // Format 3: "A B C D" (space separated)

    const newValue = { ...value };

    // Try parsing with question numbers
    const withNumbers = /(\d+)\s*[.:)\\-]?\s*([A-Da-d])/gi;
    let match;
    let hasMatches = false;

    while ((match = withNumbers.exec(pastedText)) !== null) {
      const questionNum = parseInt(match[1]);
      if (questionNum >= 1 && questionNum <= maxQuestions) {
        newValue[questionNum] = match[2].toUpperCase();
        hasMatches = true;
      }
    }

    // If no matches, try line-by-line or space-separated
    if (!hasMatches) {
      const answers = pastedText
        .split(/[\n\s,;]+/)
        .map(s => s.trim().toUpperCase())
        .filter(s => ['A', 'B', 'C', 'D'].includes(s));

      answers.forEach((answer, index) => {
        const questionNum = index + 1;
        if (questionNum <= maxQuestions) {
          newValue[questionNum] = answer;
        }
      });
    }

    onChange(newValue);
  };

  const clearAll = () => {
    if (confirm('Xóa tất cả đáp án?')) {
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
          >
            <Icon name="delete" className="inline text-xs mr-1" />
            Xóa hết
          </button>
        </div>
      </div>

      {/* Excel-like Grid */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-[80px_1fr] bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 font-bold text-sm">
          <div className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 text-center">
            Câu
          </div>
          <div className="px-3 py-2 text-center">
            Chọn (A/B/C/D)
          </div>
        </div>

        {/* Data Rows - 2 columns */}
        <div className="grid grid-cols-2 divide-x divide-gray-300 dark:divide-gray-600">
          {/* Column 1: Questions 1-6 */}
          <div>
            {questions.slice(0, 6).map((num) => (
              <div
                key={num}
                className="grid grid-cols-[80px_1fr] border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 text-center font-medium text-sm">
                  {num}
                </div>
                <div className="px-2 py-1">
                  <input
                    ref={(el) => (inputRefs.current[num] = el)}
                    type="text"
                    value={value[num] || ''}
                    onChange={(e) => handleAnswerChange(num, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, num)}
                    onFocus={() => setFocusedCell(num)}
                    onPaste={handlePaste}
                    maxLength={1}
                    placeholder="-"
                    className="w-full px-2 py-1.5 text-center font-bold text-lg uppercase bg-transparent focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Column 2: Questions 7-12 */}
          <div>
            {questions.slice(6, 12).map((num) => (
              <div
                key={num}
                className="grid grid-cols-[80px_1fr] border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 text-center font-medium text-sm">
                  {num}
                </div>
                <div className="px-2 py-1">
                  <input
                    ref={(el) => (inputRefs.current[num] = el)}
                    type="text"
                    value={value[num] || ''}
                    onChange={(e) => handleAnswerChange(num, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, num)}
                    onFocus={() => setFocusedCell(num)}
                    onPaste={handlePaste}
                    maxLength={1}
                    placeholder="-"
                    className="w-full px-2 py-1.5 text-center font-bold text-lg uppercase bg-transparent focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>💡 <strong>Mẹo nhập nhanh:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li>Nhập A/B/C/D rồi nhấn Enter để xuống câu tiếp theo</li>
          <li>Dùng phím mũi tên ↑↓ để di chuyển</li>
          <li>Paste từ Excel: Ctrl+V (hỗ trợ nhiều format: "1.A 2.B" hoặc "A B C")</li>
        </ul>
      </div>
    </div>
  );
}

export default AbcdGridInput;
