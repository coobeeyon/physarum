/**
 * NOSTALGIA v17 — CLEAN COMPOSITING
 *
 * Key changes from v16:
 * 1. Three-channel scene: opacity (how much sky blocked), brightness (dark↔golden),
 *    glow (additive warm light). No conflicting dark/warm overwrite.
 * 2. Tree as ONE organic shape — wide low canopy noise-blob, not lollipop.
 *    Live oak: short thick trunk, massive horizontal spread, low umbrella canopy.
 * 3. Simpler scene — let the blur do the work. Big shapes, clear tonal separation.
 * 4. Window glow MUCH stronger (visible warm rectangles after blur).
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 1536

function makePRNG(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed: number, scale: number) {
  let s = seed | 0
  const rand = () => { s=(s+0x6d2b79f5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return((t^(t>>>14))>>>0)/4294967296 }
  const SIZE = 256, gradX = new Float32Array(SIZE), gradY = new Float32Array(SIZE)
  for (let i = 0; i < SIZE; i++) { const a = rand()*Math.PI*2; gradX[i]=Math.cos(a); gradY[i]=Math.sin(a) }
  const perm = new Uint16Array(SIZE)
  for (let i = 0; i < SIZE; i++) perm[i] = i
  for (let i = SIZE-1; i > 0; i--) { const j=Math.floor(rand()*(i+1)); [perm[i],perm[j]]=[perm[j],perm[i]] }
  const hash = (x:number,y:number) => perm[(perm[x&(SIZE-1)]+y)&(SIZE-1)]
  const fade = (t:number) => t*t*t*(t*(t*6-15)+10)
  const dot = (gi:number,x:number,y:number) => gradX[gi]*x+gradY[gi]*y
  return (px:number,py:number) => {
    const x=px/scale,y=py/scale, x0=Math.floor(x),y0=Math.floor(y), sx=fade(x-x0),sy=fade(y-y0)
    const n00=dot(hash(x0,y0),x-x0,y-y0), n10=dot(hash(x0+1,y0),x-x0-1,y-y0)
    const n01=dot(hash(x0,y0+1),x-x0,y-y0-1), n11=dot(hash(x0+1,y0+1),x-x0-1,y-y0-1)
    return n00+sx*(n10-n00)+sy*((n01+sx*(n11-n01))-(n00+sx*(n10-n00)))
  }
}

function makeFBM(seed:number,baseScale:number,octaves:number) {
  const noises = Array.from({length:octaves},(_,i)=>makeNoise(seed+i*100,baseScale/(1<<i)))
  return (x:number,y:number) => { let v=0,a=1,ta=0; for(let i=0;i<octaves;i++){v+=noises[i](x,y)*a;ta+=a;a*=0.5} return v/ta }
}

function gaussianBlur(src:Float32Array, w:number, h:number, radius:number) {
  let cur = new Float32Array(src)
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(w*h)
    for (let y=0;y<h;y++){let sum=0,count=0; for(let x=0;x<Math.min(radius,w);x++){sum+=cur[y*w+x];count++} for(let x=0;x<w;x++){if(x+radius<w){sum+=cur[y*w+x+radius];count++} if(x-radius-1>=0){sum-=cur[y*w+x-radius-1];count--} next[y*w+x]=sum/count}}
    const next2 = new Float32Array(w*h)
    for(let x=0;x<w;x++){let sum=0,count=0; for(let y=0;y<Math.min(radius,h);y++){sum+=next[y*w+x];count++} for(let y=0;y<h;y++){if(y+radius<h){sum+=next[(y+radius)*w+x];count++} if(y-radius-1>=0){sum-=next[(y-radius-1)*w+x];count--} next2[y*w+x]=sum/count}}
    cur = next2
  }
  return cur
}

// Simplified drawing utilities
function fillOval(buf:Float32Array, w:number, h:number, cx:number, cy:number, rx:number, ry:number, val:number, noise?:(x:number,y:number)=>number, noiseAmt=0.3) {
  for (let y=Math.max(0,Math.floor(cy-ry*1.3));y<=Math.min(h-1,Math.ceil(cy+ry*1.3));y++) {
    for (let x=Math.max(0,Math.floor(cx-rx*1.3));x<=Math.min(w-1,Math.ceil(cx+rx*1.3));x++) {
      let d=(x-cx)*(x-cx)/(rx*rx)+(y-cy)*(y-cy)/(ry*ry)
      if (noise) d += noise(x,y) * noiseAmt
      if (d<1) {
        const edgeFade = d > 0.7 ? (1-d)/0.3 : 1.0
        buf[y*w+x] = Math.max(buf[y*w+x], val * edgeFade)
      }
    }
  }
}

function fillRect(buf:Float32Array, w:number, h:number, l:number, t:number, r:number, b:number, val:number) {
  for (let y=Math.max(0,Math.floor(t));y<=Math.min(h-1,Math.ceil(b));y++)
    for (let x=Math.max(0,Math.floor(l));x<=Math.min(w-1,Math.ceil(r));x++)
      buf[y*w+x] = Math.max(buf[y*w+x], val)
}

function fillBar(buf:Float32Array, w:number, h:number, x1:number,y1:number,x2:number,y2:number,thick:number,val=1.0) {
  const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy); if(len<0.001)return
  const steps=Math.ceil(len),ht=thick/2
  for(let i=0;i<=steps;i++){const t=i/steps,px=x1+dx*t,py=y1+dy*t
    for(let y=Math.max(0,Math.floor(py-ht-2));y<=Math.min(h-1,Math.ceil(py+ht+2));y++)
      for(let x=Math.max(0,Math.floor(px-ht-2));x<=Math.min(w-1,Math.ceil(px+ht+2));x++){
        const d=Math.sqrt((x-px)**2+(y-py)**2)
        if(d<ht)buf[y*w+x]=Math.max(buf[y*w+x],val)
        else if(d<ht+1.5)buf[y*w+x]=Math.max(buf[y*w+x],val*(1-(d-ht)/1.5))
      }
  }
}

function fillCircle(buf:Float32Array,w:number,h:number,cx:number,cy:number,r:number,val=1.0) {
  for(let y=Math.max(0,Math.floor(cy-r-2));y<=Math.min(h-1,Math.ceil(cy+r+2));y++)
    for(let x=Math.max(0,Math.floor(cx-r-2));x<=Math.min(w-1,Math.ceil(cx+r+2));x++){
      const d=Math.sqrt((x-cx)**2+(y-cy)**2)
      if(d<r)buf[y*w+x]=Math.max(buf[y*w+x],val)
      else if(d<r+1.5)buf[y*w+x]=Math.max(buf[y*w+x],val*(1-(d-r)/1.5))
    }
}

function sampleBez3(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for(let i=0;i<=steps;i++){const t=i/steps,u=1-t; pts.push({x:u*u*p0x+2*u*t*p1x+t*t*p2x,y:u*u*p0y+2*u*t*p1y+t*t*p2y})}
  return pts
}
function sampleBez4(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,p3x:number,p3y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for(let i=0;i<=steps;i++){const t=i/steps,u=1-t; pts.push({x:u*u*u*p0x+3*u*u*t*p1x+3*u*t*t*p2x+t*t*t*p3x,y:u*u*u*p0y+3*u*u*t*p1y+3*u*t*t*p2y+t*t*t*p3y})}
  return pts
}

function drawThickCurve(buf:Float32Array,w:number,h:number,pts:{x:number,y:number}[],t0:number,t1:number,val=1.0) {
  for(let i=0;i<pts.length;i++){const t=pts.length>1?i/(pts.length-1):0,thick=(t0+(t1-t0)*t)/2,p=pts[i]
    for(let y=Math.max(0,Math.floor(p.y-thick-2));y<=Math.min(h-1,Math.ceil(p.y+thick+2));y++)
      for(let x=Math.max(0,Math.floor(p.x-thick-2));x<=Math.min(w-1,Math.ceil(p.x+thick+2));x++){
        const d=Math.sqrt((x-p.x)**2+(y-p.y)**2)
        if(d<thick)buf[y*w+x]=Math.max(buf[y*w+x],val)
        else if(d<thick+1.5)buf[y*w+x]=Math.max(buf[y*w+x],val*(1-(d-thick)/1.5))
      }
  }
}

function drawVolute(buf:Float32Array,w:number,h:number,cx:number,cy:number,startR:number,dir:number,thick:number,turns:number) {
  const pts:{x:number,y:number}[] = []
  const steps = Math.ceil(turns*80)
  for(let i=0;i<=steps;i++){const t=i/steps,angle=t*turns*Math.PI*2,r=startR*(1-t*0.82); pts.push({x:cx+Math.cos(angle*dir)*r,y:cy+Math.sin(angle*dir)*r})}
  drawThickCurve(buf,w,h,pts,thick,thick*0.4)
  fillCircle(buf,w,h,cx,cy,thick*0.9)
}

type PStyle = "lyreA"|"lyreB"|"cScroll"|"heartScroll"|"twoHeart"

function drawPanel(buf:Float32Array,w:number,h:number,left:number,top:number,pw:number,ph:number,style:PStyle,rand:()=>number) {
  const cx=left+pw/2,cy=top+ph/2,ir=8
  fillBar(buf,w,h,cx,top+ph*0.03,cx,top+ph*0.97,ir*0.85)
  if(style==="lyreA"||style==="lyreB"){
    const sp=style==="lyreA"?0.42:0.36, bu=style==="lyreA"?0.48:0.44
    for(const m of [-1,1]){
      drawThickCurve(buf,w,h,sampleBez4(cx,top+ph*0.08,cx+m*pw*sp,top+ph*0.15,cx+m*pw*bu,top+ph*0.55,cx,top+ph*0.92,120),ir*1.1,ir*0.6)
      drawThickCurve(buf,w,h,sampleBez4(cx,top+ph*0.18,cx+m*pw*(sp-0.12),top+ph*0.22,cx+m*pw*(bu-0.14),top+ph*0.50,cx,top+ph*0.82,80),ir*0.55,ir*0.35)
      drawVolute(buf,w,h,cx+m*pw*bu*0.65,cy-ph*0.05,14+rand()*6,m,ir*0.45,1.1)
      drawVolute(buf,w,h,cx+m*pw*bu*0.65,cy+ph*0.12,12+rand()*5,-m,ir*0.4,1.0)
    }
    fillCircle(buf,w,h,cx,top+ph*0.08,ir*1.2); fillCircle(buf,w,h,cx,top+ph*0.92,ir*1.2)
  } else if(style==="cScroll"){
    for(const m of [-1,1]){
      drawThickCurve(buf,w,h,sampleBez4(cx,top+ph*0.12,cx+m*pw*0.38,top+ph*0.05,cx+m*pw*0.42,top+ph*0.30,cx+m*pw*0.12,top+ph*0.42,120),ir*1.2,ir*0.65)
      drawVolute(buf,w,h,cx+m*pw*0.12,top+ph*0.42+8,18+rand()*6,m,ir*0.55,1.2+rand()*0.3)
      drawThickCurve(buf,w,h,sampleBez4(cx,top+ph*0.88,cx+m*pw*0.38,top+ph*0.95,cx+m*pw*0.42,top+ph*0.70,cx+m*pw*0.12,top+ph*0.58,120),ir*1.2,ir*0.65)
      drawVolute(buf,w,h,cx+m*pw*0.12,top+ph*0.58-8,18+rand()*6,-m,ir*0.55,1.2+rand()*0.3)
      drawThickCurve(buf,w,h,sampleBez4(cx+m*pw*0.38,top+ph*0.22,cx+m*pw*0.44,top+ph*0.38,cx+m*pw*0.44,top+ph*0.62,cx+m*pw*0.38,top+ph*0.78,80),ir*0.7,ir*0.7)
    }
    fillCircle(buf,w,h,cx,cy,ir*1.8)
  } else if(style==="heartScroll"){
    for(const m of [-1,1]){
      drawThickCurve(buf,w,h,sampleBez4(cx,top+ph*0.12,cx+m*pw*0.50,top-ph*0.05,cx+m*pw*0.46,top+ph*0.65,cx,top+ph*0.88,120),ir*1.1,ir*0.6)
      drawThickCurve(buf,w,h,sampleBez3(cx+m*pw*0.32,top+ph*0.30,cx+m*pw*0.15,top+ph*0.40,cx+m*pw*0.10,top+ph*0.55,60),ir*0.5,ir*0.3)
      drawVolute(buf,w,h,cx+m*pw*0.10,top+ph*0.55,10+rand()*4,m,ir*0.35,0.9)
    }
    fillCircle(buf,w,h,cx,top+ph*0.12,ir*1.0); fillCircle(buf,w,h,cx,top+ph*0.88,ir*1.0)
  } else {
    for(const yo of [0.0,0.48]){const st=top+ph*(yo+0.04),sh=ph*0.44
      for(const m of [-1,1]){
        drawThickCurve(buf,w,h,sampleBez4(cx,st+sh*0.10,cx+m*pw*0.44,st-sh*0.08,cx+m*pw*0.40,st+sh*0.70,cx,st+sh*0.90,80),ir*0.9,ir*0.5)
        drawVolute(buf,w,h,cx+m*pw*0.25,st+sh*0.45,10,m,ir*0.35,0.8)
      }
      fillCircle(buf,w,h,cx,st+sh*0.10,ir*0.8); fillCircle(buf,w,h,cx,st+sh*0.90,ir*0.8)
    }
  }
}

function buildScene(w:number, h:number, seed:number, rand:()=>number) {
  // opacity: how much this pixel blocks sky (0=transparent, 1=opaque)
  // brightness: how bright the scene element is (0=dark silhouette, 1=golden-lit)
  // glow: additive warm light
  const opacity = new Float32Array(w * h)
  const brightness = new Float32Array(w * h)
  const glow = new Float32Array(w * h)

  const groundY = h * 0.80
  const edgeN = makeNoise(seed + 500, 40)

  // Ground
  for (let x = 0; x < w; x++) {
    const gv = edgeN(x, groundY) * 5
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) { opacity[y*w+x] = 0.90; brightness[y*w+x] = 0.15 }
    }
  }

  // Sidewalk
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(groundY - h*0.025); y < Math.floor(groundY); y++) {
      if (y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.45)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.55)  // catches golden light
      }
    }
  }

  // Distant hazy roofline
  const bgN = makeNoise(seed + 300, 150)
  for (let x = 0; x < w; x++) {
    const roof = h*0.43 + bgN(x,0)*h*0.05 + ((Math.floor(x/(w*0.08))*7+3)%11-5)*h*0.007
    for (let y = Math.max(0,Math.floor(roof)); y < Math.floor(groundY - h*0.03); y++) {
      opacity[y*w+x] = Math.max(opacity[y*w+x], 0.18)
      brightness[y*w+x] = Math.max(brightness[y*w+x], 0.40)  // warm haze
    }
  }

  // ===== SHOTGUN HOUSE — warm-lit building =====
  const houseL = w*0.52, houseR = w*0.88
  const houseWall = h*0.37, porchRoof = h*0.33

  // Wall — BRIGHT golden amber (catching evening light)
  for (let y = Math.floor(houseWall); y < Math.floor(groundY); y++) {
    for (let x = Math.floor(houseL); x <= Math.ceil(houseR); x++) {
      if (x>=0&&x<w) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.72)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.50)  // warm but not too bright — let window glow pop
      }
    }
  }

  // Porch ceiling/overhang — darker
  const overhang = w * 0.035
  for (let y = Math.floor(porchRoof+5); y < Math.floor(houseWall+5); y++) {
    for (let x = Math.floor(houseL-overhang); x <= Math.ceil(houseR+overhang*0.5); x++) {
      if (x>=0&&x<w) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.75)
        brightness[y*w+x] = 0.15  // dark under roof
      }
    }
  }

  // Roof edge (dark line)
  for (let x = Math.floor(houseL-overhang); x <= Math.ceil(houseR+overhang*0.5); x++) {
    for (let dy = 0; dy < 8; dy++) {
      const py = Math.floor(porchRoof+dy)
      if (x>=0&&x<w&&py>=0&&py<h) { opacity[py*w+x] = Math.max(opacity[py*w+x], 0.82); brightness[py*w+x] = 0.05 }
    }
  }

  // Gable
  const peakX = (houseL+houseR)/2, peakY = porchRoof-(houseR-houseL)*0.08
  for (let y = Math.floor(peakY); y < Math.floor(porchRoof); y++) {
    const t = (y-peakY)/(porchRoof-peakY), hw = ((houseR-houseL)/2+15)*t
    for (let x = Math.floor(peakX-hw); x <= Math.ceil(peakX+hw); x++) {
      if (x>=0&&x<w) { opacity[y*w+x] = Math.max(opacity[y*w+x], 0.75); brightness[y*w+x] = Math.max(brightness[y*w+x], 0.20) }
    }
  }

  // Porch columns
  for (let ci = 0; ci < 3; ci++) {
    const colX = houseL + (houseR-houseL) * (0.12 + ci*0.35)
    for (let y = Math.floor(porchRoof); y < Math.floor(groundY); y++) {
      for (let dx = -7; dx <= 7; dx++) {
        const px = Math.round(colX+dx)
        if (px>=0&&px<w&&y>=0&&y<h) { opacity[y*w+px] = Math.max(opacity[y*w+px], 0.80); brightness[y*w+px] = Math.min(brightness[y*w+px], 0.10) }
      }
    }
  }

  // Door (dark)
  const doorX = houseL+(houseR-houseL)*0.35, doorW2 = (houseR-houseL)*0.06
  const doorTop = groundY - (groundY-houseWall)*0.68
  fillRect(opacity, w, h, doorX-doorW2, doorTop, doorX+doorW2, groundY-5, 0.85)
  // Don't set brightness — door is dark

  // Windows — VERY BRIGHT GLOW
  const winW2 = (houseR-houseL)*0.05, winH2 = (groundY-houseWall)*0.26
  for (let wi = 0; wi < 3; wi++) {
    const wx = houseL + (houseR-houseL)*(0.15+wi*0.28)
    const wy = houseWall + (groundY-houseWall)*0.20
    // Window itself — bright
    for (let y = Math.floor(wy); y < Math.floor(wy+winH2); y++) {
      if (y<0||y>=h) continue
      for (let x = Math.floor(wx-winW2); x <= Math.ceil(wx+winW2); x++) {
        if (x<0||x>=w) continue
        glow[y*w+x] = 1.0  // maximum glow
      }
    }
    // Halo around each window
    const haloR = winW2 * 6  // bigger halo for more visible warm glow
    for (let dy = -haloR; dy <= haloR; dy++) {
      for (let dx = -haloR; dx <= haloR; dx++) {
        const px = Math.round(wx+dx), py = Math.round(wy+winH2/2+dy)
        if (px>=0&&px<w&&py>=0&&py<h) {
          const d = Math.sqrt(dx*dx+dy*dy)/haloR
          if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d)*0.70)  // stronger halo
        }
      }
    }
  }

  // Porch light
  const plX = doorX + doorW2*3, plY = porchRoof + (houseWall-porchRoof)*0.35, plR = 70
  for (let dy = -plR; dy <= plR; dy++) {
    for (let dx = -plR; dx <= plR; dx++) {
      const px = Math.round(plX+dx), py = Math.round(plY+dy)
      if (px>=0&&px<w&&py>=0&&py<h) {
        const d = Math.sqrt(dx*dx+dy*dy)/plR
        if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d)*0.75)
      }
    }
  }

  // ===== LIVE OAK — wide low dome, not lollipop =====
  // A live oak from across the street at dusk: thick short base, massive
  // horizontal spread, canopy wider than tall, sometimes touching ground.
  const treeCX = w * 0.28
  const treeBaseY = groundY

  // Trunk — VERY SHORT (live oaks fork low)
  const trunkTopY = h * 0.58  // fork point much lower — short visible trunk
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY-y)/(treeBaseY-trunkTopY)
    const tw = 35 * (1.5 - t*0.2)  // VERY THICK
    const lean = t * 8
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX+lean+dx)
      if (px>=0&&px<w&&y>=0&&y<h) {
        const d = Math.abs(dx)/tw
        if (d < 1) { opacity[y*w+px] = Math.max(opacity[y*w+px], 0.95*(1-d*0.1)); brightness[y*w+px] = Math.min(brightness[y*w+px], 0.05) }
      }
    }
  }

  // Major limbs — thick, nearly horizontal, starting from LOW fork point
  // These limbs extend nearly horizontally and the canopy sits ON them
  const limbs = [
    { sx: treeCX-5, sy: trunkTopY, ex: treeCX - w*0.32, ey: h*0.42, t: 24 },   // far left, slightly drooping
    { sx: treeCX+5, sy: trunkTopY-5, ex: treeCX - w*0.25, ey: h*0.34, t: 20 },  // mid left, higher
    { sx: treeCX, sy: trunkTopY-10, ex: treeCX - w*0.10, ey: h*0.28, t: 16 },    // up-left
    { sx: treeCX+10, sy: trunkTopY, ex: treeCX + w*0.20, ey: h*0.40, t: 22 },    // right
    { sx: treeCX+8, sy: trunkTopY-8, ex: treeCX + w*0.15, ey: h*0.30, t: 16 },   // upper right
  ]
  for (const limb of limbs) {
    const mx = (limb.sx+limb.ex)/2 + (rand()-0.5)*40
    const my = (limb.sy+limb.ey)/2 - 15 + (rand()-0.5)*20
    const pts = sampleBez3(limb.sx, limb.sy, mx, my, limb.ex, limb.ey, 80)
    for (let i = 0; i < pts.length; i++) {
      const t = i/(pts.length-1), thick = (limb.t * (1-t*0.45))/2, p = pts[i]
      for (let y = Math.max(0,Math.floor(p.y-thick-2)); y <= Math.min(h-1,Math.ceil(p.y+thick+2)); y++) {
        for (let x = Math.max(0,Math.floor(p.x-thick-2)); x <= Math.min(w-1,Math.ceil(p.x+thick+2)); x++) {
          const d = Math.sqrt((x-p.x)**2+(y-p.y)**2)
          if (d < thick) { opacity[y*w+x] = Math.max(opacity[y*w+x], 0.92); brightness[y*w+x] = Math.min(brightness[y*w+x], 0.05) }
          else if (d < thick+2) { const a = 0.92*(1-(d-thick)/2); opacity[y*w+x] = Math.max(opacity[y*w+x], a) }
        }
      }
    }
  }

  // Canopy — ONE massive wide, low dome centered at the limb level
  // Live oak canopy: width >> height, sits LOW on the thick limbs
  // The canopy should OVERLAP with the limbs and trunk top
  const canopyCX = treeCX - w*0.02
  const canopyCY = h * 0.35  // centered at limb level, NOT floating above
  const canopyRX = w * 0.36  // VERY wide — wider than the canvas third
  const canopyRY = h * 0.20  // taller to cover from h*0.15 to h*0.55

  const canopyEdgeN = makeNoise(seed + 600, 25)
  const canopyGapN = makeNoise(seed + 700, 16)
  const canopyGapN2 = makeNoise(seed + 710, 28)

  for (let y = Math.max(0,Math.floor(canopyCY-canopyRY*1.4)); y <= Math.min(h-1,Math.ceil(canopyCY+canopyRY*1.4)); y++) {
    for (let x = Math.max(0,Math.floor(canopyCX-canopyRX*1.2)); x <= Math.min(w-1,Math.ceil(canopyCX+canopyRX*1.2)); x++) {
      const dx = (x-canopyCX)/canopyRX, dy = (y-canopyCY)/canopyRY
      // Base distance with noise-warped edge
      let d = dx*dx + dy*dy + canopyEdgeN(x,y)*0.28

      // Extra drooping at the bottom edges (live oak canopy droops)
      if (dy > 0.3) {
        const droop = (dy-0.3)*0.6
        d -= droop * (0.5 + canopyEdgeN(x*2, y)*0.3) // extends downward irregularly
      }

      if (d < 1.0) {
        const edgeFade = d > 0.65 ? (1-d)/0.35 : 1.0

        // Sky gaps (holes in canopy where light comes through)
        const gap1 = canopyGapN(x,y)*0.5+0.5
        const gap2 = canopyGapN2(x,y)*0.5+0.5
        const gapThresh = 0.52 + d * 0.25  // more gaps near edges

        if (gap1 > gapThresh && gap2 > 0.45) {
          // Sky gap — very thin canopy, some sky shows through
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.08)
        } else {
          // Dense canopy — dark silhouette
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.92)
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // Spanish moss — thick, heavy, long strands
  const mossN = makeNoise(seed + 800, 8)
  for (let i = 0; i < 160; i++) {
    const mx0 = treeCX + (rand()-0.5)*w*0.65
    const my0 = h*0.22 + rand()*h*0.28  // hang from lower canopy
    const mLen = 60 + rand()*150
    const mW = 3 + rand()*5
    for (let my = 0; my < mLen; my++) {
      const t = my/mLen
      const sway = mossN(mx0+i*77, my0+my) * 20 * t
      const mx = mx0+sway, myy = my0+my
      if (myy >= h) continue
      const op = (1-t*t)*0.70
      const mw = mW*(1-t*0.4)
      for (let ddx = -Math.ceil(mw); ddx <= Math.ceil(mw); ddx++) {
        const px = Math.round(mx+ddx)
        if (px<0||px>=w) continue
        const py = Math.round(myy)
        if (py>=0&&py<h) {
          const d2 = Math.abs(ddx)/mw
          if (d2<1) {
            const v = (1-d2)*op
            opacity[py*w+px] = Math.max(opacity[py*w+px], v)
            brightness[py*w+px] = Math.min(brightness[py*w+px], 0.04)
          }
        }
      }
    }
  }

  // Street lamp
  const lampX = w*0.48, lampTopY = h*0.28
  fillBar(opacity, w, h, lampX, lampTopY, lampX, groundY, 7)
  fillBar(opacity, w, h, lampX-22, lampTopY, lampX+22, lampTopY, 5)
  fillBar(opacity, w, h, lampX-18, lampTopY, lampX-18, lampTopY+26, 4)
  fillBar(opacity, w, h, lampX+18, lampTopY, lampX+18, lampTopY+26, 4)
  fillBar(opacity, w, h, lampX-18, lampTopY+26, lampX+18, lampTopY+26, 4)

  // Lamp glow — BIG and warm
  const lgR = 120
  for (let dy = -lgR; dy <= lgR; dy++) {
    for (let dx = -lgR; dx <= lgR; dx++) {
      const px = Math.round(lampX+dx), py = Math.round(lampTopY+13+dy)
      if (px>=0&&px<w&&py>=0&&py<h) {
        const d2 = Math.sqrt(dx*dx+dy*dy)/lgR
        if (d2 < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d2*d2)*0.85)
      }
    }
  }

  // Lamp pool on ground
  for (let dy = -60; dy <= 60; dy++) {
    for (let dx = -180; dx <= 180; dx++) {
      const px = Math.round(lampX+dx), py = Math.round(groundY-10+dy*0.3)
      if (px>=0&&px<w&&py>=0&&py<h) {
        const d2 = Math.sqrt((dx/180)**2+(dy/60)**2)
        if (d2 < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d2*d2)*0.30)
      }
    }
  }

  // Power lines
  for (const lineY of [h*0.155, h*0.18]) {
    for (let s=0;s<=400;s++){const t=s/400,lx=-50+(w+100)*t,ly=lineY+18*Math.sin(t*Math.PI)
      for(let dy=-1;dy<=1;dy++){const px=Math.round(lx),py=Math.round(ly+dy)
        if(px>=0&&px<w&&py>=0&&py<h){opacity[py*w+px]=Math.max(opacity[py*w+px],0.50)}
      }
    }
  }

  return { opacity, brightness, glow }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string,number> = { a: 17001, b: 17002, c: 17003, d: 17004 }
  const seed = seeds[variant] ?? 17001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v17 variant ${variant} (seed: ${seed}) ===`)
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // Sky
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed+100,500,4), cloudFBM = makeFBM(seed+200,250,3)
  const skyR = new Float32Array(W*H), skyG = new Float32Array(W*H), skyB = new Float32Array(W*H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y*W+x, t = y/H
      const sn = skyFBM(x,y)*0.5+0.5, cn = cloudFBM(x,y)*0.5+0.5
      let r:number,g:number,b:number
      if(t<0.08){const s=t/0.08;r=150+s*50;g=70+s*45;b=35+s*20}
      else if(t<0.25){const s=(t-0.08)/0.17;r=200+s*45;g=115+s*55;b=55+s*38}
      else if(t<0.48){const s=(t-0.25)/0.23;r=245+s*8;g=170+s*45;b=93+s*30}
      else if(t<0.70){const s=(t-0.48)/0.22;r=253-s*12;g=215-s*25;b=123-s*15}
      else{const s=(t-0.70)/0.30;r=241-s*70;g=190-s*60;b=108-s*35}
      if(cn>0.42){const ca=Math.min(0.28,(cn-0.42)/0.35),glw=Math.max(0,1-Math.abs(t-0.35)*2.5);r+=ca*(22+glw*18);g+=ca*(16+glw*14);b+=ca*(9+glw*8)}
      r+=(sn-0.5)*7;g+=(sn-0.5)*5;b+=(sn-0.5)*3
      skyR[i]=r;skyG[i]=g;skyB[i]=b
    }
  }

  // Scene
  console.log("  Building scene...")
  const {opacity,brightness,glow:glowMap} = buildScene(W,H,seed,rand)
  console.log("  Blurring scene...")
  const opB = gaussianBlur(opacity,W,H,8)
  const brB = gaussianBlur(brightness,W,H,10)
  const glB = gaussianBlur(glowMap,W,H,18)

  // Iron
  console.log("  Drawing iron...")
  const ironSil = new Float32Array(W*H)
  const railTop = H*0.48, railBot = H*0.84, railH2 = railBot-railTop, ironT = 9
  fillBar(ironSil,W,H,-10,railTop,W+10,railTop,ironT*2.5)
  fillBar(ironSil,W,H,-10,railBot,W+10,railBot,ironT*2.5)
  const nP=5,pW=(W+80)/nP,pSX=-40
  const styles:PStyle[] = ["lyreA","cScroll","heartScroll","lyreB","twoHeart"]
  for(let i=0;i<=nP;i++) fillBar(ironSil,W,H,pSX+i*pW,railTop-10,pSX+i*pW,railBot+10,ironT*1.6)
  console.log("  Drawing scrollwork...")
  for(let i=0;i<nP;i++){
    const pL=pSX+i*pW+ironT*3,pWi=pW-ironT*6,pR=makePRNG(seed+2000+i*131)
    drawPanel(ironSil,W,H,pL,railTop+ironT*3.5,pWi,railH2-ironT*7,styles[i%5],()=>pR())
  }
  for(let i=0;i<=nP;i++){
    const fx=pSX+i*pW
    fillBar(ironSil,W,H,fx,railTop-35,fx,railTop,ironT*0.8)
    for(let dy=-14;dy<=0;dy++){const p=-dy/14,hw=(1-p)*8+p*2
      for(let dx=-Math.ceil(hw);dx<=Math.ceil(hw);dx++){const px=Math.round(fx+dx),py=Math.round(railTop-35+dy)
        if(px>=0&&px<W&&py>=0&&py<H)ironSil[py*W+px]=Math.max(ironSil[py*W+px],1.0)}}
    fillCircle(ironSil,W,H,fx,railTop-37,ironT*0.5)
  }
  for(let y=Math.floor(railBot+ironT*2.5);y<H;y++) for(let x=0;x<W;x++) ironSil[y*W+x]=Math.max(ironSil[y*W+x],1.0)

  // Composite
  console.log("  Compositing...")
  const imageData = ctx.createImageData(W,H)
  const pixels = imageData.data
  const grainN = makeNoise(seed+900,2.5), texN = makeFBM(seed+950,30,3)

  // Dark brown and golden amber color endpoints for scene
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y*W+x, i4 = i*4
      const tex = texN(x,y)*0.5+0.5

      // Start with sky
      let r = skyR[i], g = skyG[i], b = skyB[i]

      // Scene: lerp between dark-brown and golden-amber based on brightness
      const op = opB[i]
      const br = brB[i]
      if (op > 0.01) {
        // Dark brown (silhouette)
        const dR = 38 + tex*10, dG = 28 + tex*7, dB = 25 + tex*5
        // Golden amber (lit surface)
        const aR = 195 + tex*20, aG = 145 + tex*15, aB = 78 + tex*10
        // Lerp based on brightness
        const scR = dR + (aR-dR)*br
        const scG = dG + (aG-dG)*br
        const scB = dB + (aB-dB)*br
        // Blend scene over sky based on opacity
        const a = Math.min(1, op)
        r = r*(1-a) + scR*a
        g = g*(1-a) + scG*a
        b = b*(1-a) + scB*a
      }

      // Glow (additive warm light)
      const gl = glB[i]
      if (gl > 0.01) {
        const ga = Math.min(0.88, gl * 0.85)
        r = r + (255-r)*ga
        g = g + (200-g)*ga
        b = b + (100-b)*ga
      }

      // Iron
      const iron = ironSil[i]
      if (iron > 0.01) {
        const a = Math.min(1,iron)
        const it = texN(x*3,y*3)*0.5+0.5
        r = r*(1-a) + (25+it*12)*a
        g = g*(1-a) + (18+it*8)*a
        b = b*(1-a) + (22+it*6)*a
      }

      // Film grain
      const grain = grainN(x,y)*5
      r+=grain; g+=grain*0.8; b+=grain*0.6

      // Warm vignette
      const cx2=x/W-0.5, cy2=y/H-0.38
      const vig = 1.0-(cx2*cx2*0.6+cy2*cy2*1.0)*0.35
      r*=vig; g*=vig; b*=vig

      pixels[i4] = Math.round(Math.max(0,Math.min(255,r)))
      pixels[i4+1] = Math.round(Math.max(0,Math.min(255,g)))
      pixels[i4+2] = Math.round(Math.max(0,Math.min(255,b)))
      pixels[i4+3] = 255
    }
  }

  ctx.putImageData(imageData,0,0)
  const fn = `output/nostalgia-v17-${variant}.png`
  writeFileSync(fn, canvas.toBuffer("image/png"))
  console.log(`  -> ${fn}`)
}

main()
