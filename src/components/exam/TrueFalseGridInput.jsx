import { useState, useRef, useEffect } from 'react';
import Icon from '../common/Icon';

/**
 * True/False Grid Input - Excel-like table for entering T/F answers
 * Each question has 4 sub-items (a, b, c, d) with Đ (true) or S (false)
 */
export function TrueFalseGridInput({ maxQuestions = 4, value = {}, onChange }) {
  const [focusedCell, setFocusedCell] = useState(null);
  const inputRefs = useRef({});

  const filledMax = Math.max(...Object.keys(value).map(Number), 0);
  const [visibleCount, setVisibleCount] = useState(() => Math.max(maxQuestions, filledMax));

  useEffect(() => {
    const max = Math.max(...Object.keys(value).map(Number), 0);
    if (max > visibleCount) setVisibleCount(max);
  }, [value]);

  const questions = Array.from({ length: visibleCount }, (_, i) => i + 1);
  const subItems = ['a', 'b', 'c', 'd'];

  const handleAnswerChange = (questionNum, subItem, inputValue) => {
    const upperValue = inputValue.toUpperCase();

    // Accept Đ, D (for Đúng/True) or S (for Sai/False) or empty
    let boolValue = null;
    if (upperValue === 'Đ' || upperValue === 'D') {
      boolValue = true;
    } else if (upperValue === 'S') {
      boolValue = false;
    } else if (upperValue === '') {
      boolValue = null;
    } else {
      return; // Invalid input, ignore
    }

    const newValue = { ...value };
    if (!newValue[questionNum]) {
      newValue[questionNum] = {};
    }

    if (boolValue === null) {
      delete newValue[questionNum][subItem];
      // Remove question if all sub-items are empty
      if (Object.keys(newValue[questionNum]).length === 0) {
        delete newValue[questionNum];
      }
    } else {
      newValue[questionNum] = {
        ...newValue[questionNum],
        [subItem]: boolValue
      };
    }

    onChange(newValue);
  };

  const toggleAnswer = (questionNum, subItem) => {
    const current = value[questionNum]?.[subItem];
    const newValue = current === true ? false : true;

    const updated = { ...value };
    if (!updated[questionNum]) {
      updated[questionNum] = {};
    }
    updated[questionNum] = {
      ...updated[questionNum],
      [subItem]: newValue
    };

    onChange(updated);
  };

  const handleKeyDown = (e, questionNum, subItem) => {
    const currentSubIndex = subItems.indexOf(subItem);
    const currentQIndex = questionNum - 1;

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        // Move down to next question, same sub-item
        if (currentQIndex < visibleCount - 1) {
          const nextInput = inputRefs.current[`${questionNum + 1}-${subItem}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        // Move up to previous question, same sub-item
        if (currentQIndex > 0) {
          const prevInput = inputRefs.current[`${questionNum - 1}-${subItem}`];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
        break;

      case 'ArrowRight':
      case 'Tab':
        if (e.key === 'Tab') e.preventDefault();
        // Move right to next sub-item
        if (currentSubIndex < subItems.length - 1) {
          const nextInput = inputRefs.current[`${questionNum}-${subItems[currentSubIndex + 1]}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        } else if (currentQIndex < visibleCount - 1) {
          // Move to first sub-item of next question
          const nextInput = inputRefs.current[`${questionNum + 1}-a`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        // Move left to previous sub-item
        if (currentSubIndex > 0) {
          const prevInput = inputRefs.current[`${questionNum}-${subItems[currentSubIndex - 1]}`];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
        break;

      case ' ':
        e.preventDefault();
        // Space bar toggles
        toggleAnswer(questionNum, subItem);
        break;

      default:
        // Auto-advance on valid input
        if (['d', 'D', 'Đ', 's', 'S'].includes(e.key)) {
          setTimeout(() => {
            if (currentSubIndex < subItems.length - 1) {
              const nextInput = inputRefs.current[`${questionNum}-${subItems[currentSubIndex + 1]}`];
              if (nextInput) {
                nextInput.focus();
                nextInput.select();
              }
            } else if (currentQIndex < visibleCount - 1) {
              const nextInput = inputRefs.current[`${questionNum + 1}-a`];
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

  const clearAll = () => {
    if (confirm('Xóa tất cả đáp án Đúng/Sai?')) {
      onChange({});
    }
  };

  const fillCount = Object.keys(value).length;
  const totalCells = fillCount * 4;

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Đã nhập: <span className="font-bold text-primary">{fillCount}/{visibleCount}</span> câu ({totalCells} ô)
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
        <div className="grid grid-cols-[60px_repeat(4,1fr)] bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 font-bold text-sm">
          <div className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 text-center">
            Câu
          </div>
          {subItems.map((item) => (
            <div
              key={item}
              className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 last:border-r-0 text-center"
            >
              {item.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        <div>
          {questions.map((num) => (
            <div
              key={num}
              className="grid grid-cols-[60px_repeat(4,1fr)] border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <div className="px-3 py-3 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 text-center font-medium text-sm">
                {num}
              </div>
              {subItems.map((subItem) => {
                const answerValue = value[num]?.[subItem];
                const displayValue = answerValue === true ? 'Đ' : answerValue === false ? 'S' : '';

                return (
                  <div
                    key={subItem}
                    className="px-1 py-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 relative"
                  >
                    <input
                      ref={(el) => (inputRefs.current[`${num}-${subItem}`] = el)}
                      type="text"
                      value={displayValue}
                      onChange={(e) => handleAnswerChange(num, subItem, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, num, subItem)}
                      onFocus={() => setFocusedCell(`${num}-${subItem}`)}
                      onClick={() => toggleAnswer(num, subItem)}
                      maxLength={1}
                      placeholder="-"
                      className={`w-full px-2 py-2 text-center font-bold text-base uppercase cursor-pointer bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 rounded ${
                        answerValue === true
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : answerValue === false
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      readOnly
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Add question button */}
      <button
        type="button"
        onClick={() => setVisibleCount(c => c + 1)}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-dashed border-green-300 dark:border-green-700 transition"
      >
        <Icon name="add" className="text-base" />
        Thêm câu {visibleCount + 1}
      </button>

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>💡 <strong>Cách nhập:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li><strong>Click</strong> vào ô để chuyển Đúng ↔ Sai</li>
          <li>Hoặc gõ <strong>Đ/D</strong> (Đúng) hoặc <strong>S</strong> (Sai)</li>
          <li>Nhấn <strong>Space</strong> để toggle Đ ↔ S</li>
          <li>Dùng phím mũi tên để di chuyển</li>
        </ul>
      </div>
    </div>
  );
}

export default TrueFalseGridInput;
