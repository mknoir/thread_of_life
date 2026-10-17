// Run: node --test src/lib/genome/geometry.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as THREE from "three";

// Compile the production helper with the project's TypeScript compiler, using
// the same Three module as the test cameras and curves (no WebGL context needed).
const moduleRecord = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(new URL("../../components/genome/dna-geometry.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
vm.runInNewContext(compiled.outputText, {
  module: moduleRecord, exports: moduleRecord.exports,
  require: (id) => { assert.equal(id, "three"); return THREE; },
});
const { createGenomicStrandGeometry } = moduleRecord.exports;

class VariableStrandCurve extends THREE.Curve {
  constructor(worldWidth, offset) { super(); this.worldWidth = worldWidth; this.extent = worldWidth / 2 + 2; this.offset = offset; }
  getPoint(t, target = new THREE.Vector3()) {
    const x = (t * 2 - 1) * this.extent;
    const radius = 2 + .22 * Math.cos(x * .2);
    const pitch = Math.max(.35, Math.min(.65, Math.PI * 2 * 1.6 / this.worldWidth));
    return target.set(x, Math.sin(x * pitch + this.offset) * radius + .70 * Math.sin(x * .18) + .04 * x, Math.cos(x * pitch + this.offset) * radius + .55 * Math.sin(x * .16));
  }
}

const viewports = [[1200, 600], [390, 500]];
const phases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
function cameraFor(worldWidth) {
  const camera = new THREE.OrthographicCamera(-worldWidth / 2, worldWidth / 2, 5, -5, .1, 80);
  camera.position.z = 24;
  camera.updateMatrixWorld();
  return camera;
}
function screenFraction(point, camera) { return (point.clone().project(camera).x + 1) / 2; }

test("every sculpted ring retains its exact intrinsic genomic x and valid normals", () => {
  for (const [width, height] of viewports) for (const offset of [0, Math.PI]) {
    const worldWidth = width / height * 10;
    const curve = new VariableStrandCurve(worldWidth, offset);
    const segments = Math.ceil(curve.extent * 65);
    const geometry = createGenomicStrandGeometry(curve, segments);
    const { position, normal, genomicX } = geometry.attributes;
    assert.equal(position.count, (segments + 1) * 13);
    assert.equal(geometry.parameters.radius, .14);
    assert.equal(geometry.parameters.radialSegments, 12);
    for (let i = 0; i < position.count; i++) {
      const expectedX = Math.fround(curve.getPointAt(Math.floor(i / 13) / segments).x);
      assert.equal(genomicX.getX(i), expectedX);
      assert.equal(position.getX(i), genomicX.getX(i));
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert.ok(Number.isFinite(length) && Math.abs(length - 1) < 1e-5);
    }
    geometry.dispose();
  }
});

test("intrinsic loci follow actual arc-length centers instead of naive UV interpolation", () => {
  const curve = new VariableStrandCurve(20, 0);
  const geometry = createGenomicStrandGeometry(curve, 320);
  const { uv, genomicX } = geometry.attributes;
  let maximumNaiveError = 0;
  for (let ring = 0; ring <= 320; ring++) {
    const vertex = ring * 13;
    const naiveX = (uv.getX(vertex) * 2 - 1) * curve.extent;
    maximumNaiveError = Math.max(maximumNaiveError, Math.abs(naiveX - genomicX.getX(vertex)));
  }
  assert.ok(maximumNaiveError > .1, "Fixture must expose the UV-versus-genomic-coordinate discrepancy");
  geometry.dispose();
});

test("orthographic screen positions and selected genomic intervals remain fixed throughout idle rotation", () => {
  for (const [width, height] of viewports) for (const offset of [0, Math.PI]) {
    const worldWidth = width / height * 10;
    const curve = new VariableStrandCurve(worldWidth, offset);
    const geometry = createGenomicStrandGeometry(curve, 320);
    const camera = cameraFor(worldWidth);
    const { position, genomicX } = geometry.attributes;
    const interval = { start: .39, end: .44 };
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const locusFraction = genomicX.getX(i) / worldWidth + .5;
      const selected = locusFraction >= interval.start && locusFraction < interval.end;
      for (const phase of phases) {
        point.fromBufferAttribute(position, i).applyAxisAngle(new THREE.Vector3(1, 0, 0), -phase);
        const screenX = screenFraction(point, camera);
        assert.ok(Math.abs(screenX - locusFraction) < 1e-12);
        assert.equal(screenX >= interval.start && screenX < interval.end, selected);
      }
    }
    geometry.dispose();
  }
});

test("40- and 250-base center coordinates project into their own inclusive-base cells", () => {
  for (const [width, height] of viewports) for (const count of [40, 250]) {
    const worldWidth = width / height * 10;
    const camera = cameraFor(worldWidth);
    for (let i = 0; i < count; i++) for (const phase of phases) {
      const x = -worldWidth / 2 + (i + .5) / count * worldWidth;
      const projected = screenFraction(new THREE.Vector3(x, 2, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -phase), camera);
      assert.ok(Math.abs(projected - (i + .5) / count) < 1e-12);
      assert.equal(Math.floor(projected * count), i);
      assert.ok(projected >= i / count && projected < (i + 1) / count);
    }
  }
});
