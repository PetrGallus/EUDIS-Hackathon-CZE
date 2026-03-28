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
    title: { cs: "[Název sektoru Alpha]", en: "[Sector Alpha title]" },
    tag: { cs: "[Podtitul / role sektoru]", en: "[Sector subtitle / role]" },
    summary: {
      cs: "[Krátký popis — co tento sektor představuje a co hráč po odemknutí uvidí.]",
      en: "[Short summary — what this sector represents and what the player sees after unlocking it.]",
    },
    accent: "#00ff41",
    location: { cs: "[Lokalita]", en: "[Location]" },
    position: [-24, 1.2, -12],
    minigame: {
      name: { cs: "Space Invaders", en: "Space Invaders" },
      controls: { cs: "← → pohyb · Mezerník střelba", en: "← → move · Space fire" },
    },
    unlocks: { cs: "[Modul / část projektu, která se odemkne]", en: "[Module / project section unlocked]" },
    challenge: {
      title: { cs: "[Název operace Alpha]", en: "[Operation Alpha name]" },
      briefing: {
        cs: "[Briefing pro hráče — co musí splnit a proč. Jedna nebo dvě věty.]",
        en: "[Player briefing — what must be completed and why. One or two sentences.]",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "[Hlavní sdělení sektoru — výtah, který čtenáře dostane do obrazu.]",
        en: "[Main message of the sector — the hook that gets the reader oriented.]",
      },
      stats: [
        { label: { cs: "[Klíč 1]", en: "[Key 1]" }, value: { cs: "[Hodnota 1]", en: "[Value 1]" } },
        { label: { cs: "[Klíč 2]", en: "[Key 2]" }, value: { cs: "[Hodnota 2]", en: "[Value 2]" } },
        { label: { cs: "[Klíč 3]", en: "[Key 3]" }, value: { cs: "[Hodnota 3]", en: "[Value 3]" } },
      ],
      paragraphs: {
        cs: ["[Odstavec 1 — kontext a co tento sektor ukazuje.]", "[Odstavec 2 — hlubší detail nebo klíčový výsledek.]"],
        en: ["[Paragraph 1 — context and what this sector demonstrates.]", "[Paragraph 2 — deeper detail or key outcome.]"],
      },
      bullets: {
        cs: ["[Výstup nebo funkce č. 1]", "[Výstup nebo funkce č. 2]", "[Výstup nebo funkce č. 3]"],
        en: ["[Deliverable or feature no. 1]", "[Deliverable or feature no. 2]", "[Deliverable or feature no. 3]"],
      },
    },
  },
  {
    id: "sector-bravo",
    title: { cs: "[Název sektoru Bravo]", en: "[Sector Bravo title]" },
    tag: { cs: "[Podtitul / role sektoru]", en: "[Sector subtitle / role]" },
    summary: {
      cs: "[Krátký popis — co tento sektor představuje a co hráč po odemknutí uvidí.]",
      en: "[Short summary — what this sector represents and what the player sees after unlocking it.]",
    },
    accent: "#39ff14",
    location: { cs: "[Lokalita]", en: "[Location]" },
    position: [8, 1.2, 20],
    minigame: {
      name: { cs: "Snake", en: "Snake" },
      controls: { cs: "← → ↑ ↓ pohyb", en: "← → ↑ ↓ move" },
    },
    unlocks: { cs: "[Modul / část projektu, která se odemkne]", en: "[Module / project section unlocked]" },
    challenge: {
      title: { cs: "[Název operace Bravo]", en: "[Operation Bravo name]" },
      briefing: {
        cs: "[Briefing pro hráče — co musí splnit a proč. Jedna nebo dvě věty.]",
        en: "[Player briefing — what must be completed and why. One or two sentences.]",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "[Hlavní sdělení sektoru — výtah, který čtenáře dostane do obrazu.]",
        en: "[Main message of the sector — the hook that gets the reader oriented.]",
      },
      stats: [
        { label: { cs: "[Klíč 1]", en: "[Key 1]" }, value: { cs: "[Hodnota 1]", en: "[Value 1]" } },
        { label: { cs: "[Klíč 2]", en: "[Key 2]" }, value: { cs: "[Hodnota 2]", en: "[Value 2]" } },
        { label: { cs: "[Klíč 3]", en: "[Key 3]" }, value: { cs: "[Hodnota 3]", en: "[Value 3]" } },
      ],
      paragraphs: {
        cs: ["[Odstavec 1 — kontext a co tento sektor ukazuje.]", "[Odstavec 2 — hlubší detail nebo klíčový výsledek.]"],
        en: ["[Paragraph 1 — context and what this sector demonstrates.]", "[Paragraph 2 — deeper detail or key outcome.]"],
      },
      bullets: {
        cs: ["[Výstup nebo funkce č. 1]", "[Výstup nebo funkce č. 2]", "[Výstup nebo funkce č. 3]"],
        en: ["[Deliverable or feature no. 1]", "[Deliverable or feature no. 2]", "[Deliverable or feature no. 3]"],
      },
    },
  },
  {
    id: "sector-charlie",
    title: { cs: "[Název sektoru Charlie]", en: "[Sector Charlie title]" },
    tag: { cs: "[Podtitul / role sektoru]", en: "[Sector subtitle / role]" },
    summary: {
      cs: "[Krátký popis — co tento sektor představuje a co hráč po odemknutí uvidí.]",
      en: "[Short summary — what this sector represents and what the player sees after unlocking it.]",
    },
    accent: "#00ffff",
    location: { cs: "[Lokalita]", en: "[Location]" },
    position: [24, 1.2, -8],
    minigame: {
      name: { cs: "Pong", en: "Pong" },
      controls: { cs: "↑ ↓ pohyb", en: "↑ ↓ move" },
    },
    unlocks: { cs: "[Modul / část projektu, která se odemkne]", en: "[Module / project section unlocked]" },
    challenge: {
      title: { cs: "[Název operace Charlie]", en: "[Operation Charlie name]" },
      briefing: {
        cs: "[Briefing pro hráče — co musí splnit a proč. Jedna nebo dvě věty.]",
        en: "[Player briefing — what must be completed and why. One or two sentences.]",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "[Hlavní sdělení sektoru — výtah, který čtenáře dostane do obrazu.]",
        en: "[Main message of the sector — the hook that gets the reader oriented.]",
      },
      stats: [
        { label: { cs: "[Klíč 1]", en: "[Key 1]" }, value: { cs: "[Hodnota 1]", en: "[Value 1]" } },
        { label: { cs: "[Klíč 2]", en: "[Key 2]" }, value: { cs: "[Hodnota 2]", en: "[Value 2]" } },
        { label: { cs: "[Klíč 3]", en: "[Key 3]" }, value: { cs: "[Hodnota 3]", en: "[Value 3]" } },
      ],
      paragraphs: {
        cs: ["[Odstavec 1 — kontext a co tento sektor ukazuje.]", "[Odstavec 2 — hlubší detail nebo klíčový výsledek.]"],
        en: ["[Paragraph 1 — context and what this sector demonstrates.]", "[Paragraph 2 — deeper detail or key outcome.]"],
      },
      bullets: {
        cs: ["[Výstup nebo funkce č. 1]", "[Výstup nebo funkce č. 2]", "[Výstup nebo funkce č. 3]"],
        en: ["[Deliverable or feature no. 1]", "[Deliverable or feature no. 2]", "[Deliverable or feature no. 3]"],
      },
    },
  },
  {
    id: "sector-delta",
    title: { cs: "[Název sektoru Delta]", en: "[Sector Delta title]" },
    tag: { cs: "[Podtitul / role sektoru]", en: "[Sector subtitle / role]" },
    summary: {
      cs: "[Krátký popis — co tento sektor představuje a co hráč po odemknutí uvidí.]",
      en: "[Short summary — what this sector represents and what the player sees after unlocking it.]",
    },
    accent: "#ff9f1c",
    location: { cs: "[Lokalita]", en: "[Location]" },
    position: [-10, 1.2, 18],
    minigame: {
      name: { cs: "Frogger", en: "Frogger" },
      controls: { cs: "← → ↑ ↓ skok", en: "← → ↑ ↓ hop" },
    },
    unlocks: { cs: "[Modul / část projektu, která se odemkne]", en: "[Module / project section unlocked]" },
    challenge: {
      title: { cs: "[Název operace Delta]", en: "[Operation Delta name]" },
      briefing: {
        cs: "[Briefing pro hráče — co musí splnit a proč. Jedna nebo dvě věty.]",
        en: "[Player briefing — what must be completed and why. One or two sentences.]",
      },
      targetKills: 5,
      timeLimitSec: 20,
    },
    dossier: {
      hook: {
        cs: "[Hlavní sdělení sektoru — výtah, který čtenáře dostane do obrazu.]",
        en: "[Main message of the sector — the hook that gets the reader oriented.]",
      },
      stats: [
        { label: { cs: "[Klíč 1]", en: "[Key 1]" }, value: { cs: "[Hodnota 1]", en: "[Value 1]" } },
        { label: { cs: "[Klíč 2]", en: "[Key 2]" }, value: { cs: "[Hodnota 2]", en: "[Value 2]" } },
        { label: { cs: "[Klíč 3]", en: "[Key 3]" }, value: { cs: "[Hodnota 3]", en: "[Value 3]" } },
      ],
      paragraphs: {
        cs: ["[Odstavec 1 — kontext a co tento sektor ukazuje.]", "[Odstavec 2 — hlubší detail nebo klíčový výsledek.]"],
        en: ["[Paragraph 1 — context and what this sector demonstrates.]", "[Paragraph 2 — deeper detail or key outcome.]"],
      },
      bullets: {
        cs: ["[Výstup nebo funkce č. 1]", "[Výstup nebo funkce č. 2]", "[Výstup nebo funkce č. 3]"],
        en: ["[Deliverable or feature no. 1]", "[Deliverable or feature no. 2]", "[Deliverable or feature no. 3]"],
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