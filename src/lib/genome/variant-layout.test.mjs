import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
const { layoutVariants } = require("./variant-layout.ts");
const { toGlobalPosition } = require("./reference.ts");
const variant = (position, alt = "G") => ({ id: `rs${position}`, chromosome: "9", position, ref: "A", alt, coordinateId: `9-${position}-A-${alt}`, source: "dbSNP" });

test("dense variation retains every record at its exact coordinate on desktop and mobile", () => {
  const input = Array.from({ length: 1500 }, (_, index) => variant(94950000 + index));
  const view = { center: toGlobalPosition("9", 94950000) + 749.5, span: 1500 };
  for (const width of [390, 904, 1600]) {
    const { points, groups } = layoutVariants(input, view, width);
    assert.equal(points.length, input.length);
    assert.equal(groups.reduce((sum, group) => sum + group.points.length, 0), input.length);
    assert.equal(new Set(groups.flatMap(group => group.points.map(point => point.variant.coordinateId))).size, input.length);
    points.forEach((point, index) => assert.equal(point.fraction, (index + .5) / 1500));
  }
});

test("both edge bases survive, offscreen positions are excluded, and alternate alleles remain selectable", () => {
  const view = { center: toGlobalPosition("9", 100) + 19.5, span: 40 };
  const { points } = layoutVariants([variant(99), variant(100), variant(100), variant(100, "T"), variant(139), variant(140)], view, 390);
  assert.equal(points.length, 3);
  assert.deepEqual(points.map(point => point.variant.coordinateId), ["9-100-A-G", "9-100-A-T", "9-139-A-G"]);
  assert.equal(points[0].fraction, .5 / 40);
  assert.equal(points[2].fraction, 39.5 / 40);
});

test("distinct source records at an identical allele remain inspectable", () => {
  const point = variant(100);
  const { points, groups } = layoutVariants([point, { ...point, id: "1001", clinvarId: "1001" }, { ...point, id: "1002", clinvarId: "1002" }], { center: toGlobalPosition("9", 100), span: 40 }, 390);
  assert.equal(points.length, 3);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].points.length, 3);
});
