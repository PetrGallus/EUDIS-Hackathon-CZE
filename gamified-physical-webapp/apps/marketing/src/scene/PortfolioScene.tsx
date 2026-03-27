import { Environment, Float, KeyboardControls, PerspectiveCamera, Stars, Text, useGLTF, useKeyboardControls, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { projects, type ProjectNode } from "./projects";
import droneModelUrl from "../images/drone.glb?url";
import islandModelUrl from "../images/island.glb?url";
import waterCubeModelUrl from "../images/water_cube.glb?url";
import shahedModelUrl from "../images/shahed_13.glb?url";

type ControlName = "forward" | "backward" | "leftward" | "rightward" | "boost";

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

function setRepeatMap(texture: THREE.Texture, repeat = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
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
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.7);

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

  float shorelineFoam = 1.0 - smoothstep(1.8, 5.2, minIslandDist);
  float waveFoam = smoothstep(0.12, 0.23, abs(vWaveHeight));
  float sparkle = sin(vUv.x * 38.0 + uTime * 1.3) * sin(vUv.y * 34.0 - uTime * 1.2);
  sparkle = smoothstep(0.92, 1.0, sparkle) * 0.06;

  vec3 foamTint = vec3(0.76, 0.93, 1.0);
  vec3 finalColor = waterColor;
  finalColor += vec3(0.03, 0.08, 0.12) * fresnel;
  finalColor += foamTint * shorelineFoam * 0.18;
  finalColor += foamTint * waveFoam * 0.04;
  finalColor += vec3(0.08, 0.12, 0.16) * sparkle;

  float alpha = 0.61 + fresnel * 0.07 + shorelineFoam * 0.02;
  gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}
`;

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
      <color attach="background" args={["#040b14"]} />
      <fog attach="fog" args={["#0b1a28", 70, 220]} />
      <PerspectiveCamera makeDefault position={[0, 7, 12]} fov={42} />

      <ambientLight intensity={0.34} color="#c9dcf2" />
      <hemisphereLight intensity={0.28} color="#9fc8e7" groundColor="#0f2336" />
      <directionalLight
        castShadow
        position={[18, 22, 10]}
        intensity={1.35}
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
      <directionalLight position={[-24, 14, -18]} intensity={0.52} color="#8bb7d6" />

      {/* Rim/counter lights help the drone read clearly against bright water. */}
      <pointLight position={[-15, 9, -15]} intensity={0.28} color="#7aaed1" distance={30} />
      <pointLight position={[14, 7, -10]} intensity={0.24} color="#86a7c4" distance={26} />

      <Environment files="/hdri/ticknock_02_1k.exr" background={false} />
      <EnvironmentGrade />
      <Stars radius={140} depth={40} count={5500} factor={5} saturation={0} fade speed={0.35} />

      <OceanSurface />

      <Physics gravity={[0, 0, 0]}>
        <Floor />
        <BoundaryWalls />
        <Drone bodyRef={droneBody} headingRef={heading} paused={paused} />
        <TargetShahed />

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
      <DroneRimLight bodyRef={droneBody} />
      <GroundDetails />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.34} luminanceThreshold={0.56} luminanceSmoothing={0.72} mipmapBlur radius={0.42} />
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

function Drone({ bodyRef, headingRef, paused }: { bodyRef: MutableRefObject<RapierRigidBody>; headingRef: MutableRefObject<THREE.Vector3>; paused: boolean }) {
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
      position={[-16, 1.25, -16]}
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
useGLTF.preload(shahedModelUrl);
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

function ProjectIsland({ active, unlocked, project, onFocus }: { active: boolean; unlocked: boolean; project: ProjectNode; onFocus: (projectId: string | null) => void }) {
  const gltf = useGLTF(islandModelUrl);
  const islandVisual = useMemo(() => {
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
            mat.envMapIntensity = 0.6;
          }
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial) {
        obj.material.envMapIntensity = 0.6;
      }
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 4.6;
    root.scale.setScalar(targetSize / maxDim);

    const placedBounds = new THREE.Box3().setFromObject(root);
    root.position.y -= placedBounds.min.y - 0.06;

    return root;
  }, [gltf.scene]);

  return (
    <RigidBody type="fixed" colliders={false} position={project.position}>
      <CuboidCollider args={[1.4, 1.1, 1.4]} />
      <CuboidCollider
        args={[4.2, 2.4, 4.2]}
        sensor
        onIntersectionEnter={() => onFocus(project.id)}
        onIntersectionExit={() => onFocus(null)}
      />

      <primitive object={islandVisual} />

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

function TargetShahed() {
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
            mat.envMapIntensity = 0.5;
          }
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial) {
        obj.material.envMapIntensity = 0.5;
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
          TARGET
        </Text>
      </Float>
    </RigidBody>
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

function OceanSurface() {
  const waterRef = useRef<THREE.Mesh>(null);
  const waterNormal = useTexture('/textures/water_nor_1k.jpg');

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
          roughness={0.2}
          metalness={0.2}
          emissive="#90c8db"
          emissiveIntensity={0.02}
          transparent
          opacity={0.02}
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