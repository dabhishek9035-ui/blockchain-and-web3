export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="ml-1 text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <input
        className="input-field w-full"
        {...props}
      />
      {error && <span className="ml-1 text-xs text-rose-400">{error}</span>}
    </div>
  );
}
