import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { PortfolioScene } from "./scene/PortfolioScene";
import { IslandChallenge } from "./scene/IslandChallenge";
import { projects } from "./scene/projects";
import "./styles.css";

export function App() {
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [challengeProjectId, setChallengeProjectId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [unlockedProjectIds, setUnlockedProjectIds] = useState<Set<string>>(new Set());

  const handleProjectFocus = useCallback(
    (projectId: string | null) => {
      if (projectId === null) {
        setFocusedProjectId(null);
        return;
      }

      setFocusedProjectId(projectId);

      // If already unlocked, show dossier immediately
      if (unlockedProjectIds.has(projectId)) {
        setOpenProjectId(projectId);
      } else {
        // Start challenge
        setChallengeProjectId(projectId);
      }
    },
    [unlockedProjectIds]
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

  const isPaused = challengeProjectId !== null || openProjectId !== null;
  const activeProject = focusedProjectId ? projects.find((p) => p.id === focusedProjectId) : null;
  const challengeProject = challengeProjectId ? projects.find((p) => p.id === challengeProjectId) : null;
  const dossierProject = openProjectId ? projects.find((p) => p.id === openProjectId) : null;

  return (
    <main className="app-shell">
      <Canvas dpr={[1, 2]} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <PortfolioScene
          focusedProjectId={focusedProjectId}
          unlockedProjectIds={unlockedProjectIds}
          onProjectFocus={handleProjectFocus}
          paused={isPaused}
        />
      </Canvas>

      <section className="hud hud-top-left">
        <p className="eyebrow">Welcome on board</p>
        <h1>DroneGone</h1>
        <p className="lede">
          Interceptor on the hunt.
          <br />
          We find them, we bind them, we leave them behind
        </p>
      </section>

      <section className="hud hud-bottom-left">
        <p className="label">Controls</p>
        <p>MOVE: arrows / wasd</p>
        <p>CAMERA: automatic follow rig</p>
        <p>PHYSICS: Rapier rigid bodies and trigger zones</p>
      </section>

      <aside className="hud hud-bottom-right">
        <p className="label">Your Objective</p>
        {activeProject && !isPaused ? (
          <>
            <h2>{activeProject.title}</h2>
            <p className="project-tag">{activeProject.tag}</p>
            <p>{activeProject.summary}</p>
          </>
        ) : (
          <>
            <h2>Explore the battlefield</h2>
            <p>Move into any island. Win the fight against the enemy to explore the content</p>
          </>
        )}
      </aside>

      <section className="hud hud-top-right">
        <p className="label">Islands available</p>
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              {project.title}
              {unlockedProjectIds.has(project.id) && <span className="unlocked-badge">✓</span>}
            </li>
          ))}
        </ul>
        <div className="hud-meta">
          <span className="progress-label">{unlockedProjectIds.size} of {projects.length} sectors cleared</span>
        </div>
      </section>

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
              <button className="ghost-button" onClick={handleDossierClose}>
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
                Return to dock
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
