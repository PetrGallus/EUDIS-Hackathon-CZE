import type { Locale } from "../i18n";

type Localized<T> = {
  cs: T;
  en: T;
  uk?: T;
};

export type ProjectNode = {
  id: string;
  title: string;
  tag: string;
  summary: string;
  accent: string;
  location: string;
  position: [number, number, number];
  minigame: {
    name: string;
    controls: string;
  };
  unlocks: string;
  challenge: {
    title: string;
    briefing: string;
    targetKills: number;
    timeLimitSec: number;
  };
  dossier: {
    hook: string;
    stats: Array<{ label: string; value: string }>;
    paragraphs: string[];
    bullets: string[];
  };
};

type LocalizedProjectNode = {
  id: string;
  title: Localized<string>;
  tag: Localized<string>;
  summary: Localized<string>;
  accent: string;
  location: Localized<string>;
  position: [number, number, number];
  minigame: {
    name: Localized<string>;
    controls: Localized<string>;
  };
  unlocks: Localized<string>;
  challenge: {
    title: Localized<string>;
    briefing: Localized<string>;
    targetKills: number;
    timeLimitSec: number;
  };
  dossier: {
    hook: Localized<string>;
    stats: Array<{ label: Localized<string>; value: Localized<string> }>;
    paragraphs: Localized<string[]>;
    bullets: Localized<string[]>;
  };
};

function pick<T>(value: Localized<T>, locale: Locale): T {
  return value[locale] ?? value.en;
}

const localizedProjects: LocalizedProjectNode[] = [
  {
    id: "sector-alpha",
    title: { cs: "Sector Alpha: Topics", en: "Sector Alpha: Topics" },
    tag: { cs: "Řešené oblasti hackathonu", en: "Hackathon Tackled Topics" },
    summary: {
      cs: "Přehled klíčových témat, use-casů a priorit, na kterých tým během hackathonu pracoval.",
      en: "Overview of key topics, use cases, and priorities addressed during the hackathon.",
    },
    accent: "#00ff41",
    location: { cs: "Praha // Main Stage", en: "Prague // Main Stage" },
    position: [-32, 1.2, -20],
    minigame: {
      name: { cs: "Space Invaders", en: "Space Invaders" },
      controls: { cs: "← → pohyb · Mezerník střelba", en: "← → move · Space fire" },
    },
    unlocks: { cs: "Topic map + priorities", en: "Topic map + priorities" },
    challenge: {
      title: { cs: "Operace Alpha: Topic Scan", en: "Operation Alpha: Topic Scan" },
      briefing: {
        cs: "Vyhraj Space Invaders jednou a odkryješ mapu řešených témat.",
        en: "Win Space Invaders once to reveal the tackled topics map.",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "Tým pokryl celé spektrum od detekce po intercept logiku a UI vrstvu pro operátora.",
        en: "The team covered the full spectrum from detection to interception logic and operator UI.",
      },
      stats: [
        { label: { cs: "Topics", en: "Topics" }, value: { cs: "6", en: "6" } },
        { label: { cs: "Use Cases", en: "Use Cases" }, value: { cs: "3", en: "3" } },
        { label: { cs: "Priority", en: "Priority" }, value: { cs: "High", en: "High" } },
      ],
      paragraphs: {
        cs: [
          "Alpha sektor shrnuje, které technické a operační problémy byly během hackathonu prioritizovány.",
          "Výstupem je jasná mapa témat, která řídí další vývoj i testování v navazujících iteracích.",
        ],
        en: [
          "The Alpha sector summarizes which technical and operational problems were prioritized during the hackathon.",
          "The output is a clear topic map guiding follow-up development and testing iterations.",
        ],
      },
      bullets: {
        cs: ["Threat detection", "Guidance planning", "Operator situational view"],
        en: ["Threat detection", "Guidance planning", "Operator situational view"],
      },
    },
  },
  {
    id: "sector-bravo",
    title: { cs: "Sector Bravo: Tým", en: "Sector Bravo: Team" },
    tag: { cs: "Lidé za řešením", en: "People Behind the Solution" },
    summary: {
      cs: "Po výhře odemkneš týmovou sestavu a role klíčových členů.",
      en: "After winning, you unlock the team roster and key member roles.",
    },
    accent: "#39ff14",
    location: { cs: "Praha + Brno", en: "Prague + Brno" },
    position: [-30, 1.2, -2],
    minigame: {
      name: { cs: "Tic Tac Toe", en: "Tic Tac Toe" },
      controls: { cs: "Klik na políčko", en: "Click cell" },
    },
    unlocks: { cs: "Team dossier + role map", en: "Team dossier + role map" },
    challenge: {
      title: { cs: "Operace Bravo: Team Intel", en: "Operation Bravo: Team Intel" },
      briefing: {
        cs: "Vyhraj jednou Tic Tac Toe a odhal tým i jejich specializace.",
        en: "Win Tic Tac Toe once to reveal the team and their specializations.",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "Core delivery tým spojuje software, autonomy a systems engineering do jednoho funkčního celku.",
        en: "The core delivery team combines software, autonomy, and systems engineering into one operational stack.",
      },
      stats: [
        { label: { cs: "Petr", en: "Petr" }, value: { cs: "Software Engineer", en: "Software Engineer" } },
        { label: { cs: "Martin", en: "Martin" }, value: { cs: "Armament Specialist", en: "Armament Specialist" } },
        { label: { cs: "Václav", en: "Václav" }, value: { cs: "Guidance Specialist", en: "Guidance Specialist" } },
        { label: { cs: "Vojtech", en: "Vojtech" }, value: { cs: "Propulsion Engineer", en: "Propulsion Engineer" } },
        { label: { cs: "David", en: "David" }, value: { cs: "Modelling Specialist", en: "Modelling Specialist" } },
      ],
      paragraphs: {
        cs: [
          "Tato část ukazuje, jak jsou role v týmu rozdělené a jak se skládají do jednoho interoperabilního řešení.",
          "Každý člen vlastní jasnou doménu, ale pracuje v krátkých iteracích napříč celým stackem.",
        ],
        en: [
          "This section shows how team roles are distributed and merged into one interoperable solution.",
          "Each member owns a clear domain while collaborating in short cross-stack iterations.",
        ],
      },
      bullets: {
        cs: ["Flight-control software", "Guidance and autonomy logic", "Integration + test orchestration"],
        en: ["Flight-control software", "Guidance and autonomy logic", "Integration + test orchestration"],
      },
    },
  },
  {
    id: "sector-charlie",
    title: { cs: "Sector Charlie: Progress", en: "Sector Charlie: Progress" },
    tag: { cs: "Milníky a stav doručení", en: "Milestones and Delivery Status" },
    summary: {
      cs: "Track postupu od prototypu po demo-ready stav včetně integrace jednotlivých částí.",
      en: "Track progress from prototype to demo-ready status, including cross-module integration.",
    },
    accent: "#00ffff",
    location: { cs: "Test Lab // Delivery Lane", en: "Test Lab // Delivery Lane" },
    position: [-24, 1.2, 16],
    minigame: {
      name: { cs: "Tetris", en: "Tetris" },
      controls: { cs: "← → pohyb", en: "← → move" },
    },
    unlocks: { cs: "Progress dashboard", en: "Progress dashboard" },
    challenge: {
      title: { cs: "Operace Charlie: Milestone Run", en: "Operation Charlie: Milestone Run" },
      briefing: {
        cs: "Vyčisti 5 řad v Tetris a odemkni průběh realizace projektu.",
        en: "Clear 5 rows in Tetris to unlock the project progress snapshot.",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "Charlie dává rychlý pohled na to, co je hotové, co je integrované a co je připravené pro demo.",
        en: "Charlie gives a fast view of what is done, integrated, and ready for demo.",
      },
      stats: [
        { label: { cs: "Prototype", en: "Prototype" }, value: { cs: "Done", en: "Done" } },
        { label: { cs: "Integration", en: "Integration" }, value: { cs: "In Progress", en: "In Progress" } },
        { label: { cs: "Demo Ready", en: "Demo Ready" }, value: { cs: "80%", en: "80%" } },
      ],
      paragraphs: {
        cs: [
          "Progress vrstva propojuje vývojový stav s praktickými testy a ukazuje, kde je největší tempo posunu.",
          "Milníky pomáhají týmu držet fokus na demo-critické části a snižovat integrační riziko.",
        ],
        en: [
          "The progress layer links development status with practical tests and highlights where momentum is strongest.",
          "Milestones help the team stay focused on demo-critical parts and reduce integration risk.",
        ],
      },
      bullets: {
        cs: ["Core gameplay stable", "Bridge integration validated", "Demo polish ongoing"],
        en: ["Core gameplay stable", "Bridge integration validated", "Demo polish ongoing"],
      },
    },
  },
];

export function getProjects(locale: Locale): ProjectNode[] {
  return localizedProjects.map((project) => ({
    id: project.id,
    title: pick(project.title, locale),
    tag: pick(project.tag, locale),
    summary: pick(project.summary, locale),
    accent: project.accent,
    location: pick(project.location, locale),
    position: project.position,
    minigame: {
      name: pick(project.minigame.name, locale),
      controls: pick(project.minigame.controls, locale),
    },
    unlocks: pick(project.unlocks, locale),
    challenge: {
      title: pick(project.challenge.title, locale),
      briefing: pick(project.challenge.briefing, locale),
      targetKills: project.challenge.targetKills,
      timeLimitSec: project.challenge.timeLimitSec,
    },
    dossier: {
      hook: pick(project.dossier.hook, locale),
      stats: project.dossier.stats.map((stat) => ({
        label: pick(stat.label, locale),
        value: pick(stat.value, locale),
      })),
      paragraphs: pick(project.dossier.paragraphs, locale),
      bullets: pick(project.dossier.bullets, locale),
    },
  }));
}