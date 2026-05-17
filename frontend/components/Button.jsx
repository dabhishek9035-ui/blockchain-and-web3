import Link from 'next/link';

export default function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  loading = false, 
  disabled = false, 
  href,
  ...props 
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'hover:bg-slate-800/50 text-slate-300 hover:text-white transition-all rounded-full px-6 py-2',
    danger: 'bg-rose-500 hover:bg-rose-400 text-white font-semibold py-2 px-6 rounded-full transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
  };

  const buttonClass = `${variants[variant] || variants.primary} flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${className}`;
  const content = (
    <>
      {loading && (
        <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={buttonClass} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <span aria-disabled="true" className={buttonClass} {...props}>
        {content}
      </span>
    );
  }

  return (
    <button
      disabled={disabled || loading}
      className={buttonClass}
      {...props}
    >
      {content}
    </button>
  );
}
