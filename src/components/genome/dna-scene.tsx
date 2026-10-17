"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createDnaParticles } from "./dna-particles";
import { createGenomicStrandGeometry } from "./dna-geometry";

interface DnaSceneProps {
  center: number; span: number; paused: boolean; sequence?: string;
  highlightRef?: RefObject<{ start: number; end: number } | null>;
  chromosomeBreaks?: number[];
}
const VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const TAU = Math.PI * 2;
class StrandCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private extent: number, private offset: number, private strandPoint: (x: number, offset: number, target: THREE.Vector3) => THREE.Vector3) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) { return this.strandPoint((t * 2 - 1) * this.extent, this.offset, target); }
}

/** Horizontal position is genomic space. Surface detail, depth and particles are schematic. */
export default function DnaScene({ center, span, paused, sequence, highlightRef, chromosomeBreaks }: DnaSceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef({ center, span, paused, sequence, highlightRef, chromosomeBreaks });
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { current.current = { center, span, paused, sequence, highlightRef, chromosomeBreaks }; }, [center, span, paused, sequence, highlightRef, chromosomeBreaks]);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" }); }
    catch { queueMicrotask(() => setUnavailable(true)); return; }
    const pixelRatio = Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x09090b);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .94;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmrem.fromScene(environment, .07);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = .5;
    environment.dispose(); pmrem.dispose();
    const camera = new THREE.OrthographicCamera(-20, 20, 5, -5, .1, 80);
    camera.position.set(0, 0, 24);
    scene.add(new THREE.HemisphereLight(0xfff1da, 0x160f08, 1.1));
    const key = new THREE.DirectionalLight(0xffecc7, 2.4); key.position.set(-5, 8, 10);
    const rim = new THREE.DirectionalLight(0xffe2a5, 3.6); rim.position.set(4, 3, -7);
    const fill = new THREE.DirectionalLight(0xe5ecff, .7); fill.position.set(-8, -4, 8);
    scene.add(key, rim, fill);

    const hazeMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: `varying vec2 vUv;
        void main() {
          vec2 p = vUv - .5;
          float cloud = exp(-dot(p * vec2(2.3, 3.8), p * vec2(2.3, 3.8)) * 3.);
          float light = exp(-dot((p - vec2(.18,.08)) * vec2(3.,5.), (p - vec2(.18,.08)) * vec2(3.,5.)) * 2.);
          vec3 color = vec3(.00273,.00273,.00335) + vec3(.038,.025,.010) * cloud + vec3(.018,.013,.006) * light;
          gl_FragColor = vec4(color, 1.);
        }`, depthWrite: false,
    });
    const hazeGeometry = new THREE.PlaneGeometry(1, 1);
    const haze = new THREE.Mesh(hazeGeometry, hazeMaterial); haze.position.z = -16; scene.add(haze);

    // Continuous, lightly corrugated surfaces catch light like macro photography.
    const textureSize = 128, grain = new Uint8Array(textureSize * textureSize * 4);
    for (let y = 0; y < textureSize; y++) for (let x = 0; x < textureSize; x++) {
      const value = 128 + 40 * Math.sin(x * .71 + Math.sin(y * .27) * 2) + 26 * Math.sin(y * 1.73 + x * 1.91);
      const i = (y * textureSize + x) * 4; grain[i] = grain[i + 1] = grain[i + 2] = value; grain[i + 3] = 255;
    }
    const grainTexture = new THREE.DataTexture(grain, textureSize, textureSize);
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.magFilter = grainTexture.minFilter = THREE.LinearFilter;
    grainTexture.repeat.set(18, 2); grainTexture.needsUpdate = true;
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xbfa576, metalness: .68, roughness: .32, clearcoat: .35, clearcoatRoughness: .3, bumpMap: grainTexture, bumpScale: .045 });
    const paleGold = gold.clone(); paleGold.color.setHex(0xd5c19a); paleGold.roughness = .38;
    const rungMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb8a27a, metalness: .58, roughness: .38, clearcoat: .25 });
    const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xddc28c, metalness: .7, roughness: .3 });
    const hoverUniforms = {
      dnaHoverRange: { value: new THREE.Vector2(.5, .5) },
      dnaHoverStrength: { value: 0 },
      dnaWorldWidth: { value: 20 },
      dnaChromosomeBreaks: { value: new Float32Array(24).fill(-1) },
      dnaBreakWidth: { value: 0 },
    };
    // Intrinsic locus coordinates belong to the molecule, independent of its
    // lighting or rotation. No enlarged hit bands or outward highlight feather.
    for (const material of [gold, paleGold, rungMaterial, nodeMaterial]) {
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, hoverUniforms);
        shader.vertexShader = `attribute float genomicX; uniform float dnaWorldWidth; varying float vDnaLocus;\n${shader.vertexShader}`.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvDnaLocus = genomicX / dnaWorldWidth + .5;",
        );
        shader.fragmentShader = `uniform vec2 dnaHoverRange; uniform float dnaHoverStrength; uniform float dnaChromosomeBreaks[24]; uniform float dnaBreakWidth; varying float vDnaLocus;\n${shader.fragmentShader}`.replace(
          "#include <opaque_fragment>",
          `for (int i = 0; i < 24; i++) {
            if (dnaChromosomeBreaks[i] >= 0. && abs(vDnaLocus - dnaChromosomeBreaks[i]) < dnaBreakWidth) discard;
          }
          float dnaHighlight = step(dnaHoverRange.x, vDnaLocus)
            * (1. - step(dnaHoverRange.y, vDnaLocus)) * dnaHoverStrength;
          // A bounded amber tint does not emit bloom that could imply a wider gene.
          vec3 selectedColor = min(outgoingLight * .20 + vec3(.70, .28, .03), vec3(.95, .75, .28));
          outgoingLight = mix(outgoingLight, selectedColor, dnaHighlight);
          #include <opaque_fragment>`,
        );
      };
      material.customProgramCacheKey = () => "dna-exact-locus-v2";
    }
    const helix = new THREE.Group(); scene.add(helix);
    const backboneA = new THREE.Mesh(new THREE.BufferGeometry(), gold);
    const backboneB = new THREE.Mesh(new THREE.BufferGeometry(), paleGold); helix.add(backboneA, backboneB);
    const rungGeometry = new THREE.CylinderGeometry(.031, .045, 1, 7, 3);
    const nodeGeometry = new THREE.IcosahedronGeometry(.085, 1);
    const rungLoci = new THREE.InstancedBufferAttribute(new Float32Array(500), 1);
    const nodeLoci = new THREE.InstancedBufferAttribute(new Float32Array(500), 1);
    rungGeometry.setAttribute("genomicX", rungLoci); nodeGeometry.setAttribute("genomicX", nodeLoci);
    const rungs = new THREE.InstancedMesh(rungGeometry, rungMaterial, 500);
    const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, 500);
    rungs.frustumCulled = nodes.frustumCulled = false; helix.add(rungs, nodes);
    const particles = createDnaParticles(); scene.add(particles.object);

    // One scene depth texture and a short blur kernel: no second geometry render.
    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    sceneTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    const focusPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { sceneColor: { value: sceneTarget.texture }, sceneDepth: { value: sceneTarget.depthTexture }, resolution: { value: new THREE.Vector2(1, 1) }, dnaHoverRange: hoverUniforms.dnaHoverRange, dnaHoverStrength: hoverUniforms.dnaHoverStrength },
      vertexShader: VERTEX,
      fragmentShader: `uniform sampler2D sceneColor; uniform sampler2D sceneDepth; uniform vec2 resolution; uniform vec2 dnaHoverRange; uniform float dnaHoverStrength; varying vec2 vUv;
        float selected(float x) { return step(dnaHoverRange.x, x) * (1. - step(dnaHoverRange.y, x)); }
        void main() {
          float distance = .1 + texture2D(sceneDepth, vUv).r * 79.9;
          float blur = clamp(abs(distance - 22.2) * 1.20 - .8, 0., 5.);
          vec2 stepSize = vec2(blur) / resolution;
          vec3 color = texture2D(sceneColor, vUv).rgb * .20;
          float totalWeight = .20;
          for (int i = 0; i < 12; i++) {
            float angle = float(i) * 2.399963;
            float radius = sqrt((float(i) + .5) / 12.);
            vec2 sampleUv = vUv + vec2(cos(angle), sin(angle)) * radius * stepSize;
            // Depth blur must not carry the selection tint across genomic bounds.
            float weight = dnaHoverStrength > .001 && selected(sampleUv.x) != selected(vUv.x) ? 0. : .0666667;
            color += texture2D(sceneColor, sampleUv).rgb * weight;
            totalWeight += weight;
          }
          color /= totalWeight;
          float vignette = 1. - .34 * smoothstep(.2, .8, length((vUv - .5) * vec2(1.,1.3)));
          gl_FragColor = vec4(color * vignette, 1.);
        }`, depthWrite: false, depthTest: false,
    }));
    const composer = new EffectComposer(renderer);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .23, .55, 1.1);
    const output = new OutputPass(); composer.addPass(focusPass); composer.addPass(bloom); composer.addPass(output);

    let width = 0, height = 0, worldWidth = 20, geometryWidth = 0, lastSequence: string | undefined;
    const temp = new THREE.Object3D();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), middle = new THREE.Vector3(), direction = new THREE.Vector3();
    const axis = new THREE.Vector3(0, 1, 0);
    const baseColors: Record<string, THREE.Color> = { A: new THREE.Color(0xf0d7a2), T: new THREE.Color(0xbca06b), G: new THREE.Color(0xd6bb85), C: new THREE.Color(0xe8cf9b), N: new THREE.Color(0xc2b294) };
    const complement: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };
    const white = new THREE.Color(0xffffff);
    const point = (x: number, offset: number, target: THREE.Vector3) => {
      const radius = 2 + .22 * Math.cos(x * .2);
      const pitch = Math.max(.35, Math.min(.65, TAU * 1.6 / worldWidth));
      return target.set(x, Math.sin(x * pitch + offset) * radius + .70 * Math.sin(x * .18) + .04 * x, Math.cos(x * pitch + offset) * radius + .55 * Math.sin(x * .16));
    };
    const buildGeometry = (bases: string | undefined) => {
      const extent = worldWidth / 2 + 2;
      if (geometryWidth !== worldWidth) {
        [backboneA, backboneB].forEach((mesh, index) => {
          const curve = new StrandCurve(extent, index * Math.PI, point);
          const segments = Math.ceil(extent * 65);
          const geometry = createGenomicStrandGeometry(curve, segments);
          mesh.geometry.dispose(); mesh.geometry = geometry;
        }); geometryWidth = worldWidth;
      }
      const count = bases ? Math.min(bases.length, 250) : Math.min(150, Math.ceil(extent * 5.2));
      rungs.count = nodes.count = count * 2;
      for (let i = 0; i < count; i++) {
        const x = bases ? -worldWidth / 2 + (i + .5) / count * worldWidth : -extent + (i + .5) / count * extent * 2;
        rungLoci.setX(i * 2, x); rungLoci.setX(i * 2 + 1, x);
        nodeLoci.setX(i * 2, x); nodeLoci.setX(i * 2 + 1, x);
        point(x, 0, a); point(x, Math.PI, b); middle.copy(a).add(b).multiplyScalar(.5);
        direction.copy(b).sub(a).normalize(); temp.quaternion.setFromUnitVectors(axis, direction);
        const thickness = bases && count > 100 ? .65 : 1;
        const baseCell = worldWidth / count;
        temp.scale.set(bases ? Math.min(thickness, baseCell * .45 / .045) : thickness, a.distanceTo(b) / 2, thickness);
        temp.position.copy(a).add(middle).multiplyScalar(.5); temp.updateMatrix(); rungs.setMatrixAt(i * 2, temp.matrix);
        temp.position.copy(b).add(middle).multiplyScalar(.5); temp.updateMatrix(); rungs.setMatrixAt(i * 2 + 1, temp.matrix);
        rungs.setColorAt(i * 2, bases ? baseColors[bases[i]] ?? baseColors.N : white);
        rungs.setColorAt(i * 2 + 1, bases ? baseColors[complement[bases[i]]] ?? baseColors.N : white);
        temp.scale.set(bases ? Math.min(1, baseCell * .45 / .085) : 1, 1, 1); temp.quaternion.identity(); temp.position.copy(a); temp.updateMatrix(); nodes.setMatrixAt(i * 2, temp.matrix);
        temp.position.copy(b); temp.updateMatrix(); nodes.setMatrixAt(i * 2 + 1, temp.matrix);
      }
      rungs.instanceMatrix.needsUpdate = nodes.instanceMatrix.needsUpdate = true;
      rungLoci.needsUpdate = nodeLoci.needsUpdate = true;
      if (rungs.instanceColor) rungs.instanceColor.needsUpdate = true; lastSequence = bases;
    };
    const resize = () => {
      width = host.clientWidth; height = host.clientHeight; if (!width || !height) return;
      worldWidth = width / height * 10;
      renderer.setSize(width, height); composer.setSize(width, height);
      sceneTarget.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      focusPass.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);
      hoverUniforms.dnaWorldWidth.value = worldWidth;
      hoverUniforms.dnaBreakWidth.value = .75 / width;
      camera.left = -worldWidth / 2; camera.right = worldWidth / 2; camera.updateProjectionMatrix();
      haze.scale.set(worldWidth, 10, 1); buildGeometry(current.current.sequence);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let elapsed = 0, frame = 0, previousTime = 0, lastState = "", disposed = false;
    let scrollPhase = -(current.current.center / current.current.span) * 8 % TAU;
    const render = (time: number) => {
      if (disposed) return; frame = requestAnimationFrame(render);
      if (document.hidden || time - previousTime < 32 || !width || !height) return;
      const delta = Math.min((time - previousTime) / 1000, .05); previousTime = time;
      const props = current.current; if (!props.paused && !media.matches) elapsed += delta;
      const highlight = props.highlightRef?.current;
      hoverUniforms.dnaChromosomeBreaks.value.fill(-1);
      (props.chromosomeBreaks ?? []).slice(0, 24).forEach((boundary, index) => { hoverUniforms.dnaChromosomeBreaks.value[index] = boundary; });
      if (highlight) hoverUniforms.dnaHoverRange.value.set(highlight.start, highlight.end);
      const strength = hoverUniforms.dnaHoverStrength.value;
      const targetStrength = highlight ? 1 : 0;
      hoverUniforms.dnaHoverStrength.value = media.matches || Math.abs(targetStrength - strength) < .001
        ? targetStrength : strength + (targetStrength - strength) * (1 - Math.exp(-delta * 18));
      const targetPhase = -(props.center / props.span) * 8 % TAU;
      const difference = Math.atan2(Math.sin(targetPhase - scrollPhase), Math.cos(targetPhase - scrollPhase));
      scrollPhase = Math.abs(difference) < .0001 || media.matches ? targetPhase : scrollPhase + difference * .14;
      const state = `${scrollPhase}:${elapsed}:${width}:${height}:${props.sequence}:${hoverUniforms.dnaHoverRange.value.x}:${hoverUniforms.dnaHoverRange.value.y}:${hoverUniforms.dnaHoverStrength.value}:${props.chromosomeBreaks?.join(",")}`;
      if (state === lastState) return; lastState = state;
      if (props.sequence !== lastSequence) buildGeometry(props.sequence);
      const phase = scrollPhase + elapsed * .055; helix.rotation.x = -phase;
      particles.update(elapsed, worldWidth, phase, pixelRatio);
      renderer.setRenderTarget(sceneTarget); renderer.render(scene, camera);
      renderer.setRenderTarget(null); composer.render(delta);
    };
    frame = requestAnimationFrame(render);
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("webglcontextlost", lost);
      [backboneA.geometry, backboneB.geometry, rungGeometry, nodeGeometry, hazeGeometry].forEach(geometry => geometry.dispose());
      [gold, paleGold, rungMaterial, nodeMaterial, hazeMaterial].forEach(material => material.dispose());
      rungs.dispose(); nodes.dispose(); particles.dispose(); grainTexture.dispose();
      focusPass.dispose(); bloom.dispose(); output.dispose(); composer.dispose(); sceneTarget.dispose();
      environmentMap.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="genome-canvas" ref={container} aria-hidden={!unavailable}>
    {unavailable ? <p className="genome-canvas-error">3D isn’t available in this browser. You can still search and explore genes.</p> : null}
  </div>;
}
