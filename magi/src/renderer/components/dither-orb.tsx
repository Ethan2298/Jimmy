import { memo, useEffect, useRef } from "react";

const BAYER8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function hash(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise3d(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = smoothstep(fx), sy = smoothstep(fy), sz = smoothstep(fz);

  const n000 = hash(ix, iy, iz);
  const n100 = hash(ix + 1, iy, iz);
  const n010 = hash(ix, iy + 1, iz);
  const n110 = hash(ix + 1, iy + 1, iz);
  const n001 = hash(ix, iy, iz + 1);
  const n101 = hash(ix + 1, iy, iz + 1);
  const n011 = hash(ix, iy + 1, iz + 1);
  const n111 = hash(ix + 1, iy + 1, iz + 1);

  return (
    n000 * (1 - sx) * (1 - sy) * (1 - sz) +
    n100 * sx * (1 - sy) * (1 - sz) +
    n010 * (1 - sx) * sy * (1 - sz) +
    n110 * sx * sy * (1 - sz) +
    n001 * (1 - sx) * (1 - sy) * sz +
    n101 * sx * (1 - sy) * sz +
    n011 * (1 - sx) * sy * sz +
    n111 * sx * sy * sz
  );
}

function fbm(x: number, y: number, z: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < 4; i++) {
    val += amp * noise3d(x * freq, y * freq, z * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

const AZURE = {
  dark: [2, 10, 20] as const,
  bright: [40, 180, 255] as const,
};

interface DitherOrbProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

interface OrbSample {
  gx: number;
  gy: number;
  nx: number;
  ny: number;
  nz: number;
  threshold: number;
}

function buildOrbSamples(renderSize: number, cellSize: number): OrbSample[] {
  const samples: OrbSample[] = [];
  const cxC = renderSize / 2;
  const cyC = renderSize / 2;
  const radius = renderSize / 2;

  for (let gy = 0; gy < renderSize; gy += cellSize) {
    for (let gx = 0; gx < renderSize; gx += cellSize) {
      const dotCx = gx + cellSize / 2;
      const dotCy = gy + cellSize / 2;

      const dx = (dotCx - cxC) / radius;
      const dy = (dotCy - cyC) / radius;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1) continue;

      const ix = Math.floor(gx / cellSize) % 8;
      const iy = Math.floor(gy / cellSize) % 8;
      samples.push({
        gx,
        gy,
        nx: dx,
        ny: dy,
        nz: Math.sqrt(1 - r2),
        threshold: (BAYER8[iy][ix] + 0.5) / 64,
      });
    }
  }

  return samples;
}

function DitherOrbImpl({ size = 20, className, animate = true }: DitherOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(Math.random() * 1000);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;

    const RENDER_SIZE = 72;
    const cellSize = 3;
    const dotSize = 3;

    canvasNode.width = RENDER_SIZE;
    canvasNode.height = RENDER_SIZE;

    const contextNode = canvasNode.getContext("2d");
    if (!contextNode) return;

    const canvas = canvasNode;
    const context: CanvasRenderingContext2D = contextNode;

    const cxC = RENDER_SIZE / 2;
    const cyC = RENDER_SIZE / 2;
    const radius = RENDER_SIZE / 2;
    const color = AZURE;
    const backgroundFill = `rgb(${color.dark[0]},${color.dark[1]},${color.dark[2]})`;
    const samples = buildOrbSamples(RENDER_SIZE, cellSize);

    const lnx = 0.5;
    const lny = -0.5;
    const lnz = 0.7071;
    const hx = lnx;
    const hy = lny;
    const hz = lnz + 1;
    const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);

    function renderFrame() {
      // Original cadence: advance a fixed amount every animation frame.
      timeRef.current += 0.025;
      const time = timeRef.current;

      context.clearRect(0, 0, canvas.width, canvas.height);

      context.save();
      context.beginPath();
      context.arc(cxC, cyC, radius, 0, Math.PI * 2);
      context.clip();

      context.fillStyle = backgroundFill;
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (const sample of samples) {
        const { gx, gy, nx, ny, nz, threshold } = sample;

        const nDotL = nx * lnx + ny * lny + nz * lnz;
        const lambert = Math.pow(Math.max(0, nDotL), 3);

        const nDotH = (nx * hx + ny * hy + nz * hz) / hLen;
        const spec = Math.pow(Math.max(0, nDotH), 16) * 0.3;

        const noiseScale = 1.8;
        const morph = fbm(
          nx * noiseScale + time * 0.35,
          ny * noiseScale + time * 0.3,
          nz * noiseScale + time * 0.25
        );
        const morph2 = fbm(
          nx * 3.5 - time * 0.2,
          ny * 3.5 + time * 0.25,
          nz * 3.5 + time * 0.15
        );
        const noiseOffset = (morph - 0.5) * 0.8 + (morph2 - 0.5) * 0.3;

        const value = Math.max(0, Math.min(1, lambert * 1.2 + spec + noiseOffset));
        if (value <= threshold) continue;

        let cr = color.bright[0];
        let cg = color.bright[1];
        let cb = color.bright[2];

        const specIntensity = Math.pow(Math.max(0, nDotH), 8);
        const w = Math.min(0.4, specIntensity * 0.5);
        cr = cr + (255 - cr) * w;
        cg = cg + (255 - cg) * w;
        cb = cb + (255 - cb) * w;

        context.fillStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
        context.fillRect(gx, gy, dotSize, dotSize);
      }

      context.restore();
    }

    renderFrame();
    if (!animate) return;

    const loop = () => {
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "transparent",
      }}
    />
  );
}

export const DitherOrb = memo(DitherOrbImpl);
