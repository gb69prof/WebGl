import React, {useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useFrame} from '@react-three/fiber';
import {OrbitControls, Stars, Line, Html, useTexture} from '@react-three/drei';
import * as THREE from 'three';
import './style.css';

// Mission-profile keyframes based on public Artemis II timeline:
// launch Apr 1 2026 22:35 UTC, lunar flyby Apr 6 2026 ~23:00 UTC,
// max Earth distance ~406,770 km, splashdown Apr 11 2026 00:07 UTC.
// Coordinates below are scaled geocentric display coordinates, not raw Horizons vectors.
const KM_PER_UNIT = 30000;
const earthRadiusKm = 6371;
const moonRadiusKm = 1737;
const moonDistanceKm = 384400;
const moonOrbitR = moonDistanceKm / KM_PER_UNIT;
const earthR = earthRadiusKm / KM_PER_UNIT;
const moonR = moonRadiusKm / KM_PER_UNIT;

const keyFrames = [
  {t:0.00, label:'Launch / Earth orbit', pos:[earthR+0.28, 0.08, 0.00]},
  {t:0.10, label:'High Earth orbit checkout', pos:[2.0, 0.9, 0.25]},
  {t:0.18, label:'TLI burn', pos:[4.1, 1.1, 0.45]},
  {t:0.42, label:'Outbound transit', pos:[8.0, 2.1, 0.85]},
  {t:0.58, label:'Lunar sphere of influence', pos:[11.5, 1.4, 0.3]},
  {t:0.62, label:'Far-side lunar flyby', pos:[13.55, -0.55, -0.55]},
  {t:0.67, label:'Maximum Earth distance', pos:[13.35, -1.35, -0.28]},
  {t:0.78, label:'Return transit', pos:[9.0, -1.8, 0.20]},
  {t:0.91, label:'Re-entry corridor', pos:[3.8, -0.9, -0.20]},
  {t:1.00, label:'Splashdown', pos:[earthR+0.18, -0.05, 0.10]},
];

function catmullPoints(samples=360){
  const pts = keyFrames.map(k=>new THREE.Vector3(...k.pos));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.45);
  return curve.getPoints(samples);
}

function Earth(){
  const texture = useTexture('/textures/earth-map.jpeg');
  const ref = useRef();
  useFrame((_,delta)=>{ ref.current.rotation.y += delta * 0.05; });
  return <mesh ref={ref}>
    <sphereGeometry args={[earthR, 96, 64]} />
    <meshStandardMaterial map={texture} roughness={0.9} metalness={0.0} />
  </mesh>;
}

function Moon({time}){
  const angle = 0.4 + time * Math.PI * 0.10;
  const pos = [Math.cos(angle)*moonOrbitR, Math.sin(angle)*0.18, Math.sin(angle)*moonOrbitR*0.18];
  return <group position={pos}>
    <mesh>
      <sphereGeometry args={[moonR, 64, 32]} />
      <meshStandardMaterial color="#b8b4a8" roughness={1}/>
    </mesh>
    <Html distanceFactor={5}><div className="label">Moon</div></Html>
  </group>;
}

function Sun(){
  return <group position={[-18, 9, -12]}>
    <pointLight intensity={5} distance={80}/>
    <mesh>
      <sphereGeometry args={[1.0, 48, 24]} />
      <meshBasicMaterial color="#fff3a0" />
    </mesh>
    <Html distanceFactor={12}><div className="label sun">Sun</div></Html>
  </group>;
}

function Orion({time, setInfo}){
  const points = useMemo(()=>catmullPoints(480),[]);
  const i = Math.min(points.length-1, Math.floor(time*(points.length-1)));
  const pos = points[i];
  const nearest = keyFrames.reduce((a,b)=>Math.abs(b.t-time)<Math.abs(a.t-time)?b:a,keyFrames[0]);
  useFrame(()=>setInfo(nearest.label));
  return <group position={pos}>
    <mesh>
      <coneGeometry args={[0.08,0.18,24]} />
      <meshStandardMaterial color="#ffdf7e" emissive="#462000" emissiveIntensity={0.35}/>
    </mesh>
    <pointLight intensity={0.8} distance={2}/>
    <Html distanceFactor={4}><div className="orion">Orion</div></Html>
  </group>;
}

function Trajectory(){
  const pts = useMemo(()=>catmullPoints(480),[]);
  return <>
    <Line points={pts} color="#ff3b30" lineWidth={3} transparent opacity={0.95}/>
    {keyFrames.map((k,idx)=><group key={idx} position={k.pos}>
      <mesh><sphereGeometry args={[0.045,16,8]}/><meshBasicMaterial color="#ffffff"/></mesh>
    </group>)}
  </>;
}

function Scene({time,setInfo}){
  return <>
    <ambientLight intensity={0.12}/>
    <Stars radius={80} depth={40} count={3000} factor={3}/>
    <Sun/>
    <Earth/>
    <Moon time={time}/>
    <Trajectory/>
    <Orion time={time} setInfo={setInfo}/>
    <OrbitControls enableDamping minDistance={2} maxDistance={35}/>
  </>;
}

function App(){
  const [time,setTime]=useState(0);
  const [playing,setPlaying]=useState(true);
  const [info,setInfo]=useState('Launch / Earth orbit');
  useFrameShim(playing,setTime);
  return <div className="app">
    <Canvas camera={{position:[0,5,16], fov:55}} gl={{antialias:true}}>
      <Scene time={time} setInfo={setInfo}/>
    </Canvas>
    <div className="hud">
      <h1>Artemis II — interactive trajectory</h1>
      <p>{info}</p>
      <div className="controls">
        <button onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play'}</button>
        <input type="range" min="0" max="1" step="0.001" value={time} onChange={e=>{setPlaying(false); setTime(Number(e.target.value));}} />
      </div>
      <small>Earth texture: uploaded map. Trajectory: mission-profile keyframes scaled for readability; replace data/trajectory.json with Horizons vectors for exact ephemeris replay.</small>
    </div>
  </div>;
}

function useFrameShim(playing,setTime){
  React.useEffect(()=>{
    let raf, last=performance.now();
    const loop=(now)=>{
      const dt=(now-last)/1000; last=now;
      if(playing) setTime(t=>(t+dt*0.035)%1);
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[playing,setTime]);
}

createRoot(document.getElementById('root')).render(<App/>);
