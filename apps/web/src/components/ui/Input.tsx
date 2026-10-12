import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

const baseInput =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </span>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(function Input({ label, error, required, className = "", id, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={id}>
          <Label required={required}>{label}</Label>
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`${baseInput} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""} ${className}`}
        {...props}
      />
      <ErrorText message={error} />
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(function Textarea({ label, error, required, className = "", id, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={id}>
          <Label required={required}>{label}</Label>
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={`${baseInput} min-h-[80px] ${error ? "border-red-400" : ""} ${className}`}
        {...props}
      />
      <ErrorText message={error} />
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(function Select({ label, error, required, className = "", id, children, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={id}>
          <Label required={required}>{label}</Label>
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`${baseInput} appearance-none bg-no-repeat pr-8 ${error ? "border-red-400" : ""} ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8.825L1.175 4l.825-.825L6 7.175 10 .35l.825.825z'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.75rem center",
        }}
        {...props}
      >
        {children}
      </select>
      <ErrorText message={error} />
    </div>
  );
});
