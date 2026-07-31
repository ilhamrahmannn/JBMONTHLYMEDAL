import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock3,
  FolderOpen,
  MapPin,
  Shield,
  Shirt,
  Ticket,
} from "lucide-react";

const featureCards = [
  {
    icon: FolderOpen,
    title: "Tournament Activity",
    desc: "View tournament activities, results and previous event folders.",
    href: "/activity",
    button: "View Activities",
  },
  {
    icon: Shield,
    title: "Admin Login",
    desc: "Manage tournament setup, scores, draw, order of play and results.",
    href: "/admin",
    button: "Admin Login",
  },
  {
    icon: ClipboardList,
    title: "Acceptance List",
    desc: "View registered players by category.",
    href: "/acceptance-list",
    button: "View Acceptance List",
  },
  {
    icon: BarChart3,
    title: "Ranking",
    desc: "View player ranking points and seeded players.",
    href: "/ranking",
    button: "View Ranking",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#07100c] text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#07100c]/90 px-5 py-3 backdrop-blur md:px-10">
        <Link
          to="/"
          className="flex cursor-pointer items-center gap-3 font-extrabold transition hover:opacity-85 hover:drop-shadow-[0_0_10px_rgba(163,230,53,0.35)]"
        >
          <span className="grid size-9 place-items-center rounded-full border-2 border-lime-400 text-sm text-lime-300">
            JB
          </span>
          <span>Monthly Medal</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-lg border border-lime-400/70 bg-lime-400/15 px-4 py-2 text-sm font-bold text-lime-300"
          >
            Home
          </Link>
          <Link
            to="/playerview"
            className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Player View
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative grid min-h-[calc(100vh-65px)] items-end overflow-hidden px-5 py-12 md:px-16 md:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,16,14,0.06),rgba(12,16,14,0.92)),radial-gradient(circle_at_79%_13%,rgba(183,243,74,0.24),transparent_9%),linear-gradient(140deg,#15472f_0%,#123b29_42%,#06100c_100%)]" />

          <div
            className="absolute border-[5px] border-white/55 opacity-70"
            style={{
              inset: "1% -2% 10% 34%",
              transform: "rotate(-9deg)",
            }}
          >
            <div className="absolute inset-y-0 left-[22%] border-l-4 border-white/50" />
            <div className="absolute inset-y-0 right-[22%] border-r-4 border-white/50" />
            <div className="absolute inset-x-0 top-[42%] border-t-4 border-white/50" />
            <div className="absolute inset-x-0 top-[49%] border-t-4 border-white/50" />
          </div>

          <div className="absolute right-[17%] top-[8%] size-20 rounded-full bg-[radial-gradient(circle_at_30%_22%,#f7ff9d_0_17%,transparent_18%),radial-gradient(circle_at_50%_50%,#c9ff3d_0_58%,#7ebe1e_60%_100%)] shadow-[0_18px_38px_rgba(0,0,0,0.34)]">
            <div className="absolute inset-[14%] rounded-full border-x-[3px] border-white/60 rotate-[28deg]" />
          </div>

          <div className="relative mx-auto grid w-full max-w-[1500px] items-end gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.72fr)]">
          <div className="max-w-[820px] lg:-translate-y-6">
            <span className="inline-flex rounded-full border border-lime-400/50 bg-black/35 px-3 py-2 text-xs font-extrabold text-lime-300">
              Registration Open · Sunday, 30 August 2026
            </span>

            <div className="mt-6 w-full max-w-[820px] space-y-2">
              <h1 className="home-hero-title origin-left text-left text-[52px] font-semibold uppercase leading-[0.95] tracking-[0.08em] text-[#F2F0E8] drop-shadow-sm sm:text-[64px] md:whitespace-nowrap md:text-[82px] xl:text-[96px]">
                JB MONTHLY MEDAL
              </h1>

              <h2 className="home-hero-series mt-3 text-left text-[28px] font-semibold uppercase italic tracking-[0.18em] text-[#F2F0E8] md:text-[42px]">
                MERDEKA SERIES 2026
              </h2>
            </div>

            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-white md:text-xl">
              Celebrate Merdeka on court in our friendly singles tournament,
              featuring Mix Open and Mix Beginner categories for players of all
              ages.
            </p>

            <div className="mt-5 inline-flex flex-col rounded-lg border border-lime-400/35 bg-lime-400/10 px-4 py-3 text-lime-300 shadow-[0_12px_36px_rgba(132,204,22,0.12)] backdrop-blur">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Indoor Court
              </span>
              <span className="mt-1 text-sm font-extrabold uppercase tracking-wide text-lime-100">
                Nusa Duta Tennis Complex
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center rounded-lg bg-lime-400 px-5 font-extrabold text-black transition hover:bg-lime-300"
              >
                Register Now
              </Link>
              <Link
                to="/playerview"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/20 bg-white/10 px-5 font-extrabold text-white hover:bg-white/15"
              >
                View Live Schedule
              </Link>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[26px] border border-lime-300/30 bg-[#09120d]/90 shadow-[0_35px_100px_rgba(0,0,0,0.58)] backdrop-blur-xl">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_100%_0,rgba(163,230,53,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015))] p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">
                  Now accepting players
                </span>
                <span className="rounded-full bg-lime-400 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-black">
                  Open
                </span>
              </div>
              <h3 className="mt-4 text-3xl font-black uppercase leading-tight text-white">
                JB Monthly Medal
              </h3>
              <p className="mt-1 text-sm font-extrabold uppercase tracking-[0.16em] text-lime-200">
                Merdeka Series 2026
              </p>
            </div>

            <div className="p-6 md:p-7">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <CalendarDays className="size-5 text-lime-300" />
                  <span className="mt-3 block text-[10px] font-black uppercase tracking-wider text-white/45">Date</span>
                  <strong className="mt-1 block text-sm text-white">30 Aug 2026</strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <Ticket className="size-5 text-lime-300" />
                  <span className="mt-3 block text-[10px] font-black uppercase tracking-wider text-white/45">Entry fee</span>
                  <strong className="mt-1 block text-sm text-white">RM80 / player</strong>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-lime-300" />
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-white/45">Venue</span>
                  <strong className="mt-1 block text-sm text-white">Nusa Duta Tennis Complex</strong>
                </div>
              </div>

              <div className="mt-5">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Categories · 24 players each</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-xs font-extrabold text-lime-100">Mix Open Singles</span>
                  <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-xs font-extrabold text-lime-100">Mix Beginner Singles</span>
                </div>
              </div>

              <div className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-xs font-bold text-white/70">
                <div className="flex items-center gap-2"><Clock3 className="size-4 text-red-400" /><span>Registration closes 16 August 2026</span></div>
                <div className="flex items-center gap-2"><Shirt className="size-4 text-lime-300" /><span>Free tournament shirt for registered players</span></div>
              </div>

              <Link
                to="/register"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 font-black text-black transition hover:bg-lime-300"
              >
                Register for Merdeka Series
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>
          </div>
        </section>

        <section className="bg-[#07100c] px-5 py-14 md:px-16">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  to={card.href}
                  className="group rounded-xl border border-green-900/60 bg-neutral-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur transition hover:-translate-y-1 hover:border-lime-400/70 hover:bg-green-950/60"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className="grid size-11 place-items-center rounded-lg bg-lime-400/15 text-lime-300 ring-1 ring-lime-400/25">
                      <Icon className="size-5" />
                    </div>
                    <ArrowRight className="size-5 text-green-200/35 transition group-hover:translate-x-1 group-hover:text-lime-300" />
                  </div>

                  <h2 className="text-lg font-extrabold text-white">
                    {card.title}
                  </h2>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-green-100/70">
                    {card.desc}
                  </p>

                  <span className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-lime-400 text-sm font-extrabold text-black transition group-hover:bg-lime-300">
                    {card.button}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
