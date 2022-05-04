import { parseFormula, ParsedFormula, render } from './panel'

type Size = { width: number; height: number }
type RenderOption = {
  lineWidth: number
  axisInterval: number | null
  axisWidth: number
  labelSize: number | null
}
type Point = { x: number; y: number }
type Viewport = {
  center: Point
  sizePerPixel: Size
}

interface FormulaInput {
  exp: string
  color: string
  fillAlpha: number
}

type Formula = {
  exp: string
  color: string
  fillAlpha: number
  parsed: ParsedFormula | { error: string }
}

type UpdateInfo = {
  size?: Size
  viewport?: Viewport
  rendering?: RenderOption
  formulas?: FormulaInput[]
  inChange?: boolean
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
  canvases: HTMLCanvasElement[]
  ix: number
  iy: number
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = canvas.height = 0
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
  panels = new Map<string, Panel>()
  constructor(info: UpdateInfo = {}) {
    this.rendering = info.rendering ?? { lineWidth: 2, axisWidth: 2, axisInterval: 120, labelSize: 14 }
    this.viewport = info.viewport ?? { center: { x: 0, y: 0 }, sizePerPixel: { width: 1 / 256, height: 1 / 256 } }
    this.width = Math.round(info.size?.width ?? 256)
    this.height = Math.round(info.size?.height ?? 256)
    this.canvas = document.createElement('canvas')
    this.update(info)
  }
  updateFormulas(input: FormulaInput[]) {
    const cache = new Map<string, ParsedFormula | { error: string }>()
    for (const formula of this.formulas) cache.set(formula.exp, formula.parsed)
    const formulas: Formula[] = input.map(input => {
      try {
        const parsed = cache.get(input.exp) ?? parseFormula(input.exp)
        return { ...input, parsed }
      } catch(e) {
        return { ...input, parsed: { error: String(e) } }
      }
    })
    if (isEqual(this.formulas, formulas)) return
    this.formulas = formulas
    this.invalidatePanels()
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
  update({ size, viewport, rendering, formulas }: UpdateInfo) {
    if (formulas) this.updateFormulas(formulas)
    if (rendering) this.updateRendering(rendering)
    if (size) this.updateSize(size)
    if (viewport) this.updateViewport(viewport)
    this.render()
  }
  calculate() {
    const { width, height, panels, panelSize } = this
    const { center, sizePerPixel } = this.viewport
    const startTime = performance.now()
    const calculationTime = 200
    const { lineWidth } = this.rendering
    const offset = Math.ceil(lineWidth / 2) + 2
    const ixBase = -center.x / sizePerPixel.width
    const iyBase = -center.y / sizePerPixel.height
    const ixMin = Math.ceil((-width / 2 - ixBase) / panelSize) - 1
    const ixMax = Math.floor((width / 2 - ixBase) / panelSize)
    const iyMin = Math.ceil((-height / 2 - iyBase) / panelSize) - 1
    const iyMax = Math.floor((height / 2 - iyBase) / panelSize)
    const unusedPanels: Panel[] = []
    for (const [key, panel] of panels.entries()) {
      if (panel.ix < ixMin - 1 || panel.ix > ixMax + 1 || panel.iy < iyMin - 1 || panel.iy > iyMax + 1) {
        panels.delete(key)
        unusedPanels.push(panel)
      }
    }
    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const key = `${ix}/${iy}`
        if (panels.has(key)) continue
        const canvases = unusedPanels.pop()?.canvases ?? [...new Array(this.formulas.length)].map(() => document.createElement('canvas'))
        const canvasSize = panelSize + 2 * offset
        const range = {
          xMin: ix * sizePerPixel.width * panelSize,
          xMax: (ix + 1) * sizePerPixel.width * panelSize,
          yMin: iy * sizePerPixel.height * panelSize,
          yMax: (iy + 1) * sizePerPixel.height * panelSize
        }
        for (let i = 0; i < this.formulas.length; i++) {
          const formula = this.formulas[i]
          const canvas = canvases[i]
          if ('mode' in formula.parsed) {
            canvas.width = canvas.height = canvasSize
            canvas.getContext('2d')?.clearRect(0, 0, canvasSize, canvasSize)
            render(canvas, panelSize, offset, range, formula.parsed, { lineWidth, ...formula })
          } else {
            canvas.width = canvas.height = 0
          }
        }
        panels.set(key, { ix, iy, canvases })
        if (performance.now() > startTime + calculationTime) {
          console.log('interrupt')
          this.needsRender = true
          break
        }
      }
    }
    console.log('calc: ' + (performance.now()-startTime))
    for (const panel of unusedPanels) panel.canvases.forEach(releaseCanvas)
  }
  render() {
    if (!this.needsRender) return
    const { canvas, width, height, panels, panelSize } = this
    const { center, sizePerPixel } = this.viewport
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    this.needsRender = false
    if (!this.calcPaused) this.calculate()
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.scale(1, -1)
    for (let i = 0; i < this.formulas.length; i++) {
      for (const [_key, panel] of panels) {
        const image = panel.canvases[i]
        const offsetX = (image.width - panelSize) / 2
        const offsetY = (image.height - panelSize) / 2
        const x = Math.round(width / 2 - center.x / sizePerPixel.width - offsetX) + panel.ix * panelSize
        const y = Math.round(height / 2 - center.y / sizePerPixel.height - offsetY) + panel.iy * panelSize
        ctx.drawImage(image, x, y - height, image.width, image.height)
      }
    }
    ctx.restore()
    this.renderAxis(ctx)
  }
  renderAxis(ctx: CanvasRenderingContext2D) {
    const minIntervalPixel = this.rendering.axisInterval
    if (!minIntervalPixel) return
    const fontSize = this.rendering.labelSize
    ctx.save()
    const { width, height, panels, panelSize } = this
    const { center, sizePerPixel } = this.viewport
    const xSize = width * sizePerPixel.width
    const ySize = height * sizePerPixel.height
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
    if (fontSize) ctx.font = `bold ${fontSize}px sans-serif`
    const labels: { text: string; x: number; y: number; align: 'left' | 'center' | 'right'; baseline: 'middle' | 'top' | 'bottom' }[] = []
    const xConvert = (x: number) => width / 2 + (x - center.x) / sizePerPixel.width
    const yConvert = (y: number) => height / 2 - (y - center.y) / sizePerPixel.height
    const canvasX0 = xConvert(0)
    const canvasY0 = yConvert(0)
    const labelText = (n: number) => n.toFixed(10).replace(/\.?0+$/, '')
    ctx.lineWidth = this.rendering.axisWidth
    ctx.strokeStyle = 'black'
    const renderXAxis = (mainInterval: number, division: number, renderZeroLabel: boolean) => {
      const ixMin = Math.ceil((-width * sizePerPixel.width / 2 + center.x) / mainInterval * division)
      const ixMax = Math.floor((width * sizePerPixel.width / 2 + center.x) / mainInterval * division)
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const x = ix * mainInterval / division
        const canvasX = xConvert(ix * mainInterval / division)
        ctx.globalAlpha = ix === 0 ? 1 : ix % division === 0 ? 0.5 : 0.1
        ctx.beginPath()
        ctx.moveTo(canvasX, 0)
        ctx.lineTo(canvasX, height)
        ctx.stroke()
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
    const renderYAxis = (mainInterval: number, division: number, renderZeroLabel: boolean) => {
      const iyMin = Math.ceil((-height * sizePerPixel.height / 2 + center.y) / mainInterval * division)
      const iyMax = Math.floor((height * sizePerPixel.height / 2 + center.y) / mainInterval * division)
      let labelMaxWidth = 0
      for (let iy = iyMin; iy <= iyMax; iy++) {
        labelMaxWidth = Math.max(labelMaxWidth, ctx.measureText(labelText(iy * mainInterval / division)).width)
      }
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const y = iy * mainInterval / division
        const canvasY = yConvert(y)
        ctx.globalAlpha = (iy === 0 ? 1 : iy % division === 0 ? 0.5 : 0.1)
        ctx.beginPath()
        ctx.moveTo(0, canvasY)
        ctx.lineTo(width, canvasY)
        ctx.stroke()
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
    const scaleRatio = sizePerPixel.width / sizePerPixel.height
    if (4 / 5 < scaleRatio && scaleRatio < 5 / 4) {
      const [main, div] = sizePerPixel.width < sizePerPixel.height ? axisIntervals(xSize, width) : axisIntervals(ySize, height)
      renderXAxis(main, div, !zeroVisible)
      renderYAxis(main, div, !zeroVisible)
    } else {
      renderXAxis(...axisIntervals(xSize, width), !zeroVisible)
      renderYAxis(...axisIntervals(ySize, height), !zeroVisible)
    }
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
}
