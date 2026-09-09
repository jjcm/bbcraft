export interface ArtSprite {
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slice?: number;
  border?: number;
  hollow?: boolean;
  flip?: boolean;
  opacity?: number;
}

const vertexSource = `#version 300 es
in vec2 position;
uniform vec2 viewport;
uniform vec4 rect;
uniform vec4 uvRect;
out vec2 uv;
out vec2 pixel;
void main() {
  pixel = rect.xy + position * rect.zw;
  uv = uvRect.xy + position * uvRect.zw;
  gl_Position = vec4(pixel / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform sampler2D heightMap;
uniform sampler2D roughnessMap;
uniform vec2 light;
uniform vec2 viewport;
uniform float relief;
uniform float opacity;
uniform float motion;
uniform float flicker;
uniform float normalFlip;
in vec2 uv;
in vec2 pixel;
out vec4 color;
void main() {
  vec2 direction = (light - pixel) / max(viewport.x, viewport.y);
  float height = texture(heightMap, uv).r;
  vec2 sampleUv = clamp(uv - direction * (height - .5) * .002 * motion, .001, .999);
  vec4 base = texture(albedoMap, sampleUv);
  if (base.a < .015) discard;
  vec3 raw = texture(normalMap, sampleUv).xyz * 2. - 1.;
  vec3 normal = normalize(vec3(raw.xy * vec2(normalFlip, -1.) * relief, max(raw.z, .22)));
  vec3 key = normalize(vec3(direction * 2.2, .52));
  vec3 fill = normalize(vec3(-.6, -.7, .8));
  float roughness = texture(roughnessMap, sampleUv).r;
  vec3 halfVector = normalize(key + vec3(0., 0., 1.));
  float specular = pow(max(dot(normal, halfVector), 0.), mix(76., 8., roughness));
  specular *= (1. - roughness * .9) * .40 * relief;
  vec3 illumination = vec3(.56, .61, .70);
  illumination += vec3(.64, .56, .39) * max(dot(normal, key), 0.) * flicker;
  illumination += vec3(.12, .20, .35) * max(dot(normal, fill), 0.);
  vec3 lit = base.rgb * illumination + vec3(.93, .82, .61) * specular;
  float a = base.a * opacity;
  color = vec4(clamp(lit, 0., 1.) * a, a);
}`;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string) {
  let pending = imageCache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load ${url}`));
      image.src = url;
    });
    imageCache.set(url, pending);
  }
  return pending;
}

export function lightArtwork(
  canvas: HTMLCanvasElement,
  getSprites: () => ArtSprite[],
  onReady: () => void,
  onFallback: () => void,
) {
  if (typeof WebGL2RenderingContext === "undefined") {
    canvas.dataset.lighting = "webgl-unavailable";
    return () => {};
  }
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    canvas.dataset.lighting = "webgl-unavailable";
    return () => {};
  }
  canvas.dataset.lighting = "loading";
  const shader = (type: number, source: string) => {
    const result = gl.createShader(type);
    if (!result) throw new Error("Unable to create artwork shader");
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(result);
      gl.deleteShader(result);
      throw new Error(error ?? "Artwork shader failed");
    }
    return result;
  };
  const program = gl.createProgram();
  if (!program) return () => {};
  let vertex: WebGLShader;
  let fragment: WebGLShader;
  try {
    vertex = shader(gl.VERTEX_SHADER, vertexSource);
    fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  } catch (error) {
    canvas.dataset.lighting = "shader-error";
    console.warn("[warcraft] Lighting shader:", error);
    gl.deleteProgram(program);
    return () => {};
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return () => {};
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    viewport: uniform("viewport"),
    rect: uniform("rect"),
    uv: uniform("uvRect"),
    light: uniform("light"),
    relief: uniform("relief"),
    opacity: uniform("opacity"),
    motion: uniform("motion"),
    flicker: uniform("flicker"),
    normalFlip: uniform("normalFlip"),
  };
  ["albedoMap", "normalMap", "heightMap", "roughnessMap"].forEach((name, i) =>
    gl.uniform1i(uniform(name), i),
  );
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const textures = new Map<string, WebGLTexture[]>();
  const loading = new Set<string>();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false;
  let lost = false;
  let ready = false;
  let frame = 0;
  let previous = 0;
  let activeUntil = 0;
  let pointerX = innerWidth * 0.4;
  let pointerY = innerHeight * 0.2;
  let targetX = pointerX;
  let targetY = pointerY;

  const upload = (image: HTMLImageElement, unit: number) => {
    const texture = gl.createTexture();
    if (!texture) throw new Error("Unable to allocate texture");
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return texture;
  };

  function schedule(duration = 800) {
    activeUntil = performance.now() + duration;
    if (!disposed && !lost && !frame && !document.hidden)
      frame = requestAnimationFrame(draw);
  }

  function ensureAsset(asset: string) {
    if (loading.has(asset)) return;
    loading.add(asset);
    void Promise.all(
      ["", "-normal", "-height", "-roughness"].map((suffix) =>
        loadImage(`/warcraft/${asset}${suffix}.webp`),
      ),
    )
      .then((images) => {
        if (disposed || lost) return;
        textures.set(asset, images.map(upload));
        schedule();
      })
      .catch((error) => {
        canvas.dataset.lighting = "asset-error";
        console.warn("[warcraft] Lighting texture:", error);
      });
  }

  function quad(
    x: number,
    y: number,
    width: number,
    height: number,
    ux = 0,
    uy = 0,
    uw = 1,
    uh = 1,
  ) {
    if (width <= 0 || height <= 0) return;
    gl!.uniform4f(u.rect, x, y, width, height);
    gl!.uniform4f(u.uv, ux, uy, uw, uh);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
  }

  function draw(now: number) {
    frame = 0;
    if (disposed || lost || document.hidden) return;
    if (!media.matches && now - previous < 32) {
      frame = requestAnimationFrame(draw);
      return;
    }
    previous = now;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl!.viewport(0, 0, width, height);
    gl!.useProgram(program);
    gl!.bindVertexArray(vao);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    pointerX += (targetX - pointerX) * 0.16;
    pointerY += (targetY - pointerY) * 0.16;
    gl!.uniform2f(u.viewport, canvas.clientWidth, canvas.clientHeight);
    gl!.uniform2f(u.light, pointerX - rect.left, pointerY - rect.top);
    gl!.uniform1f(u.motion, media.matches ? 0 : 1);
    gl!.uniform1f(
      u.flicker,
      media.matches ? 1 : 1 + Math.sin(now * 0.0017) * 0.018,
    );
    const sprites = getSprites();
    let allReady = true;
    for (const sprite of sprites) {
      ensureAsset(sprite.asset);
      const set = textures.get(sprite.asset);
      if (!set) {
        allReady = false;
        continue;
      }
      set.forEach((texture, i) => {
        gl!.activeTexture(gl!.TEXTURE0 + i);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
      });
      gl!.uniform1f(u.relief, sprite.asset === "stone" ? 0.65 : 1.25);
      gl!.uniform1f(u.normalFlip, sprite.flip ? -1 : 1);
      gl!.uniform1f(u.opacity, sprite.opacity ?? 1);
      const { x, y, width: w, height: h } = sprite;
      if (sprite.slice && sprite.border) {
        const b = Math.min(sprite.border, w / 2, h / 2);
        const s = sprite.slice;
        const px = [x, x + b, x + w - b, x + w];
        const py = [y, y + b, y + h - b, y + h];
        const uv = [0, s, 1 - s, 1];
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++) {
            if (sprite.hollow && row === 1 && col === 1) continue;
            quad(
              px[col],
              py[row],
              px[col + 1] - px[col],
              py[row + 1] - py[row],
              uv[col],
              uv[row],
              uv[col + 1] - uv[col],
              uv[row + 1] - uv[row],
            );
          }
      } else quad(x, y, w, h, sprite.flip ? 1 : 0, 0, sprite.flip ? -1 : 1, 1);
    }
    if (allReady && !ready) {
      ready = true;
      canvas.dataset.lighting = "ready";
      onReady();
    }
    if (!media.matches && now < activeUntil)
      frame = requestAnimationFrame(draw);
  }

  const pointer = (event: PointerEvent) => {
    if (media.matches) return;
    targetX = event.clientX;
    targetY = event.clientY;
    schedule();
  };
  const resize = new ResizeObserver(() => schedule(1500));
  resize.observe(canvas);
  const visibility = () => {
    if (!document.hidden) schedule();
  };
  const preference = () => schedule(1);
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onFallback();
  };
  window.addEventListener("pointermove", pointer, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", preference);
  canvas.addEventListener("webglcontextlost", contextLost);
  schedule(2500);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener("pointermove", pointer);
    document.removeEventListener("visibilitychange", visibility);
    media.removeEventListener("change", preference);
    canvas.removeEventListener("webglcontextlost", contextLost);
    textures.forEach((set) =>
      set.forEach((texture) => gl.deleteTexture(texture)),
    );
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}
