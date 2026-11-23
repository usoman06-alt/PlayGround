import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ============================================================
   APEX HORIZON — procedural open world
   Coast, mountain roads, city, ocean, festival site, scenery.
   ============================================================ */

export const WORLD = 2600;
export const HALF = WORLD / 2;
const GRID = 256;
const CELL = 68;

const CITY = { x: 60, z: -560, r: 235 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mod = (n, m) => ((n % m) + m) % m;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4) {
  let sum = 0;
  let norm = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise2(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/* ---------------- canvas textures ---------------- */
function texture(w, h, draw, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  } else {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

function makeAsphaltTexture() {
  return texture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#35383d';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(8123);
    for (let i = 0; i < 9000; i++) {
      const g = 28 + rng() * 70;
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 5},${0.18 + rng() * 0.4})`;
      const s = rng() * 2.4 + 0.3;
      ctx.fillRect(rng() * w, rng() * h, s, s);
    }
    // tire wear
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.22, 'rgba(0,0,0,0.18)');
    grad.addColorStop(0.36, 'rgba(0,0,0,0.03)');
    grad.addColorStop(0.64, 'rgba(0,0,0,0.03)');
    grad.addColorStop(0.78, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // edge lines
    ctx.fillStyle = 'rgba(228,232,232,0.78)';
    ctx.fillRect(18, 0, 7, h);
    ctx.fillRect(w - 25, 0, 7, h);
    // dashed center line
    ctx.fillStyle = 'rgba(240,236,218,0.85)';
    ctx.fillRect(w / 2 - 3, 0, 7, h * 0.45);
    // cracks
    ctx.strokeStyle = 'rgba(15,16,18,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = rng() * w;
      let y = rng() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rng() - 0.5) * 40;
        y += rng() * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function makeGroundTexture() {
  const t = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a6a6a6';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(55137);
    for (let i = 0; i < 6000; i++) {
      const g = 105 + rng() * 100;
      ctx.fillStyle = `rgba(${g},${g},${g},${0.10 + rng() * 0.3})`;
      const s = rng() * 3 + 0.4;
      ctx.fillRect(rng() * w, rng() * h, s, s * (0.5 + rng()));
    }
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = `rgba(60,60,60,${0.04 + rng() * 0.1})`;
      ctx.lineWidth = 0.6 + rng() * 1.4;
      ctx.beginPath();
      const x = rng() * w;
      const y = rng() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 18, y + rng() * 18);
      ctx.stroke();
    }
  });
  t.repeat.set(70, 70);
  return t;
}

function makeWindowTexture() {
  return texture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b242e';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(9917);
    const cols = 7;
    const rows = 18;
    const mx = 5;
    const my = 4;
    const cw = (w - mx * (cols + 1)) / cols;
    const ch = (h - my * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = mx + c * (cw + mx);
        const y = my + r * (ch + my);
        const lit = rng();
        let col;
        if (lit > 0.82) col = `rgba(255,196,120,${0.5 + rng() * 0.5})`;
        else if (lit > 0.52) col = `rgba(150,196,224,${0.22 + rng() * 0.4})`;
        else col = `rgba(32,48,62,0.9)`;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, cw, ch);
      }
      ctx.fillStyle = 'rgba(10,14,18,0.5)';
      ctx.fillRect(0, my + r * (ch + my) - 1.5, w, 2);
    }
    ctx.fillStyle = 'rgba(9,12,16,0.6)';
    for (let c = 0; c < cols + 1; c++) {
      ctx.fillRect(mx * 0.5 + c * (cw + mx) - 1.5, 0, 2.4, h);
    }
  });
}

function makeGlowTexture() {
  return texture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,250,235,0.85)');
    g.addColorStop(0.5, 'rgba(255,210,150,0.18)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: false });
}

function makeShadowTexture() {
  return texture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.8)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: false });
}

function makeSmokeTexture() {
  return texture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: false });
}

function makeBannerTexture(title, sub, color = '#ff6a1a') {
  return texture(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#0a0e14');
    g.addColorStop(0.5, '#14181f');
    g.addColorStop(1, '#0a0e14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = color;
    ctx.fillRect(8, 8, 26, h - 16);
    ctx.fillRect(w - 34, 8, 26, h - 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 96px Arial Black, Arial, sans-serif';
    ctx.fillText(title, w / 2, 128);
    ctx.fillStyle = color;
    ctx.font = '700 38px Arial, sans-serif';
    ctx.letterSpacing = '12px';
    ctx.fillText(sub, w / 2, 192);
    // checker accents
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : color;
      ctx.fillRect(50 + i * 18, 24, 12, 14);
      ctx.fillRect(w - 50 - i * 18, h - 38, 12, 14);
    }
  }, { repeat: false });
}

function makeCheckpointTexture(number) {
  return texture(512, 320, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(110,245,255,0.95)';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(4,20,28,0.45)';
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150,250,255,0.95)';
    ctx.font = '700 36px Arial, sans-serif';
    ctx.fillText('CHECKPOINT', w / 2, 74);
    ctx.fillStyle = '#eaffff';
    ctx.font = '900 168px Arial Black, Arial, sans-serif';
    ctx.fillText(String(number).padStart(2, '0'), w / 2, 238);
    // chevrons
    ctx.strokeStyle = 'rgba(110,245,255,0.4)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const y = 268 + i * 12;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 34, y);
      ctx.lineTo(w / 2, y + 9);
      ctx.lineTo(w / 2 + 34, y);
      ctx.stroke();
    }
  }, { repeat: false });
}

/* ---------------- world builder ---------------- */
export function buildWorld(scene, renderer, options = {}) {
  const mobile = Boolean(options.mobile);
  const rng = mulberry32(20261123);
  const world = {};

  const sunDir = new THREE.Vector3(0.72, 0.21, -0.44).normalize();
  world.sunDir = sunDir;

  /* ---- height field ---- */
  const step = WORLD / GRID;
  const size = GRID + 1;
  const base = new Float32Array(size * size);
  const heights = new Float32Array(size * size);

  const coastX = (z) => 646 + (noise2(z * 0.0014 + 21.7, 4.3) - 0.5) * 170;

  function rawHeight(x, z) {
    const broad = fbm(x * 0.00115 + 3.1, z * 0.00115 - 1.7, 4);
    const detail = fbm(x * 0.0062 - 2.3, z * 0.0062 + 5.4, 3);
    let h = 7 + broad * 27 + detail * 5.5;
    const west = smoothstep(-300, -1250, x);
    const north = smoothstep(520, 1320, z);
    const mountain = Math.max(west, north * 0.82);
    h += mountain * mountain * (100 + 210 * fbm(x * 0.0019 + 9.1, z * 0.0019 - 2.5, 5));
    const c = coastX(z);
    const seaMix = smoothstep(c - 45, c + 235, x);
    h = lerp(h, -27, seaMix);
    const cd = Math.hypot(x - CITY.x, z - CITY.z);
    const cityMix = 1 - smoothstep(CITY.r * 0.5, CITY.r * 1.45, cd);
    h = lerp(h, 12.5, cityMix * 0.94);
    return h;
  }

  for (let iz = 0; iz < size; iz++) {
    const z = -HALF + iz * step;
    for (let ix = 0; ix < size; ix++) {
      const x = -HALF + ix * step;
      const h = rawHeight(x, z);
      base[iz * size + ix] = h;
      heights[iz * size + ix] = h;
    }
  }

  function bilinear(field, x, z) {
    const fx = clamp((x + HALF) / step, 0, GRID - 0.0001);
    const fz = clamp((z + HALF) / step, 0, GRID - 0.0001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const a = field[iz * size + ix];
    const b = field[iz * size + ix + 1];
    const c = field[(iz + 1) * size + ix];
    const d = field[(iz + 1) * size + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  world.heightAt = (x, z) => bilinear(heights, x, z);
  world.baseHeightAt = (x, z) => bilinear(base, x, z);

  const normal = new THREE.Vector3();
  world.normalAt = (x, z) => {
    const e = 1.6;
    const hl = world.heightAt(x - e, z);
    const hr = world.heightAt(x + e, z);
    const hd = world.heightAt(x, z - e);
    const hu = world.heightAt(x, z + e);
    normal.set(hl - hr, 2 * e, hd - hu).normalize();
    return normal;
  };

  /* ---- roads ---- */
  const mainPoints = [
    [380, 520], [520, 430], [600, 300], [612, 120], [520, -50], [452, -250],
    [382, -480], [182, -652], [-82, -702], [-322, -600], [-480, -452],
    [-522, -200], [-432, 62], [-382, 280], [-252, 452], [-22, 542], [200, 582]
  ];
  const hillPoints = [
    [-352, -88], [-196, 148], [-14, 212], [118, 92], [62, -104], [-98, -262], [-304, -232]
  ];

  const roads = [];
  const spatial = new Map();

  function addSplineRoad(name, pts, width, isStreet = false) {
    const v = pts.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(v, true, 'centripetal', 0.5);
    const length = curve.getLength();
    const count = Math.max(40, Math.round(length / 3.6));
    const raw = [];
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      raw.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, y: bilinear(base, p.x, p.z) });
    }
    // smooth elevation along the route
    let ys = raw.map((s) => s.y);
    for (let pass = 0; pass < 4; pass++) {
      const next = ys.slice();
      const win = 9;
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let k = -win; k <= win; k++) sum += ys[mod(i + k, count)];
        next[i] = sum / (win * 2 + 1);
      }
      ys = next;
    }
    let dist = 0;
    const samples = [];
    for (let i = 0; i < count; i++) {
      const s = raw[i];
      const y = Math.max(ys[i], 2.2);
      const nx = s.tz;
      const nz = -s.tx;
      const len = Math.hypot(nx, nz) || 1;
      samples.push({
        x: s.x, z: s.z, y,
        tx: s.tx, tz: s.tz,
        nx: nx / len, nz: nz / len,
        dist, width, road: name
      });
      if (i < count - 1) dist += Math.hypot(raw[i + 1].x - s.x, raw[i + 1].z - s.z);
    }
    const road = { name, closed: true, width, samples, length: dist, curve, isStreet };
    roads.push(road);
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const key = `${Math.floor(s.x / 72)},${Math.floor(s.z / 72)}`;
      if (!spatial.has(key)) spatial.set(key, []);
      spatial.get(key).push({ s, road });
    }
    return road;
  }

  function addStraightRoad(name, a, b, width) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(8, Math.round(len / 3.8));
    const samples = [];
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = lerp(a[0], b[0], t);
      const z = lerp(a[1], b[1], t);
      samples.push({
        x, z, y: Math.max(bilinear(base, x, z), 2.2),
        tx, tz, nx: tz, nz: -tx,
        dist: len * t, width, road: name
      });
    }
    // gentle elevation smoothing
    let ys = samples.map((s) => s.y);
    for (let pass = 0; pass < 3; pass++) {
      const next = ys.slice();
      for (let i = 1; i < count - 1; i++) next[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) / 4;
      ys = next;
    }
    samples.forEach((s, i) => { s.y = ys[i]; });
    const road = { name, closed: false, width, samples, length: len, curve: null, isStreet: true };
    roads.push(road);
    for (const s of samples) {
      const key = `${Math.floor(s.x / 72)},${Math.floor(s.z / 72)}`;
      if (!spatial.has(key)) spatial.set(key, []);
      spatial.get(key).push({ s, road });
    }
    return road;
  }

  const mainRoad = addSplineRoad('coast', mainPoints, 15);
  const hillRoad = addSplineRoad('pass', hillPoints, 13);

  // city grid streets
  const cityStreets = [];
  const streetXs = [-160, -80, 0, 80, 160, 240];
  const streetZs = [-780, -700, -620, -540, -460, -380];
  for (const x of streetXs) cityStreets.push(addStraightRoad('city', [x, -800], [x, -340], 10));
  for (const z of streetZs) cityStreets.push(addStraightRoad('city', [-220, z], [300, z], 10));

  world.roads = roads;
  world.mainRoad = mainRoad;
  world.hillRoad = hillRoad;

  function nearestRoadInfo(x, z, maxDist = 45) {
    const cx = Math.floor(x / 72);
    const cz = Math.floor(z / 72);
    let best = null;
    let bestD = maxDist * maxDist;
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const list = spatial.get(`${ix},${iz}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const s = list[k].s;
          const dx = s.x - x;
          const dz = s.z - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = list[k];
          }
        }
      }
    }
    if (!best) return null;
    return { sample: best.s, road: best.road, dist: Math.sqrt(bestD) };
  }
  world.nearestRoad = nearestRoadInfo;

  // flatten terrain under roads
  for (let iz = 0; iz < size; iz++) {
    const z = -HALF + iz * step;
    for (let ix = 0; ix < size; ix++) {
      const x = -HALF + ix * step;
      const info = nearestRoadInfo(x, z, 42);
      if (!info) continue;
      const inner = info.road.width * 0.5 + 2.2;
      const outer = inner + 19;
      const w = 1 - smoothstep(inner, outer, info.dist);
      if (w <= 0) continue;
      const idx = iz * size + ix;
      heights[idx] = lerp(heights[idx], info.sample.y, w * 0.97);
    }
  }

  /* ---- terrain mesh ---- */
  const terrainGeo = new THREE.BufferGeometry();
  const vCount = size * size;
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const indices = new Uint32Array(GRID * GRID * 6);

  const grassA = new THREE.Color('#5c7438');
  const grassB = new THREE.Color('#33512c');
  const dryCol = new THREE.Color('#8d8a55');
  const sandCol = new THREE.Color('#c8b083');
  const rockCol = new THREE.Color('#6c665c');
  const snowCol = new THREE.Color('#e2eaef');
  const cityCol = new THREE.Color('#63676b');
  const tmpColor = new THREE.Color();

  let ii = 0;
  for (let iz = 0; iz < size; iz++) {
    const z = -HALF + iz * step;
    for (let ix = 0; ix < size; ix++) {
      const i = iz * size + ix;
      const x = -HALF + ix * step;
      const y = heights[i];
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      uv[i * 2] = (x + HALF) / 30;
      uv[i * 2 + 1] = (z + HALF) / 30;

      const hl = heights[iz * size + Math.max(0, ix - 1)];
      const hr = heights[iz * size + Math.min(GRID, ix + 1)];
      const hd = heights[Math.max(0, iz - 1) * size + ix];
      const hu = heights[Math.min(GRID, iz + 1) * size + ix];
      const slope = Math.hypot((hr - hl) / (2 * step), (hu - hd) / (2 * step));

      const variation = fbm(x * 0.006 + 5.2, z * 0.006 - 3.1, 3);
      tmpColor.copy(grassA).lerp(grassB, clamp(variation * 1.5 - 0.2, 0, 1));
      tmpColor.lerp(dryCol, clamp(fbm(x * 0.0032 + 11, z * 0.0032 + 7, 2) - 0.54, 0, 1) * 0.9);
      const sandMix = 1 - smoothstep(1.4, 6.5, y);
      tmpColor.lerp(sandCol, sandMix * 0.95);
      tmpColor.lerp(rockCol, smoothstep(0.55, 1.25, slope) * 0.85);
      tmpColor.lerp(snowCol, smoothstep(175, 250, y) * 0.95);
      const cd = Math.hypot(x - CITY.x, z - CITY.z);
      tmpColor.lerp(cityCol, (1 - smoothstep(CITY.r * 0.55, CITY.r * 1.05, cd)) * 0.8);
      col[i * 3] = tmpColor.r;
      col[i * 3 + 1] = tmpColor.g;
      col[i * 3 + 2] = tmpColor.b;

      if (ix < GRID && iz < GRID) {
        const a = i;
        const b = i + 1;
        const c = i + size;
        const d = i + size + 1;
        indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
      }
    }
  }
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  terrainGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  terrainGeo.setIndex(new THREE.BufferAttribute(indices, 1));
  terrainGeo.computeVertexNormals();

  const groundTex = makeGroundTexture();
  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.01
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  terrain.matrixAutoUpdate = false;
  scene.add(terrain);
  world.terrain = terrain;

  /* ---- sky ---- */
  const skyUniforms = {
    uSunDir: { value: sunDir.clone() },
    uTime: { value: 0 },
    uHorizon: { value: new THREE.Color('#efa978') },
    uZenith: { value: new THREE.Color('#2c5188') },
    uSunColor: { value: new THREE.Color('#ffd8a3') }
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uSunColor;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -0.12, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.42));
        float sunDot = max(dot(d, uSunDir), 0.0);
        col += uSunColor * pow(sunDot, 5.0) * 0.28;
        col += uSunColor * pow(sunDot, 220.0) * 1.1;
        col += uSunColor * pow(sunDot, 2400.0) * 10.0;
        // clouds
        vec2 cp = d.xz / max(d.y + 0.13, 0.025) * 0.72;
        float cl = fbm(cp * 1.25 + vec2(uTime * 0.0035, uTime * 0.0012));
        float cov = smoothstep(0.50, 0.74, cl) * smoothstep(-0.01, 0.16, d.y);
        vec3 cloudCol = mix(vec3(0.34, 0.30, 0.36), vec3(1.15, 0.88, 0.72), pow(sunDot, 2.0));
        col = mix(col, cloudCol, cov * 0.82);
        // horizon haze
        col = mix(col, uHorizon * 1.02, exp(-max(d.y, 0.0) * 13.0) * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4400, 32, 18), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  world.sky = sky;

  /* ---- environment map ---- */
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  {
    const ctx = envCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1b3a63');
    g.addColorStop(0.34, '#6b93b4');
    g.addColorStop(0.48, '#f0b98c');
    g.addColorStop(0.53, '#f6c79c');
    g.addColorStop(0.6, '#5a4c42');
    g.addColorStop(0.8, '#20262b');
    g.addColorStop(1, '#12161a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const sx = 1024 * (0.5 + Math.atan2(sunDir.x, -sunDir.z) / (Math.PI * 2));
    const sy = 512 * (0.5 - Math.asin(sunDir.y) / Math.PI);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150);
    sg.addColorStop(0, 'rgba(255,248,225,1)');
    sg.addColorStop(0.1, 'rgba(255,214,150,0.9)');
    sg.addColorStop(0.5, 'rgba(255,170,100,0.18)');
    sg.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 1024, 512);
  }
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9;
  envTex.dispose();
  pmrem.dispose();

  /* ---- lights & fog ---- */
  scene.fog = new THREE.FogExp2(0xd9b28c, 0.00072);
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x6b5138, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd1a1, 3.0);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.castShadow = true;
  const shadowSize = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 800;
  const sb = mobile ? 55 : 90;
  sun.shadow.camera.left = -sb;
  sun.shadow.camera.right = sb;
  sun.shadow.camera.top = sb;
  sun.shadow.camera.bottom = -sb;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 1.1;
  scene.add(sun);
  scene.add(sun.target);
  world.sun = sun;

  const fill = new THREE.DirectionalLight(0x7fa8ff, 0.35);
  fill.position.set(-0.5, 0.4, 0.6).multiplyScalar(300);
  scene.add(fill);

  // sun flare
  const glowTex = makeGlowTexture();
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffdcae, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: true
  }));
  flare.position.copy(sunDir).multiplyScalar(3600);
  flare.scale.setScalar(900);
  scene.add(flare);

  /* ---- ocean ---- */
  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone() },
    uDeep: { value: new THREE.Color('#0b2734') },
    uShallow: { value: new THREE.Color('#2c6b7e') },
    uSunColor: { value: new THREE.Color('#ffc17f') },
    uFogColor: { value: new THREE.Color('#d9b28c') },
    uFogDensity: { value: 0.00072 }
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: false,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.05; a *= 0.5; }
        return v;
      }
      float waves(vec2 p, float t) {
        return fbm(p * 0.055 + vec2(t * 0.02, -t * 0.014)) * 1.0
             + fbm(p * 0.18 - vec2(t * 0.05, t * 0.03)) * 0.45;
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        float e = 1.4;
        float h0 = waves(p, t);
        float hx = waves(p + vec2(e, 0.0), t);
        float hz = waves(p + vec2(0.0, e), t);
        vec3 n = normalize(vec3((h0 - hx) * 1.9, 1.0, (h0 - hz) * 1.9));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2);
        float sunSpec = pow(max(dot(reflect(-viewDir, n), uSunDir), 0.0), 320.0);
        float broadSpec = pow(max(dot(reflect(-viewDir, n), uSunDir), 0.0), 24.0);
        vec3 col = mix(uDeep, uShallow, 0.18 + fres * 0.55);
        vec3 skyRef = mix(vec3(0.22, 0.32, 0.4), vec3(0.72, 0.62, 0.52), smoothstep(0.02, 0.5, reflect(-viewDir, n).y));
        col = mix(col, skyRef, fres * 0.7);
        col += uSunColor * sunSpec * 2.6;
        col += uSunColor * broadSpec * 0.16;
        float d = length(cameraPosition - vWorld);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);
  world.water = water;
  world.waterLevel = 0;

  /* ---- road meshes ---- */
  const asphalt = makeAsphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    roughness: 0.82,
    metalness: 0.1,
    color: 0xffffff
  });
  world.roadMaterial = roadMat;

  function buildRoadMesh(road) {
    const samples = road.samples;
    const n = samples.length;
    const vertices = new Float32Array((n + 1) * 2 * 3);
    const uvs = new Float32Array((n + 1) * 2 * 2);
    const indices = [];
    const halfW = road.width / 2;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const y = s.y + 0.1;
      const lx = s.x - s.nx * halfW;
      const lz = s.z - s.nz * halfW;
      const rx = s.x + s.nx * halfW;
      const rz = s.z + s.nz * halfW;
      const o = i * 2;
      vertices[o * 3] = lx;
      vertices[o * 3 + 1] = y;
      vertices[o * 3 + 2] = lz;
      vertices[(o + 1) * 3] = rx;
      vertices[(o + 1) * 3 + 1] = y;
      vertices[(o + 1) * 3 + 2] = rz;
      const v = s.dist / 26;
      uvs[o * 2] = 0;
      uvs[o * 2 + 1] = v;
      uvs[(o + 1) * 2] = 1;
      uvs[(o + 1) * 2 + 1] = v;
      if (i < n - 1) {
        const a = o;
        const b = o + 2;
        const c = o + 1;
        const d = o + 3;
        indices.push(a, b, c, c, b, d);
      }
    }
    if (road.closed && n > 2) {
      // close ring
      const i = n;
      const s = samples[0];
      const y = s.y + 0.1;
      const lx = s.x - s.nx * halfW;
      const lz = s.z - s.nz * halfW;
      const rx = s.x + s.nx * halfW;
      const rz = s.z + s.nz * halfW;
      const o = n * 2;
      vertices[o * 3] = lx; vertices[o * 3 + 1] = y; vertices[o * 3 + 2] = lz;
      vertices[(o + 1) * 3] = rx; vertices[(o + 1) * 3 + 1] = y; vertices[(o + 1) * 3 + 2] = rz;
      const v = (road.length + 3.6) / 26;
      uvs[o * 2] = 0; uvs[o * 2 + 1] = v;
      uvs[(o + 1) * 2] = 1; uvs[(o + 1) * 2 + 1] = v;
      const a = (n - 1) * 2;
      const b = o;
      const c = a + 1;
      const d = o + 1;
      indices.push(a, b, c, c, b, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  }

  const roadMeshes = roads.map(buildRoadMesh);
  world.roadMeshes = roadMeshes;

  /* ---- guardrails ---- */
  const railBox = new THREE.BoxGeometry(1, 1, 1);
  const railParts = [];
  const postParts = [];
  const railM = new THREE.Matrix4();
  const railQ = new THREE.Quaternion();
  const railPos = new THREE.Vector3();
  const railScale = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  function addRailBox(list, x, y, z, sx, sy, sz, yaw) {
    railQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    railPos.set(x, y, z);
    railScale.set(sx, sy, sz);
    railM.compose(railPos, railQ, railScale);
    const g = railBox.clone();
    g.applyMatrix4(railM);
    list.push(g);
  }

  const railSamples = [];
  for (let i = 0; i < mainRoad.samples.length; i += 2) {
    const s = mainRoad.samples[i];
    railSamples.push(s);
  }
  for (let i = 0; i < railSamples.length; i++) {
    const s = railSamples[i];
    const next = railSamples[(i + 1) % railSamples.length];
    const yaw = Math.atan2(s.tx, s.tz);
    for (const side of [-1, 1]) {
      const off = mainRoad.width / 2 + 1.35;
      const px = s.x + s.nx * off * side;
      const pz = s.z + s.nz * off * side;
      const edgeH = world.heightAt(px, pz);
      const centerDrop = Math.abs(edgeH - s.y);
      // place rails on the cliff side and on long coastal stretches
      const isCliff = edgeH < s.y - 1.6;
      if (!isCliff && centerDrop < 2.5 && i % 3 !== 0) continue;
      const length = 7.6;
      addRailBox(railParts, px, s.y + 0.82, pz, 0.16, 0.34, length, yaw);
      addRailBox(railParts, px, s.y + 0.46, pz, 0.1, 0.16, length, yaw);
      if (i % 2 === 0) addRailBox(postParts, px, s.y + 0.44, pz, 0.15, 0.9, 0.15, yaw);
    }
  }

  if (railParts.length) {
    const railGeo = mergeGeometries(railParts, false);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb9c2ca, metalness: 0.75, roughness: 0.34 });
    const rails = new THREE.Mesh(railGeo, railMat);
    rails.castShadow = false;
    rails.receiveShadow = true;
    rails.matrixAutoUpdate = false;
    scene.add(rails);
    const postGeo = mergeGeometries(postParts, false);
    const posts = new THREE.Mesh(postGeo, railMat);
    posts.matrixAutoUpdate = false;
    scene.add(posts);
    railParts.forEach((g) => g.dispose());
    postParts.forEach((g) => g.dispose());
  }

  /* ---- street lamps ---- */
  {
    const poleParts = [];
    const lampParts = [];
    const addLamp = (x, y, z, yaw, flip) => {
      const side = flip ? -1 : 1;
      const arm = side * 1.5;
      addRailBox(poleParts, x, y + 3.1, z, 0.14, 6.2, 0.14, 0);
      addRailBox(poleParts, x + Math.cos(yaw) * arm * 0.5, y + 6.1, z - Math.sin(yaw) * arm * 0.5, Math.abs(arm), 0.1, 0.1, yaw);
      addRailBox(lampParts, x + Math.cos(yaw) * arm, y + 6.0, z - Math.sin(yaw) * arm, 0.62, 0.16, 0.34, yaw);
    };
    for (let i = 0; i < mainRoad.samples.length; i += 14) {
      const s = mainRoad.samples[i];
      const side = i % 28 === 0 ? 1 : -1;
      addLamp(s.x + s.nx * (mainRoad.width / 2 + 2.2) * side, s.y, s.z + s.nz * (mainRoad.width / 2 + 2.2) * side, Math.atan2(s.tx, s.tz), side < 0);
    }
    for (const x of streetXs.slice(1, -1)) {
      for (let z = -780; z <= -380; z += 62) {
        const y = world.heightAt(x, z);
        addLamp(x + 5.5, y, z, 0, true);
      }
    }
    const geo = mergeGeometries(poleParts, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5c6670, metalness: 0.7, roughness: 0.4 });
    const poles = new THREE.Mesh(geo, mat);
    poles.matrixAutoUpdate = false;
    scene.add(poles);
    const lampGeo = mergeGeometries(lampParts, false);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d5, emissive: 0xffbd72, emissiveIntensity: 2.4, roughness: 0.35
    });
    const lamps = new THREE.Mesh(lampGeo, lampMat);
    lamps.matrixAutoUpdate = false;
    scene.add(lamps);
    poleParts.forEach((g) => g.dispose());
    lampParts.forEach((g) => g.dispose());
  }

  /* ---- city ---- */
  const windowTex = makeWindowTexture();
  const cityParts = [[], [], []];
  const colliders = [];
  const buildingRng = mulberry32(4471);
  const placed = [];

  function buildingGeometry(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uvAttr = g.attributes.uv;
    const uScale = [d / 8, d / 8, w / 8, w / 8, w / 8, w / 8];
    const vScale = [h / 6.5, h / 6.5, d / 6.5, d / 6.5, h / 6.5, h / 6.5];
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const idx = f * 4 + k;
        uvAttr.setXY(idx, uvAttr.getX(idx) * uScale[f], uvAttr.getY(idx) * vScale[f]);
      }
    }
    return g;
  }

  function addBuilding(x, z, w, d, h, variant, rot = 0) {
    const y = world.heightAt(x, z);
    const g = buildingGeometry(w, h, d);
    g.rotateY(rot);
    g.translate(x, y + h / 2 - 0.4, z);
    // rooftop slab
    const roof = new THREE.BoxGeometry(w * 0.82, 0.6, d * 0.82);
    roof.translate(x, y + h + 0.1, z);
    cityParts[2].push(roof);
    cityParts[variant].push(g);

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const hw = Math.abs(cos) * w / 2 + Math.abs(sin) * d / 2;
    const hd = Math.abs(sin) * w / 2 + Math.abs(cos) * d / 2;
    colliders.push({ type: 'box', x, z, hw: hw + 0.4, hd: hd + 0.4 });
    placed.push({ x, z, r: Math.max(w, d) * 0.5 });
  }

  const landmarkSpots = [
    [20, -545], [120, -600], [-40, -610], [82, -492], [-70, -528]
  ];
  for (const [x, z] of landmarkSpots) {
    const h = 78 + buildingRng() * 70;
    addBuilding(x, z, 22 + buildingRng() * 8, 22 + buildingRng() * 8, h, 1, buildingRng() * 0.4 - 0.2);
    // crown
    const cap = new THREE.BoxGeometry(10, 14, 10);
    cap.translate(x, world.heightAt(x, z) + h + 6, z);
    cityParts[1].push(cap);
    const spire = new THREE.CylinderGeometry(0.4, 1.3, 30, 6);
    spire.translate(x, world.heightAt(x, z) + h + 26, z);
    cityParts[2].push(spire);
  }

  for (let attempts = 0; attempts < 420 && placed.length < (mobile ? 46 : 68); attempts++) {
    const a = buildingRng() * Math.PI * 2;
    const r = Math.sqrt(buildingRng()) * (CITY.r - 26);
    const x = CITY.x + Math.cos(a) * r;
    const z = CITY.z + Math.sin(a) * r;
    const w = 14 + buildingRng() * 22;
    const d = 14 + buildingRng() * 22;
    const downtown = 1 - clamp(Math.hypot(x - CITY.x, z - CITY.z) / CITY.r, 0, 1);
    const h = 10 + buildingRng() * 30 + downtown * downtown * (45 + buildingRng() * 55);
    // avoid roads
    const near = nearestRoadInfo(x, z, 60);
    if (near && near.dist < near.road.width / 2 + Math.max(w, d) * 0.5 + 3.5) continue;
    // avoid other buildings
    let ok = true;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.z - z) < p.r + Math.max(w, d) * 0.5 + 4.5) { ok = false; break; }
    }
    if (!ok) continue;
    const rot = (buildingRng() - 0.5) * 0.16;
    addBuilding(x, z, w, d, h, Math.floor(buildingRng() * 2), rot);
  }

  const cityMats = [
    new THREE.MeshStandardMaterial({ map: windowTex, color: 0xaab0b4, roughness: 0.55, metalness: 0.4, vertexColors: false }),
    new THREE.MeshStandardMaterial({ map: windowTex, color: 0xbfc8ce, roughness: 0.42, metalness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: 0x3f464d, roughness: 0.75, metalness: 0.2 })
  ];
  cityMats[0].map = windowTex;
  for (let v = 0; v < 3; v++) {
    if (!cityParts[v].length) continue;
    const geo = mergeGeometries(cityParts[v], false);
    const mesh = new THREE.Mesh(geo, cityMats[v]);
    mesh.castShadow = !mobile;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    cityParts[v].forEach((g) => g.dispose());
  }

  // city monument / plaza details
  {
    const parts = [];
    const ring = new THREE.TorusGeometry(26, 1.1, 8, 48);
    ring.rotateX(Math.PI / 2);
    ring.translate(CITY.x, world.heightAt(CITY.x, CITY.z) + 0.4, CITY.z);
    parts.push(ring);
    const obelisk = new THREE.ConeGeometry(2.2, 34, 4);
    obelisk.translate(CITY.x, world.heightAt(CITY.x, CITY.z) + 17, CITY.z);
    parts.push(obelisk);
    const geo = mergeGeometries(parts, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.3, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !mobile;
    scene.add(mesh);
    colliders.push({ type: 'circle', x: CITY.x, z: CITY.z, r: 3 });
  }

  /* ---- trees & rocks ---- */
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a29, roughness: 0.94 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0, vertexColors: false });

  const pineFoliageParts = [];
  {
    const c1 = new THREE.ConeGeometry(1.55, 3.2, 8);
    c1.translate(0, 2.6, 0);
    const c2 = new THREE.ConeGeometry(1.24, 2.9, 8);
    c2.translate(0, 4.5, 0);
    const c3 = new THREE.ConeGeometry(0.88, 2.5, 8);
    c3.translate(0, 6.3, 0);
    pineFoliageParts.push(c1, c2, c3);
  }
  const pineFoliage = mergeGeometries(pineFoliageParts, false);
  pineFoliageParts.forEach((g) => g.dispose());
  const pineTrunk = new THREE.CylinderGeometry(0.16, 0.28, 3.4, 6);
  pineTrunk.translate(0, 1.7, 0);

  const leafFoliage = new THREE.IcosahedronGeometry(2.15, 1);
  leafFoliage.scale(1, 1.12, 1);
  leafFoliage.translate(0, 5.2, 0);
  const leafTrunk = new THREE.CylinderGeometry(0.2, 0.34, 4.0, 6);
  leafTrunk.translate(0, 2.0, 0);

  const treeSpots = [];
  const treeRng = mulberry32(77123);
  const maxTrees = mobile ? 620 : 1250;
  for (let attempts = 0; attempts < maxTrees * 8 && treeSpots.length < maxTrees; attempts++) {
    const x = (treeRng() * 2 - 1) * (HALF - 40);
    const z = (treeRng() * 2 - 1) * (HALF - 40);
    const h = world.heightAt(x, z);
    if (h < 2.6 || h > 190) continue;
    if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 30) continue;
    const near = nearestRoadInfo(x, z, 30);
    if (near && near.dist < near.road.width / 2 + 5.5) continue;
    const cluster = fbm(x * 0.0045 + 2.2, z * 0.0045 - 7.4, 3);
    if (cluster < 0.42) continue;
    if (h > 70 && cluster < 0.56) continue;
    treeSpots.push({ x, z, h, s: 0.7 + treeRng() * 0.95, pine: treeRng() > 0.33 });
  }

  const pines = treeSpots.filter((t) => t.pine);
  const leafy = treeSpots.filter((t) => !t.pine);

  function makeInstanced(geo, mat, list, colorFn) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      p.set(t.x, t.h, t.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.x * 0.37 + t.z * 0.11) % (Math.PI * 2));
      sc.setScalar(t.s);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
      if (colorFn) {
        colorFn(c, i);
        mesh.setColorAt(i, c);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = true;
    return mesh;
  }

  if (pines.length) {
    const trunks = makeInstanced(pineTrunk, trunkMat, pines);
    const foliage = makeInstanced(pineFoliage, leafMat.clone(), pines, (c, i) => {
      c.setHSL(0.29 + (i % 7) * 0.006, 0.34 + (i % 5) * 0.02, 0.16 + (i % 4) * 0.016);
    });
    trunks.castShadow = false;
    foliage.receiveShadow = false;
    scene.add(trunks, foliage);
  }
  if (leafy.length) {
    const trunks = makeInstanced(leafTrunk, trunkMat, leafy);
    const foliage = makeInstanced(leafFoliage, leafMat.clone(), leafy, (c, i) => {
      c.setHSL(0.24 + (i % 9) * 0.007, 0.4 + (i % 4) * 0.03, 0.2 + (i % 5) * 0.018);
    });
    scene.add(trunks, foliage);
  }
  for (const t of treeSpots) {
    colliders.push({ type: 'circle', x: t.x, z: t.z, r: 0.55 * t.s + 0.4 });
  }

  // rocks
  const rockGeo = new THREE.IcosahedronGeometry(1.4, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: 0.92, metalness: 0.03 });
  const rockRng = mulberry32(3331);
  const rockList = [];
  for (let i = 0; i < (mobile ? 60 : 130); i++) {
    const x = (rockRng() * 2 - 1) * (HALF - 90);
    const z = (rockRng() * 2 - 1) * (HALF - 90);
    const h = world.heightAt(x, z);
    if (h < 2.2 || Math.hypot(x - CITY.x, z - CITY.z) < CITY.r) continue;
    const near = nearestRoadInfo(x, z, 20);
    if (near && near.dist < near.road.width / 2 + 2) continue;
    rockList.push({ x, z, h, s: 0.5 + rockRng() * 2.3 });
  }
  if (rockList.length) {
    const rocks = makeInstanced(rockGeo, rockMat, rockList, (c, i) => {
      const g = 0.36 + (i % 5) * 0.02;
      c.setRGB(g, g * 0.99, g * 0.94);
    });
    rocks.rotation.set(0, 0, 0);
    scene.add(rocks);
    for (const r of rockList) if (r.s > 1.1) colliders.push({ type: 'circle', x: r.x, z: r.z, r: r.s * 0.8 });
  }

  /* ---- gates ---- */
  const gates = [];
  const gateGroup = new THREE.Group();
  scene.add(gateGroup);

  const archMat = new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.6, roughness: 0.3 });
  const gateGlowMat = new THREE.MeshBasicMaterial({ color: 0x56f4ff, toneMapped: false });

  const startU = 0.012;
  const startP = mainRoad.curve.getPointAt(startU);
  const startT = mainRoad.curve.getTangentAt(startU);
  const startYaw = Math.atan2(startT.x, startT.z);

  function makeStartGate() {
    const g = new THREE.Group();
    const H = 8.4;
    const W = 22;
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, H, 1.1), archMat);
      pillar.position.set(side * (W / 2), H / 2, 0);
      pillar.castShadow = true;
      g.add(pillar);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.22, H - 1.2, 0.22), gateGlowMat);
      glow.position.set(side * (W / 2 - 0.62), H / 2, 0.62);
      g.add(glow);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 1.1, 1.5, 1.3), archMat);
    beam.position.set(0, H - 0.4, 0);
    beam.castShadow = true;
    g.add(beam);
    const glowBar = new THREE.Mesh(new THREE.BoxGeometry(W - 2.4, 0.16, 0.16), gateGlowMat);
    glowBar.position.set(0, H - 1.2, 0.7);
    g.add(glowBar);

    const bannerTex = makeBannerTexture('APEX FESTIVAL', 'COAST SPRINT');
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 4, 2.9),
      new THREE.MeshBasicMaterial({ map: bannerTex, transparent: false, toneMapped: false, side: THREE.DoubleSide })
    );
    banner.position.set(0, H - 2.4, 0.72);
    g.add(banner);
    const bannerBack = banner.clone();
    bannerBack.position.z = -0.72;
    g.add(bannerBack);

    // flags
    const flagColors = [0xff6a1a, 0x4fe8ff, 0xffffff];
    for (let i = 0; i < 14; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), archMat);
      pole.position.set(-W / 2 + 0.8 + i * 1.55, H - 2.9, 0);
      g.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.6),
        new THREE.MeshBasicMaterial({ color: flagColors[i % 3], side: THREE.DoubleSide, toneMapped: false })
      );
      flag.position.set(-W / 2 + 1.45 + i * 1.55, H - 3.5, 0);
      flag.rotation.y = 0.35;
      g.add(flag);
    }
    return g;
  }

  const startGateGroup = makeStartGate();
  startGateGroup.position.set(startP.x, mainRoad.samples[0].y, startP.z);
  startGateGroup.rotation.y = startYaw;
  gateGroup.add(startGateGroup);
  gates.push({ type: 'start', x: startP.x, z: startP.z, y: mainRoad.samples[0].y, radius: 21, group: startGateGroup });

  const checkpointFractions = [0.155, 0.30, 0.445, 0.59, 0.735, 0.88];
  const checkpoints = [];
  const checkpointPlanes = [];
  for (let i = 0; i < checkpointFractions.length; i++) {
    const u = checkpointFractions[i];
    const p = mainRoad.curve.getPointAt(u);
    const t = mainRoad.curve.getTangentAt(u);
    const yaw = Math.atan2(t.x, t.z);
    const y = world.heightAt(p.x, p.z);
    const group = new THREE.Group();
    group.position.set(p.x, y, p.z);
    group.rotation.y = yaw;

    const H = 7.6;
    const W = 19;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, H, 0.36), gateGlowMat);
      post.position.set(side * W / 2, H / 2, 0);
      group.add(post);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.3), archMat);
      foot.position.set(side * W / 2, 0.14, 0);
      group.add(foot);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.28, 0.28), gateGlowMat);
    top.position.set(0, H, 0);
    group.add(top);

    const cpTex = makeCheckpointTexture(i + 1);
    const numberPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 3.4),
      new THREE.MeshBasicMaterial({ map: cpTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    numberPlane.position.set(0, H + 2.2, 0);
    group.add(numberPlane);

    const planeUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#5df5ff') } };
    const planeMat = new THREE.ShaderMaterial({
      uniforms: planeUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColor;
        void main() {
          float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(0.0, 0.03, 1.0 - vUv.x)
                     * smoothstep(0.0, 0.05, vUv.y) * smoothstep(0.0, 0.05, 1.0 - vUv.y);
          float scan = 0.5 + 0.5 * sin((vUv.y * 7.0 - uTime * 0.9) * 6.283);
          float stripe = smoothstep(0.36, 0.5, abs(fract(vUv.y * 11.0 - uTime * 0.32) - 0.5));
          float alpha = 0.035 + 0.07 * scan + 0.22 * edge + 0.05 * stripe * edge;
          gl_FragColor = vec4(uColor * (1.0 + scan * 0.7), alpha);
        }
      `
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, H - 0.7), planeMat);
    plane.position.set(0, (H - 0.7) / 2 + 0.4, 0);
    group.add(plane);

    gateGroup.add(group);
    const gate = { type: 'checkpoint', index: i, x: p.x, z: p.z, y, radius: 19, group, planeMat };
    checkpoints.push(gate);
    gates.push(gate);
    checkpointPlanes.push(planeMat);
  }

  // active beacon
  const beaconGroup = new THREE.Group();
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x54f2ff, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 150, 12, 1, true), beaconMat);
  beacon.position.y = 75;
  beaconGroup.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.12, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0x8ef8ff, transparent: true, opacity: 0.75, toneMapped: false })
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = 0.6;
  beaconGroup.add(beaconRing);
  gateGroup.add(beaconGroup);

  /* ---- festival site ---- */
  {
    const festival = new THREE.Group();
    const sideX = startP.x + Math.cos(startYaw) * 17;
    const sideZ = startP.z - Math.sin(startYaw) * 17;
    const fy = world.heightAt(sideX, sideZ);
    festival.position.set(sideX, fy, sideZ);
    const tentCols = [0xff6a1a, 0x2ad8ff, 0xf5f1e6];
    const tentPositions = [[0, 0], [15, -9], [-13, -12], [7, 15]];
    for (let i = 0; i < tentPositions.length; i++) {
      const [ox, oz] = tentPositions[i];
      const can = new THREE.Mesh(
        new THREE.ConeGeometry(6.4, 4.3, 4, 1),
        new THREE.MeshStandardMaterial({ color: tentCols[i % 3], roughness: 0.75, metalness: 0.05, flatShading: true })
      );
      can.position.set(ox, 4.4, oz);
      can.rotation.y = Math.PI / 4;
      can.castShadow = !mobile;
      festival.add(can);
      for (const [px, pz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5),
          new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.6, roughness: 0.4 })
        );
        pole.position.set(ox + px, 1.3, oz + pz);
        festival.add(pole);
      }
    }
    // big festival sign
    const signTex = makeBannerTexture('APEX', 'HORIZON FESTIVAL', '#ff6a1a');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 3.8),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false })
    );
    sign.position.set(-2, 6.2, 22);
    festival.add(sign);
    for (const sx of [-7, 7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 6), archMat);
      pole.position.set(sx - 2, 4, 22);
      festival.add(pole);
    }
    // crowd (instanced)
    const crowdGeo = new THREE.CapsuleGeometry(0.22, 0.75, 3, 6);
    const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, mobile ? 18 : 34);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const crowdRng = mulberry32(7712);
    for (let i = 0; i < crowd.count; i++) {
      const ox = (crowdRng() - 0.5) * 44;
      const oz = (crowdRng() - 0.5) * 34;
      const gy = world.heightAt(sideX + ox, sideZ + oz);
      p.set(ox, gy - fy + 0.8, oz);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), crowdRng() * Math.PI * 2);
      s.setScalar(0.8 + crowdRng() * 0.45);
      m.compose(p, q, s);
      crowd.setMatrixAt(i, m);
      c.setHSL(crowdRng(), 0.5, 0.42 + crowdRng() * 0.2);
      crowd.setColorAt(i, c);
    }
    crowd.instanceMatrix.needsUpdate = true;
    crowd.instanceColor.needsUpdate = true;
    festival.add(crowd);
    scene.add(festival);
  }

  /* ---- balloons ---- */
  const balloons = [];
  {
    const mkBalloon = (x, y, z, scale, hue) => {
      const g = new THREE.Group();
      const geo = new THREE.SphereGeometry(8, 24, 16);
      const colors = [];
      const cols = [new THREE.Color().setHSL(hue, 0.72, 0.52), new THREE.Color('#f3ead6'), new THREE.Color().setHSL(hue + 0.08, 0.6, 0.34)];
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        const pz = posAttr.getZ(i);
        const a = Math.atan2(pz, px) / (Math.PI * 2) + 0.5;
        const c = cols[Math.floor(a * 8) % cols.length];
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.scale(1, 1.16, 1);
      const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
      canopy.position.y = 8;
      g.add(canopy);
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.0, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x6d4c2c, roughness: 0.9 })
      );
      basket.position.y = -7;
      g.add(basket);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.6 });
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const lg = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(lx * 1.1, -6, lz * 1.1),
          new THREE.Vector3(lx * 3.2, 1.4, lz * 3.2)
        ]);
        g.add(new THREE.Line(lg, lineMat));
      }
      g.position.set(x, y, z);
      g.scale.setScalar(scale);
      scene.add(g);
      balloons.push({ group: g, baseY: y, phase: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.5 });
    };
    mkBalloon(360, 98, -250, 1.15, 0.06);
    mkBalloon(-260, 140, 120, 0.9, 0.55);
  }

  /* ---- map data ---- */
  const mapRoads = roads.map((r) => r.samples.map((s) => [s.x, s.z]));
  const minimap = {
    roads: mapRoads,
    mainRoad: mainRoad.samples.map((s) => [s.x, s.z]),
    city: { x: CITY.x, z: CITY.z, r: CITY.r },
    gates: [gates[0], ...checkpoints].map((g) => ({ x: g.x, z: g.z, type: g.type })),
    coast: (() => {
      const pts = [];
      for (let z = -HALF; z <= HALF; z += 80) pts.push([coastX(z), z]);
      return pts;
    })()
  };
  world.map = minimap;

  /* ---- spawn ---- */
  const spawnU = 0.0;
  const sp = mainRoad.curve.getPointAt(spawnU);
  const st = mainRoad.curve.getTangentAt(spawnU);
  world.spawn = {
    x: sp.x,
    z: sp.z,
    y: world.heightAt(sp.x, sp.z),
    yaw: Math.atan2(st.x, st.z)
  };
  world.startGate = gates[0];
  world.checkpoints = checkpoints;
  world.gates = gates;
  world.colliders = colliders;
  world.beacon = beaconGroup;
  world.checkpointPlanes = checkpointPlanes;
  world.city = CITY;

  /* ---- collision helpers ---- */
  world.resolveCollisions = (x, z, radius) => {
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.type === 'box') {
        const dx = x - c.x;
        const dz = z - c.z;
        if (Math.abs(dx) > c.hw + radius + 3 || Math.abs(dz) > c.hd + radius + 3) continue;
        const cx = clamp(dx, -c.hw, c.hw);
        const cz = clamp(dz, -c.hd, c.hd);
        const ox = dx - cx;
        const oz = dz - cz;
        const d = Math.hypot(ox, oz);
        if (d < radius) {
          if (d < 0.0001) {
            const px = c.hw + radius - Math.abs(dx);
            const pz = c.hd + radius - Math.abs(dz);
            if (px < pz) { x += Math.sign(dx || 1) * px; nx = Math.sign(dx || 1); nz = 0; }
            else { z += Math.sign(dz || 1) * pz; nz = Math.sign(dz || 1); nx = 0; }
          } else {
            const push = radius - d;
            x += (ox / d) * push;
            z += (oz / d) * push;
            nx = ox / d;
            nz = oz / d;
          }
          hit = true;
        }
      } else {
        const dx = x - c.x;
        const dz = z - c.z;
        const rr = c.r + radius;
        if (Math.abs(dx) > rr + 2 || Math.abs(dz) > rr + 2) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.001;
          const push = rr - d;
          x += (dx / d) * push;
          z += (dz / d) * push;
          nx = dx / d;
          nz = dz / d;
          hit = true;
        }
      }
    }
    return { x, z, hit, nx, nz };
  };

  world.isOffRoad = (x, z) => {
    const info = nearestRoadInfo(x, z, 20);
    if (!info) return true;
    return info.dist > info.road.width * 0.5 + 1.6;
  };

  /* ---- update ---- */
  const tmpV = new THREE.Vector3();
  world.update = (dt, elapsed, focus) => {
    waterUniforms.uTime.value = elapsed;
    skyUniforms.uTime.value = elapsed;
    for (const cp of checkpointPlanes) cp.uniforms.uTime.value = elapsed;
    for (const b of balloons) {
      b.group.position.y = b.baseY + Math.sin(elapsed * 0.25 + b.phase) * 2.2;
      b.group.position.x += Math.sin(elapsed * 0.05 + b.phase) * b.speed * dt;
      b.group.rotation.y += dt * 0.02;
    }
    beaconRing.rotation.z = elapsed * 0.8;
    if (focus) {
      sun.position.copy(focus).addScaledVector(sunDir, 420);
      sun.target.position.copy(focus);
      sun.target.updateMatrixWorld();
      sky.position.set(focus.x, 0, focus.z);
      flare.position.copy(focus).addScaledVector(sunDir, 3600);
      flare.position.y = 0;
    }
    return tmpV;
  };

  return world;
}
