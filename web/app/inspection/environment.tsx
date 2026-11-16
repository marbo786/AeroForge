import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Color, CompressedCubeTexture, HalfFloatType, LinearSRGBColorSpace } from "three";

const roomPath = "/vehicle/lighting-v1/room.rgba16f.gz";
const mipSizes = [64, 32, 16, 8, 4, 2];
const texelCount = 6 * mipSizes.reduce((total, size) => total + size ** 2, 0);

async function loadRoom(signal: AbortSignal) {
  const response = await fetch(roomPath, { signal });
  if (!response.ok || !response.body) throw new Error("Studio lighting unavailable.");
  const pixels = new Response(response.body.pipeThrough(new DecompressionStream("gzip")));
  const buffer = await pixels.arrayBuffer();
  if (buffer.byteLength !== texelCount * 8) throw new Error("Invalid studio lighting.");

  const view = new DataView(buffer);
  const values = new Uint16Array(buffer.byteLength / 2);
  for (let index = 0; index < values.length; ++index) {
    values[index] = view.getUint16(index * 2, true);
  }
  let offset = 0;
  const faces = Array.from({ length: 6 }, () => ({
    width: mipSizes[0],
    height: mipSizes[0],
    mipmaps: mipSizes.map((size) => {
      const end = offset + size ** 2 * 4;
      const mip = { data: values.subarray(offset, end), width: size, height: size };
      offset = end;
      return mip;
    }),
  }));
  // Three's cubemap mip loader also accepts uncompressed RGBA faces.
  const room = new CompressedCubeTexture(faces, undefined, HalfFloatType);
  room.colorSpace = LinearSRGBColorSpace;
  room.isPMREMTexture = true;
  room.needsUpdate = true;
  return room;
}

export function Lighting({ onSettled }: { onSettled: (settled: boolean) => void }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    const request = new AbortController();
    const deadline = window.setTimeout(() => request.abort(), 2500);
    let disposed = false;
    let lighting: CompressedCubeTexture | undefined;
    void loadRoom(request.signal)
      .then((room) => {
        if (request.signal.aborted) {
          room.dispose();
          return;
        }
        lighting = room;
        scene.environment = room;
        scene.environmentIntensity = 0.68;
        invalidate();
      })
      .catch(() => {
        // Direct lighting keeps the car usable if the reflection map cannot load.
      })
      .finally(() => {
        window.clearTimeout(deadline);
        if (!disposed) onSettled(true);
      });
    return () => {
      disposed = true;
      request.abort();
      window.clearTimeout(deadline);
      if (lighting) {
        scene.environment = null;
        lighting.dispose();
      }
    };
  }, [scene, invalidate, onSettled]);
  return (
    <>
      <hemisphereLight args={["#dfefff", "#30353d", 1.1]} />
      <directionalLight position={[0, 7, 5]} color="#ecfbff" intensity={2.3} />
      <directionalLight position={[-5, 3, -4]} color="#9abec9" intensity={2.7} />
      <directionalLight position={[4, 2.5, -4]} color="#e5f3f2" intensity={1.45} />
    </>
  );
}

export function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.013, 0]}>
      <planeGeometry args={[160, 160]} />
      <shaderMaterial
        uniforms={{
          surface: { value: new Color("#222b32") },
          edge: { value: new Color("#151b20") },
        }}
        vertexShader={`
        varying vec2 world;
        void main(){
          vec4 p = modelMatrix * vec4(position,1.0);
          world = p.xz;
          gl_Position = projectionMatrix * viewMatrix * p;
        }`}
        fragmentShader={`
        varying vec2 world;
        uniform vec3 surface;
        uniform vec3 edge;
        void main(){
          float radius = length(world * vec2(.84,.55));
          vec2 line = abs(fract(world * 2.0 - .5) - .5) / max(fwidth(world * 2.0),vec2(.0001));
          float footprint = max(fwidth(world.x),fwidth(world.y));
          float grid = (1.0 - min(min(line.x,line.y),1.0)) * (1.0 - smoothstep(3.0,9.0,radius));
          grid *= 1.0 - smoothstep(.055,.20,footprint);
          float shadow = exp(-dot(world * vec2(.76,.32),world * vec2(.76,.32))) * .74;
          for (int i=0;i<4;i++){
            vec2 wheel = vec2(i<2?-1.0:1.0,mod(float(i),2.0)<.5?1.65:-1.8);
            vec2 p = (world - wheel) * vec2(3.5,2.4);
            shadow = max(shadow,exp(-dot(p,p))*.78);
          }
          vec3 color = mix(surface,edge,smoothstep(1.0,9.0,radius)) * (1.0 - shadow);
          color += vec3(.013,.021,.025) * grid * (1.0 - shadow);
          gl_FragColor = vec4(color,1.0);
          #include <colorspace_fragment>
        }`}
      />
    </mesh>
  );
}
