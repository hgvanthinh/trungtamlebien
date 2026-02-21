import Icon from './Icon';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-bold transition-all rounded-2xl';

  const variantClasses = {
    primary: 'clay-btn-primary',
    secondary: 'bg-white dark:bg-surface-dark text-[#111812] dark:text-white hover:bg-[#f0f5f1] dark:hover:bg-white/10 shadow-sm',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10',
    ghost: 'text-[#556958] dark:text-[#a5b5a8] hover:bg-[#f0f5f1] dark:hover:bg-white/10',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={onClick}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      {children}
    </button>
  );
};

export default Button;
