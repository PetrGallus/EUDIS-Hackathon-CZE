export type ProjectNode = {
  id: string;
  title: string;
  tag: string;
  summary: string;
  accent: string;
  location: string;
  position: [number, number, number];
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

export const projects: ProjectNode[] = [
  {
    id: "brno-command-loop",
    title: "Brno Command Loop",
    tag: "Operator clarity island",
    summary: "This sector shows how the interceptor experience turns sensor noise into a crisp operator loop anchored around Brno decision-making.",
    accent: "#00ff41",
    location: "Brno urban AO",
    position: [-24, 1.2, -12],
    challenge: {
      title: "Scramble over Brno",
      briefing: "A wave of low, slow Shaheds is entering the Brno corridor. Clear six before they cross the urban ring.",
      targetKills: 6,
      timeLimitSec: 18,
    },
    dossier: {
      hook: "The first island sells the product as an operator tool, not just another drone demo.",
      stats: [
        { label: "Focus", value: "Operator-first" },
        { label: "Region", value: "Brno" },
        { label: "Outcome", value: "Faster decisions" },
      ],
      paragraphs: [
        "The Brno Command Loop island frames the project around one core promise: turn a chaotic air picture into a readable action cycle for human operators.",
        "Instead of flooding the user with telemetry, the island narrative groups signal quality, interceptor posture, and next action into one coherent view that can survive real pressure.",
      ],
      bullets: [
        "A cockpit-style interface that keeps the operator oriented while maneuvering.",
        "Clear prioritization of threat, route, and next action instead of flat data dashboards.",
        "A scene structure that can later map directly to the real tablet or mission console.",
      ],
    },
  },
  {
    id: "shahed-intercept-lab",
    title: "Shahed Intercept Lab",
    tag: "Gamified threat sandbox",
    summary: "This island turns the portfolio into a mechanic: defend the corridor, then open the system page behind the encounter.",
    accent: "#39ff14",
    location: "South Moravia corridor",
    position: [8, 1.2, 20],
    challenge: {
      title: "Corridor defense",
      briefing: "The easy wave is still enough to prove the concept: track, engage, and hold the corridor before the drones slip through.",
      targetKills: 6,
      timeLimitSec: 18,
    },
    dossier: {
      hook: "The mini-game is not decoration. It is the website's proof that the visitor understands interception through play.",
      stats: [
        { label: "Loop", value: "Detect / engage / unlock" },
        { label: "Threat", value: "Shahed-class swarm" },
        { label: "Tone", value: "Retro training sim" },
      ],
      paragraphs: [
        "The intercept lab island introduces the core dramatic device of the site: visitors do not just read about a threat, they handle a small version of it.",
        "That challenge flow makes the portfolio feel like a training artifact. It creates a memory before the content page opens, so the story lands with more weight than a static card ever could.",
      ],
      bullets: [
        "A lightweight 16-bit challenge that keeps the interaction approachable.",
        "A gate that ensures the user earns the content reveal through action.",
        "A pattern that can scale to more islands, more threats, or different mission beats later.",
      ],
    },
  },
  {
    id: "c2-bridge-node",
    title: "C2 Bridge Node",
    tag: "Integration island",
    summary: "This dossier links the immersive experience to the serious outcome: a system that can plug into command-and-control workflows rather than dying as a standalone prototype.",
    accent: "#00ffff",
    location: "CZ national network",
    position: [24, 1.2, -8],
    challenge: {
      title: "National relay shield",
      briefing: "Protect the C2 bridge long enough to keep the national relay intact. Easy difficulty, but the clock still matters.",
      targetKills: 6,
      timeLimitSec: 18,
    },
    dossier: {
      hook: "This island closes the loop by showing how the experience scales from a visitor-facing demo into an integration story defense users will recognize.",
      stats: [
        { label: "Bridge", value: "IIT to C2" },
        { label: "Scope", value: "National" },
        { label: "Value", value: "Deployable path" },
      ],
      paragraphs: [
        "The C2 Bridge Node frames the system as more than a visualization layer. It presents a path from research outputs to information products that command systems can actually ingest.",
        "That matters because most immersive defense demos fail at the handoff. This island makes the integration story explicit: the same logic that powers the game-like experience can package reliable, structured outputs for real operational chains.",
      ],
      bullets: [
        "A narrative bridge from prototype visuals to operational relevance.",
        "An island structure that can later surface standards, APIs, or command workflows.",
        "A clean final sector for deployment path, interoperability, and military adoption messaging.",
      ],
    },
  },
];