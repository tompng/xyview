import { parseFormulas, ParsedFormula, ParsedEquation, ParsedEquation1D } from './parser'
import { render1D, render2D, CalcResult1D, calc1DRange, calc1DCurves } from './renderer'
import { texToPlain } from 'numcore'
export type Size = { width: number; height: number }
import { TupleMap } from './tuplemap'

export type RenderOption = {
  background: string | null
  order: ('axis' | 'graph' | 'label')[]
  lineWidth: number
  axisInterval: number | null
  axisWidth: number
  labelSize: number | null
}

type Vector2D = { x: number; y: number }

export type Viewport = {
  center: Vector2D
  sizePerPixel: Vector2D
}

type FormulaAppearance = {
  color: string | null
  fillAlpha?: number
}

type FormulaExpression =
  | { tex: string; plain?: undefined }
  | { tex?: undefined; plain: string }

type FormulaResult = { parsed: ParsedFormula }

export type FormulaInput = FormulaExpression & FormulaAppearance

export type Formula = FormulaInput & FormulaResult

export type UpdateAttributes = {
  size?: Partial<Size>
  viewport?: Partial<Viewport>
  rendering?: Partial<RenderOption>
  formulas?: FormulaInput[]
  inChange?: boolean
  calcPaused?: boolean
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (!(typeof a === 'object') || !(typeof b === 'object')) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => isEqual(v, b[i]))
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return keys.every(key => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

type Panel = {
  canvases: TupleMap<RenderKey, HTMLCanvasElement>
  dx: number
  dy: number
  ix: number
  iy: number
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = canvas.height = 0
}

const defaultRenderOption: RenderOption = {
  lineWidth: 2,
  axisWidth: 2,
  axisInterval: 120,
  labelSize: 14,
  background: 'white',
  order: ['axis', 'graph', 'label']
}

const fillAlphaFallback = 0.5

type RenderKey = [string, number, ParsedEquation]
function renderKeyOf({ color, fillAlpha, parsed }: Formula): RenderKey | null {
  if (parsed.type !== 'eq' || !color || color === 'transparent') return null
  return [color, fillAlpha ?? fillAlphaFallback, parsed]
}

export class View {
  canvas: HTMLCanvasElement
  width: number
  height: number
  formulas: Formula[] = []
  rendering: RenderOption
  viewport: Viewport
  needsRender = true
  calcPaused = false
  panelSize = 64
  calculationTime = 100
  panels = new Map<string, Panel>()
  cache = new TupleMap<[ix: number | null, iy: number | null, delta: number, parsed: ParsedEquation1D], CalcResult1D>()
  constructor(info: UpdateAttributes = {}) {
    this.rendering = { ...defaultRenderOption, ...info.rendering }
    this.viewport = { center: { x: 0, y: 0 }, sizePerPixel: { x: 1 / 256, y: 1 / 256 }, ...info.viewport }
    this.width = Math.round(info.size?.width ?? 256)
    this.height = Math.round(info.size?.height ?? 256)
    this.canvas = document.createElement('canvas')
    this.update(info)
  }
  updateFormulas(inputs: FormulaInput[]) {
    const extractText = ({ tex, plain }: FormulaInput) => ({ tex, plain })
    let formulas: Formula[]
    if (isEqual(this.formulas.map(extractText), inputs.map(extractText))) {
      formulas = inputs.map(({ color, fillAlpha }, i) => ({ ...this.formulas[i], color, fillAlpha }))
    } else {
      const cache = new Map<string, ParsedEquation>()
      for (const formula of this.formulas) {
        if (formula.parsed.type === 'eq') cache.set(formula.parsed.key, formula.parsed)
      }
      const textFormulas = inputs.map(({ tex, plain }) => {
        try {
          return { text: tex != null ? texToPlain(tex) : plain }
        } catch (e) {
          return { text: '', error: String(e) }
        }
      })
      const parseds = parseFormulas(textFormulas.map(({ text }) => text))
      formulas = inputs.map((input, index) => {
        const error = textFormulas[index].error
        if (error) return { ...input, parsed: { type: 'error', error } }
        const parsed = parseds[index]
        const fromCache = (parsed.type === 'eq' && cache.get(parsed.key)) || parsed
        return ({ ...input, parsed: fromCache })
      })
    }
    const extractRendering = ({ parsed, color, fillAlpha }: Formula) => parsed.type === 'eq' ? { parsed, color, fillAlpha } : null
    if (!isEqual(this.formulas.map(extractRendering), formulas.map(extractRendering))) {
      this.needsRender = true
    }
    this.formulas = formulas
    return this.formulas
  }
  updateRendering(rendering: RenderOption) {
    if (isEqual(rendering, this.rendering)) return
    if (this.rendering.lineWidth !== rendering.lineWidth) this.invalidatePanels()
    this.rendering = rendering
    this.needsRender = true
  }
  invalidatePanels() {
    for (const [_key, { canvases }] of this.panels) canvases.forEach(releaseCanvas)
    this.panels.clear()
    this.needsRender = true
  }
  release() {
    this.invalidatePanels()
    releaseCanvas(this.canvas)
  }
  updateSize({ width, height }: Size) {
    width = Math.round(width)
    height = Math.round(height)
    if (this.width === width && this.height === height) return
    this.width = width
    this.height = height
    this.needsRender = true
  }
  updateViewport(viewport: Viewport) {
    if (isEqual(this.viewport, viewport)) return
    this.viewport = viewport
    this.needsRender = true
  }
  update({ size, viewport, rendering, formulas, calcPaused }: UpdateAttributes) {
    if (calcPaused !== undefined && this.calcPaused !== calcPaused) {
      this.calcPaused = calcPaused
      this.needsRender ||= !calcPaused
    }
    if (formulas) this.updateFormulas(formulas)
    if (rendering) this.updateRendering({ ...this.rendering, ...rendering })
    if (size) this.updateSize({ width: this.width, height: this.height, ...size })
    if (viewport) this.updateViewport({ ...this.viewport, ...viewport })
    this.render(false)
  }
  panelRange() {
    const { width, height, viewport, panelSize } = this
    const { center, sizePerPixel } = viewport
    const ixBase = -center.x / sizePerPixel.x
    const iyBase = -center.y / sizePerPixel.y
    return {
      ixMin: Math.ceil((-width / 2 - ixBase) / panelSize) - 1,
      ixMax: Math.floor((width / 2 - ixBase) / panelSize),
      iyMin: Math.ceil((-height / 2 - iyBase) / panelSize) - 1,
      iyMax: Math.floor((height / 2 - iyBase) / panelSize),
    }
  }
  isCalculationCompleted() {
    const { panels } = this
    const { ixMin, ixMax, iyMin, iyMax } = this.panelRange()
    const formulaKeys: RenderKey[] = []
    for (const formula of this.formulas) {
      const key = renderKeyOf(formula)
      if (key) formulaKeys.push(key)
    }
    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const panel = panels.get(`${ix}/${iy}`)
        if (!panel) return false
        if (!formulaKeys.every(key => panel.canvases.has(key))) return false
      }
    }
    return true
  }
  calculate() {
    const { panels, panelSize, calculationTime } = this
    const { sizePerPixel } = this.viewport
    const startTime = performance.now()
    const { lineWidth } = this.rendering
    const offset = Math.ceil(lineWidth / 2) + 2
    const { ixMin, ixMax, iyMin, iyMax } = this.panelRange()
    const unusedCanvases: HTMLCanvasElement[] = []
    const dx = sizePerPixel.x * panelSize
    const dy = sizePerPixel.y * panelSize
    const newCanvas = () => unusedCanvases.pop() ?? document.createElement('canvas')
    const fetchCache = ([ix, iy]: [number, null] | [null, number], formula: ParsedEquation1D, fallback: () => CalcResult1D) => {
      const delta = ix != null ? dx : dy
      const cacheKey = [ix, iy, delta, formula] as const
      let res = this.cache.get(cacheKey)
      if (!res) this.cache.set(cacheKey, res = fallback())
      return res
    }
    for (const [key, panel] of panels) {
      if (panel.ix < ixMin - 1 || panel.ix > ixMax + 1 || panel.iy < iyMin - 1 || panel.iy > iyMax + 1 || panel.dx !== dx || panel.dy !== dy) {
        panels.delete(key)
        for (const [, canvas] of panel.canvases) unusedCanvases.push(canvas)
      }
    }
    const parsedFormulas = new Set(this.formulas.map(f => f.parsed))
    for (const key of this.cache.keys()) {
      const [ix, iy, , parsed] = key
      if (
        !parsedFormulas.has(parsed)
        || (ix != null && (ix < ixMin - 1 || ix > ixMax + 1))
        || (iy != null && (iy < iyMin - 1 || iy > iyMax + 1))
      ) this.cache.delete(key)
    }
    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const positionKey = `${ix}/${iy}`
        let panel = panels.get(positionKey)
        if (!panel) panels.set(positionKey, panel = { ix, iy, dx, dy, canvases: new TupleMap() })
        const canvasSize = panelSize + 2 * offset
        const prevCanvases = panel.canvases
        panel.canvases = new TupleMap()
        const range = {
          xMin: ix * dx,
          xMax: (ix + 1) * dx,
          yMin: iy * dy,
          yMax: (iy + 1) * dy
        }
        for (const formula of this.formulas) {
          const { color, parsed, fillAlpha } = formula
          const renderKey = renderKeyOf(formula)
          if (!renderKey || parsed.type !== 'eq' || color == null) continue
          if (panel.canvases.has(renderKey)) continue
          const prev = prevCanvases.get(renderKey)
          if (prev) {
            prevCanvases.delete(renderKey)
            panel.canvases.set(renderKey, prev)
            continue
          }
          const canvas = newCanvas()
          canvas.width = canvas.height = canvasSize
          canvas.getContext('2d')?.clearRect(0, 0, canvasSize, canvasSize)
          const renderOption = { lineWidth, color, fillAlpha: fillAlpha ?? fillAlphaFallback }
          if (parsed.calcType === 'xy') {
            render2D(canvas, panelSize, offset, range, parsed, renderOption)
          } else {
            const isXCalc = parsed.calcType === 'x' || parsed.calcType === 'fx'
            const [baseAxisMin, baseAxisMax] = isXCalc ? [range.xMin, range.xMax] : [range.yMin, range.yMax]
            const result = fetchCache(isXCalc ? [ix, null]: [null, iy], parsed, () => (
              parsed.calcType === 'x' || parsed.calcType === 'y' ? calc1DRange(parsed, panelSize, baseAxisMin, baseAxisMax) : calc1DCurves(parsed, panelSize, baseAxisMin, baseAxisMax)
            ))
            render1D(canvas, panelSize, offset, range, parsed, result, renderOption)
          }
          panel.canvases.set(renderKey, canvas)
        }
        prevCanvases.forEach(canvas => unusedCanvases.push(canvas))
        if (performance.now() > startTime + calculationTime) break
      }
    }
    unusedCanvases.forEach(releaseCanvas)
  }
  render(calculate = true) {
    if (!this.needsRender) return
    const { canvas, width, height, panels, panelSize } = this
    const { center, sizePerPixel } = this.viewport
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!this.calcPaused && calculate) {
      this.calculate()
      this.needsRender = !this.isCalculationCompleted()
    }
    ctx.clearRect(0, 0, width, height)
    if (this.rendering.background != null && this.rendering.background !== 'transparent') {
      ctx.fillStyle = this.rendering.background
      ctx.fillRect(0, 0, width, height)
    }
    const renderGraph = () => {
      ctx.save()
      ctx.scale(1, -1)
      for (const formula of this.formulas) {
        const renderKey = renderKeyOf(formula)
        if (!renderKey) continue
        for (const [, panel] of panels) {
          const image = panel.canvases.get(renderKey)
          if (!image) continue
          const offsetX = (image.width - panelSize) / 2
          const offsetY = (image.height - panelSize) / 2
          const left = Math.round(width / 2 + (panel.dx * panel.ix - center.x) / sizePerPixel.x)
          const right = Math.round(width / 2 + (panel.dx * (panel.ix + 1) - center.x) / sizePerPixel.x)
          const bottom = Math.round(height / 2 + (panel.dy * panel.iy - center.y) / sizePerPixel.y)
          const top = Math.round(height / 2 + (panel.dy * (panel.iy + 1) - center.y) / sizePerPixel.y)
          ctx.drawImage(
            image,
            left - offsetX * (right - left) / panelSize,
            bottom - height - offsetY * (top - bottom) / panelSize,
            (right - left) * image.width / panelSize,
            (top - bottom) * image.height / panelSize
          )
        }
      }
      ctx.restore()
    }
    const { renderLabel, renderAxis } = this.prepareAxisLabelRenderer(ctx)
    for (const mode of this.rendering.order) {
      if (mode === 'label') renderLabel()
      if (mode === 'axis') renderAxis()
      if (mode === 'graph') renderGraph()
    }
  }
  prepareAxisLabelRenderer(ctx: CanvasRenderingContext2D) {
    const minIntervalPixel = this.rendering.axisInterval
    if (!minIntervalPixel) return { renderLabel: () => {}, renderAxis: () => {} }
    const fontSize = this.rendering.labelSize
    const font = fontSize ? `bold ${fontSize}px sans-serif` : null
    const { width, height } = this
    const { center, sizePerPixel } = this.viewport
    const xSize = width * sizePerPixel.x
    const ySize = height * sizePerPixel.y
    const axisIntervals = (size: number, pixel: number): [number, number] => {
      const base = 10 ** Math.floor(Math.log10(size * minIntervalPixel / pixel))
      const basePixel = base / size * pixel
      if (2 * basePixel >= minIntervalPixel) {
        return [2 * base, 4]
      } else if (5 * basePixel >= minIntervalPixel) {
        return [5 * base, 5]
      } else {
        return [10 * base, 5]
      }
    }
    const labels: { text: string; x: number; y: number; align: 'left' | 'center' | 'right'; baseline: 'middle' | 'top' | 'bottom' }[] = []
    const xConvert = (x: number) => width / 2 + (x - center.x) / sizePerPixel.x
    const yConvert = (y: number) => height / 2 - (y - center.y) / sizePerPixel.y
    const canvasX0 = xConvert(0)
    const canvasY0 = yConvert(0)
    const labelText = (n: number) => n.toFixed(10).replace(/\.?0+$/, '')
    const lines: [startX: number, startY: number, endX: number, endY: number, opacity: number][] = []
    const prepareXAxis = (mainInterval: number, division: number, renderZeroLabel: boolean) => {
      const ixMin = Math.ceil((-width * sizePerPixel.x / 2 + center.x) / mainInterval * division)
      const ixMax = Math.floor((width * sizePerPixel.x / 2 + center.x) / mainInterval * division)
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const x = ix * mainInterval / division
        const canvasX = xConvert(ix * mainInterval / division)
        const opacity = ix === 0 ? 1 : ix % division === 0 ? 0.5 : 0.1
        lines.push([canvasX, 0, canvasX, height, opacity])
        if (fontSize && ix % division === 0 && (renderZeroLabel || ix !== 0)) {
          labels.push({
            text: labelText(x),
            x: xConvert(x),
            y: clamp(canvasY0 + fontSize / 4, 0, height - fontSize),
            align: 'center',
            baseline: 'top'
          })
        }
      }
    }
    const prepareYAxis = (mainInterval: number, division: number, renderZeroLabel: boolean) => {
      const iyMin = Math.ceil((-height * sizePerPixel.y / 2 + center.y) / mainInterval * division)
      const iyMax = Math.floor((height * sizePerPixel.y / 2 + center.y) / mainInterval * division)
      let labelMaxWidth = 0
      for (let iy = iyMin; iy <= iyMax; iy++) {
        labelMaxWidth = Math.max(labelMaxWidth, ctx.measureText(labelText(iy * mainInterval / division)).width)
      }
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const y = iy * mainInterval / division
        const canvasY = yConvert(y)
        const opacity = iy === 0 ? 1 : iy % division === 0 ? 0.5 : 0.1
        lines.push([0, canvasY, width, canvasY, opacity])
        if (fontSize && iy % division === 0 && (renderZeroLabel || iy !== 0)) {
          const labelX = canvasX0 + fontSize / 4
          const text = labelText(y)
          if (labelX + labelMaxWidth + fontSize / 4 >= width) {
            labels.push({ text, x: Math.min(width, canvasX0) - fontSize / 4, y: canvasY, align: 'right', baseline: 'middle' })
          } else {
            labels.push({ text, x: Math.max(canvasX0, 0) + fontSize / 4, y: canvasY, align: 'left', baseline: 'middle' })
          }
        }
      }
    }
    const zeroVisible = 0 < canvasX0 && canvasX0 < width && 0 < canvasY0 && canvasY0 < height
    if (fontSize && zeroVisible) {
      const textZeroWidth = ctx.measureText('0').width
      labels.push({
        text: '0',
        align: 'left',
        baseline: 'top',
        x: clamp(canvasX0 + fontSize / 4, 0, width - textZeroWidth - fontSize / 4),
        y: clamp(canvasY0 + fontSize / 4, 0, height - fontSize)
      })
    }
    const scaleRatio = sizePerPixel.x / sizePerPixel.y
    ctx.save()
    if (font) ctx.font = font
    if (4 / 5 < scaleRatio && scaleRatio < 5 / 4) {
      const [main, div] = scaleRatio < 1 ? axisIntervals(xSize, width) : axisIntervals(ySize, height)
      prepareXAxis(main, div, !zeroVisible)
      prepareYAxis(main, div, !zeroVisible)
    } else {
      prepareXAxis(...axisIntervals(xSize, width), !zeroVisible)
      prepareYAxis(...axisIntervals(ySize, height), !zeroVisible)
    }
    ctx.restore()

    const renderAxis = () => {
      ctx.save()
      ctx.lineWidth = this.rendering.axisWidth
      ctx.strokeStyle = 'black'
      for (const [sx, sy, ex, ey, opacity] of lines) {
        ctx.globalAlpha = opacity
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      ctx.restore()
    }
    const renderLabel = () => {
      if (font == null) return
      ctx.save()
      ctx.font = font
      ctx.strokeStyle = 'white'
      ctx.fillStyle = 'black'
      ctx.lineWidth = 2
      ctx.globalAlpha = 1
      for (const { text, x, y, align, baseline } of labels) {
        ctx.textAlign = align
        ctx.textBaseline = baseline
        ctx.strokeText(text, x, y)
      }
      for (const { text, x, y, align, baseline } of labels) {
        ctx.textAlign = align
        ctx.textBaseline = baseline
        ctx.fillText(text, x, y)
      }
      ctx.restore()
    }
    return { renderAxis, renderLabel }
  }
}
