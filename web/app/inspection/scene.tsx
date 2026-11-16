"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Color, Material, Mesh, Object3D, OrthographicCamera, PerspectiveCamera,
  PMREMGenerator, Quaternion, Vector3, MathUtils,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { useReducedPreference } from "../studio/use-reduced-preference";
import { vehiclePath, type CameraCommand, type CameraPose, type RenderStats, type View } from "./camera";

type SceneProps = {
  command:CameraCommand;
  pose:RefObject<CameraPose|null>;
  onProgress:(value:number|null)=>void;
  onFailure:(kind:"failed"|"lost")=>void;
  onReady:(stats:RenderStats)=>void;
};

const target = new Vector3(0,.54,0);
const initial = [6,3.1,7.4] as const;
const views: Record<View, { direction:[number,number,number]; height:number; width:number }> = {
  "Three-quarter": {direction:[.94,.43,1],height:3.28,width:5.85},
  Front: {direction:[0,0,1],height:2.35,width:3.5},
  Side: {direction:[1,0,0],height:2.5,width:6.75},
  Top: {direction:[0,1,.0001],height:6.55,width:3.5},
};
// Conservative envelope in model space, including the front/rear wings and slicks.
const corners=[-1.27,1.27].flatMap(x=>[0,1.55].flatMap(y=>[-2.88,2.94].map(z=>
  new Vector3(x,y,z).sub(target),
)));

function fitPerspective(direction:Vector3, slope:number, aspect:number) {
  const right=new Vector3(0,1,0).cross(direction).normalize();
  const up=direction.clone().cross(right);
  return Math.max(...corners.map(corner=>{
    const horizontal=Math.abs(corner.dot(right))/(slope*aspect);
    const vertical=Math.abs(corner.dot(up))/slope;
    return corner.dot(direction)+1.11*Math.max(horizontal,vertical);
  }));
}

function Rig({command, pose}:Pick<SceneProps,"command"|"pose">) {
  const { camera, gl, set, invalidate, size } = useThree();
  const [perspective] = useState(() => camera as PerspectiveCamera);
  const [orthographic] = useState(() => Object.assign(
    new OrthographicCamera(-1,1,1,-1,.1,80), {manual:true},
  ));
  const controls = useRef<OrbitControls>(null);
  const move = useRef<((now:number)=>void)|null>(null);
  const first = useRef(true);
  const reduced = useReducedPreference();

  useEffect(() => {
    const orbit = new OrbitControls(perspective,gl.domElement);
    orbit.target.copy(target);
    orbit.enablePan = false;
    orbit.enableDamping = true;
    orbit.dampingFactor = .17;
    orbit.minDistance = 3.2;
    orbit.maxDistance = 24;
    orbit.minZoom = .6;
    orbit.maxZoom = 2.2;
    orbit.maxPolarAngle = Math.PI*.495;
    const stop = () => { move.current = null; };
    const redraw = () => invalidate();
    orbit.addEventListener("change", redraw);
    orbit.addEventListener("start", stop);
    controls.current = orbit;
    return () => {
      orbit.removeEventListener("change",redraw);
      orbit.removeEventListener("start",stop);
      orbit.dispose();
      controls.current = null;
    };
  }, [gl,perspective,invalidate]);

  const lastCommand = useRef<CameraCommand>(null);
  useEffect(() => {
    if (!size.width || !size.height) return;
    orthographic.right=orthographic.top*size.width/size.height;
    orthographic.left=-orthographic.right;
    orthographic.updateProjectionMatrix();
    invalidate();
  },[orthographic,size.width,size.height,invalidate]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !size.width || !size.height) return;
    // Resize refits a preset without applying the same relative zoom twice.
    if ("zoom" in command && lastCommand.current === command) return;
    lastCommand.current = command;
    const aspect = size.width/size.height;
    if (first.current && pose.current) {
      const saved = pose.current;
      const restored = saved.orthographic ? orthographic : perspective;
      restored.position.fromArray(saved.position);
      if (restored instanceof OrthographicCamera) {
        restored.top = saved.halfHeight;
        restored.bottom = -saved.halfHeight;
        restored.right = saved.halfHeight * aspect;
        restored.left = -restored.right;
        restored.zoom = saved.zoom;
        restored.updateProjectionMatrix();
      }
      restored.lookAt(target);
      orbit.object = restored;
      set({camera:restored});
      first.current = false;
      invalidate();
      return;
    }
    const slope = Math.tan(MathUtils.degToRad(perspective.fov/2));
    const view = "view" in command ? command.view : undefined;
    const spec = view && views[view];
    const activeCamera = orbit.object as PerspectiveCamera | OrthographicCamera;
    const from = activeCamera.position.clone().sub(target);
    if (activeCamera instanceof OrthographicCamera && !view) {
      const start = activeCamera.zoom;
      const end = MathUtils.clamp(start * ("zoom" in command && command.zoom === 1 ? 1.2 : 1/1.2),.6,2.2);
      animate(t => {
        activeCamera.zoom=MathUtils.lerp(start,end,t);
        activeCamera.updateProjectionMatrix();
      });
      return;
    }
    if (activeCamera instanceof OrthographicCamera) {
      from.setLength((activeCamera.top-activeCamera.bottom)/(activeCamera.zoom*2*slope));
      orbit.object=perspective;
      set({camera:perspective});
    }
    const height = spec ? Math.max(spec.height,spec.width/aspect) : 0;
    const direction = spec ? new Vector3(...spec.direction).normalize() : from.clone().normalize();
    const distance = view==="Three-quarter" ? fitPerspective(direction,slope,aspect) : spec ? height/(2*slope) :
      MathUtils.clamp(from.length()*("zoom" in command && command.zoom===1 ? 1/1.2 : 1.2),3.2,24);
    const fromDirection = from.clone().normalize();
    const rotation = new Quaternion().setFromUnitVectors(fromDirection,direction);
    const identity = new Quaternion();
    const partial = new Quaternion();
    animate((t,finished) => {
      perspective.position.copy(fromDirection).applyQuaternion(partial.slerpQuaternions(identity,rotation,t))
        .multiplyScalar(MathUtils.lerp(from.length(),distance,t)).add(target);
      perspective.lookAt(target);
      if (finished && view && view!=="Three-quarter") {
        orthographic.left=-height*aspect/2;
        orthographic.right=height*aspect/2;
        orthographic.top=height/2;
        orthographic.bottom=-height/2;
        orthographic.zoom=1;
        orthographic.position.copy(perspective.position);
        orthographic.quaternion.copy(perspective.quaternion);
        orthographic.updateProjectionMatrix();
        orbit.object=orthographic;
        set({camera:orthographic});
      }
    });

    function animate(update:(t:number,finished:boolean)=>void) {
      const start=performance.now();
      const duration=first.current||reduced?0:440;
      first.current=false;
      move.current=now=>{
        const fraction=duration?Math.min((now-start)/duration,1):1;
        update(fraction*fraction*(3-2*fraction),fraction===1);
        if(fraction===1) move.current=null;
      };
      invalidate();
    }
  }, [command,size.width,size.height,reduced,perspective,orthographic,pose,set,invalidate]);

  useFrame(()=>{
    move.current?.(performance.now());
    if (move.current) invalidate();
    else controls.current?.update();
    const camera = controls.current?.object;
    if (camera) {
      const ortho = camera instanceof OrthographicCamera;
      pose.current = {position:camera.position.toArray(), orthographic:ortho, halfHeight:ortho ? camera.top : 0, zoom:ortho ? camera.zoom : 1};
    }
  });
  return null;
}

function Lighting() {
  const {gl,scene,invalidate}=useThree();
  useEffect(()=>{
    const studio=new RoomEnvironment();
    const pmrem=new PMREMGenerator(gl);
    const lighting=pmrem.fromScene(studio,.05);
    scene.environment=lighting.texture;
    scene.environmentIntensity=.68;
    studio.dispose();
    pmrem.dispose();
    invalidate();
    return ()=>{
      scene.environment=null;
      lighting.dispose();
    };
  },[gl,scene,invalidate]);
  return <>
    <hemisphereLight args={["#dfefff","#30353d",1.1]}/>
    <directionalLight position={[0,7,5]} color="#ecfbff" intensity={2.30}/>
    <directionalLight position={[-5,3,-4]} color="#9abec9" intensity={2.7}/>
    <directionalLight position={[4,2.5,-4]} color="#e5f3f2" intensity={1.45}/>
  </>;
}

function Floor() {
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.013,0]}>
    <planeGeometry args={[160,160]}/>
    <shaderMaterial uniforms={{surface:{value:new Color("#222b32")}, edge:{value:new Color("#151b20")}}}
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
        }`}/>
  </mesh>;
}

function disposeVehicle(object:Object3D) {
  const materials=new Set<Material>();
  object.traverse(part=>{
    if (!(part instanceof Mesh)) return;
    part.geometry.dispose();
    for (const material of Array.isArray(part.material)?part.material:[part.material]) materials.add(material);
  });
  materials.forEach(material=>material.dispose());
}

async function loadVehicle(signal:AbortSignal, progress:SceneProps["onProgress"]) {
  const url=vehiclePath+"car.glb";
  const response=await fetch(url,{signal});
  if (!response.ok) throw new Error("Vehicle download failed");
  const reader=response.body?.getReader();
  if (!reader) return new GLTFLoader().parseAsync(await response.arrayBuffer(),vehiclePath);
  const chunks:Uint8Array<ArrayBuffer>[]=[];
  let total=0, previous=-1;
  // GLB declares decoded file length, including when HTTP compression is in use.
  let length=response.headers.get("content-encoding") ? 0 : Number(response.headers.get("content-length"));
  while(true){
    const {done,value}=await reader.read();
    if(done) break;
    chunks.push(value);
    total+=value.byteLength;
    if (!length && chunks[0].byteLength>=12) {
      const header=new DataView(chunks[0].buffer,chunks[0].byteOffset,12);
      if (header.getUint32(0,true)===0x46546c67) length=header.getUint32(8,true);
    }
    if (length) {
      const percent=Math.min(99,Math.floor(total/length*100));
      if(percent!==previous){progress(percent);previous=percent;}
    }
  }
  return new GLTFLoader().parseAsync(await new Blob(chunks).arrayBuffer(),vehiclePath);
}

function Vehicle({onProgress,onFailure,onReady}:Omit<SceneProps,"command"|"pose">) {
  const {gl,invalidate}=useThree();
  const [model,setModel]=useState<Object3D>();
  const callbacks=useRef({onProgress,onFailure,onReady});
  callbacks.current={onProgress,onFailure,onReady};
  const ready=useRef(false);

  useEffect(()=>{
    const controller=new AbortController();
    let vehicle:Object3D|undefined;
    function onContextLost(event:Event) {
      event.preventDefault();
      callbacks.current.onFailure("lost");
    }
    gl.domElement.addEventListener("webglcontextlost",onContextLost);
    void loadVehicle(controller.signal,value=>callbacks.current.onProgress(value)).then(({scene})=>{
      if(controller.signal.aborted){disposeVehicle(scene);return;}
      vehicle=scene;
      setModel(scene);
      invalidate();
    }).catch(()=>{
      if(!controller.signal.aborted) callbacks.current.onFailure("failed");
    });
    return ()=>{
      gl.domElement.removeEventListener("webglcontextlost",onContextLost);
      controller.abort();
      if(vehicle) disposeVehicle(vehicle);
    };
  },[gl,invalidate]);

  useFrame(()=>{
    if(!model||ready.current) return;
    ready.current=true;
    // Read render counters after Fiber has submitted the first model frame.
    queueMicrotask(()=>{
      const {calls,triangles}=gl.info.render;
      callbacks.current.onReady({calls,triangles});
    });
  });
  return model ? <primitive object={model} dispose={null}/> : null;
}

export default function Scene({command,pose,...callbacks}:SceneProps) {
  const compact=typeof window!=="undefined"&&matchMedia("(max-width: 740px)").matches;
  return <div className="inspection-render" role="img" aria-label="Interactive illustrative AF–02 racing car">
    <Canvas frameloop="demand" dpr={[1,compact?1.25:1.5]}
      camera={{position:[...initial],fov:36,near:.1,far:140}}
      gl={{antialias:true,powerPreference:"low-power"}}>
      <color attach="background" args={["#151b20"]}/>
      <Lighting/>
      <Floor/>
      <Vehicle {...callbacks}/>
      <Rig command={command} pose={pose}/>
    </Canvas>
  </div>;
}
