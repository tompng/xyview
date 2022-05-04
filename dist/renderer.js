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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = exports.parseFormula = void 0;
var numcore_1 = require("numcore");
function parseExpression(exp) {
    var argNames = ['x', 'y'];
    var parsed = (0, numcore_1.parse)(exp, argNames, numcore_1.presets2D);
    var astEquals = function (ast, arg) { return ({ op: '-', args: [arg, ast], uniqId: -1, uniqKey: '' }); };
    if (parsed.type === 'var') {
        var name_1 = exp.split('=')[0];
        parsed = (0, numcore_1.parse)([exp, name_1], argNames, numcore_1.presets2D)[1];
        if ((0, numcore_1.extractVariables)(parsed.ast).length === 2)
            throw "cannot render ".concat(name_1);
    }
    else if (parsed.type === 'func' && parsed.ast) {
        var funcPart = exp.split('=')[0];
        var match = funcPart.match(/(.+)\(([^,]+)\)/);
        var cannotRenderMessage = "cannot render ".concat(funcPart);
        if (!match)
            throw cannotRenderMessage;
        var name_2 = match[1];
        var arg = match[2];
        var deps = __spreadArray([], __read(new Set(__spreadArray([arg], __read((0, numcore_1.extractVariables)(parsed.ast)), false))), false);
        if (deps.length >= 2)
            throw cannotRenderMessage;
        var funcCall = "".concat(name_2, "(").concat(deps[0] === 'y' ? 'y' : 'x', ")");
        var axis = deps[0] === 'y' ? 'x' : 'y';
        parsed = (0, numcore_1.parse)([exp, "".concat(axis, "=").concat(funcCall)], argNames, numcore_1.presets2D)[1];
    }
    if (parsed.error != null || parsed.ast == null)
        throw parsed.error;
    if (parsed.type !== 'eq')
        throw 'not an equation';
    var args = (0, numcore_1.extractVariables)(parsed.ast);
    if (parsed.mode == null) {
        if (args.length >= 2)
            throw 'not an equation';
        if (args.length === 0 || (args.length === 1 && args[0] === 'x')) {
            return [astEquals(parsed.ast, 'y'), '='];
        }
        if (args.length === 1 && args[0] === 'y') {
            return [astEquals(parsed.ast, 'x'), '='];
        }
        throw 'not an equation';
    }
    return [parsed.ast, parsed.mode];
}
function parseFormula(exp) {
    var _a = __read(parseExpression(exp), 2), ast = _a[0], mode = _a[1];
    var positive = mode.includes('>');
    var negative = mode.includes('<');
    var zero = mode.includes('=');
    var valueFunc = eval((0, numcore_1.astToValueFunctionCode)(ast, ['x', 'y']));
    var rangeFunc = eval((0, numcore_1.astToRangeFunctionCode)(ast, ['x', 'y'], { pos: positive, neg: negative, eq: zero, zero: zero }));
    return { valueFunc: valueFunc, rangeFunc: rangeFunc, mode: { positive: positive, negative: negative, zero: zero } };
}
exports.parseFormula = parseFormula;
function render(canvas, size, offset, range, formula, renderMode) {
    var xFactor = size / (range.xMax - range.xMin);
    var xOffset = offset - size * range.xMin / (range.xMax - range.xMin);
    var yFactor = size / (range.yMax - range.yMin);
    var yOffset = offset - size * range.yMin / (range.yMax - range.yMin);
    var fValue = formula.valueFunc;
    var fRange = formula.rangeFunc;
    var fillMode = formula.mode;
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
        var v00 = fValue(x0, y0);
        var v01 = fValue(x0, y1);
        var v10 = fValue(x1, y0);
        var v11 = fValue(x1, y1);
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
            values[ix] = fValue(xMin + ix * dx, yMin);
        for (var iy = 1; iy <= size; iy++) {
            var y1 = yMin + iy * dy;
            var y0 = y1 - dy;
            for (var ix = 0; ix <= size; ix++)
                nextValues[ix] = fValue(xMin + ix * dx, y1);
            for (var ix = 0; ix < size; ix++) {
                var x0 = xMin + ix * dx;
                var x1 = x0 + dx;
                var v00 = values[ix];
                var v10 = values[ix + 1];
                var v01 = nextValues[ix];
                var v11 = nextValues[ix + 1];
                if (fillMode.negative || fillMode.positive || fillMode.zero) {
                    if (fillMode.zero && fValue(x0 + dx / 2, y0 + dy / 2) === 0) {
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
            var result = fRange(xMin, xMax, yMin, yMax);
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
