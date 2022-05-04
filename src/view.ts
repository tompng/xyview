import { parseFormula, ParsedFormula, render } from './panel'

type Size = { width: number; height: number }
type RenderOption = {
  lineWidth: number
  axis: boolean
  label: boolean
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

function listEquals(listA: Record<string, unknown>[], listB: Record<string, unknown>[]) {
  return listA.length === listB.length && listA.every((a, i) => isEqual(a, listB[i]))
}

type Panel = {
  canvases: HTMLCanvasElement[]
  ix: number
  iy: number
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
    this.rendering = info.rendering ?? { lineWidth: 2, axis: true, label: true }
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
    if (listEquals(this.formulas, formulas)) return
    this.formulas = formulas
    this.invalidatePanels()
  }
  updateRendering(rendering: RenderOption) {
    if (isEqual(rendering, this.rendering)) return
    if (this.rendering.lineWidth !== rendering.lineWidth) this.invalidatePanels()
    this.rendering = rendering
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
    const ixBase = center.x / sizePerPixel.width
    const iyBase = center.y / sizePerPixel.height
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
        const x = Math.round(width / 2 + center.x / sizePerPixel.width - offsetX) + panel.ix * panelSize
        const y = Math.round(height / 2 + center.y / sizePerPixel.height - offsetY) + panel.iy * panelSize
        ctx.drawImage(image, x, y - height, image.width, image.height)
      }
    }
    ctx.restore()
    if (this.rendering.axis) this.renderAxisLabel(this.rendering)
  }
  renderAxisLabel({ axis, label }: { axis: boolean; label: boolean }) {

  }
}

