const Icon = ({ name, size = 24, className = '', filled = false }) => {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}
      style={{ fontSize: `${size}px` }}
    >
      {name}
    </span>
  );
};

export default Icon;
