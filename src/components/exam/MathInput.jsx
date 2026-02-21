import { useEffect, useRef } from 'react';
import 'mathlive';

const MathInput = ({ value, onChange, placeholder, readonly = false }) => {
  const mathFieldRef = useRef(null);

  useEffect(() => {
    if (mathFieldRef.current) {
      const mf = mathFieldRef.current;

      mf.value = value || '';

      if (!readonly) {
        const handleInput = (evt) => {
          onChange(evt.target.value);
        };

        mf.addEventListener('input', handleInput);

        return () => {
          mf.removeEventListener('input', handleInput);
        };
      }
    }
  }, [value, onChange, readonly]);

  return (
    <math-field
      ref={mathFieldRef}
      className="clay-input w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 dark:text-white"
      style={{ fontSize: '1.2em' }}
      read-only={readonly ? 'true' : undefined}
    >
      {value || placeholder}
    </math-field>
  );
};

export default MathInput;
