import { Environment, Float, KeyboardControls, PerspectiveCamera, Stars, Text, useKeyboardControls } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { projects, type ProjectNode } from "./projects";
import logoMark from "../images/Logo.png";

type ControlName = "forward" | "backward" | "leftward" | "rightward";

type PortfolioSceneProps = {
  focusedProjectId: string | null;
  unlockedProjectIds: Set<string>;
  onProjectFocus: (projectId: string | null) => void;
  paused: boolean;
};

const controls = [
  { name: "forward" as const, keys: ["ArrowUp", "KeyW"] },
  { name: "backward" as const, keys: ["ArrowDown", "KeyS"] },
  { name: "leftward" as const, keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward" as const, keys: ["ArrowRight", "KeyD"] },
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

export function PortfolioScene({ focusedProjectId, unlockedProjectIds, onProjectFocus, paused }: PortfolioSceneProps) {
  return (
    <KeyboardControls map={controls}>
      <Suspense fallback={null}>
        <SceneContents
          focusedProjectId={focusedProjectId}
          unlockedProjectIds={unlockedProjectIds}
          onProjectFocus={onProjectFocus}
          paused={paused}
        />
      </Suspense>
    </KeyboardControls>
  );
}

function SceneContents({ focusedProjectId, unlockedProjectIds, onProjectFocus, paused }: PortfolioSceneProps) {
  const droneBody = useRef<RapierRigidBody>(null!);
  const heading = useRef(new THREE.Vector3(0, 0, 1));

  return (
    <>
      <color attach="background" args={["#020c16"]} />
      <fog attach="fog" args={["#020c16", 68, 200]} />
      <PerspectiveCamera makeDefault position={[0, 7, 12]} fov={42} />

      <ambientLight intensity={1.25} color="#d7ecff" />
      <hemisphereLight intensity={0.85} color="#d5f2ff" groundColor="#0a2233" />
      <directionalLight
        castShadow
        position={[12, 16, 8]}
        intensity={1.5}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.00008}
      />

      {/* Cool accent light for tech mood without tinting water green */}
      <pointLight position={[-15, 8, -15]} intensity={0.8} color="#7bd8ff" distance={36} />

      <Environment preset="sunset" />
      <Stars radius={140} depth={40} count={5500} factor={5} saturation={0} fade speed={0.35} />

      <OceanSurface />

      <Physics gravity={[0, 0, 0]}>
        <Floor />
        <BoundaryWalls />
        <Drone bodyRef={droneBody} headingRef={heading} paused={paused} />

        {projects.map((project) => (
          <ProjectIsland
            key={project.id}
            active={focusedProjectId === project.id}
            unlocked={unlockedProjectIds.has(project.id)}
            project={project}
            onFocus={onProjectFocus}
          />
        ))}
      </Physics>

      <FollowCamera bodyRef={droneBody} headingRef={heading} />
      <GroundDetails />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.6}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.82}
          mipmapBlur
          radius={0.72}
        />
        <Vignette eskil={false} offset={0.28} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

function Drone({ bodyRef, headingRef, paused }: { bodyRef: MutableRefObject<RapierRigidBody>; headingRef: MutableRefObject<THREE.Vector3>; paused: boolean }) {
  const [_, getKeys] = useKeyboardControls<ControlName>();
  const { camera } = useThree();
  const droneMesh = useRef<THREE.Group>(null);
  const thrusterGlow = useRef<THREE.Group>(null);
  const desiredVelocity = useRef(new THREE.Vector3());
  const logoTexture = useLoader(THREE.TextureLoader, logoMark);
  logoTexture.wrapS = THREE.ClampToEdgeWrapping;
  logoTexture.wrapT = THREE.ClampToEdgeWrapping;

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

    const { forward, backward, leftward, rightward } = getKeys();
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
    const maxSpeed = 11;
    const acceleration = 7.2;
    const drag = 4.8;

    if (hasInput) {
      movementVector.normalize();
      desiredVelocity.current.copy(movementVector).multiplyScalar(maxSpeed);
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

    body.setLinvel({ x: smoothedVelocity.x, y: 0, z: smoothedVelocity.z }, true);

    const speedRatio = Math.min(1, smoothedVelocity.length() / 12);
    if (thrusterGlow.current) {
      thrusterGlow.current.scale.setScalar(0.85 + speedRatio * 0.45);
    }

    const position = body.translation();
    const clampedX = THREE.MathUtils.clamp(position.x, -arenaHalf + 2, arenaHalf - 2);
    const clampedZ = THREE.MathUtils.clamp(position.z, -arenaHalf + 2, arenaHalf - 2);
    if (clampedX !== position.x || clampedZ !== position.z) {
      body.setTranslation({ x: clampedX, y: 1.25, z: clampedZ }, true);
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
      position={[-16, 1.25, -16]}
    >
      <CuboidCollider args={[1.05, 0.42, 1.95]} />
      <group ref={droneMesh}>
        {/* Cleaner rocket-style fuselage */}
        <mesh castShadow receiveShadow position={[0, 0.02, -0.05]}>
          <capsuleGeometry args={[0.3, 2.5, 10, 16]} />
          <meshStandardMaterial color="#2b3136" metalness={0.8} roughness={0.24} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, -0.12, 0.1]}>
          <capsuleGeometry args={[0.23, 2.0, 8, 12]} />
          <meshStandardMaterial color="#11161a" metalness={0.46} roughness={0.72} />
        </mesh>

        <mesh castShadow position={[0, 0.12, -0.08]}>
          <boxGeometry args={[0.16, 0.05, 2.3]} />
          <meshStandardMaterial color="#67e8f9" emissive="#38bdf8" emissiveIntensity={1.2} metalness={1} roughness={0.1} toneMapped={false} />
        </mesh>

        {/* Rocket nose */}
        <mesh castShadow position={[0, 0.03, -1.58]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2, 0.78, 14]} />
          <meshStandardMaterial color="#9bd6ff" metalness={0.86} roughness={0.2} emissive="#38bdf8" emissiveIntensity={0.18} />
        </mesh>

        {/* Canopy */}
        <mesh castShadow position={[0, 0.22, -0.5]} scale={[1, 0.56, 1]}>
          <sphereGeometry args={[0.24, 14, 10]} />
          <meshStandardMaterial color="#b9ebff" transparent opacity={0.36} metalness={0.72} roughness={0.08} emissive="#67e8f9" emissiveIntensity={0.1} />
        </mesh>

        {/* Minimal clean fins */}
        <mesh castShadow position={[-0.68, -0.04, 0.26]} rotation={[0, 0.24, 0]}>
          <boxGeometry args={[0.78, 0.07, 0.3]} />
          <meshStandardMaterial color="#2d343a" metalness={0.78} roughness={0.24} />
        </mesh>
        <mesh castShadow position={[0.68, -0.04, 0.26]} rotation={[0, -0.24, 0]}>
          <boxGeometry args={[0.78, 0.07, 0.3]} />
          <meshStandardMaterial color="#2d343a" metalness={0.78} roughness={0.24} />
        </mesh>

        <mesh castShadow position={[-0.18, 0.28, 1.02]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.07, 0.4, 0.26]} />
          <meshStandardMaterial color="#20262b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh castShadow position={[0.18, 0.28, 1.02]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.07, 0.4, 0.26]} />
          <meshStandardMaterial color="#20262b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Engine housings */}
        <mesh castShadow position={[-0.27, -0.05, 1.02]}>
          <cylinderGeometry args={[0.12, 0.14, 0.48, 12]} />
          <meshStandardMaterial color="#1f272c" metalness={0.84} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[0.27, -0.05, 1.02]}>
          <cylinderGeometry args={[0.12, 0.14, 0.48, 12]} />
          <meshStandardMaterial color="#1f272c" metalness={0.84} roughness={0.2} />
        </mesh>

        {/* Animated thruster glow cluster */}
        <group ref={thrusterGlow}>
          <mesh position={[-0.27, -0.05, 1.3]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#8ddfff" emissive="#38bdf8" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
          <mesh position={[0.27, -0.05, 1.3]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#8ddfff" emissive="#38bdf8" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.02, 1.18]}>
            <boxGeometry args={[0.08, 0.08, 0.34]} />
            <meshStandardMaterial color="#67e8f9" emissive="#38bdf8" emissiveIntensity={0.85} toneMapped={false} />
          </mesh>
        </group>

        {/* Side logo panels from provided image assets */}
        <mesh position={[-0.54, 0.02, -0.25]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.45, 0.2]} />
          <meshStandardMaterial map={logoTexture} transparent opacity={0.9} emissive="#00ff41" emissiveIntensity={0.24} />
        </mesh>
        <mesh position={[0.54, 0.02, -0.25]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.45, 0.2]} />
          <meshStandardMaterial map={logoTexture} transparent opacity={0.9} emissive="#00ff41" emissiveIntensity={0.24} />
        </mesh>
      </group>
    </RigidBody>
  );
}

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

function ProjectIsland({ active, unlocked, project, onFocus }: { active: boolean; unlocked: boolean; project: ProjectNode; onFocus: (projectId: string | null) => void }) {
  return (
    <RigidBody type="fixed" colliders={false} position={project.position}>
      <CuboidCollider args={[1.4, 1.1, 1.4]} />
      <CuboidCollider
        args={[2.8, 1.8, 2.8]}
        sensor
        onIntersectionEnter={() => onFocus(project.id)}
        onIntersectionExit={() => onFocus(null)}
      />

      {/* Submerged rocky base to sell "island in ocean" feeling. */}
      <mesh castShadow receiveShadow position={[0, -0.9, 0]}>
        <dodecahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial color="#262626" roughness={0.95} metalness={0.08} />
      </mesh>

      {/* Glass dome shell - hologram container */}
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <octahedronGeometry args={[2.6, 2]} />
        <meshStandardMaterial
          color="#00ff41"
          emissive={active ? "#00ff41" : "#1a3d2a"}
          emissiveIntensity={active ? 1.2 : 0.2}
          metalness={0.7}
          roughness={0.2}
          transparent
          opacity={0.18}
          wireframe={false}
        />
      </mesh>

      {/* Inner glow ring - animated */}
      <mesh castShadow position={[0, -0.42, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[2.2, 0.12, 8, 64]} />
        <meshStandardMaterial
          color="#39ff14"
          emissive="#00ff41"
          emissiveIntensity={1.4}
          metalness={0.9}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>

      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.15} position={[1.55, 0.15, -1.2]}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.82} metalness={0.12} />
        </mesh>
      </Float>

      <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.15} position={[-1.45, 0.08, 1.3]}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.86} metalness={0.1} />
        </mesh>
      </Float>

      {/* Core island platform */}
      <mesh castShadow receiveShadow position={[0, -0.3, 0]}>
        <cylinderGeometry args={[1.8, 2.1, 0.8, 8]} />
        <meshStandardMaterial
          color="#1a1a1a"
          emissive="#00ff41"
          emissiveIntensity={0.2}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Central structure - neon box */}
      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[1.2, 1.0, 1.2]} />
        <meshStandardMaterial
          color={project.accent}
          emissive={project.accent}
          emissiveIntensity={active ? 1.4 : 0.55}
          metalness={0.8}
          roughness={0.15}
          toneMapped={false}
        />
      </mesh>

      {/* Hologram edges - wireframe accent */}
      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[1.25, 1.05, 1.25]} />
        <meshStandardMaterial
          color="#00ff41"
          emissive="#00ff41"
          emissiveIntensity={0.9}
          metalness={0.9}
          roughness={0.2}
          wireframe={true}
        />
      </mesh>

      {/* Top hologram label */}
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.5} position={[0, 2.5, 0]}>
        <Text 
          maxWidth={4.6} 
          fontSize={0.42} 
          textAlign="center" 
          color="#00ff41" 
          anchorX="center" 
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#1a1a1a"
        >
          {project.title}
        </Text>
      </Float>

      {unlocked && (
        <Float speed={0.8} rotationIntensity={0.8} floatIntensity={0.3} position={[0, 3.7, 0]}>
          <Text 
            maxWidth={3.2} 
            fontSize={0.18} 
            textAlign="center" 
            color="#00ff41" 
            anchorX="center" 
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#1a1a1a"
          >
            DOSSIER READY
          </Text>
        </Float>
      )}
    </RigidBody>
  );
}

function Floor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[arenaHalf, 0.5, arenaHalf]} position={[0, -0.5, 0]} />

      {/* Keep a subtle tactical plate so ocean is visible instead of covered. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <planeGeometry args={[arenaHalf * 1.18, arenaHalf * 1.18, 1, 1]} />
        <meshStandardMaterial
          color="#1b2b36"
          roughness={0.95}
          metalness={0.08}
          transparent
          opacity={0.16}
        />
      </mesh>
    </RigidBody>
  );
}

function OceanSurface() {
  const waterRef = useRef<THREE.Mesh>(null);
  const foamRef = useRef<THREE.Mesh>(null);
  const basePositionsRef = useRef<Float32Array | null>(null);
  const normalUpdateTick = useRef(0);

  useEffect(() => {
    const mesh = waterRef.current;
    if (!mesh) {
      return;
    }

    const geometry = mesh.geometry as THREE.PlaneGeometry;
    const positions = geometry.attributes.position.array as Float32Array;
    basePositionsRef.current = positions.slice();
  }, []);

  useFrame((state) => {
    const mesh = waterRef.current;
    const foam = foamRef.current;
    const base = basePositionsRef.current;

    if (!mesh || !base) {
      return;
    }

    const t = state.clock.getElapsedTime();
    const geometry = mesh.geometry as THREE.PlaneGeometry;
    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      const waveA = Math.sin(x * 0.095 + t * 1.15) * 0.14;
      const waveB = Math.cos(z * 0.08 + t * 0.95) * 0.1;
      const waveC = Math.sin((x + z) * 0.045 + t * 1.35) * 0.06;
      positions[i + 1] = base[i + 1] + waveA + waveB + waveC;
    }

    geometry.attributes.position.needsUpdate = true;
    normalUpdateTick.current += 1;
    if (normalUpdateTick.current % 12 === 0) {
      geometry.computeVertexNormals();
    }

    if (foam) {
      foam.position.y = -0.08 + Math.sin(t * 0.7) * 0.02;
      const mat = foam.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.06 + (Math.sin(t * 1.6) + 1) * 0.03;
    }
  });

  return (
    <group>
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
        <planeGeometry args={[160, 160, 140, 140]} />
        <meshStandardMaterial
          color="#1a8cb5"
          roughness={0.45}
          metalness={0.06}
          emissive="#0d6a99"
          emissiveIntensity={0.28}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[11, 72, 128]} />
        <meshStandardMaterial
          color="#d4f5ff"
          roughness={0.2}
          metalness={0.2}
          emissive="#8fdfff"
          emissiveIntensity={0.06}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <ringGeometry args={[35, 84, 128]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]}>
        <ringGeometry args={[58, 78, 128]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.03} side={THREE.DoubleSide} />
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

        {/* Neon boundary glow bars */}
        <mesh position={[-arenaHalf, 1.8, 0]}>
          <boxGeometry args={[1.2, 3.6, arenaHalf * 2 + 0.8]} />
          <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.1} metalness={0.9} roughness={0.1} toneMapped={false} />
        </mesh>
        <mesh position={[arenaHalf, 1.8, 0]}>
          <boxGeometry args={[1.2, 3.6, arenaHalf * 2 + 0.8]} />
          <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.1} metalness={0.9} roughness={0.1} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.8, -arenaHalf]}>
          <boxGeometry args={[arenaHalf * 2 + 0.8, 3.6, 1.2]} />
          <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.1} metalness={0.9} roughness={0.1} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.8, arenaHalf]}>
          <boxGeometry args={[arenaHalf * 2 + 0.8, 3.6, 1.2]} />
          <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.1} metalness={0.9} roughness={0.1} toneMapped={false} />
        </mesh>
      </RigidBody>
    </>
  );
}

function GroundDetails() {
  return (
    <group>
      {/* Subtle circular tactical markers instead of black square grid. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[9, 10.6, 96]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[24, 24.5, 128]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      {/* Ambient backdrop */}
      <mesh position={[0, 10, -58]} rotation={[0, 0, 0]}>
        <planeGeometry args={[120, 24]} />
        <meshBasicMaterial 
          color="#7dd3fc" 
          transparent 
          opacity={0.06}
        />
      </mesh>

      {/* Corner accent lights */}
      <pointLight position={[-34, 3, -34]} color="#4fc3f7" intensity={0.9} distance={22} />
      <pointLight position={[34, 3, 34]} color="#81d4fa" intensity={0.9} distance={22} />
    </group>
  );
}