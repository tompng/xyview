import { RangeResults } from 'numcore'
import {
  FillMode,
  ParsedEquation1D,
  ParsedEquation2D,
} from './parser'

function fillModeToMask(fillMode: FillMode) {
  return (
    (fillMode.positive ? (1 << RangeResults.POSITIVE) : 0) +
    (fillMode.negative ? (1 << RangeResults.NEGATIVE) : 0) +
    (fillMode.zero ? (1 << RangeResults.EQZERO) : 0)
  )
}

type RenderingRange = { xMin: number; xMax: number; yMin: number; yMax: number }
export function render2D(
  canvas: HTMLCanvasElement,
  size: number,
  offset: number,
  range: RenderingRange,
  formula: ParsedEquation2D,
  renderMode: {
    color: string
    lineWidth: number
    fillAlpha: number
  }
) {
  const xFactor = size / (range.xMax - range.xMin)
  const xOffset = offset - size * range.xMin / (range.xMax - range.xMin)
  const yFactor = size / (range.yMax - range.yMin)
  const yOffset = offset - size * range.yMin / (range.yMax - range.yMin)
  const { valueFunc, rangeFunc, fillMode } = formula
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = renderMode.color
  const { BOTH } = RangeResults
  const { fillAlpha, lineWidth } = renderMode
  ctx.globalAlpha = fillAlpha
  function fill(xMin: number, yMin: number, size: number) {
    ctx.fillRect(xOffset + xFactor * xMin, yOffset + yFactor * yMin, size, size)
  }
  function fillDotWithOpacity(xMin: number, yMin: number, opacity: number) {
    ctx.globalAlpha = opacity * fillAlpha
    ctx.fillRect(xOffset + xFactor * xMin, yOffset + yFactor * yMin, 1, 1)
    ctx.globalAlpha = fillAlpha
  }
  const plotPoints: number[] = []
  const hasFill = fillMode.negative || fillMode.positive || fillMode.zero
  function calcDot(xMin: number, xMax: number, yMin: number, yMax: number) {
    if (!hasFill) return
    const x0 = 0.75 * xMin + 0.25 * xMax
    const x1 = 0.25 * xMin + 0.75 * xMax
    const y0 = 0.75 * yMin + 0.25 * yMax
    const y1 = 0.25 * yMin + 0.75 * yMax
    const v00 = valueFunc(x0, y0)
    const v01 = valueFunc(x0, y1)
    const v10 = valueFunc(x1, y0)
    const v11 = valueFunc(x1, y1)
    let alpha = 0
    if (fillMode.zero) {
      alpha += ((v00 === 0 ? 1 : 0) + (v01 === 0 ? 1 : 0) + (v10 === 0 ? 1 : 0) + (v11 === 0 ? 1 : 0)) / 4
    }
    if (fillMode.negative) {
      alpha += ((v00 < 0 ? 1 : 0) + (v01 < 0 ? 1 : 0) + (v10 < 0 ? 1 : 0) + (v11 < 0 ? 1 : 0)) / 4
    } else if (fillMode.positive) {
      alpha += ((v00 > 0 ? 1 : 0) + (v01 > 0 ? 1 : 0) + (v10 > 0 ? 1 : 0) + (v11 > 0 ? 1 : 0)) / 4
    }
    if (alpha > 0) fillDotWithOpacity(xMin, yMin, alpha)
  }
  function calcFull(xMin: number, xMax: number, yMin: number, yMax: number, size: number) {
    const dx = (xMax - xMin) / size
    const dy = (yMax - yMin) / size
    let values: number[] = []
    let nextValues: number[] = []
    for (let ix = 0; ix <= size; ix++) values[ix] = valueFunc(xMin + ix * dx, yMin)
    for (let iy = 1; iy <= size; iy++) {
      const y1 = yMin + iy * dy
      const y0 = y1 - dy
      for (let ix = 0; ix <= size; ix++) nextValues[ix] = valueFunc(xMin + ix * dx, y1)
      for (let ix = 0; ix < size; ix++) {
        const x0 = xMin + ix * dx
        const x1 = x0 + dx
        const v00 = values[ix]
        const v10 = values[ix + 1]
        const v01 = nextValues[ix]
        const v11 = nextValues[ix + 1]
        if (hasFill) {
          if (fillMode.zero && valueFunc(x0 + dx / 2, y0 + dy / 2) === 0) {
            fill(x0, y0, 1)
          } else if (fillMode.negative) {
            if (v00 < 0 && v01 < 0 && v10 < 0 && v11 < 0) {
              fill(x0, y0, 1)
            } else if (v00 < 0 || v01 < 0 || v10 < 0 || v11 < 0) {
              calcDot(x0, x1, y0, y1)
            }
          } else if (fillMode.positive) {
            if (v00 > 0 && v01 > 0 && v10 > 0 && v11 > 0) {
              fill(x0, y0, 1)
            } else if (v00 > 0 || v01 > 0 || v10 > 0 || v11 > 0) {
              calcDot(x0, x1, y0, y1)
            }
          }
        }
        if (v00 * v10 <= 0 && v00 !== v10) plotPoints.push(x0 - dx * v00 / (v10 - v00), y0)
        if (v01 * v11 <= 0 && v01 !== v11) plotPoints.push(x0 - dx * v01 / (v11 - v01), y1)
        if (v00 * v01 <= 0 && v00 !== v01) plotPoints.push(x0, y0 - dy * v00 / (v01 - v00))
        if (v10 * v11 <= 0 && v10 !== v11) plotPoints.push(x1, y0 - dy * v10 / (v11 - v10))
      }
      ;[values, nextValues] = [nextValues, values]
    }
  }
  const fillMask = fillModeToMask(fillMode)
  let ranges = [range.xMin, range.xMax, range.yMin, range.yMax]
  let currentSize = size
  while (currentSize >= 1) {
    const nextRanges = []
    for (let i = 0; i < ranges.length; i += 4) {
      const xMin = ranges[i]
      const xMax = ranges[i + 1]
      const yMin = ranges[i + 2]
      const yMax = ranges[i + 3]
      const result = rangeFunc(xMin, xMax, yMin, yMax)
      if (result >= 0) {
        if (((fillMask >> result) & 1) === 1) fill(xMin, yMin, currentSize)
      } else if (result === BOTH && currentSize <= 8) {
        calcFull(xMin, xMax, yMin, yMax, currentSize)
      } else if (currentSize > 1) {
        const xc = (xMin + xMax) / 2
        const yc = (yMin + yMax) / 2
        nextRanges.push(
          xMin, xc, yMin, yc,
          xc, xMax, yMin, yc,
          xMin, xc, yc, yMax,
          xc, xMax, yc, yMax
        )
      } else {
        calcDot(xMin, xMax, yMin, yMax)
      }
    }
    ranges = nextRanges
    currentSize /= 2
  }
  ctx.beginPath()
  for (let i = 0; i < plotPoints.length; i += 2) {
    const x = xOffset + xFactor * plotPoints[i]
    const y = yOffset + yFactor * plotPoints[i + 1]
    ctx.moveTo(x, y)
    ctx.arc(x, y, lineWidth / 2, 0, 2 * Math.PI, true)
  }
  ctx.globalAlpha = 1
  ctx.fill()
}

type RangeResult1D = {
  fills: [number, number][]
  plots: number[]
  alphaFills: [number, number, number][]
}
type CurveResult = number[][]
export type CalcResult1D = RangeResult1D | CurveResult

export function calc1DRange(formula: ParsedEquation1D, size: number, min: number, max: number): RangeResult1D {
  const { valueFunc, rangeFunc, fillMode } = formula
  const fillMask = fillModeToMask(fillMode)
  type Range = [number, number]
  let ranges: Range[] = [[min, max]]
  let currentSize = size
  const fills: Range[] = []
  const alphaFills: [number, number, number][] = []
  const plots: number[] = []
  const { BOTH } = RangeResults
  const hasFill = fillMode.negative || fillMode.positive || fillMode.zero
  function calcDot(min: number, max: number) {
    if (!hasFill) return
    const v0 = valueFunc((min * 7 + max) / 8)
    const v1 = valueFunc((min * 5 + 3 * max) / 8)
    const v2 = valueFunc((min * 3 + 5 * max) / 8)
    const v3 = valueFunc((min + 8 * max) / 8)
    let alpha = 0
    if (fillMode.zero) {
      alpha += ((v0 === 0 ? 1 : 0) + (v1 === 0 ? 1 : 0) + (v2 === 0 ? 1 : 0) + (v3 === 0 ? 1 : 0)) / 4
    }
    if (fillMode.negative) {
      alpha += ((v0 < 0 ? 1 : 0) + (v1 < 0 ? 1 : 0) + (v2 < 0 ? 1 : 0) + (v3 < 0 ? 1 : 0)) / 4
    } else if (fillMode.positive) {
      alpha += ((v0 > 0 ? 1 : 0) + (v1 > 0 ? 1 : 0) + (v2 > 0 ? 1 : 0) + (v3 > 0 ? 1 : 0)) / 4
    }
    if (alpha > 0) alphaFills.push([min, max, alpha])
  }
  function calcFull(min: number, max: number, size: number) {
    const d = (max - min) / size
    let values: number[] = []
    for (let i = 0; i <= size; i++) values[i] = valueFunc(min + i * d)
    for (let i = 0; i < size; i++) {
      const x0 = min + i * d
      const x1 = x0 + d
      const v0 = values[i]
      const v1 = values[i + 1]
      if (hasFill) {
        if (fillMode.zero && valueFunc(x0 + d / 2) === 0) {
          fills.push([x0, x1])
        } else if (fillMode.negative) {
          if (v0 < 0 && v1 < 0) {
            fills.push([x0, x1])
          } else if (v0 < 0 || v1 < 0 || v1 < 0 || v1 < 0) {
            calcDot(x0, x1)
          }
        } else if (fillMode.positive) {
          if (v0 > 0 && v1 > 0) {
            fills.push([x0, x1])
          } else if (v0 > 0 || v1 > 0) {
            calcDot(x0, x1)
          }
        }
      }
      if (v0 * v1 <= 0 && v0 !== v1) plots.push(x0 - d * v0 / (v1 - v0))
    }
  }
  while (currentSize >= 1 && ranges.length) {
    const nextRanges: Range[] = []
    for (const [min, max] of ranges) {
      const result = rangeFunc(min, max)
      if (result >= 0) {
        if (((fillMask >> result) & 1) === 1) fills.push([min, max])
      } else if (result === BOTH && currentSize <= 64) {
        calcFull(min, max, currentSize)
      } else if (currentSize > 1) {
        const center = (min + max) / 2
        nextRanges.push([min, center], [center, max])
      } else {
        calcDot(min, max)
      }
    }
    ranges = nextRanges
    currentSize /= 2
  }
  return { fills, plots, alphaFills }
}

export function calc1DCurves(formula: ParsedEquation1D, size: number, min: number, max: number): CurveResult {
  const { valueFunc, rangeFunc } = formula
  type Range = [number, number]
  let ranges: Range[] = [[min, max]]
  let currentSize = size
  const curves: number[][] = []
  const { BOTH, EQNAN } = RangeResults
  function calcFull(min: number, max: number, size: number){
    const d = (max - min) / size
    let curve: number[] = []
    curves.push(curve)
    for (let i = 0; i <= size; i++) {
      const x = min + d * i
      const v = valueFunc(x)
      if (isNaN(v)) {
        curve = []
        curves.push(curve)
      } else {
        curve.push(x, v)
      }
    }
  }
  while (currentSize >= 1 && ranges.length) {
    const nextRanges: Range[] = []
    for (const [min, max] of ranges) {
      const result = rangeFunc(min, max)
      if (result === EQNAN) continue
      if (result >= 0 || result === BOTH) {
        calcFull(min, max, currentSize)
      } else if (currentSize > 1) {
        const center = (min + max) / 2
        nextRanges.push([min, center], [center, max])
      }
    }
    ranges = nextRanges
    currentSize /= 2
  }
  return curves
}

export function render1D(
  canvas: HTMLCanvasElement,
  size: number,
  offset: number,
  range: RenderingRange,
  formula: ParsedEquation1D,
  result: RangeResult1D | CurveResult,
  renderMode: {
    color: string
    lineWidth: number
    fillAlpha: number
  }
) {
  const xFactor = size / (range.xMax - range.xMin)
  const xOffset = offset - size * range.xMin / (range.xMax - range.xMin)
  const yFactor = size / (range.yMax - range.yMin)
  const yOffset = offset - size * range.yMin / (range.yMax - range.yMin)
  const { fillMode } = formula
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.fillStyle = renderMode.color
  const { fillAlpha, lineWidth } = renderMode
  ctx.globalAlpha = fillAlpha
  const isXCalc = formula.calcType === 'x' || formula.calcType === 'fx'
  const [baseOffset, baseFactor, fOffset, fFactor] = isXCalc ? [xOffset, xFactor, yOffset, yFactor] : [yOffset, yFactor, xOffset, xFactor]
  if (!isXCalc) {
    ctx.rotate(Math.PI / 2)
    ctx.scale(1, -1)
  }
  ctx.beginPath()
  ctx.rect(0, offset, 2 * offset + size, size)
  ctx.clip()
  if (formula.calcType === 'x' || formula.calcType === 'y') {
    const { fills, plots, alphaFills } = result as RangeResult1D
    const fill = (a: number, b: number) => ctx.fillRect(baseOffset + baseFactor * a, offset, baseFactor * (b - a), size)
    const plot = (a: number) => ctx.fillRect(baseOffset + baseFactor * a - lineWidth / 2, offset, lineWidth, size)
    ctx.fillStyle = ctx.strokeStyle = renderMode.color
    ctx.globalAlpha = fillAlpha
    for (const [min, max] of fills) fill(min, max)
    for (const [min, max, alpha] of alphaFills) {
      ctx.globalAlpha = alpha * fillAlpha
      fill(min, max)
    }
    ctx.globalAlpha = 1
    for (const v of plots) plot(v)
  } else {
    const curves = result as CurveResult
    ctx.fillStyle = ctx.strokeStyle = renderMode.color
    ctx.globalAlpha = fillAlpha
    if (fillMode.positive || fillMode.negative) {
      for (const curve of curves) {
        if (curve.length <= 2) continue
        ctx.beginPath()
        const f = fillMode.negative ? 0 : 2 * offset + size
        const base0 = curve[0]
        const base1 = curve[curve.length - 2]
        ctx.moveTo(baseOffset + baseFactor * base1, f)
        ctx.lineTo(baseOffset + baseFactor * base0, f)
        for (let i = 0; i < curve.length; i+= 2) {
          ctx.lineTo(baseOffset + baseFactor * curve[i], fOffset + fFactor * curve[i + 1])
        }
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    ctx.lineWidth = lineWidth
    ctx.lineJoin = ctx.lineCap = 'round'
    for (const curve of curves) {
      if (curve.length === 0) continue
      const bs = baseOffset + baseFactor * curve[0]
      const fs = fOffset + fFactor * curve[1]
      if (curve.length === 2) {
        ctx.beginPath()
        ctx.arc(bs, fs, lineWidth / 2, 0, 2 * Math.PI)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(bs, fs)
        for (let i = 2; i < curve.length; i+=2) {
          ctx.lineTo(baseOffset + baseFactor * curve[i], fOffset + fFactor * curve[i + 1])
        }
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}
