/**
 * Reusable form text input with consistent styling.
 * Supports text inputs and textareas via the `multiline` prop.
 */

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
  colSpan2?: boolean;
  rows?: number;
}

export default function FormTextInput({ id, label, value, onChange, required, placeholder, mono, multiline, colSpan2, rows = 3 }: Props) {
  const baseClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all';
  const inputClass = `${baseClass}${mono ? ' font-mono' : ''} text-slate-800`;

  return (
    <div className={`space-y-1.5${colSpan2 ? ' md:col-span-2' : ''}${required ? ' focus-within:text-indigo-600 focus-within:font-medium transition-all' : ''}`}>
      <label htmlFor={id} className="block text-sm text-slate-700 font-semibold mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
          className={`${inputClass} resize-none`} placeholder={placeholder} required={required} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className={inputClass} placeholder={placeholder} required={required} />
      )}
    </div>
  );
}
