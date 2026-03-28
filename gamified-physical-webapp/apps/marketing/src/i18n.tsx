import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "cs" | "en" | "uk";

type Messages = {
  languageGate: {
    eyebrow: string;
    title: string;
    body: string;
    czech: string;
    english: string;
    ukrainian: string;
  };
  languageSwitcher: {
    label: string;
    czech: string;
    english: string;
    ukrainian: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
  };
  controls: {
    label: string;
    move: string;
    boost: string;
    camera: string;
    cameraValue: string;
    physics: string;
    physicsValue: string;
  };
  objective: {
    label: string;
    idleTitle: string;
    idleBody: string;
  };
  missionBoard: {
    label: string;
    statusAria: string;
    sector: string;
    operation: string;
    minigame: string;
    unlocks: string;
    hiddenUnlock: string;
    progress: (cleared: number, total: number) => string;
    allClear: string;
  };
  dossier: {
    close: string;
    returnToDock: string;
  };
  tutorial: {
    label: string;
    flightTitle: string;
    flightBody: string;
    targetTitle: string;
    targetBody: string;
    simulationTitle: string;
    simulationBody: string;
    introLabel: string;
    introTitle: string;
    introBody: string;
    controlsLabel: string;
    controlsBody: string;
    boostLabel: string;
    boostBody: string;
    skip: string;
    start: string;
    checkpointLabel: string;
    checkpointTitle: string;
    checkpointBodyA: string;
    checkpointBodyB: string;
    checkpointContinue: string;
    outroLabel: string;
    outroTitle: string;
    outroBodyA: string;
    outroBodyB: string;
    outroContinue: string;
  };
  challenge: {
    label: string;
    abort: string;
    timer: string;
    kills: string;
    difficulty: string;
    easy: string;
    gridAria: string;
    instructions: string;
    successTitle: string;
    successBody: string;
    successButton: string;
    failureTitle: string;
    failureBody: string;
    retryButton: string;
  };
  scene: {
    target: string;
    checkpoint: string;
    shahedTarget: string;
    simulationPoint: string;
    boardTitle: string;
    phase1Title: string;
    phase1Body: string;
    phase2Title: string;
    phase2Body: string;
    phase3Title: string;
    phase3Body: string;
  };
};

type I18nContextValue = {
  locale: Locale | null;
  resolvedLocale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const STORAGE_KEY = "dronegone.locale";

const messagesByLocale: Record<Locale, Messages> = {
  cs: {
    languageGate: {
      eyebrow: "Jazyková mutace",
      title: "Zvol jazyk mise",
      body: "Než vstoupíš do hry, vyber jazyk celé prezentace. Volba se uloží a všechny další HUD prvky, tutorial, mini-hry i dossiers pojedou konzistentně v jedné mutaci.",
      czech: "Čeština",
      english: "Angličtina",
      ukrainian: "Українська",
    },
    languageSwitcher: {
      label: "Jazyk",
      czech: "CZE",
      english: "ENG",
      ukrainian: "UKR",
    },
    hero: {
      eyebrow: "Vítej na palubě",
      title: "DroneGone",
      lede: "Interceptor na lovu.\n\nNajdeme je,\nsevřeme je,\na necháme je za sebou...",
    },
    controls: {
      label: "Ovládání",
      move: "Pohyb",
      boost: "Boost",
      camera: "Kamera",
      cameraValue: "automatický follow rig",
      physics: "Fyzika",
      physicsValue: "Rapier kolize a trigger zóny",
    },
    objective: {
      label: "Tvůj úkol",
      idleTitle: "Prozkoumej bojiště",
      idleBody: "Vleť do kteréhokoli ostrova. Vyhraj krátkou misi proti nepříteli a odemkni skrytou část obsahu.",
    },
    missionBoard: {
      label: "Taktické sektory — operační tabule",
      statusAria: "Stav",
      sector: "Sektor",
      operation: "Operace",
      minigame: "Mini-hra",
      unlocks: "Odemkne",
      hiddenUnlock: "████████",
      progress: (cleared, total) => `${cleared} / ${total} sektorů neutralizováno`,
      allClear: "▶ VŠECHNY SEKTORY ZAJIŠTĚNY",
    },
    dossier: {
      close: "Zavřít",
      returnToDock: "Zpět na základnu",
    },
    tutorial: {
      label: "Tutorial",
      flightTitle: "Sleduj červenou trasu",
      flightBody: "Leť s intercept dronem po červené přerušované trase k mezibodu. Tam dostaneš rychlý briefing ke hrozbě Shahed.",
      targetTitle: "Doleť k cíli",
      targetBody: "Pokračuj z checkpointu ke středu mapy. U centrálního Shahedu se odemkne poslední briefing a pak můžeš začít objevovat ostrovy.",
      simulationTitle: "Ještě jeden krok: demonstrační zóna",
      simulationBody: "Teď se po červené trase přesuň do simulační oblasti. Na zemi uvidíš 3 fáze, které jednoduše vysvětlují použití intercept dronu.",
      introLabel: "Tutorial // Intercept onboarding",
      introTitle: "Letíš s intercept dronem",
      introBody: "Na tomhle webu se nepohybuješ kurzorem po kartách. Přímo pilotuješ intercept dron, který tě provede mezi hrozbou uprostřed a ostrovy, kde jsou ukryté části projektu.",
      controlsLabel: "Ovládání",
      controlsBody: "Pohyb dronu. Kamera tě drží automaticky v záběru.",
      boostLabel: "Boost",
      boostBody: "Krátké zrychlení pro rychlý přesun k cíli nebo mezi ostrovy.",
      skip: "Přeskočit",
      start: "Zahájit let",
      checkpointLabel: "Checkpoint // Threat briefing",
      checkpointTitle: "Shahed jako levná saturace prostoru",
      checkpointBodyA: "Shahed je relevantní ne proto, že je technologicky dokonalý, ale protože je levný, hlučný a ve větším počtu nutí obranu reagovat pod tlakem. Intercept drony dávají smysl jako rychlá, flexibilní a levnější vrstva reakce mezi detekcí a drahou klasickou PVO.",
      checkpointBodyB: "Proto tenhle web začíná přímo u hrozby: nejdřív chápeš problém, až potom si odemykáš jednotlivé části řešení.",
      checkpointContinue: "Pokračovat k cíli",
      outroLabel: "Mission map // Hidden dossiers",
      outroTitle: "Teď můžeš prozkoumat ostrovy",
      outroBodyA: "Čtyři ostrovy kolem mapy skrývají tajné části projektu. Každý ostrov má vlastní operaci a jednoduchou oldschool mini-hru, která je schválně krátká a nenáročná.",
      outroBodyB: "Cíl není hráče trápit. Stačí mini-hru splnit a odemkne se příslušný dossier s informacemi o projektu, modulu nebo výstupu, který ostrov chrání.",
      outroContinue: "Otevřít bojiště",
    },
    challenge: {
      label: "16-bit intercept challenge",
      abort: "Ukončit",
      timer: "Čas",
      kills: "Zásahy",
      difficulty: "Obtížnost",
      easy: "Lehká",
      gridAria: "Retro mřížka intercept challenge",
      instructions: "Pohyb A/D nebo šipkami. Mezerníkem střílíš. Zastav přilétající Shahedy dřív, než prorazí poslední řadu.",
      successTitle: "Sektor zajištěn.",
      successBody: "Dossier ostrova je odemčeno.",
      successButton: "Otevřít dossier",
      failureTitle: "Sektor ztracen.",
      failureBody: "Zkus jednoduchý intercept znovu a odhal obsah ostrova.",
      retryButton: "Opakovat výzvu",
    },
    scene: {
      target: "CÍL",
      checkpoint: "CHECKPOINT",
      shahedTarget: "SHAHED TARGET",
      simulationPoint: "SIMULACE",
      boardTitle: "INTERCEPT SCÉNÁŘ // 3 FÁZE",
      phase1Title: "1) Detekce",
      phase1Body: "Obranný dron hlídkuje ve výšce a kamerou zachytí útočný Shahed dřív, než vstoupí nad město.",
      phase2Title: "2) Navedení",
      phase2Body: "Systém stabilizuje stopu cíle, vypočítá intercept trajektorii a navede obranný dron do zásahového okna.",
      phase3Title: "3) Eliminace",
      phase3Body: "Útočný dron je neutralizován před dopadem na zastavěnou oblast. Město zůstává bez zásahu.",
    },
  },
  en: {
    languageGate: {
      eyebrow: "Language layer",
      title: "Select mission language",
      body: "Before entering the experience, pick the language for the entire presentation. The choice is stored so HUD panels, tutorial, mini-games, and dossiers stay consistent in one locale.",
      czech: "Czech",
      english: "English",
      ukrainian: "Ukrainian",
    },
    languageSwitcher: {
      label: "Language",
      czech: "CZE",
      english: "ENG",
      ukrainian: "UKR",
    },
    hero: {
      eyebrow: "Welcome on board",
      title: "DroneGone",
      lede: "Interceptor on the hunt.\n\nWe find them,\nwe bind them,\nand leave them behind...",
    },
    controls: {
      label: "Controls",
      move: "Move",
      boost: "Boost",
      camera: "Camera",
      cameraValue: "automatic follow rig",
      physics: "Physics",
      physicsValue: "Rapier bodies and trigger zones",
    },
    objective: {
      label: "Your objective",
      idleTitle: "Explore the battlefield",
      idleBody: "Move into any island. Win the short mission against the enemy and unlock the hidden project content.",
    },
    missionBoard: {
      label: "Tactical sectors — mission board",
      statusAria: "Status",
      sector: "Sector",
      operation: "Operation",
      minigame: "Mini-game",
      unlocks: "Unlocks",
      hiddenUnlock: "████████",
      progress: (cleared, total) => `${cleared} / ${total} sectors neutralized`,
      allClear: "▶ ALL SECTORS SECURED",
    },
    dossier: {
      close: "Close",
      returnToDock: "Return to dock",
    },
    tutorial: {
      label: "Tutorial",
      flightTitle: "Follow the red route",
      flightBody: "Fly the interceptor drone along the red dashed route to the waypoint. There you will get a short briefing on the Shahed threat.",
      targetTitle: "Close on target",
      targetBody: "Continue from the checkpoint to the center of the map. At the central Shahed you will unlock the final briefing and then start exploring the islands.",
      simulationTitle: "One more step: simulation zone",
      simulationBody: "Now follow the red route to the simulation area. On the ground you will see 3 phases that explain interceptor drone usage in a simple flow.",
      introLabel: "Tutorial // Intercept onboarding",
      introTitle: "You are flying an interceptor drone",
      introBody: "This website is not navigated by clicking static cards. You directly pilot an interceptor drone that guides you between the threat in the center and the islands hiding parts of the project.",
      controlsLabel: "Controls",
      controlsBody: "Drone movement. The camera keeps you framed automatically.",
      boostLabel: "Boost",
      boostBody: "Short acceleration for quick moves toward the target or between islands.",
      skip: "Skip",
      start: "Begin flight",
      checkpointLabel: "Checkpoint // Threat briefing",
      checkpointTitle: "Shahed as low-cost saturation",
      checkpointBodyA: "Shahed matters not because it is technologically perfect, but because it is cheap, loud, and in larger numbers it forces air defense to react under pressure. Interceptor drones make sense as a fast, flexible, and lower-cost response layer between detection and expensive traditional air defense.",
      checkpointBodyB: "That is why this website starts directly at the threat: first you understand the problem, only then do you unlock the individual parts of the solution.",
      checkpointContinue: "Continue to target",
      outroLabel: "Mission map // Hidden dossiers",
      outroTitle: "Now you can explore the islands",
      outroBodyA: "Four islands around the map hide secret parts of the project. Each island has its own operation and a deliberately short, simple old-school mini-game.",
      outroBodyB: "The goal is not to frustrate the player. Beat the mini-game and the related dossier unlocks with information about the project, module, or deliverable that island protects.",
      outroContinue: "Open battlefield",
    },
    challenge: {
      label: "16-bit intercept challenge",
      abort: "Abort",
      timer: "Timer",
      kills: "Kills",
      difficulty: "Difficulty",
      easy: "Easy",
      gridAria: "Retro intercept challenge grid",
      instructions: "Move with A/D or arrow keys. Press Space to fire. Stop the incoming Shaheds before they breach the last row.",
      successTitle: "Sector secure.",
      successBody: "The island dossier is unlocked.",
      successButton: "Open dossier",
      failureTitle: "Sector lost.",
      failureBody: "Retry the easy intercept to reveal the island content.",
      retryButton: "Retry challenge",
    },
    scene: {
      target: "TARGET",
      checkpoint: "CHECKPOINT",
      shahedTarget: "SHAHED TARGET",
      simulationPoint: "SIMULATION",
      boardTitle: "INTERCEPT SCENARIO // 3 PHASES",
      phase1Title: "1) Detection",
      phase1Body: "The defense drone loiters at altitude and detects the incoming Shahed before it enters the city area.",
      phase2Title: "2) Guidance",
      phase2Body: "The system locks target track, computes an intercept path, and guides the defensive drone into the engagement window.",
      phase3Title: "3) Elimination",
      phase3Body: "The hostile drone is neutralized before impact on urban buildings. City infrastructure remains protected.",
    },
  },
  uk: {
    languageGate: {
      eyebrow: "Мовний режим",
      title: "Оберіть мову місії",
      body: "Перед входом у досвід виберіть мову для всього вебу. Вибір збережеться, тому HUD, туторіал, міні-ігри та досьє будуть послідовно однією мовою.",
      czech: "Чеська",
      english: "Англійська",
      ukrainian: "Українська",
    },
    languageSwitcher: {
      label: "Мова",
      czech: "CZE",
      english: "ENG",
      ukrainian: "UKR",
    },
    hero: {
      eyebrow: "Ласкаво на борт",
      title: "DroneGone",
      lede: "Перехоплювач на полюванні.\n\nМи їх знайдемо,\nзв'яжемо,\nі залишимо позаду...",
    },
    controls: {
      label: "Керування",
      move: "Рух",
      boost: "Прискорення",
      camera: "Камера",
      cameraValue: "автоматичний режим стеження",
      physics: "Фізика",
      physicsValue: "Rapier-тіла та тригер-зони",
    },
    objective: {
      label: "Твоя ціль",
      idleTitle: "Досліджуй поле бою",
      idleBody: "Зайди на будь-який острів. Пройди коротку місію проти ворога й відкрий приховану частину проєкту.",
    },
    missionBoard: {
      label: "Тактичні сектори — оперативна таблиця",
      statusAria: "Статус",
      sector: "Сектор",
      operation: "Операція",
      minigame: "Міні-гра",
      unlocks: "Відкриває",
      hiddenUnlock: "████████",
      progress: (cleared, total) => `${cleared} / ${total} секторів нейтралізовано`,
      allClear: "▶ УСІ СЕКТОРИ ЗАХИЩЕНО",
    },
    dossier: {
      close: "Закрити",
      returnToDock: "Повернутися на базу",
    },
    tutorial: {
      label: "Туторіал",
      flightTitle: "Слідуй червоному маршруту",
      flightBody: "Лети перехоплювачем уздовж червоної пунктирної лінії до контрольної точки. Там буде короткий брифінг про загрозу Shahed.",
      targetTitle: "Підійди до цілі",
      targetBody: "Після чекпоінта рухайся до центру мапи. Біля центрального Shahed відкриється фінальний брифінг, а потім ти зможеш досліджувати острови.",
      simulationTitle: "Ще один крок: зона симуляції",
      simulationBody: "Тепер рухайся червоною трасою до зони симуляції. На землі побачиш 3 фази, що просто пояснюють логіку перехоплення.",
      introLabel: "Tutorial // Intercept onboarding",
      introTitle: "Ти керуєш дроном-перехоплювачем",
      introBody: "Цей сайт не про кліки по статичних картках. Ти напряму керуєш дроном, який проводить тебе між загрозою в центрі та островами з прихованими частинами проєкту.",
      controlsLabel: "Керування",
      controlsBody: "Рух дрона. Камера автоматично тримає тебе в кадрі.",
      boostLabel: "Прискорення",
      boostBody: "Короткий ривок для швидкого маневру до цілі або між островами.",
      skip: "Пропустити",
      start: "Почати політ",
      checkpointLabel: "Checkpoint // Threat briefing",
      checkpointTitle: "Shahed як дешева насичувальна загроза",
      checkpointBodyA: "Shahed важливий не тому, що технологічно досконалий, а тому що він дешевий, гучний і у великій кількості змушує ППО діяти під тиском. Дрони-перехоплювачі мають сенс як швидкий, гнучкий і дешевший шар реакції між виявленням та дорогою класичною ППО.",
      checkpointBodyB: "Саме тому цей веб починається з самої загрози: спершу ти розумієш проблему, а вже потім відкриваєш окремі частини рішення.",
      checkpointContinue: "Рухатися до цілі",
      outroLabel: "Mission map // Hidden dossiers",
      outroTitle: "Тепер можна досліджувати острови",
      outroBodyA: "Чотири острови навколо мапи приховують секретні частини проєкту. Кожен має власну операцію і навмисно коротку, просту олдскульну міні-гру.",
      outroBodyB: "Мета не в тому, щоб ускладнювати. Пройди міні-гру, і відкриється відповідне досьє з інформацією про модуль, компонент або результат, який цей острів захищає.",
      outroContinue: "Відкрити поле бою",
    },
    challenge: {
      label: "16-bit intercept challenge",
      abort: "Вийти",
      timer: "Час",
      kills: "Збиття",
      difficulty: "Складність",
      easy: "Легка",
      gridAria: "Ретро-сітка перехоплення",
      instructions: "Рухайся A/D або стрілками. Пробіл — постріл. Зупини Shahed до того, як вони прорвуть останній ряд.",
      successTitle: "Сектор захищено.",
      successBody: "Досьє острова розблоковано.",
      successButton: "Відкрити досьє",
      failureTitle: "Сектор втрачено.",
      failureBody: "Спробуй ще раз, щоб відкрити вміст острова.",
      retryButton: "Повторити",
    },
    scene: {
      target: "ЦІЛЬ",
      checkpoint: "ЧЕКПОІНТ",
      shahedTarget: "ЦІЛЬ SHAHED",
      simulationPoint: "СИМУЛЯЦІЯ",
      boardTitle: "СЦЕНАРІЙ ПЕРЕХОПЛЕННЯ // 3 ФАЗИ",
      phase1Title: "1) Виявлення",
      phase1Body: "Оборонний дрон патрулює на висоті та виявляє Shahed до входу в міську зону.",
      phase2Title: "2) Наведення",
      phase2Body: "Система фіксує ціль, рахує траєкторію перехоплення та веде дрон у вікно ураження.",
      phase3Title: "3) Нейтралізація",
      phase3Body: "Ворожий дрон знищено до удару по забудові. Місто залишається захищеним.",
    },
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "cs" || value === "en" || value === "uk" ? value : null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(() => readStoredLocale());
  const resolvedLocale = locale ?? "en";

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      resolvedLocale,
      messages: messagesByLocale[resolvedLocale],
      setLocale: (nextLocale: Locale) => {
        setLocaleState(nextLocale);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, nextLocale);
        }
      },
    }),
    [locale, resolvedLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
