import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FolderOpen,
  Shield,
  Users,
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
    icon: Users,
    title: "Player View",
    desc: "Check live match schedule, draw, group results and rankings.",
    href: "/playerview",
    button: "Open Player View",
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
        <Link to="/" className="flex items-center gap-3 font-extrabold">
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

          <div className="relative max-w-3xl">
            <span className="inline-flex rounded-full border border-lime-400/50 bg-black/35 px-3 py-2 text-xs font-extrabold text-lime-300">
              Next Event: Sunday, 28 June 2026
            </span>

            <h1 className="mt-6 max-w-2xl text-[clamp(56px,8vw,92px)] font-light leading-[0.95] tracking-normal text-[#f7f7ef]">
              JB Monthly
              <br />
              Medal
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-white md:text-xl">
              A friendly singles tournament for Johor Bahru tennis players, with
              beginner and intermediate categories, live match order, group
              results, and knockout draws.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://wa.me/60123456789?text=Hi%2C%20I%20want%20to%20register%20for%20JB%20Monthly%20Medal"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center rounded-lg bg-lime-400 px-5 font-extrabold text-black hover:bg-lime-300"
              >
                Register Now
              </a>
              <Link
                to="/playerview"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/20 bg-white/10 px-5 font-extrabold text-white hover:bg-white/15"
              >
                View Live Schedule
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#07100c] px-5 py-14 md:px-16">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
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
