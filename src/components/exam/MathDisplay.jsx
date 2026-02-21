import { useEffect, useRef } from 'react';
import 'mathlive';

const MathDisplay = ({ latex, className = '' }) => {
  const mathFieldRef = useRef(null);

  useEffect(() => {
    if (mathFieldRef.current && latex) {
      mathFieldRef.current.value = latex;
    }
  }, [latex]);

  return (
    <math-field
      ref={mathFieldRef}
      read-only="true"
      className={`inline-block ${className}`}
      style={{ fontSize: '1.2em', border: 'none', background: 'transparent' }}
    >
      {latex}
    </math-field>
  );
};

export default MathDisplay;
