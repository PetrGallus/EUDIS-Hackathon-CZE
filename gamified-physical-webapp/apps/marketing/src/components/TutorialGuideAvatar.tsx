import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import tutorRobotOneModelUrl from "../images/tutor_robot_1.glb?url";
import tutorRobotTwoModelUrl from "../images/tutor_robot_2.glb?url";

function prepareMiniModel(source: THREE.Object3D, targetSize: number) {
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
        mat.envMapIntensity = 0.52;
        mat.roughness = THREE.MathUtils.clamp(mat.roughness + 0.08, 0, 1);
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

  return root;
}

function GuideModel({ variant }: { variant: "one" | "two" }) {
  const gltfOne = useGLTF(tutorRobotOneModelUrl);
  const gltfTwo = useGLTF(tutorRobotTwoModelUrl);
  const source = variant === "two" ? gltfTwo.scene : gltfOne.scene;

  const visual = useMemo(() => prepareMiniModel(source, 1.6), [source]);

  return <primitive object={visual} rotation={[0, variant === "two" ? -Math.PI * 0.2 : Math.PI * 0.18, 0]} />;
}

export function TutorialGuideAvatar({
  variant = "one",
  compact = false,
}: {
  variant?: "one" | "two";
  compact?: boolean;
}) {
  return (
    <div className={`tutorial-guide-avatar ${compact ? "compact" : ""}`} aria-hidden="true">
      <Canvas camera={{ position: [0, 1.25, 2.65], fov: 26 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.45} color="#d8e7ff" />
        <directionalLight position={[2.5, 4.5, 3]} intensity={0.92} color="#f4fbff" />
        <pointLight position={[-2.5, 2.4, 1.5]} intensity={0.35} color="#8ec9ff" />
        <Suspense fallback={null}>
          <Environment files="/hdri/ticknock_02_1k.exr" background={false} />
          <group position={[0, -0.22, 0]}>
            <GuideModel variant={variant} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[0.8, 1.1, 40]} />
              <meshBasicMaterial color={variant === "two" ? "#80d7ff" : "#7cedc8"} transparent opacity={0.26} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(tutorRobotOneModelUrl);
useGLTF.preload(tutorRobotTwoModelUrl);
