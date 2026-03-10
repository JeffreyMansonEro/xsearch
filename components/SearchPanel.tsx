"use client";

interface Props {
  onSearch: () => void;
  onCancel: () => void;
  loading: boolean;
  disabled: boolean;
  cooldown: number;
  usage: { used: number; limit: number };
  statusMessage: string;
}

export default function SearchPanel({
  onSearch,
  onCancel,
  loading,
  disabled,
  cooldown,
  usage,
  statusMessage,
}: Props) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <svg
              className="h-4 w-4 animate-spin text-primary"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{statusMessage || "検索中..."}</span>
          </div>
          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-danger/30 py-2 text-sm font-medium text-danger hover:bg-danger/5"
          >
            中止
          </button>
        </div>
      ) : (
        <button
          onClick={onSearch}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {cooldown > 0 ? (
            <>待機中... {cooldown}秒</>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              検索
            </>
          )}
        </button>
      )}
      <p className="mt-2 text-center text-xs text-muted">
        本日 {usage.used} / {usage.limit} 回使用
      </p>
    </div>
  );
}
