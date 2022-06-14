"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFormulas = void 0;
var numcore_1 = require("numcore");
function convertAST(ast, mode) {
    var astEquals = function (ast, arg) { return ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' }); };
    var vars = (0, numcore_1.extractVariables)(ast);
    if (mode == null && !vars.some(function (name) { return name != 'x'; })) {
        return [astEquals(ast, 'y'), '='];
    }
    else {
        return [ast, mode];
    }
}
function parseFormulas(expressions) {
    var args = ['x', 'y'];
    var presentExpressions = [];
    var indices = expressions.map(function (exp) {
        if (exp.match(/^\s*$/))
            return null;
        presentExpressions.push(exp);
        return presentExpressions.length - 1;
    });
    var results = (0, numcore_1.parse)(presentExpressions, args, numcore_1.presets2D);
    return indices.map(function (index) {
        if (index == null)
            return { type: 'blank' };
        var parsed = results[index];
        if (parsed.type !== 'eq')
            return { type: parsed.type, name: parsed.name };
        if (parsed.ast == null)
            return { type: 'error', error: String(parsed.error) };
        var _a = __read(convertAST(parsed.ast, parsed.mode), 2), ast = _a[0], mode = _a[1];
        if (mode == null)
            return { type: 'error', error: 'not an equation' };
        var positive = mode.includes('>');
        var negative = mode.includes('<');
        var zero = mode.includes('=');
        var fillMode = { positive: positive, negative: negative, zero: zero };
        var rangeOption = { pos: positive, neg: negative, eq: zero, zero: zero };
        try {
            if (typeof ast === 'object' && ast.op === '-' && ast.args.some(function (arg) { return typeof arg === 'string'; })) {
                var _b = __read(ast.args, 2), left = _b[0], right = _b[1];
                var lDeps = (0, numcore_1.extractVariables)(left);
                var rDeps = (0, numcore_1.extractVariables)(right);
                if (lDeps.length <= 1 && rDeps.length <= 1 && lDeps[0] !== rDeps[0]) {
                    if (typeof left === 'string') {
                        var axis = left === 'x' ? 'y' : 'x';
                        var valueFuncCode_1 = (0, numcore_1.astToValueFunctionCode)(right, [axis]);
                        var valueFunc_1 = eval(valueFuncCode_1);
                        var rangeFunc_1 = eval((0, numcore_1.astToRangeFunctionCode)(right, [axis], rangeOption));
                        return {
                            type: 'eq',
                            key: "".concat(left, " left ").concat(mode, " ").concat(valueFuncCode_1),
                            valueFunc: valueFunc_1,
                            rangeFunc: rangeFunc_1,
                            calcType: "f".concat(axis),
                            fillMode: fillMode
                        };
                    }
                    else if (typeof right === 'string') {
                        var axis = right === 'x' ? 'y' : 'x';
                        var valueFuncCode_2 = (0, numcore_1.astToValueFunctionCode)(left, [axis]);
                        var valueFunc_2 = eval(valueFuncCode_2);
                        var rangeFunc_2 = eval((0, numcore_1.astToRangeFunctionCode)(left, [axis], { pos: negative, neg: positive, eq: zero, zero: zero }));
                        return {
                            type: 'eq',
                            key: "".concat(right, " right ").concat(mode, " ").concat(valueFuncCode_2),
                            valueFunc: valueFunc_2,
                            rangeFunc: rangeFunc_2,
                            calcType: "f".concat(axis),
                            fillMode: { positive: negative, negative: positive, zero: zero }
                        };
                    }
                }
            }
            var deps = (0, numcore_1.extractVariables)(ast);
            if (deps.length === 1) {
                var _c = __read(deps, 1), varname = _c[0];
                var valueFuncCode_3 = (0, numcore_1.astToValueFunctionCode)(ast, [varname]);
                var valueFunc_3 = eval(valueFuncCode_3);
                var rangeFunc_3 = eval((0, numcore_1.astToRangeFunctionCode)(ast, [varname], rangeOption));
                return { type: 'eq', key: "".concat(varname, " ").concat(mode, " ").concat(valueFuncCode_3), calcType: varname, valueFunc: valueFunc_3, rangeFunc: rangeFunc_3, mode: mode, fillMode: fillMode };
            }
            var valueFuncCode = (0, numcore_1.astToValueFunctionCode)(ast, ['x', 'y']);
            var valueFunc = eval(valueFuncCode);
            var rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, ['x', 'y'], rangeOption));
            return { type: 'eq', calcType: 'xy', key: "xy ".concat(mode, " ").concat(valueFuncCode), valueFunc: valueFunc, rangeFunc: rangeFunc, fillMode: fillMode };
        }
        catch (e) {
            return { type: 'error', error: String(e) };
        }
    });
}
exports.parseFormulas = parseFormulas;
