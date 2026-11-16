import { mkdir, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The texture-free exporter only uses FileReader for in-memory Blob conversion.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

const scene = new T.Scene();
const paint = (name, color, metalness, roughness) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness });
const titanium = paint('Titanium satin', 0x75848a, .66, .28);
const silver = paint('Pale alloy lacquer', 0x9baaad, .48, .27);
const carbon = paint('Dark carbon laminate', 0x171d23, .26, .34);
const rubber = paint('Slick rubber', 0x20252a, .01, .81);
const teal = paint('Petrol anodized paint', 0x197d82, .5, .29);
const stripe = paint('Turquoise livery', 0x52d6cf, .4, .32);
const hardware = paint('Machined fasteners', 0xc4b7a2, .62, .32);

const buckets = new Map();
function add(assembly, material, geometry, x = 0, y = 0, z = 0) {
  geometry.translate(x, y, z);
  for (const key of Object.keys(geometry.attributes)) {
    if (key !== 'position' && key !== 'normal') geometry.deleteAttribute(key);
  }
  if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
  const key = assembly + '/' + material.name;
  if (!buckets.has(key)) buckets.set(key, { assembly, material, geometries: [] });
  buckets.get(key).geometries.push(geometry);
}

// Each ring is [z, center x, center y, half width, half height]. Interpolating
// rings gives softened shoulders while preserving the narrow nose and tail.
function loft(rings, slices = 32, power = .75) {
  const positions = [], indices = [];
  const points = rings.map(([z, , , w, h]) => new T.Vector3(z, w, h));
  const profile = new T.CatmullRomCurve3(points, false, 'centripetal');
  const centers = new T.CatmullRomCurve3(rings.map(([z,x,y]) => new T.Vector3(z,x,y)));
  const steps = Math.max(8, (rings.length - 1) * 4);
  for (let row = 0; row <= steps; row++) {
    const { x:z, y:w, z:h } = profile.getPoint(row / steps);
    const { y:x, z:y } = centers.getPoint(row / steps);
    for (let i = 0; i < slices; i++) {
      const theta = i / slices * Math.PI * 2;
      const c = Math.cos(theta), s = Math.sin(theta);
      positions.push(x + Math.sign(c) * Math.abs(c) ** power * Math.max(.002,w),
        y + Math.sign(s) * Math.abs(s) ** power * Math.max(.002,h), z);
      if (row < steps) {
        const a = row * slices + i, b = row * slices + (i + 1) % slices;
        indices.push(a, b, a + slices, b, b + slices, a + slices);
      }
    }
  }
  for (let i=1;i<slices-1;i++) {
    indices.push(0,i+1,i,steps*slices,steps*slices+i,steps*slices+i+1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function plate(assembly, material, points, depth) {
  const shape = new T.Shape(points.map(([x,y]) => new T.Vector2(x,y)));
  add(assembly, material, new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled:true, bevelSegments:2, steps:1, bevelSize:.015, bevelThickness:.012,
  }));
}
function arm(assembly, material, start, end, radius, flatten = 1) {
  const a = new T.Vector3(...start), b = new T.Vector3(...end);
  const delta = b.clone().sub(a), center = a.clone().add(b).multiplyScalar(.5);
  const geometry = new T.CylinderGeometry(radius, radius, delta.length(), 8);
  geometry.scale(1,1,flatten);
  geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0), delta.normalize()));
  add(assembly, material, geometry, center.x, center.y, center.z);
}
function tube(assembly, material, points, radius) {
  const path = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  add(assembly, material, new T.TubeGeometry(path, 28, radius, 8));
}
function blade(assembly, material, span, y, z, chord, thickness, sweep = .14) {
  const rings = [-1,-.92,-.58,0,.58,.92,1].map((s) =>
    [s*span/2, sweep*s*s, y+.12*s*s, chord*(.94+.06*(1-s*s))/2, thickness/2]);
  add(assembly, material, loft(rings, 20, .72).rotateY(Math.PI/2), 0, 0, z);
}

// Tapered monocoque, layered floor, raised nose and engine cover.
add('Chassis', silver, loft([
  [-2.72,0,.58,.09,.09],[-2.35,0,.65,.29,.24],[-1.68,0,.68,.40,.32],
  [-.96,0,.73,.41,.36],[-.48,0,.68,.39,.26],[.12,0,.66,.42,.27],
  [.71,0,.61,.32,.22],[1.33,0,.52,.24,.16],[1.94,0,.46,.19,.12],
  [2.45,0,.41,.115,.085],[2.65,0,.38,.055,.05],
]));
add('Chassis', carbon, loft([
  [-2.73,0,.20,.41,.04],[-2.15,0,.22,.69,.045],[-1.65,0,.18,.91,.05],
  [-.52,0,.145,1.02,.045],[.72,0,.17,.76,.05],[1.32,0,.23,.36,.055],
], 24, .22));
add('Engine cover', teal, loft([
  [-2.65,0,.84,.07,.05],[-2.04,0,.94,.14,.11],[-1.55,0,1.06,.16,.17],
  [-1.05,0,1.23,.16,.24],[-.72,0,1.27,.19,.25],[-.53,0,1.23,.16,.18],
]));
add('Engine cover', carbon, new T.SphereGeometry(1,24,12).scale(.135,.085,.04),0,1.37,-.48);

for (const side of [-1,1]) {
  add('Sidepods', teal, loft([
    [-2.06,side*.33,.53,.11,.10],[-1.68,side*.46,.58,.22,.14],
    [-1.13,side*.60,.62,.30,.19],[-.56,side*.59,.66,.33,.21],
    [-.02,side*.57,.69,.31,.19],[.30,side*.52,.72,.24,.13],
  ], 28, .56));
  add('Sidepods', carbon, new T.SphereGeometry(1,24,12).scale(.225,.103,.07),side*.54,.737,.314);
  tube('Livery', stripe, [[side*.45,.84,.32],[side*.69,.879,-.10],[side*.79,.825,-.53],
    [side*.70,.774,-.98],[side*.52,.702,-1.53],[side*.39,.64,-1.93]], .014);
  tube('Livery', stripe, [[side*.18,.512,2.37],[side*.20,.578,1.77],[side*.23,.656,1.20],
    [side*.26,.751,.70],[side*.35,.797,.36]], .012);
  for(let i=0;i<5;i++) {
    const z=-.43-i*.12;
    arm('Sidepod louvers', carbon, [side*.61,.842,z], [side*.74,.823,z-.06], .012,.55);
  }
}

// Cockpit opening, inset seat and three-point halo.
add('Cockpit', carbon, new T.SphereGeometry(1,32,16).scale(.285,.075,.46),0,.919,-.11);
add('Cockpit', titanium, new T.SphereGeometry(1,24,12).scale(.17,.12,.15),0,.945,-.28);
add('Cockpit', carbon, new T.TorusGeometry(.115,.018,8,24).rotateX(.24),0,.999,.20);
for (const side of [-1,1]) {
  tube('Halo', carbon, [[side*.16,.98,-.62],[side*.275,1.125,-.35],
    [side*.25,1.185,-.06],[side*.156,1.195,.255],[0,1.17,.39]], .036);
  arm('Mirrors', carbon, [side*.29,.88,.36],[side*.49,1.02,.41], .026);
  add('Mirrors', silver, new T.SphereGeometry(1,16,10).scale(.11,.045,.052),side*.52,1.02,.41);
}
arm('Halo', carbon, [0,.94,.26],[0,1.16,.405],.037);

// Keep front wing pieces grouped for the next phase's selection workflow.
blade('Front wing', carbon, 2.31, .195, 2.57, .62, .091);
blade('Front wing', silver, 2.26, .275, 2.37, .37, .067);
blade('Front wing', teal, 2.23, .335, 2.20, .24, .055);
blade('Front wing', stripe, 2.24, .302, 2.210, .033, .023);
for (const side of [-1,1]) {
  plate('Front wing', carbon, [[1.09,.22],[1.15,.21],[1.22,.33],[1.20,.51],
    [1.14,.55],[1.12,.37]].map(([x,y])=>[x*side,y]), .40);
  // Move the just-added endplate forwards without affecting its active material group.
  buckets.get('Front wing/'+carbon.name).geometries.at(-1).translate(0,0,2.28);
  arm('Front wing', carbon, [side*.125,.22,2.53],[side*.112,.45,2.27],.046,.72);
}
blade('Rear wing', carbon, 1.83, 1.17, -2.45, .36, .07, -.035);
blade('Rear wing', silver, 1.85, 1.36, -2.59, .30, .08, -.035);
blade('Rear wing', stripe, 1.84, 1.405, -2.67, .046, .018, -.035);
for(const side of [-1,1]){
  plate('Rear wing', carbon, [[.89,.91],[.925,.925],[.962,1.39],[.887,1.46]]
    .map(([x,y])=>[x*side,y]),.39);
  buckets.get('Rear wing/'+carbon.name).geometries.at(-1).translate(0,0,-2.80);
  arm('Rear wing', carbon,[side*.15,.52,-2.36],[side*.17,1.16,-2.48],.045,.78);
}

function tire(assembly, x, y, z, radius, width) {
  const profile = [
    [.64,-.48],[.76,-.50],[.89,-.50],[.965,-.42],[.994,-.31],
    [1,-.19],[1,.19],[.994,.31],[.965,.42],[.89,.50],
    [.76,.50],[.64,.48],[.64,-.48],
  ].map(([r,w]) => new T.Vector2(r*radius,w*width));
  add(assembly, rubber, new T.LatheGeometry(profile, 52).rotateZ(-Math.PI/2), x,y,z);
  const side = Math.sign(x), face = x + side * width*.492;
  const cylinder = (r,d) => new T.CylinderGeometry(r,r,d,42).rotateZ(Math.PI/2);
  add(assembly, carbon, cylinder(radius*.69,width*.92),x,y,z);
  add(assembly, titanium, new T.TorusGeometry(radius*.58,.014,8,42).rotateY(Math.PI/2),face,y,z);
  add(assembly, titanium, cylinder(radius*.17,.045),face,y,z);
  add(assembly, hardware, cylinder(radius*.084,.058),face+side*.012,y,z);
  add(assembly, hardware, new T.TorusGeometry(radius*.819,.008,6,42).rotateY(Math.PI/2),face,y,z);
  for(let n=0;n<8;n++){
    const theta=n*Math.PI/4, ay=Math.sin(theta)*radius, az=Math.cos(theta)*radius;
    arm(assembly, titanium,[face,y+ay*.10,z+az*.10],[face-side*.016,y+ay*.55,z+az*.55],.019,.65);
  }
}
for(const side of [-1,1]){
  for(const [z,r,x,w] of [[1.65,.435,1.001,.365],[-1.80,.475,1.012,.445]]){
    tire(z>0?'Front wheels':'Rear wheels',side*x,r,z,r,w);
    const knuckle = side*(x-w*.36);
    for (const [offset,y] of [[-.33,.55],[.28,.61],[-.30,.32],[.31,.36]]) {
      arm('Suspension', carbon,[side*(z>0?.26:.39),y,z+offset],[knuckle,r,z],.031,.56);
    }
    arm('Suspension', titanium,[side*.27,.69,z-.08],[knuckle,r+.04,z],.016);
  }
}
add('Tail', hardware, new T.TorusGeometry(.060,.015,8,20),0,.74,-2.713);
add('Tail', carbon, new T.BoxGeometry(.33,.105,.08),0,.30,-2.67);
for(const x of [-.30,-.18,.18,.30]){
  arm('Tail diffuser', carbon,[x,.17,-2.27],[x,.25,-2.73],.021,1.2);
}

const groups = new Map();
let triangles = 0;
for(const { assembly, material, geometries } of buckets.values()){
  if(!groups.has(assembly)){
    const group = new T.Group();
    group.name = assembly;
    scene.add(group);
    groups.set(assembly,group);
  }
  const geometry = mergeGeometries(geometries);
  triangles += geometry.index.count / 3;
  groups.get(assembly).add(new T.Mesh(geometry,material));
}
const anchor = new T.Object3D();
anchor.name = 'Front wing inspection anchor';
anchor.position.set(0,.28,2.43);
scene.add(anchor);
scene.userData = { design:'AeroForge AF-02', scope:'Original illustrative Formula-style inspection asset' };
const folder = new URL('../public/vehicle/af02-v1/', import.meta.url);
await mkdir(folder,{recursive:true});
const glb = await new GLTFExporter().parseAsync(scene,{binary:true});
await writeFile(new URL('car.glb',folder),Buffer.from(glb));
console.log(JSON.stringify({bytes:glb.byteLength,triangles,drawCalls:buckets.size}));
