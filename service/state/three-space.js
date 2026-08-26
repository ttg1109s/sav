/**
 * service/state/three-space.js — Package STATE domain "three-space" ("Galaxy Journey"). DÙNG
 * CHUNG tRenderer/canvas với Vortex (three-vortex.js) — KHÔNG có tRenderer riêng. Xem cơ chế
 * package ở service/state.js. PHẢI nạp SAU service/state.js.
 *
 * VIẾT LẠI HOÀN TOÀN (26/08/2026, phản hồi Giang — mô hình cụm thiên hà, xem đầu
 * core/webgl/three-space.js) — BỎ HẲN field thuộc mô hình bản đồ TĨNH + travel/rotate 2 pha cũ
 * (spGalaxyClusters phẳng, spMapCenter, spMapLastRegenTime, các field spLeg.../spSpeedSample...,
 * spNoteSteerTable). THAY BẰNG field cho mô hình 2 lớp cụm/thiên hà + máy trạng thái 4 pha
 * (clusterRotate/clusterTravel/galaxyRotate/galaxyTravel) — xem
 * event/workflow/visualizer-render.js.
 *
 * SỬA (26/08/2026, lượt 2, phản hồi Giang — "chuyển pha là điều kiện move từ cụm này sang cụm
 * khác chứ không phải tái tạo các cụm... cụm thiên hà có thể tan đi hoặc thêm vào theo nhạc") —
 * BỎ `spVisitedGalaxyIds` (không còn "ghé đủ hết" làm điều kiện chuyển cụm). THÊM
 * `spClusterSwitchPending` (cờ báo "đã tới lúc chuyển cụm", set bởi phát hiện chuyển pha nhạc —
 * tham khảo `gameplayRefreshPending`, event/workflow/gameplay.js). Mỗi phần tử `spCurrentClusters`
 * giờ mang thêm `fadeState` ('in'|'stable'|'out') + `fadeProgress` (0..1) cho vòng đời tan/thêm
 * độc lập — KHÔNG cần field STATE riêng (nằm ngay trong object, xem
 * event/workflow/visualizer-render.js::_advanceClusterFades()).
 */
        AppState.definePackage('three-space', {
            schema: {
                spScene: 'any',            // THREE.Scene | undefined trước lần đầu vào 'space'
                spCamera: 'any',           // THREE.PerspectiveCamera | undefined
                spInitialized: 'boolean',
                spGlowTexture: 'any',      // THREE.CanvasTexture (sao) | undefined
                spNebulaTexture: 'any',    // THREE.CanvasTexture (tinh vân) | undefined
                spDustMesh: 'any',         // THREE.Points (SpaceDust) | undefined
                // "Túi xáo trộn" hình thái thiên hà — đảm bảo mọi 10 hình thái xuất hiện đúng 1
                // lần/chu kỳ 10 lần spawn (KHÔNG đổi từ mô hình cũ, vẫn cần dùng khi spawn thiên
                // hà thành viên của 1 cụm).
                spGalaxyTypeBag: 'array',
                spTotalGalaxiesSpawned: 'number', // bộ đếm ID toàn cục cho MỌI thiên hà từng spawn
                // Mảng cụm ĐANG tồn tại (số lượng DAO ĐỘNG quanh SPACE_CLUSTER_INITIAL_COUNT — có
                // thể tan đi/thêm vào theo nhạc, xem event/workflow/visualizer-render.js), mỗi
                // phần tử dạng { id, position: THREE.Vector3, rotationDir: 1|-1, galaxies:
                // SpaceGalaxy[], fadeState: 'in'|'stable'|'out', fadeProgress: 0..1 }.
                spCurrentClusters: 'array',
                // Cụm ĐANG là đích travel HOẶC đang "mắc kẹt" bên trong (1 trong các phần tử của
                // spCurrentClusters) — tham chiếu TRỰC TIẾP, không phải index.
                spTargetCluster: 'any',
                // Cờ "đã tới lúc chuyển sang cụm KHÁC" — set khi phát hiện chuyển pha nhạc mạnh
                // (energy/section transition hoặc phrase boundary, tái dùng
                // detectFluxTransition()/isPhraseBoundary() của game mode Circle), XÉT MỖI BEAT,
                // nhưng chỉ THỰC SỰ chuyển cụm tại điểm dừng tự nhiên (vừa ghé xong 1 thiên hà) —
                // xem _updateClusterSwitchTrigger()/_completeGalaxyVisit(). KHÔNG liên quan gì tới
                // việc cụm tan/thêm (2 cơ chế độc lập).
                spClusterSwitchPending: 'boolean',
                // Thiên hà ĐANG là đích galaxyRotate/galaxyTravel (1 trong spTargetCluster.galaxies).
                spTargetGalaxy: 'any',
                // Máy trạng thái 4 pha — chỉ ĐÚNG 1 pha tại 1 thời điểm:
                //   'clusterRotate' — vị trí camera KHOÁ, xoay hướng nhìn về TÂM cụm đích.
                //   'clusterTravel' — bay thẳng A->tâm cụm, hướng nhìn KHOÁ (đã xoay xong).
                //   'galaxyRotate'  — vị trí camera KHOÁ, xoay hướng nhìn về điểm B (gần tâm 1
                //                     thiên hà thành viên, cho phép lệch nhẹ).
                //   'galaxyTravel'  — bay A->B->C, hướng nhìn nội suy SONG SONG (độc lập vị trí)
                //                     từ hướng vừa bay sang NGƯỢC LẠI (quay lưng).
                spPhase: 'string',
                spForward: 'any',          // THREE.Vector3 — hướng nhìn/bay HIỆN TẠI
                // Trạng thái pha ROTATE — dùng CHUNG clusterRotate/galaxyRotate (chỉ có ý nghĩa
                // khi spPhase là 1 trong 2 giá trị đó).
                spRotateFromForward: 'any',
                spRotateToForward: 'any',
                spRotateElapsed: 'number',
                spRotateDuration: 'number',
                // Trạng thái pha TRAVEL — dùng CHUNG clusterTravel (1 đoạn A->tâm cụm) VÀ
                // galaxyTravel (spTravelNextPos = điểm C, đoạn A->B->C — xem spGalaxyTravelMidPos
                // ngay dưới cho điểm B).
                spTravelStartPos: 'any',
                spTravelNextPos: 'any',
                spTravelDistanceCovered: 'number',
                spTravelTotalDistance: 'number',
                spTravelSpeedRandomFactor: 'number', // +-30%, chốt 1 lần lúc BẮT ĐẦU travel
                // Riêng galaxyTravel — điểm B (tâm thiên hà + lệch nhẹ) VÀ hướng nhìn nội suy
                // SONG SONG (từ hướng vừa bay tới B, sang chính hướng NGƯỢC LẠI) — TÁCH khỏi
                // spRotateFrom/ToForward (2 field đó thuộc pha ROTATE riêng, không dùng lúc này).
                spGalaxyTravelMidPos: 'any',
                spGalaxyTravelFromForward: 'any',
                spGalaxyTravelToForward: 'any',
            },
            buildDefaults() {
                return {
                    spScene: undefined,
                    spCamera: undefined,
                    spInitialized: false,
                    spGlowTexture: undefined,
                    spNebulaTexture: undefined,
                    spDustMesh: undefined,
                    spGalaxyTypeBag: [],
                    spTotalGalaxiesSpawned: 0,
                    spCurrentClusters: [],
                    spTargetCluster: undefined,
                    spClusterSwitchPending: false,
                    spTargetGalaxy: undefined,
                    spPhase: 'clusterRotate',
                    spForward: undefined,
                    spRotateFromForward: undefined,
                    spRotateToForward: undefined,
                    spRotateElapsed: 0,
                    spRotateDuration: 0,
                    spTravelStartPos: undefined,
                    spTravelNextPos: undefined,
                    spTravelDistanceCovered: 0,
                    spTravelTotalDistance: 0,
                    spTravelSpeedRandomFactor: 1,
                    spGalaxyTravelMidPos: undefined,
                    spGalaxyTravelFromForward: undefined,
                    spGalaxyTravelToForward: undefined,
                };
            },
        });
