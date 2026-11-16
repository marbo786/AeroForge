import { mkdir, writeFile } from "node:fs/promises";
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The texture-free exporter only uses FileReader for in-memory Blob conversion.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

const scene = new T.Scene();
const mobile = process.argv.includes("--mobile");
const segments = (count) => (mobile ? Math.round(count * 0.62) : count);
const sphere = (width, height) => new T.SphereGeometry(1, segments(width), segments(height));
const torus = (radius, tube, radial, tubular) =>
  new T.TorusGeometry(radius, tube, segments(radial), segments(tubular));
const paint = (name, color, metalness, roughness) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness });
const titanium = paint("Titanium satin", 0x75848a, 0.66, 0.28);
const silver = paint("Pale alloy lacquer", 0x9baaad, 0.48, 0.27);
const carbon = paint("Dark carbon laminate", 0x171d23, 0.26, 0.34);
const rubber = paint("Slick rubber", 0x20252a, 0.01, 0.81);
const teal = paint("Petrol anodized paint", 0x197d82, 0.5, 0.29);
const stripe = paint("Turquoise livery", 0x52d6cf, 0.4, 0.32);
const hardware = paint("Machined fasteners", 0xc4b7a2, 0.62, 0.32);

const buckets = new Map();
function add(assembly, material, geometry, x = 0, y = 0, z = 0) {
  geometry.translate(x, y, z);
  for (const key of Object.keys(geometry.attributes)) {
    if (key !== "position" && key !== "normal") geometry.deleteAttribute(key);
  }
  if (!geometry.index)
    geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
  const key = assembly + "/" + material.name;
  if (!buckets.has(key)) buckets.set(key, { assembly, material, geometries: [] });
  buckets.get(key).geometries.push(geometry);
}

// Each ring is [z, center x, center y, half width, half height]. Interpolating
// rings gives softened shoulders while preserving the narrow nose and tail.
function loft(rings, resolution = 32, power = 0.75) {
  const slices = segments(resolution);
  const positions = [],
    indices = [];
  const points = rings.map(([z, , , w, h]) => new T.Vector3(z, w, h));
  const profile = new T.CatmullRomCurve3(points, false, "centripetal");
  const centers = new T.CatmullRomCurve3(rings.map(([z, x, y]) => new T.Vector3(z, x, y)));
  const steps = Math.max(8, (rings.length - 1) * (mobile ? 2 : 4));
  for (let row = 0; row <= steps; row++) {
    const { x: z, y: w, z: h } = profile.getPoint(row / steps);
    const { y: x, z: y } = centers.getPoint(row / steps);
    for (let i = 0; i < slices; i++) {
      const theta = (i / slices) * Math.PI * 2;
      const c = Math.cos(theta),
        s = Math.sin(theta);
      positions.push(
        x + Math.sign(c) * Math.abs(c) ** power * Math.max(0.002, w),
        y + Math.sign(s) * Math.abs(s) ** power * Math.max(0.002, h),
        z,
      );
      if (row < steps) {
        const a = row * slices + i,
          b = row * slices + ((i + 1) % slices);
        indices.push(a, b, a + slices, b, b + slices, a + slices);
      }
    }
  }
  for (let i = 1; i < slices - 1; i++) {
    indices.push(0, i + 1, i, steps * slices, steps * slices + i, steps * slices + i + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function plate(assembly, material, points, depth) {
  const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
  add(
    assembly,
    material,
    new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: mobile ? 1 : 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.012,
    }),
  );
}
function arm(assembly, material, start, end, radius, flatten = 1) {
  const a = new T.Vector3(...start),
    b = new T.Vector3(...end);
  const delta = b.clone().sub(a),
    center = a.clone().add(b).multiplyScalar(0.5);
  const geometry = new T.CylinderGeometry(radius, radius, delta.length(), segments(8));
  geometry.scale(1, 1, flatten);
  geometry.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()),
  );
  add(assembly, material, geometry, center.x, center.y, center.z);
}
function tube(assembly, material, points, radius) {
  const path = new T.CatmullRomCurve3(points.map((point) => new T.Vector3(...point)));
  add(assembly, material, new T.TubeGeometry(path, segments(28), radius, segments(8)));
}
function blade(assembly, material, span, y, z, chord, thickness, sweep = 0.14) {
  const rings = [-1, -0.92, -0.58, 0, 0.58, 0.92, 1].map((s) => [
    (s * span) / 2,
    sweep * s * s,
    y + 0.12 * s * s,
    (chord * (0.94 + 0.06 * (1 - s * s))) / 2,
    thickness / 2,
  ]);
  add(assembly, material, loft(rings, 20, 0.72).rotateY(Math.PI / 2), 0, 0, z);
}

// Tapered monocoque, layered floor, raised nose and engine cover.
add(
  "Chassis",
  silver,
  loft([
    [-2.72, 0, 0.58, 0.09, 0.09],
    [-2.35, 0, 0.65, 0.29, 0.24],
    [-1.68, 0, 0.68, 0.4, 0.32],
    [-0.96, 0, 0.73, 0.41, 0.36],
    [-0.48, 0, 0.68, 0.39, 0.26],
    [0.12, 0, 0.66, 0.42, 0.27],
    [0.71, 0, 0.61, 0.32, 0.22],
    [1.33, 0, 0.52, 0.24, 0.16],
    [1.94, 0, 0.46, 0.19, 0.12],
    [2.45, 0, 0.41, 0.115, 0.085],
    [2.65, 0, 0.38, 0.055, 0.05],
  ]),
);
add(
  "Chassis",
  carbon,
  loft(
    [
      [-2.73, 0, 0.2, 0.41, 0.04],
      [-2.15, 0, 0.22, 0.69, 0.045],
      [-1.65, 0, 0.18, 0.91, 0.05],
      [-0.52, 0, 0.145, 1.02, 0.045],
      [0.72, 0, 0.17, 0.76, 0.05],
      [1.32, 0, 0.23, 0.36, 0.055],
    ],
    24,
    0.22,
  ),
);
add(
  "Engine cover",
  teal,
  loft([
    [-2.65, 0, 0.84, 0.07, 0.05],
    [-2.04, 0, 0.94, 0.14, 0.11],
    [-1.55, 0, 1.06, 0.16, 0.17],
    [-1.05, 0, 1.23, 0.16, 0.24],
    [-0.72, 0, 1.27, 0.19, 0.25],
    [-0.53, 0, 1.23, 0.16, 0.18],
  ]),
);
add("Engine cover", carbon, sphere(24, 12).scale(0.135, 0.085, 0.04), 0, 1.37, -0.48);

for (const side of [-1, 1]) {
  add(
    "Sidepods",
    teal,
    loft(
      [
        [-2.06, side * 0.33, 0.53, 0.11, 0.1],
        [-1.68, side * 0.46, 0.58, 0.22, 0.14],
        [-1.13, side * 0.6, 0.62, 0.3, 0.19],
        [-0.56, side * 0.59, 0.66, 0.33, 0.21],
        [-0.02, side * 0.57, 0.69, 0.31, 0.19],
        [0.3, side * 0.52, 0.72, 0.24, 0.13],
      ],
      28,
      0.56,
    ),
  );
  add("Sidepods", carbon, sphere(24, 12).scale(0.225, 0.103, 0.07), side * 0.54, 0.737, 0.314);
  tube(
    "Livery",
    stripe,
    [
      [side * 0.45, 0.84, 0.32],
      [side * 0.69, 0.879, -0.1],
      [side * 0.79, 0.825, -0.53],
      [side * 0.7, 0.774, -0.98],
      [side * 0.52, 0.702, -1.53],
      [side * 0.39, 0.64, -1.93],
    ],
    0.014,
  );
  tube(
    "Livery",
    stripe,
    [
      [side * 0.18, 0.512, 2.37],
      [side * 0.2, 0.578, 1.77],
      [side * 0.23, 0.656, 1.2],
      [side * 0.26, 0.751, 0.7],
      [side * 0.35, 0.797, 0.36],
    ],
    0.012,
  );
  for (let i = 0; i < 5; i++) {
    const z = -0.43 - i * 0.12;
    arm(
      "Sidepod louvers",
      carbon,
      [side * 0.61, 0.842, z],
      [side * 0.74, 0.823, z - 0.06],
      0.012,
      0.55,
    );
  }
}

// Cockpit opening, inset seat and three-point halo.
add("Cockpit", carbon, sphere(32, 16).scale(0.285, 0.075, 0.46), 0, 0.919, -0.11);
add("Cockpit", titanium, sphere(24, 12).scale(0.17, 0.12, 0.15), 0, 0.945, -0.28);
add("Cockpit", carbon, torus(0.115, 0.018, 8, 24).rotateX(0.24), 0, 0.999, 0.2);
for (const side of [-1, 1]) {
  tube(
    "Halo",
    carbon,
    [
      [side * 0.16, 0.98, -0.62],
      [side * 0.275, 1.125, -0.35],
      [side * 0.25, 1.185, -0.06],
      [side * 0.156, 1.195, 0.255],
      [0, 1.17, 0.39],
    ],
    0.036,
  );
  arm("Mirrors", carbon, [side * 0.29, 0.88, 0.36], [side * 0.49, 1.02, 0.41], 0.026);
  add("Mirrors", silver, sphere(16, 10).scale(0.11, 0.045, 0.052), side * 0.52, 1.02, 0.41);
}
arm("Halo", carbon, [0, 0.94, 0.26], [0, 1.16, 0.405], 0.037);

// Keep front wing pieces grouped for the next phase's selection workflow.
blade("Front wing", carbon, 2.31, 0.195, 2.57, 0.62, 0.091);
blade("Front wing", silver, 2.26, 0.275, 2.37, 0.37, 0.067);
blade("Front wing", teal, 2.23, 0.335, 2.2, 0.24, 0.055);
blade("Front wing", stripe, 2.24, 0.302, 2.21, 0.033, 0.023);
for (const side of [-1, 1]) {
  plate(
    "Front wing",
    carbon,
    [
      [1.09, 0.22],
      [1.15, 0.21],
      [1.22, 0.33],
      [1.2, 0.51],
      [1.14, 0.55],
      [1.12, 0.37],
    ].map(([x, y]) => [x * side, y]),
    0.4,
  );
  // Move the just-added endplate forwards without affecting its active material group.
  buckets
    .get("Front wing/" + carbon.name)
    .geometries.at(-1)
    .translate(0, 0, 2.28);
  arm("Front wing", carbon, [side * 0.125, 0.22, 2.53], [side * 0.112, 0.45, 2.27], 0.046, 0.72);
}
blade("Rear wing", carbon, 1.83, 1.17, -2.45, 0.36, 0.07, -0.035);
blade("Rear wing", silver, 1.85, 1.36, -2.59, 0.3, 0.08, -0.035);
blade("Rear wing", stripe, 1.84, 1.405, -2.67, 0.046, 0.018, -0.035);
for (const side of [-1, 1]) {
  plate(
    "Rear wing",
    carbon,
    [
      [0.89, 0.91],
      [0.925, 0.925],
      [0.962, 1.39],
      [0.887, 1.46],
    ].map(([x, y]) => [x * side, y]),
    0.39,
  );
  buckets
    .get("Rear wing/" + carbon.name)
    .geometries.at(-1)
    .translate(0, 0, -2.8);
  arm("Rear wing", carbon, [side * 0.15, 0.52, -2.36], [side * 0.17, 1.16, -2.48], 0.045, 0.78);
}

function tire(assembly, x, y, z, radius, width) {
  const profile = [
    [0.64, -0.48],
    [0.76, -0.5],
    [0.89, -0.5],
    [0.965, -0.42],
    [0.994, -0.31],
    [1, -0.19],
    [1, 0.19],
    [0.994, 0.31],
    [0.965, 0.42],
    [0.89, 0.5],
    [0.76, 0.5],
    [0.64, 0.48],
    [0.64, -0.48],
  ].map(([r, w]) => new T.Vector2(r * radius, w * width));
  add(assembly, rubber, new T.LatheGeometry(profile, segments(52)).rotateZ(-Math.PI / 2), x, y, z);
  const side = Math.sign(x),
    face = x + side * width * 0.492;
  const cylinder = (r, d) => new T.CylinderGeometry(r, r, d, segments(42)).rotateZ(Math.PI / 2);
  add(assembly, carbon, cylinder(radius * 0.69, width * 0.92), x, y, z);
  add(assembly, titanium, torus(radius * 0.58, 0.014, 8, 42).rotateY(Math.PI / 2), face, y, z);
  add(assembly, titanium, cylinder(radius * 0.17, 0.045), face, y, z);
  add(assembly, hardware, cylinder(radius * 0.084, 0.058), face + side * 0.012, y, z);
  add(assembly, hardware, torus(radius * 0.819, 0.008, 6, 42).rotateY(Math.PI / 2), face, y, z);
  for (let n = 0; n < 8; n++) {
    const theta = (n * Math.PI) / 4,
      ay = Math.sin(theta) * radius,
      az = Math.cos(theta) * radius;
    arm(
      assembly,
      titanium,
      [face, y + ay * 0.1, z + az * 0.1],
      [face - side * 0.016, y + ay * 0.55, z + az * 0.55],
      0.019,
      0.65,
    );
  }
}
for (const side of [-1, 1]) {
  for (const [z, r, x, w] of [
    [1.65, 0.435, 1.001, 0.365],
    [-1.8, 0.475, 1.012, 0.445],
  ]) {
    tire(z > 0 ? "Front wheels" : "Rear wheels", side * x, r, z, r, w);
    const knuckle = side * (x - w * 0.36);
    for (const [offset, y] of [
      [-0.33, 0.55],
      [0.28, 0.61],
      [-0.3, 0.32],
      [0.31, 0.36],
    ]) {
      arm(
        "Suspension",
        carbon,
        [side * (z > 0 ? 0.26 : 0.39), y, z + offset],
        [knuckle, r, z],
        0.031,
        0.56,
      );
    }
    arm("Suspension", titanium, [side * 0.27, 0.69, z - 0.08], [knuckle, r + 0.04, z], 0.016);
  }
}
add("Tail", hardware, torus(0.06, 0.015, 8, 20), 0, 0.74, -2.713);
add("Tail", carbon, new T.BoxGeometry(0.33, 0.105, 0.08), 0, 0.3, -2.67);
for (const x of [-0.3, -0.18, 0.18, 0.3]) {
  arm("Tail diffuser", carbon, [x, 0.17, -2.27], [x, 0.25, -2.73], 0.021, 1.2);
}

const groups = new Map();
let triangles = 0;
for (const { assembly, material, geometries } of buckets.values()) {
  if (!groups.has(assembly)) {
    const group = new T.Group();
    group.name = assembly;
    scene.add(group);
    groups.set(assembly, group);
  }
  const geometry = mergeGeometries(geometries);
  triangles += geometry.index.count / 3;
  groups.get(assembly).add(new T.Mesh(geometry, material));
}
const anchor = new T.Object3D();
anchor.name = "Front wing inspection anchor";
anchor.position.set(0, 0.28, 2.43);
scene.add(anchor);
scene.userData = {
  design: "AeroForge AF-02",
  scope: "Original illustrative Formula-style inspection asset",
};
const folder = new URL(
  `../public/vehicle/${mobile ? "af02-mobile-v1" : "af02-v1"}/`,
  import.meta.url,
);
await mkdir(folder, { recursive: true });
const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
await writeFile(new URL("car.glb", folder), Buffer.from(glb));
console.log(JSON.stringify({ bytes: glb.byteLength, triangles, drawCalls: buckets.size }));
