export function SkeletonCard() {
  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="h-5 w-40 bg-white/5 rounded" />
        <div className="h-6 w-12 bg-white/5 rounded-full" />
      </div>
      <div className="h-8 w-24 bg-white/5 rounded-lg mb-4" />
      <div className="flex gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-10 bg-white/5 rounded mb-1" />
            <div className="h-5 w-8 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="w-2.5 h-2.5 bg-white/5 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="h-12 rounded-lg bg-[#0d1117] animate-pulse border border-white/5" />
  );
}

export function SkeletonPickCard() {
  return (
    <div className="h-36 rounded-xl bg-[#0d1117] border border-white/5 animate-pulse" />
  );
}

export function SkeletonTable({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonStatsBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#0d1117] border border-white/5 rounded-xl p-4 animate-pulse">
          <div className="h-3 w-20 bg-white/5 rounded mb-2" />
          <div className="h-8 w-16 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
