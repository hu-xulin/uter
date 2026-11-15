/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UDS 6.0 — 真实色差 / 色觉模拟计算（供 C-R09 / A11Y 图表验证使用）
 *
 * 实现：
 *   sRGB → linear → XYZ(D65) → CIELAB → CIEDE2000 (ΔE00)
 *   Machado et al. 2009 / Viénot 线性 RGB 色觉缺陷模拟矩阵（severity 1.0）
 *
 * 全部为公式实算，不使用「看起来差不多」的主观判断。
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

export function parseHex(hex) {
  const h = String(hex).trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
}

export const toHex = (rgb) => '#' + rgb.map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()

function rgbToXyz([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  return [
    R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  ]
}

function xyzToLab([x, y, z]) {
  // D65 白点
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export const hexToLab = (hex) => xyzToLab(rgbToXyz(parseHex(hex)))

/** CIEDE2000 色差（Sharma et al. 2005 标准实现）。 */
export function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0
    const h = Math.atan2(b, a) * 180 / Math.PI
    return h >= 0 ? h : h + 360
  }
  const h1p = hp(a1p, b1), h2p = hp(a2p, b2)

  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p
    if (Math.abs(diff) <= 180) dhp = diff
    else if (diff > 180) dhp = diff - 360
    else dhp = diff + 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2)

  const Lbp = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let hbp
  if (C1p * C2p === 0) hbp = h1p + h2p
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2
  else hbp = (h1p + h2p - 360) / 2

  const T = 1
    - 0.17 * Math.cos((hbp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180)

  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2))
  const Cbp7 = Math.pow(Cbp, 7)
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)))
  const Lbp50 = Math.pow(Lbp - 50, 2)
  const Sl = 1 + (0.015 * Lbp50) / Math.sqrt(20 + Lbp50)
  const Sc = 1 + 0.045 * Cbp
  const Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(2 * dTheta * Math.PI / 180) * Rc

  const t1 = dLp / Sl, t2 = dCp / Sc, t3 = dHp / Sh
  return Math.sqrt(t1 * t1 + t2 * t2 + t3 * t3 + Rt * t2 * t3)
}

/* Viénot / Brettel 线性 RGB 模拟矩阵（在 linear sRGB 空间施加）。 */
export const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
}

const matmul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])

export function simulateCvd(hex, type) {
  const m = CVD_MATRICES[type]
  if (!m) return hex
  const lin = parseHex(hex).map(srgbToLinear)
  return toHex(matmul(m, lin).map(linearToSrgb))
}

/** 一组颜色的最小两两 ΔE00；返回真实最小值与对应下标。 */
export function minPairwiseDeltaE(colors) {
  const labs = colors.map(hexToLab)
  let min = Infinity, pair = null
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaE00(labs[i], labs[j])
      if (d < min) { min = d; pair = [i, j] }
    }
  }
  return { minDeltaE00: Number(min.toFixed(2)), closestPair: pair, pairCount: (colors.length * (colors.length - 1)) / 2 }
}

/** 12 色图表在常视觉 + 3 种色觉模拟下的真实可区分度。 */
export function chartDistinguishability(colors, threshold = 10) {
  const out = { threshold, normal: minPairwiseDeltaE(colors), simulations: {} }
  for (const type of Object.keys(CVD_MATRICES)) {
    const simulated = colors.map((c) => simulateCvd(c, type))
    out.simulations[type] = { ...minPairwiseDeltaE(simulated), simulatedColors: simulated }
  }
  const mins = Object.values(out.simulations).map((s) => s.minDeltaE00)
  out.minAcrossAllConditions = Math.min(out.normal.minDeltaE00, ...mins)
  out.pass = out.minAcrossAllConditions >= threshold
  return out
}
