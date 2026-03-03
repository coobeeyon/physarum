/**
 * NOSTALGIA v22 — DISSOLVING MEMORY
 *
 * The building from v21 but with SHARP dissolution — actual holes in the
 * wall where sky shows through, not smooth opacity variation. Memory doesn't
 * fade uniformly. It leaves gaps. You remember the columns, the shape of the
 * pediment, the warm light from the door. The wall itself? Gone in patches.
 *
 * Changes from v21:
 * - Binary dissolution: wall present or absent (threshold), not smooth opacity
 * - Holes have rough organic edges (erosion noise at boundary)
 * - Upper wall more dissolved than lower (top dissolves first, like real decay)
 * - Portico shadow much darker — real depth between columns and wall
 * - Side walls more solid to frame the ghostly portico area
 * - Columns even thicker, more commanding
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

function fillRect(buf:Float32Array, w:number, h:number, l:number, t:number, r:number, b:number, val:number) {
  for (let y=Math.max(0,Math.floor(t));y<=Math.min(h-1,Math.ceil(b));y++)
    for (let x=Math.max(0,Math.floor(l));x<=Math.min(w-1,Math.ceil(r));x++)
      buf[y*w+x] = Math.max(buf[y*w+x], val)
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
  const opacity = new Float32Array(w * h)
  const brightness = new Float32Array(w * h)
  const glow = new Float32Array(w * h)
  // Dissolution noise — controls where wall has HOLES (binary, not smooth)
  const dissolveN = makeFBM(seed + 1100, 140, 5)  // larger scale = bigger holes
  const dissolveN2 = makeFBM(seed + 1200, 70, 3)  // second layer for variation
  const edgeN = makeNoise(seed + 500, 40)

  const groundY = h * 0.80

  // Ground
  for (let x = 0; x < w; x++) {
    const gv = edgeN(x, groundY) * 5
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) { opacity[y*w+x] = 0.90; brightness[y*w+x] = 0.15 }
    }
  }

  // Sidewalk
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(groundY - h*0.03); y < Math.floor(groundY); y++) {
      if (y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.45)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.50)
      }
    }
  }

  // Distant hazy roofline
  const bgN = makeNoise(seed + 300, 150)
  for (let x = 0; x < w; x++) {
    const roof = h*0.43 + bgN(x,0)*h*0.05 + ((Math.floor(x/(w*0.08))*7+3)%11-5)*h*0.007
    for (let y = Math.max(0,Math.floor(roof)); y < Math.floor(groundY - h*0.04); y++) {
      opacity[y*w+x] = Math.max(opacity[y*w+x], 0.14)
      brightness[y*w+x] = Math.max(brightness[y*w+x], 0.38)
    }
  }

  // ===== BUILDING — based on real Carrollton Courthouse proportions =====
  // The portico (column area) is narrower than the full facade
  // The building extends beyond the columns on both sides
  const porticoL = w * 0.46
  const porticoR = w * 0.88
  const porticoW = porticoR - porticoL
  const porticoCX = (porticoL + porticoR) / 2

  // Full building extends slightly wider than portico
  const bldgL = porticoL - porticoW * 0.15
  const bldgR = porticoR + porticoW * 0.15

  // Building is TALL — spans from well above center to ground
  const corniceY = h * 0.22   // taller than v20's 0.26
  const columnBaseY = groundY - h * 0.02

  // ===== REAR WALL — SHARP dissolution: wall present or GONE =====
  // Memory doesn't fade smoothly. It has gaps. You remember the columns
  // and the pediment outline. The wall between? Patches missing.
  for (let y = Math.floor(corniceY - 5); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(bldgL); x <= Math.ceil(bldgR); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const dn = dissolveN(x, y) * 0.5 + 0.5   // 0 to 1
        const dn2 = dissolveN2(x, y) * 0.5 + 0.5
        const isPortico = x >= porticoL && x <= porticoR

        // Height-dependent dissolution: top dissolves more than bottom
        const heightT = (y - corniceY) / (columnBaseY - corniceY)  // 0=top, 1=bottom
        // More holes near the top, fewer near the base
        const dissolveBias = 0.15 - heightT * 0.25  // positive at top = more dissolution

        // Combined noise determines if wall is PRESENT or ABSENT
        const dissolveVal = (dn * 0.6 + dn2 * 0.4) + dissolveBias

        if (isPortico) {
          // Portico wall: AGGRESSIVELY dissolved — ~40-50% gone
          // Threshold: below = wall GONE (sky shows through), above = wall present
          const threshold = 0.55  // higher = more holes
          if (dissolveVal < threshold) {
            // HOLE — wall is gone here. Sky shows through.
            // Very slight ghost hint at the boundary
            const edgeDist = (threshold - dissolveVal) / 0.15
            if (edgeDist < 1) {
              // Rough edge zone — faint ghost of where wall was
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.12 * (1 - edgeDist))
              brightness[y*w+x] = Math.max(brightness[y*w+x], 0.18)
            }
            // else: fully gone, sky visible
          } else {
            // Wall present — dark recessed surface behind portico
            opacity[y*w+x] = Math.max(opacity[y*w+x], 0.65)
            brightness[y*w+x] = Math.max(brightness[y*w+x], 0.06)  // very dark
          }
        } else {
          // Side walls: more solid, fewer holes
          const threshold = 0.35  // lower threshold = fewer holes
          if (dissolveVal < threshold) {
            const edgeDist = (threshold - dissolveVal) / 0.12
            if (edgeDist < 1) {
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.18 * (1 - edgeDist))
              brightness[y*w+x] = Math.max(brightness[y*w+x], 0.25)
            }
          } else {
            const wallOp = 0.58 + (dissolveVal - threshold) * 0.3
            const sideBr = x < porticoL ? 0.38 : 0.20
            opacity[y*w+x] = Math.max(opacity[y*w+x], Math.min(0.78, wallOp))
            brightness[y*w+x] = Math.max(brightness[y*w+x], sideBr)
          }
        }
      }
    }
  }

  // ===== PEDIMENT — triangular gable above the PORTICO only =====
  const pedimentPeakY = corniceY - porticoW * 0.11
  for (let y = Math.floor(pedimentPeakY); y < Math.floor(corniceY); y++) {
    const t = (y - pedimentPeakY) / (corniceY - pedimentPeakY)
    const hw = (porticoW / 2 + 20) * t
    for (let x = Math.floor(porticoCX - hw); x <= Math.ceil(porticoCX + hw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        // Pediment more solid than walls — the triangular outline persists in memory
        const dn = dissolveN(x, y) * 0.5 + 0.5
        const pedOp = dn < 0.3 ? 0.35 : dn < 0.6 ? 0.55 : 0.70
        opacity[y*w+x] = Math.max(opacity[y*w+x], pedOp)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.40)
      }
    }
  }

  // Entablature — thick horizontal band at column tops
  const entH = h * 0.014
  for (let y = Math.floor(corniceY - entH); y < Math.floor(corniceY + entH); y++) {
    for (let x = Math.floor(bldgL - 10); x <= Math.ceil(bldgR + 10); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.72)
        brightness[y*w+x] = 0.12
      }
    }
  }

  // ===== 4 COLUMNS — colossal Ionic, matching real building =====
  const numColumns = 4
  const colSpacing = porticoW / (numColumns + 1)
  const colWidth = colSpacing * 0.26  // even thicker — commanding presence
  const colTopY = corniceY + entH

  for (let ci = 1; ci <= numColumns; ci++) {
    const colCX = porticoL + ci * colSpacing

    // Column shaft with fluting (vertical grooves)
    for (let y = Math.floor(colTopY); y < Math.floor(columnBaseY); y++) {
      const t = (y - colTopY) / (columnBaseY - colTopY)
      // Classical entasis
      const entasis = 1.0 + 0.06 * Math.sin(t * Math.PI * 0.7)
      const hw = colWidth * entasis

      for (let dx = -Math.ceil(hw + 3); dx <= Math.ceil(hw + 3); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / hw
          if (d < 0.88) {
            // Columns are the MOST opaque — structural bones of memory
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)

            // Fluting — alternating light/dark strips for cylindrical look
            const fluteAngle = (dx / hw) * Math.PI  // -PI to PI across column
            const fluteVal = Math.sin(fluteAngle * 8) * 0.5 + 0.5  // 8 flutes per side
            const fluteBr = 0.35 + fluteVal * 0.35

            // Light direction: golden hour from the left
            const lightBias = dx < 0 ? 0.20 : -0.12  // left side brighter
            brightness[y*w+px] = Math.max(brightness[y*w+px], fluteBr + lightBias)
          } else if (d < 1.0) {
            // Column silhouette edge
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.85)
            brightness[y*w+px] = Math.min(brightness[y*w+px], 0.08)
          }
        }
      }
    }

    // Ionic capital — wider, with volute scrolls suggested by widening
    const capH = h * 0.022
    const capW = colWidth * 2.8  // wider than shaft — Ionic spread
    for (let y = Math.floor(colTopY - capH); y < Math.floor(colTopY + 4); y++) {
      const capT = (y - (colTopY - capH)) / capH
      // Capital widens toward the top, then narrows (scroll profile)
      const widthMult = 1.0 + 0.3 * Math.sin(capT * Math.PI)
      for (let dx = -Math.ceil(capW * widthMult); dx <= Math.ceil(capW * widthMult); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / (capW * widthMult)
          if (d < 1.0) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)
            // Volute suggestion: ends of the capital slightly brighter
            const voluteGlow = d > 0.7 ? (d - 0.7) / 0.3 * 0.15 : 0
            brightness[y*w+px] = Math.max(brightness[y*w+px], 0.52 + voluteGlow)
          }
        }
      }
    }

    // Column base — wider rectangle
    const baseH = h * 0.014
    const baseW = colWidth * 2.0
    for (let y = Math.floor(columnBaseY - baseH); y < Math.floor(columnBaseY); y++) {
      for (let dx = -Math.ceil(baseW); dx <= Math.ceil(baseW); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          opacity[y*w+px] = Math.max(opacity[y*w+px], 0.82)
          brightness[y*w+px] = Math.max(brightness[y*w+px], 0.48)
        }
      }
    }
  }

  // ===== PORTICO DEPTH — dark shadow zone between columns and wall =====
  // This is the key feature of the real building — deep recessed shadow
  for (let ci = 0; ci <= numColumns; ci++) {
    const gapL = ci === 0 ? porticoL + colWidth * 1.5 :
                 porticoL + ci * colSpacing + colWidth * 1.5
    const gapR = ci === numColumns ? porticoR - colWidth * 1.5 :
                 porticoL + (ci + 1) * colSpacing - colWidth * 1.5
    if (gapR <= gapL) continue

    for (let y = Math.floor(colTopY + h*0.02); y < Math.floor(columnBaseY - h*0.01); y++) {
      for (let x = Math.floor(gapL); x <= Math.ceil(gapR); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          // Deep shadow behind columns — the portico void is DARK
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // ===== WINDOWS — warm light from 2 of 3 inter-column bays =====
  const litBays = [true, false, true]  // first and third bays lit
  for (let bi = 0; bi < numColumns - 1; bi++) {
    if (!litBays[bi]) continue
    const wx = porticoL + (bi + 1.5) * colSpacing
    const wy = colTopY + (columnBaseY - colTopY) * 0.20
    const winW2 = colSpacing * 0.12
    const winH2 = (columnBaseY - colTopY) * 0.28
    for (let y = Math.floor(wy); y < Math.floor(wy + winH2); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x < 0 || x >= w) continue
        glow[y*w+x] = 0.90
      }
    }
    // Window halo
    const haloR = winW2 * 6
    for (let dy = -haloR; dy <= haloR; dy++) {
      for (let dx = -haloR; dx <= haloR; dx++) {
        const px = Math.round(wx + dx), py = Math.round(wy + winH2/2 + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const d = Math.sqrt(dx*dx + dy*dy) / haloR
          if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d) * 0.55)
        }
      }
    }
  }

  // ===== DOOR — central warm entrance =====
  const doorCX = porticoCX
  const doorTop = columnBaseY - (columnBaseY - colTopY) * 0.55
  const doorW = colSpacing * 0.16
  for (let y = Math.floor(doorTop); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(doorCX - doorW); x <= Math.ceil(doorCX + doorW); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        glow[y*w+x] = Math.max(glow[y*w+x], 0.65)
      }
    }
  }
  // Fanlight/transom above door (arched window)
  const fanlightCY = doorTop - 8
  const fanlightR = doorW * 1.2
  for (let dy = -fanlightR; dy <= 0; dy++) {
    for (let dx = -fanlightR; dx <= fanlightR; dx++) {
      const d = Math.sqrt(dx*dx + dy*dy)
      if (d < fanlightR) {
        const px = Math.round(doorCX + dx), py = Math.round(fanlightCY + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          glow[py*w+px] = Math.max(glow[py*w+px], 0.50)
        }
      }
    }
  }
  // Door light halo
  const doorHaloR = doorW * 5
  for (let dy = -doorHaloR; dy <= doorHaloR; dy++) {
    for (let dx = -doorHaloR; dx <= doorHaloR; dx++) {
      const px = Math.round(doorCX + dx), py = Math.round(doorTop + (columnBaseY-doorTop)*0.4 + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx*dx + dy*dy) / doorHaloR
        if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d) * 0.40)
      }
    }
  }

  // Steps
  const stepsTop = columnBaseY
  const stepsBot = groundY
  const stepsH = stepsBot - stepsTop
  const numSteps = 5
  for (let si = 0; si < numSteps; si++) {
    const stepT = stepsTop + (stepsH / numSteps) * si
    const stepB = stepsTop + (stepsH / numSteps) * (si + 1)
    const indent = si * porticoW * 0.015
    for (let y = Math.floor(stepT); y < Math.floor(stepB); y++) {
      for (let x = Math.floor(porticoL - indent); x <= Math.ceil(porticoR + indent); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          opacity[y*w+x] = Math.max(opacity[y*w+x], 0.55)
          brightness[y*w+x] = Math.max(brightness[y*w+x], si % 2 === 0 ? 0.48 : 0.38)
        }
      }
    }
  }

  // ===== LIVE OAK — left side, wide spreading canopy =====
  const treeCX = w * 0.18
  const treeBaseY = groundY

  // Trunk — thick, gnarled
  const trunkTopY = h * 0.52
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY - y) / (treeBaseY - trunkTopY)
    const tw = 35 * (1.4 - t * 0.15)
    const lean = t * 8
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX + lean + dx)
      if (px >= 0 && px < w && y >= 0 && y < h) {
        const d = Math.abs(dx) / tw
        if (d < 1) { opacity[y*w+px] = Math.max(opacity[y*w+px], 0.95*(1-d*0.1)); brightness[y*w+px] = Math.min(brightness[y*w+px], 0.04) }
      }
    }
  }

  // Major limbs — wide spreading
  const limbs = [
    { sx: treeCX - 5, sy: trunkTopY, ex: treeCX - w*0.24, ey: h*0.40, t: 22 },
    { sx: treeCX + 5, sy: trunkTopY - 5, ex: treeCX - w*0.18, ey: h*0.30, t: 18 },
    { sx: treeCX, sy: trunkTopY - 10, ex: treeCX - w*0.04, ey: h*0.25, t: 15 },
    { sx: treeCX + 10, sy: trunkTopY, ex: treeCX + w*0.16, ey: h*0.36, t: 20 },
    { sx: treeCX + 8, sy: trunkTopY - 8, ex: treeCX + w*0.12, ey: h*0.28, t: 16 },
  ]
  for (const limb of limbs) {
    const mx = (limb.sx + limb.ex) / 2 + (rand() - 0.5) * 30
    const my = (limb.sy + limb.ey) / 2 - 12 + (rand() - 0.5) * 15
    const pts = sampleBez3(limb.sx, limb.sy, mx, my, limb.ex, limb.ey, 80)
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1), thick = (limb.t * (1 - t * 0.45)) / 2, p = pts[i]
      for (let y = Math.max(0, Math.floor(p.y - thick - 2)); y <= Math.min(h-1, Math.ceil(p.y + thick + 2)); y++) {
        for (let x = Math.max(0, Math.floor(p.x - thick - 2)); x <= Math.min(w-1, Math.ceil(p.x + thick + 2)); x++) {
          const d = Math.sqrt((x-p.x)**2 + (y-p.y)**2)
          if (d < thick) { opacity[y*w+x] = Math.max(opacity[y*w+x], 0.92); brightness[y*w+x] = Math.min(brightness[y*w+x], 0.04) }
          else if (d < thick + 2) { const a = 0.92 * (1 - (d-thick) / 2); opacity[y*w+x] = Math.max(opacity[y*w+x], a) }
        }
      }
    }
  }

  // Canopy — wide dome
  const canopyCX = treeCX
  const canopyCY = h * 0.32
  const canopyRX = w * 0.27
  const canopyRY = h * 0.17
  const canopyEdgeN = makeNoise(seed + 600, 25)
  const canopyGapN = makeNoise(seed + 700, 16)
  const canopyGapN2 = makeNoise(seed + 710, 28)

  for (let y = Math.max(0, Math.floor(canopyCY - canopyRY * 1.4)); y <= Math.min(h-1, Math.ceil(canopyCY + canopyRY * 1.4)); y++) {
    for (let x = Math.max(0, Math.floor(canopyCX - canopyRX * 1.2)); x <= Math.min(w-1, Math.ceil(canopyCX + canopyRX * 1.2)); x++) {
      const dx2 = (x - canopyCX) / canopyRX, dy2 = (y - canopyCY) / canopyRY
      let d = dx2*dx2 + dy2*dy2 + canopyEdgeN(x, y) * 0.28
      if (dy2 > 0.3) {
        const droop = (dy2 - 0.3) * 0.6
        d -= droop * (0.5 + canopyEdgeN(x*2, y) * 0.3)
      }
      if (d < 1.0) {
        const edgeFade = d > 0.65 ? (1 - d) / 0.35 : 1.0
        const gap1 = canopyGapN(x, y) * 0.5 + 0.5
        const gap2 = canopyGapN2(x, y) * 0.5 + 0.5
        const gapThresh = 0.52 + d * 0.25
        if (gap1 > gapThresh && gap2 > 0.45) {
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.08)
        } else {
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.92)
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // Spanish moss
  const mossN = makeNoise(seed + 800, 8)
  for (let i = 0; i < 100; i++) {
    const mx0 = treeCX + (rand() - 0.5) * w * 0.48
    const my0 = h * 0.22 + rand() * h * 0.24
    const mLen = 50 + rand() * 120
    const mW = 3 + rand() * 4
    for (let my = 0; my < mLen; my++) {
      const t = my / mLen
      const sway = mossN(mx0 + i * 77, my0 + my) * 18 * t
      const mx = mx0 + sway, myy = my0 + my
      if (myy >= h) continue
      const op = (1 - t*t) * 0.60
      const mw = mW * (1 - t * 0.4)
      for (let ddx = -Math.ceil(mw); ddx <= Math.ceil(mw); ddx++) {
        const px = Math.round(mx + ddx)
        if (px < 0 || px >= w) continue
        const py = Math.round(myy)
        if (py >= 0 && py < h) {
          const d2 = Math.abs(ddx) / mw
          if (d2 < 1) {
            const v = (1-d2) * op
            opacity[py*w+px] = Math.max(opacity[py*w+px], v)
            brightness[py*w+px] = Math.min(brightness[py*w+px], 0.04)
          }
        }
      }
    }
  }

  // Street lamp
  const lampX = w * 0.36, lampTopY = h * 0.24
  fillBar(opacity, w, h, lampX, lampTopY, lampX, groundY, 6)
  fillBar(opacity, w, h, lampX - 16, lampTopY, lampX + 16, lampTopY, 4)
  fillBar(opacity, w, h, lampX - 12, lampTopY, lampX - 12, lampTopY + 20, 3)
  fillBar(opacity, w, h, lampX + 12, lampTopY, lampX + 12, lampTopY + 20, 3)
  fillBar(opacity, w, h, lampX - 12, lampTopY + 20, lampX + 12, lampTopY + 20, 3)
  // Lamp glow
  const lgR = 90
  for (let dy = -lgR; dy <= lgR; dy++) {
    for (let dx = -lgR; dx <= lgR; dx++) {
      const px = Math.round(lampX + dx), py = Math.round(lampTopY + 12 + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d2 = Math.sqrt(dx*dx + dy*dy) / lgR
        if (d2 < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d2*d2) * 0.55)
      }
    }
  }

  // Power lines — sagging across the sky
  for (const lineY of [h * 0.14, h * 0.17]) {
    for (let s = 0; s <= 400; s++) {
      const t = s / 400, lx = -50 + (w + 100) * t, ly = lineY + 16 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          opacity[py*w+px] = Math.max(opacity[py*w+px], 0.45)
        }
      }
    }
  }

  return { opacity, brightness, glow }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 22001, b: 22002, c: 22003, d: 22004 }
  const seed = seeds[variant] ?? 22001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v22 variant ${variant} (seed: ${seed}) ===`)
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // Sky
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed + 100, 500, 4), cloudFBM = makeFBM(seed + 200, 250, 3)
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
  const {opacity, brightness, glow: glowMap} = buildScene(W, H, seed, rand)
  console.log("  Blurring scene...")
  const opB = gaussianBlur(opacity, W, H, 7)    // slightly tighter than v20
  const brB = gaussianBlur(brightness, W, H, 9)
  const glB = gaussianBlur(glowMap, W, H, 30)   // warm glow spreads

  // Iron
  console.log("  Drawing iron...")
  const ironSil = new Float32Array(W*H)
  const railTop = H*0.50, railBot = H*0.84, railH2 = railBot-railTop, ironT = 9
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
  const imageData = ctx.createImageData(W, H)
  const pixels = imageData.data
  const grainN = makeNoise(seed + 900, 2.5), texN = makeFBM(seed + 950, 30, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y*W+x, i4 = i*4
      const tex = texN(x,y)*0.5+0.5

      let r = skyR[i], g = skyG[i], b = skyB[i]

      // Scene — variable dissolution means sky shows through where wall has gone
      const op = opB[i]
      const br = brB[i]
      if (op > 0.01) {
        const dR = 35 + tex*12, dG = 26 + tex*8, dB = 22 + tex*6
        const aR = 195 + tex*22, aG = 148 + tex*16, aB = 82 + tex*12
        const scR = dR + (aR-dR)*br
        const scG = dG + (aG-dG)*br
        const scB = dB + (aB-dB)*br
        const a = Math.min(1, op)
        r = r*(1-a) + scR*a
        g = g*(1-a) + scG*a
        b = b*(1-a) + scB*a
      }

      // Warm glow from windows and door
      const gl = glB[i]
      if (gl > 0.01) {
        const ga = Math.min(0.80, gl * 0.78)
        r = r + (255-r)*ga
        g = g + (195-g)*ga
        b = b + (90-b)*ga
      }

      // Iron
      const iron = ironSil[i]
      if (iron > 0.01) {
        const a = Math.min(1, iron)
        const it = texN(x*3, y*3)*0.5+0.5
        r = r*(1-a) + (22+it*10)*a
        g = g*(1-a) + (16+it*7)*a
        b = b*(1-a) + (20+it*5)*a
      }

      // Film grain
      const grain = grainN(x,y)*5
      r += grain; g += grain*0.8; b += grain*0.6

      // Warm vignette
      const cx2 = x/W-0.5, cy2 = y/H-0.38
      const vig = 1.0 - (cx2*cx2*0.6 + cy2*cy2*1.0)*0.35
      r *= vig; g *= vig; b *= vig

      pixels[i4] = Math.round(Math.max(0,Math.min(255,r)))
      pixels[i4+1] = Math.round(Math.max(0,Math.min(255,g)))
      pixels[i4+2] = Math.round(Math.max(0,Math.min(255,b)))
      pixels[i4+3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const fn = `output/nostalgia-v22-${variant}.png`
  writeFileSync(fn, canvas.toBuffer("image/png"))
  console.log(`  -> ${fn}`)
}

main()
