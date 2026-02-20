// sim.js — N-body gravity with Velocity Verlet (symplectic-ish) in AU/day/Msun units.
export function makeSim() {
  // Units:
  // - distance: AU
  // - time: days
  // - mass: solar masses (Msun)
  // G in AU^3 / (Msun * day^2): (2π)^2 / (365.25^2)
  const G0 = (2*Math.PI)**2 / (365.25**2);

  const state = {
    bodies: [],
    tDays: 0,
    paused: false,
    dt: 0.01,           // days per physics step
    timeScale: 6.0,     // multiplier of dt per rendered frame
    gScale: 1.0,        // multiplier of G
    damping: 0.0005,    // simple velocity damping per step
    softening: 1e-5,    // AU^2 softening term
    mergeOnCollision: true,
    collisionRadiusScale: 1.0, // purely visual-ish threshold
  };

  function cloneBody(b){
    return {
      id: b.id,
      name: b.name,
      mass: b.mass,
      radiusAU: b.radiusAU,
      pos: b.pos.slice(),
      vel: b.vel.slice(),
      color: b.color,
      type: b.type || "body",
      fixed: !!b.fixed,
      trail: [],
    };
  }

  function setBodies(bodies){
    state.bodies = bodies.map(cloneBody);
    state.tDays = 0;
    for (const b of state.bodies) b.trail = [];
  }

  function totalEnergy(){
    // Kinetic + Potential (pairwise)
    let K = 0, U = 0;
    const bodies = state.bodies;
    for (let i=0;i<bodies.length;i++){
      const bi = bodies[i];
      const v2 = bi.vel[0]**2 + bi.vel[1]**2 + bi.vel[2]**2;
      K += 0.5 * bi.mass * v2;
      for (let j=i+1;j<bodies.length;j++){
        const bj = bodies[j];
        const dx = bj.pos[0]-bi.pos[0];
        const dy = bj.pos[1]-bi.pos[1];
        const dz = bj.pos[2]-bi.pos[2];
        const r = Math.sqrt(dx*dx+dy*dy+dz*dz + state.softening);
        U += -(G0*state.gScale) * bi.mass * bj.mass / r;
      }
    }
    return {K, U, E: K+U};
  }

  function computeAcc(){
    const bodies = state.bodies;
    const acc = new Array(bodies.length);
    for (let i=0;i<bodies.length;i++) acc[i] = [0,0,0];

    for (let i=0;i<bodies.length;i++){
      const bi = bodies[i];
      for (let j=i+1;j<bodies.length;j++){
        const bj = bodies[j];
        const dx = bj.pos[0]-bi.pos[0];
        const dy = bj.pos[1]-bi.pos[1];
        const dz = bj.pos[2]-bi.pos[2];
        const r2 = dx*dx+dy*dy+dz*dz + state.softening;
        const r = Math.sqrt(r2);
        const invr3 = 1.0 / (r2 * r);
        const s = (G0*state.gScale) * invr3;

        // Force direction times masses:
        const fax = s * dx;
        const fay = s * dy;
        const faz = s * dz;

        // a_i += G*m_j/r^3 * r_ij
        acc[i][0] += fax * bj.mass;
        acc[i][1] += fay * bj.mass;
        acc[i][2] += faz * bj.mass;

        // a_j -= G*m_i/r^3 * r_ij
        acc[j][0] -= fax * bi.mass;
        acc[j][1] -= fay * bi.mass;
        acc[j][2] -= faz * bi.mass;
      }
    }
    return acc;
  }

  function mergeIfCollide(){
    if (!state.mergeOnCollision) return;
    const bodies = state.bodies;
    const keep = new Array(bodies.length).fill(true);

    for (let i=0;i<bodies.length;i++){
      if (!keep[i]) continue;
      for (let j=i+1;j<bodies.length;j++){
        if (!keep[j]) continue;
        const bi = bodies[i], bj = bodies[j];
        const dx = bj.pos[0]-bi.pos[0];
        const dy = bj.pos[1]-bi.pos[1];
        const dz = bj.pos[2]-bi.pos[2];
        const r = Math.sqrt(dx*dx+dy*dy+dz*dz);
        const thr = (bi.radiusAU + bj.radiusAU) * state.collisionRadiusScale;
        if (r > 0 && r < thr){
          // Inelastic merge: conserve momentum, add masses, radius by volume (approx).
          const m = bi.mass + bj.mass;
          const px = bi.mass*bi.vel[0] + bj.mass*bj.vel[0];
          const py = bi.mass*bi.vel[1] + bj.mass*bj.vel[1];
          const pz = bi.mass*bi.vel[2] + bj.mass*bj.vel[2];

          // position: center of mass
          bi.pos[0] = (bi.mass*bi.pos[0] + bj.mass*bj.pos[0]) / m;
          bi.pos[1] = (bi.mass*bi.pos[1] + bj.mass*bj.pos[1]) / m;
          bi.pos[2] = (bi.mass*bi.pos[2] + bj.mass*bj.pos[2]) / m;

          bi.vel[0] = px / m;
          bi.vel[1] = py / m;
          bi.vel[2] = pz / m;

          bi.mass = m;
          const r1 = bi.radiusAU, r2 = bj.radiusAU;
          bi.radiusAU = Math.cbrt(r1**3 + r2**3);
          bi.name = bi.name + " + " + bj.name;
          keep[j] = false;
        }
      }
    }
    state.bodies = bodies.filter((_,idx)=>keep[idx]);
  }

  function step(nSteps=1){
    const dt = state.dt;
    for (let n=0;n<nSteps;n++){
      const bodies = state.bodies;
      const acc0 = computeAcc();

      // Position update
      for (let i=0;i<bodies.length;i++){
        const b = bodies[i];
        if (b.fixed) continue;
        b.pos[0] += b.vel[0]*dt + 0.5*acc0[i][0]*dt*dt;
        b.pos[1] += b.vel[1]*dt + 0.5*acc0[i][1]*dt*dt;
        b.pos[2] += b.vel[2]*dt + 0.5*acc0[i][2]*dt*dt;
      }

      // New acceleration
      const acc1 = computeAcc();

      // Velocity update
      const damp = (1.0 - state.damping);
      for (let i=0;i<bodies.length;i++){
        const b = bodies[i];
        if (b.fixed) continue;
        b.vel[0] = (b.vel[0] + 0.5*(acc0[i][0]+acc1[i][0])*dt) * damp;
        b.vel[1] = (b.vel[1] + 0.5*(acc0[i][1]+acc1[i][1])*dt) * damp;
        b.vel[2] = (b.vel[2] + 0.5*(acc0[i][2]+acc1[i][2])*dt) * damp;
      }

      state.tDays += dt;

      mergeIfCollide();
    }
  }

  return { state, setBodies, step, totalEnergy, G0 };
}
