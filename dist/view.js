"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.View = void 0;
var renderer_1 = require("./renderer");
var numcore_1 = require("numcore");
function isEqual(a, b) {
    if (a === b)
        return true;
    if (a == null || b == null)
        return false;
    if (!(typeof a === 'object') || !(typeof b === 'object'))
        return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every(function (v, i) { return isEqual(v, b[i]); });
    }
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    var keys = __spreadArray([], __read(new Set(__spreadArray(__spreadArray([], __read(Object.keys(a)), false), __read(Object.keys(b)), false))), false);
    return keys.every(function (key) { return isEqual(a[key], b[key]); });
}
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function releaseCanvas(canvas) {
    canvas.width = canvas.height = 0;
}
var View = /** @class */ (function () {
    function View(info) {
        if (info === void 0) { info = {}; }
        var _a, _b, _c, _d;
        this.formulas = [];
        this.needsRender = true;
        this.calcPaused = false;
        this.panelSize = 64;
        this.calculationTime = 100;
        this.panels = new Map();
        this.rendering = __assign({ lineWidth: 2, axisWidth: 2, axisInterval: 120, labelSize: 14 }, info.rendering);
        this.viewport = __assign({ center: { x: 0, y: 0 }, sizePerPixel: { x: 1 / 256, y: 1 / 256 } }, info.viewport);
        this.width = Math.round((_b = (_a = info.size) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 256);
        this.height = Math.round((_d = (_c = info.size) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 256);
        this.canvas = document.createElement('canvas');
        this.update(info);
    }
    View.prototype.updateFormulas = function (inputs) {
        var e_1, _a;
        var _this = this;
        var extractText = function (_a) {
            var tex = _a.tex, plain = _a.plain;
            return ({ tex: tex, plain: plain });
        };
        var formulas;
        if (isEqual(this.formulas.map(extractText), inputs.map(extractText))) {
            formulas = inputs.map(function (_a, i) {
                var color = _a.color, fillAlpha = _a.fillAlpha;
                return (__assign(__assign({}, _this.formulas[i]), { color: color, fillAlpha: fillAlpha }));
            });
        }
        else {
            var cache_1 = new Map();
            try {
                for (var _b = __values(this.formulas), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var formula = _c.value;
                    if (formula.parsed.type === 'eq')
                        cache_1.set(formula.parsed.valueFuncCode, formula.parsed);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            var textFormulas_1 = inputs.map(function (_a) {
                var tex = _a.tex, plain = _a.plain;
                try {
                    return { text: tex != null ? (0, numcore_1.texToPlain)(tex) : plain };
                }
                catch (e) {
                    return { text: '', error: String(e) };
                }
            });
            var parseds_1 = (0, renderer_1.parseFormulas)(textFormulas_1.map(function (_a) {
                var text = _a.text;
                return text;
            }));
            formulas = inputs.map(function (input, index) {
                var error = textFormulas_1[index].error;
                if (error)
                    return __assign(__assign({}, input), { parsed: { type: 'error', error: error } });
                var parsed = parseds_1[index];
                var fromCache = (parsed.type === 'eq' && cache_1.get(parsed.valueFuncCode)) || parsed;
                return (__assign(__assign({}, input), { parsed: fromCache }));
            });
        }
        var extractRendering = function (_a) {
            var parsed = _a.parsed, color = _a.color, fillAlpha = _a.fillAlpha;
            return parsed.type === 'eq' ? { parsed: parsed, color: color, fillAlpha: fillAlpha } : null;
        };
        if (!isEqual(this.formulas.map(extractRendering), formulas.map(extractRendering))) {
            this.invalidatePanels();
        }
        this.formulas = formulas;
        return this.formulas;
    };
    View.prototype.updateRendering = function (rendering) {
        if (isEqual(rendering, this.rendering))
            return;
        if (this.rendering.lineWidth !== rendering.lineWidth)
            this.invalidatePanels();
        this.rendering = rendering;
        this.needsRender = true;
    };
    View.prototype.invalidatePanels = function () {
        var e_2, _a;
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _key = _d[0], canvases = _d[1].canvases;
                canvases.forEach(releaseCanvas);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        this.panels.clear();
        this.needsRender = true;
    };
    View.prototype.updateSize = function (_a) {
        var width = _a.width, height = _a.height;
        width = Math.round(width);
        height = Math.round(height);
        if (this.width === width && this.height === height)
            return;
        this.width = width;
        this.height = height;
        this.needsRender = true;
    };
    View.prototype.updateViewport = function (viewport) {
        if (isEqual(this.viewport, viewport))
            return;
        this.viewport = viewport;
        this.needsRender = true;
    };
    View.prototype.update = function (_a) {
        var size = _a.size, viewport = _a.viewport, rendering = _a.rendering, formulas = _a.formulas, calcPaused = _a.calcPaused;
        if (calcPaused !== undefined && this.calcPaused !== calcPaused) {
            this.calcPaused = calcPaused;
            this.needsRender || (this.needsRender = !calcPaused);
        }
        if (formulas)
            this.updateFormulas(formulas);
        if (rendering)
            this.updateRendering(__assign(__assign({}, this.rendering), rendering));
        if (size)
            this.updateSize(__assign({ width: this.width, height: this.height }, size));
        if (viewport)
            this.updateViewport(__assign(__assign({}, this.viewport), viewport));
        this.render();
    };
    View.prototype.calculate = function () {
        var e_3, _a, e_4, _b;
        var _c, _d, _e;
        var _f = this, width = _f.width, height = _f.height, panels = _f.panels, panelSize = _f.panelSize, calculationTime = _f.calculationTime;
        var _g = this.viewport, center = _g.center, sizePerPixel = _g.sizePerPixel;
        var startTime = performance.now();
        var lineWidth = this.rendering.lineWidth;
        var offset = Math.ceil(lineWidth / 2) + 2;
        var ixBase = -center.x / sizePerPixel.x;
        var iyBase = -center.y / sizePerPixel.y;
        var ixMin = Math.ceil((-width / 2 - ixBase) / panelSize) - 1;
        var ixMax = Math.floor((width / 2 - ixBase) / panelSize);
        var iyMin = Math.ceil((-height / 2 - iyBase) / panelSize) - 1;
        var iyMax = Math.floor((height / 2 - iyBase) / panelSize);
        var unusedPanels = [];
        var dx = sizePerPixel.x * panelSize;
        var dy = sizePerPixel.y * panelSize;
        try {
            for (var _h = __values(panels.entries()), _j = _h.next(); !_j.done; _j = _h.next()) {
                var _k = __read(_j.value, 2), key = _k[0], panel = _k[1];
                if (panel.ix < ixMin - 1 || panel.ix > ixMax + 1 || panel.iy < iyMin - 1 || panel.iy > iyMax + 1 || panel.dx !== dx || panel.dy !== dy) {
                    panels.delete(key);
                    unusedPanels.push(panel);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_j && !_j.done && (_a = _h.return)) _a.call(_h);
            }
            finally { if (e_3) throw e_3.error; }
        }
        for (var ix = ixMin; ix <= ixMax; ix++) {
            for (var iy = iyMin; iy <= iyMax; iy++) {
                var key = "".concat(ix, "/").concat(iy);
                if (panels.has(key))
                    continue;
                var canvases = (_d = (_c = unusedPanels.pop()) === null || _c === void 0 ? void 0 : _c.canvases) !== null && _d !== void 0 ? _d : __spreadArray([], __read(new Array(this.formulas.length)), false).map(function () { return document.createElement('canvas'); });
                var canvasSize = panelSize + 2 * offset;
                var range = {
                    xMin: ix * dx,
                    xMax: (ix + 1) * dx,
                    yMin: iy * dy,
                    yMax: (iy + 1) * dy
                };
                for (var i = 0; i < this.formulas.length; i++) {
                    var _l = this.formulas[i], color = _l.color, parsed = _l.parsed, fillAlpha = _l.fillAlpha;
                    var canvas = canvases[i];
                    if (parsed.type === 'eq' && color != null && color !== 'transparent') {
                        canvas.width = canvas.height = canvasSize;
                        (_e = canvas.getContext('2d')) === null || _e === void 0 ? void 0 : _e.clearRect(0, 0, canvasSize, canvasSize);
                        (0, renderer_1.render)(canvas, panelSize, offset, range, parsed, { lineWidth: lineWidth, color: color, fillAlpha: fillAlpha !== null && fillAlpha !== void 0 ? fillAlpha : 0.5 });
                    }
                    else {
                        canvas.width = canvas.height = 0;
                    }
                }
                panels.set(key, { ix: ix, iy: iy, dx: dx, dy: dy, canvases: canvases });
                if (performance.now() > startTime + calculationTime) {
                    this.needsRender = true;
                    break;
                }
            }
        }
        try {
            for (var unusedPanels_1 = __values(unusedPanels), unusedPanels_1_1 = unusedPanels_1.next(); !unusedPanels_1_1.done; unusedPanels_1_1 = unusedPanels_1.next()) {
                var panel = unusedPanels_1_1.value;
                panel.canvases.forEach(releaseCanvas);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (unusedPanels_1_1 && !unusedPanels_1_1.done && (_b = unusedPanels_1.return)) _b.call(unusedPanels_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
    };
    View.prototype.render = function () {
        var e_5, _a;
        if (!this.needsRender)
            return;
        var _b = this, canvas = _b.canvas, width = _b.width, height = _b.height, panels = _b.panels, panelSize = _b.panelSize;
        var _c = this.viewport, center = _c.center, sizePerPixel = _c.sizePerPixel;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        var ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        this.needsRender = false;
        if (!this.calcPaused)
            this.calculate();
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.scale(1, -1);
        for (var i = 0; i < this.formulas.length; i++) {
            try {
                for (var panels_1 = (e_5 = void 0, __values(panels)), panels_1_1 = panels_1.next(); !panels_1_1.done; panels_1_1 = panels_1.next()) {
                    var _d = __read(panels_1_1.value, 2), _key = _d[0], panel = _d[1];
                    var image = panel.canvases[i];
                    if (image.width === 0)
                        continue;
                    var offsetX = (image.width - panelSize) / 2;
                    var offsetY = (image.height - panelSize) / 2;
                    var left = Math.round(width / 2 + (panel.dx * panel.ix - center.x) / sizePerPixel.x);
                    var right = Math.round(width / 2 + (panel.dx * (panel.ix + 1) - center.x) / sizePerPixel.x);
                    var bottom = Math.round(height / 2 + (panel.dy * panel.iy - center.y) / sizePerPixel.y);
                    var top_1 = Math.round(height / 2 + (panel.dy * (panel.iy + 1) - center.y) / sizePerPixel.y);
                    ctx.drawImage(image, left - offsetX * (right - left) / panelSize, bottom - height - offsetY * (top_1 - bottom) / panelSize, (right - left) * image.width / panelSize, (top_1 - bottom) * image.height / panelSize);
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (panels_1_1 && !panels_1_1.done && (_a = panels_1.return)) _a.call(panels_1);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
        ctx.restore();
        this.renderAxis(ctx);
    };
    View.prototype.renderAxis = function (ctx) {
        var e_6, _a, e_7, _b;
        var minIntervalPixel = this.rendering.axisInterval;
        if (!minIntervalPixel)
            return;
        var fontSize = this.rendering.labelSize;
        ctx.save();
        var _c = this, width = _c.width, height = _c.height, panels = _c.panels, panelSize = _c.panelSize;
        var _d = this.viewport, center = _d.center, sizePerPixel = _d.sizePerPixel;
        var xSize = width * sizePerPixel.x;
        var ySize = height * sizePerPixel.y;
        var axisIntervals = function (size, pixel) {
            var base = Math.pow(10, Math.floor(Math.log10(size * minIntervalPixel / pixel)));
            var basePixel = base / size * pixel;
            if (2 * basePixel >= minIntervalPixel) {
                return [2 * base, 4];
            }
            else if (5 * basePixel >= minIntervalPixel) {
                return [5 * base, 5];
            }
            else {
                return [10 * base, 5];
            }
        };
        if (fontSize)
            ctx.font = "bold ".concat(fontSize, "px sans-serif");
        var labels = [];
        var xConvert = function (x) { return width / 2 + (x - center.x) / sizePerPixel.x; };
        var yConvert = function (y) { return height / 2 - (y - center.y) / sizePerPixel.y; };
        var canvasX0 = xConvert(0);
        var canvasY0 = yConvert(0);
        var labelText = function (n) { return n.toFixed(10).replace(/\.?0+$/, ''); };
        ctx.lineWidth = this.rendering.axisWidth;
        ctx.strokeStyle = 'black';
        var renderXAxis = function (mainInterval, division, renderZeroLabel) {
            var ixMin = Math.ceil((-width * sizePerPixel.x / 2 + center.x) / mainInterval * division);
            var ixMax = Math.floor((width * sizePerPixel.x / 2 + center.x) / mainInterval * division);
            for (var ix = ixMin; ix <= ixMax; ix++) {
                var x = ix * mainInterval / division;
                var canvasX = xConvert(ix * mainInterval / division);
                ctx.globalAlpha = ix === 0 ? 1 : ix % division === 0 ? 0.5 : 0.1;
                ctx.beginPath();
                ctx.moveTo(canvasX, 0);
                ctx.lineTo(canvasX, height);
                ctx.stroke();
                if (fontSize && ix % division === 0 && (renderZeroLabel || ix !== 0)) {
                    labels.push({
                        text: labelText(x),
                        x: xConvert(x),
                        y: clamp(canvasY0 + fontSize / 4, 0, height - fontSize),
                        align: 'center',
                        baseline: 'top'
                    });
                }
            }
        };
        var renderYAxis = function (mainInterval, division, renderZeroLabel) {
            var iyMin = Math.ceil((-height * sizePerPixel.y / 2 + center.y) / mainInterval * division);
            var iyMax = Math.floor((height * sizePerPixel.y / 2 + center.y) / mainInterval * division);
            var labelMaxWidth = 0;
            for (var iy = iyMin; iy <= iyMax; iy++) {
                labelMaxWidth = Math.max(labelMaxWidth, ctx.measureText(labelText(iy * mainInterval / division)).width);
            }
            for (var iy = iyMin; iy <= iyMax; iy++) {
                var y = iy * mainInterval / division;
                var canvasY = yConvert(y);
                ctx.globalAlpha = (iy === 0 ? 1 : iy % division === 0 ? 0.5 : 0.1);
                ctx.beginPath();
                ctx.moveTo(0, canvasY);
                ctx.lineTo(width, canvasY);
                ctx.stroke();
                if (fontSize && iy % division === 0 && (renderZeroLabel || iy !== 0)) {
                    var labelX = canvasX0 + fontSize / 4;
                    var text = labelText(y);
                    if (labelX + labelMaxWidth + fontSize / 4 >= width) {
                        labels.push({ text: text, x: Math.min(width, canvasX0) - fontSize / 4, y: canvasY, align: 'right', baseline: 'middle' });
                    }
                    else {
                        labels.push({ text: text, x: Math.max(canvasX0, 0) + fontSize / 4, y: canvasY, align: 'left', baseline: 'middle' });
                    }
                }
            }
        };
        var zeroVisible = 0 < canvasX0 && canvasX0 < width && 0 < canvasY0 && canvasY0 < height;
        if (fontSize && zeroVisible) {
            var textZeroWidth = ctx.measureText('0').width;
            labels.push({
                text: '0',
                align: 'left',
                baseline: 'top',
                x: clamp(canvasX0 + fontSize / 4, 0, width - textZeroWidth - fontSize / 4),
                y: clamp(canvasY0 + fontSize / 4, 0, height - fontSize)
            });
        }
        var scaleRatio = sizePerPixel.x / sizePerPixel.y;
        if (4 / 5 < scaleRatio && scaleRatio < 5 / 4) {
            var _e = __read(scaleRatio < 1 ? axisIntervals(xSize, width) : axisIntervals(ySize, height), 2), main = _e[0], div = _e[1];
            renderXAxis(main, div, !zeroVisible);
            renderYAxis(main, div, !zeroVisible);
        }
        else {
            renderXAxis.apply(void 0, __spreadArray(__spreadArray([], __read(axisIntervals(xSize, width)), false), [!zeroVisible], false));
            renderYAxis.apply(void 0, __spreadArray(__spreadArray([], __read(axisIntervals(ySize, height)), false), [!zeroVisible], false));
        }
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'black';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        try {
            for (var labels_1 = __values(labels), labels_1_1 = labels_1.next(); !labels_1_1.done; labels_1_1 = labels_1.next()) {
                var _f = labels_1_1.value, text = _f.text, x = _f.x, y = _f.y, align = _f.align, baseline = _f.baseline;
                ctx.textAlign = align;
                ctx.textBaseline = baseline;
                ctx.strokeText(text, x, y);
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (labels_1_1 && !labels_1_1.done && (_a = labels_1.return)) _a.call(labels_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
        try {
            for (var labels_2 = __values(labels), labels_2_1 = labels_2.next(); !labels_2_1.done; labels_2_1 = labels_2.next()) {
                var _g = labels_2_1.value, text = _g.text, x = _g.x, y = _g.y, align = _g.align, baseline = _g.baseline;
                ctx.textAlign = align;
                ctx.textBaseline = baseline;
                ctx.fillText(text, x, y);
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (labels_2_1 && !labels_2_1.done && (_b = labels_2.return)) _b.call(labels_2);
            }
            finally { if (e_7) throw e_7.error; }
        }
        ctx.restore();
    };
    return View;
}());
exports.View = View;
