import * as THREE from "three";

/** Sculpt a strand without moving its cross-sections off their genomic x planes. */
export function createGenomicStrandGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
): THREE.TubeGeometry {
  const geometry = new THREE.TubeGeometry(curve, segments, .14, 12, false);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const loci = new Float32Array(positions.count);
  // TubeGeometry uses arc-length sampling. Its UV/ring fraction is not x.
  const ringCenters = Array.from({ length: segments + 1 }, (_, ring) => curve.getPointAt(ring / segments).x);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const roughness = .018 * Math.sin(x * 28 + Math.sin(y * 14)) + .012 * Math.sin(z * 33 + y * 19 + x * 7);
    const locusX = ringCenters[Math.floor(i / 13)];
    loci[i] = locusX;
    // Organic detail changes y/depth only. Rotation about x therefore cannot
    // change the genomic position represented by any vertex in this ring.
    positions.setXYZ(i, locusX, y + normals.getY(i) * roughness, z + normals.getZ(i) * roughness);
  }
  geometry.setAttribute("genomicX", new THREE.BufferAttribute(loci, 1));
  geometry.computeVertexNormals();
  return geometry;
}
