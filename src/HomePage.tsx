import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Trophy, Users, ClipboardList, BarChart3, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-6xl font-bold">
            JB Monthly Medal
          </h1>
          <p className="text-neutral-300 text-lg">
            Live tournament hub for players, admin, ranking and match schedule.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <HomeCard
  icon={<Trophy />}
  title="Tournament Activity"
  desc="View past tournaments, results and event history."
  href="/activity"
  button="View Activity"
/>

          <HomeCard
            icon={<Shield />}
            title="Admin Login"
            desc="Manage players, scores, draws, courts and order of play."
            href="/admin"
            button="Admin Access"
          />

          <HomeCard
            icon={<Users />}
            title="Player View"
            desc="Live grouping, match schedule, ranking and results."
            href="/playerview"
            button="Open Player View"
          />

          <HomeCard
            icon={<ClipboardList />}
            title="Acceptance List"
            desc="Confirmed players, waiting list and category entries."
            href="/acceptance-list"
            button="View List"
          />

          <HomeCard
            icon={<BarChart3 />}
            title="Ranking"
            desc="Ranking based on match wins and player performance."
            href="/ranking"
            button="View Ranking"
          />
        </div>
      </div>
    </div>
  );
}

function HomeCard({
  icon,
  title,
  desc,
  href,
  button,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  button: string;
}) {
  return (
    <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
      <CardContent className="p-6 space-y-4">
        <div className="text-lime-300">{icon}</div>

        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-neutral-300 text-sm mt-2">{desc}</p>
        </div>

        <Button
          onClick={() => (window.location.href = href)}
          className="w-full rounded-2xl bg-lime-500 hover:bg-lime-600 text-black font-bold"
        >
          {button}
        </Button>
      </CardContent>
    </Card>
  );
}