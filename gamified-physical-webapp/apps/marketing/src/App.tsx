import { useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useI18n } from "./i18n";
import { PortfolioScene } from "./scene/PortfolioScene";
import { IslandChallenge } from "./scene/IslandChallenge";
import { TutorialGuideAvatar } from "./components/TutorialGuideAvatar";
import { TutorialShahedPreview } from "./components/TutorialShahedPreview";
import { getProjects } from "./scene/projects";
import "./styles.css";

type TutorialStage = "intro" | "flight" | "checkpoint" | "target" | "simulation" | "outro" | "done";

const tutorialSpawn: [number, number, number] = [-30, 1.25, -24];
const tutorialCheckpoint: [number, number, number] = [-16, 1.25, -15];
const tutorialTarget: [number, number, number] = [0, 1.25, 0];
const tutorialSimulationPoint: [number, number, number] = [20, 1.25, -13];
const captureMode = false;

export function App() {
  const { locale, resolvedLocale, messages, setLocale } = useI18n();
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [challengeProjectId, setChallengeProjectId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [unlockedProjectIds, setUnlockedProjectIds] = useState<Set<string>>(new Set());
  const [tutorialStage, setTutorialStage] = useState<TutorialStage>("intro");
  const projects = useMemo(() => getProjects(resolvedLocale), [resolvedLocale]);

  const localeChosen = locale !== null;
  const tutorialActive = localeChosen && tutorialStage !== "done";
  const tutorialBlocking = tutorialStage === "intro" || tutorialStage === "checkpoint" || tutorialStage === "outro";
  const tutorialGuidanceMode =
    tutorialStage === "flight"
      ? "checkpoint"
      : tutorialStage === "target"
        ? "target"
        : tutorialStage === "simulation"
          ? "simulation"
          : "inactive";

  const handleProjectFocus = useCallback(
    (projectId: string | null) => {
      if (!localeChosen || tutorialActive) {
        return;
      }

      if (projectId === null) {
        setFocusedProjectId(null);
        return;
      }

      setFocusedProjectId(projectId);

      if (unlockedProjectIds.has(projectId)) {
        setOpenProjectId(projectId);
      } else {
        // Start challenge
        setChallengeProjectId(projectId);
      }
    },
    [localeChosen, tutorialActive, unlockedProjectIds]
  );

  const handleChallengeSuccess = useCallback((projectId: string) => {
    setUnlockedProjectIds((prev) => new Set(prev).add(projectId));
    setChallengeProjectId(null);
    setOpenProjectId(projectId);
  }, []);

  const handleChallengeAbort = useCallback(() => {
    setChallengeProjectId(null);
    setFocusedProjectId(null);
  }, []);

  const handleDossierClose = useCallback(() => {
    setOpenProjectId(null);
    setFocusedProjectId(null);
  }, []);

  const isPaused = challengeProjectId !== null || openProjectId !== null || !localeChosen || tutorialBlocking;
  const activeProject = focusedProjectId ? projects.find((p) => p.id === focusedProjectId) : null;
  const challengeProject = challengeProjectId ? projects.find((p) => p.id === challengeProjectId) : null;
  const dossierProject = openProjectId ? projects.find((p) => p.id === openProjectId) : null;
  const formatTutorialChip = (text: string) => {
    const normalized = text.includes("//") ? text.split("//")[1]?.trim() ?? text : text;
    return normalized.toUpperCase();
  };
  const tutorialStageChipByStage: Record<Exclude<TutorialStage, "done">, string> = {
    intro: formatTutorialChip(messages.tutorial.introLabel),
    flight: formatTutorialChip(messages.tutorial.flightTitle),
    checkpoint: formatTutorialChip(messages.tutorial.checkpointLabel),
    target: formatTutorialChip(messages.tutorial.targetTitle),
    simulation: formatTutorialChip(messages.tutorial.simulationTitle),
    outro: formatTutorialChip(messages.tutorial.outroLabel),
  };

  return (
    <main className={`app-shell ${captureMode ? "capture-clean" : ""}`}>
      <Canvas dpr={[1, 2]} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.156 }}>
        <PortfolioScene
          focusedProjectId={focusedProjectId}
          unlockedProjectIds={unlockedProjectIds}
          onProjectFocus={handleProjectFocus}
          paused={isPaused}
          tutorialActive={tutorialActive}
          tutorialGuidanceMode={tutorialGuidanceMode}
          tutorialSpawn={tutorialSpawn}
          tutorialCheckpoint={tutorialCheckpoint}
          tutorialTarget={tutorialTarget}
          tutorialSimulation={tutorialSimulationPoint}
          hidePlayerDrone={captureMode}
          onTutorialCheckpointReach={() => {
            if (tutorialStage === "flight") {
              setTutorialStage("checkpoint");
            }
          }}
          onTutorialTargetReach={() => {
            if (tutorialStage === "target") {
              setTutorialStage("simulation");
            }
          }}
          onTutorialSimulationReach={() => {
            if (tutorialStage === "simulation") {
              setTutorialStage("outro");
            }
          }}
        />
      </Canvas>

      {tutorialActive && (tutorialStage === "flight" || tutorialStage === "target" || tutorialStage === "simulation") ? (
        <aside className="tutorial-escort-card">
          <div className="tutorial-guide-row">
            <TutorialGuideAvatar compact variant={tutorialStage === "simulation" ? "two" : "one"} />
            <span className="tutorial-guide-chip">{tutorialStageChipByStage[tutorialStage]}</span>
          </div>
          <p className="label">{messages.tutorial.label}</p>
          {tutorialStage === "flight" ? (
            <>
              <h2>{messages.tutorial.flightTitle}</h2>
              <p>{messages.tutorial.flightBody}</p>
            </>
          ) : tutorialStage === "target" ? (
            <>
              <h2>{messages.tutorial.targetTitle}</h2>
              <p>{messages.tutorial.targetBody}</p>
            </>
          ) : (
            <>
              <h2>{messages.tutorial.simulationTitle}</h2>
              <p>{messages.tutorial.simulationBody}</p>
            </>
          )}
        </aside>
      ) : null}

      {localeChosen ? (
        <>
          <section className="hud hud-top-left">
            <div className="language-switcher">
              <span className="language-switcher-label">{messages.languageSwitcher.label}</span>
              <div className="language-switcher-buttons">
                <button
                  type="button"
                  className={`language-pill ${resolvedLocale === "cs" ? "active" : ""}`}
                  onClick={() => setLocale("cs")}
                >
                  🇨🇿 {messages.languageSwitcher.czech}
                </button>
                <button
                  type="button"
                  className={`language-pill ${resolvedLocale === "en" ? "active" : ""}`}
                  onClick={() => setLocale("en")}
                >
                  🇬🇧 {messages.languageSwitcher.english}
                </button>
                <button
                  type="button"
                  className={`language-pill ${resolvedLocale === "uk" ? "active" : ""}`}
                  onClick={() => setLocale("uk")}
                >
                  🇺🇦 {messages.languageSwitcher.ukrainian}
                </button>
              </div>
            </div>

            <p className="eyebrow">{messages.hero.eyebrow}</p>
            <h1>{messages.hero.title}</h1>
            <p className="lede">{messages.hero.lede}</p>
          </section>

          <section className="hud hud-bottom-left">
            <p className="label">{messages.controls.label}</p>
            <div className="control-list">
              <div className="control-row">
                <span className="control-name">{messages.controls.move}</span>
                <div className="control-icons control-icons-stack">
                  <div className="keypad-wasd">
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap keycap-small">W</span>
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap keycap-small">A</span>
                    <span className="keycap keycap-small">S</span>
                    <span className="keycap keycap-small">D</span>
                  </div>
                  <div className="keypad-arrows">
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap keycap-small">↑</span>
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap keycap-small">←</span>
                    <span className="keycap keycap-small">↓</span>
                    <span className="keycap keycap-small">→</span>
                  </div>
                </div>
              </div>

              <div className="control-row">
                <span className="control-name">{messages.controls.boost}</span>
                <div className="control-icons">
                  <span className="keycap keycap-space">SPACE</span>
                </div>
              </div>

              <div className="control-row control-row-text">
                <span className="control-name">{messages.controls.camera}</span>
                <span className="control-copy">{messages.controls.cameraValue}</span>
              </div>

              <div className="control-row control-row-text">
                <span className="control-name">{messages.controls.physics}</span>
                <span className="control-copy">{messages.controls.physicsValue}</span>
              </div>
            </div>
          </section>

          <aside className="hud hud-bottom-right">
            <p className="label">{messages.objective.label}</p>
            {activeProject && !isPaused ? (
              <>
                <h2>{activeProject.title}</h2>
                <p className="project-tag">{activeProject.tag}</p>
                <p>{activeProject.summary}</p>
              </>
            ) : (
              <>
                <h2>{messages.objective.idleTitle}</h2>
                <p>{messages.objective.idleBody}</p>
              </>
            )}
          </aside>

          <section className="hud hud-top-right">
            <p className="label">{messages.missionBoard.label}</p>
            <table className="mission-table">
              <thead>
                <tr>
                  <th aria-label={messages.missionBoard.statusAria} />
                  <th>{messages.missionBoard.sector}</th>
                  <th>{messages.missionBoard.operation}</th>
                  <th>{messages.missionBoard.minigame}</th>
                  <th>{messages.missionBoard.unlocks}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const cleared = unlockedProjectIds.has(project.id);
                  return (
                    <tr key={project.id} className={cleared ? "row-cleared" : "row-locked"}>
                      <td><span className={`sector-status ${cleared ? "cleared" : "locked"}`} /></td>
                      <td className="col-sector">{project.title}</td>
                      <td className="col-op">{project.challenge.title}</td>
                      <td className="col-game">
                        <span className="game-badge">{project.minigame.name}</span>
                        <span className="game-controls">{project.minigame.controls}</span>
                      </td>
                      <td className="col-unlocks">{cleared ? project.unlocks : messages.missionBoard.hiddenUnlock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="hud-meta">
              <span className="progress-label">{messages.missionBoard.progress(unlockedProjectIds.size, projects.length)}</span>
              {unlockedProjectIds.size === projects.length && <span className="all-clear">{messages.missionBoard.allClear}</span>}
            </div>
          </section>
        </>
      ) : null}

      {/* Challenge modal */}
      {challengeProjectId && challengeProject && (
        <div className="modal">
          <IslandChallenge
            project={challengeProject}
            onSuccess={() => handleChallengeSuccess(challengeProjectId)}
            onAbort={handleChallengeAbort}
          />
        </div>
      )}

      {/* Dossier modal */}
      {openProjectId && dossierProject && (
        <div className="modal">
          <div className="dossier-panel">
            <div className="dossier-header">
              <h2>{dossierProject.title}</h2>
              <p className="dossier-tag">{dossierProject.tag}</p>
              <button className="ghost-button" onClick={handleDossierClose} aria-label={messages.dossier.close}>
                ✕
              </button>
            </div>

            <div className="dossier-hook">{dossierProject.dossier.hook}</div>

            <div className="dossier-stats">
              {dossierProject.dossier.stats.map((stat, idx) => (
                <div key={idx} className="dossier-stat">
                  <span className="stat-label">{stat.label}</span>
                  <span className="stat-value">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="dossier-body">
              <div className="dossier-section">
                {dossierProject.dossier.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              <div className="dossier-section">
                <ul>
                  {dossierProject.dossier.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="dossier-footer">
              <button className="primary-button" onClick={handleDossierClose}>
                {messages.dossier.returnToDock}
              </button>
            </div>
          </div>
        </div>
      )}

      {localeChosen && tutorialStage === "intro" ? (
        <div className="tutorial-overlay">
          <div className="tutorial-panel tutorial-panel-intro">
            <img className="tutorial-logo" src="/Logo.png" alt="DroneGone team logo" />
            <div className="tutorial-guide-row tutorial-guide-row-panel">
              <TutorialGuideAvatar variant="one" />
              <span className="tutorial-guide-chip">{tutorialStageChipByStage.intro}</span>
            </div>
            <h2>{messages.tutorial.introTitle}</h2>
            <p>{messages.tutorial.introBody}</p>

            <div className="tutorial-focus-grid">
              <div className="tutorial-focus-card">
                <span className="tutorial-focus-label">{messages.tutorial.controlsLabel}</span>
                <div className="tutorial-keyboards">
                  <div className="keypad-wasd tutorial-keypad">
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap tutorial-keycap">W</span>
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap tutorial-keycap">A</span>
                    <span className="keycap tutorial-keycap">S</span>
                    <span className="keycap tutorial-keycap">D</span>
                  </div>
                  <div className="keypad-arrows tutorial-keypad">
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap tutorial-keycap">↑</span>
                    <span className="keycap keycap-small keycap-ghost" />
                    <span className="keycap tutorial-keycap">←</span>
                    <span className="keycap tutorial-keycap">↓</span>
                    <span className="keycap tutorial-keycap">→</span>
                  </div>
                </div>
                <p>{messages.tutorial.controlsBody}</p>
              </div>

              <div className="tutorial-focus-card tutorial-focus-card-accent">
                <span className="tutorial-focus-label">{messages.tutorial.boostLabel}</span>
                <span className="keycap keycap-space tutorial-keycap tutorial-keycap-space">SPACE</span>
                <p>{messages.tutorial.boostBody}</p>
              </div>
            </div>

            <div className="tutorial-actions">
              <button className="ghost-button tutorial-skip-button" onClick={() => setTutorialStage("done")}>
                {messages.tutorial.skip}
              </button>
              <button className="primary-button" onClick={() => setTutorialStage("flight")}>
                {messages.tutorial.start}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {localeChosen && tutorialStage === "checkpoint" ? (
        <div className="tutorial-overlay tutorial-overlay-soft">
          <div className="tutorial-panel">
            <div className="tutorial-guide-row tutorial-guide-row-panel">
              <TutorialGuideAvatar variant="one" />
              <span className="tutorial-guide-chip">{tutorialStageChipByStage.checkpoint}</span>
            </div>
            <TutorialShahedPreview />
            <h2>{messages.tutorial.checkpointTitle}</h2>
            <p>{messages.tutorial.checkpointBodyA}</p>
            <p>{messages.tutorial.checkpointBodyB}</p>

            <div className="tutorial-actions">
              <button className="primary-button" onClick={() => setTutorialStage("target")}>
                {messages.tutorial.checkpointContinue}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {localeChosen && tutorialStage === "outro" ? (
        <div className="tutorial-overlay tutorial-overlay-soft">
          <div className="tutorial-panel">
            <div className="tutorial-guide-row tutorial-guide-row-panel">
              <TutorialGuideAvatar variant="two" />
              <span className="tutorial-guide-chip">{tutorialStageChipByStage.outro}</span>
            </div>
            <h2>{messages.tutorial.outroTitle}</h2>
            <p>{messages.tutorial.outroBodyA}</p>
            <p>{messages.tutorial.outroBodyB}</p>

            <div className="tutorial-actions">
              <button className="primary-button" onClick={() => setTutorialStage("done")}>
                {messages.tutorial.outroContinue}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!localeChosen ? (
        <div className="tutorial-overlay language-gate-overlay">
          <div className="tutorial-panel language-gate-panel">
            <p className="label">{messages.languageGate.eyebrow}</p>
            <h2>{messages.languageGate.title}</h2>
            <p>{messages.languageGate.body}</p>

            <div className="language-gate-buttons">
              <button type="button" className="language-gate-button" onClick={() => setLocale("cs")}>
                <span className="flag">🇨🇿</span>
                <span>CZE</span>
                <small>{messages.languageGate.czech}</small>
              </button>
              <button type="button" className="language-gate-button" onClick={() => setLocale("en")}>
                <span className="flag">🇬🇧</span>
                <span>ENG</span>
                <small>{messages.languageGate.english}</small>
              </button>
              <button type="button" className="language-gate-button" onClick={() => setLocale("uk")}>
                <span className="flag">🇺🇦</span>
                <span>UKR</span>
                <small>{messages.languageGate.ukrainian}</small>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
