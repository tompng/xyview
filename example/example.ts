import { View } from 'xyview'

onload = () => {
  const view = new View({
    size: { width: 512, height: 512 },
    formulas: [
      { exp: '(x*x+y*y-1+sin(5theta)/3)*(y-tan(4x-siny))*floor(x)>=0√(y+1-xx)', color: 'red', fillAlpha: 0.5 },
      { exp: 'sin8r<0', color: 'blue', fillAlpha: 0.5 }
    ]
  })
  document.body.appendChild(view.canvas)

  let timer: number | null = null 
  view.canvas.onwheel = e => {
    const sizePerPixel = view.viewport.sizePerPixel
    if (e.ctrlKey) {
      const ratio = 1.01 ** e.deltaY
      view.update({ viewport: { sizePerPixel: { x: sizePerPixel.x * ratio, y: sizePerPixel.y * ratio }}, calcPaused: true })
      if (timer) clearTimeout(timer)
      timer = window.setTimeout(() => view.update({ calcPaused: false }), 100)
    } else {
      view.update({
        viewport: {
          center: {
            x: view.viewport.center.x + e.deltaX * sizePerPixel.x,
            y: view.viewport.center.y - e.deltaY * sizePerPixel.y
          }
        }
      })

    }
    e.preventDefault()
  }
  setInterval(() => {
    view.render()
  }, 10)

  ;(window as any).view = view
}
