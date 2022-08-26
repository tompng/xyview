import {
  parse,
  astToRangeFunctionCode,
  astToValueFunctionCode,
  presets2D,
  UniqASTNode,
  CompareMode,
  ValueFunction2D,
  extractVariables,
  RangeFunction2D,
  RangeResults
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

function nanExpressionWarning(fRange: RangeFunction1D) {
  const result = fRange(-Infinity, Infinity)
  if (result === RangeResults.EQNAN) return 'Always NaN'
}

function constantConditionWarning(rangeOption: { pos: boolean; neg: boolean; zero: boolean }, ...args: [1, RangeFunction1D] | [2, RangeFunction2D]) {
  const result = args[0] === 1 ? args[1](-Infinity, Infinity) : args[1](-Infinity, Infinity, -Infinity, Infinity)
  if (result === RangeResults.EQNAN) return 'Always NaN'
  const both = result === RangeResults.BOTH || result === RangeResults.HASGAP || result === RangeResults.HASNAN
  const pos = both || result === RangeResults.POSITIVE
  const neg = both || result === RangeResults.NEGATIVE
  const zero = both || result === RangeResults.EQZERO
  const other = result === RangeResults.OTHER
  const hasTrue = (neg && rangeOption.neg) || (zero && rangeOption.zero) || (pos && rangeOption.pos)
  const hasFalse = other || (neg && !rangeOption.neg) || (zero && !rangeOption.zero)|| (pos && !rangeOption.pos)
  if (!hasFalse) return 'Condition always true'
  if (!hasTrue) return 'Condition always false'
}

export type FillMode = {
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
  warn?: string
}
export type ParsedEquation1D = {
  type: 'eq'
  key: string
  fillMode: FillMode
  valueFunc: ValueFunction1D
  rangeFunc: RangeFunction1D
  calcType: 'x' | 'y' | 'fx' | 'fy'
  warn?: string
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
    if (mode == null) return { type: 'error', error: 'Not an equation' }
    const positive = mode.includes('>')
    const negative = mode.includes('<')
    const zero = mode.includes('=')
    const fillMode = { positive, negative, zero }
    const rangeOption = { pos: positive, neg: negative, eq: zero, zero }
    try {
      if (typeof ast === 'object' && ast.op === '-' && ast.args.some(arg => typeof arg === 'string')) {
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
              fillMode,
              warn: nanExpressionWarning(rangeFunc)
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
              fillMode: { positive: negative, negative: positive, zero },
              warn: nanExpressionWarning(rangeFunc)
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
        const key = `${varname} ${mode} ${valueFuncCode}`
        const warn = constantConditionWarning(rangeOption, 1, rangeFunc)
        return { type: 'eq', key, calcType: varname, valueFunc, rangeFunc, fillMode, warn }
      }
      const valueFuncCode = astToValueFunctionCode(ast, ['x', 'y'])
      const valueFunc: ValueFunction2D = eval(valueFuncCode)
      const rangeFunc: RangeFunction2D = eval(astToRangeFunctionCode(ast, ['x', 'y'], rangeOption))
      const key = `xy ${mode} ${valueFuncCode}`
      const warn = constantConditionWarning(rangeOption, 2, rangeFunc)
      return { type: 'eq', calcType: 'xy', key, valueFunc, rangeFunc, fillMode, warn }
    } catch (e) {
      return { type: 'error', error: String(e) }
    }
  })
}
