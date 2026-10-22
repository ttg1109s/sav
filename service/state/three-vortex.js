/**
 * service/state/three-vortex.js — Package STATE domain "three-vortex": THREE.js scene/camera/
 * renderer + object của kiểu "vortex". Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('three-vortex', {
            schema: {
                tScene: 'any',         // THREE.Scene | undefined trước initThreeJS()
                tCamera: 'any',        // THREE.Camera | undefined
                tRenderer: 'any',      // THREE.Renderer | undefined
                tInitialized: 'boolean',
                tCurrentWarpZ: 'number',
                tBend: 'object',       // {x, y} độ uốn ống hiện tại (core/webgl/three-vortex.js)
                tBendTarget: 'object', // {x, y} đích độ uốn của lượt rẽ
                tBendDir: 'number',    // index hướng đang giữ (VORTEX_DIRECTIONS), -1 = thẳng
                tGroupRings: 'any',    // THREE.Group | undefined
                tGroupBars: 'any',     // THREE.Group | undefined
                tGroupWaves: 'any',    // THREE.Group | undefined
                tRings: 'array',
                tBarsMesh: 'any',      // THREE.InstancedMesh | undefined
                tBarRingZs: 'array',
                tWaveMeshes: 'array',
            },
            buildDefaults() {
                return {
                    tScene: undefined,
                    tCamera: undefined,
                    tRenderer: undefined,
                    tInitialized: false,
                    tCurrentWarpZ: 0,
                    tBend: { x: 0, y: 0 },
                    tBendTarget: { x: 0, y: 0 },
                    tBendDir: -1,
                    tGroupRings: undefined,
                    tGroupBars: undefined,
                    tGroupWaves: undefined,
                    tRings: [],
                    tBarsMesh: undefined,
                    tBarRingZs: [],
                    tWaveMeshes: [],
                };
            },
        });
