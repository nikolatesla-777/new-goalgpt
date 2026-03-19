import Header from "@/components/Header";
import LeagueDetail from "@/components/LeagueDetail";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LeagueDetailPage({ params }: Props) {
  const { slug } = await params;
  const league = decodeURIComponent(slug);

  return (
    <main className="min-h-screen bg-[#080b12]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <LeagueDetail league={league} />
      </div>
    </main>
  );
}
