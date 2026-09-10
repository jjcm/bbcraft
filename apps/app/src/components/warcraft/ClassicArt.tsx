import { useEffect, useRef, useState } from "react";
import { lightArtwork } from "./lighting";

export function ClassicArt({
  asset,
  width,
  height,
  lighting,
  top = 0,
}: {
  asset: string;
  width: number;
  height: number;
  lighting: boolean;
  top?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!lighting || !canvas.current) return;
    return lightArtwork(
      canvas.current,
      () => [{ asset, x: 0, y: 0, width, height }],
      () => setReady(true),
      () => setReady(false),
    );
  }, [asset, width, height, lighting]);
  return (
    <div
      className="classic-art"
      aria-hidden="true"
      style={{ width, height, top }}
    >
      <img
        src={`/warcraft/${asset}.webp`}
        alt=""
        draggable={false}
        style={{ visibility: lighting && ready ? "hidden" : "visible" }}
      />
      {lighting && <canvas ref={canvas} style={{ opacity: ready ? 1 : 0 }} />}
    </div>
  );
}
