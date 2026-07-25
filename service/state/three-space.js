/**
 * service/state/three-space.js — Package STATE domain "three-space" ("Galaxy Journey", MỚI
 * 20/07/2026, plan-space-galaxy.md Phần B). DÙNG CHUNG tRenderer/canvas với Vortex
 * (three-vortex.js) — KHÔNG có tRenderer riêng. Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('three-space', {
            schema: {
                spScene: 'any',            // THREE.Scene | undefined trước lần đầu vào 'space'
                spCamera: 'any',           // THREE.PerspectiveCamera | undefined
                spInitialized: 'boolean',
                spGlowTexture: 'any',      // THREE.CanvasTexture (sao) | undefined
                spNebulaTexture: 'any',    // THREE.CanvasTexture (tinh vân) | undefined
                spDustMesh: 'any',         // THREE.Points (SpaceDust) | undefined
                spGalaxyClusters: 'array', // mảng instance GalaxyCluster
                // MỚI (21/07/2026, "hình thái thiên hà phân bổ không đều") — "túi xáo trộn":
                // đảm bảo mọi 10 hình thái xuất hiện đúng 1 lần/chu kỳ 10 lần spawn.
                spGalaxyTypeBag: 'array',
                spTotalGalaxiesSpawned: 'number', // bộ đếm ID toàn cục — KHÔNG dùng spGalaxyClusters.length
                // Máy trạng thái spPhase: 'travel' (camera di chuyển A->B, hướng nhìn spForward CỐ
                // ĐỊNH) | 'rotating' (vị trí camera KHOÁ NGUYÊN tại B, chỉ hướng nhìn nội suy dần).
                spPhase: 'string',         // 'travel' | 'rotating'
                spForward: 'any',          // THREE.Vector3 — hướng nhìn/bay HIỆN TẠI
                spLegStartPos: 'any',      // THREE.Vector3 — vị trí camera lúc BẮT ĐẦU leg travel
                spNextPos: 'any',          // THREE.Vector3 — điểm đến (waypoint B)
                spLegControlPoint: 'any',  // THREE.Vector3 — điểm điều khiển Quadratic Bezier
                spLegDistanceCovered: 'number',
                spLegTotalDistance: 'number',
                spLegSpeedRandomFactor: 'number',
                // MỚI (21/07/2026, "tính X lần trong phạm vi di chuyển") — X mốc % quãng đường
                // sinh ngẫu nhiên lúc bắt đầu leg; mỗi lần vượt mốc, khoá lại BPM/energy làm tốc độ mới.
                spSpeedSamplePoints: 'array',
                spSpeedSampleIdx: 'number',
                spCurrentLegSpeed: 'number',
                // Bảng 12 phần tử {yaw, pitch} (radian) — SINH NGẪU NHIÊN 1 LẦN lúc Space init.
                spNoteSteerTable: 'any',
                // Bản đồ TĨNH: N cụm thiên hà (N/bán kính co giãn theo PERFORMANCE_PROFILES) phân
                // bố ĐỀU NGẪU NHIÊN quanh spMapCenter — dựng 1 LẦN, chỉ tái tạo khi năng lượng đủ
                // cao VÀ camera đứng yên (xem _ensureGalaxyMap(), event/workflow/visualizer-render.js).
                spMapCenter: 'any',
                spMapLastRegenTime: 'number',
                // Trạng thái pha ROTATE (chỉ có ý nghĩa khi spPhase === 'rotating').
                spRotateFromForward: 'any',
                spRotateToForward: 'any',
                spRotateElapsed: 'number',
                spRotateDuration: 'number',
            },
            buildDefaults() {
                return {
                    spScene: undefined,
                    spCamera: undefined,
                    spInitialized: false,
                    spGlowTexture: undefined,
                    spNebulaTexture: undefined,
                    spDustMesh: undefined,
                    spGalaxyClusters: [],
                    spGalaxyTypeBag: [],
                    spTotalGalaxiesSpawned: 0,
                    spPhase: 'travel',
                    spForward: undefined,
                    spLegStartPos: undefined,
                    spNextPos: undefined,
                    spLegControlPoint: undefined,
                    spLegDistanceCovered: 0,
                    spLegTotalDistance: 0,
                    spLegSpeedRandomFactor: 1,
                    spSpeedSamplePoints: [],
                    spSpeedSampleIdx: 0,
                    spCurrentLegSpeed: 0,
                    spNoteSteerTable: undefined,
                    spMapCenter: undefined,
                    spMapLastRegenTime: 0,
                    spRotateFromForward: undefined,
                    spRotateToForward: undefined,
                    spRotateElapsed: 0,
                    spRotateDuration: 0,
                };
            },
        });
