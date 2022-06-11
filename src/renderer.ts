import {
  parse,
  RangeResults,
  astToRangeFunctionCode,
  astToValueFunctionCode,
  presets2D,
  UniqASTNode,
  CompareMode,
  ValueFunction2D,
  extractVariables,
  RangeFunction2D
} from 'numcore'

function convertAST(ast: UniqASTNode, mode: CompareMode): [UniqASTNode, CompareMode] {
  const astEquals = (ast: UniqASTNode, arg: 'x' | 'y'): UniqASTNode => ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' })
  const vars = extractVariables(ast)
  if (mode == null && !vars.some(name => name != 'x')) {
    return [astEquals(ast, 'y'), '=']
  } else {
    return [ast, mode]
  }
}
type FillMode = {
  positive: boolean
  negative: boolean
  zero: boolean
}

type ValueFunction1D = (x: number) => number
type RangeFunction1D = (min: number, max: number) => ReturnType<RangeFunction2D>
export type ParsedEquation2D = {
  type: 'eq'
  key: string
  fillMode: FillMode
  valueFunc: ValueFunction2D
  rangeFunc: RangeFunction2D
  calcType: 'xy'
}
export type ParsedEquation1D = {
  type: 'eq'
  key: string
  fillMode: FillMode
  valueFunc: ValueFunction1D
  rangeFunc: RangeFunction1D
  calcType: 'x' | 'y' | 'fx' | 'fy'
}

export type ParsedEquation = ParsedEquation1D | ParsedEquation2D
export type ParsedBlank = { type: 'blank' }
export type ParsedDefinition = { type: 'func' | 'var'; name: string }
export type ParsedError = { type: 'error', error: string }

export type ParsedFormula = ParsedEquation | ParsedDefinition | ParsedError | ParsedBlank

export function parseFormulas(expressions: string[]): ParsedFormula[] {
  const args = ['x', 'y']
  const presentExpressions: string[] = []
  const indices = expressions.map(exp => {
    if (exp.match(/^\s*$/)) return null
    presentExpressions.push(exp)
    return presentExpressions.length - 1
  })
  const results = parse(presentExpressions, args, presets2D)
  return indices.map(index => {
    if (index == null) return { type: 'blank' }
    const parsed = results[index]
    if (parsed.type !== 'eq') return { type: parsed.type, name: parsed.name }
    if (parsed.ast == null) return { type: 'error', error: String(parsed.error) }
    const [ast, mode] = convertAST(parsed.ast, parsed.mode)
    if (mode == null) return { type: 'error', error: 'not an equation' }
    const positive = mode.includes('>')
    const negative = mode.includes('<')
    const zero = mode.includes('=')
    const fillMode = { positive, negative, zero }
    const rangeOption = { pos: positive, neg: negative, eq: zero, zero }
    try {
      if (typeof ast === 'object' && (ast.op === '-' || ast.op === '+') && ast.args.some(arg => typeof arg === 'string')) {
        const [left, right] = ast.args
        const lDeps = extractVariables(left)
        const rDeps = extractVariables(right)
        if (lDeps.length <= 1 && rDeps.length <= 1 && lDeps[0] !== rDeps[0]) {
          if (typeof left === 'string') {
            const axis = left === 'x' ? 'y' : 'x'
            const valueFuncCode = astToValueFunctionCode(right, [axis])
            const valueFunc: ValueFunction1D = eval(valueFuncCode)
            const rangeFunc: RangeFunction1D = eval(astToRangeFunctionCode(right, [axis], rangeOption))
            return {
              type: 'eq',
              key: `${left} left ${mode} ${valueFuncCode}`,
              valueFunc,
              rangeFunc,
              calcType: `f${axis}`,
              fillMode
            }
          } else if (typeof right === 'string') {
            const axis = right === 'x' ? 'y' : 'x'
            const valueFuncCode = astToValueFunctionCode(left, [axis])
            const valueFunc: ValueFunction1D = eval(valueFuncCode)
            const rangeFunc: RangeFunction1D = eval(astToRangeFunctionCode(left, [axis], { pos: negative, neg: positive, eq: zero, zero }))
            return {
              type: 'eq',
              key: `${right} right ${mode} ${valueFuncCode}`,
              valueFunc,
              rangeFunc,
              calcType: `f${axis}`,
              fillMode: { positive: negative, negative: positive, zero }
            }
          }
        }
      }
      const deps = extractVariables(ast) as ('x' | 'y')[]
      if (deps.length === 1) {
        const [varname] = deps
        const valueFuncCode = astToValueFunctionCode(ast, [varname])
        const valueFunc: ValueFunction1D = eval(valueFuncCode)
        const rangeFunc: RangeFunction1D = eval(astToRangeFunctionCode(ast, [varname], rangeOption))
        return { type: 'eq', key: `${varname} ${mode} ${valueFuncCode}`, calcType: varname, valueFunc, rangeFunc, mode, fillMode }
      }
      const valueFuncCode = astToValueFunctionCode(ast, ['x', 'y'])
      const valueFunc: ValueFunction2D = eval(valueFuncCode)
      const rangeFunc: RangeFunction2D = eval(astToRangeFunctionCode(ast, ['x', 'y'], rangeOption))
      return { type: 'eq', calcType: 'xy', key: `xy ${mode} ${valueFuncCode}`, valueFunc, rangeFunc, fillMode }
    } catch (e) {
      return { type: 'error', error: String(e) }
    }
  })
}

function fillModeToMask(fillMode: FillMode) {
  return (
    (fillMode.positive ? (1 << RangeResults.POSITIVE) : 0) +
    (fillMode.negative ? (1 << RangeResults.NEGATIVE) : 0) +
    (fillMode.zero ? (1 << RangeResults.EQZERO) : 0)
  )
}

type RenderingRange = { xMin: number; xMax: number; yMin: number; yMax: number }
export function render(
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
  const skipCalcDot = !fillMode.negative && !fillMode.positive && !fillMode.zero
  function calcDot(xMin: number, xMax: number, yMin: number, yMax: number) {
    if (skipCalcDot) return
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
        if (fillMode.negative || fillMode.positive || fillMode.zero) {
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

function calc1DRange(formula: ParsedEquation1D, size: number, min: number, max: number) {
  const { valueFunc, rangeFunc, fillMode } = formula
  const fillMask = fillModeToMask(fillMode)
  type Range = [number, number]
  let ranges: Range[] = [[min, max]]
  let currentSize = size
  const fills: Range[] = []
  const alphaFills: [number, number, number][] = []
  const plots: number[] = []
  const { BOTH } = RangeResults
  const skipCalcDot = !fillMode.negative && !fillMode.positive && !fillMode.zero
  function calcDot(min: number, max: number) {
    if (skipCalcDot) return
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
      if (fillMode.negative || fillMode.positive || fillMode.zero) {
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

function calc1DValues(formula: ParsedEquation1D, size: number, min: number, max: number) {
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
  const [baseAxisMin, baseAxisMax] = isXCalc ? [range.xMin, range.xMax] : [range.yMin, range.yMax]
  if (!isXCalc) {
    ctx.rotate(Math.PI / 2)
    ctx.scale(1, -1)
  }
  ctx.beginPath()
  ctx.rect(0, offset, 2 * offset + size, size)
  ctx.clip()
  if (formula.calcType === 'x' || formula.calcType === 'y') {
    const { fills, plots, alphaFills } = calc1DRange(formula, size, baseAxisMin, baseAxisMax)
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
    const curves = calc1DValues(formula, size, baseAxisMin, baseAxisMax)
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
