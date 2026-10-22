/**
 * core/rubik-math.js — toán 3D của hiệu ứng Rubik's Cube: xoay, chiếu phối cảnh, hoán vị khối sau 1 lượt xoay.
 */
function rotate3D(point, rx, ry, rz) {
    const y1 = point.y * Math.cos(rx) - point.z * Math.sin(rx); const z1 = point.y * Math.sin(rx) + point.z * Math.cos(rx);
    const x2 = point.x * Math.cos(ry) + z1 * Math.sin(ry); const z2 = -point.x * Math.sin(ry) + z1 * Math.cos(ry);
    const x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz); const y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
    return { x: x3, y: y3, z: z2 };
}
function project3D(p, fov, viewDist, cx, cy) { const factor = fov / (viewDist + p.z); return { x: p.x * factor + cx, y: p.y * factor + cy, z: p.z }; }

/** Mặt phẳng xoay theo trục: 2 toạ độ (a, b) đổi chỗ + dấu khi dir > 0 (a' = sign·b, b' = −sign·a). */
const RUBIK_ROTATION_PLANE_BY_AXIS = {
    x: { a: 'cy', b: 'cz', sign: -1 },
    y: { a: 'cx', b: 'cz', sign: 1 },
    z: { a: 'cx', b: 'cy', sign: -1 },
};

/** Xoay 90° chỉ số các khối thuộc lớp `layer` của trục `axis` (`dir` > 0 / < 0 = 2 chiều). */
function rotateRubikIndices(axis, layer, dir) {
    const plane = RUBIK_ROTATION_PLANE_BY_AXIS[axis];
    const k = plane.sign * Math.sign(dir || -1);
    appState.mutate('rubikCubes', (arr) => arr.forEach((rc) => {
        if (rc['c' + axis] !== layer) return;
        const oldA = rc[plane.a];
        rc[plane.a] = k * rc[plane.b];
        rc[plane.b] = -k * oldA;
    }));
    console.log('writer: rotateRubikIndices -> rubikCubes');
}
