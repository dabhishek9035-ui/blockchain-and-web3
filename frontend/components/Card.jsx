export default function Card({ children, className = '', hoverEffect = true }) {
  return (
    <div className={`glass-card p-6 rounded-3xl ${hoverEffect ? 'transition-transform duration-300 hover:-translate-y-1' : ''} ${className}`}>
      {children}
    </div>
  );
}
