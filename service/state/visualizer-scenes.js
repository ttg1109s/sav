/**
 * service/state/visualizer-scenes.js — Package STATE domain "visualizer-scenes": particle/scene
 * state của các kiểu 2D (rain/lightning/rubik/street...). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 *
 * "Nhà chính" của PERFORMANCE_PROFILES (đối chiếu 25/07/2026 — bản này lấy làm chuẩn, có thêm 6
 * field galaxy* mà bản cũ trong service/state.js không có, xem readme/changelog liên quan) — dùng
 * chéo bởi three-vortex.js/three-space.js (đọc thẳng biến global, không import vì project không
 * dùng ES module).
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
                };
            },
        });

        // MỚI (20/07/2026, plan-space-galaxy.md Phần B, mục B6) — 3 field galaxy* cho visual Space
        // (kiểu con 'galaxy'). MỚI (21/07/2026, lượt 9) — galaxyMapNodes/galaxyMapRadius: kích
        // thước bản đồ thiên hà TĨNH (dựng 1 lần, xem generateGalaxyMapNodePositions(),
        // core/webgl/three-space.js) — co giãn theo quality để máy yếu không render quá nhiều
        // thiên hà đồng thời.
        const PERFORMANCE_PROFILES = Object.freeze({
            high:   Object.freeze({ stars: 200, tunnelRings: 60, glassDrops: 250, bldMult: 1.0, streakProb: 0.8,  blurMult: 1.0, streetRain: 220, galaxyStarsMin: 3800, galaxyStarsMax: 6000, galaxyNebulaCount: 35, galaxyDustCount: 1500, galaxyMapNodes: 70, galaxyMapRadius: 950 }),
            medium: Object.freeze({ stars: 100, tunnelRings: 35, glassDrops: 100, bldMult: 1.5, streakProb: 0.9,  blurMult: 0.5, streetRain: 130, galaxyStarsMin: 2000, galaxyStarsMax: 3000, galaxyNebulaCount: 18, galaxyDustCount: 700,  galaxyMapNodes: 42, galaxyMapRadius: 800 }),
            low:    Object.freeze({ stars: 40,  tunnelRings: 15, glassDrops: 40,  bldMult: 2.5, streakProb: 0.95, blurMult: 0,   streetRain: 70,  galaxyStarsMin: 800,  galaxyStarsMax: 1200, galaxyNebulaCount: 0,  galaxyDustCount: 300,  galaxyMapNodes: 22, galaxyMapRadius: 600 }),
        });
