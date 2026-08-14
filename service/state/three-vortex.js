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
                tPathParams: 'object',
                tPathTarget: 'object',
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
                    tPathParams: { freqX: 0.0012, freqY: 0.0009, ampX: 450, ampY: 300, phaseX: 0, phaseY: 0 },
                    tPathTarget: { freqX: 0.0012, freqY: 0.0009, ampX: 450, ampY: 300, phaseX: 0, phaseY: 0 },
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

        // TUNNEL_DEPTH — KHÔNG khai lại ở đây, bản THẬT ở core/webgl/three-vortex.js (giá trị cố
        // định, không đổi theo config). barsRingCount/barsPerRing/tunnelRingCount giờ đọc thẳng từ
        // customEffect.vortex (core/custom-effect.js::getEffectConfig()), không còn hằng số module.
