import { useEffect, useRef } from 'react'

// The desktop's wallpaper: slow curtains of light, drawn by one fragment shader. It leans towards
// the colour of whichever project is open. Without WebGL the CSS background behind it shows instead.

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTint;
uniform vec2 uMouse;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y + uMouse * 0.05;
  float t = uTime * 0.03;

  // Noise warped by noise: the folds drift instead of sliding.
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t)), fbm(p * 1.1 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.5 + 3.0 * q + vec2(1.7, 9.2) + t * 0.6),
                fbm(p * 1.5 + 3.0 * q + vec2(8.3, 2.8) - t * 0.5));
  float f = fbm(p * 1.3 + 2.5 * r);

  vec3 col = vec3(0.016, 0.032, 0.066);
  col = mix(col, vec3(0.06, 0.20, 0.56), smoothstep(0.22, 0.8, f));
  col = mix(col, vec3(0.30, 0.15, 0.58), smoothstep(0.4, 0.95, r.x) * 0.55);
  col = mix(col, uTint * 0.75, smoothstep(0.30, 0.75, f * q.y * 2.2) * 0.5);

  // Two curtains of light, bent by the same field.
  float bend = (r.y - 0.5) * 0.9;
  float a = pow(max(0.0, 1.0 - abs(p.y + 0.22 * sin(p.x * 1.4 + t * 3.0) + bend - 0.10) * 1.7), 3.0);
  float b = pow(max(0.0, 1.0 - abs(p.y - 0.18 * sin(p.x * 0.9 - t * 2.2) - bend + 0.34) * 2.4), 3.0);
  col += uTint * a * 0.36 * (0.5 + 0.5 * f);
  col += vec3(0.42, 0.26, 0.85) * b * 0.22;

  col += vec3(0.08, 0.22, 0.52) * pow(1.0 - uv.y, 3.0) * 0.35;
  col *= mix(0.6, 1.0, smoothstep(1.3, 0.2, length(p)));
  // A little dither, so the dark gradients do not band.
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 128.0;
  gl_FragColor = vec4(col, 1.0);
}
`

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

export function Wallpaper({ tint, still }: { tint: string; still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ tint, still })
  useEffect(() => {
    live.current = { tint, still }
  }, [tint, still])

  useEffect(() => {
    const el = canvas.current
    const gl = el?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!el || !gl) return

    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, source)
      gl.compileShader(s)
      return s
    }
    const program = gl.createProgram()
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    // One triangle that covers the screen.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const at = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(at)
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const uRes = uniform('uRes')
    const uTime = uniform('uTime')
    const uTint = uniform('uTint')
    const uMouse = uniform('uMouse')

    // The picture is soft, so half the screen's resolution is plenty.
    const fit = () => {
      const scale = 0.5 * Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.max(1, Math.round(el.clientWidth * scale))
      el.height = Math.max(1, Math.round(el.clientHeight * scale))
      gl.viewport(0, 0, el.width, el.height)
    }
    fit()
    const resized = new ResizeObserver(fit)
    resized.observe(el)

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const moved = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      mouse.ty = 1 - (e.clientY / window.innerHeight) * 2
    }
    window.addEventListener('pointermove', moved)

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const colour = rgb(live.current.tint)
    let time = 40
    let last = performance.now()
    let drawn = false
    let frame = 0
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const wanted = rgb(live.current.tint)
      const settled = wanted.every((c, i) => Math.abs(c - colour[i]) < 0.004)
      // Behind the lock screen, or for a visitor who asked for less motion, one frame is enough.
      if (drawn && settled && (live.current.still || calm.matches)) return
      if (!live.current.still && !calm.matches) time += dt
      for (let i = 0; i < 3; i++) colour[i] += (wanted[i] - colour[i]) * Math.min(1, dt * 2.5)
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2)
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2)
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, time)
      gl.uniform3f(uTint, colour[0], colour[1], colour[2])
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      drawn = true
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      window.removeEventListener('pointermove', moved)
    }
  }, [])

  return <canvas ref={canvas} className="wallpaper" aria-hidden="true" />
}
