/**
 * service/state/visualizer-scenes.js — Package STATE domain "visualizer-scenes": particle/scene
 * state của các kiểu 2D (rain/lightning/rubik/street...). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('visualizer-scenes', {
            schema: {
                stars: 'array',
                starFlashes: 'array',
                rubikCubes: 'array',
                rubikPitchHistory: 'array',
                rubikPitchAvg: 'number',
                raindrops: 'array',
                ripples: 'array',
                glassStaticDrops: 'array',
                glassStreaks: 'array',
                cityBuildings: 'array',
                activeLightnings: 'array',
                streetLamps: 'array',
                streetRain: 'array',
                streetGroundY: 'number',
                fwRockets: 'array',
                fwParticles: 'array',
            },
            buildDefaults() {
                return {
                    stars: [],
                    starFlashes: [],
                    rubikCubes: [],
                    rubikPitchHistory: [],
                    rubikPitchAvg: 0,
                    raindrops: [],
                    ripples: [],
                    glassStaticDrops: [],
                    glassStreaks: [],
                    cityBuildings: [],
                    activeLightnings: [],
                    streetLamps: [],
                    streetRain: [],
                    streetGroundY: 0,
                    fwRockets: [],
                    fwParticles: [],
                };
            },
        });
