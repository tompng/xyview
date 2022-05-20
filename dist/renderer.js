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
exports.render = exports.parseFormulas = void 0;
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
        try {
            var valueFuncCode = (0, numcore_1.astToValueFunctionCode)(ast, ['x', 'y']);
            var valueFunc = eval(valueFuncCode);
            var rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, ['x', 'y'], { pos: positive, neg: negative, eq: zero, zero: zero }));
            return { type: 'eq', valueFuncCode: valueFuncCode, valueFunc: valueFunc, rangeFunc: rangeFunc, mode: mode, fillMode: fillMode };
        }
        catch (e) {
            return { type: 'error', error: String(e) };
        }
    });
}
exports.parseFormulas = parseFormulas;
function render(canvas, size, offset, range, formula, renderMode) {
    var xFactor = size / (range.xMax - range.xMin);
    var xOffset = offset - size * range.xMin / (range.xMax - range.xMin);
    var yFactor = size / (range.yMax - range.yMin);
    var yOffset = offset - size * range.yMin / (range.yMax - range.yMin);
    var valueFunc = formula.valueFunc, rangeFunc = formula.rangeFunc, fillMode = formula.fillMode;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = renderMode.color;
    var BOTH = numcore_1.RangeResults.BOTH;
    var fillAlpha = renderMode.fillAlpha, lineWidth = renderMode.lineWidth;
    ctx.globalAlpha = fillAlpha;
    function fill(xMin, yMin, size) {
        ctx.fillRect(xOffset + xFactor * xMin, yOffset + yFactor * yMin, size, size);
    }
    function fillDotWithOpacity(xMin, yMin, opacity) {
        ctx.globalAlpha = opacity * fillAlpha;
        ctx.fillRect(xOffset + xFactor * xMin, yOffset + yFactor * yMin, 1, 1);
        ctx.globalAlpha = fillAlpha;
    }
    var plotPoints = [];
    function calcDot(xMin, xMax, yMin, yMax) {
        if (!fillMode.negative && !fillMode.positive && !fillMode.zero)
            return;
        var x0 = 0.75 * xMin + 0.25 * xMax;
        var x1 = 0.25 * xMin + 0.75 * xMax;
        var y0 = 0.75 * yMin + 0.25 * yMax;
        var y1 = 0.25 * yMin + 0.75 * yMax;
        var v00 = valueFunc(x0, y0);
        var v01 = valueFunc(x0, y1);
        var v10 = valueFunc(x1, y0);
        var v11 = valueFunc(x1, y1);
        var alpha = 0;
        if (fillMode.zero) {
            alpha += ((v00 === 0 ? 1 : 0) + (v01 === 0 ? 1 : 0) + (v10 === 0 ? 1 : 0) + (v11 === 0 ? 1 : 0)) / 4;
        }
        if (fillMode.negative) {
            alpha += ((v00 < 0 ? 1 : 0) + (v01 < 0 ? 1 : 0) + (v10 < 0 ? 1 : 0) + (v11 < 0 ? 1 : 0)) / 4;
        }
        else if (fillMode.positive) {
            alpha += ((v00 > 0 ? 1 : 0) + (v01 > 0 ? 1 : 0) + (v10 > 0 ? 1 : 0) + (v11 > 0 ? 1 : 0)) / 4;
        }
        if (alpha > 0)
            fillDotWithOpacity(xMin, yMin, alpha);
    }
    function calcFull(xMin, xMax, yMin, yMax, size) {
        var _a;
        var dx = (xMax - xMin) / size;
        var dy = (yMax - yMin) / size;
        var values = new Array(size + 1);
        var nextValues = new Array(size + 1);
        for (var ix = 0; ix <= size; ix++)
            values[ix] = valueFunc(xMin + ix * dx, yMin);
        for (var iy = 1; iy <= size; iy++) {
            var y1 = yMin + iy * dy;
            var y0 = y1 - dy;
            for (var ix = 0; ix <= size; ix++)
                nextValues[ix] = valueFunc(xMin + ix * dx, y1);
            for (var ix = 0; ix < size; ix++) {
                var x0 = xMin + ix * dx;
                var x1 = x0 + dx;
                var v00 = values[ix];
                var v10 = values[ix + 1];
                var v01 = nextValues[ix];
                var v11 = nextValues[ix + 1];
                if (fillMode.negative || fillMode.positive || fillMode.zero) {
                    if (fillMode.zero && valueFunc(x0 + dx / 2, y0 + dy / 2) === 0) {
                        fill(x0, y0, 1);
                    }
                    else if (fillMode.negative) {
                        if (v00 < 0 && v01 < 0 && v10 < 0 && v11 < 0) {
                            fill(x0, y0, 1);
                        }
                        else if (v00 < 0 || v01 < 0 || v10 < 0 || v11 < 0) {
                            calcDot(x0, x1, y0, y1);
                        }
                    }
                    else if (fillMode.positive) {
                        if (v00 > 0 && v01 > 0 && v10 > 0 && v11 > 0) {
                            fill(x0, y0, 1);
                        }
                        else if (v00 > 0 || v01 > 0 || v10 > 0 || v11 > 0) {
                            calcDot(x0, x1, y0, y1);
                        }
                    }
                }
                if (v00 * v10 <= 0 && v00 !== v10)
                    plotPoints.push(x0 - dx * v00 / (v10 - v00), y0);
                if (v01 * v11 <= 0 && v01 !== v11)
                    plotPoints.push(x0 - dx * v01 / (v11 - v01), y1);
                if (v00 * v01 <= 0 && v00 !== v01)
                    plotPoints.push(x0, y0 - dy * v00 / (v01 - v00));
                if (v10 * v11 <= 0 && v10 !== v11)
                    plotPoints.push(x1, y0 - dy * v10 / (v11 - v10));
            }
            ;
            _a = __read([nextValues, values], 2), values = _a[0], nextValues = _a[1];
        }
    }
    var fillMask = ((fillMode.positive ? (1 << numcore_1.RangeResults.POSITIVE) : 0) +
        (fillMode.negative ? (1 << numcore_1.RangeResults.NEGATIVE) : 0) +
        (fillMode.zero ? (1 << numcore_1.RangeResults.EQZERO) : 0));
    var ranges = [range.xMin, range.xMax, range.yMin, range.yMax];
    var currentSize = size;
    while (currentSize >= 1) {
        var nextRanges = [];
        for (var i = 0; i < ranges.length; i += 4) {
            var xMin = ranges[i];
            var xMax = ranges[i + 1];
            var yMin = ranges[i + 2];
            var yMax = ranges[i + 3];
            var result = rangeFunc(xMin, xMax, yMin, yMax);
            if (result >= 0) {
                if (((fillMask >> result) & 1) === 1)
                    fill(xMin, yMin, currentSize);
            }
            else if (result === BOTH && currentSize <= 8) {
                calcFull(xMin, xMax, yMin, yMax, currentSize);
            }
            else if (currentSize > 1) {
                var xc = (xMin + xMax) / 2;
                var yc = (yMin + yMax) / 2;
                nextRanges.push(xMin, xc, yMin, yc, xc, xMax, yMin, yc, xMin, xc, yc, yMax, xc, xMax, yc, yMax);
            }
            else {
                calcDot(xMin, xMax, yMin, yMax);
            }
        }
        ranges = nextRanges;
        currentSize /= 2;
    }
    ctx.beginPath();
    for (var i = 0; i < plotPoints.length; i += 2) {
        var x = xOffset + xFactor * plotPoints[i];
        var y = yOffset + yFactor * plotPoints[i + 1];
        ctx.moveTo(x, y);
        ctx.arc(x, y, lineWidth / 2, 0, 2 * Math.PI, true);
    }
    ctx.globalAlpha = 1;
    ctx.fill();
}
exports.render = render;
