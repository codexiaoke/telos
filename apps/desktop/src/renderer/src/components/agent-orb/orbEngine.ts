/*
 * Portions of the geometry and projection approach in this file are derived
 * from thinking-orbs by Jakub Antalik, commit
 * e04f3e87075faa6dd7d42f3073198434d26ba730, licensed under the MIT License.
 *
 * This implementation has been rewritten and reduced for Telos. See the
 * repository THIRD_PARTY_NOTICES.md and licenses/thinking-orbs-MIT.txt.
 */

interface Dot {
  x: number
  y: number
  z: number
  radius: number
  tone: number
  alpha: number
}

function hash(first: number, second: number): number {
  const value = Math.sin(first * 12.9898 + second * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function projector(yaw: number, tilt: number, center: number) {
  const sinTilt = Math.sin(tilt)
  const cosTilt = Math.cos(tilt)
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  return (x: number, y: number, z: number): [number, number, number] => {
    const rotatedX = x * cosYaw + z * sinYaw
    const rotatedZ = -x * sinYaw + z * cosYaw
    const rotatedY = y * cosTilt - rotatedZ * sinTilt
    const depth = y * sinTilt + rotatedZ * cosTilt
    return [center + rotatedX, center - rotatedY, depth]
  }
}

function paint(ctx: CanvasRenderingContext2D, dots: Dot[], dark: boolean): void {
  dots.sort((left, right) => left.z - right.z)

  for (const dot of dots) {
    const gray = Math.round((dark ? 1 - dot.tone : dot.tone) * 255)
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${dot.alpha})`
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawAgentOrb(
  ctx: CanvasRenderingContext2D,
  size: number,
  time: number,
  dark: boolean,
  active: boolean
): void {
  const center = size / 2
  const radius = size * 0.37
  const project = projector(time * (active ? 0.16 : 0.055), 0.34, center)
  const dots: Dot[] = []
  const orbitCount = active ? 9 : 7
  const pathDots = active ? 24 : 20
  const particles = active ? 2 : 1
  const breath = active ? 1 : 0.96 + Math.sin(time * 0.9) * 0.035

  for (let orbit = 0; orbit < orbitCount; orbit += 1) {
    const first = hash(orbit, 1.7)
    const second = hash(orbit, 5.2)
    const third = hash(orbit, 8.9)
    const orbitRadius = radius * (0.5 + 0.48 * first) * breath
    const theta = first * 2 * Math.PI
    const phi = Math.acos(2 * second - 1)
    const normalX = Math.sin(phi) * Math.cos(theta)
    const normalY = Math.cos(phi)
    const normalZ = Math.sin(phi) * Math.sin(theta)
    let basisX = -normalY
    let basisY = normalX
    const basisZ = 0
    const basisLength = Math.max(0.000001, Math.hypot(basisX, basisY))
    basisX /= basisLength
    basisY /= basisLength
    const crossX = normalY * basisZ - normalZ * basisY
    const crossY = normalZ * basisX - normalX * basisZ
    const crossZ = normalX * basisY - normalY * basisX
    const direction = third > 0.5 ? 1 : -1
    const speed = (active ? 0.42 : 0.12) * direction * (0.65 + third * 0.55)

    for (let index = 0; index < pathDots; index += 1) {
      const angle = (index / pathDots) * 2 * Math.PI
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)
      const [x, y, depth] = project(
        (basisX * cosine + crossX * sine) * orbitRadius,
        (basisY * cosine + crossY * sine) * orbitRadius,
        (basisZ * cosine + crossZ * sine) * orbitRadius
      )
      const relativeDepth = (depth / Math.max(orbitRadius, 1) + 1) / 2
      dots.push({
        x,
        y,
        z: depth,
        radius: Math.max(0.45, size * 0.008),
        tone: 0.7,
        alpha: 0.18 + relativeDepth * 0.28
      })
    }

    for (let particle = 0; particle < particles; particle += 1) {
      const angle = time * speed + (particle / particles) * 2 * Math.PI + second * 6
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)
      const [x, y, depth] = project(
        (basisX * cosine + crossX * sine) * orbitRadius,
        (basisY * cosine + crossY * sine) * orbitRadius,
        (basisZ * cosine + crossZ * sine) * orbitRadius
      )
      const relativeDepth = (depth / Math.max(orbitRadius, 1) + 1) / 2
      dots.push({
        x,
        y,
        z: depth,
        radius: Math.max(0.85, size * (0.014 + relativeDepth * 0.012)),
        tone: 0.34 - relativeDepth * 0.2,
        alpha: 0.78
      })
    }
  }

  paint(ctx, dots, dark)
}
