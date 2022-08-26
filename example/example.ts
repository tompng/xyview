import { View } from 'xyview'

onload = () => {
  const formulas = [
    { tex: 'x^4+y^4=1+\\frac{\\sin4\\theta}{2}', color: 'blue', fillAlpha: 0.5 },
    { plain: '(x*x+y*y-1+sin(5theta)/3)*(y-tan(4x-siny))*floor(x)>=0√(y+1-xx)', color: 'red', fillAlpha: 0.5 },
    { plain: '', color: 'cyan' },
    { plain: '', color: 'magenta' },
    { plain: '', color: 'yellow' },
  ]
  const view = new View({
    size: { width: 512, height: 512 },
    formulas: [...formulas]
  })
  document.body.append(view.canvas)

  const formDiv = document.createElement('div')
  document.body.append(formDiv)
  const forms = formulas.map((formula, index) => {
    const wrapper = document.createElement('div')
    const input = document.createElement('input')
    input.style.width = '512px'
    input.style.fontSize = '20px'
    const message = document.createElement('p')
    message.style.fontSize = '12px'
    wrapper.append(input, message)
    formDiv.append(wrapper)
    input.value = formula.tex ?? formula.plain
    input.onchange = () => {
      if (formula.tex != null) formula.tex = input.value
      else formula.plain = input.value
      update()
    }
    return { input, index, message }
  })
  function update() {
    view.update({ formulas })
    for (const { input, index, message } of forms) {
      const parsed = view.formulas[index].parsed
      const error = 'error' in parsed ? parsed.error : undefined
      const warn = 'warn' in parsed ? parsed.warn : undefined
      message.textContent = error ?? warn ?? ''
    }
  }

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
