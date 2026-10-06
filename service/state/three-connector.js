/**
 * service/state/three-connector.js — Package STATE "three-connector": THREE.js scene/camera/
 * controls/composer + object của group "connector" (style DUY NHẤT: circuit — synapse ĐÃ XOÁ 06/10/2026).
 * Renderer dùng CHUNG tRenderer (three-vortex). PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('three-connector', {
            schema: {
                cnScene: 'any',
                cnCamera: 'any',
                cnControls: 'any',      // THREE.OrbitControls | undefined
                cnComposer: 'any',      // THREE.EffectComposer (bloom) | undefined
                cnBloomPass: 'any',     // THREE.UnrealBloomPass | undefined
                cnInitialized: 'boolean',
                cnGroupCircuit: 'any',
                cnChips: 'array',
                cnWires: 'array',       // MỚI 06/10/2026 — dây nối chân<->chân {a, b, points, cum, total}
                cnTrace: 'any',         // MỚI 06/10/2026 — { mesh (LineSegments mọi dây), vertexChip, lastHex }
                cnJunction: 'any',      // MỚI 06/10/2026 — { mesh (InstancedMesh nút chạm), junctionChip }
                cnSignalAssets: 'any',  // MỚI 06/10/2026 — geometry bit/đầu xung dùng chung + bitGap + thông số camera bám bit
                cnActiveSignalsCircuit: 'array',
                cnActiveCamMode: 'string', // cinematic (camera orbit): 'ORBIT_SWEEP'|'TRACK_SIGNAL'|'CLOSE_NODE'
            },
            buildDefaults() {
                return {
                    cnScene: undefined,
                    cnCamera: undefined,
                    cnControls: undefined,
                    cnComposer: undefined,
                    cnBloomPass: undefined,
                    cnInitialized: false,
                    cnGroupCircuit: undefined,
                    cnChips: [],
                    cnWires: [],
                    cnTrace: undefined,
                    cnJunction: undefined,
                    cnSignalAssets: undefined,
                    cnActiveSignalsCircuit: [],
                    cnActiveCamMode: 'ORBIT_SWEEP',
                };
            },
        });
