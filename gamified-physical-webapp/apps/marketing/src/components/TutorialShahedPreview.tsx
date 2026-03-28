import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import shahedAnimatedModelUrl from "../images/shahed_for_animation.glb?url";

function prepareShahedModel(source: THREE.Object3D) {
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
        mat.envMapIntensity = 0.24;
        mat.roughness = THREE.MathUtils.clamp(mat.roughness + 0.15, 0, 1);
        mat.metalness = THREE.MathUtils.clamp(mat.metalness - 0.08, 0, 1);
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
  root.scale.setScalar(2.4 / maxDim);

  const placedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= placedBounds.min.y;

  return root;
}

function SpinningShahedModel() {
  const gltf = useGLTF(shahedAnimatedModelUrl);
  const groupRef = useRef<THREE.Group>(null);
  const visual = useMemo(() => prepareShahedModel(gltf.scene), [gltf.scene]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    group.rotation.y = state.clock.elapsedTime * 0.9;
    group.position.y = 0.08 + Math.sin(state.clock.elapsedTime * 1.5) * 0.02;
  });

  return (
    <group ref={groupRef} position={[0, 0.08, 0]}>
      <primitive object={visual} rotation={[0, Math.PI / 2, 0]} />
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.75, 80]} />
        <meshBasicMaterial color="#ff3f3f" transparent opacity={0.42} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 64]} />
        <meshBasicMaterial color="#3d0b12" transparent opacity={0.36} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function TutorialShahedPreview() {
  return (
    <div className="tutorial-shahed-preview" aria-hidden="true">
      <Canvas camera={{ position: [0, 1.45, 3.2], fov: 30 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.42} color="#dde8f9" />
        <directionalLight position={[2.8, 4.2, 2.6]} intensity={0.78} color="#f6f8ff" />
        <pointLight position={[-2, 2.2, 1.2]} intensity={0.28} color="#9ec3ff" />
        <Suspense fallback={null}>
          <Environment files="/hdri/ticknock_02_1k.exr" background={false} />
          <SpinningShahedModel />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(shahedAnimatedModelUrl);
