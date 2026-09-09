import { useEffect, useRef, useState } from "react";
import { lightArtwork, type ArtSprite } from "./lighting";

export function WarcraftArt({ kind }: { kind: "frame" | "header" | "crest" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mount = ref.current;
    const canvas = mount?.querySelector("canvas");
    if (!mount || !canvas) return;
    const sprites = (): ArtSprite[] => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (kind === "crest")
        return [
          {
            asset: "crest",
            x: (w - h * 0.74) / 2,
            y: 0,
            width: h * 0.74,
            height: h,
          },
        ];
      if (kind === "header") {
        const result: ArtSprite[] = [
          {
            asset: "header",
            x: 16,
            y: 4,
            width: w - 32,
            height: h - 8,
            slice: 0.15,
            border: 22,
          },
        ];
        if (w > 767)
          result.push(
            { asset: "lion", x: 0, y: 0, width: h, height: h },
            { asset: "lion", x: w - h, y: 0, width: h, height: h },
          );
        const origin = canvas.getBoundingClientRect();
        mount.parentElement
          ?.querySelectorAll<HTMLElement>("[data-wc-button]")
          .forEach((button) => {
            const rect = button.getBoundingClientRect();
            result.push({
              asset: "button",
              x: rect.left - origin.left,
              y: rect.top - origin.top,
              width: rect.width,
              height: rect.height,
            });
            const icon = button.querySelector<HTMLElement>("[data-wc-icon]");
            if (icon) {
              const r = icon.getBoundingClientRect();
              result.push({
                asset: icon.dataset.wcIcon ?? "forge",
                x: r.left - origin.left,
                y: r.top - origin.top,
                width: r.width,
                height: r.height,
              });
            }
          });
        return result;
      }
      const top = 84;
      const chainWidth = 27;
      return [
        { asset: "chain", x: 42, y: 0, width: chainWidth, height: top + 18 },
        {
          asset: "chain",
          x: w - 69,
          y: 0,
          width: chainWidth,
          height: top + 18,
        },
        {
          asset: "stone",
          x: 17,
          y: top + 17,
          width: w - 34,
          height: h - top - 34,
          opacity: 0.35,
        },
        {
          asset: "frame",
          x: 0,
          y: top,
          width: w,
          height: h - top,
          slice: 0.14,
          border: 40,
          hollow: true,
        },
        { asset: "corner", x: -5, y: h - 74, width: 79, height: 79 },
        {
          asset: "corner",
          x: w - 74,
          y: h - 74,
          width: 79,
          height: 79,
          flip: true,
        },
      ];
    };
    return lightArtwork(
      canvas,
      sprites,
      () => setReady(true),
      () => setReady(false),
    );
  }, [kind]);
  return (
    <div
      ref={ref}
      className={`wc-art wc-art-${kind}${ready ? " wc-art-ready" : ""}`}
      aria-hidden="true"
    >
      <div className="wc-art-fallback">
        {kind === "frame" ? (
          <>
            <i className="wc-chain wc-chain-left" />
            <i className="wc-chain wc-chain-right" />
            <i className="wc-frame-fallback" />
            <i className="wc-corner wc-corner-left" />
            <i className="wc-corner wc-corner-right" />
          </>
        ) : null}
        {kind === "header" ? (
          <>
            <i className="wc-header-fallback" />
            <i className="wc-lion wc-lion-left" />
            <i className="wc-lion wc-lion-right" />
          </>
        ) : null}
        {kind === "crest" ? <img src="/warcraft/crest.webp" alt="" /> : null}
      </div>
      <canvas />
    </div>
  );
}
