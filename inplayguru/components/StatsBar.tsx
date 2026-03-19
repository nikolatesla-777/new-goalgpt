import Link from "next/link";

interface Props {
  totalStrategies: number;
  totalPicks: number;
  hitRate: number | null;
  todayPicks: number;
}

function StatCard({
  icon,
  label,
  value,
  color,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-[#0d1117] border border-white/5 rounded-xl p-4 flex items-center gap-4 ${href ? "hover:border-white/15 hover:bg-[#111827] transition-all cursor-pointer" : ""}`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold ${color || "text-white"}`}>{value}</p>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function StatsBar({ totalStrategies, totalPicks, hitRate, todayPicks }: Props) {
  const hitRateColor =
    hitRate === null
      ? "text-gray-500"
      : hitRate >= 60
      ? "text-green-400"
      : hitRate >= 40
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon="🎯" label="Strateji" value={String(totalStrategies)} />
      <StatCard icon="📊" label="Toplam Pick" value={totalPicks.toLocaleString()} />
      <StatCard
        icon="✅"
        label="Hit Rate"
        value={hitRate !== null ? `%${hitRate}` : "—"}
        color={hitRateColor}
      />
      <StatCard icon="📅" label="Bugün" value={String(todayPicks)} color="text-blue-400" href="/today" />
    </div>
  );
}
