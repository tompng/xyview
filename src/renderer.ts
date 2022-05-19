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
  RangeFunction2D,
  Formula
} from 'numcore'

function aliasExpression(exp: string, parsed: Formula): string | null {
  if (!parsed.ast || parsed.type !== 'func') return null
  const funcPart = exp.split('=')[0]
  const match = funcPart.match(/(.+)\(([^,]+)\)/)
  if (!match) return null
  const name = match[1]
  const arg = match[2]
  const deps = [...new Set([arg, ...extractVariables(parsed.ast)])]
  if (deps.length >= 2) return null
  const funcCall = `${name}(${deps[0] === 'y' ? 'y' : 'x'})`
  const axis = deps[0] === 'y' ? 'x' : 'y'
  return `${axis}=${funcCall}`
}

function convertAST(ast: UniqASTNode, mode: CompareMode): [UniqASTNode, CompareMode] {
  const astEquals = (ast: UniqASTNode, arg: 'x' | 'y'): UniqASTNode => ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' })
  const args = extractVariables(ast)
  if (mode == null) {
    if (args.length === 0 || (args.length === 1 && args[0] === 'x')) return [astEquals(ast, 'y'), '=']
    if (args.length === 1 && args[0] === 'y') return [astEquals(ast, 'x'), '=']
  }
  return [ast, mode]
}

export type ParsedEquation = {
  type: 'eq'
  valueFuncCode: string
  valueFunc: ValueFunction2D
  rangeFunc: RangeFunction2D
  mode: NonNullable<CompareMode>
  fillMode: {
    positive: boolean
    negative: boolean
    zero: boolean
  }
}
export type ParsedDefinition = { type: 'func' | 'var'; name: string }
export type ParsedError = { type: 'error', error: string }

export type ParsedFormula = ParsedEquation | ParsedDefinition | ParsedError

export function parseFormulas(expressions: string[]): ParsedFormula[] {
  const args = ['x', 'y']
  let parseds = parse(expressions, args, presets2D)
  const expressionsWithAlias = [...expressions]
  const indices = parseds.map((parsed, index) => {
    const alias = aliasExpression(expressions[index], parsed)
    if (!alias) return index
    expressionsWithAlias.push(alias)
    return expressionsWithAlias.length - 1
  })
  if (expressions.length !== expressionsWithAlias.length) {
    const reParseds = parse(expressionsWithAlias, args, presets2D)
    parseds = indices.map(i => reParseds[i])
  }
  return parseds.map(parsed => {
    if (parsed.type !== 'eq') return { type: parsed.type, name: parsed.name }
    if (!parsed.ast) return { type: 'error', error: String(parsed.error) }
    const [ast, mode] = convertAST(parsed.ast, parsed.mode)
    if (mode == null) return { type: 'error', error: 'not an equation' }
    const positive = mode.includes('>')
    const negative = mode.includes('<')
    const zero = mode.includes('=')
    const fillMode = { positive, negative, zero }
    const valueFuncCode = astToValueFunctionCode(ast, ['x', 'y'])
    const valueFunc: ValueFunction2D = eval(valueFuncCode)
    const rangeFunc: RangeFunction2D = eval(astToRangeFunctionCode(ast, ['x', 'y'], { pos: positive, neg: negative, eq: zero, zero }))
    return { type: 'eq', valueFuncCode, valueFunc, rangeFunc, mode, fillMode }
  })
}

type RenderingRange = { xMin: number; xMax: number; yMin: number; yMax: number }
export function render(
  canvas: HTMLCanvasElement,
  size: number,
  offset: number,
  range: RenderingRange,
  formula: ParsedEquation,
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
  function calcDot(xMin: number, xMax: number, yMin: number, yMax: number) {
    if (!fillMode.negative && !fillMode.positive && !fillMode.zero) return
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
    let values = new Array<number>(size + 1)
    let nextValues = new Array<number>(size + 1)
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
  const fillMask = (
    (fillMode.positive ? (1 << RangeResults.POSITIVE) : 0) +
    (fillMode.negative ? (1 << RangeResults.NEGATIVE) : 0) +
    (fillMode.zero ? (1 << RangeResults.EQZERO) : 0)
  )
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
