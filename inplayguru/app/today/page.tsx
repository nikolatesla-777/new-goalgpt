import Header from "@/components/Header";
import TodayPicks from "@/components/TodayPicks";

export default function TodayPage() {
  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <TodayPicks />
      </div>
    </main>
  );
}
