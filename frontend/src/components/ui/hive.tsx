"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

// Fragment-shader "hive" background, adapted for WindDesk.
// The raymarching loop is the supplied source, unchanged. WindDesk additions are marked "WindDesk:":
//   - u_brand: optional lime/cyan tint so the effect matches the brand palette
//   - lifecycle: render scale, pause off-screen / hidden tab, reduced motion = one still frame,
//     GL resource cleanup, context-loss and compile-error fallbacks
const vertSrc = `#version 300 es
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos,0.0,1.0); }`

const fragSrc = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  u_res;
uniform float u_time;
uniform float u_brand; // WindDesk: 1.0 = brand tint, 0.0 = original colours

#define PI2 6.28318530718

// WindDesk: map the original colours onto the brand lime/cyan ramp, keeping the shader's luminance.
vec4 brandTint(vec4 c){
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 lime = vec3(0.78, 1.0, 0.24);
  vec3 cyan = vec3(0.35, 0.82, 1.0);
  vec3 col = mix(vec3(0.02, 0.03, 0.04), mix(cyan, lime, smoothstep(0.15, 0.85, l)), clamp(l * 1.6, 0.0, 1.0));
  return vec4(col, 1.0);
}

void main(){
  // Map your symbols:
  // FC -> vec3(gl_FragCoord.xy, 0.0)
  // r  -> vec3(u_res, max(u_res.x, u_res.y))
  // t  -> u_time
  vec3 FC = vec3(gl_FragCoord.xy, 0.0);
  vec3 r  = vec3(u_res, max(u_res.x, u_res.y));
  float t = u_time;

  vec4 o = vec4(0.0);

  // ---- Your one-liner with *only* safe initializations added ----
  vec3 p = vec3(0.0);               // was uninitialized
  float i = 0.0, z = 1.0, d = 0.0;  // init so first iter is defined

  for ( ; i++ < 2e1;
        o += (cos(2e1*p.y/z + vec4(6.0,1.0,2.0,0.0)) + 1.0) * d / z / 4.0 )
  {
    p = z * normalize(FC.rgb * 2.0 - r.xyy);
    p.x -= t;
    p.xy *= 0.4;
    z += (d = max(p.z + 6.0, dot(cos(p.xy), sin(p.yx / 0.4))));
  }

  o = tanh(o * o);
  fragColor = u_brand > 0.5 ? brandTint(o) : o;
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "compile error")
  return sh
}
function link(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!; gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link error")
  return p
}
function fsQuad(gl: WebGL2RenderingContext) {
  const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1,  -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  return buf
}

export interface HiveProps {
  className?: string
  /** "brand" tints to the WindDesk palette; "original" keeps the shader's own colours. @default "brand" */
  tint?: "brand" | "original"
  /** Render resolution relative to the CSS size. Lower is cheaper. @default 0.6 */
  scale?: number
  /** Called if WebGL2 is unavailable or the shader cannot compile. */
  onFallback?: () => void
}

export default function ShaderDemo({ className, tint = "brand", scale = 0.6, onFallback }: HiveProps){
  const ref = useRef<HTMLCanvasElement>(null)
  const fallback = useRef(onFallback)
  useEffect(() => { fallback.current = onFallback })

  useEffect(() => {
    const canvas = ref.current!
    const gl = canvas.getContext("webgl2", { premultipliedAlpha:false })
    if (!gl) { fallback.current?.(); return }

    let prog: WebGLProgram, buf: WebGLBuffer
    try {
      prog = link(gl, vertSrc, fragSrc)
      gl.useProgram(prog)
      buf = fsQuad(gl)
    } catch { fallback.current?.(); return }

    const uRes   = gl.getUniformLocation(prog, "u_res")
    const uTime  = gl.getUniformLocation(prog, "u_time")
    const uBrand = gl.getUniformLocation(prog, "u_brand")
    gl.uniform1f(uBrand, tint === "brand" ? 1 : 0)

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)) * scale
      const w = Math.max(1, Math.floor((canvas.clientWidth || window.innerWidth) * dpr))
      const h = Math.max(1, Math.floor((canvas.clientHeight || window.innerHeight) * dpr))
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
    }

    let raf = 0
    const t0 = performance.now()
    const frame = (t: number) => { gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLES, 0, 6) }
    const draw = () => { frame((performance.now() - t0) / 1000); raf = requestAnimationFrame(draw) }
    const start = () => { if (!raf && !reduced) draw() }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const onResize = () => { resize(); if (reduced || !raf) frame(3) }

    window.addEventListener("resize", onResize, { passive:true })
    resize()
    frame(3) // first paint, and the single still frame for reduced motion

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()))
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", onVis)
    const onLost = (e: Event) => { e.preventDefault(); stop(); fallback.current?.() }
    canvas.addEventListener("webglcontextlost", onLost)

    return () => {
      stop(); io.disconnect()
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVis)
      canvas.removeEventListener("webglcontextlost", onLost)
      gl.deleteBuffer(buf); gl.deleteProgram(prog)
    }
  }, [tint, scale])

  return <canvas ref={ref} aria-hidden="true" className={cn("block h-full w-full bg-black", className)} />
}
