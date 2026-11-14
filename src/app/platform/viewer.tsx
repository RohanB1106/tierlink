"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";

export interface AssemblyRow {
  product_id: string;
  assembly: string;
  part_number: string;
  qty_per: number;
  category: string;
  description: string;
}

export interface ViewerProps {
  products: { id: string; name: string }[];
  assemblies: AssemblyRow[];
  /** part_number -> products that use it */
  partProducts: Record<string, string[]>;
  /** near-duplicate part_number -> proposed standard part_number */
  candidateOf: Record<string, string>;
}

const CORE = "#7c3aed";
const MODULE = "#f59e0b";
const EXPLODE = 0.8;
type V3 = [number, number, number];

interface AssemblyInfo {
  name: string;
  parts: AssemblyRow[];
  shared: number;
  core: boolean;
  candidates: number;
}

// ------------------------------------------------------------------ geometry
// Simple solids per assembly, arranged as a drill, grinder or circular saw. Units are arbitrary (~cm).

function Body({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Mat({ color, active }: { color: string; active: boolean }) {
  return <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} emissive={active ? color : "#000000"} emissiveIntensity={active ? 0.35 : 0} />;
}

type Shape = (m: (key?: string) => ReactNode) => ReactNode;

const SHAPES: Record<string, Record<string, { at: V3; explode: V3; shape: Shape }>> = {
  drill: {
    "Housing Assy": {
      at: [0, 0, 0],
      explode: [0, 0, 0],
      shape: (m) => (
        <>
          <mesh position={[0.4, 3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.55, 1.55, 3.4, 40]} />
            {m()}
          </mesh>
          <mesh position={[-0.7, 0.4, 0]} rotation={[0, 0, -0.18]}>
            <boxGeometry args={[1.7, 4.6, 2.1]} />
            {m("h")}
          </mesh>
        </>
      ),
    },
    "Motor Assy": {
      at: [-2.4, 3, 0],
      explode: [-2.6, 0.6, 0],
      shape: (m) => (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.7, 1.6, 2.4, 40]} />
          {m()}
        </mesh>
      ),
    },
    "Gearbox Assy": {
      at: [2.9, 3, 0],
      explode: [0.6, 2.2, 0],
      shape: (m) => (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.25, 1.5, 1.8, 40]} />
          {m()}
        </mesh>
      ),
    },
    "Hammer Mech": {
      at: [2.9, 3, 0],
      explode: [0.6, 4.2, 0],
      shape: (m) => (
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.55, 0.28, 16, 48]} />
          {m()}
        </mesh>
      ),
    },
    "Chuck Assy": {
      at: [4.9, 3, 0],
      explode: [2.6, 0, 0],
      shape: (m) => (
        <>
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.55, 1.05, 1.9, 32]} />
            {m()}
          </mesh>
          <mesh position={[1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 1.2, 12]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
          </mesh>
        </>
      ),
    },
    "Electrical Assy": {
      at: [-1.1, -2.6, 0],
      explode: [0, -2.4, 0],
      shape: (m) => (
        <>
          <mesh>
            <boxGeometry args={[3.6, 1.4, 2.6]} />
            {m()}
          </mesh>
          <mesh position={[1.75, 3.9, 0]}>
            <boxGeometry args={[0.45, 0.9, 0.6]} />
            {m("t")}
          </mesh>
        </>
      ),
    },
  },
  grinder: {
    "Housing Assy": {
      at: [0, 0, 0],
      explode: [0, 0, 0],
      shape: (m) => (
        <mesh position={[-1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.25, 1.35, 5.2, 40]} />
          {m()}
        </mesh>
      ),
    },
    "Motor Assy": {
      at: [2.1, 0, 0],
      explode: [0, 2.4, 0],
      shape: (m) => (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.45, 1.45, 2.0, 40]} />
          {m()}
        </mesh>
      ),
    },
    "Gearbox Assy": {
      at: [4.3, 0.1, 0],
      explode: [2.2, 1.6, 0],
      shape: (m) => (
        <mesh>
          <boxGeometry args={[2.4, 2.1, 2.4]} />
          {m()}
        </mesh>
      ),
    },
    "Guard Assy": {
      at: [4.3, -1.6, 0],
      explode: [1.2, -2.6, 0],
      shape: (m) => (
        <>
          <mesh>
            <cylinderGeometry args={[3, 3, 0.18, 48, 1, false, Math.PI / 2, Math.PI]} />
            {m()}
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[2.7, 2.7, 0.2, 48]} />
            <meshStandardMaterial color="#6b7280" roughness={0.8} />
          </mesh>
        </>
      ),
    },
    "Electrical Assy": {
      at: [-5.3, -0.1, 0],
      explode: [-2.6, 0, 0],
      shape: (m) => (
        <mesh>
          <boxGeometry args={[2.4, 2.3, 2.9]} />
          {m()}
        </mesh>
      ),
    },
  },
  saw: {
    "Base & Housing": {
      at: [0, 0, 0],
      explode: [0, 0, 0],
      shape: (m) => (
        <>
          <mesh position={[0, -2.6, 0]}>
            <boxGeometry args={[9, 0.3, 6]} />
            {m()}
          </mesh>
          <mesh position={[0.4, 0.2, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.5, 3.5, 1.1, 48, 1, false, -Math.PI / 2, Math.PI]} />
            {m("g")}
          </mesh>
          <mesh position={[-2.6, 1.6, 1.2]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[1.1, 3.2, 1.1]} />
            {m("h")}
          </mesh>
        </>
      ),
    },
    "Blade Assy": {
      at: [0.4, -0.2, -0.5],
      explode: [0, 0, -3.2],
      shape: (m) => (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.2, 3.2, 0.12, 64]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}>
            <cylinderGeometry args={[0.7, 0.7, 0.2, 24]} />
            {m()}
          </mesh>
        </>
      ),
    },
    "Motor Assy": {
      at: [0.4, 0.2, 1.4],
      explode: [0, 0.6, 3.2],
      shape: (m) => (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.6, 1.6, 2.4, 40]} />
          {m()}
        </mesh>
      ),
    },
    "Electrical Assy": {
      at: [-3.7, 0.4, 1.2],
      explode: [-2.4, 1.2, 0],
      shape: (m) => (
        <mesh>
          <boxGeometry args={[1.8, 1.5, 2.2]} />
          {m()}
        </mesh>
      ),
    },
  },
};

const typeOf = (productId: string) => (productId.startsWith("AG") ? "grinder" : productId.startsWith("CS") ? "saw" : "drill");

function Piece({
  info,
  def,
  exploded,
  active,
  onSelect,
  onHover,
}: {
  info: AssemblyInfo;
  def: { at: V3; explode: V3; shape: Shape };
  exploded: boolean;
  active: boolean;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const target = def.at.map((v, i) => v + (exploded ? def.explode[i] * EXPLODE : 0));
    g.position.x += (target[0] - g.position.x) * 0.12;
    g.position.y += (target[1] - g.position.y) * 0.12;
    g.position.z += (target[2] - g.position.z) * 0.12;
  });
  const color = info.core ? CORE : MODULE;
  return (
    <group
      ref={ref}
      position={def.at}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(info.name);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(info.name);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <Body>{def.shape((k) => <Mat key={k ?? "m"} color={color} active={active} />)}</Body>
    </group>
  );
}

// ------------------------------------------------------------------ viewer

export function Viewer({ products, assemblies, partProducts, candidateOf }: ViewerProps) {
  const [product, setProduct] = useState(products.find((p) => p.id === "PD-20")?.id ?? products[0]?.id);
  const [exploded, setExploded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const infos = useMemo<AssemblyInfo[]>(() => {
    const byName = new Map<string, AssemblyRow[]>();
    for (const a of assemblies.filter((a) => a.product_id === product)) {
      byName.set(a.assembly, [...(byName.get(a.assembly) ?? []), a]);
    }
    return [...byName.entries()].map(([name, parts]) => {
      const shared = parts.filter((p) => (partProducts[p.part_number]?.length ?? 0) > 1).length;
      return { name, parts, shared, core: shared / parts.length >= 0.5, candidates: parts.filter((p) => candidateOf[p.part_number]).length };
    });
  }, [assemblies, product, partProducts, candidateOf]);

  const kind = typeOf(product);
  const shapes = SHAPES[kind];
  const current = infos.find((i) => i.name === selected) ?? null;
  const coreCount = infos.filter((i) => i.core).length;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-3 dark:border-neutral-800">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setProduct(p.id);
              setSelected(null);
            }}
            aria-pressed={p.id === product}
            className={`rounded-md px-3 py-1.5 text-sm ${
              p.id === product
                ? "bg-violet-600 text-white"
                : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
            title={p.name}
          >
            {p.id}
          </button>
        ))}
        <button
          onClick={() => setExploded((x) => !x)}
          aria-pressed={exploded}
          className="ml-auto rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {exploded ? "Assemble" : "Explode view"}
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_300px]">
        <div className="relative h-[360px] bg-gradient-to-b from-neutral-50 to-neutral-100 sm:h-[460px] dark:from-neutral-900 dark:to-neutral-950">
          <Canvas
            key={kind}
            camera={{ position: [12, 7, 18], fov: 34 }}
            dpr={[1, 2]}
            onPointerMissed={() => setSelected(null)}
            onPointerDown={() => setAutoRotate(false)}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[6, 10, 8]} intensity={1.4} />
            <directionalLight position={[-8, 4, -6]} intensity={0.5} />
            <group position={[0, kind === "drill" ? -0.6 : 0.4, 0]}>
              {infos.map((info) =>
                shapes[info.name] ? (
                  <Piece
                    key={`${product}-${info.name}`}
                    info={info}
                    def={shapes[info.name]}
                    exploded={exploded}
                    active={selected === info.name || hovered === info.name}
                    onSelect={setSelected}
                    onHover={setHovered}
                  />
                ) : null,
              )}
            </group>
            <OrbitControls makeDefault enableDamping autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={10} maxDistance={40} />
          </Canvas>
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md bg-white/80 px-2 py-1 text-xs backdrop-blur dark:bg-black/60">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: CORE }} /> Shared core
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: MODULE }} /> Product module
            </span>
          </div>
        </div>

        <aside className="max-h-[460px] overflow-y-auto border-t border-neutral-200 p-4 text-sm md:border-l md:border-t-0 dark:border-neutral-800">
          <div className="font-medium">{products.find((p) => p.id === product)?.name}</div>
          <div className="text-neutral-500">
            {coreCount} of {infos.length} assemblies are mostly shared parts
          </div>
          {current ? (
            <div className="mt-4">
              <button onClick={() => setSelected(null)} className="text-xs text-neutral-500 hover:underline">
                ← all assemblies
              </button>
              <div className="mt-1 flex items-center gap-2 font-medium">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: current.core ? CORE : MODULE }} />
                {current.name}
              </div>
              <div className="text-xs text-neutral-500">
                {current.shared} of {current.parts.length} parts shared with other products
              </div>
              <ul className="mt-3 space-y-2">
                {current.parts.map((p) => {
                  const others = (partProducts[p.part_number] ?? []).filter((x) => x !== product);
                  return (
                    <li key={p.part_number}>
                      <a href={`/parts/${p.part_number}`} className="font-mono text-violet-700 hover:underline dark:text-violet-300">
                        {p.part_number}
                      </a>
                      <span className="text-neutral-500"> ×{p.qty_per}</span>
                      <div className="text-xs text-neutral-500">
                        {others.length ? `also in ${others.join(", ")}` : "unique to this product"}
                      </div>
                      {candidateOf[p.part_number] && (
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          near-duplicate → standardize to {candidateOf[p.part_number]}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ul className="mt-4 space-y-1">
              {infos.map((i) => (
                <li key={i.name}>
                  <button
                    onClick={() => setSelected(i.name)}
                    onMouseEnter={() => setHovered(i.name)}
                    onMouseLeave={() => setHovered(null)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-sm" style={{ background: i.core ? CORE : MODULE }} />
                      {i.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {i.shared}/{i.parts.length} shared
                      {i.candidates > 0 && <span className="ml-1 text-amber-700 dark:text-amber-400">· {i.candidates} dup</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
