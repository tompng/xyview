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
function parseFormulas(expressions) {
    const args = ['x', 'y'];
    const presentExpressions = [];
    const indices = expressions.map(exp => {
        if (exp.match(/^\s*$/))
            return null;
        presentExpressions.push(exp);
        return presentExpressions.length - 1;
    });
    const results = (0, numcore_1.parse)(presentExpressions, args, numcore_1.presets2D);
    return indices.map(index => {
        if (index == null)
            return { type: 'blank' };
        const parsed = results[index];
        if (parsed.type !== 'eq')
            return { type: parsed.type, name: parsed.name };
        if (parsed.ast == null)
            return { type: 'error', error: String(parsed.error) };
        const [ast, mode] = convertAST(parsed.ast, parsed.mode);
        if (mode == null)
            return { type: 'error', error: 'not an equation' };
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
                            fillMode
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
                            fillMode: { positive: negative, negative: positive, zero }
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
                return { type: 'eq', key: `${varname} ${mode} ${valueFuncCode}`, calcType: varname, valueFunc, rangeFunc, mode, fillMode };
            }
            const valueFuncCode = (0, numcore_1.astToValueFunctionCode)(ast, ['x', 'y']);
            const valueFunc = eval(valueFuncCode);
            const rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, ['x', 'y'], rangeOption));
            return { type: 'eq', calcType: 'xy', key: `xy ${mode} ${valueFuncCode}`, valueFunc, rangeFunc, fillMode };
        }
        catch (e) {
            return { type: 'error', error: String(e) };
        }
    });
}
exports.parseFormulas = parseFormulas;
