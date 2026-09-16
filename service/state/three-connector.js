/**
 * service/state/three-connector.js — Package STATE "three-connector": THREE.js scene/camera/
 * controls/composer + object của group "connector" (style synapse/circuit). Renderer dùng CHUNG
 * tRenderer (three-vortex). PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('three-connector', {
            schema: {
                cnScene: 'any',
                cnCamera: 'any',
                cnControls: 'any',      // THREE.OrbitControls | undefined
                cnComposer: 'any',      // THREE.EffectComposer (bloom, style circuit) | undefined
                cnBloomPass: 'any',     // THREE.UnrealBloomPass | undefined
                cnInitialized: 'boolean',
                cnGroupSynapse: 'any',
                cnGroupCircuit: 'any',
                cnNeurons: 'array',
                cnSynapses: 'array',
                cnActiveSignalsSynapse: 'array',
                cnChips: 'array',
                cnActiveSignalsCircuit: 'array',
                cnGlowTexture: 'any',
                cnSparkTexture: 'any',
                cnActiveCamMode: 'string', // circuit: 'ORBIT_SWEEP'|'TRACK_SIGNAL'|'CLOSE_NODE'
            },
            buildDefaults() {
                return {
                    cnScene: undefined,
                    cnCamera: undefined,
                    cnControls: undefined,
                    cnComposer: undefined,
                    cnBloomPass: undefined,
                    cnInitialized: false,
                    cnGroupSynapse: undefined,
                    cnGroupCircuit: undefined,
                    cnNeurons: [],
                    cnSynapses: [],
                    cnActiveSignalsSynapse: [],
                    cnChips: [],
                    cnActiveSignalsCircuit: [],
                    cnGlowTexture: undefined,
                    cnSparkTexture: undefined,
                    cnActiveCamMode: 'ORBIT_SWEEP',
                };
            },
        });
