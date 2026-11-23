import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9a46c');
scene.fog = new THREE.FogExp2('#e9a46c', 0.0065);
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, .1, 1800);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
const hemi = new THREE.HemisphereLight('#ffe9c6', '#9d5642', 2.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0c8', 3.2); sun.position.set(-80, 130, 50); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; scene.add(sun);
const mats = {};
for (const [key, color, roughness] of [['sand','#d58d5d',1],['road','#443c43',.92],['roadEdge','#ffd194',.85],['line','#f0c98e',.8],['rust','#954d3e',.85],['coral','#ed7250',.7],['yellow','#f8c857',.65],['cream','#fff0c9',.8],['dark','#322b32',.8],['green','#49674b',1],['cactus','#46765a',.9],['purple','#786273',1]]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness });
const world = new THREE.Group(); scene.add(world);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mats.sand); ground.rotation.x = -Math.PI/2; ground.position.y = -.45; ground.receiveShadow = true; world.add(ground);
const roadGroup = new THREE.Group(); world.add(roadGroup);
const hazardsGroup = new THREE.Group(); world.add(hazardsGroup);
const decorGroup = new THREE.Group(); world.add(decorGroup);
const pickupsGroup = new THREE.Group(); world.add(pickupsGroup);
const gatesGroup = new THREE.Group(); world.add(gatesGroup);
const roadWidth = 15, finishAt = 1000, totalTime = 95;
const centerAt = p => Math.sin(p * .0073) * 5 + Math.sin(p * .018) * 2.2;

function box(parent, size, material, pos, rot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function sphere(parent, radius, material, pos, detail=1) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material); mesh.position.set(...pos); mesh.castShadow=true; parent.add(mesh); return mesh;
}
function cylinder(parent, rt, rb, h, material, pos, seg=8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),material); mesh.position.set(...pos); mesh.castShadow=true; parent.add(mesh); return mesh;
}
function makeRoad() {
  const points=[]; for(let p=0;p<=finishAt+100;p+=8) points.push({p,x:centerAt(p)});
  for(let i=0;i<points.length-1;i++) {
    const a=points[i],b=points[i+1], z1=-a.p,z2=-b.p, dx=b.x-a.x;
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute([a.x-roadWidth/2,.01,z1,a.x+roadWidth/2,.01,z1,b.x+roadWidth/2,.01,z2,b.x-roadWidth/2,.01,z2],3)); geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mats.road); mesh.material.side=THREE.DoubleSide; mesh.receiveShadow=true; roadGroup.add(mesh);
    // Pale shoulders
    for(const side of [-1,1]) { const shoulder=box(roadGroup,[1,.09,8],mats.roadEdge,[a.x+side*(roadWidth/2+.5),-.01,(z1+z2)/2]); shoulder.rotation.y=-dx/8; }
    if(i%3===0) { const dash=box(roadGroup,[.16,.035,3.2],mats.line,[(a.x+b.x)/2,.045,(z1+z2)/2]); dash.rotation.y=-dx/8; }
  }
}
makeRoad();
function makeCactus(parent,x,z,scale=1) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(scale); parent.add(g);
  cylinder(g,.46,.58,2.4,mats.cactus,[0,1.15,0],7);
  cylinder(g,.34,.43,1.05,mats.cactus,[.72,1.22,0],7).rotation.z=-.42;
  cylinder(g,.22,.28,.8,mats.cactus,[.94,1.78,0],7).rotation.z=.15;
  cylinder(g,.32,.38,.9,mats.cactus,[-.62,.92,0],7).rotation.z=.5;
  cylinder(g,.22,.28,.76,mats.cactus,[-.78,1.38,0],7).rotation.z=-.12;
  return g;
}
function makeDecor() {
  for(let p=0;p<finishAt+60;p+=22) {
    const c=centerAt(p), spread=12+Math.random()*18;
    for(const side of [-1,1]) {
      const x=c+side*(roadWidth/2+spread);
      if(Math.random()<.66) makeCactus(decorGroup,x,-p,.65+Math.random()*.65);
      else { const rock=sphere(decorGroup,.8+Math.random()*1.8,mats.rust,[x,0.2+Math.random()*.25,-p],0); rock.scale.set(1.7,.7,1.2); }
      if(p%66===0) { const b=box(decorGroup,[.55,3.4,.5],mats.rust,[x+side*2,1.7,-p]); b.rotation.z=(Math.random()-.5)*.12; }
    }
  }
  // Distant mesa silhouettes
  for(let i=0;i<20;i++) { const x=(i-10)*38, z=-80-Math.random()*1050; const m=sphere(decorGroup,10+Math.random()*15,i%3===0?mats.purple:mats.rust,[x,-2,z],1); m.scale.set(1.7,.75,1); }
}
makeDecor();

// Sunset disc and layered ridge
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(27,48),new THREE.MeshBasicMaterial({color:'#fff0b0'})); sunDisc.position.set(0,39,-720); scene.add(sunDisc);
const halo = new THREE.Mesh(new THREE.CircleGeometry(34,48),new THREE.MeshBasicMaterial({color:'#ffbd79',transparent:true,opacity:.22,depthWrite:false})); halo.position.set(0,39,-719); scene.add(halo);

// A hand-built desert buggy: chunky body, warm paint, exposed tires and lamps.
const car = new THREE.Group(); world.add(car);
const chassis = new THREE.Group(); car.add(chassis);
box(chassis,[2.15,.62,3.55],mats.coral,[0,.78,0]);
box(chassis,[1.72,.62,1.35],mats.yellow,[0,1.18,-.42]);
box(chassis,[1.4,.15,1.56],mats.dark,[0,1.58,-.38]);
box(chassis,[.18,.82,.16],mats.dark,[-.67,1.47,.18]); box(chassis,[.18,.82,.16],mats.dark,[.67,1.47,.18]);
box(chassis,[1.1,.12,.17],mats.dark,[0,1.84,.18]);
box(chassis,[1.72,.13,.36],mats.dark,[0,.48,-1.62]);
box(chassis,[.32,.19,.12],mats.cream,[-.72,1.04,-1.78]); box(chassis,[.32,.19,.12],mats.cream,[.72,1.04,-1.78]);
box(chassis,[.18,.16,.12],mats.yellow,[-.72,.92,1.78]); box(chassis,[.18,.16,.12],mats.yellow,[.72,.92,1.78]);
const wheels=[];
for(const x of [-1.12,1.12]) for(const z of [-1.12,1.18]) {
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.34,12),mats.dark); tire.rotation.z=Math.PI/2; tire.position.set(x,.48,z); tire.castShadow=true; chassis.add(tire); wheels.push(tire);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.36,8),mats.yellow); hub.rotation.z=Math.PI/2; hub.position.set(x,.48,z); chassis.add(hub);
}
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.7,24),new THREE.MeshBasicMaterial({color:'#3c2929',transparent:true,opacity:.22,depthWrite:false})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.025; car.add(shadow);

// Relay shards hang over the roadway. Each pickup has a floating amber beacon.
const relays = [
  {p:155,lane:-3.2},{p:365,lane:3.1},{p:575,lane:-2.7},{p:790,lane:2.6}
];
const pickups=[];
for(let i=0;i<relays.length;i++) {
  const item=new THREE.Group(), p=relays[i].p, x=centerAt(p)+relays[i].lane; item.position.set(x,1.75,-p); pickupsGroup.add(item);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.72,0),mats.yellow); gem.castShadow=true; item.add(gem);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.045,6,24),new THREE.MeshBasicMaterial({color:'#ffe49a',transparent:true,opacity:.8})); ring.rotation.x=Math.PI/2; item.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.38,2.4,8,1,true),new THREE.MeshBasicMaterial({color:'#ffd56e',transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false})); beam.position.y=-.3; item.add(beam);
  pickups.push({group:item,gem,ring,p,found:false});
}

// Orange checkpoint gates make the winding road readable and mark each leg.
const gates=[];
for(let i=1;i<=5;i++) {
  const p=i===5?finishAt:i*200, x=centerAt(p), group=new THREE.Group(); group.position.set(x,0,-p); gatesGroup.add(group);
  const material=i===5?mats.yellow:mats.roadEdge;
  for(const side of [-1,1]) cylinder(group,.15,.15,4.7,material,[side*7.1,2.35,0],8);
  const cross=box(group,[14.4,.28,.3],material,[0,4.7,0]);
  const sign=box(group,[4.4,.95,.18],mats.rust,[0,4.18,-.18]);
  box(group,[.08,.7,.08],mats.yellow,[0,4.2,-.07]);
  gates.push({group,p,passed:false,finish:i===5});
}

// Tumbleweeds roll across the road in diagonals; striped gravel patches are hazards too.
const obstacles=[];
for(let i=0;i<17;i++) {
  const p=85+i*51, lane=((i*7)%11-5)*.8, x=centerAt(p)+lane;
  const group=new THREE.Group(); group.position.set(x,.85,-p); hazardsGroup.add(group);
  const weed=sphere(group,.78,mats.rust,[0,0,0],1);
  for(let n=0;n<6;n++) { const spike=cylinder(group,.06,.09,.9,mats.yellow,[Math.cos(n*Math.PI/3)*.65,Math.sin(n*Math.PI/3)*.65,0],5); spike.rotation.z=n*Math.PI/3; }
  const band=new THREE.Mesh(new THREE.TorusGeometry(.8,.055,5,14),mats.yellow); group.add(band); band.rotation.x=Math.PI/2;
  obstacles.push({group,baseX:x,p,weed,lane,hit:false,phase:i*.8});
}

// Lighthouse landmark at the finish line.
const beacon=new THREE.Group(); beacon.position.set(centerAt(finishAt),0,-finishAt-16); world.add(beacon);
cylinder(beacon,1.45,2,12,mats.cream,[0,6,0],7);
cylinder(beacon,1.1,1.2,1.8,mats.coral,[0,11.8,0],7);
box(beacon,[2.5,1.5,2.5],mats.yellow,[0,13,0]);
const beaconGlow=new THREE.PointLight('#ffd77a',28,100); beaconGlow.position.set(0,14,0); beacon.add(beaconGlow);

const ui={
  start:document.querySelector('#start-screen'),end:document.querySelector('#end-screen'),hud:document.querySelector('#hud'),
  startButton:document.querySelector('#start-button'),restart:document.querySelector('#restart-button'),timer:document.querySelector('#timer'),
  distance:document.querySelector('#distance'),fill:document.querySelector('#progress-fill'),pin:document.querySelector('#progress-pin'),
  speed:document.querySelector('#speed'),relayIcons:[...document.querySelectorAll('#relays i')],charge:document.querySelector('#charge-fill'),chargeNumber:document.querySelector('#charge-number'),
  alert:document.querySelector('#weather-alert'),gustFill:document.querySelector('#gust-fill'),toast:document.querySelector('#toast'),
  endTitle:document.querySelector('#end-title'),endKicker:document.querySelector('#end-kicker'),endCopy:document.querySelector('#end-copy'),
  resultRelays:document.querySelector('#result-relays'),resultDistance:document.querySelector('#result-distance'),loading:document.querySelector('#loading')
};
const keys=new Set(), touch={};
let running=false, elapsed=0, remaining=totalTime, distance=0, speed=0, charge=0, skipTime=0, gustTime=0, nextGust=11, toastTime=0, hits=0, sfx=null, soundOn=true;
const maxCharge=3.2;
const skipRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.12,8,36),new THREE.MeshBasicMaterial({color:'#fff0a5',transparent:true,opacity:.8,depthWrite:false}));
skipRing.rotation.x=Math.PI/2; skipRing.position.y=.2; skipRing.visible=false; car.add(skipRing);
const savedBest=Number(localStorage.getItem('saltglass-best')||0);
function controls(code){return keys.has(code)||touch[code]===true;}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);});
window.addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(e.code==='Space'&&running) activateSkip();
});
window.addEventListener('blur',()=>keys.clear());
for(const button of document.querySelectorAll('[data-control]')){
  const name=button.dataset.control,code={left:'ArrowLeft',right:'ArrowRight',brake:'ArrowDown',accelerate:'ArrowUp',skip:'Space'}[name];
  button.addEventListener('pointerdown',e=>{e.preventDefault();touch[code]=true;button.setPointerCapture(e.pointerId);});
  const release=e=>{e.preventDefault();touch[code]=false;if(code==='Space'&&running)activateSkip();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',()=>touch[code]=false);
}
function startAudio(){
  if(!soundOn)return;
  try{if(!sfx){const Audio=window.AudioContext||window.webkitAudioContext;sfx=new Audio();const osc=sfx.createOscillator(),gain=sfx.createGain();osc.type='sawtooth';osc.frequency.value=55;gain.gain.value=.018;osc.connect(gain);gain.connect(sfx.destination);osc.start();sfx.engine={osc,gain};}sfx.resume();}catch{}
}
function tone(freq=440,duration=.13){if(!sfx||!soundOn)return;try{const osc=sfx.createOscillator(),gain=sfx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.08,sfx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,sfx.currentTime+duration);osc.connect(gain);gain.connect(sfx.destination);osc.start();osc.stop(sfx.currentTime+duration);}catch{}}
document.querySelector('#sound-button').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.innerHTML=`${soundOn?'♪':'♩'} <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(soundOn)startAudio();else if(sfx)sfx.suspend();});
function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');toastTime=1.6;}
function activateSkip(){
  if(charge<.35||skipTime>0)return;
  skipTime=1.55;speed=Math.min(38,speed+10);charge=0;tone(680,.22);showToast('SUN-SKIP! PHASE THROUGH THE DUST');
  skipRing.visible=true;
}
function resetGame(){
  elapsed=0;remaining=totalTime;distance=0;speed=0;charge=0;skipTime=0;gustTime=0;nextGust=11;hits=0;
  for(const item of pickups){item.found=false;item.group.visible=true;}
  for(const icon of ui.relayIcons)icon.classList.remove('found');
  for(const obstacle of obstacles){obstacle.hit=false;obstacle.group.visible=true;}
  for(const gate of gates)gate.passed=false;
  car.position.set(centerAt(0),0,0);car.rotation.set(0,0,0);chassis.rotation.set(0,0,0);
  ui.start.classList.add('hidden');ui.end.classList.add('hidden');ui.alert.classList.remove('active');running=true;startAudio();
}
function endGame(won){
  running=false;const best=Math.max(savedBest,Math.floor(distance));localStorage.setItem('saltglass-best',String(best));
  ui.endTitle.innerHTML=won?'LIGHT<br><em>FOUND</em><span class="title-dot">.</span>':'NICE<br><em>DRIVING</em><span class="title-dot">.</span>';
  ui.endKicker.textContent=won?'THE LIGHTHOUSE IS YOURS':'THE LAST LIGHT';
  ui.endCopy.textContent=won?'You threaded the Saltglass Run. The coast is glowing again.':remaining<=0?'Sunset won this round. The lighthouse is just over the horizon.':'The canyon keeps its secrets for another night.';
  ui.resultRelays.textContent=`${pickups.filter(p=>p.found).length} / 4`;ui.resultDistance.textContent=`${Math.floor(distance)} m`;
  ui.end.classList.remove('hidden');tone(won?850:180,.4);
}
ui.startButton.addEventListener('click',resetGame);ui.restart.addEventListener('click',resetGame);

function update(dt){
  if(!running)return;
  elapsed+=dt;remaining=Math.max(0,remaining-dt);
  const left=controls('ArrowLeft')||controls('KeyA'),right=controls('ArrowRight')||controls('KeyD');
  const gas=controls('ArrowUp')||controls('KeyW'),brake=controls('ArrowDown')||controls('KeyS');
  const steer=(right?1:0)-(left?1:0), charging=controls('Space');
  speed+= (gas?14:0)*dt; speed-= (brake?22:0)*dt; speed-= (gas?0:1.9)*dt;
  if(skipTime>0){skipTime=Math.max(0,skipTime-dt);speed=Math.max(speed,27);if(skipTime===0)skipRing.visible=false;}
  speed=THREE.MathUtils.clamp(speed,0,skipTime>0?38:31);
  const p=distance, roadX=centerAt(p);
  let wind=0;
  if(elapsed>=nextGust){gustTime=2.8;nextGust+=15;showToast('CROSSWIND! HOLD YOUR LINE');}
  if(gustTime>0){gustTime=Math.max(0,gustTime-dt);wind=Math.sin(elapsed*9)*7.5;}
  const steerPower=10.4*(.55+speed/40);
  car.position.x+=steer*steerPower*dt+wind*dt;
  // The valley turns beneath you; keep steering to stay centered during gusts.
  const centerDrift=(centerAt(p+speed*dt)-centerAt(p))*1.15;
  car.position.x+=centerDrift;
  distance+=speed*dt;
  car.position.z=-distance;
  const laneOffset=car.position.x-centerAt(distance);
  const outside=Math.abs(laneOffset)>roadWidth/2-.65;
  if(outside){speed=Math.max(4,speed-8*dt);car.position.x-=Math.sign(laneOffset)*Math.min(Math.abs(laneOffset)-(roadWidth/2-.65),4)*dt*1.6;}
  if(charging&&Math.abs(steer)>.1&&speed>11&&skipTime<=0){charge=Math.min(maxCharge,charge+dt*(.58+Math.abs(steer)*.34));}
  if(!charging&&charge>0&&charge<.35)charge=Math.max(0,charge-dt*.3);
  const chargePct=Math.round(charge/maxCharge*100);ui.charge.style.width=`${chargePct}%`;ui.chargeNumber.textContent=`${chargePct}%`;
  if(charge>0){skipRing.visible=true;skipRing.scale.setScalar(1+charge/maxCharge*.75);skipRing.material.opacity=.22+charge/maxCharge*.65;}else if(skipTime<=0)skipRing.visible=false;
  chassis.rotation.z=THREE.MathUtils.damp(chassis.rotation.z,-steer*.13-(wind*.009),6,dt);
  chassis.rotation.y=THREE.MathUtils.damp(chassis.rotation.y,THREE.MathUtils.clamp(steer*.11+centerDrift*.07,-.24,.24),5,dt);
  car.rotation.y=THREE.MathUtils.damp(car.rotation.y,Math.atan((centerAt(distance+4)-centerAt(distance-4))/8),4,dt);
  for(const wheel of wheels)wheel.rotation.x-=speed*dt*1.8;
  if(sfx?.engine){sfx.engine.osc.frequency.setTargetAtTime(47+speed*2.7,sfx.currentTime,.08);sfx.engine.gain.gain.setTargetAtTime(soundOn ? 0.017 : 0,sfx.currentTime,.1);}
  // Collect the four relays along the shoulder-to-shoulder route.
  for(let i=0;i<pickups.length;i++){
    const item=pickups[i];item.group.rotation.y+=dt*1.3;item.gem.rotation.x+=dt*.7;item.group.position.y=1.75+Math.sin(elapsed*2.2+i)*.16;
    if(!item.found&&Math.abs(distance-item.p)<2.7&&Math.abs(car.position.x-item.group.position.x)<2.25){item.found=true;item.group.visible=false;ui.relayIcons[i].classList.add('found');tone(720+i*100,.18);showToast('RELAY SHARD RECOVERED');}
  }
  for(const obstacle of obstacles){
    const {group,p:op,baseX,phase}=obstacle;
    group.position.x=baseX+Math.sin(elapsed*1.5+phase)*1.25;
    group.rotation.x+=dt*2.5;group.rotation.z+=dt*1.1;
    if(!obstacle.hit&&Math.abs(distance-op)<2.1&&Math.abs(car.position.x-group.position.x)<1.9){
      if(skipTime>0){obstacle.hit=true;group.visible=false;tone(310,.09);}
      else{obstacle.hit=true;group.visible=false;speed=Math.max(5,speed-12);hits++;tone(135,.2);showToast('TUMBLEWEED HIT — KEEP MOVING');}
    }
  }
  for(const gate of gates){if(!gate.passed&&distance>=gate.p){gate.passed=true;if(gate.finish){const found=pickups.filter(x=>x.found).length;if(found===4)endGame(true);else{endGame(false);ui.endCopy.textContent=`You reached the lighthouse, but ${4-found} relay shard${4-found===1?' is':'s are'} still dark. Run it back to light the coast.`;}break;}showToast('CHECKPOINT '+Math.round(gate.p)+' M');tone(540,.15);}}
  const untilGust=nextGust-elapsed,alerting=gustTime>0||untilGust<2.8;ui.alert.classList.toggle('active',alerting);
  ui.gustFill.style.width=gustTime>0?`${gustTime/2.8*100}%`:`${(1-untilGust/2.8)*100}%`;
  if(gustTime>0)ui.gustFill.style.width=`${gustTime/2.8*100}%`;
  ui.distance.textContent=Math.max(0,Math.ceil(finishAt-distance)).toLocaleString();
  const progress=THREE.MathUtils.clamp(distance/finishAt,0,1);ui.fill.style.width=`${progress*100}%`;ui.pin.style.left=`${progress*100}%`;
  ui.timer.textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(Math.floor(remaining%60)).padStart(2,'0')}`;
  ui.speed.textContent=String(Math.round(speed*3.6)).padStart(2,'0');
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)ui.toast.classList.remove('show');}
  if(remaining<=0){endGame(false);}
}

const cameraTarget=new THREE.Vector3();
function render(dt){
  const desiredX=car.position.x*.48+centerAt(distance)*.52;
  camera.position.x=THREE.MathUtils.damp(camera.position.x,desiredX,3.8,dt);
  camera.position.y=THREE.MathUtils.damp(camera.position.y,7.4,3,dt);
  camera.position.z=THREE.MathUtils.damp(camera.position.z,car.position.z+14.5,4.2,dt);
  cameraTarget.set(car.position.x*.48+centerAt(distance+17)*.52,1.35,car.position.z-14);
  camera.lookAt(cameraTarget);
  renderer.render(scene,camera);
}
let last=performance.now();
function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);render(dt);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));});
window.addEventListener('load',()=>setTimeout(()=>ui.loading.classList.add('done'),300));
