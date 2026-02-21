import { useState } from 'react';
import Icon from '../common/Icon';

/**
 * True/False Input Component
 * Renders toggle buttons for a,b,c,d sub-items
 *
 * @param {number} questionNum - Question number
 * @param {Object} value - Current values { a: true/false, b: true/false, c: true/false, d: true/false }
 * @param {Function} onChange - Change handler (questionNum, newValue) => void
 * @param {Function} onRemove - Remove question handler (questionNum) => void
 * @param {boolean} disabled - Disable inputs
 */
export function TrueFalseInput({ questionNum, value = {}, onChange, onRemove, disabled = false }) {
  const subItems = ['a', 'b', 'c', 'd'];

  const handleToggle = (subItem) => {
    if (disabled) return;

    const newValue = {
      ...value,
      [subItem]: !(value[subItem] === true) // Toggle: true -> false -> true
    };

    onChange(questionNum, newValue);
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

      <div className="flex flex-wrap gap-2">
        {subItems.map((subItem) => {
          const isSelected = value[subItem] === true;

          return (
            <button
              key={subItem}
              type="button"
              onClick={() => handleToggle(subItem)}
              disabled={disabled}
              className={`
                px-4 py-2 rounded-lg font-medium transition min-w-[80px]
                ${isSelected
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                }
                ${!disabled ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed'}
              `}
            >
              {subItem.toUpperCase()}
              <span className="ml-1 text-xs">
                {isSelected ? '(Đ)' : '(S)'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Nhấn để chọn Đúng (Đ) hoặc Sai (S)
      </div>
    </div>
  );
}

export default TrueFalseInput;
