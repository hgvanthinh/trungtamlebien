import { useState } from 'react';
import Icon from './Icon';

const SearchBar = ({ placeholder = 'Tìm kiếm...', value: controlledValue, onChange, onClear, className = '' }) => {
  const [internalValue, setInternalValue] = useState('');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('');
    }
    if (onClear) {
      onClear();
    }
    if (onChange) {
      onChange('');
    }
  };

  return (
    <div className={`flex items-center clay-input rounded-xl px-4 py-3 ${className}`}>
      <Icon name="search" size={20} className="text-[#608a67] dark:text-[#8ba890] mr-2" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-[#111812] dark:text-white placeholder:text-[#608a67]/60 dark:placeholder:text-[#8ba890]/60"
      />
      {value && (
        <button
          onClick={handleClear}
          className="ml-2 text-[#608a67] dark:text-[#8ba890] hover:text-[#111812] dark:hover:text-white transition-colors"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
