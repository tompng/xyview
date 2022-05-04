import { View } from './view'

onload = () => {
  const exp = '(x*x+y*y-1+sin(5theta)/3)*(y-tan(4x-siny))*floor(x)>=0√(y+1-xx)'
  const view = new View({
    size: { width: 512, height: 512 },
    formulas: [
      { exp: exp, color: 'red', fillAlpha: 0.5 },
      { exp: 'sin8r<0', color: 'blue', fillAlpha: 0.5 }
    ]
  })
  document.body.appendChild(view.canvas)
  ;(window as any).view = view
}
