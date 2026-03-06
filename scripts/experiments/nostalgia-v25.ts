/**
 * NOSTALGIA v25 — DREAMIER, WARMER, BETTER TREE
 *
 * Key changes from v24:
 * 1. MORE scene blur (radius 8) — the building is a MEMORY, not a photograph
 *    The iron stays sharp (not blurred). The contrast = you're here, the building is there.
 * 2. Tree canopy built from limb endpoints, not an ellipse — organic, irregular shape
 * 3. Warmer wall tones — amber/ochre instead of grey
 * 4. Stronger warm glow from windows — inviting, inhabited
 * 5. More atmospheric haze between fence and building
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

function sampleBez3(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for(let i=0;i<=steps;i++){const t=i/steps,u=1-t; pts.push({x:u*u*p0x+2*u*t*p1x+t*t*p2x,y:u*u*p0y+2*u*t*p1y+t*t*p2y})}
  return pts
}

function buildScene(w:number, h:number, seed:number, rand:()=>number) {
  const opacity = new Float32Array(w * h)
  const brightness = new Float32Array(w * h)
  const glow = new Float32Array(w * h)
  const dissolveN = makeFBM(seed + 1100, 200, 5)
  const dissolveN2 = makeFBM(seed + 1200, 70, 3)
  const edgeN = makeNoise(seed + 500, 40)

  const groundY = h * 0.82

  // Ground
  for (let x = 0; x < w; x++) {
    const gv = edgeN(x, groundY) * 4
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) { opacity[y*w+x] = 0.85; brightness[y*w+x] = 0.16 }
    }
  }

  // Sidewalk
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(groundY - h*0.020); y < Math.floor(groundY); y++) {
      if (y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.35)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.44)
      }
    }
  }

  // ===== ATMOSPHERIC HAZE between fence and building =====
  // A warm golden haze layer that sits over the scene — adds depth
  // This is what makes humid New Orleans evenings feel like memory
  const hazeN = makeFBM(seed + 1500, 300, 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hv = hazeN(x, y) * 0.5 + 0.5
      if (hv > 0.55) {
        const hazeOp = (hv - 0.55) * 0.30  // very subtle
        const i = y * w + x
        glow[i] = Math.max(glow[i], hazeOp * 0.20)
      }
    }
  }

  // ===== BUILDING =====
  const porticoL = w * 0.42
  const porticoR = w * 0.90
  const porticoW = porticoR - porticoL
  const porticoCX = (porticoL + porticoR) / 2

  const bldgL = porticoL - porticoW * 0.10
  const bldgR = porticoR + porticoW * 0.10

  const corniceY = h * 0.17
  const columnBaseY = groundY - h * 0.015

  // REAR WALL with dissolution
  for (let y = Math.floor(corniceY - 5); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(bldgL); x <= Math.ceil(bldgR); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const dn = dissolveN(x, y) * 0.5 + 0.5
        const dn2 = dissolveN2(x, y) * 0.5 + 0.5
        const isPortico = x >= porticoL && x <= porticoR

        const heightT = (y - corniceY) / (columnBaseY - corniceY)
        const dissolveBias = 0.20 - heightT * 0.32

        const dissolveVal = (dn * 0.55 + dn2 * 0.45) + dissolveBias

        if (isPortico) {
          const threshold = 0.50
          if (dissolveVal < threshold) {
            const edgeDist = (threshold - dissolveVal) / 0.12
            if (edgeDist < 1) {
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.06 * (1 - edgeDist))
            }
          } else {
            opacity[y*w+x] = Math.max(opacity[y*w+x], 0.55)
            brightness[y*w+x] = Math.max(brightness[y*w+x], 0.04)
          }
        } else {
          const threshold = 0.40
          if (dissolveVal < threshold) {
            const edgeDist = (threshold - dissolveVal) / 0.10
            if (edgeDist < 1) {
              opacity[y*w+x] = Math.max(opacity[y*w+x], 0.10 * (1 - edgeDist))
            }
          } else {
            const wallOp = 0.50 + (dissolveVal - threshold) * 0.35
            // WARMER wall tones — amber/ochre, not grey
            const sideBr = x < porticoL ? 0.42 : 0.25
            opacity[y*w+x] = Math.max(opacity[y*w+x], Math.min(0.75, wallOp))
            brightness[y*w+x] = Math.max(brightness[y*w+x], sideBr)
          }
        }
      }
    }
  }

  // PEDIMENT
  const pedimentPeakY = corniceY - porticoW * 0.10
  for (let y = Math.floor(pedimentPeakY); y < Math.floor(corniceY); y++) {
    const t = (y - pedimentPeakY) / (corniceY - pedimentPeakY)
    const hw = (porticoW / 2 + 15) * t
    for (let x = Math.floor(porticoCX - hw); x <= Math.ceil(porticoCX + hw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const dn = dissolveN(x, y) * 0.5 + 0.5
        const edgeDist = Math.abs(Math.abs(x - porticoCX) / Math.max(1,hw) - 0.95)
        const isEdge = edgeDist < 0.08 || t > 0.92 || t < 0.08
        const pedOp = isEdge ? 0.70 : (dn < 0.35 ? 0.25 : 0.50)
        opacity[y*w+x] = Math.max(opacity[y*w+x], pedOp)
        brightness[y*w+x] = Math.max(brightness[y*w+x], 0.38)
      }
    }
  }

  // Entablature
  const entH = h * 0.010
  for (let y = Math.floor(corniceY - entH); y < Math.floor(corniceY + entH); y++) {
    for (let x = Math.floor(bldgL - 8); x <= Math.ceil(bldgR + 8); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        opacity[y*w+x] = Math.max(opacity[y*w+x], 0.68)
        brightness[y*w+x] = 0.10
      }
    }
  }

  // 4 COLUMNS
  const numColumns = 4
  const colSpacing = porticoW / (numColumns + 1)
  const colWidth = colSpacing * 0.22
  const colTopY = corniceY + entH

  for (let ci = 1; ci <= numColumns; ci++) {
    const colCX = porticoL + ci * colSpacing
    for (let y = Math.floor(colTopY); y < Math.floor(columnBaseY); y++) {
      const t = (y - colTopY) / (columnBaseY - colTopY)
      const entasis = 1.0 + 0.04 * Math.sin(t * Math.PI * 0.7)
      const hw = colWidth * entasis
      for (let dx = -Math.ceil(hw + 3); dx <= Math.ceil(hw + 3); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / hw
          if (d < 0.90) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.92)
            const fluteAngle = (dx / hw) * Math.PI
            const fluteVal = Math.sin(fluteAngle * 8) * 0.5 + 0.5
            const fluteBr = 0.30 + fluteVal * 0.40
            const lightBias = dx < 0 ? 0.16 : -0.08
            brightness[y*w+px] = Math.max(brightness[y*w+px], fluteBr + lightBias)
          } else if (d < 1.0) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)
            brightness[y*w+px] = Math.min(brightness[y*w+px], 0.05)
          }
        }
      }
    }
    // Ionic capital
    const capH = h * 0.018
    const capW = colWidth * 2.4
    for (let y = Math.floor(colTopY - capH); y < Math.floor(colTopY + 3); y++) {
      const capT = (y - (colTopY - capH)) / capH
      const widthMult = 1.0 + 0.25 * Math.sin(capT * Math.PI)
      for (let dx = -Math.ceil(capW * widthMult); dx <= Math.ceil(capW * widthMult); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          const d = Math.abs(dx) / (capW * widthMult)
          if (d < 1.0) {
            opacity[y*w+px] = Math.max(opacity[y*w+px], 0.88)
            brightness[y*w+px] = Math.max(brightness[y*w+px], 0.48)
          }
        }
      }
    }
    // Column base
    const baseH = h * 0.010
    const baseW = colWidth * 1.7
    for (let y = Math.floor(columnBaseY - baseH); y < Math.floor(columnBaseY); y++) {
      for (let dx = -Math.ceil(baseW); dx <= Math.ceil(baseW); dx++) {
        const px = Math.round(colCX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          opacity[y*w+px] = Math.max(opacity[y*w+px], 0.82)
          brightness[y*w+px] = Math.max(brightness[y*w+px], 0.44)
        }
      }
    }
  }

  // PORTICO DEPTH
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

  // WINDOWS — WARMER, stronger glow
  const litBays = [true, false, true]
  for (let bi = 0; bi < numColumns - 1; bi++) {
    if (!litBays[bi]) continue
    const wx = porticoL + (bi + 1.5) * colSpacing
    const wy = colTopY + (columnBaseY - colTopY) * 0.24
    const winW2 = colSpacing * 0.09
    const winH2 = (columnBaseY - colTopY) * 0.28
    for (let y = Math.floor(wy); y < Math.floor(wy + winH2); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x < 0 || x >= w) continue
        glow[y*w+x] = 0.90  // brighter windows
      }
    }
    const haloR = winW2 * 6  // larger halo
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

  // DOOR — stronger glow
  const doorCX = porticoCX
  const doorTop = columnBaseY - (columnBaseY - colTopY) * 0.50
  const doorW = colSpacing * 0.12
  for (let y = Math.floor(doorTop); y < Math.floor(columnBaseY); y++) {
    for (let x = Math.floor(doorCX - doorW); x <= Math.ceil(doorCX + doorW); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) glow[y*w+x] = Math.max(glow[y*w+x], 0.65)
    }
  }
  const fanlightCY = doorTop - 5
  const fanlightR = doorW * 1.0
  for (let dy = -fanlightR; dy <= 0; dy++) {
    for (let dx = -fanlightR; dx <= fanlightR; dx++) {
      const d = Math.sqrt(dx*dx + dy*dy)
      if (d < fanlightR) {
        const px = Math.round(doorCX + dx), py = Math.round(fanlightCY + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) glow[py*w+px] = Math.max(glow[py*w+px], 0.50)
      }
    }
  }
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
  const numSteps = 4
  for (let si = 0; si < numSteps; si++) {
    const stepT = stepsTop + (stepsH / numSteps) * si
    const stepB = stepsTop + (stepsH / numSteps) * (si + 1)
    const indent = si * porticoW * 0.010
    for (let y = Math.floor(stepT); y < Math.floor(stepB); y++) {
      for (let x = Math.floor(porticoL - indent); x <= Math.ceil(porticoR + indent); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          opacity[y*w+x] = Math.max(opacity[y*w+x], 0.45)
          brightness[y*w+x] = Math.max(brightness[y*w+x], si % 2 === 0 ? 0.40 : 0.30)
        }
      }
    }
  }

  // ===== LIVE OAK — limb-based canopy, not ellipse =====
  const treeCX = w * 0.15
  const treeBaseY = groundY

  // Trunk
  const trunkTopY = h * 0.50
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY - y) / (treeBaseY - trunkTopY)
    const tw = 30 * (1.2 - t * 0.10)
    const lean = t * 4
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX + lean + dx)
      if (px >= 0 && px < w && y >= 0 && y < h) {
        const d = Math.abs(dx) / tw
        if (d < 1) { opacity[y*w+px] = Math.max(opacity[y*w+px], 0.95*(1-d*0.1)); brightness[y*w+px] = Math.min(brightness[y*w+px], 0.04) }
      }
    }
  }

  // Limbs — define canopy shape
  type LimbEnd = { x: number, y: number }
  const limbEnds: LimbEnd[] = []
  const limbs = [
    { sx: treeCX - 10, sy: trunkTopY, ex: treeCX - w*0.28, ey: h*0.40, t: 22 },
    { sx: treeCX - 5, sy: trunkTopY - 8, ex: treeCX - w*0.22, ey: h*0.30, t: 18 },
    { sx: treeCX - 3, sy: trunkTopY - 12, ex: treeCX - w*0.14, ey: h*0.22, t: 14 },
    { sx: treeCX, sy: trunkTopY - 14, ex: treeCX - w*0.04, ey: h*0.18, t: 12 },
    { sx: treeCX + 3, sy: trunkTopY - 10, ex: treeCX + w*0.02, ey: h*0.17, t: 11 },
    { sx: treeCX + 10, sy: trunkTopY, ex: treeCX + w*0.20, ey: h*0.34, t: 20 },
    { sx: treeCX + 8, sy: trunkTopY - 6, ex: treeCX + w*0.16, ey: h*0.26, t: 16 },
    { sx: treeCX + 12, sy: trunkTopY + 5, ex: treeCX + w*0.26, ey: h*0.42, t: 14 },
  ]
  for (const limb of limbs) {
    const mx = (limb.sx + limb.ex) / 2 + (rand() - 0.5) * 20
    const my = (limb.sy + limb.ey) / 2 - 8 + (rand() - 0.5) * 10
    const pts = sampleBez3(limb.sx, limb.sy, mx, my, limb.ex, limb.ey, 80)
    limbEnds.push({ x: limb.ex, y: limb.ey })
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1), thick = (limb.t * (1 - t * 0.50)) / 2, p = pts[i]
      for (let y = Math.max(0, Math.floor(p.y - thick - 2)); y <= Math.min(h-1, Math.ceil(p.y + thick + 2)); y++) {
        for (let x = Math.max(0, Math.floor(p.x - thick - 2)); x <= Math.min(w-1, Math.ceil(p.x + thick + 2)); x++) {
          const d = Math.sqrt((x-p.x)**2 + (y-p.y)**2)
          if (d < thick) { opacity[y*w+x] = Math.max(opacity[y*w+x], 0.92); brightness[y*w+x] = Math.min(brightness[y*w+x], 0.04) }
          else if (d < thick + 2) { const a = 0.92 * (1 - (d-thick) / 2); opacity[y*w+x] = Math.max(opacity[y*w+x], a) }
        }
      }
    }
  }

  // Canopy — built from a distance field to limb endpoints
  // Each limb end has a "foliage blob" around it. Together they form an irregular canopy.
  const canopyGapN = makeNoise(seed + 700, 22)
  const canopyGapN2 = makeNoise(seed + 710, 38)
  const canopyEdgeN = makeNoise(seed + 600, 32)

  // Also add the trunk top as a foliage center
  const foliageCenters = [
    ...limbEnds.map(e => ({ x: e.x, y: e.y, r: 130 + rand() * 60 })),
    { x: treeCX, y: trunkTopY - 30, r: 100 },
  ]

  for (let y = Math.max(0, Math.floor(h * 0.10)); y <= Math.min(h-1, Math.ceil(h * 0.58)); y++) {
    for (let x = Math.max(0, Math.floor(treeCX - w * 0.36)); x <= Math.min(w-1, Math.ceil(treeCX + w * 0.32)); x++) {
      // Find distance to nearest foliage center, normalized by its radius
      let minD = 999
      for (const c of foliageCenters) {
        const dx2 = (x - c.x), dy2 = (y - c.y)
        // Flatten vertically (live oak canopy wider than tall)
        const d = Math.sqrt(dx2*dx2 + dy2*dy2 * 2.5) / c.r
        if (d < minD) minD = d
      }

      // Add noise to edge
      minD += canopyEdgeN(x, y) * 0.30

      if (minD < 1.0) {
        const edgeFade = minD > 0.55 ? (1 - minD) / 0.45 : 1.0
        const gap1 = canopyGapN(x, y) * 0.5 + 0.5
        const gap2 = canopyGapN2(x, y) * 0.5 + 0.5
        const gapThresh = 0.46 + minD * 0.32
        if (gap1 > gapThresh && gap2 > 0.40) {
          // Gap — sky visible
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.04)
        } else {
          opacity[y*w+x] = Math.max(opacity[y*w+x], edgeFade * 0.90)
          brightness[y*w+x] = Math.min(brightness[y*w+x], 0.03)
        }
      }
    }
  }

  // Spanish moss
  const mossN = makeNoise(seed + 800, 8)
  for (let i = 0; i < 140; i++) {
    const mx0 = treeCX + (rand() - 0.5) * w * 0.58
    const my0 = h * 0.18 + rand() * h * 0.28
    const mLen = 70 + rand() * 160
    const mW = 2.5 + rand() * 3.5
    for (let my = 0; my < mLen; my++) {
      const t = my / mLen
      const sway = mossN(mx0 + i * 77, my0 + my) * 22 * t
      const mx = mx0 + sway, myy = my0 + my
      if (myy >= h) continue
      const op = (1 - t*t) * 0.52
      const mw = mW * (1 - t * 0.45)
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
  const lampX = w * 0.34, lampTopY = h * 0.21
  fillBar(opacity, w, h, lampX, lampTopY, lampX, groundY, 5)
  fillBar(opacity, w, h, lampX - 12, lampTopY, lampX + 12, lampTopY, 3)
  fillBar(opacity, w, h, lampX - 9, lampTopY, lampX - 9, lampTopY + 16, 2.5)
  fillBar(opacity, w, h, lampX + 9, lampTopY, lampX + 9, lampTopY + 16, 2.5)
  fillBar(opacity, w, h, lampX - 9, lampTopY + 16, lampX + 9, lampTopY + 16, 2.5)
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
  for (const lineY of [h * 0.11, h * 0.14]) {
    for (let s = 0; s <= 400; s++) {
      const t = s / 400, lx = -50 + (w + 100) * t, ly = lineY + 12 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          opacity[py*w+px] = Math.max(opacity[py*w+px], 0.38)
        }
      }
    }
  }

  return { opacity, brightness, glow }
}

function buildIron(w: number, h: number, seed: number) {
  const iron = new Float32Array(w * h)

  const railTop = h * 0.70
  const railBot = h * 0.88
  const barThick = 6

  fillBar(iron, w, h, -10, railTop, w+10, railTop, barThick * 1.6)
  fillBar(iron, w, h, -10, railBot, w+10, railBot, barThick * 1.6)
  const railMid = (railTop + railBot) * 0.5
  fillBar(iron, w, h, -10, railMid, w+10, railMid, barThick * 1.0)

  const picketSpacing = 34
  const numPickets = Math.ceil(w / picketSpacing) + 2
  for (let i = 0; i < numPickets; i++) {
    const px = -15 + i * picketSpacing
    fillBar(iron, w, h, px, railTop, px, railBot, barThick)
    const finialH = 24
    const finialTop = railTop - finialH
    for (let y = Math.floor(finialTop); y < Math.floor(railTop); y++) {
      if (y < 0 || y >= h) continue
      const t = (y - finialTop) / finialH
      const halfW = 1.0 + t * (barThick * 0.55)
      for (let x = Math.floor(px - halfW - 1); x <= Math.ceil(px + halfW + 1); x++) {
        if (x < 0 || x >= w) continue
        const d = Math.abs(x - px)
        if (d < halfW) iron[y*w+x] = Math.max(iron[y*w+x], 1.0)
        else if (d < halfW + 1.0) iron[y*w+x] = Math.max(iron[y*w+x], 1.0 - (d - halfW))
      }
    }
  }

  for (let y = Math.floor(railBot + barThick * 1.5); y < h; y++) {
    for (let x = 0; x < w; x++) {
      iron[y*w+x] = Math.max(iron[y*w+x], 1.0)
    }
  }

  return iron
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 25001, b: 25002, c: 25003, d: 25004 }
  const seed = seeds[variant] ?? 25001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v25 variant ${variant} (seed: ${seed}) ===`)
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
      if(t<0.06){const s=t/0.06;r=155+s*50;g=72+s*48;b=38+s*18}
      else if(t<0.22){const s=(t-0.06)/0.16;r=205+s*42;g=120+s*58;b=56+s*35}
      else if(t<0.45){const s=(t-0.22)/0.23;r=247+s*6;g=178+s*42;b=91+s*28}
      else if(t<0.68){const s=(t-0.45)/0.23;r=253-s*10;g=220-s*22;b=119-s*12}
      else{const s=(t-0.68)/0.32;r=243-s*65;g=198-s*55;b=107-s*30}
      if(cn>0.40){const ca=Math.min(0.30,(cn-0.40)/0.35),glw=Math.max(0,1-Math.abs(t-0.33)*2.5);r+=ca*(24+glw*18);g+=ca*(18+glw*14);b+=ca*(10+glw*8)}
      r+=(sn-0.5)*6;g+=(sn-0.5)*4;b+=(sn-0.5)*3
      skyR[i]=r;skyG[i]=g;skyB[i]=b
    }
  }

  // Scene
  console.log("  Building scene...")
  const {opacity, brightness, glow: glowMap} = buildScene(W, H, seed, rand)
  console.log("  Blurring scene...")
  // MORE blur than v24 — dreamier memory quality
  const opB = gaussianBlur(opacity, W, H, 8)
  const brB = gaussianBlur(brightness, W, H, 9)
  const glB = gaussianBlur(glowMap, W, H, 32)

  // Iron — NOT blurred (sharp foreground)
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

      const op = opB[i]
      const br = brB[i]
      if (op > 0.01) {
        // WARMER wall tones — more amber/ochre
        const dR = 42 + tex*12, dG = 30 + tex*8, dB = 22 + tex*5
        const aR = 210 + tex*18, aG = 165 + tex*14, aB = 95 + tex*8
        const scR = dR + (aR-dR)*br
        const scG = dG + (aG-dG)*br
        const scB = dB + (aB-dB)*br
        const a = Math.min(1, op)
        r = r*(1-a) + scR*a
        g = g*(1-a) + scG*a
        b = b*(1-a) + scB*a
      }

      const gl = glB[i]
      if (gl > 0.01) {
        const ga = Math.min(0.80, gl * 0.80)
        r = r + (255-r)*ga
        g = g + (200-g)*ga
        b = b + (95-b)*ga
      }

      const ironVal = ironSil[i]
      if (ironVal > 0.01) {
        const a = Math.min(1, ironVal)
        const it = texN(x*3, y*3)*0.5+0.5
        r = r*(1-a) + (16+it*7)*a
        g = g*(1-a) + (12+it*5)*a
        b = b*(1-a) + (16+it*4)*a
      }

      const grain = grainN(x,y)*3.5
      r += grain; g += grain*0.8; b += grain*0.6

      const cx2 = x/W-0.5, cy2 = y/H-0.36
      const vig = 1.0 - (cx2*cx2*0.55 + cy2*cy2*0.95)*0.28
      r *= vig; g *= vig; b *= vig

      pixels[i4] = Math.round(Math.max(0,Math.min(255,r)))
      pixels[i4+1] = Math.round(Math.max(0,Math.min(255,g)))
      pixels[i4+2] = Math.round(Math.max(0,Math.min(255,b)))
      pixels[i4+3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const fn = `output/nostalgia-v25-${variant}.png`
  writeFileSync(fn, canvas.toBuffer("image/png"))
  console.log(`  -> ${fn}`)
}

main()
