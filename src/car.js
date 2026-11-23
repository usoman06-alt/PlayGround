import * as THREE from 'three';

/* ============================================================
   Procedural hypercar + arcade-sim vehicle dynamics
   ============================================================ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function extrudeProfile(points, width, bevel = 0.16) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel * 0.9,
    bevelSize: bevel,
    bevelSegments: 4,
    steps: 1,
    curveSegments: 6
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const shared = {
  shadowTex: null,
  carbon: new THREE.MeshStandardMaterial({ color: 0x14171b, metalness: 0.55, roughness: 0.4 }),
  carbonMatte: new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.15, roughness: 0.72 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd3dae0, metalness: 1.0, roughness: 0.18 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x0a1117,
    metalness: 0.4,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.9,
    envMapIntensity: 1.8
  }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.92, metalness: 0.02 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x30353b, metalness: 0.95, roughness: 0.28 }),
  rimLip: new THREE.MeshStandardMaterial({ color: 0xb9c1c8, metalness: 1, roughness: 0.18 }),
  brake: new THREE.MeshStandardMaterial({ color: 0x2a2b2c, metalness: 0.7, roughness: 0.5 }),
  caliper: new THREE.MeshStandardMaterial({ color: 0xff5a12, metalness: 0.4, roughness: 0.4 }),
  headlight: new THREE.MeshStandardMaterial({
    color: 0xeaf6ff, emissive: 0xc8ecff, emissiveIntensity: 4.2, roughness: 0.15, metalness: 0.1
  }),
  taillight: new THREE.MeshStandardMaterial({
    color: 0x340404, emissive: 0xff1a12, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.1
  }),
  plate: new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.6 })
};

function makeWheel(simple) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);

  const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, simple ? 16 : 28, 1);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, shared.rubber);
  tire.castShadow = true;
  spin.add(tire);

  const rimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.355, simple ? 12 : 24, 1);
  rimGeo.rotateZ(Math.PI / 2);
  const rimBase = new THREE.Mesh(rimGeo, shared.rim);
  spin.add(rimBase);

  const lipGeo = new THREE.TorusGeometry(0.35, 0.035, 6, simple ? 12 : 24);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, shared.rimLip);
  lip.position.x = 0.17;
  spin.add(lip);

  if (!simple) {
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.075), shared.rimLip);
      spoke.position.y = 0.17;
      spoke.position.x = 0.17;
      spoke.rotation.x = (i / 5) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.add(spoke);
      spin.add(holder);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.39, 12), shared.chrome);
    cap.rotation.z = Math.PI / 2;
    spin.add(cap);
  }

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 16), shared.brake);
  disc.rotation.z = Math.PI / 2;
  pivot.add(disc);
  if (!simple) {
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.19, 0.11), shared.caliper);
    caliper.position.set(0.06, 0.2, 0.05);
    pivot.add(caliper);
  }
  return { pivot, spin };
}

export function createCarVisual(color = 0xff5a12, simple = false) {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  const paint = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.48,
    roughness: 0.27,
    clearcoat: 1.0,
    clearcoatRoughness: 0.055,
    envMapIntensity: 1.45
  });

  const bodyProfile = [
    [2.26, 0.36], [2.36, 0.52], [2.3, 0.69], [2.06, 0.79], [1.56, 0.86],
    [0.96, 0.93], [0.44, 1.0], [-0.34, 1.02], [-1.2, 0.98], [-1.96, 0.9],
    [-2.26, 0.78], [-2.34, 0.56], [-2.27, 0.36], [-2.08, 0.26], [2.12, 0.26]
  ];
  const bodyGeo = extrudeProfile(bodyProfile, 1.5, 0.2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  body.receiveShadow = true;
  chassis.add(body);

  // cabin / canopy
  const cabinProfile = [
    [0.78, 0.99], [0.3, 1.32], [-0.44, 1.36], [-1.16, 1.04], [-1.16, 0.99], [0.78, 0.99]
  ];
  const cabinGeo = extrudeProfile(cabinProfile, 1.16, 0.07);
  const cabin = new THREE.Mesh(cabinGeo, shared.glass);
  cabin.castShadow = false;
  chassis.add(cabin);

  const roof = box(1.02, 0.035, 0.72, paint, 0, 1.365, -0.08);
  roof.rotation.x = -0.04;
  chassis.add(roof);

  // fender haunches
  const fenderGeo = new THREE.SphereGeometry(1, 18, 12);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const fender = new THREE.Mesh(fenderGeo, paint);
    fender.scale.set(0.52, 0.44, 0.76);
    fender.position.set(x * 0.94, 0.55, z * 1.44);
    fender.castShadow = true;
    chassis.add(fender);
  }

  // side skirts
  for (const x of [-1, 1]) {
    const skirt = box(0.18, 0.2, 2.9, shared.carbon, x * 0.99, 0.31, 0);
    chassis.add(skirt);
    const blade = box(0.06, 0.26, 1.05, shared.carbonMatte, x * 1.045, 0.62, -0.5);
    chassis.add(blade);
  }

  // front splitter + intakes
  const splitter = box(1.95, 0.07, 0.72, shared.carbon, 0, 0.27, 2.18);
  chassis.add(splitter);
  for (const x of [-1, 1]) {
    const canard = box(0.44, 0.03, 0.2, shared.carbon, x * 1.0, 0.4, 2.16);
    canard.rotation.z = x * 0.16;
    chassis.add(canard);
  }
  const grille = box(1.35, 0.2, 0.1, shared.carbonMatte, 0, 0.5, 2.32);
  chassis.add(grille);
  for (const x of [-1, 1]) {
    const intake = box(0.34, 0.16, 0.1, shared.carbonMatte, x * 0.72, 0.46, 2.31);
    chassis.add(intake);
  }

  // headlights
  if (!simple) {
    for (const x of [-1, 1]) {
      const light = box(0.5, 0.075, 0.1, shared.headlight, x * 0.62, 0.73, 2.24);
      light.rotation.y = x * 0.1;
      chassis.add(light);
      const drl = box(0.55, 0.03, 0.04, shared.headlight, x * 0.64, 0.66, 2.25);
      drl.rotation.y = x * 0.1;
      chassis.add(drl);
    }
  }

  // hood vents
  for (const x of [-0.4, 0.4]) {
    const vent = box(0.3, 0.02, 0.5, shared.carbonMatte, x, 0.935, 1.45);
    vent.rotation.x = 0.02;
    chassis.add(vent);
  }

  // engine cover slats
  for (let i = 0; i < 4; i++) {
    chassis.add(box(0.95, 0.02, 0.11, shared.carbonMatte, 0, 1.06, -1.24 - i * 0.2));
  }

  // mirrors
  if (!simple) {
    for (const x of [-1, 1]) {
      const stalk = box(0.18, 0.035, 0.035, shared.carbon, x * 0.92, 1.01, 0.62);
      chassis.add(stalk);
      const mirror = box(0.18, 0.1, 0.12, paint, x * 1.02, 1.05, 0.6);
      chassis.add(mirror);
    }
  }

  // rear diffuser + exhausts
  chassis.add(box(1.7, 0.16, 0.55, shared.carbon, 0, 0.32, -2.13));
  for (let i = -2; i <= 2; i++) {
    chassis.add(box(0.06, 0.2, 0.5, shared.carbonMatte, i * 0.34, 0.22, -2.16));
  }
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x25282c, metalness: 1, roughness: 0.25 });
  for (const x of [-0.32, 0.32]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.22, 12, 1, true), exhaustMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, 0.42, -2.3);
    chassis.add(ex);
  }

  // taillight bar
  if (!simple) {
    const bar = box(1.55, 0.07, 0.06, shared.taillight, 0, 0.86, -2.33);
    chassis.add(bar);
    const inner = box(1.1, 0.026, 0.05, shared.taillight, 0, 0.86, -2.34);
    chassis.add(inner);
    chassis.add(box(0.42, 0.12, 0.04, shared.plate, 0, 0.6, -2.35));
  }

  // wing
  {
    const wing = box(1.85, 0.065, 0.46, shared.carbon, 0, 1.29, -2.06);
    wing.rotation.x = -0.12;
    chassis.add(wing);
    for (const x of [-1, 1]) {
      chassis.add(box(0.05, 0.3, 0.5, shared.carbon, x * 0.55, 1.14, -2.06));
      chassis.add(box(0.035, 0.26, 0.52, shared.carbonMatte, x * 0.93, 1.28, -2.06));
    }
  }

  // exhaust flames (hidden unless boosting)
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x6fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  });
  const flames = new THREE.Group();
  for (const x of [-0.32, 0.32]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 8, 1, true), flameMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(x, 0.42, -2.68);
    f.scale.set(1, 1, 0.2);
    flames.add(f);
  }
  flames.visible = false;
  chassis.add(flames);

  // wheels
  const wheels = [];
  const wheelSpec = [
    [-0.99, 1.43, true], [0.99, 1.43, true], [-0.99, -1.45, false], [0.99, -1.45, false]
  ];
  for (const [x, z, front] of wheelSpec) {
    const w = makeWheel(simple);
    w.pivot.position.set(x, 0.46, z);
    w.front = front;
    group.add(w.pivot);
    wheels.push(w);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 5.4),
    new THREE.MeshBasicMaterial({
      map: shared.shadowTex || (shared.shadowTex = makeShadowTexture()),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      color: 0x000000,
      toneMapped: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.renderOrder = 2;

  return { group, chassis, wheels, paint, flames, shadow, simple };
}

/* ============================================================
   Player vehicle
   ============================================================ */

const WHEELBASE = 2.88;

export class PlayerVehicle {
  constructor(scene, world, color = 0xff5a12) {
    this.scene = scene;
    this.world = world;
    const built = createCarVisual(color, false);
    this.visual = built;
    this.group = built.group;
    this.chassis = built.chassis;
    this.wheels = built.wheels;
    this.flames = built.flames;
    this.paint = built.paint;
    this.shadow = built.shadow;
    scene.add(this.group);
    scene.add(this.shadow);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.yaw = 0;
    this.steer = 0;
    this.speed = 0;
    this.vLong = 0;
    this.vLat = 0;
    this.wheelSpin = 0;
    this.boost = 100;
    this.boosting = false;
    this.drifting = false;
    this.driftIntensity = 0;
    this.offRoad = false;
    this.nitroUsed = 0;
    this.impact = 0;
    this.gear = 'N';
    this.rpm = 0.15;
    this.smokeAcc = 0;
    this.roll = 0;
    this.pitch = 0;
    this.quat = new THREE.Quaternion();
    this.contact = true;

    const spawn = world.spawn;
    this.reset(spawn.x, spawn.z, spawn.yaw);
  }

  setColor(hex) {
    this.paint.color.setHex(hex);
  }

  reset(x, z, yaw) {
    this.pos.set(x, this.world.heightAt(x, z), z);
    this.vel.set(0, 0);
    this.yaw = yaw;
    this.steer = 0;
    this.speed = 0;
    this.vLong = 0;
    this.vLat = 0;
    this.boost = Math.max(this.boost, 60);
    this.drifting = false;
    this.gear = 'N';
    this.updateTransform(1);
  }

  update(dt, input) {
    const world = this.world;
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    const steerIn = clamp(input.steer, -1, 1);
    const handbrake = Boolean(input.handbrake);
    const nitroKey = Boolean(input.nitro);

    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let vLong = this.vel.x * fwdX + this.vel.y * fwdZ;
    let vLat = this.vel.x * rightX + this.vel.y * rightZ;
    const speedAbs = Math.abs(vLong);

    this.offRoad = world.isOffRoad(this.pos.x, this.pos.z);
    const onRoad = !this.offRoad;

    // nitro
    this.boosting = nitroKey && this.boost > 0.5 && vLong > 4 && throttle > 0.1;
    if (this.boosting) {
      this.boost = Math.max(0, this.boost - dt * 24);
      this.nitroUsed += dt;
    } else {
      this.boost = Math.min(100, this.boost + dt * (this.drifting ? 12 : 4.2));
    }

    const topSpeed = this.boosting ? 103 : 86;
    const enginePower = this.boosting ? 31 : 18.5;

    if (throttle > 0.01 && vLong < topSpeed) {
      const curve = Math.pow(clamp(1 - vLong / topSpeed, 0, 1), 0.62);
      vLong += enginePower * throttle * curve * dt;
    }

    // braking / reverse
    if (brake > 0.01) {
      if (vLong > 0.6) {
        vLong -= brake * 34 * dt;
        if (vLong < 0) vLong = 0;
      } else {
        const reverseTop = 17;
        if (vLong > -reverseTop) vLong -= brake * 9.5 * dt * (1 - clamp(-vLong / reverseTop, 0, 1));
      }
    }

    // rolling resistance + aero drag
    const drag = 0.00055 * vLong * Math.abs(vLong) + 0.55 * Math.sign(vLong);
    vLong -= drag * dt;
    if (Math.abs(vLong) < 0.08 && throttle < 0.01 && brake < 0.01) vLong = 0;

    // off-road resistance
    if (!onRoad) {
      const off = 1.4 + 0.0014 * vLong * vLong;
      vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong) / dt, off) * dt;
    }

    // handbrake
    if (handbrake && Math.abs(vLong) > 0.3) {
      vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), 7.5 * dt);
    }

    // slope gravity
    const probe = 2.6;
    const hF = world.heightAt(this.pos.x + fwdX * probe, this.pos.z + fwdZ * probe);
    const hB = world.heightAt(this.pos.x - fwdX * probe, this.pos.z - fwdZ * probe);
    const slope = (hF - hB) / (probe * 2);
    vLong -= slope * 12.5 * dt;

    // lateral grip
    const grip = (onRoad ? 9.4 : 5.4) * (handbrake ? 0.14 : 1);
    vLat *= Math.exp(-grip * dt);

    // steering
    const rate = 6.5;
    this.steer += clamp(steerIn - this.steer, -dt * rate, dt * rate);
    const speedFactor = clamp(speedAbs / 78, 0, 1);
    const maxSteerAngle = lerp(0.62, 0.155, speedFactor);
    let yawRate = (vLong / WHEELBASE) * Math.tan(this.steer * maxSteerAngle);
    const maxLat = handbrake ? 24 : (onRoad ? 13.5 : 7.5);
    const cap = maxLat / Math.max(Math.abs(vLong), 5.5);
    yawRate = clamp(yawRate, -cap, cap);
    if (handbrake && Math.abs(vLong) > 6) yawRate *= 1.18;

    // compose velocity and move
    this.vel.set(fwdX * vLong + rightX * vLat, fwdZ * vLong + rightZ * vLat);
    this.yaw += yawRate * dt;

    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.y * dt;

    // world bounds / water
    nx = clamp(nx, -1260, 1260);
    nz = clamp(nz, -1260, 1260);

    let water = false;
    const groundH = world.heightAt(nx, nz);
    if (groundH < 0.55) {
      water = true;
      // soft shoreline resistance
      vLong *= Math.exp(-2.2 * dt);
      this.vel.multiplyScalar(Math.exp(-2.2 * dt));
    }

    // static collisions
    const res = world.resolveCollisions(nx, nz, 1.35);
    if (res.hit) {
      nx = res.x;
      nz = res.z;
      const vn = this.vel.x * res.nx + this.vel.y * res.nz;
      if (vn < 0) {
        this.vel.x -= res.nx * vn * 1.35;
        this.vel.y -= res.nz * vn * 1.35;
        this.impact = Math.min(1, -vn / 24);
      }
      this.vel.multiplyScalar(0.88);
    }

    this.pos.x = nx;
    this.pos.z = nz;
    this.pos.y = world.heightAt(nx, nz);
    this.vLong = this.vel.x * Math.sin(this.yaw) + this.vel.y * Math.cos(this.yaw);
    this.vLat = this.vel.x * Math.cos(this.yaw) - this.vel.y * Math.sin(this.yaw);
    this.speed = Math.hypot(this.vel.x, this.vel.y);

    // drift detection
    const slip = Math.abs(this.vLat);
    this.driftIntensity = clamp((slip - 2.8) / 12, 0, 1);
    this.drifting = slip > 3.1 && this.speed > 8.5;
    if (!onRoad) this.drifting = false;

    // gear / rpm
    const kmh = this.speed * 3.6;
    if (Math.abs(this.vLong) < 0.4) this.gear = 'N';
    else if (this.vLong < -0.5) this.gear = 'R';
    else {
      const gears = [0, 22, 42, 62, 82, 105, 130];
      let g = 1;
      for (let i = 1; i < gears.length; i++) if (kmh >= gears[i] * 3.6 * 0.36) g = i + 1;
      this.gear = String(Math.min(6, g));
    }
    const band = kmh % 46;
    this.rpm = clamp(0.18 + (band / 46) * 0.7 + throttle * 0.12, 0, 1);

    // wheels
    this.wheelSpin += (this.vLong / 0.46) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = this.steer * 0.46;
    }

    // body lean
    const latAccel = yawRate * this.vLong;
    this.roll = lerp(this.roll, clamp(-latAccel * 0.006, -0.045, 0.045), 1 - Math.exp(-dt * 7));
    this.pitch = lerp(this.pitch, clamp((throttle - brake) * 0.011 + (brake > 0.5 ? 0.01 : 0), -0.03, 0.03), 1 - Math.exp(-dt * 6));
    this.chassis.rotation.z = this.roll;
    this.chassis.rotation.x = this.pitch;

    this.flames.visible = this.boosting;
    if (this.boosting) {
      const s = 0.7 + Math.random() * 0.7;
      this.flames.children.forEach((f, i) => {
        f.scale.set(0.8 + Math.random() * 0.5, s * (1 + i * 0.1), 0.8);
        f.position.z = -2.62 - Math.random() * 0.2;
      });
    }

    this.impact = Math.max(0, this.impact - dt * 2.2);
    this.contact = !water;

    this.updateTransform(dt);
    return { water, impact: this.impact, slip };
  }

  updateTransform(dt) {
    const n = this.world.normalAt(this.pos.x, this.pos.z).clone();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3().crossVectors(n, fwd).normalize();
    const forward = new THREE.Vector3().crossVectors(right, n).normalize();
    const m = new THREE.Matrix4().makeBasis(right, n, forward);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (dt >= 1) this.quat.copy(q);
    else this.quat.slerp(q, 1 - Math.exp(-dt * 11));

    this.group.position.set(this.pos.x, this.pos.y + 0.015, this.pos.z);
    this.group.quaternion.copy(this.quat);

    this.shadow.position.set(this.pos.x, this.world.heightAt(this.pos.x, this.pos.z) + 0.035, this.pos.z);
    this.shadow.rotation.z = -this.yaw;
    this.shadow.rotation.x = -Math.PI / 2;
    const scale = 1 + Math.min(0.15, this.speed * 0.002);
    this.shadow.scale.setScalar(scale);
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
  }
}
