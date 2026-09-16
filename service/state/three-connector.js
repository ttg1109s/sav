/**
 * service/state/three-connector.js — Package STATE "three-connector": THREE.js scene/camera +
 * object của group "connector" (style synapse/circuit). Renderer dùng CHUNG tRenderer (three-
 * vortex), không khai riêng ở đây. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('three-connector', {
            schema: {
                cnScene: 'any',
                cnCamera: 'any',
                cnInitialized: 'boolean',
                cnGroupSynapse: 'any',
                cnGroupCircuit: 'any',
                cnNeurons: 'array',
                cnSynapses: 'array',
                cnActiveSignalsSynapse: 'array',
                cnChips: 'array',
                cnEdgesCircuit: 'array',
                cnActiveSignalsCircuit: 'array',
                cnGlowTexture: 'any',
            },
            buildDefaults() {
                return {
                    cnScene: undefined,
                    cnCamera: undefined,
                    cnInitialized: false,
                    cnGroupSynapse: undefined,
                    cnGroupCircuit: undefined,
                    cnNeurons: [],
                    cnSynapses: [],
                    cnActiveSignalsSynapse: [],
                    cnChips: [],
                    cnEdgesCircuit: [],
                    cnActiveSignalsCircuit: [],
                    cnGlowTexture: undefined,
                };
            },
        });
