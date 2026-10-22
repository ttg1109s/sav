/**
 * core/webgl/three-vortex.js — Vortex (Three.js): hằng số đường ống, toán "uốn ống theo hướng rẽ", dựng scene 3 style
 * (rings / bars / wave). Điều phối mỗi frame: event/workflow/visualizer/vortex.js.
 *
 * Mô hình uốn (22/10/2026): độ uốn `bend` {x, y} (vector 8 hướng, y > 0 = lên) GIỮ NGUYÊN giữa 2 lượt rẽ, nội suy êm
 * sang hướng mới. Tâm ống tại khoảng cách d phía trước camera = `path` · g(d/L) với g(u) = u² (u ≤ 1), 2u − 1 (u > 1):
 * tại camera lệch 0 (camera luôn ở tâm, không cần kẹp), xa dần thì cong hẳn về hướng rẽ. `path` = độ lệch tại
 * L = VORTEX_LOOK_AHEAD, quy theo CẠNH NGẮN màn hình -> trên màn dọc lên/xuống/chéo nhìn rõ như trái/phải.
 * (Mô hình sin cũ: lượt rẽ chỉ dời pha, bay nửa chu kỳ là ống cong ngược lại -> trông như lắc trái-phải.)
 */
let tWarpSpeed = 0; // tốc độ bay mượt — biến module (không thuộc STATE), chỉ computeVortexWarpSpeed() ghi
const TUNNEL_DEPTH = 3000;

/** Khoảng nhìn trước của camera — mốc quy chuẩn độ uốn. */
const VORTEX_LOOK_AHEAD = 800;
/** Camera bay quá mốc này (theo -z) thì dời gốc toàn bộ scene về 0 — chặn z tịnh tiến vô hạn. */
const VORTEX_REBASE_Z = 30000;
/** Nội suy độ uốn về đích mỗi frame (~1.5 s đổi hướng xong phần lớn). */
const VORTEX_BEND_LERP = 0.025;
/** Lượt rẽ trước phải gần xong (|đích − hiện tại| < ngưỡng) mới nhận lượt mới. */
const VORTEX_BEND_SETTLE = 0.15;
/** Tâm ống tại L lệch bao nhiêu phần nửa cạnh ngắn khung hình (bend = 1, năng lượng trung bình). */
const VORTEX_BEND_SCREEN = 0.4;
/** Camera nhìn theo bao nhiêu phần độ lệch tại L (0 = nhìn thẳng, 1 = nhìn đúng tâm ống). */
const VORTEX_LOOK_FOLLOW = 0.35;

/** 8 hướng theo vòng compass (ngược chiều kim đồng hồ) — index dùng cho lượt rẽ. */
const VORTEX_DIRECTIONS = [
    { key: 'right', x: 1, y: 0 },
    { key: 'upRight', x: 0.7071, y: 0.7071 },
    { key: 'up', x: 0, y: 1 },
    { key: 'upLeft', x: -0.7071, y: 0.7071 },
    { key: 'left', x: -1, y: 0 },
    { key: 'downLeft', x: -0.7071, y: -0.7071 },
    { key: 'down', x: 0, y: -1 },
    { key: 'downRight', x: 0.7071, y: -0.7071 },
];
/** Nốt (MIDI % 12, C..B) -> index hướng: mỗi nửa cung lệch 3 nấc (135°) — nốt liền kề không bao giờ cùng/ngược hướng. */
const VORTEX_NOTE_TO_DIRECTION_INDEX = [0, 3, 6, 1, 4, 7, 2, 5, 0, 3, 6, 1];
/** Độ lệch nấc (hướng mới − hướng hiện tại, 0..7) -> nấc thực rẽ: trùng hướng -> 135°, ngược hẳn -> 90° (không lật). */
const VORTEX_TURN_STEP_BY_DELTA = [3, 1, 2, 3, 6, 5, 6, 7];

/** z camera sau 1 frame bay (camera tiến theo -z). */
function computeVortexNextWarpZ(camZ, warpSpeed) {
    return camZ - warpSpeed;
}

/** Tâm ống tại z. @param {{x:number, y:number}} path - độ lệch tại L (computeVortexPathOffset()) @param {number} camZ */
function getVortexCenterAt(z, path, camZ) {
    const u = Math.max(0, camZ - z) / VORTEX_LOOK_AHEAD;
    const g = u <= 1 ? u * u : 2 * u - 1;
    return { x: path.x * g, y: path.y * g };
}

/** Index hướng rẽ kế: theo nốt MIDI tức thời (null -> ngẫu nhiên), tránh trùng/ngược hướng đang giữ (`currentIndex`,
 * -1 = đang thẳng). */
function pickVortexDirectionIndex(midiNote, currentIndex) {
    const picked = midiNote == null
        ? Math.floor(Math.random() * VORTEX_DIRECTIONS.length)
        : VORTEX_NOTE_TO_DIRECTION_INDEX[((midiNote % 12) + 12) % 12];
    if (currentIndex < 0) return picked;
    return (currentIndex + VORTEX_TURN_STEP_BY_DELTA[(picked - currentIndex + 8) % 8]) % 8;
}

/** Đích độ uốn của 1 hướng (-1 = thẳng). */
function computeVortexBendTarget(directionIndex) {
    const dir = VORTEX_DIRECTIONS[directionIndex] || { x: 0, y: 0 };
    return { x: dir.x, y: dir.y };
}

/** 1 bước nội suy độ uốn về đích. */
function stepVortexBend(bend, target) {
    return { x: bend.x + (target.x - bend.x) * VORTEX_BEND_LERP, y: bend.y + (target.y - bend.y) * VORTEX_BEND_LERP };
}

/** Lượt rẽ hiện tại đã gần xong chưa. */
function isVortexBendSettled(bend, target) {
    return Math.hypot(target.x - bend.x, target.y - bend.y) < VORTEX_BEND_SETTLE;
}

/** Độ lệch tâm ống tại L (world units) theo khung camera hiện tại: quy theo nửa cạnh ngắn (đẳng hướng trên màn hình),
 * thở nhẹ theo năng lượng nhạc. */
function computeVortexPathOffset(bend, camera, smoothedEnergy) {
    const halfShort = VORTEX_LOOK_AHEAD * Math.tan((camera.fov * Math.PI) / 360) * Math.min(camera.aspect, 1);
    const s = halfShort * VORTEX_BEND_SCREEN * (0.85 + 0.3 * smoothedEnergy);
    return { x: bend.x * s, y: bend.y * s };
}

/** Điểm camera nhìn tới (theo một phần độ lệch tại L). */
function computeVortexLookTarget(path, camZ) {
    return { x: path.x * VORTEX_LOOK_FOLLOW, y: path.y * VORTEX_LOOK_FOLLOW, z: camZ - VORTEX_LOOK_AHEAD };
}

        /** Dựng toàn bộ scene Vortex (3 nhóm mesh rings/bars/wave + camera) — chỉ nhận số lượng + tỉ lệ khung, trả object. */
        function buildVortexScene(tunnelRingCount, barsRingCount, barsPerRing, aspect) {
            const scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x000000, 0.0006); // Sương mù tạo chiều sâu fade
            const camera = new THREE.PerspectiveCamera(75, aspect, 1, TUNNEL_DEPTH);
            camera.position.set(0, 0, 0);

            const groupRings = new THREE.Group();
            const rings = [];
            const ringGeo = new THREE.TorusGeometry(350, 6, 8, 48);
            for (let i = 0; i < tunnelRingCount; i++) {
                const z = -(i / tunnelRingCount) * TUNNEL_DEPTH;
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(ringGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z };
                rings.push(mesh);
                groupRings.add(mesh);
            }
            scene.add(groupRings);

            const groupBars = new THREE.Group();
            const barGeo = new THREE.BoxGeometry(15, 15, 60);
            barGeo.translate(0, 7.5, 0);
            const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const barsMesh = new THREE.InstancedMesh(barGeo, barMat, barsRingCount * barsPerRing);
            const barRingZs = [];
            for (let r = 0; r < barsRingCount; r++) barRingZs.push(-(r / barsRingCount) * TUNNEL_DEPTH);
            const dummy = new THREE.Object3D();
            for (let r = 0; r < barsRingCount; r++) {
                const z = barRingZs[r];
                for (let b = 0; b < barsPerRing; b++) {
                    const ang = (b / barsPerRing) * Math.PI * 2;
                    dummy.position.set(Math.cos(ang) * 350, Math.sin(ang) * 350, z);
                    dummy.rotation.set(0, 0, ang - Math.PI / 2);
                    dummy.updateMatrix();
                    barsMesh.setMatrixAt(r * barsPerRing + b, dummy.matrix);
                }
            }
            groupBars.add(barsMesh);
            scene.add(groupBars);

            const groupWaves = new THREE.Group();
            const waveMeshes = [];
            const waveGeo = new THREE.TorusGeometry(300, 40, 12, 48);
            const waveCount = 20;
            for (let i = 0; i < waveCount; i++) {
                const z = -(i / waveCount) * TUNNEL_DEPTH;
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, wireframe: true, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(waveGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z, rotZOffset: Math.random() * Math.PI };
                waveMeshes.push(mesh);
                groupWaves.add(mesh);
            }
            scene.add(groupWaves);

            return { scene, camera, groupRings, rings, groupBars, barsMesh, barRingZs, groupWaves, waveMeshes };
        }

        /** Chỉ nhóm mesh của style đang chọn được hiện. */
        function applyVortexStyleVisibility(groupRings, groupBars, groupWaves, vortexStyle) {
            groupRings.visible = vortexStyle === 'rings';
            groupBars.visible = vortexStyle === 'bars';
            groupWaves.visible = vortexStyle === 'wave';
        }
