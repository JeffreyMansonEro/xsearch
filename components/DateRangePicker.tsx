"use client";

interface Props {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: Props) {
  function setQuickRange(days: number) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    onFromDateChange(formatDate(from));
    onToDateChange(formatDate(now));
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <label className="mb-2 block text-sm font-medium">検索期間</label>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setQuickRange(7)}
          className="rounded-lg border border-input-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
        >
          7日間
        </button>
        <button
          onClick={() => setQuickRange(30)}
          className="rounded-lg border border-input-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
        >
          30日間
        </button>
        <button
          onClick={() => setQuickRange(90)}
          className="rounded-lg border border-input-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
        >
          90日間
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <span className="mb-1 block text-xs text-muted">開始日</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">終了日</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}
