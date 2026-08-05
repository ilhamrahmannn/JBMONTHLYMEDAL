import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, MapPin, Trophy, Users } from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

type AcceptancePlayer = {
  registrationId: string;
  name: string;
  origin: string;
  ranking: number | null;
  points: number;
};

type PublishedAcceptanceList = {
  tournamentName?: string;
  tournamentDate?: string;
  openLabel?: string;
  openPlayers?: AcceptancePlayer[];
  beginnerLabel?: string;
  beginnerPlayers?: AcceptancePlayer[];
};

function CategoryList({
  label,
  players,
}: {
  label: string;
  players: AcceptancePlayer[];
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-emerald-900/60 bg-[#0b1510] shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_100%_0,rgba(163,230,53,0.17),transparent_45%)] p-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">
          Official acceptance list
        </span>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black text-white">{label}</h2>
          <span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-black">
            {players.length}/24
          </span>
        </div>
      </header>

      {players.length === 0 ? (
        <p className="p-8 text-center text-sm font-semibold text-white/45">
          This category has not been posted yet.
        </p>
      ) : (
        <ol className="divide-y divide-white/[0.07]">
          {players.map((player, index) => (
            <li
              key={player.registrationId}
              className="grid grid-cols-[44px_minmax(0,1fr)_68px] items-center gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
            >
              <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-xs font-black text-white/55">
                {index + 1}
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-extrabold text-white md:text-base">
                  {player.name}
                </strong>
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-100/50">
                  <MapPin className="size-3" /> {player.origin}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-black uppercase tracking-wider text-white/35">
                  Ranking
                </span>
                <strong className="mt-1 block text-lg font-black text-lime-300">
                  {player.ranking ? `#${player.ranking}` : "NR"}
                </strong>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function AcceptanceListPage() {
  const [data, setData] = useState<PublishedAcceptanceList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      const liveSnapshot = await getDoc(doc(db, "currentTournament", "live"));
      const tournamentId = liveSnapshot.exists()
        ? String(liveSnapshot.data().tournamentId || "")
        : "";

      if (!tournamentId) {
        setLoading(false);
        return;
      }

      unsubscribe = onSnapshot(
        doc(db, "acceptanceLists", tournamentId),
        (snapshot) => {
          setData(snapshot.exists() ? snapshot.data() : null);
          setLoading(false);
        },
        () => setLoading(false)
      );
    };

    void subscribe();
    return () => unsubscribe?.();
  }, []);

  const openPlayers = data?.openPlayers || [];
  const beginnerPlayers = data?.beginnerPlayers || [];

  return (
    <main className="min-h-screen bg-[#07100c] px-5 py-8 text-white md:px-10 md:py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-lime-300 transition hover:text-lime-200"
        >
          <ChevronLeft className="size-4" /> Back to Homepage
        </Link>

        <header className="mt-7 overflow-hidden rounded-[28px] border border-lime-400/25 bg-[radial-gradient(circle_at_90%_0,rgba(163,230,53,0.22),transparent_35%),linear-gradient(135deg,#123b29,#08120d)] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-lime-300">
            <Trophy className="size-4" /> Merdeka Series 2026
          </span>
          <h1 className="mt-5 text-4xl font-black md:text-6xl">Acceptance List</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-emerald-50/70">
            Officially accepted participants, arranged according to the current
            JB Monthly Medal ranking for this series.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-white/70">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2">
              <CalendarDays className="size-4 text-lime-300" />
              {data?.tournamentDate || "30 August 2026"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2">
              <Users className="size-4 text-lime-300" /> Up to 24 players per category
            </span>
          </div>
        </header>

        {loading ? (
          <div className="py-20 text-center font-bold text-white/50">
            Loading acceptance list...
          </div>
        ) : !data ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <h2 className="text-xl font-black">Acceptance list coming soon</h2>
            <p className="mt-2 text-sm text-white/50">
              The organiser has not posted the participant list yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <CategoryList
              label={data.openLabel || "MIX SINGLES OPEN"}
              players={openPlayers}
            />
            <CategoryList
              label={data.beginnerLabel || "MIX SINGLES BEGINNER"}
              players={beginnerPlayers}
            />
          </div>
        )}
      </div>
    </main>
  );
}
