"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFormulas = void 0;
const numcore_1 = require("numcore");
function convertAST(ast, mode) {
    const astEquals = (ast, arg) => ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' });
    const vars = (0, numcore_1.extractVariables)(ast);
    if (mode == null && !vars.some(name => name != 'x')) {
        return [astEquals(ast, 'y'), '='];
    }
    else {
        return [ast, mode];
    }
}
function nanExpressionWarning(fRange) {
    const result = fRange(-Infinity, Infinity);
    if (result === numcore_1.RangeResults.EQNAN)
        return 'Always NaN';
}
function constantConditionWarning(rangeOption, ...args) {
    const result = args[0] === 1 ? args[1](-Infinity, Infinity) : args[1](-Infinity, Infinity, -Infinity, Infinity);
    if (result === numcore_1.RangeResults.EQNAN)
        return 'Always NaN';
    const both = result === numcore_1.RangeResults.BOTH || result === numcore_1.RangeResults.HASGAP || result === numcore_1.RangeResults.HASNAN;
    const pos = both || result === numcore_1.RangeResults.POSITIVE;
    const neg = both || result === numcore_1.RangeResults.NEGATIVE;
    const zero = both || result === numcore_1.RangeResults.EQZERO;
    const other = result === numcore_1.RangeResults.OTHER;
    const hasTrue = (neg && rangeOption.neg) || (zero && rangeOption.zero) || (pos && rangeOption.pos);
    const hasFalse = other || (neg && !rangeOption.neg) || (zero && !rangeOption.zero) || (pos && !rangeOption.pos);
    if (!hasFalse)
        return 'Condition always true';
    if (!hasTrue)
        return 'Condition always false';
}
function parseFormulas(expressions) {
    const args = ['x', 'y'];
    const overridableArgs = ['t'];
    const presentExpressions = [];
    const indices = expressions.map(exp => {
        if (exp.match(/^\s*$/))
            return null;
        presentExpressions.push(exp);
        return presentExpressions.length - 1;
    });
    const results = (0, numcore_1.parse)(presentExpressions, args, overridableArgs, numcore_1.presets2D);
    return indices.map(index => {
        if (index == null)
            return { type: 'blank' };
        const parsed = results[index];
        if (parsed.type === 'point') {
            if (parsed.axis == null || parsed.error)
                return { type: 'error', error: String(parsed.error) };
            if (parsed.axis.length !== 2)
                return { type: 'error', error: 'Not 2D point' };
            const [xAst, yAst] = parsed.axis;
            if (typeof xAst === 'number' && typeof yAst === 'number') {
                return { type: 'point', key: `point(${xAst},${yAst})`, x: xAst, y: yAst };
            }
            const deps = [...(0, numcore_1.extractVariables)(xAst), ...(0, numcore_1.extractVariables)(yAst)];
            if (deps.includes('x') || deps.includes('y'))
                return { type: 'error', error: 'Point cannot depend on x or y' };
            const xCode = (0, numcore_1.astToValueFunctionCode)(xAst, ['t']);
            const yCode = (0, numcore_1.astToValueFunctionCode)(yAst, ['t']);
            const xFunc = eval(xCode);
            const yFunc = eval(yCode);
            return {
                type: 'parametric',
                key: `point(${xCode},${yCode})`,
                x: xFunc,
                y: yFunc,
            };
        }
        if (parsed.type !== 'eq')
            return { type: parsed.type, name: parsed.name };
        if (parsed.ast == null)
            return { type: 'error', error: String(parsed.error) };
        if ((0, numcore_1.extractVariables)(parsed.ast).includes('t'))
            return { type: 'error', error: 'Unknown parameter t' };
        const [ast, mode] = convertAST(parsed.ast, parsed.mode);
        if (mode == null)
            return { type: 'error', error: 'Not an equation' };
        const positive = mode.includes('>');
        const negative = mode.includes('<');
        const zero = mode.includes('=');
        const fillMode = { positive, negative, zero };
        const rangeOption = { pos: positive, neg: negative, eq: zero, zero };
        try {
            if (typeof ast === 'object' && ast.op === '-' && ast.args.some(arg => typeof arg === 'string')) {
                const [left, right] = ast.args;
                const lDeps = (0, numcore_1.extractVariables)(left);
                const rDeps = (0, numcore_1.extractVariables)(right);
                if (lDeps.length <= 1 && rDeps.length <= 1 && lDeps[0] !== rDeps[0]) {
                    if (typeof left === 'string') {
                        const axis = left === 'x' ? 'y' : 'x';
                        const valueFuncCode = (0, numcore_1.astToValueFunctionCode)(right, [axis]);
                        const valueFunc = eval(valueFuncCode);
                        const rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(right, [axis], rangeOption));
                        return {
                            type: 'eq',
                            key: `${left} left ${mode} ${valueFuncCode}`,
                            valueFunc,
                            rangeFunc,
                            calcType: `f${axis}`,
                            fillMode,
                            warn: nanExpressionWarning(rangeFunc)
                        };
                    }
                    else if (typeof right === 'string') {
                        const axis = right === 'x' ? 'y' : 'x';
                        const valueFuncCode = (0, numcore_1.astToValueFunctionCode)(left, [axis]);
                        const valueFunc = eval(valueFuncCode);
                        const rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(left, [axis], { pos: negative, neg: positive, eq: zero, zero }));
                        return {
                            type: 'eq',
                            key: `${right} right ${mode} ${valueFuncCode}`,
                            valueFunc,
                            rangeFunc,
                            calcType: `f${axis}`,
                            fillMode: { positive: negative, negative: positive, zero },
                            warn: nanExpressionWarning(rangeFunc)
                        };
                    }
                }
            }
            const deps = (0, numcore_1.extractVariables)(ast);
            if (deps.length === 1) {
                const [varname] = deps;
                const valueFuncCode = (0, numcore_1.astToValueFunctionCode)(ast, [varname]);
                const valueFunc = eval(valueFuncCode);
                const rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, [varname], rangeOption));
                const key = `${varname} ${mode} ${valueFuncCode}`;
                const warn = constantConditionWarning(rangeOption, 1, rangeFunc);
                return { type: 'eq', key, calcType: varname, valueFunc, rangeFunc, fillMode, warn };
            }
            const valueFuncCode = (0, numcore_1.astToValueFunctionCode)(ast, ['x', 'y']);
            const valueFunc = eval(valueFuncCode);
            const rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, ['x', 'y'], rangeOption));
            const key = `xy ${mode} ${valueFuncCode}`;
            const warn = constantConditionWarning(rangeOption, 2, rangeFunc);
            return { type: 'eq', calcType: 'xy', key, valueFunc, rangeFunc, fillMode, warn };
        }
        catch (e) {
            return { type: 'error', error: String(e) };
        }
    });
}
exports.parseFormulas = parseFormulas;
