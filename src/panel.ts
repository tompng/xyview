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
} from 'numcore'

function parseExpression(exp: string): [UniqASTNode, Exclude<CompareMode, null>] {
  const argNames = ['x', 'y']
  let parsed = parse(exp, argNames, presets2D)
  const astEquals = (ast: UniqASTNode, arg: 'x' | 'y'): UniqASTNode => ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' })
  if (parsed.type === 'var') {
    const name = exp.split('=')[0]
    parsed = parse([exp, name], argNames, presets2D)[1]
    if (extractVariables(parsed.ast!).length === 2) throw `cannot render ${name}`
  } else if (parsed.type === 'func' && parsed.ast) {
    const funcPart = exp.split('=')[0]
    const match = funcPart.match(/(.+)\(([^,]+)\)/)
    const cannotRenderMessage = `cannot render ${funcPart}`
    if (!match) throw cannotRenderMessage
    const name = match[1]
    const arg = match[2]
    const deps = [...new Set([arg, ...extractVariables(parsed.ast)])]
    if (deps.length >= 2) throw cannotRenderMessage
    const funcCall = `${name}(${deps[0] === 'y' ? 'y' : 'x'})`
    const axis = deps[0] === 'y' ? 'x' : 'y'
    parsed = parse([exp, `${axis}=${funcCall}`], argNames, presets2D)[1]
  }
  if (parsed.error != null || parsed.ast == null) throw parsed.error
  if (parsed.type !== 'eq') throw 'not an equation'
  const args = extractVariables(parsed.ast)
  if (parsed.mode == null) {
    if (args.length >= 2) throw 'not an equation'
    if (args.length === 0 || (args.length === 1 && args[0] === 'x')) {
      return [astEquals(parsed.ast, 'y'), '=']
    }
    if (args.length === 1 && args[0] === 'y') {
      return [astEquals(parsed.ast, 'x'), '=']
    }
    throw 'not an equation'
  }
  return [parsed.ast, parsed.mode]
}

export function parseFormula(exp: string) {
  const [ast, mode] = parseExpression(exp)
  const positive = mode.includes('>')
  const negative = mode.includes('<')
  const zero = mode.includes('=')
  const func = {
    value: eval(astToValueFunctionCode(ast, ['x', 'y'])),
    range: eval(astToRangeFunctionCode(ast, ['x', 'y'], { pos: positive, neg: negative, eq: zero, zero })),
  }
  return { func, mode: { positive, negative, zero } }
}

type RenderingRange = { xMin: number; xMax: number; yMin: number; yMax: number }
export function render(
  canvas: HTMLCanvasElement,
  size: number,
  offset: number,
  range: RenderingRange,
  func: { value: ValueFunction2D; range: RangeFunction2D },
  fillMode: {
    positive?: boolean
    negative?: boolean
    zero?: boolean
  },
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
  const fValue = func.value
  const fRange = func.range
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
    const v00 = fValue(x0, y0)
    const v01 = fValue(x0, y1)
    const v10 = fValue(x1, y0)
    const v11 = fValue(x1, y1)
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
    for (let ix = 0; ix <= size; ix++) values[ix] = fValue(xMin + ix * dx, yMin)
    for (let iy = 1; iy <= size; iy++) {
      const y1 = yMin + iy * dy
      const y0 = y1 - dy
      for (let ix = 0; ix <= size; ix++) nextValues[ix] = fValue(xMin + ix * dx, y1)
      for (let ix = 0; ix < size; ix++) {
        const x0 = xMin + ix * dx
        const x1 = x0 + dx
        const v00 = values[ix]
        const v10 = values[ix + 1]
        const v01 = nextValues[ix]
        const v11 = nextValues[ix + 1]
        if (fillMode.negative || fillMode.positive || fillMode.zero) {
          if (fillMode.zero && fValue(x0 + dx / 2, y0 + dy / 2) === 0) {
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
      const result = fRange(xMin, xMax, yMin, yMax)
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
