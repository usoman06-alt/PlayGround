const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');
let W,H,DPR;function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);mini.width=300;mini.height=300}addEventListener('resize',resize);resize();
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault();if(e.key.toLowerCase()==='r')reset()});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
function reset(){car.x=500;car.y=820;car.a=-Math.PI/2;car.v=0}
const car={x:500,y:820,a:-Math.PI/2,v:0,steer:0};
let running=false,started=false,progress=0,distance=0,sideCount=0,lastDist=Infinity;
function start(){if(started)return;started=true;document.getElementById('menu').classList.add('hidden');let n=3;const cd=document.getElementById('countdown');cd.classList.add('go');cd.textContent=n;let iv=setInterval(()=>{n--;if(n>0)cd.textContent=n;else if(n===0){cd.textContent='BAŞLA';running=true}else{clearInterval(iv);cd.className=''}},800)}
document.getElementById('startBtn').onclick=start;
const checkpoints=[{x:500,y:500},{x:500,y:150},{x:850,y:150},{x:850,y:500},{x:850,y:820},{x:500,y:820}];let cp=0;
const trees=[];for(let i=0;i<420;i++){let x=(Math.random()*1000|0),y=(Math.random()*1000|0);if(!onRoad(x,y))trees.push({x,y,s:12+Math.random()*14,h:25+Math.random()*35})}
function onRoad(x,y){return ((x+15)%180<55)||((y+15)%180<55)}
function worldPoint(wx,wy){let dx=wx-car.x,dy=wy-car.y;let ca=Math.cos(-car.a),sa=Math.sin(-car.a);let rx=dx*ca-dy*sa,ry=dx*sa+dy*ca;return{x:W/2+rx,y:H*.66+ry}}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function draw(){ctx.clearRect(0,0,W,H);let scale=1;
 // sky / world backdrop
let grd=ctx.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#91c8db');grd.addColorStop(.55,'#b5d7b0');grd.addColorStop(1,'#7fa66d');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
 // transform world around car
ctx.save();ctx.translate(W/2,H*.66);ctx.rotate(-car.a);ctx.translate(-car.x,-car.y);
 // terrain grid
ctx.fillStyle='#789b61';ctx.fillRect(-500,-500,2000,2000);
 // fields & patches
for(let gx=-400;gx<1400;gx+=80)for(let gy=-400;gy<1400;gy+=80){let n=Math.sin(gx*13.13+gy*7.7);if(n>.25){ctx.fillStyle=n>.65?'rgba(94,130,74,.55)':'rgba(120,151,86,.28)';ctx.fillRect(gx+5,gy+5,70,70)}}
 // roads
ctx.fillStyle='#35383a';for(let x=-15;x<1100;x+=180)ctx.fillRect(x-27,-500,55,2000);for(let y=-15;y<1100;y+=180)ctx.fillRect(-500,y-27,2000,55);
 // road edges
ctx.strokeStyle='#d1c8ad';ctx.lineWidth=3;ctx.setLineDash([18,22]);for(let x=-15;x<1100;x+=180){ctx.beginPath();ctx.moveTo(x-27,-500);ctx.lineTo(x-27,1500);ctx.moveTo(x+27,-500);ctx.lineTo(x+27,1500);ctx.stroke()}for(let y=-15;y<1100;y+=180){ctx.beginPath();ctx.moveTo(-500,y-27);ctx.lineTo(1500,y-27);ctx.moveTo(-500,y+27);ctx.lineTo(1500,y+27);ctx.stroke()}ctx.setLineDash([]);
 // city blocks
for(let bx=85;bx<1000;bx+=180)for(let by=85;by<1000;by+=180){if((bx+by)%360===170){ctx.fillStyle='#858f88';ctx.fillRect(bx-42,by-42,84,84);ctx.fillStyle='#cbd3c9';ctx.fillRect(bx-34,by-34,68,68);ctx.fillStyle='#55655d';for(let i=-25;i<=25;i+=17){ctx.fillRect(bx+i,by-28,8,56)}}else{ctx.fillStyle='#8fa979';ctx.fillRect(bx-38,by-38,76,76)}}
 // trees
for(const t of trees){let dx=t.x-car.x,dy=t.y-car.y;if(Math.abs(dx)>650||Math.abs(dy)>650)continue;ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(t.x+7,t.y+8,t.s*.9,t.s*.35,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#35552e';ctx.beginPath();ctx.arc(t.x,t.y,t.s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#668c3e';ctx.beginPath();ctx.arc(t.x-t.s*.2,t.y-t.s*.25,t.s*.72,0,Math.PI*2);ctx.fill()}
 // checkpoint arch
const cpP=checkpoints[cp];ctx.strokeStyle='#ff4b93';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(cpP.x-42,cpP.y-35);ctx.lineTo(cpP.x-42,cpP.y+35);ctx.moveTo(cpP.x+42,cpP.y-35);ctx.lineTo(cpP.x+42,cpP.y+35);ctx.moveTo(cpP.x-42,cpP.y-35);ctx.lineTo(cpP.x+42,cpP.y-35);ctx.stroke();
 // car shadow and body
ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(4,7,24,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(-23,-12,8,24);ctx.fillRect(15,-12,8,24);ctx.fillStyle='#d7e6ed';ctx.beginPath();ctx.roundRect(-20,-10,40,20,7);ctx.fill();ctx.fillStyle='#ff4b93';ctx.fillRect(-21,-9,5,18);ctx.fillStyle='#181c22';ctx.beginPath();ctx.roundRect(-5,-8,16,16,4);ctx.fill();ctx.fillStyle='#84a8bb';ctx.fillRect(-3,-7,8,14);ctx.fillStyle='#fff';ctx.fillRect(17,-7,3,5);ctx.fillRect(17,2,3,5);ctx.fillStyle='#8b132f';ctx.fillRect(-20,-7,3,4);ctx.fillRect(-20,3,3,4);ctx.restore();ctx.restore();
}
function update(){if(running){let gas=(keys.w||keys.arrowup)||keys.gas,brake=(keys.s||keys.arrowdown)||keys.brake,left=keys.a||keys.arrowleft||keys.left,right=keys.d||keys.arrowright||keys.right;let roadBonus=onRoad(car.x,car.y)?1:.55;if(gas)car.v+=.018*roadBonus;if(brake)car.v-=.032;if(!gas&&!brake)car.v*=.985;car.v=Math.max(-.16,Math.min(.38,car.v));let steer=(left?-.035:0)+(right?.035:0);car.steer+=((steer-car.steer)*.18);if(Math.abs(car.v)>.01)car.a+=car.steer*(.55+Math.abs(car.v)*2)*(car.v>=0?1:-1);car.x+=Math.cos(car.a)*car.v*60;car.y+=Math.sin(car.a)*car.v*60;car.x=Math.max(-380,Math.min(1380,car.x));car.y=Math.max(-380,Math.min(1380,car.y));let km=Math.round(Math.abs(car.v)*600);document.getElementById('speed').textContent=String(km).padStart(3,'0');document.getElementById('gear').textContent=km<25?'1':km<55?'2':km<85?'3':km<120?'4':'5';let d=Math.hypot(car.x-checkpoints[cp].x,car.y-checkpoints[cp].y);if(d<58){cp=(cp+1)%checkpoints.length;progress=(cp/checkpoints.length)*100;showToast(cp===0?'TURU TAMAMLADIN':'Checkpoint!');}document.getElementById('questBar').style.width=(progress+Math.max(0,(1-d/300)*100/checkpoints.length))+'%';}
draw();drawMini();requestAnimationFrame(update)}
function showToast(t){let e=document.getElementById('toast');e.textContent=t;e.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>e.classList.remove('show'),1400)}
function drawMini(){mctx.clearRect(0,0,300,300);mctx.fillStyle='#263638';mctx.fillRect(0,0,300,300);mctx.save();mctx.translate(150,150);mctx.rotate(-car.a);mctx.scale(.25,.25);mctx.translate(-car.x,-car.y);mctx.fillStyle='#59605d';for(let x=-15;x<1100;x+=180)mctx.fillRect(x-27,-500,54,2000);for(let y=-15;y<1100;y+=180)mctx.fillRect(-500,y-27,2000,54);mctx.strokeStyle='#ff4b93';mctx.lineWidth=12;mctx.beginPath();checkpoints.forEach((p,i)=>i?mctx.lineTo(p.x,p.y):mctx.moveTo(p.x,p.y));mctx.stroke();mctx.restore();mctx.save();mctx.translate(150,150);mctx.rotate(car.a-Math.PI/2);mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(0,-8);mctx.lineTo(6,7);mctx.lineTo(0,4);mctx.lineTo(-6,7);mctx.closePath();mctx.fill();mctx.restore()}
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault()});
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key;const on=e=>{e.preventDefault();keys[k]=true};const off=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
reset();update();