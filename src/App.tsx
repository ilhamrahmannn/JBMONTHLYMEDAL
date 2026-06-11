import { Link, useParams } from "react-router-dom";
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Trophy, Users, RotateCcw, Settings } from "lucide-react";
import { deleteDoc } from "firebase/firestore";
import { Trash2 } from "lucide-react";


const ADMIN_PASSWORD = "JBMM2026";

type PlayerMap = Record<string, string>;
type MatchStatus = "Waiting" | "On Court" | "Finished";
type MatchFormat = "SHORT_SET_4" | "NORMAL_SET_6" | "PRO_SET_8";

type Court = {
  id: string;
  name: string;
};

type MatchMeta = Record<
  string,
  {
    court: string;
    status: MatchStatus;
  }
>;

type ScoreMap = Record<string, { s1: string; s2: string }>;

type GroupMatch = {
  id: string;
  group: string;
  round: number;
  p1: string;
  p2: string;
  s1: string;
  s2: string;
  court: string;
  status: MatchStatus;
};

type DrawMatch = {
  id: string;
  round: string;
  p1: string;
  p2: string;
  next: string | null;
  slot: "p1" | "p2" | null;
};

type Category = {
  id: string;
  name: string;
  numberOfGroups: number;
  playersPerGroup: number;
  topQualify: number;
  matchFormat: MatchFormat;
  players: PlayerMap;
  groupMatches: GroupMatch[];
  mainScores: ScoreMap;
  loserScores: ScoreMap;
  mainMeta: MatchMeta;
  loserMeta: MatchMeta;
};

type OrderMatch = {
  id: string;
  title: string;
  court: string;
  matchNo: number;
  p1: string;
  p2: string;
  category: string;
  categoryId: string;
  time: string;
};

function generateGroups(count: number) {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

function generateCourts(indoor: number, outdoor: number): Court[] {
  return [
    ...Array.from({ length: indoor }, (_, i) => ({
      id: `indoor-${i + 1}`,
      name: `Indoor Court ${i + 1}`,
    })),
    ...Array.from({ length: outdoor }, (_, i) => ({
      id: `outdoor-${i + 1}`,
      name: `Outdoor Court ${i + 1}`,
    })),
  ];
}

function makePlayers(groups: string[], playersPerGroup: number): PlayerMap {
  
  const players: PlayerMap = {};

  groups.forEach((g) => {
    for (let i = 1; i <= playersPerGroup; i++) {
      players[`${g}${i}`] = "";
    }
  });

  return players;
}

function makeRoundRobinMatches(
  groups: string[],
  playersPerGroup: number,
  categoryPrefix: string = ""
): GroupMatch[] {
  const matches: GroupMatch[] = [];

  groups.forEach((g) => {
    let players = Array.from(
      { length: playersPerGroup },
      (_, i) => `${g}${i + 1}`
    );

    if (players.length % 2 === 1) {
      players.push("BYE");
    }

    const totalRounds = players.length - 1;
    const matchesPerRound = players.length / 2;

    for (let round = 0; round < totalRounds; round++) {
      for (let i = 0; i < matchesPerRound; i++) {
        const p1 = players[i];
        const p2 = players[players.length - 1 - i];

        if (p1 !== "BYE" && p2 !== "BYE") {
          matches.push({
            id: `${categoryPrefix}-${g}-R${round + 1}-${p1}-${p2}`,
            group: g,
            round: round + 1,
            p1,
            p2,
            s1: "",
            s2: "",
            court: "",
            status: "Waiting",
          });
        }
      }

      const fixed = players[0];

      players = [
        fixed,
        players[players.length - 1],
        ...players.slice(1, players.length - 1),
      ];
    }
  });

  return matches;
}

function nextPowerOfTwo(num: number) {
  let power = 1;
  while (power < num) power *= 2;
  return power;
}

function roundName(playersLeft: number) {
  if (playersLeft === 2) return "Final";
  if (playersLeft === 4) return "Semi Final";
  if (playersLeft === 8) return "Quarter Final";
  if (playersLeft === 16) return "Round of 16";
  if (playersLeft === 32) return "Round of 32";
  return `Round of ${playersLeft}`;
}

function buildBracket(prefix: string, entrants: string[]): DrawMatch[] {
  if (entrants.length < 2) return [];

  const size = nextPowerOfTwo(entrants.length);
  const seeds = [...entrants];

  while (seeds.length < size) {
    seeds.push("BYE");
  }

  const matches: DrawMatch[] = [];
  let roundSize = size;
  let round = 1;

  while (roundSize >= 2) {
    const matchCount = roundSize / 2;
    const currentRound = roundName(roundSize);
    const nextRound = roundSize / 2 >= 2 ? round + 1 : null;

    for (let i = 0; i < matchCount; i++) {
      const id = `${prefix}-R${round}M${i + 1}`;
      const next =
        nextRound !== null
          ? `${prefix}-R${nextRound}M${Math.ceil((i + 1) / 2)}`
          : null;

      matches.push({
        id,
        round: currentRound,
        p1: round === 1 ? seeds[i] : "",
        p2: round === 1 ? seeds[size - 1 - i] : "",
        next,
        slot: next ? ((i + 1) % 2 === 1 ? "p1" : "p2") : null,
      });
    }

    roundSize = roundSize / 2;
    round++;
  }

  return matches;
}

function isMatchComplete(a: number, b: number, format: MatchFormat) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);

  if (a === b) return false;

  if (format === "SHORT_SET_4") {
    return high >= 4 && high > low;
  }

  if (format === "NORMAL_SET_6") {
    if (high >= 6 && high - low >= 2) return true;
    if (high === 7 && low === 5) return true;
    if (high === 7 && low === 6) return true;
    return false;
  }

  if (format === "PRO_SET_8") {
    if (high >= 8 && high - low >= 2) return true;
    if (high === 9 && low === 7) return true;
    if (high === 9 && low === 8) return true;
    return false;
  }

  return false;
}

function getWinner(
  match: DrawMatch | undefined,
  scores: ScoreMap,
  format: MatchFormat
): string {
  if (!match) return "";

  if (!match.p1 || !match.p2 || match.p1 === "BYE" || match.p2 === "BYE") {
    if (match.p1 && match.p2 === "BYE") return match.p1;
    if (match.p2 && match.p1 === "BYE") return match.p2;
    return "";
  }

  const s = scores[match.id];

  if (!s || s.s1 === "" || s.s2 === "") return "";

  const a = Number(s.s1);
  const b = Number(s.s2);

  if (!isMatchComplete(a, b, format)) return "";

  return a > b ? match.p1 : match.p2;
}

function resolveDraw(
  template: DrawMatch[],
  scores: ScoreMap,
  format: MatchFormat
): DrawMatch[] {
  const matches = template.map((m) => ({ ...m }));

  for (let loop = 0; loop < 10; loop++) {
    matches.forEach((m) => {
      const winner = getWinner(m, scores, format);

      if (winner && m.next && m.slot) {
        const next = matches.find((x) => x.id === m.next);
        if (next) next[m.slot] = winner;
      }
    });
  }

  return matches;
}

function playerName(players: PlayerMap, code: string): string {
  if (!code) return "TBD";
  if (code === "BYE") return "BYE";
  return players[code]?.trim() || code;
}

function isSearchedPlayer(
  players: PlayerMap,
  code: string,
  playerSearch: string
) {
  const search = playerSearch.trim().toLowerCase();
  if (!search || !code) return false;

  const name = players[code]?.trim().toLowerCase() || "";

  return code.toLowerCase() === search || name === search;
}

type RankingRow = {
  playerCode: string;
  playerName: string;
  category: string;
  played: number;
  wins: number;
  losses: number;
  titles: number;
  points: number;
};

function getPointSystem(categoryName: string) {
  const isOpen = categoryName.toLowerCase().includes("open");

  return isOpen
    ? {
        participation: 15,
        groupWin: 8,
        mainQF: 20,
        mainSF: 35,
        runnerUp: 60,
        champion: 100,
        loserRunnerUp: 25,
        loserChampion: 40,
      }
    : {
        participation: 10,
        groupWin: 5,
        mainQF: 15,
        mainSF: 25,
        runnerUp: 40,
        champion: 60,
        loserRunnerUp: 15,
        loserChampion: 25,
      };
}

function calculateCategoryRanking(category: Category): RankingRow[] {
  const points = getPointSystem(category.name);

  const ranking: Record<string, RankingRow> = {};

  Object.entries(category.players).forEach(([code, name]) => {
    if (!name.trim()) return;

    ranking[code] = {
      playerCode: code,
      playerName: name.trim(),
      category: category.name,
      played: 0,
      wins: 0,
      losses: 0,
      titles: 0,
      points: points.participation,
    };
  });

  category.groupMatches.forEach((m) => {
    if (!ranking[m.p1] || !ranking[m.p2]) return;
    if (m.s1 === "" || m.s2 === "") return;

    const s1 = Number(m.s1);
    const s2 = Number(m.s2);

    if (!isMatchComplete(s1, s2, category.matchFormat)) return;

    ranking[m.p1].played++;
    ranking[m.p2].played++;

    if (s1 > s2) {
      ranking[m.p1].wins++;
      ranking[m.p2].losses++;
      ranking[m.p1].points += points.groupWin;
    } else {
      ranking[m.p2].wins++;
      ranking[m.p1].losses++;
      ranking[m.p2].points += points.groupWin;
    }
  });

 

  const groupTable: Record<string, any[]> = {};
const groups = generateGroups(category.numberOfGroups);

groups.forEach((g) => {
  groupTable[g] = Array.from(
    { length: category.playersPerGroup },
    (_, i) => ({
      code: `${g}${i + 1}`,
      win: 0,
      gf: 0,
      ga: 0,
      diff: 0,
    })
  );
});

category.groupMatches.forEach((m) => {
  if (m.s1 === "" || m.s2 === "") return;

  const s1 = Number(m.s1);
  const s2 = Number(m.s2);

  if (!isMatchComplete(s1, s2, category.matchFormat)) return;

  const p1 = groupTable[m.group]?.find((p) => p.code === m.p1);
  const p2 = groupTable[m.group]?.find((p) => p.code === m.p2);

  if (!p1 || !p2) return;

  p1.gf += s1;
  p1.ga += s2;
  p2.gf += s2;
  p2.ga += s1;

  if (s1 > s2) {
    p1.win++;
  } else {
    p2.win++;
  }

  p1.diff = p1.gf - p1.ga;
  p2.diff = p2.gf - p2.ga;
});

groups.forEach((g) => {
  groupTable[g].sort(
    (a, b) =>
      b.win - a.win ||
      b.diff - a.diff ||
      b.gf - a.gf ||
      a.code.localeCompare(b.code)
  );
});

const mainEntrants = groups.flatMap(
  (g) =>
    groupTable[g]
      ?.slice(0, category.topQualify)
      .map((p) => p.code) || []
);

const loserEntrants = groups.flatMap(
  (g) =>
    groupTable[g]
      ?.slice(category.topQualify)
      .map((p) => p.code) || []
);

const addDrawPoints = (
  matches: DrawMatch[],
  scores: ScoreMap,
  isLoserPool: boolean
) => {
  matches.forEach((m) => {
    const winner = getWinner(m, scores, category.matchFormat);

    if (!winner || !ranking[winner]) return;

    if (m.round === "Quarter Final") {
      ranking[winner].points += isLoserPool ? 5 : points.mainQF;
    }

    if (m.round === "Semi Final") {
      ranking[winner].points += isLoserPool ? 10 : points.mainSF;
    }

    if (m.round === "Final") {
  const loser = winner === m.p1 ? m.p2 : m.p1;

  ranking[winner].points += isLoserPool
    ? points.loserChampion
    : points.champion;

  ranking[winner].titles++;

  if (loser && ranking[loser]) {
    ranking[loser].points += isLoserPool
      ? points.loserRunnerUp
      : points.runnerUp;
  }
}
  });
};

addDrawPoints(
  resolveDraw(
    buildBracket("MAIN", mainEntrants),
    category.mainScores,
    category.matchFormat
  ),
  category.mainScores,
  false
);

addDrawPoints(
  resolveDraw(
    buildBracket("LOSER", loserEntrants),
    category.loserScores,
    category.matchFormat
  ),
  category.loserScores,
  true
);



  return Object.values(ranking).sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      a.losses - b.losses ||
      a.playerName.localeCompare(b.playerName)
  );
}

function buildRoundRobinRounds(matches: GroupMatch[]) {
  return [...matches].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.group.localeCompare(b.group);
  });
}


function formatLabel(format: MatchFormat) {
  if (format === "SHORT_SET_4") return "Short Set - First to 4";
  if (format === "NORMAL_SET_6") return "Normal Set - First to 6";
  return "Pro Set - First to 8";
}

function getMatchDuration(format: MatchFormat) {
  if (format === "SHORT_SET_4") return 20;
  if (format === "NORMAL_SET_6") return 30;
  if (format === "PRO_SET_8") return 40;
  return 20;
}

function createCategory(name: string): Category {
  const numberOfGroups = 4;
  const playersPerGroup = 5;
  const groups = generateGroups(numberOfGroups);

  return {
    id: crypto.randomUUID(),
    name,
    numberOfGroups,
    playersPerGroup,
    topQualify: 2,
    matchFormat: "SHORT_SET_4",
    players: makePlayers(groups, playersPerGroup),
    groupMatches: makeRoundRobinMatches(
  groups,
  playersPerGroup,
  name.replace(/\s+/g, "-").toLowerCase()
),
    mainScores: {},
    loserScores: {},
    mainMeta: {},
    loserMeta: {},
  };
}

function hasPlayerConflict(match: { p1: string; p2: string }, usedPlayers: Set<string>) {
  return usedPlayers.has(match.p1) || usedPlayers.has(match.p2);
}

type AppProps = {
  viewMode: "admin" | "player" | "ranking" | "activity" | "activityDetail";
};

export default function App({ viewMode }: AppProps) {

  useEffect(() => {
  const loadActivities = async () => {
    const snapshot = await getDocs(
      collection(db, "tournaments")
    );

    const activities = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (tournament: any) =>
          tournament.status === "closed"
      );

    setTournamentActivities(activities);
  };

  loadActivities();
}, []);
  
  const [categories, setCategories] = useState<Category[]>(() => [
    createCategory("Open Category"),
    createCategory("Beginner Category"),
  ]);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [tournamentName, setTournamentName] = useState("Tennis Tournament Manager");
  const [tournamentDate, setTournamentDate] = useState(
  new Date().toISOString().split("T")[0]
);
  const [indoorCourts, setIndoorCourts] = useState(5);
  const [outdoorCourts, setOutdoorCourts] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [orderOfPlay, setOrderOfPlay] = useState<OrderMatch[]>([]);
 useEffect(() => {
  console.log("ORDER OF PLAY COUNT", orderOfPlay.length);

  const ids = orderOfPlay.map((m) => m.id);
  console.log("DUPLICATES", ids);
}, [orderOfPlay]);
  const [isLoaded, setIsLoaded] = useState(false);
  const tournamentDocRef = doc(db, "tournaments", "jb-monthly-medal");
  console.log("APP LOADED");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [openPlayerSections, setOpenPlayerSections] = useState({
  grouping: true,
  matches: true,
  main: true,
  loser: true,
  order: true,
});
  const [playerSearch, setPlayerSearch] = useState("");

const togglePlayerSection = (key: keyof typeof openPlayerSections) => {
  setOpenPlayerSections((prev) => ({
    ...prev,
    [key]: !prev[key],
  }));
};

const [tournamentActivities, setTournamentActivities] = useState<any[]>([]);
const [currentTournamentId, setCurrentTournamentId] = useState<string>("");



const isPlayerView = viewMode === "player";
  const activeCategory =
    categories.find((cat) => cat.id === activeCategoryId) || categories[0];

    const rankingRows = useMemo(() => {
  return categories.flatMap((cat) =>
    calculateCategoryRanking(cat)
  );
}, [categories]);

console.log("RANKING TEST");
console.log(rankingRows);

  const groups = useMemo(
    () => generateGroups(activeCategory.numberOfGroups),
    [activeCategory.numberOfGroups]
  );

  const courts = useMemo(
    () => generateCourts(indoorCourts, outdoorCourts),
    [indoorCourts, outdoorCourts]
  );

  

  const updateActiveCategory = (updates: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === activeCategory.id
          ? {
              ...cat,
              ...updates,
            }
          : cat
      )
    );
  };

  const deleteCategory = (categoryId: string) => {
  if (categories.length <= 1) return;

  const remaining = categories.filter((cat) => cat.id !== categoryId);

  setCategories(remaining);

  if (activeCategoryId === categoryId) {
    setActiveCategoryId(remaining[0].id);
  }
};

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategoryId(categories[0].id);
    }
  }, [activeCategoryId, categories]);

 
  
  useEffect(() => {
  const unsubscribe = onSnapshot(tournamentDocRef, (snapshot) => {
    console.log("SNAPSHOT EXISTS:", snapshot.exists());

    if (snapshot.exists()) {
      const data = snapshot.data();
      console.log("FIREBASE DATA:", data);

      if (data.categories?.length) {
        setCategories(data.categories);
        setActiveCategoryId(data.activeCategoryId || data.categories[0].id);
      }

      setTournamentName(data.tournamentName || "Tennis Tournament Manager");
      setTournamentDate(
  data.tournamentDate ||
  new Date().toISOString().split("T")[0]
);
      setIndoorCourts(data.indoorCourts ?? 5);
      setOutdoorCourts(data.outdoorCourts ?? 0);
      setStartTime(data.startTime || "08:00");
      setOrderOfPlay(data.orderOfPlay || []);
    }

    setIsLoaded(true);
  });

  

  return () => unsubscribe();
}, []);





  


  const standings = useMemo(() => {
    const table: Record<string, any[]> = {};

    groups.forEach((g) => {
      table[g] = Array.from({ length: activeCategory.playersPerGroup }, (_, i) => ({
        code: `${g}${i + 1}`,
        played: 0,
        win: 0,
        lose: 0,
        gf: 0,
        ga: 0,
        diff: 0,
      }));
    });

    activeCategory.groupMatches.forEach((m) => {
      if (m.s1 === "" || m.s2 === "") return;

      const a = Number(m.s1);
      const b = Number(m.s2);

      if (!isMatchComplete(a, b, activeCategory.matchFormat)) return;

      const p1 = table[m.group]?.find((p) => p.code === m.p1);
      const p2 = table[m.group]?.find((p) => p.code === m.p2);

      if (!p1 || !p2) return;

      p1.played++;
      p2.played++;

      p1.gf += a;
      p1.ga += b;

      p2.gf += b;
      p2.ga += a;

      if (a > b) {
        p1.win++;
        p2.lose++;
      } else {
        p2.win++;
        p1.lose++;
      }

      p1.diff = p1.gf - p1.ga;
      p2.diff = p2.gf - p2.ga;
    });

    groups.forEach((g) => {
      table[g].sort(
        (a, b) =>
          b.win - a.win ||
          b.diff - a.diff ||
          b.gf - a.gf ||
          a.code.localeCompare(b.code)
      );
    });

    return table;
  }, [groups, activeCategory]);

  const mainEntrants = useMemo(() => {
    return groups.flatMap(
      (g) =>
        standings[g]
          ?.slice(0, activeCategory.topQualify)
          .map((p) => p.code) || []
    );
  }, [groups, standings, activeCategory.topQualify]);

  const loserEntrants = useMemo(() => {
    return groups.flatMap(
      (g) =>
        standings[g]
          ?.slice(activeCategory.topQualify)
          .map((p) => p.code) || []
    );
  }, [groups, standings, activeCategory.topQualify]);

  const mainTemplate = useMemo(
    () => buildBracket("MAIN", mainEntrants),
    [mainEntrants]
  );

  const loserTemplate = useMemo(
    () => buildBracket("LOSER", loserEntrants),
    [loserEntrants]
  );

  const mainMatches = useMemo(
    () =>
      resolveDraw(
        mainTemplate,
        activeCategory.mainScores,
        activeCategory.matchFormat
      ),
    [mainTemplate, activeCategory.mainScores, activeCategory.matchFormat]
  );

  const loserMatches = useMemo(
    () =>
      resolveDraw(
        loserTemplate,
        activeCategory.loserScores,
        activeCategory.matchFormat
      ),
    [loserTemplate, activeCategory.loserScores, activeCategory.matchFormat]
  );

  const mainChampion = getWinner(
    mainMatches[mainMatches.length - 1],
    activeCategory.mainScores,
    activeCategory.matchFormat
  );

  const loserChampion = getWinner(
  loserMatches[loserMatches.length - 1],
  activeCategory.loserScores,
  activeCategory.matchFormat
);



  const searchedPlayerCodes = Object.entries(activeCategory.players)
  .filter(([code, name]) => {
    const search = playerSearch.trim().toLowerCase();

    if (!search) return false;

    return (
      code.toLowerCase() === search ||
      (name || "").toLowerCase().includes(search)
    );
  })
  .map(([code]) => code);

  const playerFound =
  playerSearch.trim() === "" ||
  searchedPlayerCodes.length > 0;
  
  const playerSuggestions = Object.entries(activeCategory.players)
  .filter(([code, name]) => {
    const search = playerSearch.trim().toLowerCase();

    if (!search) return false;

    return (
      code.toLowerCase().startsWith(search) ||
      (name || "").toLowerCase().startsWith(search)
    );
  })
  .slice(0, 5);

  
  const generateTournament = () => {
    const newGroups = generateGroups(activeCategory.numberOfGroups);

    updateActiveCategory({
      players: makePlayers(newGroups, activeCategory.playersPerGroup),
      groupMatches: makeRoundRobinMatches(
  newGroups,
  activeCategory.playersPerGroup,
  activeCategory.name.replace(/\s+/g, "-").toLowerCase()
),
      mainScores: {},
      loserScores: {},
      mainMeta: {},
      loserMeta: {},
    });

    setOrderOfPlay([]);
  };

  const resetScores = () => {
    const newGroups = generateGroups(activeCategory.numberOfGroups);

    updateActiveCategory({
      groupMatches: makeRoundRobinMatches(
  newGroups,
  activeCategory.playersPerGroup,
  activeCategory.name.replace(/\s+/g, "-").toLowerCase()
),
      mainScores: {},
      loserScores: {},
      mainMeta: {},
      loserMeta: {},
    });

    setOrderOfPlay([]);
  };

const createNewTournament = async () => {
  const data = {
  categories,
  activeCategoryId,
  tournamentName,
  tournamentDate,
  indoorCourts,
  outdoorCourts,
  startTime,
  orderOfPlay,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

  const docRef = await addDoc(collection(db, "tournaments"), data);

  setCurrentTournamentId(docRef.id);

  await setDoc(doc(db, "currentTournament", "live"), {
    tournamentId: docRef.id,
  });

  alert("New tournament created");
};

const saveTournamentToFirebase = async () => {
  if (!currentTournamentId) {
    alert("Please create tournament first");
    return;
  }

 const data = {
  categories,
  activeCategoryId,
  tournamentName,
  tournamentDate,
  indoorCourts,
  outdoorCourts,
  startTime,
  orderOfPlay,
  status: "active",
  updatedAt: new Date().toISOString(),
};

  await updateDoc(doc(db, "tournaments", currentTournamentId), data);

  alert("Live tournament updated");
};

const closeTournament = async () => {
  if (!currentTournamentId) {
    alert("No active tournament to close");
    return;
  }

  const confirmClose = confirm(
    "Close this tournament and move it to Tournament Activity?"
  );

  if (!confirmClose) return;

  await updateDoc(doc(db, "tournaments", currentTournamentId), {
    status: "closed",
    closedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  setCurrentTournamentId("");

  alert("Tournament closed and saved to activity");
};

  const updateGroupScore = (id: string, key: "s1" | "s2", value: string) => {
    updateActiveCategory({
      groupMatches: activeCategory.groupMatches.map((m) =>
        m.id === id ? { ...m, [key]: value } : m
      ),
    });
  };

  const updateOrderOfPlay = (
  id: string,
  field: "time" | "court",
  value: string
) => {
  setOrderOfPlay((prev) =>
    prev.map((match) =>
      match.id === id
        ? {
            ...match,
            [field]: value,
          }
        : match
    )
  );
};

  const updateGroupMatchMeta = (
    id: string,
    key: "court" | "status",
    value: string
  ) => {
    updateActiveCategory({
      groupMatches: activeCategory.groupMatches.map((m) =>
        m.id === id ? { ...m, [key]: value } : m
      ),
    });
  };

  const updateDrawScore = (
    drawType: "main" | "loser",
    id: string,
    key: "s1" | "s2",
    value: string
  ) => {
    const currentScores =
      drawType === "main"
        ? activeCategory.mainScores
        : activeCategory.loserScores;

    const updatedScores = {
      ...currentScores,
      [id]: {
        s1: currentScores[id]?.s1 || "",
        s2: currentScores[id]?.s2 || "",
        [key]: value,
      },
    };

    updateActiveCategory(
      drawType === "main"
        ? { mainScores: updatedScores }
        : { loserScores: updatedScores }
    );
  };

  const updateDrawMeta = (
    drawType: "main" | "loser",
    id: string,
    key: "court" | "status",
    value: string
  ) => {
    const currentMeta =
      drawType === "main" ? activeCategory.mainMeta : activeCategory.loserMeta;

    const updatedMeta = {
      ...currentMeta,
      [id]: {
        ...(currentMeta[id] || {
          court: "",
          status: "Waiting" as MatchStatus,
        }),
        [key]: value,
      },
    };

    updateActiveCategory(
      drawType === "main"
        ? { mainMeta: updatedMeta }
        : { loserMeta: updatedMeta }
    );
  };

  const autoAssignCourts = () => {
    if (courts.length === 0) return;

    const updatedGroupMatches = activeCategory.groupMatches.map((match, index) => ({
      ...match,
      court: courts[index % courts.length].name,
      status: "Waiting" as MatchStatus,
    }));

    const updatedMainMeta: MatchMeta = {};

    mainMatches.forEach((match, index) => {
      updatedMainMeta[match.id] = {
        court: courts[index % courts.length].name,
        status: "Waiting",
      };
    });

    const updatedLoserMeta: MatchMeta = {};

    loserMatches.forEach((match, index) => {
      updatedLoserMeta[match.id] = {
        court: courts[index % courts.length].name,
        status: "Waiting",
      };
    });

    updateActiveCategory({
      groupMatches: updatedGroupMatches,
      mainMeta: updatedMainMeta,
      loserMeta: updatedLoserMeta,
    });
  };

  const generateOrderOfPlay = () => {
  if (courts.length === 0) return;

  const [hour, minute] = startTime.split(":").map(Number);
  const baseMinutes = hour * 60 + minute;

  const sortedCategories = [...categories].sort((a, b) => {
    const aBeginner = a.name.toLowerCase().includes("beginner");
    const bBeginner = b.name.toLowerCase().includes("beginner");

    if (aBeginner && !bBeginner) return -1;
    if (!aBeginner && bBeginner) return 1;

    return 0;
  });

  const scheduled: OrderMatch[] = [];
  let slotIndex = 0;
  let matchCounter = 1;

  const addMatchesToSchedule = (
    matches: {
      id: string;
      title: string;
      p1: string;
      p2: string;
      category: string;
      categoryId: string;
      format: MatchFormat;
    }[]
  ) => {
    const remaining = matches.filter(
      (m) => m.p1 && m.p2 && m.p1 !== "BYE" && m.p2 !== "BYE"
    );

    const lastPlayedSlot: Record<string, number> = {};

    while (remaining.length > 0) {
      const usedPlayersThisSlot = new Set<string>();

      for (let courtIndex = 0; courtIndex < courts.length; courtIndex++) {
        let selectedIndex = remaining.findIndex((match) => {
          const p1Last = lastPlayedSlot[match.p1];
          const p2Last = lastPlayedSlot[match.p2];

          const p1Rested = p1Last === undefined || slotIndex - p1Last > 1;
          const p2Rested = p2Last === undefined || slotIndex - p2Last > 1;

          return (
            p1Rested &&
            p2Rested &&
            !hasPlayerConflict(match, usedPlayersThisSlot)
          );
        });

        if (selectedIndex === -1) {
          selectedIndex = remaining.findIndex(
            (match) => !hasPlayerConflict(match, usedPlayersThisSlot)
          );
        }

        if (selectedIndex === -1) break;

        const match = remaining.splice(selectedIndex, 1)[0];

        usedPlayersThisSlot.add(match.p1);
        usedPlayersThisSlot.add(match.p2);

        lastPlayedSlot[match.p1] = slotIndex;
        lastPlayedSlot[match.p2] = slotIndex;

        const duration = getMatchDuration(match.format);
        const start = baseMinutes + slotIndex * duration;

        const h = Math.floor(start / 60);
        const min = start % 60;

        scheduled.push({
          id: match.id,
          title: match.title,
          p1: match.p1,
          p2: match.p2,
          category: match.category,
          categoryId: match.categoryId,
          court: courts[courtIndex].name,
          matchNo: matchCounter++,
          time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
        });

        if (remaining.length === 0) break;
      }

      slotIndex++;
    }
  };

  sortedCategories.forEach((cat) => {
    const catGroups = generateGroups(cat.numberOfGroups);

    const table: Record<string, any[]> = {};

    catGroups.forEach((g) => {
      table[g] = Array.from({ length: cat.playersPerGroup }, (_, i) => ({
        code: `${g}${i + 1}`,
        played: 0,
        win: 0,
        lose: 0,
        gf: 0,
        ga: 0,
        diff: 0,
      }));
    });

    cat.groupMatches.forEach((m) => {
      if (m.s1 === "" || m.s2 === "") return;

      const a = Number(m.s1);
      const b = Number(m.s2);

      if (!isMatchComplete(a, b, cat.matchFormat)) return;

      const p1 = table[m.group]?.find((p) => p.code === m.p1);
      const p2 = table[m.group]?.find((p) => p.code === m.p2);

      if (!p1 || !p2) return;

      p1.played++;
      p2.played++;

      p1.gf += a;
      p1.ga += b;

      p2.gf += b;
      p2.ga += a;

      if (a > b) {
        p1.win++;
        p2.lose++;
      } else {
        p2.win++;
        p1.lose++;
      }

      p1.diff = p1.gf - p1.ga;
      p2.diff = p2.gf - p2.ga;
    });

    catGroups.forEach((g) => {
      table[g].sort(
        (a, b) =>
          b.win - a.win ||
          b.diff - a.diff ||
          b.gf - a.gf ||
          a.code.localeCompare(b.code)
      );
    });

    const groupStageMatches = buildRoundRobinRounds(cat.groupMatches).map((m) => ({
  id: m.id,
  title: `Group ${m.group} • Round ${m.round}`,
  p1: m.p1,
  p2: m.p2,
  category: cat.name,
      categoryId: cat.id,
      format: cat.matchFormat,
    }));

    addMatchesToSchedule(groupStageMatches);

    const mainEntrantsForCat = catGroups.flatMap(
      (g) => table[g]?.slice(0, cat.topQualify).map((p) => p.code) || []
    );

    const loserEntrantsForCat = catGroups.flatMap(
      (g) => table[g]?.slice(cat.topQualify).map((p) => p.code) || []
    );

    const mainDrawMatches = buildBracket("MAIN", mainEntrantsForCat)
  .filter((m) => m.p1 && m.p2)
  .map((m) => ({
    id: m.id,
    title: `${m.round}`,
    p1: m.p1,
    p2: m.p2,
    category: `${cat.name} | Main Draw`,
    categoryId: cat.id,
    format: cat.matchFormat,
  }));

    addMatchesToSchedule(mainDrawMatches);

    const loserPoolMatches = buildBracket("LOSER", loserEntrantsForCat)
  .filter((m) => m.p1 && m.p2)
  .map((m) => ({
    id: m.id,
    title: `${m.round}`,
    p1: m.p1,
    p2: m.p2,
    category: `${cat.name} | Losers Pool`,
    categoryId: cat.id,
    format: cat.matchFormat,
  }));

    addMatchesToSchedule(loserPoolMatches);
  });

  setOrderOfPlay(scheduled);
};

  const resetTournament = () => {
    

    const freshCategories = [
      createCategory("Open Category"),
      createCategory("Beginner Category"),
    ];

    setCategories(freshCategories);
    setActiveCategoryId(freshCategories[0].id);
    setTournamentName("Tennis Tournament Manager");
    setTournamentDate("2026-06-21");
    setIndoorCourts(5);
    setOutdoorCourts(0);
    setStartTime("08:00");
    setOrderOfPlay([]);
  };

  const exportTournament = () => {
  const data = {
    categories,
    activeCategoryId,
    tournamentName,
    indoorCourts,
    outdoorCourts,
    startTime,
    orderOfPlay,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${tournamentName.replace(/\s+/g, "_")}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

const importTournament = (file: File) => {
  const reader = new FileReader();

  reader.onload = (event) => {
    const text = event.target?.result;

    if (typeof text !== "string") return;

    const data = JSON.parse(text);

    if (data.categories?.length) {
      setCategories(data.categories);
      setActiveCategoryId(data.activeCategoryId || data.categories[0].id);
    }

    setTournamentName(data.tournamentName || "Tennis Tournament Manager");
    setIndoorCourts(data.indoorCourts ?? 5);
    setOutdoorCourts(data.outdoorCourts ?? 0);
    setStartTime(data.startTime || "08:00");
    setOrderOfPlay(data.orderOfPlay || []);
  };

  reader.readAsText(file);
};

const exportPDF = () => {
  window.print();
};


if (viewMode === "admin" && !isAdminAuthenticated) {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-3xl w-full max-w-md text-white">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>

        <Input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="Enter admin password"
          className="bg-neutral-950 border-neutral-600 rounded-xl text-white mb-4"
          onKeyDown={(e) => {
            if (e.key === "Enter" && adminPassword === ADMIN_PASSWORD) {
              setIsAdminAuthenticated(true);
            }
          }}
        />

        <Button
          onClick={() => {
            if (adminPassword === ADMIN_PASSWORD) {
              setIsAdminAuthenticated(true);
            } else {
              alert("Wrong password");
            }
          }}
          className="w-full rounded-2xl bg-lime-500 hover:bg-lime-600 text-black font-bold"
        >
          Login
        </Button>
      </div>
    </div>
  );
}

if (viewMode === "ranking") {
  return <RankingView rankingRows={rankingRows} />;
}

if (viewMode === "activity") {
  return <TournamentActivityPage activities={tournamentActivities} />;
}

if (viewMode === "activityDetail") {
  return <PastTournamentResultPage />;
}

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
  {tournamentName}
</h1>

<p className="text-neutral-200 mt-2 font-medium">
  {viewMode === "admin"
    ? "Tournament Management Dashboard"
    : "Live Tournament Results & Schedule"}
</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
  {viewMode === "admin" && (
    <>
      <Button
  onClick={createNewTournament}
  className="rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold"
>
  Create Tournament
</Button>

<Button
  onClick={saveTournamentToFirebase}
  className="rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
>
  Save Live
</Button>

<Button
  onClick={closeTournament}
  className="rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold"
>
  Close Tournament
</Button>

      <Button
  onClick={() => window.open("/playerview", "_blank")}
  className="rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
>
  Open Player View
</Button>




    </>
  )}

  
</div>
        </div>
{viewMode === "admin" && (
  <>
        <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Settings />
              Tournament Setup
            </h2>

            <div className="flex flex-wrap items-center gap-3">
  {categories.map((cat) => (
    <div
      key={cat.id}
      className={
        activeCategory.id === cat.id
          ? "flex items-center gap-2 rounded-2xl bg-lime-500 p-2 text-black transition-all duration-300 scale-105 shadow-lg shadow-lime-500/30"
          : "flex items-center gap-2 rounded-2xl bg-neutral-800 p-2 text-white transition-all duration-300 hover:bg-neutral-700"
      }
    >
      <Input
        value={cat.name}
        onClick={() => setActiveCategoryId(cat.id)}
        onChange={(e) =>
          setCategories((prev) =>
            prev.map((item) =>
              item.id === cat.id ? { ...item, name: e.target.value } : item
            )
          )
        }
        className={
          activeCategory.id === cat.id
            ? "h-9 w-44 bg-lime-100 border-lime-700 text-black font-bold rounded-xl"
            : "h-9 w-44 bg-neutral-950 border-neutral-600 text-white font-bold rounded-xl"
        }
      />

      <Button
        type="button"
        onClick={() => deleteCategory(cat.id)}
        disabled={categories.length <= 1}
        className={
          categories.length <= 1
            ? "h-8 px-2 rounded-xl bg-neutral-600 text-neutral-300 cursor-not-allowed"
            : "h-8 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
        }
      >
        X
      </Button>
    </div>
  ))}

  <Button
    onClick={() => {
      const newCategory = createCategory(`Category ${categories.length + 1}`);
      setCategories((prev) => [...prev, newCategory]);
      setActiveCategoryId(newCategory.id);
    }}
   className="self-center h-[52px] px-5 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-lg"
  >
    + Add Category
  </Button>
</div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Tournament Name
                </label>
                <Input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>
              <div className="space-y-2">
  <label className="text-sm text-neutral-200 font-semibold">
    Tournament Date
  </label>
  <Input
  type="date"
  value={tournamentDate}
  onChange={(e) => setTournamentDate(e.target.value)}
  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
  style={{ colorScheme: "dark" }}
/>
</div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Category Name
                </label>
                <Input
                  value={activeCategory.name}
                  onChange={(e) => updateActiveCategory({ name: e.target.value })}
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Number of Groups
                </label>
                <Input
                  type="number"
                  min={1}
                  max={26}
                  value={activeCategory.numberOfGroups}
                  onChange={(e) =>
                    updateActiveCategory({
                      numberOfGroups: Number(e.target.value),
                    })
                  }
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Players / Group
                </label>
                <Input
                  type="number"
                  min={2}
                  value={activeCategory.playersPerGroup}
                  onChange={(e) =>
                    updateActiveCategory({
                      playersPerGroup: Number(e.target.value),
                    })
                  }
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Top Qualify
                </label>
                <Input
                  type="number"
                  min={1}
                  max={activeCategory.playersPerGroup}
                  value={activeCategory.topQualify}
                  onChange={(e) =>
                    updateActiveCategory({
                      topQualify: Number(e.target.value),
                    })
                  }
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Format
                </label>
                <select
                  value={activeCategory.matchFormat}
                  onChange={(e) =>
                    updateActiveCategory({
                      matchFormat: e.target.value as MatchFormat,
                    })
                  }
                  className="w-full h-10 bg-neutral-950 border border-neutral-600 rounded-xl text-white font-semibold px-3"
                >
                  <option value="SHORT_SET_4">Short Set - First to 4</option>
                  <option value="NORMAL_SET_6">Normal Set - First to 6</option>
                  <option value="PRO_SET_8">Pro Set - First to 8</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Indoor Courts
                </label>
                <Input
                  type="number"
                  min={0}
                  value={indoorCourts}
                  onChange={(e) => setIndoorCourts(Number(e.target.value))}
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Outdoor Courts
                </label>
                <Input
                  type="number"
                  min={0}
                  value={outdoorCourts}
                  onChange={(e) => setOutdoorCourts(Number(e.target.value))}
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-200 font-semibold">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-neutral-950 border-neutral-600 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="space-y-2">
  <label className="text-sm text-neutral-200 font-semibold opacity-0">
    Actions
  </label>

 
</div>
            </div>



            <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 text-sm text-lime-300 font-semibold">
              Total players:{" "}
              {activeCategory.numberOfGroups * activeCategory.playersPerGroup} |
              Main Draw:{" "}
              {activeCategory.numberOfGroups * activeCategory.topQualify} players |
              Losers Pool:{" "}
              {activeCategory.numberOfGroups *
                (activeCategory.playersPerGroup - activeCategory.topQualify)}{" "}
              players | Courts: {courts.length} | Format:{" "}
              {formatLabel(activeCategory.matchFormat)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
  <CardContent className="p-6">
    <h3 className="text-xl font-bold mb-4">
      Tournament Actions
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Button
        onClick={generateTournament}
        className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        Generate Tournament
      </Button>

      <Button
        onClick={autoAssignCourts}
        className="h-12 rounded-2xl bg-lime-600 hover:bg-lime-700 text-black font-bold"
      >
        Auto Assign Courts
      </Button>

      <Button
        onClick={generateOrderOfPlay}
        className="h-12 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
      >
        Generate Order Of Play
      </Button>
    </div>
  </CardContent>
</Card>
  </>
)}

<div className="flex flex-wrap gap-2">
  {categories.map((cat) => (
    <Button
      key={cat.id}
      onClick={() => setActiveCategoryId(cat.id)}
      className={
        activeCategory.id === cat.id
          ? "rounded-2xl bg-lime-500 text-black font-bold"
          : "rounded-2xl bg-neutral-800 text-white font-bold"
      }
    >
      {cat.name}
    </Button>
  ))}
</div>

       <div key={activeCategory.id} className="category-fade space-y-8">
        {viewMode === "player" && (
  <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
    <CardContent className="p-4 space-y-3">
      <Input
        placeholder="Search player name or code..."
        value={playerSearch}
        onChange={(e) => setPlayerSearch(e.target.value)}
        className="bg-neutral-950 border-neutral-600 rounded-xl text-white"
      />

      {playerSearch.trim() !== "" &&
        playerSuggestions.length > 0 && (
          <div className="bg-neutral-950 border border-neutral-700 rounded-2xl overflow-hidden">
            {playerSuggestions.map(([code, name]) => (
              <button
                key={code}
                type="button"
                onClick={() => setPlayerSearch(name || code)}
                className="w-full text-left px-4 py-2 hover:bg-neutral-800 text-white font-semibold"
              >
                <span className="text-lime-300 mr-2">
                  {code}
                </span>
                {name || code}
              </button>
            ))}
          </div>
        )}

      {!playerFound && (
        <div className="text-red-400 font-semibold text-sm">
          No player found for "{playerSearch}"
        </div>
      )}
    </CardContent>
  </Card>
)}
       
  {(mainChampion || loserChampion) && (
    <div className="grid md:grid-cols-2 gap-4">
      {mainChampion && (
        <Card className="bg-green-950/60 border-green-600 rounded-3xl text-white">
          <CardContent className="p-5 flex gap-3 items-center text-lg">
            <Trophy className="text-yellow-300" />
            Main Champion:
            <b className="text-yellow-300">
              {playerName(activeCategory.players, mainChampion)}
            </b>
          </CardContent>
        </Card>
      )}

      {loserChampion && (
        <Card className="bg-purple-950/60 border-purple-600 rounded-3xl text-white">
          <CardContent className="p-5 flex gap-3 items-center text-lg">
            <Trophy className="text-yellow-300" />
            Losers Pool Champion:
            <b className="text-yellow-300">
              {playerName(activeCategory.players, loserChampion)}
            </b>
          </CardContent>
        </Card>
      )}
    </div>
  )}
          <section>
  <button
    onClick={() => togglePlayerSection("grouping")}
    className="w-full flex justify-between items-center mb-4"
  >
    <div className="flex items-center gap-2 text-2xl font-bold text-white">
      <Users />
      <span>1. Grouping Draw</span>
    </div>

    <span className="text-xl text-lime-300">
      {openPlayerSections.grouping ? "▲" : "▼"}
    </span>
  </button>

  {openPlayerSections.grouping && (
    <div className="grid md:grid-cols-4 gap-4">
      {groups.map((g) => (
        <Card
          key={g}
          className="bg-neutral-900 border-neutral-700 rounded-3xl text-white"
        >
          <CardContent className="p-5 space-y-3">
            <h3 className="font-bold text-xl text-white">
              Group {g}
            </h3>

            {Array.from(
              { length: activeCategory.playersPerGroup },
              (_, i) => {
                const code = `${g}${i + 1}`;

                return (
  <div key={code} className="flex items-center gap-2">
    <span className="w-10 text-sm text-lime-300 font-bold">
      {code}
    </span>

    {viewMode === "player" ? (
      <div className="text-white font-semibold">
        {activeCategory.players[code]?.trim() || code}
      </div>
    ) : (
      <Input
        value={activeCategory.players[code] || ""}
        disabled={isPlayerView}
        onChange={(e) =>
          updateActiveCategory({
            players: {
              ...activeCategory.players,
              [code]: e.target.value,
            },
          })
        }
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData("text");

          if (!pastedText.includes("\n")) return;

          e.preventDefault();

          const names = pastedText
            .split(/\r?\n/)
            .map((name) => name.trim())
            .filter(Boolean);

          const updated = { ...activeCategory.players };

          names.forEach((name, index) => {
            const targetNumber = i + 1 + index;
            const targetCode = `${g}${targetNumber}`;

            if (targetNumber <= activeCategory.playersPerGroup) {
              updated[targetCode] = name;
            }
          });

          updateActiveCategory({
            players: updated,
          });
        }}
        placeholder={`Player ${code}`}
        className="bg-neutral-950 border-neutral-600 rounded-xl text-white placeholder:text-neutral-400 font-semibold"
      />
    )}
  </div>
);
              }
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )}
</section>

  <section>
  <button
    onClick={() => togglePlayerSection("matches")}
    className="w-full flex justify-between items-center mb-4"
  >
    <h2 className="text-2xl font-bold text-white">
      2. Group Matches, Court & Ranking
    </h2>

    <span className="text-xl text-lime-300">
      {openPlayerSections.matches ? "▲" : "▼"}
    </span>
  </button>

  {openPlayerSections.matches && (
    <div className="grid lg:grid-cols-4 gap-4">
      {groups.map((g) => (
        <Card
          key={g}
          className="bg-neutral-900 border-neutral-700 rounded-3xl text-white"
        >
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-xl text-white">
              Group {g}
            </h3>

            <div className="space-y-2">
              {activeCategory.groupMatches
  .filter((m) => {
    if (m.group !== g) return false;

    if (!playerSearch.trim()) return true;

    return (
      searchedPlayerCodes.includes(m.p1) ||
      searchedPlayerCodes.includes(m.p2)
    );
  })
                .map((m) => (
                  <div
                    key={m.id}
                    className="bg-neutral-950 p-3 rounded-2xl space-y-2 text-neutral-100 font-medium"
                  >
                            <div className="text-xs text-neutral-300 font-semibold">
  Group {m.group} • Round {m.round}
</div>

                            <div className="grid grid-cols-[1fr_56px] gap-2 items-center">
  <div className="text-white font-semibold">
    {playerName(activeCategory.players, m.p1)}
  </div>

  <Input
    type="number"
    value={m.s1}
    disabled={viewMode === "player"}
    onChange={(e) =>
      updateGroupScore(m.id, "s1", e.target.value)
    }
    className="bg-neutral-900 border-neutral-600 rounded-xl text-white font-bold text-center"
  />

  <div className="text-white font-semibold">
    {playerName(activeCategory.players, m.p2)}
  </div>

  <Input
    type="number"
    value={m.s2}
    disabled={viewMode === "player"}
    onChange={(e) =>
      updateGroupScore(m.id, "s2", e.target.value)
    }
    className="bg-neutral-900 border-neutral-600 rounded-xl text-white font-bold text-center"
  />
</div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <select
                                 value={m.court}
  disabled={viewMode === "player"}
  onChange={(e) =>
    updateGroupMatchMeta(
      m.id,
      "court",
      e.target.value
    )
  }
                                className="bg-neutral-900 border border-neutral-600 rounded-xl text-white font-semibold px-2 py-2"
                              >
                                <option value="">Select Court</option>
                                {courts.map((court) => (
                                  <option key={court.id} value={court.name}>
                                    {court.name}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={m.status}
  disabled={viewMode === "player"}
  onChange={(e) =>
    updateGroupMatchMeta(
      m.id,
      "status",
      e.target.value
    )
  }
                                className="bg-neutral-900 border border-neutral-600 rounded-xl text-white font-semibold px-2 py-2"
                              >
                                <option value="Waiting">Waiting</option>
                                <option value="On Court">On Court</option>
                                <option value="Finished">Finished</option>
                              </select>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="border-t border-neutral-700 pt-3">
                      <h4 className="font-bold mb-2 text-white">Ranking</h4>

                      <table className="w-full text-xs">
                        <thead className="text-neutral-200">
                          <tr>
                            <th className="text-left">#</th>
                            <th className="text-left">Player</th>
                            <th>W</th>
                            <th>Diff</th>
                          </tr>
                        </thead>

                        <tbody>
                          {standings[g]?.map((p, idx) => (
                            <tr
                              key={p.code}
                              className={
                                idx < activeCategory.topQualify
                                  ? "text-lime-300 font-bold"
                                  : "text-yellow-300 font-semibold"
                              }
                            >
                              <td>{idx + 1}</td>
                              <td>
                                {playerName(activeCategory.players, p.code)}
                              </td>
                              <td className="text-center">{p.win}</td>
                              <td className="text-center">{p.diff}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                           ))}
            </div>
          )}
</section>


          <section>
  <button
    onClick={() => togglePlayerSection("main")}
    className="w-full flex justify-between items-center mb-4"
  >
    <h2 className="text-2xl font-bold text-white">
      3. Main Draw
    </h2>

    <span className="text-xl text-lime-300">
      {openPlayerSections.main ? "▲" : "▼"}
    </span>
  </button>

  {openPlayerSections.main && (
    <DrawSection
      title=""
      matches={mainMatches}
      scores={activeCategory.mainScores}
      drawType="main"
      players={activeCategory.players}
      updateDrawScore={updateDrawScore}
      courts={courts}
      meta={activeCategory.mainMeta}
      updateDrawMeta={updateDrawMeta}
      matchFormat={activeCategory.matchFormat}
      playerSearch={playerSearch}
    />
  )}
</section>

<section>
  <button
    onClick={() => togglePlayerSection("loser")}
    className="w-full flex justify-between items-center mb-4"
  >
    <h2 className="text-2xl font-bold text-white">
      4. Losers Pool
    </h2>

    <span className="text-xl text-lime-300">
      {openPlayerSections.loser ? "▲" : "▼"}
    </span>
  </button>

  {openPlayerSections.loser && (
    <DrawSection
      title=""
      matches={loserMatches}
      scores={activeCategory.loserScores}
      drawType="loser"
      players={activeCategory.players}
      updateDrawScore={updateDrawScore}
      courts={courts}
      meta={activeCategory.loserMeta}
      updateDrawMeta={updateDrawMeta}
      matchFormat={activeCategory.matchFormat}
      playerSearch={playerSearch}
    />
  )}
</section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">
              Order of Play
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {courts.map((court) => (
                <Card
                  key={court.id}
                  className="bg-neutral-900 border-neutral-700 rounded-3xl text-white"
                >
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-xl text-lime-300">
                      {court.name}
                    </h3>

                    {orderOfPlay
  .filter((match) => {
    if (match.court !== court.name) return false;

    const search = playerSearch.trim().toLowerCase();
    if (!search) return true;

    if (match.categoryId !== activeCategory.id) return false;
    if (!match.p1 || !match.p2) return false;
    if (match.p1 === "TBD" || match.p2 === "TBD") return false;

    const p1Name = (activeCategory.players[match.p1] || "").toLowerCase();
    const p2Name = (activeCategory.players[match.p2] || "").toLowerCase();

    const p1Match =
      match.p1.toLowerCase() === search || p1Name === search;

    const p2Match =
      match.p2.toLowerCase() === search || p2Name === search;

    return p1Match || p2Match;
  })
                      .map((match) => {
                        const matchCategory =
  categories.find((cat) => cat.id === match.categoryId) || activeCategory;

const groupMatch = matchCategory.groupMatches.find(
  (gm) => gm.id === match.id
);

const mainScore = matchCategory.mainScores[match.id];
const loserScore = matchCategory.loserScores[match.id];

                        const score1 =
                          groupMatch?.s1 ||
                          mainScore?.s1 ||
                          loserScore?.s1 ||
                          "";

                        const score2 =
                          groupMatch?.s2 ||
                          mainScore?.s2 ||
                          loserScore?.s2 ||
                          "";

                        const a = Number(score1);
                        const b = Number(score2);

                        const hasResult = score1 !== "" && score2 !== "";
                        const p1Win = hasResult && a > b;
                        const p2Win = hasResult && b > a;

                        return (
                          <div
                            key={match.id}
                            className="bg-neutral-950 rounded-2xl p-3 space-y-1 border border-neutral-800"
                          >
                           {viewMode === "admin" ? (
  <div className="grid grid-cols-2 gap-2">
    <Input
      type="time"
      value={match.time}
      onChange={(e) =>
        updateOrderOfPlay(match.id, "time", e.target.value)
      }
      className="bg-neutral-900 border-neutral-600 rounded-xl text-white text-xs"
    />

    <select
      value={match.court}
      onChange={(e) =>
        updateOrderOfPlay(match.id, "court", e.target.value)
      }
      className="bg-neutral-900 border border-neutral-600 rounded-xl text-white text-xs px-2"
    >
      {courts.map((court) => (
        <option key={court.id} value={court.name}>
          {court.name}
        </option>
      ))}
    </select>
  </div>
) : (
  <div className="text-xs text-cyan-300 font-bold">
    {match.time}
  </div>
)}

                            <div className="text-xs text-yellow-300 font-bold">
                              Match {match.matchNo} | {match.category}
                            </div>

                            <div className="text-sm text-neutral-300">
  {match.title}
</div>

                            <div className="flex items-center justify-between gap-2">
                              <span
  className={
    isSearchedPlayer(matchCategory.players, match.p1, playerSearch)
      ? "text-yellow-300 font-extrabold underline"
      : p1Win
      ? "text-lime-300 font-bold"
      : p2Win
      ? "text-red-400 font-bold"
      : "text-white font-bold"
  }
>
                                {playerName(matchCategory.players, match.p1)}
                              </span>

                              <span className="text-white font-bold">
                                {score1}
                              </span>
                            </div>

                            <div className="text-neutral-500 text-xs">vs</div>

                            <div className="flex items-center justify-between gap-2">
                              <span
  className={
    isSearchedPlayer(matchCategory.players, match.p2, playerSearch)
      ? "text-yellow-300 font-extrabold underline"
      : p2Win
      ? "text-lime-300 font-bold"
      : p1Win
      ? "text-red-400 font-bold"
      : "text-white font-bold"
  }
>
                                {playerName(matchCategory.players, match.p2)}
                              </span>

                              <span className="text-white font-bold">
                                {score2}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
                
              ))}
              
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}



function DrawSection({
  title,
  matches,
  scores,
  drawType,
  players,
  updateDrawScore,
  courts,
  meta,
  updateDrawMeta,
  matchFormat,
  playerSearch,
}: {
  title: string;
  matches: DrawMatch[];
  scores: ScoreMap;
  drawType: "main" | "loser";
  players: PlayerMap;
  updateDrawScore: (
    drawType: "main" | "loser",
    id: string,
    key: "s1" | "s2",
    value: string
  ) => void;
  courts: Court[];
  meta: MatchMeta;
  updateDrawMeta: (
    drawType: "main" | "loser",
    id: string,
    key: "court" | "status",
    value: string
  ) => void;
  matchFormat: MatchFormat;
  playerSearch: string;
}) {
  const rounds = [...new Set(matches.map((m) => m.round))];

  

  if (matches.length === 0) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4 text-white">
        {title}
      </h2>

      <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
        <CardContent className="p-5 text-neutral-300 font-semibold">
          Not enough players for this draw.
        </CardContent>
      </Card>
    </section>
  );
}

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rounds.map((round) => (
          <Card
            key={round}
            className="bg-neutral-900 border-neutral-700 rounded-3xl text-white"
          >
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-lg text-white">{round}</h3>

              {matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <div
                    key={m.id}
                    className="bg-neutral-950 p-3 rounded-2xl space-y-2"
                  >
                    <div className="text-xs text-neutral-300 font-semibold">
  {round} • Match {
    matches
      .filter((x) => x.round === round)
      .findIndex((x) => x.id === m.id) + 1
  }

  
</div>

                    <div className="grid grid-cols-[1fr_56px] gap-2 items-center">
                      <div
  className={
    isSearchedPlayer(players, m.p1, playerSearch)
      ? "text-yellow-300 font-extrabold underline"
      : "text-white font-semibold"
  }
>
  {playerName(players, m.p1)}
</div>

                      <Input
                        type="number"
                        value={scores[m.id]?.s1 || ""}
                        disabled={!m.p1 || m.p1 === "BYE" || m.p2 === "BYE"}
                        onChange={(e) =>
                          updateDrawScore(drawType, m.id, "s1", e.target.value)
                        }
                        className="bg-neutral-900 border-neutral-600 rounded-xl text-white font-bold disabled:opacity-40"
                      />

                      <div
  className={
    isSearchedPlayer(players, m.p2, playerSearch)
      ? "text-yellow-300 font-extrabold underline"
      : "text-white font-semibold"
  }
>
  {playerName(players, m.p2)}
</div>

                      <Input
                        type="number"
                        value={scores[m.id]?.s2 || ""}
                        disabled={!m.p2 || m.p1 === "BYE" || m.p2 === "BYE"}
                        onChange={(e) =>
                          updateDrawScore(drawType, m.id, "s2", e.target.value)
                        }
                        className="bg-neutral-900 border-neutral-600 rounded-xl text-white font-bold disabled:opacity-40"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <select
                        value={meta[m.id]?.court || ""}
                        onChange={(e) =>
                          updateDrawMeta(
                            drawType,
                            m.id,
                            "court",
                            e.target.value
                          )
                        }
                        className="bg-neutral-900 border border-neutral-600 rounded-xl text-white font-semibold px-2 py-2"
                      >
                        <option value="">Select Court</option>
                        {courts.map((court) => (
                          <option key={court.id} value={court.name}>
                            {court.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={meta[m.id]?.status || "Waiting"}
                        onChange={(e) =>
                          updateDrawMeta(
                            drawType,
                            m.id,
                            "status",
                            e.target.value
                          )
                        }
                        className="bg-neutral-900 border border-neutral-600 rounded-xl text-white font-semibold px-2 py-2"
                      >
                        <option value="Waiting">Waiting</option>
                        <option value="On Court">On Court</option>
                        <option value="Finished">Finished</option>
                      </select>
                    </div>

                    <div className="text-sm text-lime-300 font-bold">
                      Winner:{" "}
                      {playerName(players, getWinner(m, scores, matchFormat))}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RankingView({ rankingRows }: { rankingRows: RankingRow[] }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold">
            JB Monthly Medal Ranking
          </h1>

          <p className="text-neutral-300 mt-2">
            Ranking based on participation, match wins and tournament results.
          </p>
        </div>

        <Card className="bg-neutral-900 border-neutral-700 rounded-3xl text-white">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">

              <thead className="bg-neutral-800 text-lime-300">
                <tr>
                  <th className="p-4 text-left">Rank</th>
                  <th className="p-4 text-left">Player</th>
                  <th className="p-4 text-center">Played</th>
                  <th className="p-4 text-center">W</th>
                  <th className="p-4 text-center">L</th>
                  <th className="p-4 text-center">Titles</th>
                  <th className="p-4 text-center">Points</th>
                </tr>
              </thead>

              <tbody>
                {rankingRows
                  .slice()
                  .sort((a, b) => b.points - a.points)
                  .map((p, index) => (
                    <tr
                      key={`${p.category}-${p.playerCode}`}
                      className="border-b border-neutral-800"
                    >
                      <td className="p-4">
                        {index === 0
                          ? "🥇"
                          : index === 1
                          ? "🥈"
                          : index === 2
                          ? "🥉"
                          : `#${index + 1}`}
                      </td>

                      <td className="p-4 font-bold">
                        {p.playerName}
                      </td>



                      <td className="p-4 text-center">
                        {p.played}
                      </td>

                      <td className="p-4 text-center text-lime-300">
                        {p.wins}
                      </td>

                      <td className="p-4 text-center text-red-400">
                        {p.losses}
                      </td>

                      <td className="p-4 text-center">
                        {p.titles}
                      </td>

                      <td className="p-4 text-center text-yellow-300 font-bold">
                        {p.points}
                      </td>
                    </tr>
                  ))}
              </tbody>

            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TournamentActivityPage({
  activities,
}: {
  activities: any[];
}) {
  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  const grouped = activities.reduce((acc: any, tournament: any) => {
    const date = tournament.tournamentDate
      ? new Date(tournament.tournamentDate)
      : new Date(tournament.updatedAt);
      
    const year = String(date.getFullYear());
    const month = monthNames[date.getMonth()];

    if (!acc[year]) acc[year] = {};
    if (!acc[year][month]) acc[year][month] = [];

    acc[year][month].push(tournament);

    return acc;
  }, {});
const deleteTournament = async (id: string) => {
  const confirmDelete = window.confirm(
    "Delete this tournament permanently?"
  );

  if (!confirmDelete) return;

  await deleteDoc(doc(db, "tournaments", id));

  window.location.reload();
};
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <h1 className="text-4xl font-bold mb-8">
        Tournament Activity
      </h1>

      <div className="space-y-10">
        {Object.keys(grouped)
          .sort((a, b) => Number(b) - Number(a))
          .map((year) => (
            <section key={year}>
              <h2 className="text-3xl font-bold text-lime-300 mb-4">
                {year}
              </h2>

              <div className="space-y-6">
                {Object.keys(grouped[year]).map((month) => (
                  <div key={month}>
                    <h3 className="text-xl font-bold text-yellow-300 mb-3">
                      {month}
                    </h3>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grouped[year][month].map((tournament: any) => (
                        <Link
                          key={tournament.id}
                          to={`/activity/${tournament.id}`}
                          className="block"
                        >
                          <Card className="bg-neutral-900 border-neutral-700 rounded-3xl hover:border-lime-400 transition">
                            <CardContent className="p-5 space-y-2 text-white">
                              <div className="flex justify-between items-start">
  


</div>

                              <div className="text-4xl">📁</div>

                              <h2 className="text-xl font-bold">
                                {tournament.tournamentName}
                              </h2>

                              <p className="text-neutral-400 text-sm">
                                {tournament.tournamentDate || tournament.updatedAt}
                              </p>

                             <div className="space-y-2 pt-2">
  <p className="text-lime-300 font-semibold">
    View Result →
  </p>

  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteTournament(tournament.id);
    }}
    className="text-red-400 hover:text-red-300 text-sm font-semibold"
  >
    Delete
  </button>
</div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}

function PastTournamentResultPage() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<any>(null);

  useEffect(() => {
    const loadTournament = async () => {
      if (!tournamentId) return;

      const ref = doc(db, "tournaments", tournamentId);
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        setTournament({
          id: snapshot.id,
          ...snapshot.data(),
        });
      }
    };

    loadTournament();
  }, [tournamentId]);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-6">
        Loading past tournament...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 space-y-6">
      <Link to="/activity" className="text-lime-300 font-bold">
        ← Back to Tournament Activity
      </Link>

      <h1 className="text-4xl font-bold">
        {tournament.tournamentName}
      </h1>

      <p className="text-neutral-400">
        Saved: {tournament.updatedAt}
      </p>

      {tournament.categories?.map((cat: any) => (
        <Card
          key={cat.id}
          className="bg-neutral-900 border-neutral-700 rounded-3xl text-white"
        >
          <CardContent className="p-5 space-y-4">
            <h2 className="text-2xl font-bold text-lime-300">
              {cat.name}
            </h2>

            <div>
              <h3 className="font-bold mb-2">Players</h3>

              <div className="grid md:grid-cols-3 gap-2">
                {Object.entries(cat.players || {}).map(([code, name]) => (
                  name ? (
                    <div
                      key={code}
                      className="bg-neutral-950 rounded-xl p-3"
                    >
                      <span className="text-lime-300 font-bold">
                        {code}
                      </span>{" "}
                      {String(name)}
                    </div>
                  ) : null
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2">Group Matches Result</h3>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.groupMatches?.map((m: any) => (
                  <div
                    key={m.id}
                    className="bg-neutral-950 rounded-xl p-3"
                  >
                    <div className="text-xs text-neutral-400">
                      Group {m.group} • Round {m.round}
                    </div>

                    <div className="font-semibold">
                      {cat.players[m.p1] || m.p1} {m.s1 || "-"}
                    </div>

                    <div className="text-neutral-500 text-xs">vs</div>

                    <div className="font-semibold">
                      {cat.players[m.p2] || m.p2} {m.s2 || "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}