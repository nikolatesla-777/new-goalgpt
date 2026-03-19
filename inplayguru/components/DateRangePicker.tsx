"use client";

interface Props {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  onClear?: () => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
}: Props) {
  const hasFilter = startDate || endDate;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 whitespace-nowrap">Tarih:</span>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="bg-[#161c27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-green-500/50 [color-scheme:dark]"
      />
      <span className="text-xs text-gray-600">—</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="bg-[#161c27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-green-500/50 [color-scheme:dark]"
      />
      {hasFilter && onClear && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
        >
          Temizle
        </button>
      )}
    </div>
  );
}
