"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.View = void 0;
const parser_1 = require("./parser");
const renderer_1 = require("./renderer");
const numcore_1 = require("numcore");
const tuplemap_1 = require("./tuplemap");
function isEqual(a, b) {
    if (a === b)
        return true;
    if (a == null || b == null)
        return false;
    if (!(typeof a === 'object') || !(typeof b === 'object'))
        return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, i) => isEqual(v, b[i]));
    }
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.every(key => isEqual(a[key], b[key]));
}
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function releaseCanvas(canvas) {
    canvas.width = canvas.height = 0;
}
const defaultRenderOption = {
    lineWidth: 2,
    axisWidth: 2,
    axisInterval: 120,
    labelSize: 14,
    background: 'white',
    order: ['axis', 'graph', 'label']
};
const fillAlphaFallback = 0.5;
function renderKeyOf({ color, fillAlpha, parsed }) {
    if (!isRenderTarget(parsed) || !color || color === 'transparent')
        return null;
    return [color, fillAlpha !== null && fillAlpha !== void 0 ? fillAlpha : fillAlphaFallback, parsed];
}
function isRenderTarget(parsed) {
    return parsed.type === 'eq' || parsed.type === 'point' || parsed.type === 'parametric';
}
class View {
    constructor(info = {}) {
        var _a, _b, _c, _d;
        this.formulas = [];
        this.needsRender = true;
        this.calcPaused = false;
        this.panelSize = 64;
        this.calculationTime = 100;
        this.panels = new Map();
        this.cache = new tuplemap_1.TupleMap();
        this.rendering = Object.assign(Object.assign({}, defaultRenderOption), info.rendering);
        this.viewport = Object.assign({ center: { x: 0, y: 0 }, sizePerPixel: { x: 1 / 256, y: 1 / 256 } }, info.viewport);
        this.width = Math.round((_b = (_a = info.size) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 256);
        this.height = Math.round((_d = (_c = info.size) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 256);
        this.canvas = document.createElement('canvas');
        this.update(info);
    }
    updateFormulas(inputs) {
        const extractText = ({ tex, plain }) => ({ tex, plain });
        let formulas;
        if (isEqual(this.formulas.map(extractText), inputs.map(extractText))) {
            formulas = inputs.map(({ color, fillAlpha }, i) => (Object.assign(Object.assign({}, this.formulas[i]), { color, fillAlpha })));
        }
        else {
            const cache = new Map();
            for (const formula of this.formulas) {
                if (isRenderTarget(formula.parsed))
                    cache.set(formula.parsed.key, formula.parsed);
            }
            const textFormulas = inputs.map(({ tex, plain }) => {
                try {
                    return { text: tex != null ? (0, numcore_1.texToPlain)(tex) : plain };
                }
                catch (e) {
                    return { text: '', error: String(e) };
                }
            });
            const parseds = (0, parser_1.parseFormulas)(textFormulas.map(({ text }) => text));
            formulas = inputs.map((input, index) => {
                const error = textFormulas[index].error;
                if (error)
                    return Object.assign(Object.assign({}, input), { parsed: { type: 'error', error } });
                const parsed = parseds[index];
                const fromCache = (isRenderTarget(parsed) && cache.get(parsed.key)) || parsed;
                return (Object.assign(Object.assign({}, input), { parsed: fromCache }));
            });
        }
        const extractRendering = ({ parsed, color, fillAlpha }) => isRenderTarget(parsed) ? { parsed, color, fillAlpha } : null;
        if (!isEqual(this.formulas.map(extractRendering), formulas.map(extractRendering))) {
            this.needsRender = true;
        }
        this.formulas = formulas;
        return this.formulas;
    }
    updateRendering(rendering) {
        if (isEqual(rendering, this.rendering))
            return;
        if (this.rendering.lineWidth !== rendering.lineWidth)
            this.invalidatePanels();
        this.rendering = rendering;
        this.needsRender = true;
    }
    invalidatePanels() {
        for (const [_key, { canvases }] of this.panels)
            canvases.forEach(releaseCanvas);
        this.panels.clear();
        this.needsRender = true;
    }
    release() {
        this.invalidatePanels();
        releaseCanvas(this.canvas);
    }
    updateSize({ width, height }) {
        width = Math.round(width);
        height = Math.round(height);
        if (this.width === width && this.height === height)
            return;
        this.width = width;
        this.height = height;
        this.needsRender = true;
    }
    updateViewport(viewport) {
        if (isEqual(this.viewport, viewport))
            return;
        this.viewport = viewport;
        this.needsRender = true;
    }
    update({ size, viewport, rendering, formulas, calcPaused }) {
        if (calcPaused !== undefined && this.calcPaused !== calcPaused) {
            this.calcPaused = calcPaused;
            this.needsRender || (this.needsRender = !calcPaused);
        }
        if (formulas)
            this.updateFormulas(formulas);
        if (rendering)
            this.updateRendering(Object.assign(Object.assign({}, this.rendering), rendering));
        if (size)
            this.updateSize(Object.assign({ width: this.width, height: this.height }, size));
        if (viewport)
            this.updateViewport(Object.assign(Object.assign({}, this.viewport), viewport));
        this.render(false);
    }
    panelRange() {
        const { width, height, viewport, panelSize } = this;
        const { center, sizePerPixel } = viewport;
        const ixBase = -center.x / sizePerPixel.x;
        const iyBase = -center.y / sizePerPixel.y;
        return {
            ixMin: Math.ceil((-width / 2 - ixBase) / panelSize) - 1,
            ixMax: Math.floor((width / 2 - ixBase) / panelSize),
            iyMin: Math.ceil((-height / 2 - iyBase) / panelSize) - 1,
            iyMax: Math.floor((height / 2 - iyBase) / panelSize),
        };
    }
    isCalculationCompleted() {
        const { panels } = this;
        const { ixMin, ixMax, iyMin, iyMax } = this.panelRange();
        const formulaKeys = [];
        for (const formula of this.formulas) {
            const key = renderKeyOf(formula);
            if (key)
                formulaKeys.push(key);
        }
        for (let ix = ixMin; ix <= ixMax; ix++) {
            for (let iy = iyMin; iy <= iyMax; iy++) {
                const panel = panels.get(`${ix}/${iy}`);
                if (!panel)
                    return false;
                if (!formulaKeys.every(key => panel.canvases.has(key)))
                    return false;
            }
        }
        return true;
    }
    calculate() {
        var _a;
        const { panels, panelSize, calculationTime } = this;
        const { sizePerPixel } = this.viewport;
        const startTime = performance.now();
        const { lineWidth } = this.rendering;
        const offset = Math.ceil(lineWidth / 2) + 2;
        const { ixMin, ixMax, iyMin, iyMax } = this.panelRange();
        const unusedCanvases = [];
        const dx = sizePerPixel.x * panelSize;
        const dy = sizePerPixel.y * panelSize;
        const newCanvas = () => { var _a; return (_a = unusedCanvases.pop()) !== null && _a !== void 0 ? _a : document.createElement('canvas'); };
        const fetchCache = ([ix, iy], formula, fallback) => {
            const delta = ix != null ? dx : dy;
            const cacheKey = [ix, iy, delta, formula];
            let res = this.cache.get(cacheKey);
            if (!res)
                this.cache.set(cacheKey, res = fallback());
            return res;
        };
        for (const [key, panel] of panels) {
            if (panel.ix < ixMin - 1 || panel.ix > ixMax + 1 || panel.iy < iyMin - 1 || panel.iy > iyMax + 1 || panel.dx !== dx || panel.dy !== dy) {
                panels.delete(key);
                for (const [, canvas] of panel.canvases)
                    unusedCanvases.push(canvas);
            }
        }
        const parsedFormulas = new Set(this.formulas.map(f => f.parsed));
        for (const key of this.cache.keys()) {
            const [ix, iy, , parsed] = key;
            if (!parsedFormulas.has(parsed)
                || (ix != null && (ix < ixMin - 1 || ix > ixMax + 1))
                || (iy != null && (iy < iyMin - 1 || iy > iyMax + 1)))
                this.cache.delete(key);
        }
        for (let ix = ixMin; ix <= ixMax; ix++) {
            for (let iy = iyMin; iy <= iyMax; iy++) {
                const positionKey = `${ix}/${iy}`;
                let panel = panels.get(positionKey);
                if (!panel)
                    panels.set(positionKey, panel = { ix, iy, dx, dy, canvases: new tuplemap_1.TupleMap() });
                const canvasSize = panelSize + 2 * offset;
                const prevCanvases = panel.canvases;
                panel.canvases = new tuplemap_1.TupleMap();
                const range = {
                    xMin: ix * dx,
                    xMax: (ix + 1) * dx,
                    yMin: iy * dy,
                    yMax: (iy + 1) * dy
                };
                for (const formula of this.formulas) {
                    const { color, parsed, fillAlpha } = formula;
                    const renderKey = renderKeyOf(formula);
                    if (!isRenderTarget(parsed) || !renderKey || !color)
                        continue;
                    if (panel.canvases.has(renderKey))
                        continue;
                    const prev = prevCanvases.get(renderKey);
                    if (prev) {
                        prevCanvases.delete(renderKey);
                        panel.canvases.set(renderKey, prev);
                        continue;
                    }
                    const canvas = newCanvas();
                    canvas.width = canvas.height = canvasSize;
                    (_a = canvas.getContext('2d')) === null || _a === void 0 ? void 0 : _a.clearRect(0, 0, canvasSize, canvasSize);
                    const renderOption = { lineWidth, color, fillAlpha: fillAlpha !== null && fillAlpha !== void 0 ? fillAlpha : fillAlphaFallback };
                    if (parsed.type === 'point') {
                        (0, renderer_1.renderPoint)(canvas, panelSize, offset, range, parsed, renderOption);
                    }
                    else if (parsed.type === 'parametric') {
                        (0, renderer_1.renderParametric)(canvas, panelSize, offset, range, parsed, renderOption);
                    }
                    else if (parsed.calcType === 'xy') {
                        (0, renderer_1.render2D)(canvas, panelSize, offset, range, parsed, renderOption);
                    }
                    else {
                        const isXCalc = parsed.calcType === 'x' || parsed.calcType === 'fx';
                        const [baseAxisMin, baseAxisMax] = isXCalc ? [range.xMin, range.xMax] : [range.yMin, range.yMax];
                        const result = fetchCache(isXCalc ? [ix, null] : [null, iy], parsed, () => (parsed.calcType === 'x' || parsed.calcType === 'y' ? (0, renderer_1.calc1DRange)(parsed, panelSize, baseAxisMin, baseAxisMax) : (0, renderer_1.calc1DCurves)(parsed, panelSize, baseAxisMin, baseAxisMax)));
                        (0, renderer_1.render1D)(canvas, panelSize, offset, range, parsed, result, renderOption);
                    }
                    panel.canvases.set(renderKey, canvas);
                }
                prevCanvases.forEach(canvas => unusedCanvases.push(canvas));
                if (performance.now() > startTime + calculationTime)
                    break;
            }
        }
        unusedCanvases.forEach(releaseCanvas);
    }
    render(calculate = true) {
        if (!this.needsRender)
            return;
        const { canvas, width, height, panels, panelSize } = this;
        const { center, sizePerPixel } = this.viewport;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        if (!this.calcPaused && calculate) {
            this.calculate();
            this.needsRender = !this.isCalculationCompleted();
        }
        ctx.clearRect(0, 0, width, height);
        if (this.rendering.background != null && this.rendering.background !== 'transparent') {
            ctx.fillStyle = this.rendering.background;
            ctx.fillRect(0, 0, width, height);
        }
        const renderGraph = () => {
            ctx.save();
            ctx.scale(1, -1);
            for (const formula of this.formulas) {
                const renderKey = renderKeyOf(formula);
                if (!renderKey)
                    continue;
                for (const [, panel] of panels) {
                    const image = panel.canvases.get(renderKey);
                    if (!image)
                        continue;
                    const offsetX = (image.width - panelSize) / 2;
                    const offsetY = (image.height - panelSize) / 2;
                    const left = Math.round(width / 2 + (panel.dx * panel.ix - center.x) / sizePerPixel.x);
                    const right = Math.round(width / 2 + (panel.dx * (panel.ix + 1) - center.x) / sizePerPixel.x);
                    const bottom = Math.round(height / 2 + (panel.dy * panel.iy - center.y) / sizePerPixel.y);
                    const top = Math.round(height / 2 + (panel.dy * (panel.iy + 1) - center.y) / sizePerPixel.y);
                    ctx.drawImage(image, left - offsetX * (right - left) / panelSize, bottom - height - offsetY * (top - bottom) / panelSize, (right - left) * image.width / panelSize, (top - bottom) * image.height / panelSize);
                }
            }
            ctx.restore();
        };
        const { renderLabel, renderAxis } = this.prepareAxisLabelRenderer(ctx);
        for (const mode of this.rendering.order) {
            if (mode === 'label')
                renderLabel();
            if (mode === 'axis')
                renderAxis();
            if (mode === 'graph')
                renderGraph();
        }
    }
    prepareAxisLabelRenderer(ctx) {
        const minIntervalPixel = this.rendering.axisInterval;
        if (!minIntervalPixel)
            return { renderLabel: () => { }, renderAxis: () => { } };
        const fontSize = this.rendering.labelSize;
        const font = fontSize ? `bold ${fontSize}px sans-serif` : null;
        const { width, height } = this;
        const { center, sizePerPixel } = this.viewport;
        const xSize = width * sizePerPixel.x;
        const ySize = height * sizePerPixel.y;
        const axisIntervals = (size, pixel) => {
            const base = Math.pow(10, Math.floor(Math.log10(size * minIntervalPixel / pixel)));
            const basePixel = base / size * pixel;
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
        const labels = [];
        const xConvert = (x) => width / 2 + (x - center.x) / sizePerPixel.x;
        const yConvert = (y) => height / 2 - (y - center.y) / sizePerPixel.y;
        const canvasX0 = xConvert(0);
        const canvasY0 = yConvert(0);
        const labelText = (n) => n.toFixed(10).replace(/\.?0+$/, '');
        const lines = [];
        const prepareXAxis = (mainInterval, division, renderZeroLabel) => {
            const ixMin = Math.ceil((-width * sizePerPixel.x / 2 + center.x) / mainInterval * division);
            const ixMax = Math.floor((width * sizePerPixel.x / 2 + center.x) / mainInterval * division);
            for (let ix = ixMin; ix <= ixMax; ix++) {
                const x = ix * mainInterval / division;
                const canvasX = xConvert(ix * mainInterval / division);
                const opacity = ix === 0 ? 1 : ix % division === 0 ? 0.5 : 0.1;
                lines.push([canvasX, 0, canvasX, height, opacity]);
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
        const prepareYAxis = (mainInterval, division, renderZeroLabel) => {
            const iyMin = Math.ceil((-height * sizePerPixel.y / 2 + center.y) / mainInterval * division);
            const iyMax = Math.floor((height * sizePerPixel.y / 2 + center.y) / mainInterval * division);
            let labelMaxWidth = 0;
            for (let iy = iyMin; iy <= iyMax; iy++) {
                labelMaxWidth = Math.max(labelMaxWidth, ctx.measureText(labelText(iy * mainInterval / division)).width);
            }
            for (let iy = iyMin; iy <= iyMax; iy++) {
                const y = iy * mainInterval / division;
                const canvasY = yConvert(y);
                const opacity = iy === 0 ? 1 : iy % division === 0 ? 0.5 : 0.1;
                lines.push([0, canvasY, width, canvasY, opacity]);
                if (fontSize && iy % division === 0 && (renderZeroLabel || iy !== 0)) {
                    const labelX = canvasX0 + fontSize / 4;
                    const text = labelText(y);
                    if (labelX + labelMaxWidth + fontSize / 4 >= width) {
                        labels.push({ text, x: Math.min(width, canvasX0) - fontSize / 4, y: canvasY, align: 'right', baseline: 'middle' });
                    }
                    else {
                        labels.push({ text, x: Math.max(canvasX0, 0) + fontSize / 4, y: canvasY, align: 'left', baseline: 'middle' });
                    }
                }
            }
        };
        const zeroVisible = 0 < canvasX0 && canvasX0 < width && 0 < canvasY0 && canvasY0 < height;
        if (fontSize && zeroVisible) {
            const textZeroWidth = ctx.measureText('0').width;
            labels.push({
                text: '0',
                align: 'left',
                baseline: 'top',
                x: clamp(canvasX0 + fontSize / 4, 0, width - textZeroWidth - fontSize / 4),
                y: clamp(canvasY0 + fontSize / 4, 0, height - fontSize)
            });
        }
        const scaleRatio = sizePerPixel.x / sizePerPixel.y;
        ctx.save();
        if (font)
            ctx.font = font;
        if (4 / 5 < scaleRatio && scaleRatio < 5 / 4) {
            const [main, div] = scaleRatio < 1 ? axisIntervals(xSize, width) : axisIntervals(ySize, height);
            prepareXAxis(main, div, !zeroVisible);
            prepareYAxis(main, div, !zeroVisible);
        }
        else {
            prepareXAxis(...axisIntervals(xSize, width), !zeroVisible);
            prepareYAxis(...axisIntervals(ySize, height), !zeroVisible);
        }
        ctx.restore();
        const renderAxis = () => {
            ctx.save();
            ctx.lineWidth = this.rendering.axisWidth;
            ctx.strokeStyle = 'black';
            for (const [sx, sy, ex, ey, opacity] of lines) {
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }
            ctx.restore();
        };
        const renderLabel = () => {
            if (font == null)
                return;
            ctx.save();
            ctx.font = font;
            ctx.strokeStyle = 'white';
            ctx.fillStyle = 'black';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            for (const { text, x, y, align, baseline } of labels) {
                ctx.textAlign = align;
                ctx.textBaseline = baseline;
                ctx.strokeText(text, x, y);
            }
            for (const { text, x, y, align, baseline } of labels) {
                ctx.textAlign = align;
                ctx.textBaseline = baseline;
                ctx.fillText(text, x, y);
            }
            ctx.restore();
        };
        return { renderAxis, renderLabel };
    }
}
exports.View = View;
