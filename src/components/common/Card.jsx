const Card = ({ children, className = '', onClick, variant = 'default' }) => {
  const baseClasses = 'clay-card';
  const variantClasses = {
    default: '',
    hover: 'cursor-pointer',
    clickable: 'cursor-pointer active:scale-[0.98]',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
