import { useState, useEffect, useRef } from 'react';

const Avatar = ({ src, alt, name, size = 'md', border = false, borderUrl, borderPadding = '9%', className = '', lazy = true }) => {
  const [borderError, setBorderError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy); // If lazy=false, show immediately
  const [imageSrc, setImageSrc] = useState(lazy ? null : src); // Lazy load images
  const avatarRef = useRef(null);

  const sizeClasses = {
    xs: 'size-6 text-xs',
    sm: 'size-8 text-sm',
    md: 'size-10 text-base',
    lg: 'size-12 text-lg',
    xl: 'size-16 text-xl',
  };

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!lazy || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setImageSrc(src);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Load 50px before entering viewport
        threshold: 0.01,
      }
    );

    if (avatarRef.current) {
      observer.observe(avatarRef.current);
    }

    return () => {
      if (avatarRef.current) {
        observer.unobserve(avatarRef.current);
      }
    };
  }, [src, lazy]);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const borderClass = border ? 'border-2 border-white dark:border-gray-700 shadow-lg' : '';

  const avatarContent = imageSrc ? (
    <div
      ref={avatarRef}
      className={`${sizeClasses[size]} ${borderClass} rounded-full bg-cover bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("${imageSrc}")` }}
      title={alt || name}
    />
  ) : (
    <div
      ref={avatarRef}
      className={`${sizeClasses[size]} ${borderClass} rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold ${className}`}
      title={alt || name}
    >
      {getInitials(name)}
    </div>
  );

  // If borderUrl is provided and no error, wrap avatar with border overlay
  if (borderUrl && !borderError) {
    return (
      <div className="relative inline-block" style={{ padding: borderPadding }}>
        <div className="relative">
          {avatarContent}
        </div>
        <img
          src={borderUrl}
          alt="Avatar Border"
          className="absolute pointer-events-none"
          style={{
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 1
          }}
          onError={() => setBorderError(true)}
        />
      </div>
    );
  }

  return avatarContent;
};

export default Avatar;
