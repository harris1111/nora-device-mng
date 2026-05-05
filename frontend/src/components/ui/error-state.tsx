interface Props {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({ message, onRetry, retryLabel = 'Thử lại' }: Props) {
  return (
    <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-3">
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
