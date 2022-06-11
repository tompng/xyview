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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render1D = exports.calc1DCurves = exports.calc1DRange = exports.render2D = void 0;
var numcore_1 = require("numcore");
function fillModeToMask(fillMode) {
    return ((fillMode.positive ? (1 << numcore_1.RangeResults.POSITIVE) : 0) +
        (fillMode.negative ? (1 << numcore_1.RangeResults.NEGATIVE) : 0) +
        (fillMode.zero ? (1 << numcore_1.RangeResults.EQZERO) : 0));
}
function render2D(canvas, size, offset, range, formula, renderMode) {
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
    var hasFill = fillMode.negative || fillMode.positive || fillMode.zero;
    function calcDot(xMin, xMax, yMin, yMax) {
        if (!hasFill)
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
        var values = [];
        var nextValues = [];
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
                if (hasFill) {
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
    var fillMask = fillModeToMask(fillMode);
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
exports.render2D = render2D;
var fullCalcSubPixelStep = 4;
var subPixelStep = 64;
function calc1DRange(formula, size, min, max) {
    var e_1, _a, e_2, _b;
    var plots = [];
    var fills = [];
    var alphaFills = [];
    var valueFunc = formula.valueFunc, rangeFunc = formula.rangeFunc, fillMode = formula.fillMode;
    var BOTH = numcore_1.RangeResults.BOTH;
    var delta = (max - min) / size;
    var lengths = [];
    var fill = function (a, b, pixel) {
        if (pixel >= 2) {
            var start = Math.round(size * (a - min) / (max - min));
            for (var i = 0; i < pixel; i++)
                lengths[start + i] = delta;
        }
        else {
            lengths[Math.floor(size * ((a + b) / 2 - min) / (max - min))] += b - a;
        }
    };
    var fillMask = fillModeToMask(fillMode);
    var ranges = [[min, max]];
    var currentSize = size;
    while (ranges.length && ranges.length <= size && currentSize >= 1 / subPixelStep) {
        var nextRanges = [];
        try {
            for (var ranges_1 = (e_1 = void 0, __values(ranges)), ranges_1_1 = ranges_1.next(); !ranges_1_1.done; ranges_1_1 = ranges_1.next()) {
                var _c = __read(ranges_1_1.value, 2), min_1 = _c[0], max_1 = _c[1];
                var result = rangeFunc(min_1, max_1);
                if (result >= 0) {
                    if (((fillMask >> result) & 1) === 1)
                        fill(min_1, max_1, currentSize);
                }
                else if (currentSize > 1 / subPixelStep) {
                    var center = (min_1 + max_1) / 2;
                    nextRanges.push([min_1, center], [center, max_1]);
                }
                else if (result === BOTH) {
                    nextRanges.push([min_1, max_1]);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (ranges_1_1 && !ranges_1_1.done && (_a = ranges_1.return)) _a.call(ranges_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        ranges = nextRanges;
        currentSize /= 2;
    }
    try {
        for (var ranges_2 = __values(ranges), ranges_2_1 = ranges_2.next(); !ranges_2_1.done; ranges_2_1 = ranges_2.next()) {
            var _d = __read(ranges_2_1.value, 2), min_2 = _d[0], max_2 = _d[1];
            var fmin = valueFunc(min_2);
            var fmax = valueFunc(max_2);
            if (fmin === 0 && fmax === 0) {
                if (fillMode.zero)
                    fill(min_2, max_2, currentSize);
            }
            else if (fmin * fmax <= 0) {
                var center = min_2 + (max_2 - min_2) * fmin / (fmin - fmax);
                plots.push(center);
                if (fmin > 0 ? fillMode.positive : fillMode.negative) {
                    fill(min_2, center, currentSize);
                }
                else if (fillMode.negative) {
                    fill(center, max_2, currentSize);
                }
            }
            else if (fmin > 0 ? fillMode.positive : fillMode.negative) {
                fill(min_2, max_2, currentSize);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (ranges_2_1 && !ranges_2_1.done && (_b = ranges_2.return)) _b.call(ranges_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var threshold = delta * 0.999;
    lengths.forEach(function (len, index) {
        if (len === 0)
            return;
        var a = min + delta * index;
        var b = min + delta * (index + 1);
        if (len > threshold) {
            var last = fills[fills.length - 1];
            if ((last === null || last === void 0 ? void 0 : last[1]) === a)
                last[1] = b;
            else
                fills.push([a, b]);
        }
        else {
            alphaFills.push([a, b, len / delta]);
        }
    });
    return { fills: fills, plots: plots, alphaFills: alphaFills };
}
exports.calc1DRange = calc1DRange;
function calc1DCurves(formula, size, min, max) {
    var e_3, _a;
    var valueFunc = formula.valueFunc, rangeFunc = formula.rangeFunc;
    var ranges = [[min, max]];
    var currentSize = size;
    var curves = [];
    var BOTH = numcore_1.RangeResults.BOTH, EQNAN = numcore_1.RangeResults.EQNAN;
    function calcFull(min, max, size) {
        var d = (max - min) / size;
        var curve = [];
        curves.push(curve);
        for (var i = 0; i <= size; i++) {
            var x = min + d * i;
            var v = valueFunc(x);
            if (isNaN(v)) {
                curve = [];
                curves.push(curve);
            }
            else {
                curve.push(x, v);
            }
        }
    }
    while (ranges.length && ranges.length <= size) {
        var nextRanges = [];
        try {
            for (var ranges_3 = (e_3 = void 0, __values(ranges)), ranges_3_1 = ranges_3.next(); !ranges_3_1.done; ranges_3_1 = ranges_3.next()) {
                var _b = __read(ranges_3_1.value, 2), min_3 = _b[0], max_3 = _b[1];
                var result = rangeFunc(min_3, max_3);
                if (result === EQNAN)
                    continue;
                if (result >= 0 || result === BOTH) {
                    calcFull(min_3, max_3, Math.max(fullCalcSubPixelStep * currentSize, 1));
                }
                else if (currentSize > 1 / subPixelStep) {
                    var center = (min_3 + max_3) / 2;
                    nextRanges.push([min_3, center], [center, max_3]);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (ranges_3_1 && !ranges_3_1.done && (_a = ranges_3.return)) _a.call(ranges_3);
            }
            finally { if (e_3) throw e_3.error; }
        }
        ranges = nextRanges;
        currentSize /= 2;
    }
    return curves;
}
exports.calc1DCurves = calc1DCurves;
function render1D(canvas, size, offset, range, formula, result, renderMode) {
    var e_4, _a, e_5, _b, e_6, _c, e_7, _d, e_8, _e;
    var xFactor = size / (range.xMax - range.xMin);
    var xOffset = offset - size * range.xMin / (range.xMax - range.xMin);
    var yFactor = size / (range.yMax - range.yMin);
    var yOffset = offset - size * range.yMin / (range.yMax - range.yMin);
    var fillMode = formula.fillMode;
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = renderMode.color;
    var fillAlpha = renderMode.fillAlpha, lineWidth = renderMode.lineWidth;
    ctx.globalAlpha = fillAlpha;
    var isXCalc = formula.calcType === 'x' || formula.calcType === 'fx';
    var _f = __read(isXCalc ? [xOffset, xFactor, yOffset, yFactor] : [yOffset, yFactor, xOffset, xFactor], 4), baseOffset = _f[0], baseFactor = _f[1], fOffset = _f[2], fFactor = _f[3];
    if (!isXCalc) {
        ctx.rotate(Math.PI / 2);
        ctx.scale(1, -1);
    }
    ctx.beginPath();
    ctx.rect(0, offset, 2 * offset + size, size);
    ctx.clip();
    if (formula.calcType === 'x' || formula.calcType === 'y') {
        var _g = result, fills = _g.fills, plots = _g.plots, alphaFills = _g.alphaFills;
        var fill = function (a, b) { return ctx.fillRect(baseOffset + baseFactor * a, offset, baseFactor * (b - a), size); };
        var plot = function (a) { return ctx.fillRect(baseOffset + baseFactor * a - lineWidth / 2, offset, lineWidth, size); };
        ctx.fillStyle = ctx.strokeStyle = renderMode.color;
        ctx.globalAlpha = fillAlpha;
        try {
            for (var fills_1 = __values(fills), fills_1_1 = fills_1.next(); !fills_1_1.done; fills_1_1 = fills_1.next()) {
                var _h = __read(fills_1_1.value, 2), min = _h[0], max = _h[1];
                fill(min, max);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (fills_1_1 && !fills_1_1.done && (_a = fills_1.return)) _a.call(fills_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        try {
            for (var alphaFills_1 = __values(alphaFills), alphaFills_1_1 = alphaFills_1.next(); !alphaFills_1_1.done; alphaFills_1_1 = alphaFills_1.next()) {
                var _j = __read(alphaFills_1_1.value, 3), min = _j[0], max = _j[1], alpha = _j[2];
                ctx.globalAlpha = alpha * fillAlpha;
                fill(min, max);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (alphaFills_1_1 && !alphaFills_1_1.done && (_b = alphaFills_1.return)) _b.call(alphaFills_1);
            }
            finally { if (e_5) throw e_5.error; }
        }
        ctx.globalAlpha = 1;
        try {
            for (var plots_1 = __values(plots), plots_1_1 = plots_1.next(); !plots_1_1.done; plots_1_1 = plots_1.next()) {
                var v = plots_1_1.value;
                plot(v);
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (plots_1_1 && !plots_1_1.done && (_c = plots_1.return)) _c.call(plots_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
    }
    else {
        var curves = result;
        ctx.fillStyle = ctx.strokeStyle = renderMode.color;
        ctx.globalAlpha = fillAlpha;
        if (fillMode.positive || fillMode.negative) {
            try {
                for (var curves_1 = __values(curves), curves_1_1 = curves_1.next(); !curves_1_1.done; curves_1_1 = curves_1.next()) {
                    var curve = curves_1_1.value;
                    if (curve.length <= 2)
                        continue;
                    ctx.beginPath();
                    var f = fillMode.negative ? 0 : 2 * offset + size;
                    var base0 = curve[0];
                    var base1 = curve[curve.length - 2];
                    ctx.moveTo(baseOffset + baseFactor * base1, f);
                    ctx.lineTo(baseOffset + baseFactor * base0, f);
                    for (var i = 0; i < curve.length; i += 2) {
                        ctx.lineTo(baseOffset + baseFactor * curve[i], fOffset + fFactor * curve[i + 1]);
                    }
                    ctx.fill();
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (curves_1_1 && !curves_1_1.done && (_d = curves_1.return)) _d.call(curves_1);
                }
                finally { if (e_7) throw e_7.error; }
            }
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = ctx.lineCap = 'round';
        try {
            for (var curves_2 = __values(curves), curves_2_1 = curves_2.next(); !curves_2_1.done; curves_2_1 = curves_2.next()) {
                var curve = curves_2_1.value;
                if (curve.length === 0)
                    continue;
                var bs = baseOffset + baseFactor * curve[0];
                var fs = fOffset + fFactor * curve[1];
                if (curve.length === 2) {
                    ctx.beginPath();
                    ctx.arc(bs, fs, lineWidth / 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
                else {
                    ctx.beginPath();
                    ctx.moveTo(bs, fs);
                    for (var i = 2; i < curve.length; i += 2) {
                        ctx.lineTo(baseOffset + baseFactor * curve[i], fOffset + fFactor * curve[i + 1]);
                    }
                    ctx.stroke();
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (curves_2_1 && !curves_2_1.done && (_e = curves_2.return)) _e.call(curves_2);
            }
            finally { if (e_8) throw e_8.error; }
        }
    }
    ctx.restore();
}
exports.render1D = render1D;
