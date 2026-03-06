/**
 * NOSTALGIA v23 — CORRECT IRON, BIGGER BUILDING
 *
 * Fixes from v22 based on studying the actual Ben Franklin HS photo:
 * 1. Iron fence is SIMPLE vertical pickets with spear-point finials — not ornate scrollwork
 *    The real fence is functional iron, not Art Nouveau decoration
 * 2. Iron takes up bottom 20-25% of frame, not 40% — the building is the subject
 * 3. Building is LARGER and LESS BLURRED — recognizable as institutional, not a vague shape
 * 4. Live oak canopy wider and more horizontal (spreading, not round)
 * 5. Same sharp dissolution concept — golden sky through wall holes
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

function sampleBez3(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for(let i=0;i<=steps;i++){const t=i/steps,u=1-t; pts.push({x:u*u*p0x+2*u*t*p1x+t*t*p2x,y:u*u*p0y+2*u*t*p1y+t*t*p2y})}
  return pts
}

function buildScene(w:number, h:number, seed:number, rand:()=>number) {
  const opacity = new Float32Array(w * h)
  const brightness = new Float32Array(w * h)
  const glow = new Float32Array(w * h)
  const dissolveN = makeFBM(seed + 1100, 160, 5)
  const dissolveN2 = makeFBM(seed + 1200, 80, 3)
  const edgeN = makeNoise(seed + 500, 40)

  const groundY = h * 0.82  // slightly lower ground — more sky, more building

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
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.40)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.48)
      }
    }
  }

  // Distant hazy roofline — very subtle
  const bgN = makeNoise(seed + 300, 150)
  for (let x = 0; x < w; x++) {
    const roof = h*0.48 + bgN(x,0)*h*0.04
    for (let y = Math.max(0,Math.floor(roof)); y < Math.floor(groundY - h*0.04); y++) {
      opacity[y*w+x] = Math.max(opacity[y*w+x], 0.10)
      brightness[y*w+x] = Math.max(brightness[y*w+x], 0.35)
    }
  }

  // ===== BUILDING — larger, more prominent =====
  // Building is positioned right-of-center, large enough to dominate
  const porticoL = w * 0.40
  const porticoR = w * 0.88
  const porticoW = porticoR - porticoL
  const porticoCX = (porticoL + porticoR) / 2

  const bldgL = porticoL - porticoW * 0.12
  const bldgR = porticoR + porticoW * 0.12

  // Building taller — reaches higher into the sky
  const corniceY = h * 0.18
  const columnBaseY = groundY - h * 0.015

  // ===== REAR WALL with sharp dissolution =====
  for (let y = Math.floor(corniceY - 5); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(bldgL); x <= Math.ceil(bldgR); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const dn = dissolveN(x, y) * 0.5 + 0.5
        const dn2 = dissolveN2(x, y) * 0.5 + 0.5
        const isPortico = x >= porticoL && x <= porticoR

        const heightT = (y - corniceY) / (columnBaseY - corniceY)
        const dissolveBias = 0.18 - heightT * 0.30

        const dissolveVal = (dn * 0.6 + dn2 * 0.4) + dissolveBias

        if (isPortico) {
          const threshold = 0.52
          if (dissolveVal < threshold) {
            const edgeDist = (threshold - dissolveVal) / 0.15
            if (edgeDist < 1) {
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.10 * (1 - edgeDist))
              brightness[y*w+x] = Math.max(brightness[y*w+x], 0.15)
            }
          } else {
            opacity[y*w+x] = Math.max(opacity[y*w+x], 0.60)
            brightness[y*w+x] = Math.max(brightness[y*w+x], 0.05)
          }
        } else {
          const threshold = 0.38
          if (dissolveVal < threshold) {
            const edgeDist = (threshold - dissolveVal) / 0.12
            if (edgeDist < 1) {
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.15 * (1 - edgeDist))
              brightness[y*w+x] = Math.max(brightness[y*w+x], 0.22)
            }
          } else {
            const wallOp = 0.55 + (dissolveVal - threshold) * 0.3
            const sideBr = x < porticoL ? 0.36 : 0.18
            opacity[y*w+x] = Math.max(opacity[y*w+x], Math.min(0.75, wallOp))
            brightness[y*w+x] = Math.max(brightness[y*w+x], sideBr)
          }
        }
      }
    }
  }

  // ===== PEDIMENT =====
  const pedimentPeakY = corniceY - porticoW * 0.10
  for (let y = Math.floor(pedimentPeakY); y < Math.floor(corniceY); y++) {
    const t = (y - pedimentPeakY) / (corniceY - pedimentPeakY)
    const hw = (porticoW / 2 + 20) * t
    for (let x = Math.floor(porticoCX - hw); x <= Math.ceil(porticoCX + hw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const dn = dissolveN(x, y) * 0.5 + 0.5
        const pedOp = dn < 0.3 ? 0.30 : dn < 0.6 ? 0.50 : 0.65
        opacity[y*w+x] = Math.max(opacity[y*w+x], pedOp)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.38)
      }
    }
  }

  // Entablature
  const entH = h * 0.012
  for (let y = Math.floor(corniceY - entH); y < Math.floor(corniceY + entH); y++) {
    for (let x = Math.floor(bldgL - 10); x <= Math.ceil(bldgR + 10); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.70)
        brightness[y*w+x] = 0.10
      }
    }
  }

  // ===== 4 COLUMNS =====
  const numColumns = 4
  const colSpacing = porticoW / (numColumns + 1)
  const colWidth = colSpacing * 0.24
  const colTopY = corniceY + entH

  for (let ci = 1; ci <= numColumns; ci++) {
    const colCX = porticoL + ci * colSpacing

    for (let y = Math.floor(colTopY); y < Math.floor(columnBaseY); y++) {
      const t = (y - colTopY) / (columnBaseY - colTopY)
      const entasis = 1.0 + 0.05 * Math.sin(t * Math.PI * 0.7)
      const hw = colWidth * entasis

      for (let dx = -Math.ceil(hw + 3); dx <= Math.ceil(hw + 3); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / hw
          if (d < 0.88) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.90)
            const fluteAngle = (dx / hw) * Math.PI
            const fluteVal = Math.sin(fluteAngle * 8) * 0.5 + 0.5
            const fluteBr = 0.32 + fluteVal * 0.38
            const lightBias = dx < 0 ? 0.18 : -0.10
            brightness[y*w+px] = Math.max(brightness[y*w+px], fluteBr + lightBias)
          } else if (d < 1.0) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)
            brightness[y*w+px] = Math.min(brightness[y*w+px], 0.06)
          }
        }
      }
    }

    // Ionic capital
    const capH = h * 0.020
    const capW = colWidth * 2.6
    for (let y = Math.floor(colTopY - capH); y < Math.floor(colTopY + 4); y++) {
      const capT = (y - (colTopY - capH)) / capH
      const widthMult = 1.0 + 0.3 * Math.sin(capT * Math.PI)
      for (let dx = -Math.ceil(capW * widthMult); dx <= Math.ceil(capW * widthMult); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / (capW * widthMult)
          if (d < 1.0) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)
            const voluteGlow = d > 0.7 ? (d - 0.7) / 0.3 * 0.12 : 0
            brightness[y*w+px] = Math.max(brightness[y*w+px], 0.50 + voluteGlow)
          }
        }
      }
    }

    // Column base
    const baseH = h * 0.012
    const baseW = colWidth * 1.8
    for (let y = Math.floor(columnBaseY - baseH); y < Math.floor(columnBaseY); y++) {
      for (let dx = -Math.ceil(baseW); dx <= Math.ceil(baseW); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          opacity[y*w+px] = Math.max(opacity[y*w+px], 0.82)
          brightness[y*w+px] = Math.max(brightness[y*w+px], 0.45)
        }
      }
    }
  }

  // ===== PORTICO DEPTH =====
  for (let ci = 0; ci <= numColumns; ci++) {
    const gapL = ci === 0 ? porticoL + colWidth * 1.5 :
                 porticoL + ci * colSpacing + colWidth * 1.5
    const gapR = ci === numColumns ? porticoR - colWidth * 1.5 :
                 porticoL + (ci + 1) * colSpacing - colWidth * 1.5
    if (gapR <= gapL) continue
    for (let y = Math.floor(colTopY + h*0.02); y < Math.floor(columnBaseY - h*0.01); y++) {
      for (let x = Math.floor(gapL); x <= Math.ceil(gapR); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // ===== WINDOWS =====
  const litBays = [true, false, true]
  for (let bi = 0; bi < numColumns - 1; bi++) {
    if (!litBays[bi]) continue
    const wx = porticoL + (bi + 1.5) * colSpacing
    const wy = colTopY + (columnBaseY - colTopY) * 0.22
    const winW2 = colSpacing * 0.10
    const winH2 = (columnBaseY - colTopY) * 0.30
    for (let y = Math.floor(wy); y < Math.floor(wy + winH2); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x < 0 || x >= w) continue
        glow[y*w+x] = 0.85
      }
    }
    const haloR = winW2 * 5
    for (let dy = -haloR; dy <= haloR; dy++) {
      for (let dx = -haloR; dx <= haloR; dx++) {
        const px = Math.round(wx + dx), py = Math.round(wy + winH2/2 + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const d = Math.sqrt(dx*dx + dy*dy) / haloR
          if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d) * 0.50)
        }
      }
    }
  }

  // ===== DOOR =====
  const doorCX = porticoCX
  const doorTop = columnBaseY - (columnBaseY - colTopY) * 0.52
  const doorW = colSpacing * 0.14
  for (let y = Math.floor(doorTop); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(doorCX - doorW); x <= Math.ceil(doorCX + doorW); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        glow[y*w+x] = Math.max(glow[y*w+x], 0.60)
      }
    }
  }
  const fanlightCY = doorTop - 6
  const fanlightR = doorW * 1.1
  for (let dy = -fanlightR; dy <= 0; dy++) {
    for (let dx = -fanlightR; dx <= fanlightR; dx++) {
      const d = Math.sqrt(dx*dx + dy*dy)
      if (d < fanlightR) {
        const px = Math.round(doorCX + dx), py = Math.round(fanlightCY + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          glow[py*w+px] = Math.max(glow[py*w+px], 0.45)
        }
      }
    }
  }
  const doorHaloR = doorW * 5
  for (let dy = -doorHaloR; dy <= doorHaloR; dy++) {
    for (let dx = -doorHaloR; dx <= doorHaloR; dx++) {
      const px = Math.round(doorCX + dx), py = Math.round(doorTop + (columnBaseY-doorTop)*0.4 + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx*dx + dy*dy) / doorHaloR
        if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d) * 0.35)
      }
    }
  }

  // Steps
  const stepsTop = columnBaseY
  const stepsBot = groundY
  const stepsH = stepsBot - stepsTop
  const numSteps = 4
  for (let si = 0; si < numSteps; si++) {
    const stepT = stepsTop + (stepsH / numSteps) * si
    const stepB = stepsTop + (stepsH / numSteps) * (si + 1)
    const indent = si * porticoW * 0.012
    for (let y = Math.floor(stepT); y < Math.floor(stepB); y++) {
      for (let x = Math.floor(porticoL - indent); x <= Math.ceil(porticoR + indent); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          opacity[y*w+x] = Math.max(opacity[y*w+x], 0.50)
          brightness[y*w+x] = Math.max(brightness[y*w+x], si % 2 === 0 ? 0.45 : 0.35)
        }
      }
    }
  }

  // ===== LIVE OAK — wider, more horizontal spreading =====
  const treeCX = w * 0.16
  const treeBaseY = groundY

  // Trunk
  const trunkTopY = h * 0.50
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY - y) / (treeBaseY - trunkTopY)
    const tw = 32 * (1.3 - t * 0.12)
    const lean = t * 6
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX + lean + dx)
      if (px >= 0 && px < w && y >= 0 && y < h) {
        const d = Math.abs(dx) / tw
        if (d < 1) { opacity[y*w+px] = Math.max(opacity[y*w+px], 0.95*(1-d*0.1)); brightness[y*w+px] = Math.min(brightness[y*w+px], 0.04) }
      }
    }
  }

  // Major limbs — wider horizontal spread
  const limbs = [
    { sx: treeCX - 8, sy: trunkTopY, ex: treeCX - w*0.26, ey: h*0.38, t: 20 },
    { sx: treeCX + 5, sy: trunkTopY - 5, ex: treeCX - w*0.20, ey: h*0.28, t: 17 },
    { sx: treeCX, sy: trunkTopY - 10, ex: treeCX - w*0.06, ey: h*0.22, t: 14 },
    { sx: treeCX + 10, sy: trunkTopY, ex: treeCX + w*0.18, ey: h*0.34, t: 18 },
    { sx: treeCX + 8, sy: trunkTopY - 8, ex: treeCX + w*0.14, ey: h*0.26, t: 15 },
    // Extra limb reaching further right, partially overlapping building
    { sx: treeCX + 12, sy: trunkTopY + 5, ex: treeCX + w*0.24, ey: h*0.40, t: 14 },
  ]
  for (const limb of limbs) {
    const mx = (limb.sx + limb.ex) / 2 + (rand() - 0.5) * 25
    const my = (limb.sy + limb.ey) / 2 - 10 + (rand() - 0.5) * 12
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

  // Canopy — WIDER and more HORIZONTAL (live oak spread, not round)
  const canopyCX = treeCX + w * 0.02  // slightly right-shifted center
  const canopyCY = h * 0.30
  const canopyRX = w * 0.30   // wider
  const canopyRY = h * 0.14   // flatter — horizontal ellipse
  const canopyEdgeN = makeNoise(seed + 600, 28)
  const canopyGapN = makeNoise(seed + 700, 18)
  const canopyGapN2 = makeNoise(seed + 710, 30)

  for (let y = Math.max(0, Math.floor(canopyCY - canopyRY * 1.4)); y <= Math.min(h-1, Math.ceil(canopyCY + canopyRY * 1.6)); y++) {
    for (let x = Math.max(0, Math.floor(canopyCX - canopyRX * 1.2)); x <= Math.min(w-1, Math.ceil(canopyCX + canopyRX * 1.2)); x++) {
      const dx2 = (x - canopyCX) / canopyRX, dy2 = (y - canopyCY) / canopyRY
      let d = dx2*dx2 + dy2*dy2 + canopyEdgeN(x, y) * 0.30
      // Live oak droop on bottom edge
      if (dy2 > 0.2) {
        const droop = (dy2 - 0.2) * 0.7
        d -= droop * (0.5 + canopyEdgeN(x*2, y) * 0.35)
      }
      if (d < 1.0) {
        const edgeFade = d > 0.60 ? (1 - d) / 0.40 : 1.0
        const gap1 = canopyGapN(x, y) * 0.5 + 0.5
        const gap2 = canopyGapN2(x, y) * 0.5 + 0.5
        const gapThresh = 0.50 + d * 0.28
        if (gap1 > gapThresh && gap2 > 0.42) {
          // Gap — sky visible through foliage
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.06)
        } else {
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.92)
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // Spanish moss — longer, more prominent
  const mossN = makeNoise(seed + 800, 8)
  for (let i = 0; i < 120; i++) {
    const mx0 = treeCX + (rand() - 0.5) * w * 0.52
    const my0 = h * 0.20 + rand() * h * 0.26
    const mLen = 60 + rand() * 140
    const mW = 3 + rand() * 4
    for (let my = 0; my < mLen; my++) {
      const t = my / mLen
      const sway = mossN(mx0 + i * 77, my0 + my) * 20 * t
      const mx = mx0 + sway, myy = my0 + my
      if (myy >= h) continue
      const op = (1 - t*t) * 0.55
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
  const lampX = w * 0.33, lampTopY = h * 0.22
  fillBar(opacity, w, h, lampX, lampTopY, lampX, groundY, 5)
  fillBar(opacity, w, h, lampX - 14, lampTopY, lampX + 14, lampTopY, 3.5)
  fillBar(opacity, w, h, lampX - 10, lampTopY, lampX - 10, lampTopY + 18, 2.5)
  fillBar(opacity, w, h, lampX + 10, lampTopY, lampX + 10, lampTopY + 18, 2.5)
  fillBar(opacity, w, h, lampX - 10, lampTopY + 18, lampX + 10, lampTopY + 18, 2.5)
  const lgR = 80
  for (let dy = -lgR; dy <= lgR; dy++) {
    for (let dx = -lgR; dx <= lgR; dx++) {
      const px = Math.round(lampX + dx), py = Math.round(lampTopY + 10 + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d2 = Math.sqrt(dx*dx + dy*dy) / lgR
        if (d2 < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d2*d2) * 0.50)
      }
    }
  }

  // Power lines
  for (const lineY of [h * 0.12, h * 0.15]) {
    for (let s = 0; s <= 400; s++) {
      const t = s / 400, lx = -50 + (w + 100) * t, ly = lineY + 14 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          opacity[py*w+px] = Math.max(opacity[py*w+px], 0.40)
        }
      }
    }
  }

  return { opacity, brightness, glow }
}

function buildIron(w: number, h: number, seed: number) {
  const iron = new Float32Array(w * h)
  const rand = makePRNG(seed + 3000)

  // Simple iron fence — vertical pickets with spear-point finials
  // Based on the actual Ben Franklin HS fence
  const railTop = h * 0.68      // iron starts much lower — building is the subject
  const railBot = h * 0.88      // and doesn't go as far down
  const barThick = 7            // picket thickness

  // Top and bottom horizontal rails
  fillBar(iron, w, h, -10, railTop, w+10, railTop, barThick * 1.8)
  fillBar(iron, w, h, -10, railBot, w+10, railBot, barThick * 1.8)
  // Middle rail
  const railMid = (railTop + railBot) * 0.5
  fillBar(iron, w, h, -10, railMid, w+10, railMid, barThick * 1.2)

  // Vertical pickets — evenly spaced, simple
  const picketSpacing = 38
  const numPickets = Math.ceil(w / picketSpacing) + 2
  for (let i = 0; i < numPickets; i++) {
    const px = -20 + i * picketSpacing

    // Picket shaft
    fillBar(iron, w, h, px, railTop, px, railBot, barThick)

    // Spear-point finial above top rail
    const finialH = 28
    const finialBot = railTop
    const finialTop = railTop - finialH
    // Tapered point
    for (let y = Math.floor(finialTop); y < Math.floor(finialBot); y++) {
      if (y < 0 || y >= h) continue
      const t = (y - finialTop) / finialH  // 0 at tip, 1 at base
      const halfW = 1.5 + t * (barThick * 0.6)
      for (let x = Math.floor(px - halfW - 1); x <= Math.ceil(px + halfW + 1); x++) {
        if (x < 0 || x >= w) continue
        const d = Math.abs(x - px)
        if (d < halfW) iron[y*w+x] = Math.max(iron[y*w+x], 1.0)
        else if (d < halfW + 1.2) iron[y*w+x] = Math.max(iron[y*w+x], 1.0 - (d - halfW) / 1.2)
      }
    }
  }

  // Solid below bottom rail (fence base / ground)
  for (let y = Math.floor(railBot + barThick * 1.5); y < h; y++) {
    for (let x = 0; x < w; x++) {
      iron[y*w+x] = Math.max(iron[y*w+x], 1.0)
    }
  }

  return iron
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 23001, b: 23002, c: 23003, d: 23004 }
  const seed = seeds[variant] ?? 23001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v23 variant ${variant} (seed: ${seed}) ===`)
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
  // LESS blur than v22 — building should be more recognizable
  const opB = gaussianBlur(opacity, W, H, 5)
  const brB = gaussianBlur(brightness, W, H, 6)
  const glB = gaussianBlur(glowMap, W, H, 28)

  // Iron
  console.log("  Drawing iron fence...")
  const ironSil = buildIron(W, H, seed)

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

      // Scene
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

      // Warm glow
      const gl = glB[i]
      if (gl > 0.01) {
        const ga = Math.min(0.80, gl * 0.78)
        r = r + (255-r)*ga
        g = g + (195-g)*ga
        b = b + (90-b)*ga
      }

      // Iron
      const ironVal = ironSil[i]
      if (ironVal > 0.01) {
        const a = Math.min(1, ironVal)
        const it = texN(x*3, y*3)*0.5+0.5
        r = r*(1-a) + (18+it*8)*a
        g = g*(1-a) + (14+it*6)*a
        b = b*(1-a) + (18+it*4)*a
      }

      // Film grain
      const grain = grainN(x,y)*4
      r += grain; g += grain*0.8; b += grain*0.6

      // Warm vignette
      const cx2 = x/W-0.5, cy2 = y/H-0.38
      const vig = 1.0 - (cx2*cx2*0.6 + cy2*cy2*1.0)*0.30
      r *= vig; g *= vig; b *= vig

      pixels[i4] = Math.round(Math.max(0,Math.min(255,r)))
      pixels[i4+1] = Math.round(Math.max(0,Math.min(255,g)))
      pixels[i4+2] = Math.round(Math.max(0,Math.min(255,b)))
      pixels[i4+3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const fn = `output/nostalgia-v23-${variant}.png`
  writeFileSync(fn, canvas.toBuffer("image/png"))
  console.log(`  -> ${fn}`)
}

main()
