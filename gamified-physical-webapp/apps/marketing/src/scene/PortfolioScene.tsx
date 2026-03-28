import { Environment, Float, KeyboardControls, PerspectiveCamera, Stars, Text, useGLTF, useKeyboardControls, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { useI18n } from "../i18n";
import { getProjects, type ProjectNode } from "./projects";
import droneModelUrl from "../images/drone.glb?url";
import islandModelUrl from "../images/island.glb?url";
import islandCastleModelUrl from "../images/island_castle.glb?url";
import industrialAntennaModelUrl from "../images/industrial_antenna.glb?url";
import waterCubeModelUrl from "../images/water_cube.glb?url";
import shahedModelUrl from "../images/shahed_13.glb?url";
import shahedAnimatedModelUrl from "../images/shahed_for_animation.glb?url";
import dronePlatformModelUrl from "../images/drone_platform.glb?url";
import cityModelUrl from "../images/city.glb?url";
import bannerImageUrl from "../images/banner (1).png";

type ControlName = "forward" | "backward" | "leftward" | "rightward" | "boost";

type PortfolioSceneProps = {
  focusedProjectId: string | null;
  unlockedProjectIds: Set<string>;
  onProjectFocus: (projectId: string | null) => void;
  paused: boolean;
  tutorialActive: boolean;
  tutorialGuidanceMode: "inactive" | "checkpoint" | "target" | "simulation";
  tutorialSpawn: [number, number, number];
  tutorialCheckpoint: [number, number, number];
  tutorialTarget: [number, number, number];
  tutorialSimulation: [number, number, number];
  onTutorialCheckpointReach: () => void;
  onTutorialTargetReach: () => void;
  onTutorialSimulationReach: () => void;
};

const controls = [
  { name: "forward" as const, keys: ["ArrowUp", "KeyW"] },
  { name: "backward" as const, keys: ["ArrowDown", "KeyS"] },
  { name: "leftward" as const, keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward" as const, keys: ["ArrowRight", "KeyD"] },
  { name: "boost" as const, keys: ["Space"] },
];

const cameraOffset = new THREE.Vector3(0, 5.4, 8.8);
const desiredCameraPosition = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const movementVector = new THREE.Vector3();
const smoothedVelocity = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3(0, 1, 0);
const arenaHalf = 46;
const maxShaderIslands = 8;
const droneModelYawOffset = THREE.MathUtils.degToRad(-90);
const droneModelRollOffset = THREE.MathUtils.degToRad(-40);
const interceptDemoYawFix = -Math.PI * 5;
const shahedDemoYawFix = Math.PI;

function wrapAngle(angle: number) {
  const twoPi = Math.PI * 2;
  return ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

function setRepeatMap(texture: THREE.Texture, repeat = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
}

function prepareImportedModel(
  source: THREE.Object3D,
  {
    targetSize,
    lift = 0,
    envMapIntensity = 0.55,
    roughnessDelta = 0,
    metalnessDelta = 0,
  }: {
    targetSize: number;
    lift?: number;
    envMapIntensity?: number;
    roughnessDelta?: number;
    metalnessDelta?: number;
  }
) {
  const root = source.clone(true);

  root.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }

    obj.castShadow = true;
    obj.receiveShadow = true;

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        mat.envMapIntensity = envMapIntensity;
        mat.roughness = THREE.MathUtils.clamp(mat.roughness + roughnessDelta, 0, 1);
        mat.metalness = THREE.MathUtils.clamp(mat.metalness + metalnessDelta, 0, 1);
      }
    });
  });

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  root.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.setScalar(targetSize / maxDim);

  const placedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= placedBounds.min.y - lift;

  return root;
}

const waterVertexShader = `
uniform float uTime;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vWaveHeight;

void main() {
  vUv = uv;
  vec3 pos = position;

  float waveA = sin(pos.x * 0.095 + uTime * 1.1) * 0.15;
  float waveB = cos(pos.z * 0.082 + uTime * 0.92) * 0.11;
  float waveC = sin((pos.x + pos.z) * 0.05 + uTime * 1.34) * 0.06;
  float waveD = sin(length(pos.xz) * 0.09 - uTime * 0.62) * 0.03;

  pos.y += waveA + waveB + waveC + waveD;
  vWaveHeight = pos.y;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const waterFragmentShader = `
uniform float uTime;
uniform vec3 uCameraPos;
uniform int uIslandCount;
uniform vec2 uIslands[8];
uniform sampler2D uNormalMap;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vWaveHeight;

void main() {
  vec3 dx = dFdx(vWorldPos);
  vec3 dy = dFdy(vWorldPos);
  vec3 normal = normalize(cross(dx, dy));
  vec2 nmUv = vWorldPos.xz * 0.045 + vec2(uTime * 0.01, -uTime * 0.008);
  vec3 nmSample = texture2D(uNormalMap, nmUv).rgb * 2.0 - 1.0;
  vec3 nmTangent = normalize(vec3(nmSample.r, 0.58, nmSample.g));
  normal = normalize(normal + nmTangent * 0.16);

  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.35);

  float radial = clamp(length(vWorldPos.xz) / 90.0, 0.0, 1.0);
  vec3 shallowColor = vec3(0.05, 0.21, 0.30);
  vec3 deepColor = vec3(0.01, 0.07, 0.14);
  vec3 waterColor = mix(shallowColor, deepColor, radial);

  float minIslandDist = 9999.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uIslandCount) {
      break;
    }
    float d = distance(vWorldPos.xz, uIslands[i]);
    minIslandDist = min(minIslandDist, d);
  }

  float shorelineFoam = 1.0 - smoothstep(1.6, 4.2, minIslandDist);
  float waveFoam = smoothstep(0.16, 0.28, abs(vWaveHeight));
  float sparkle = sin(vUv.x * 38.0 + uTime * 1.3) * sin(vUv.y * 34.0 - uTime * 1.2);
  sparkle = smoothstep(0.97, 1.0, sparkle) * 0.022;

  vec3 foamTint = vec3(0.76, 0.93, 1.0);
  vec3 finalColor = waterColor;
  finalColor += vec3(0.014, 0.04, 0.07) * fresnel;
  finalColor += foamTint * shorelineFoam * 0.08;
  finalColor += foamTint * waveFoam * 0.02;
  finalColor += vec3(0.04, 0.07, 0.09) * sparkle;

  float alpha = 0.43 + fresnel * 0.038 + shorelineFoam * 0.01;
  gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}
`;

export function PortfolioScene({
  focusedProjectId,
  unlockedProjectIds,
  onProjectFocus,
  paused,
  tutorialActive,
  tutorialGuidanceMode,
  tutorialSpawn,
  tutorialCheckpoint,
  tutorialTarget,
  tutorialSimulation,
  onTutorialCheckpointReach,
  onTutorialTargetReach,
  onTutorialSimulationReach,
}: PortfolioSceneProps) {
  return (
    <KeyboardControls map={controls}>
      <Suspense fallback={null}>
        <SceneContents
          focusedProjectId={focusedProjectId}
          unlockedProjectIds={unlockedProjectIds}
          onProjectFocus={onProjectFocus}
          paused={paused}
          tutorialActive={tutorialActive}
          tutorialGuidanceMode={tutorialGuidanceMode}
          tutorialSpawn={tutorialSpawn}
          tutorialCheckpoint={tutorialCheckpoint}
          tutorialTarget={tutorialTarget}
          tutorialSimulation={tutorialSimulation}
          onTutorialCheckpointReach={onTutorialCheckpointReach}
          onTutorialTargetReach={onTutorialTargetReach}
          onTutorialSimulationReach={onTutorialSimulationReach}
        />
      </Suspense>
    </KeyboardControls>
  );
}

function SceneContents({
  focusedProjectId,
  unlockedProjectIds,
  onProjectFocus,
  paused,
  tutorialActive,
  tutorialGuidanceMode,
  tutorialSpawn,
  tutorialCheckpoint,
  tutorialTarget,
  tutorialSimulation,
  onTutorialCheckpointReach,
  onTutorialTargetReach,
  onTutorialSimulationReach,
}: PortfolioSceneProps) {
  const { resolvedLocale, messages } = useI18n();
  const droneBody = useRef<RapierRigidBody>(null!);
  const heading = useRef(new THREE.Vector3(0, 0, 1));
  const projects = useMemo(() => getProjects(resolvedLocale), [resolvedLocale]);

  return (
    <>
      <color attach="background" args={["#040b14"]} />
      <fog attach="fog" args={["#0b1a28", 70, 220]} />
      <PerspectiveCamera makeDefault position={[0, 7, 12]} fov={42} />

      <ambientLight intensity={0.3} color="#c9dcf2" />
      <hemisphereLight intensity={0.24} color="#9fc8e7" groundColor="#0f2336" />
      <directionalLight
        castShadow
        position={[18, 22, 10]}
        intensity={0.188}
        color="#fff8ee"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={56}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.00008}
      />
      <directionalLight position={[-24, 14, -18]} intensity={0.076} color="#8bb7d6" />

      {/* Rim/counter lights help the drone read clearly against bright water. */}
      <pointLight position={[-15, 9, -15]} intensity={0.28} color="#7aaed1" distance={30} />
      <pointLight position={[14, 7, -10]} intensity={0.24} color="#86a7c4" distance={26} />
      <pointLight position={[0, 5, 4]} intensity={0.45} color="#f3b0a4" distance={18} />

      <Environment files="/hdri/ticknock_02_1k.exr" background={false} />
      <EnvironmentGrade />
      <Stars radius={140} depth={40} count={5500} factor={5} saturation={0} fade speed={0.35} />

      <OceanSurface projects={projects} />
      <OperationalZones />

      {tutorialGuidanceMode !== "inactive" ? (
        <TutorialRoute
          mode={tutorialGuidanceMode}
          spawn={tutorialSpawn}
          checkpoint={tutorialCheckpoint}
          target={tutorialTarget}
          simulation={tutorialSimulation}
          checkpointLabel={messages.scene.checkpoint}
          targetLabel={messages.scene.shahedTarget}
          simulationLabel={messages.scene.simulationPoint}
        />
      ) : null}

      <Physics gravity={[0, 0, 0]}>
        <Floor />
        <BoundaryWalls />
        <Drone bodyRef={droneBody} headingRef={heading} paused={paused} tutorialSpawn={tutorialSpawn} />
        <TargetShahed label={messages.scene.target} />
        <TutorialProgressWatcher
          bodyRef={droneBody}
          mode={tutorialGuidanceMode}
          checkpoint={tutorialCheckpoint}
          target={tutorialTarget}
          simulation={tutorialSimulation}
          onCheckpointReach={onTutorialCheckpointReach}
          onTargetReach={onTutorialTargetReach}
          onSimulationReach={onTutorialSimulationReach}
        />

        {projects.map((project) => (
          <ProjectIsland
            key={project.id}
            active={focusedProjectId === project.id}
            unlocked={unlockedProjectIds.has(project.id)}
            project={project}
            onFocus={onProjectFocus}
            tutorialLocked={tutorialActive}
          />
        ))}
      </Physics>

      <FollowCamera bodyRef={droneBody} headingRef={heading} />
      <DroneRimLight bodyRef={droneBody} />
      <GroundDetails />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.068} luminanceThreshold={0.62} luminanceSmoothing={0.78} mipmapBlur radius={0.3} />
        <Vignette eskil={false} offset={0.28} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

function DroneRimLight({ bodyRef }: { bodyRef: MutableRefObject<RapierRigidBody> }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const body = bodyRef.current;
    const light = lightRef.current;
    if (!body || !light) {
      return;
    }

    const pos = body.translation();
    light.position.set(pos.x - 2.2, pos.y + 1.7, pos.z - 2.9);
    light.intensity = 0.78 + Math.sin(state.clock.elapsedTime * 1.7) * 0.14;
  });

  return <pointLight ref={lightRef} color="#90b5d0" distance={14} intensity={0.22} />;
}

function Drone({
  bodyRef,
  headingRef,
  paused,
  tutorialSpawn,
}: {
  bodyRef: MutableRefObject<RapierRigidBody>;
  headingRef: MutableRefObject<THREE.Vector3>;
  paused: boolean;
  tutorialSpawn: [number, number, number];
}) {
  const [_, getKeys] = useKeyboardControls<ControlName>();
  const { camera } = useThree();
  const droneMesh = useRef<THREE.Group>(null);
  const desiredVelocity = useRef(new THREE.Vector3());
  const boostStrength = useRef(0);
  const gltf = useGLTF(droneModelUrl);
  const droneVisual = useMemo(() => {
    const root = gltf.scene.clone(true);

    root.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;

      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.envMapIntensity = 0.55;
          }
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial) {
        obj.material.envMapIntensity = 0.55;
      }
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 1.25;
    const uniformScale = targetSize / maxDim;
    root.scale.setScalar(uniformScale);

    const placedBounds = new THREE.Box3().setFromObject(root);
    root.position.y -= placedBounds.min.y - 0.02;

    return root;
  }, [gltf.scene]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const mesh = droneMesh.current;

    if (!body || !mesh) {
      return;
    }

    // If paused (challenge/dossier open), freeze the drone
    if (paused) {
      desiredVelocity.current.set(0, 0, 0);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const { forward, backward, leftward, rightward, boost } = getKeys();
    const inputX = Number(rightward) - Number(leftward);
    const inputForward = Number(forward) - Number(backward);

    // Camera-relative movement without axis lock.
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 0.0001) {
      cameraForward.set(0, 0, -1);
    }
    cameraForward.normalize();
    cameraRight.crossVectors(cameraForward, cameraUp).normalize();

    movementVector
      .copy(cameraForward)
      .multiplyScalar(inputForward)
      .addScaledVector(cameraRight, inputX);

    const hasInput = movementVector.lengthSq() > 0;
    boostStrength.current = THREE.MathUtils.lerp(boostStrength.current, boost ? 1 : 0, 1 - Math.exp(-delta * 10));
    const maxSpeed = 11;
    const boostedMaxSpeed = maxSpeed * (1 + boostStrength.current * 0.85);
    const acceleration = 7.2;
    const drag = 4.8;

    if (hasInput) {
      movementVector.normalize();
      desiredVelocity.current.copy(movementVector).multiplyScalar(boostedMaxSpeed);
      headingRef.current.lerp(movementVector, 1 - Math.exp(-delta * 6.5));
    } else {
      desiredVelocity.current.set(0, 0, 0);
    }

    const velocity = body.linvel();
    const velocityLerp = hasInput ? 1 - Math.exp(-delta * acceleration) : 1 - Math.exp(-delta * drag);
    smoothedVelocity.set(
      THREE.MathUtils.lerp(velocity.x, desiredVelocity.current.x, velocityLerp),
      0,
      THREE.MathUtils.lerp(velocity.z, desiredVelocity.current.z, velocityLerp),
    );

    if (!hasInput && smoothedVelocity.lengthSq() < 0.01) {
      smoothedVelocity.set(0, 0, 0);
    }

    body.setLinvel({ x: smoothedVelocity.x, y: 0, z: smoothedVelocity.z }, true);

    const position = body.translation();
    const clampedX = THREE.MathUtils.clamp(position.x, -arenaHalf + 2, arenaHalf - 2);
    const clampedZ = THREE.MathUtils.clamp(position.z, -arenaHalf + 2, arenaHalf - 2);
    if (clampedX !== position.x || clampedZ !== position.z) {
      body.setTranslation({ x: clampedX, y: 1.25, z: clampedZ }, true);
    } else if (Math.abs(position.y - 1.25) > 0.001) {
      body.setTranslation({ x: position.x, y: 1.25, z: position.z }, true);
    }

    const targetYaw = Math.atan2(headingRef.current.x, headingRef.current.z) + Math.PI;
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetYaw, 1 - Math.exp(-delta * 6.2));
    mesh.position.y = 1.25 + Math.sin(performance.now() * 0.0035) * 0.04;
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      gravityScale={0}
      canSleep={false}
      lockRotations
      linearDamping={3.5}
      angularDamping={10}
      position={tutorialSpawn}
    >
      <CuboidCollider args={[1.05, 0.42, 1.95]} />
      <group ref={droneMesh}>
        <primitive object={droneVisual} rotation={[0, Math.PI + droneModelYawOffset, droneModelRollOffset]} />
        <DroneBoostEffect strengthRef={boostStrength} />
        <DroneTargetInfographics />
      </group>
    </RigidBody>
  );
}

function DroneBoostEffect({ strengthRef }: { strengthRef: MutableRefObject<number> }) {
  const flareRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const flare = flareRef.current;
    const light = lightRef.current;
    const strength = strengthRef.current;
    if (!flare || !light) {
      return;
    }

    flare.visible = strength > 0.02;
    light.visible = strength > 0.02;
    flare.scale.set(1, 1 + strength * 2.4, 1);

    const material = flare.material as THREE.MeshStandardMaterial;
    material.opacity = 0.12 + strength * 0.4;
    material.emissiveIntensity = 0.2 + strength * 1.8;
    light.intensity = strength * 1.6;
    light.distance = 2.8 + strength * 2.2;
  });

  return (
    <group position={[0, 0.12, 0.92]}>
      <mesh ref={flareRef} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.42, 12, 1, true]} />
        <meshStandardMaterial color="#8fd8ff" emissive="#5bc0ff" emissiveIntensity={0.2} transparent opacity={0.12} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={lightRef} color="#67c5ff" intensity={0} distance={0} />
    </group>
  );
}

function DroneTargetInfographics() {
  const markerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }

    marker.position.y = 1.45 + Math.sin(state.clock.elapsedTime * 2.2) * 0.03;
  });

  return (
    <group ref={markerRef}>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.09, 0.26, 12]} />
        <meshStandardMaterial color="#7c9cff" emissive="#7c9cff" emissiveIntensity={0.7} metalness={0.25} roughness={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(droneModelUrl);
useGLTF.preload(islandModelUrl);
useGLTF.preload(islandCastleModelUrl);
useGLTF.preload(industrialAntennaModelUrl);
useGLTF.preload(shahedModelUrl);
useGLTF.preload(shahedAnimatedModelUrl);
useGLTF.preload(dronePlatformModelUrl);
useGLTF.preload(cityModelUrl);
useGLTF.preload(waterCubeModelUrl);

function FollowCamera({ bodyRef, headingRef }: { bodyRef: MutableRefObject<RapierRigidBody>; headingRef: MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const position = body.translation();
    desiredCameraPosition
      .copy(headingRef.current)
      .multiplyScalar(-cameraOffset.z)
      .setY(cameraOffset.y)
      .add(new THREE.Vector3(position.x, position.y, position.z));

    camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 4));
    lookTarget.set(position.x, position.y + 1.25, position.z);
    camera.lookAt(lookTarget);
  });

  return null;
}

function ProjectIsland({ active, unlocked, project, onFocus, tutorialLocked }: { active: boolean; unlocked: boolean; project: ProjectNode; onFocus: (projectId: string | null) => void; tutorialLocked: boolean }) {
  const baseIslandGltf = useGLTF(islandModelUrl);
  const castleIslandGltf = useGLTF(islandCastleModelUrl);
  const antennaGltf = useGLTF(industrialAntennaModelUrl);
  const islandVariant = project.id === "sector-alpha" || project.id === "sector-delta" ? "castle" : "base";
  const islandSource = islandVariant === "castle" ? castleIslandGltf.scene : baseIslandGltf.scene;
  const islandLayout = useMemo(() => {
    const root = prepareImportedModel(islandSource, {
      targetSize: islandVariant === "castle" ? 5.8 : 4.6,
      lift: 0.06,
      envMapIntensity: 0.6,
      roughnessDelta: 0.04,
    });

    const colliderBounds = new THREE.Box3().setFromObject(root);
    const colliderCenter = colliderBounds.getCenter(new THREE.Vector3());
    const halfX = Math.max(1.25, (colliderBounds.max.x - colliderBounds.min.x) * 0.5);
    const halfY = Math.max(0.9, (colliderBounds.max.y - colliderBounds.min.y) * 0.5);
    const halfZ = Math.max(1.25, (colliderBounds.max.z - colliderBounds.min.z) * 0.5);

    return {
      root,
      center: [colliderCenter.x, colliderCenter.y, colliderCenter.z] as [number, number, number],
      blocker: [halfX * 0.45, Math.max(0.95, halfY * 0.58), halfZ * 0.45] as [number, number, number],
      sensor: [halfX * 0.98, Math.max(2.0, halfY * 1.2), halfZ * 0.98] as [number, number, number],
    };
  }, [islandSource, islandVariant]);
  const antennaVisual = useMemo(
    () =>
      prepareImportedModel(antennaGltf.scene, {
        targetSize: unlocked ? 2.8 : 2.45,
        lift: 0.02,
        envMapIntensity: 0.48,
        roughnessDelta: 0.08,
      }),
    [antennaGltf.scene, unlocked]
  );
  const beaconOpacity = active ? 0.38 : unlocked ? 0.22 : 0.14;
  const antennaOffsetX = islandVariant === "castle" ? 1.55 : 0.95;
  const antennaOffsetY = islandVariant === "castle" ? 1.65 : 1.05;

  return (
    <RigidBody type="fixed" colliders={false} position={project.position}>
      <CuboidCollider args={islandLayout.blocker} position={islandLayout.center} />
      <CuboidCollider
        args={islandLayout.sensor}
        position={islandLayout.center}
        sensor
        onIntersectionEnter={() => {
          if (!tutorialLocked) {
            onFocus(project.id);
          }
        }}
        onIntersectionExit={() => {
          if (!tutorialLocked) {
            onFocus(null);
          }
        }}
      />

      <primitive object={islandLayout.root} />

      <group position={[islandLayout.center[0] + antennaOffsetX, islandLayout.center[1] + antennaOffsetY, islandLayout.center[2] - 0.78]}>
        <primitive object={antennaVisual} rotation={[0, Math.PI * -0.12, 0]} />
      </group>

      <mesh position={[islandLayout.center[0], 0.06, islandLayout.center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.58, 72]} />
        <meshBasicMaterial color={project.accent} transparent opacity={beaconOpacity} side={THREE.DoubleSide} />
      </mesh>

      {/* Keep legacy challenge anchor aligned to island center, but invisible. */}
      <group visible={false}>
        <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[1.85, 0.07, 8, 64]} />
          <meshStandardMaterial color="#3a6070" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.2, 1.0, 1.2]} />
          <meshStandardMaterial color={project.accent} />
        </mesh>
      </group>
    </RigidBody>
  );
}

function TutorialProgressWatcher({
  bodyRef,
  mode,
  checkpoint,
  target,
  simulation,
  onCheckpointReach,
  onTargetReach,
  onSimulationReach,
}: {
  bodyRef: MutableRefObject<RapierRigidBody>;
  mode: "inactive" | "checkpoint" | "target" | "simulation";
  checkpoint: [number, number, number];
  target: [number, number, number];
  simulation: [number, number, number];
  onCheckpointReach: () => void;
  onTargetReach: () => void;
  onSimulationReach: () => void;
}) {
  const checkpointHit = useRef(false);
  const targetHit = useRef(false);
  const simulationHit = useRef(false);

  useEffect(() => {
    if (mode !== "checkpoint") {
      checkpointHit.current = false;
    }
    if (mode !== "target") {
      targetHit.current = false;
    }
    if (mode !== "simulation") {
      simulationHit.current = false;
    }
  }, [mode]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || mode === "inactive") {
      return;
    }

    const position = body.translation();
    const current = new THREE.Vector3(position.x, position.y, position.z);

    if (mode === "checkpoint" && !checkpointHit.current) {
      const checkpointDistance = current.distanceTo(new THREE.Vector3(...checkpoint));
      if (checkpointDistance <= 3.4) {
        checkpointHit.current = true;
        onCheckpointReach();
      }
    }

    if (mode === "target" && !targetHit.current) {
      const targetDistance = current.distanceTo(new THREE.Vector3(...target));
      if (targetDistance <= 3.3) {
        targetHit.current = true;
        onTargetReach();
      }
    }

    if (mode === "simulation" && !simulationHit.current) {
      const simulationDistance = current.distanceTo(new THREE.Vector3(...simulation));
      if (simulationDistance <= 4.4) {
        simulationHit.current = true;
        onSimulationReach();
      }
    }
  });

  return null;
}

function TutorialRoute({
  mode,
  spawn,
  checkpoint,
  target,
  simulation,
  checkpointLabel,
  targetLabel,
  simulationLabel,
}: {
  mode: "checkpoint" | "target" | "simulation";
  spawn: [number, number, number];
  checkpoint: [number, number, number];
  target: [number, number, number];
  simulation: [number, number, number];
  checkpointLabel: string;
  targetLabel: string;
  simulationLabel: string;
}) {
  const checkpointPulseRef = useRef<THREE.Mesh>(null);
  const targetPulseRef = useRef<THREE.Mesh>(null);
  const simulationPulseRef = useRef<THREE.Mesh>(null);

  const points = useMemo(() => {
    if (mode === "simulation") {
      return [new THREE.Vector3(target[0], 0.18, target[2]), new THREE.Vector3(simulation[0], 0.18, simulation[2])];
    }

    if (mode === "checkpoint") {
      return [new THREE.Vector3(spawn[0], 0.18, spawn[2]), new THREE.Vector3(checkpoint[0], 0.18, checkpoint[2])];
    }

    const checkpointPoint = new THREE.Vector3(checkpoint[0], 0.18, checkpoint[2]);
    const targetPoint = new THREE.Vector3(target[0], 0.18, target[2]);
    const toTarget = targetPoint.clone().sub(checkpointPoint).setY(0).normalize();
    const right = new THREE.Vector3(-toTarget.z, 0, toTarget.x);

    // Wide tutorial detour to keep drone visible, then a rear approach onto Shahed.
    const detourA = checkpointPoint.clone().addScaledVector(right, 12).addScaledVector(toTarget, 1.8);
    const detourB = checkpointPoint.clone().addScaledVector(right, 19).addScaledVector(toTarget, 8.5);
    const detourC = targetPoint.clone().addScaledVector(right, 13.5).addScaledVector(toTarget, 7.5);
    const rearEntry = targetPoint.clone().addScaledVector(right, 6.4).addScaledVector(toTarget, 3.9);
    const finalTurn = targetPoint.clone().addScaledVector(right, 1.9).addScaledVector(toTarget, 1.1);

    return [
      checkpointPoint,
      detourA,
      detourB,
      detourC,
      rearEntry,
      finalTurn,
      targetPoint,
    ];
  }, [mode, spawn, checkpoint, target, simulation]);

  const routeCurve = useMemo(() => new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.2), [points]);
  const routeCurvePoints = useMemo(() => routeCurve.getPoints(140), [routeCurve]);
  const routeStripGeometry = useMemo(() => new THREE.TubeGeometry(routeCurve, 120, 0.11, 12, false), [routeCurve]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(routeCurvePoints), [routeCurvePoints]);
  const material = useMemo(
    () => new THREE.LineDashedMaterial({ color: "#ff2f2f", dashSize: 1.35, gapSize: 0.45, transparent: true, opacity: 0.98 }),
    []
  );
  const routeLine = useMemo(() => {
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, [geometry, material]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    return () => routeStripGeometry.dispose();
  }, [routeStripGeometry]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    material.opacity = 0.84 + (Math.sin(state.clock.elapsedTime * 4.2) + 1) * 0.08;

    const pulseScale = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.18;
    if (checkpointPulseRef.current) {
      checkpointPulseRef.current.scale.setScalar(mode === "checkpoint" ? pulseScale : 1);
    }
    if (targetPulseRef.current) {
      targetPulseRef.current.scale.setScalar(mode === "target" ? pulseScale : 1);
    }
    if (simulationPulseRef.current) {
      simulationPulseRef.current.scale.setScalar(mode === "simulation" ? pulseScale : 1);
    }
  });

  return (
    <group>
      {/* Thick base strip doubles route visibility while keeping dashed tactical line on top. */}
      <mesh geometry={routeStripGeometry} position={[0, 0.035, 0]}>
        <meshBasicMaterial color="#ff2a2a" transparent opacity={0.38} depthWrite={false} toneMapped={false} />
      </mesh>
      <primitive object={routeLine} />

      <group position={[checkpoint[0], 0.08, checkpoint[2]]} visible={mode === "checkpoint"}>
        <mesh ref={checkpointPulseRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8, 2.35, 64]} />
          <meshBasicMaterial color="#ff8f7d" transparent opacity={0.42} side={THREE.DoubleSide} />
        </mesh>
        <Float speed={1.4} rotationIntensity={0} floatIntensity={0.2} position={[0, 1.8, 0]}>
          <Text fontSize={0.34} color="#ffd5cf" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#2d0707">
            {checkpointLabel}
          </Text>
        </Float>
      </group>

      <group position={[target[0], 0.08, target[2]]} visible={mode === "target"}>
        <mesh ref={targetPulseRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.8, 3.4, 96]} />
          <meshBasicMaterial color="#ff4b4b" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        <Float speed={1.2} rotationIntensity={0} floatIntensity={0.16} position={[0, 3.3, 0]}>
          <Text fontSize={0.38} color="#ffb4b4" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#290808">
            {targetLabel}
          </Text>
        </Float>
      </group>

      <group position={[simulation[0], 0.08, simulation[2]]} visible={mode === "simulation"}>
        <mesh ref={simulationPulseRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.2, 4.2, 96]} />
          <meshBasicMaterial color="#ffd977" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
        <Float speed={1.1} rotationIntensity={0} floatIntensity={0.16} position={[0, 3.6, 0]}>
          <Text fontSize={0.4} color="#ffe8b5" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#302108">
            {simulationLabel}
          </Text>
        </Float>
      </group>
    </group>
  );
}

function TargetShahed({ label }: { label: string }) {
  const gltf = useGLTF(shahedModelUrl);
  const shahedVisual = useMemo(() => {
    const root = gltf.scene.clone(true);

    root.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;

      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.envMapIntensity = 0.22;
            mat.roughness = Math.min(1, mat.roughness + 0.16);
            mat.metalness = Math.max(0.03, mat.metalness - 0.1);
          }
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial) {
        obj.material.envMapIntensity = 0.22;
        obj.material.roughness = Math.min(1, obj.material.roughness + 0.16);
        obj.material.metalness = Math.max(0.03, obj.material.metalness - 0.1);
      }
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 4.4;
    root.scale.setScalar(targetSize / maxDim);

    const placedBounds = new THREE.Box3().setFromObject(root);
    root.position.y -= placedBounds.min.y;

    return root;
  }, [gltf.scene]);

  return (
    <RigidBody type="fixed" colliders={false} position={[0, -0.02, 0]}>
      <CuboidCollider args={[1.5, 0.8, 1.5]} sensor />
      <primitive object={shahedVisual} rotation={[0, Math.PI / 2, 0]} />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.7, 96]} />
        <meshBasicMaterial color="#f87171" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <Float speed={1} rotationIntensity={0.04} floatIntensity={0.12} position={[0, 2.5, 0]}>
        <Text
          maxWidth={3}
          fontSize={0.3}
          textAlign="center"
          color="#fca5a5"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#220b0b"
        >
          {label}
        </Text>
      </Float>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 72]} />
        <meshBasicMaterial color="#101722" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
}

function OperationalZones() {
  const { messages } = useI18n();

  return (
    <group>
      <PolygonZone position={[22, 0, -16]} radius={10.5} sides={6} title="">
        <ZoneInterceptAnimation />
        <ZoneInterceptBriefingBoard />
      </PolygonZone>

      <PolygonZone position={[22, 0, 16]} radius={9.8} sides={8} title="C2 DATA LINK">
        <ZoneNetworkAnimation />
      </PolygonZone>
    </group>
  );
}

function ZoneInterceptBriefingBoard() {
  const bannerTexture = useTexture(bannerImageUrl);

  useMemo(() => {
    bannerTexture.colorSpace = THREE.SRGBColorSpace;
    bannerTexture.wrapS = THREE.ClampToEdgeWrapping;
    bannerTexture.wrapT = THREE.ClampToEdgeWrapping;
  }, [bannerTexture]);

  return (
    <group position={[0, 1.78, -4.9]}>
      <mesh>
        <boxGeometry args={[11.8, 3.05, 0.26]} />
        <meshStandardMaterial color="#0f1725" emissive="#0a1320" emissiveIntensity={0.22} metalness={0.2} roughness={0.7} />
      </mesh>

      <mesh position={[0, 0, 0.145]}>
        <planeGeometry args={[11.15, 1.95]} />
        <meshBasicMaterial map={bannerTexture} transparent opacity={0.95} />
      </mesh>

      <mesh position={[0, 0, 0.146]}>
        <planeGeometry args={[11.15, 1.95]} />
        <meshBasicMaterial color="#08111d" transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function PolygonZone({
  position,
  radius,
  sides,
  title,
  children,
}: {
  position: [number, number, number];
  radius: number;
  sides: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[radius, radius, 0.76, sides, 1, true]} />
        <meshStandardMaterial color="#4d6f86" transparent opacity={0.14} emissive="#2e4d63" emissiveIntensity={0.22} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[radius, radius, 0.06, sides]} />
        <meshStandardMaterial color="#85aecd" transparent opacity={0.38} emissive="#89bee2" emissiveIntensity={0.18} />
      </mesh>

      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[radius * 0.96, radius * 0.96, 0.05, sides]} />
        <meshBasicMaterial color="#233a4b" transparent opacity={0.26} />
      </mesh>

      <Float speed={1.1} rotationIntensity={0} floatIntensity={0.11} position={[0, 3.35, 0]}>
        <Text fontSize={0.58} color="#c6e4ff" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#091320">
          {title}
        </Text>
      </Float>

      {children}
    </group>
  );
}

function ZoneInterceptAnimation() {
  const defenderRef = useRef<THREE.Group>(null);
  const attackerRef = useRef<THREE.Group>(null);
  const blastRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const attackerGltf = useGLTF(shahedAnimatedModelUrl);
  const defenderGltf = useGLTF(droneModelUrl);
  const platformGltf = useGLTF(dronePlatformModelUrl);
  const cityGltf = useGLTF(cityModelUrl);
  const attackerVisual = useMemo(
    () =>
      prepareImportedModel(attackerGltf.scene, {
        targetSize: 1.675,
        lift: 0,
        envMapIntensity: 0.24,
        roughnessDelta: 0.16,
        metalnessDelta: -0.08,
      }),
    [attackerGltf.scene]
  );
  const interceptorVisual = useMemo(
    () =>
      prepareImportedModel(defenderGltf.scene, {
        targetSize: 1.15,
        lift: 0,
        envMapIntensity: 0.46,
        roughnessDelta: 0.06,
      }),
    [defenderGltf.scene]
  );
  const platformVisual = useMemo(
    () =>
      prepareImportedModel(platformGltf.scene, {
        targetSize: 4.3,
        lift: 0,
        envMapIntensity: 0.32,
        roughnessDelta: 0.14,
        metalnessDelta: -0.06,
      }),
    [platformGltf.scene]
  );
  const cityVisual = useMemo(
    () => {
      const root = prepareImportedModel(cityGltf.scene, {
        targetSize: 6.9,
        lift: 0,
        envMapIntensity: 0.4,
        roughnessDelta: 0.08,
        metalnessDelta: -0.03,
      });

      // Emphasize skyline silhouette by stretching city strongly in vertical axis.
      root.scale.y *= 3;
      const adjustedBounds = new THREE.Box3().setFromObject(root);
      root.position.y -= adjustedBounds.min.y;

      return root;
    },
    [cityGltf.scene]
  );
  const beamMid = useMemo(() => new THREE.Vector3(), []);
  const beamDir = useMemo(() => new THREE.Vector3(), []);
  const beamQuat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const interceptControl = useMemo(() => new THREE.Vector3(), []);
  const interceptEnd = useMemo(() => new THREE.Vector3(), []);
  const launchMid = useMemo(() => new THREE.Vector3(), []);
  const launchTangent = useMemo(() => new THREE.Vector3(), []);
  const interceptTangent = useMemo(() => new THREE.Vector3(), []);
  const mixedDir = useMemo(() => new THREE.Vector3(), []);
  const attackTangent = useMemo(() => new THREE.Vector3(), []);
  const platformPosition = useMemo(() => new THREE.Vector3(5.65, 0.62, -1.85), []);
  const cityPosition = useMemo(() => new THREE.Vector3(4.8, 0.65, 4.6), []);
  const launchPoint = useMemo(() => platformPosition.clone().add(new THREE.Vector3(-0.75, 1.45, 0.3)), [platformPosition]);
  const defenseHover = useMemo(() => launchPoint.clone().setY(5.55), [launchPoint]);
  const attackerCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-7.4, 1.55, -5.2),
          new THREE.Vector3(-2.1, 2.25, -3.7),
          new THREE.Vector3(1.8, 1.9, -1.1),
          new THREE.Vector3(3.6, 1.7, 0.55),
          new THREE.Vector3(4.8, 1.35, 1.8),
          new THREE.Vector3(5.2, 1.2, 2.8),
        ],
        false,
        "catmullrom",
        0.28
      ),
    []
  );
  const previousAttackerYaw = useRef(0);
  const previousDefenderYaw = useRef(0);
  const strikeLaunchPoint = useRef(new THREE.Vector3());
  const strikeCaptured = useRef(false);

  useFrame((state, delta) => {
    const defender = defenderRef.current;
    const attacker = attackerRef.current;
    const blast = blastRef.current;
    const beam = beamRef.current;

    if (!defender || !attacker || !blast || !beam) {
      return;
    }

    const cycle = 18;
    const t = state.clock.elapsedTime % cycle;

    const launchStart = 2.2;
    const launchEnd = 4.6;
    const trackStart = 4.6;
    const strikeStart = 6.9;
    const strikeEnd = 8.6;

    if (t < launchStart) {
      strikeCaptured.current = false;
      defender.position.set(launchPoint.x, launchPoint.y + Math.sin(t * 2.6) * 0.015, launchPoint.z);
      defender.rotation.set(0, Math.PI * 0.2, 0);
      previousDefenderYaw.current = Math.PI * 0.2;
    } else if (t < launchEnd) {
      const p = THREE.MathUtils.smootherstep((t - launchStart) / (launchEnd - launchStart), 0, 1);
      const launchPeak = defenseHover.y;
      launchMid.copy(launchPoint).addScaledVector(up, (launchPeak - launchPoint.y) * p);
      defender.position.copy(launchMid);

      launchTangent.set(0, 1, 0);

      const yaw = Math.atan2(launchTangent.x, launchTangent.z);
      const pitch = -Math.atan2(launchTangent.y, Math.max(0.001, Math.hypot(launchTangent.x, launchTangent.z)));
      const yawDelta = wrapAngle(yaw - previousDefenderYaw.current);
      previousDefenderYaw.current = yaw;
      const roll = THREE.MathUtils.clamp(-yawDelta * 5.1, -0.5, 0.5);
      defender.rotation.set(pitch, yaw + interceptDemoYawFix, roll);
    } else {
      const orbit = t * 0.62;
      const orbitX = Math.sin(orbit) * 0.68;
      const orbitZ = Math.cos(orbit * 1.04) * 0.45;
      defender.position.set(defenseHover.x + orbitX, defenseHover.y + Math.sin(t * 1.2) * 0.2, defenseHover.z + orbitZ);

      const loiterDir = mixedDir.set(Math.cos(orbit), 0, -Math.sin(orbit * 1.04)).normalize();
      const loiterYaw = Math.atan2(loiterDir.x, loiterDir.z);
      defender.rotation.set(-0.05 + Math.sin(t * 1.9) * 0.03, loiterYaw + interceptDemoYawFix, Math.sin(t * 1.4) * 0.08);
      previousDefenderYaw.current = loiterYaw;
    }

    const attackerProgress = THREE.MathUtils.clamp(t / 9.4, 0, 1);
    attacker.position.copy(attackerCurve.getPointAt(attackerProgress));
    attackTangent.copy(attackerCurve.getTangentAt(attackerProgress)).normalize();
    const attackerYaw = Math.atan2(attackTangent.x, attackTangent.z);
    const attackerPitch = -Math.atan2(attackTangent.y, Math.max(0.001, Math.hypot(attackTangent.x, attackTangent.z)));
    const attackerYawDelta = wrapAngle(attackerYaw - previousAttackerYaw.current);
    previousAttackerYaw.current = attackerYaw;
    const attackerRoll = THREE.MathUtils.clamp(-attackerYawDelta * 2.2 + Math.sin(attackerProgress * Math.PI * 2.8) * 0.06, -0.24, 0.24);
    const rotLerp = 1 - Math.exp(-delta * 8);
    attacker.rotation.x = THREE.MathUtils.lerp(attacker.rotation.x, attackerPitch, rotLerp);
    attacker.rotation.y = THREE.MathUtils.lerp(attacker.rotation.y, attackerYaw + shahedDemoYawFix, rotLerp);
    attacker.rotation.z = THREE.MathUtils.lerp(attacker.rotation.z, attackerRoll, rotLerp);
    attacker.visible = t < 9.8;

    const tracking = t >= trackStart && t < strikeStart;
    beam.visible = tracking;
    if (tracking) {
      beamMid.copy(defender.position).add(attacker.position).multiplyScalar(0.5);
      beamDir.copy(attacker.position).sub(defender.position);
      const beamLen = beamDir.length();
      beam.position.copy(beamMid);
      beam.scale.set(1, beamLen, 1);
      beamQuat.setFromUnitVectors(up, beamDir.normalize());
      beam.quaternion.copy(beamQuat);
      const beamMat = beam.material as THREE.MeshStandardMaterial;
      beamMat.opacity = 0.22 + Math.sin(t * 9.5) * 0.05;
    }

    const strikePhase = THREE.MathUtils.clamp((t - strikeStart) / (strikeEnd - strikeStart), 0, 1);
    if (t >= strikeStart && t <= strikeEnd) {
      if (!strikeCaptured.current) {
        strikeLaunchPoint.current.copy(defender.position);
        strikeCaptured.current = true;
      }

      interceptEnd.copy(attacker.position).addScaledVector(attackTangent, -0.2);
      interceptControl.copy(strikeLaunchPoint.current).lerp(interceptEnd, 0.48).addScaledVector(up, 1.25);

      defender.position
        .copy(strikeLaunchPoint.current)
        .multiplyScalar((1 - strikePhase) * (1 - strikePhase))
        .addScaledVector(interceptControl, 2 * (1 - strikePhase) * strikePhase)
        .addScaledVector(interceptEnd, strikePhase * strikePhase);

      interceptTangent
        .copy(interceptControl)
        .sub(defender.position)
        .multiplyScalar(2 * (1 - strikePhase))
        .addScaledVector(mixedDir.copy(interceptEnd).sub(interceptControl), 2 * strikePhase)
        .normalize();

      const yaw = Math.atan2(interceptTangent.x, interceptTangent.z);
      const pitch = -Math.atan2(interceptTangent.y, Math.max(0.001, Math.hypot(interceptTangent.x, interceptTangent.z)));
      const yawDelta = wrapAngle(yaw - previousDefenderYaw.current);
      previousDefenderYaw.current = yaw;
      const roll = THREE.MathUtils.clamp(-yawDelta * 5.4, -0.72, 0.72);
      defender.rotation.set(pitch, yaw + interceptDemoYawFix, roll);
    } else if (t > strikeEnd) {
      strikeCaptured.current = false;
    }

    const blastPhase = THREE.MathUtils.clamp((t - strikeEnd) / 2.1, 0, 1);
    blast.visible = t >= strikeEnd && t <= 10.1;
    if (blast.visible) {
      blast.position.copy(attacker.position).addScaledVector(attackTangent, -0.12);
      blast.scale.setScalar(0.4 + blastPhase * 3.4);
      const blastMat = blast.material as THREE.MeshStandardMaterial;
      blastMat.opacity = 0.55 - blastPhase * 0.5;
      blastMat.emissiveIntensity = 1.4 - blastPhase;
    }
  });

  return (
    <group>
      <group position={[platformPosition.x, platformPosition.y, platformPosition.z]}>
        <primitive object={platformVisual} rotation={[0, Math.PI * 0.52, 0]} />
      </group>

      <group position={[cityPosition.x, cityPosition.y, cityPosition.z]}>
        <primitive object={cityVisual} rotation={[0, Math.PI * -0.08, 0]} />
      </group>

      <group ref={defenderRef}>
        <primitive object={interceptorVisual} rotation={[0, Math.PI + droneModelYawOffset, droneModelRollOffset]} />
        <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.58, 40]} />
          <meshBasicMaterial color="#7cedc8" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={attackerRef}>
        <primitive object={attackerVisual} />
      </group>

      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.055, 0.055, 1, 10]} />
        <meshStandardMaterial color="#7bcfff" emissive="#5dc7ff" emissiveIntensity={0.5} transparent opacity={0.2} />
      </mesh>

      <mesh ref={blastRef}>
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshStandardMaterial color="#ffb78f" emissive="#ff8f5a" emissiveIntensity={1.4} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function ZoneNetworkAnimation() {
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const packetA = useRef<THREE.Mesh>(null);
  const packetB = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringA.current) {
      ringA.current.rotation.z = t * 0.34;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.22;
    }
    if (packetA.current) {
      packetA.current.position.y = 0.5 + ((t * 1.2) % 2.8);
    }
    if (packetB.current) {
      packetB.current.position.y = 0.5 + (((t * 1.2) + 1.3) % 2.8);
    }
  });

  return (
    <group>
      <mesh ref={ringA} position={[0, 1.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.35, 64]} />
        <meshBasicMaterial color="#80d7ff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringB} position={[0, 1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.1, 3.35, 64]} />
        <meshBasicMaterial color="#6ea9ff" transparent opacity={0.32} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[-2.1, 1.4, -1.8]}>
        <boxGeometry args={[0.4, 2.8, 0.4]} />
        <meshStandardMaterial color="#99aeca" emissive="#8db8dd" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[2.2, 1.4, 2]}>
        <boxGeometry args={[0.4, 2.8, 0.4]} />
        <meshStandardMaterial color="#99aeca" emissive="#8db8dd" emissiveIntensity={0.2} />
      </mesh>

      <mesh position={[0.1, 2.1, 0.12]} rotation={[0.4, 0.78, 0]}>
        <boxGeometry args={[5.9, 0.08, 0.08]} />
        <meshStandardMaterial color="#8ed9ff" emissive="#7fcfff" emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>

      <mesh ref={packetA} position={[0.1, 0.5, 0.12]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#dff4ff" emissive="#cdefff" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={packetB} position={[0.1, 1.3, 0.12]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#c8edff" emissive="#b5e6ff" emissiveIntensity={0.55} />
      </mesh>
    </group>
  );
}

function Floor() {
  const gltf = useGLTF(waterCubeModelUrl);
  const groundVisual = useMemo(() => {
    const root = gltf.scene.clone(true);

    root.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }

      obj.castShadow = false;
      obj.receiveShadow = true;

      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.envMapIntensity = 0.35;
            mat.roughness = Math.min(1, mat.roughness + 0.08);
          }
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial) {
        obj.material.envMapIntensity = 0.35;
        obj.material.roughness = Math.min(1, obj.material.roughness + 0.08);
      }
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    root.position.sub(center);

    const maxDimXZ = Math.max(size.x, size.z, 0.001);
    const targetXZ = arenaHalf * 2.5;
    const targetY = 0.6;
    const scaleXZ = targetXZ / maxDimXZ;
    const scaleY = targetY / Math.max(size.y, 0.001);
    root.scale.set(scaleXZ, scaleY, scaleXZ);

    const placedBounds = new THREE.Box3().setFromObject(root);
    root.position.y -= placedBounds.min.y;

    return root;
  }, [gltf.scene]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[arenaHalf, 0.5, arenaHalf]} position={[0, -0.5, 0]} />

      <primitive object={groundVisual} position={[0, -0.62, 0]} />

      {/* Keep a subtle tactical plate so ocean is visible instead of covered. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <planeGeometry args={[arenaHalf * 1.18, arenaHalf * 1.18, 1, 1]} />
        <meshStandardMaterial
          color="#12202b"
          roughness={0.95}
          metalness={0.08}
          transparent
          opacity={0.04}
        />
      </mesh>
    </RigidBody>
  );
}

function OceanSurface({ projects }: { projects: ProjectNode[] }) {
  const waterRef = useRef<THREE.Mesh>(null);
  const waterNormal = useTexture("/textures/water_nor_1k.jpg");

  useMemo(() => {
    setRepeatMap(waterNormal, 18);
  }, [waterNormal]);

  const waterMaterial = useMemo(() => {
    const islands = new Array(maxShaderIslands).fill(0).map(() => new THREE.Vector2(9999, 9999));
    projects.slice(0, maxShaderIslands).forEach((project, i) => {
      islands[i].set(project.position[0], project.position[2]);
    });

    return new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
        uIslandCount: { value: Math.min(projects.length, maxShaderIslands) },
        uIslands: { value: islands },
        uNormalMap: { value: waterNormal },
      },
    });
  }, [waterNormal]);
  const foamRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const foam = foamRef.current;

    const t = state.clock.getElapsedTime();
    waterMaterial.uniforms.uTime.value = t;
    waterMaterial.uniforms.uCameraPos.value.copy(state.camera.position);

    if (foam) {
      foam.position.y = -0.08 + Math.sin(t * 0.7) * 0.02;
      const mat = foam.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.02 + (Math.sin(t * 1.6) + 1) * 0.01;
      mat.opacity = 0.02 + (Math.sin(t * 0.8) + 1) * 0.012;
    }
  });

  useEffect(() => {
    return () => {
      waterMaterial.dispose();
    };
  }, [waterMaterial]);

  return (
    <group>
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
        <planeGeometry args={[160, 160, 140, 140]} />
        <primitive object={waterMaterial} attach="material" />
      </mesh>

      <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[12, 30, 128]} />
        <meshStandardMaterial
          color="#8eb9ca"
          roughness={0.35}
          metalness={0.12}
          emissive="#90c8db"
          emissiveIntensity={0.012}
          transparent
          opacity={0.012}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]}>
        <ringGeometry args={[68, 86, 128]} />
        <meshBasicMaterial color="#5e7f92" transparent opacity={0.005} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BoundaryWalls() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 2.5, arenaHalf]} position={[-arenaHalf, 1.8, 0]} />
        <CuboidCollider args={[0.8, 2.5, arenaHalf]} position={[arenaHalf, 1.8, 0]} />
        <CuboidCollider args={[arenaHalf, 2.5, 0.8]} position={[0, 1.8, -arenaHalf]} />
        <CuboidCollider args={[arenaHalf, 2.5, 0.8]} position={[0, 1.8, arenaHalf]} />

        {/* Subtle visual rails so arena bounds are readable without neon walls. */}
        <mesh position={[-arenaHalf, 0.06, 0]}>
          <boxGeometry args={[0.28, 0.12, arenaHalf * 2 + 0.8]} />
          <meshStandardMaterial color="#30546b" emissive="#3d6f8f" emissiveIntensity={0.08} metalness={0.45} roughness={0.42} />
        </mesh>
        <mesh position={[arenaHalf, 0.06, 0]}>
          <boxGeometry args={[0.28, 0.12, arenaHalf * 2 + 0.8]} />
          <meshStandardMaterial color="#30546b" emissive="#3d6f8f" emissiveIntensity={0.08} metalness={0.45} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.06, -arenaHalf]}>
          <boxGeometry args={[arenaHalf * 2 + 0.8, 0.12, 0.28]} />
          <meshStandardMaterial color="#30546b" emissive="#3d6f8f" emissiveIntensity={0.08} metalness={0.45} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.06, arenaHalf]}>
          <boxGeometry args={[arenaHalf * 2 + 0.8, 0.12, 0.28]} />
          <meshStandardMaterial color="#30546b" emissive="#3d6f8f" emissiveIntensity={0.08} metalness={0.45} roughness={0.42} />
        </mesh>
      </RigidBody>
    </>
  );
}

function GroundDetails() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.31, 0]}>
        <ringGeometry args={[20, 44, 96]} />
        <meshBasicMaterial color="#46718a" transparent opacity={0.02} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function EnvironmentGrade() {
  const { scene } = useThree();

  useEffect(() => {
    const prevEnvIntensity = scene.environmentIntensity;
    const prevBgIntensity = scene.backgroundIntensity;

    scene.environmentIntensity = 0.42;
    scene.backgroundIntensity = 1.0;

    return () => {
      scene.environmentIntensity = prevEnvIntensity;
      scene.backgroundIntensity = prevBgIntensity;
    };
  }, [scene]);

  return null;
}