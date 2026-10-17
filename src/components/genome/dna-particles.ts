import * as THREE from "three";

export interface DnaParticles {
  object: THREE.Group;
  /** Elapsed seconds, orthographic horizontal span, helix phase and renderer pixel ratio. */
  update(time: number, worldWidth: number, scrollPhase: number, pixelRatio: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWorldWidth;
  uniform float uScrollPhase;
  uniform float uPixelRatio;
  uniform float uBokeh;
  attribute vec4 aSeed;
  varying float vOpacity;
  varying float vWarmth;
  varying float vBokeh;

  const float TAU = 6.28318530718;
  const float PI = 3.14159265359;

  void main() {
    float extent = uWorldWidth * 0.5 + 2.0;
    float life = mix(17.0, 36.0, aSeed.w);
    float age = fract(aSeed.z + uTime / life);
    float outward = age * age;
    float direction = aSeed.y < 0.5 ? -1.0 : 1.0;
    float baseX = mix(-extent, extent, aSeed.x);
    float driftX = direction * outward * mix(0.3, 1.35, aSeed.z);
    driftX += sin(uTime * 0.08 + aSeed.y * TAU) * age * 0.16;
    float x = mod(baseX + driftX + extent, extent * 2.0) - extent;
    // Match the helix: about 1.6 turns across the viewport, within natural pitch limits.
    float pitch = clamp(TAU * 1.6 / uWorldWidth, 0.35, 0.65);
    float theta = x * pitch + uScrollPhase + step(0.5, aSeed.y) * PI;
    // Each seeded lifetime begins at a strand, then slowly curls away from it.
    theta += direction * outward * 0.95 + sin(aSeed.x * 191.0) * 0.025;
    float radius = 2.0 + 0.22 * cos(x * 0.20) + outward * mix(0.65, 2.65, aSeed.w);
    float baseCenterY = 0.70 * sin(x * 0.18) + 0.04 * x;
    float baseCenterZ = 0.55 * sin(x * 0.16);
    // Match the static helix group's -phase rotation about its longitudinal axis.
    float centerY = baseCenterY * cos(uScrollPhase) + baseCenterZ * sin(uScrollPhase);
    float centerZ = -baseCenterY * sin(uScrollPhase) + baseCenterZ * cos(uScrollPhase);
    vec3 particle = vec3(x, centerY + sin(theta) * radius, centerZ + cos(theta) * radius);
    particle.y += outward * sin(uTime * 0.11 + aSeed.z * TAU) * 0.16;
    particle.z += outward * sin(aSeed.x * 63.0) * 0.35;

    float lifeFade = smoothstep(0.0, 0.10, age) * (1.0 - smoothstep(0.56, 1.0, age));
    float depthBlur = smoothstep(1.8, 5.0, abs(particle.z));
    float pointSize = mix(0.65, 2.20, pow(aSeed.w, 3.0)) + depthBlur * 0.65;
    float intensity = mix(0.13, 0.50, pow(aSeed.y, 2.0));
    // The same particle budget remains restrained on narrow phone viewports.
    float density = clamp(uWorldWidth / 24.0, 0.32, 1.0);
    vOpacity = lifeFade * intensity * density;

    if (uBokeh > 0.5) {
      // Sparse, deliberately defocused depth planes; no flickering or hard rings.
      float slowTime = uTime * mix(0.018, 0.043, aSeed.w);
      x = mod(baseX + sin(slowTime + aSeed.y * TAU) * 0.8 + extent, extent * 2.0) - extent;
      particle.x = x;
      particle.y = mix(-4.3, 4.3, aSeed.z) + sin(slowTime * 0.8 + aSeed.x * TAU) * 0.24;
      particle.z = aSeed.y < 0.5 ? mix(-9.0, -5.0, aSeed.w) : mix(5.5, 9.0, aSeed.w);
      float edgeFade = 1.0 - smoothstep(3.4, 4.8, abs(particle.y));
      float breath = 0.83 + 0.17 * sin(slowTime + aSeed.z * TAU);
      pointSize = mix(12.0, 42.0, pow(aSeed.w, 1.6));
      vOpacity = mix(0.022, 0.065, aSeed.y) * edgeFade * breath * density;
    }

    vWarmth = aSeed.z;
    vBokeh = uBokeh;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(particle, 1.0);
    gl_PointSize = clamp(pointSize * uPixelRatio, 0.75, 84.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vOpacity;
  varying float vWarmth;
  varying float vBokeh;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float radiusSquared = dot(uv, uv);
    if (radiusSquared > 1.0) discard;
    // A Gaussian core and a soft edge work at both subpixel dust and bokeh sizes.
    float falloff = exp(-radiusSquared * mix(3.8, 2.5, vBokeh));
    falloff *= 1.0 - smoothstep(0.50, 1.0, radiusSquared);
    float alpha = falloff * vOpacity;
    if (alpha < 0.001) discard;
    vec3 gold = vec3(1.0, 0.67, 0.28);
    vec3 ivory = vec3(1.0, 0.93, 0.74);
    vec3 color = mix(gold, ivory, smoothstep(0.08, 0.92, vWarmth));
    // Only the brightest fine motes reach the bloom threshold; bokeh stays gentle.
    color *= mix(1.75, 0.75, vBokeh);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** GPU-only atmospheric particles around the schematic DNA; no biological data is encoded. */
export function createDnaParticles(): DnaParticles {
  const object = new THREE.Group();
  object.name = "DNA atmosphere";
  let randomState = 0x4d4f5445;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const materials: THREE.ShaderMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const createLayer = (count: number, bokeh: boolean) => {
    const geometry = new THREE.BufferGeometry();
    // Positions are supplied by the shader; static zero vertices allocate the draw count.
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const seeds = new Float32Array(count * 4);
    for (let index = 0; index < count; index++) {
      // Stratified x positions prevent random empty bands along the long helix.
      seeds[index * 4] = (index + random()) / count;
      seeds[index * 4 + 1] = random();
      seeds[index * 4 + 2] = random();
      seeds[index * 4 + 3] = random();
    }
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWorldWidth: { value: 24 },
        uScrollPhase: { value: 0 },
        uPixelRatio: { value: 1 },
        uBokeh: { value: bokeh ? 1 : 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      // Fine sprites supply the depth-of-field pass; defocused bokeh stays transparent.
      depthWrite: !bokeh,
      depthTest: true,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.name = bokeh ? "Defocused gold bokeh" : "Helix gold dust";
    // CPU positions are placeholders; GPU displacement is outside their bounds.
    points.frustumCulled = false;
    object.add(points);
    geometries.push(geometry);
    materials.push(material);
  };
  createLayer(2500, false);
  createLayer(100, true);
  let disposed = false;

  return {
    object,
    update(time, worldWidth, scrollPhase, pixelRatio) {
      if (disposed) return;
      const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
      const safeWidth = Number.isFinite(worldWidth) ? Math.max(0.1, worldWidth) : 24;
      const safePhase = Number.isFinite(scrollPhase) ? scrollPhase % (Math.PI * 2) : 0;
      const safeRatio = Number.isFinite(pixelRatio) ? Math.min(3, Math.max(0.5, pixelRatio)) : 1;
      for (const material of materials) {
        material.uniforms.uTime.value = safeTime;
        material.uniforms.uWorldWidth.value = safeWidth;
        material.uniforms.uScrollPhase.value = safePhase;
        material.uniforms.uPixelRatio.value = safeRatio;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      object.clear();
      object.removeFromParent();
    },
  };
}
