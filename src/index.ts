import { parseFormula, render } from './panel'

onload = () => {
  const { func, mode } = parseFormula('(x*x+y*y-1+sin(5theta)/3)*(y-tan(4x-siny))*floor(x)>=0√(y+1-xx)')
  const canvas = document.createElement('canvas')
  const size = 512
  const offset = 2
  canvas.width = canvas.height = size + 2 * offset

  const t = performance.now()
  render(canvas, size, offset, 2, func, { xMin: -2, yMin: -2, xMax: 2, yMax: 2 }, mode)
  console.log(performance.now() - t)

  const t2 = performance.now()
  for(let i=0;i<size*size; i++) func.value(i,i)
  console.log(performance.now() - t2)

  document.body.appendChild(canvas)
}

