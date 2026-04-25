# Artemis II WebGL Trajectory — Vite/Three.js

Interactive 3D prototype using the provided Earth map texture.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Notes
The Earth texture is the uploaded map image. The trajectory uses public Artemis II mission milestones scaled into a readable 3D scene: launch, high Earth orbit, trans-lunar injection, outbound transit, lunar flyby, maximum Earth distance, return, re-entry/splashdown. It is designed so exact NASA/JPL Horizons/SVS vectors can replace the keyframe array.
