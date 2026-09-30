/**
 * service/state/subtitle.js — Package STATE domain "subtitle" (phụ đề lúc phát trên Visualizer, index.html).
 * subtitle-editor.html không dùng package này. PHẢI nạp SAU service/state.js.
 * Runtime karaoke do event/workflow/subtitle-display.js quản lý.
 */
        AppState.definePackage('subtitle', {
            schema: {
                subtitles: 'array',
                isSubtitlesEnabled: 'boolean',
                activeSubIds: 'set',
                currentCalculatedBpm: 'string', // BPM do audio-analysis tính (để đây từ trước, nhiều domain đọc)
                karaokeRenderConfig: 'any',        // ảnh chụp cấu hình karaoke dùng trong vòng raf
                karaokeLines: 'map',               // id dòng -> {id, words: [{el, baseEl, fillEl, text, startSec, endSec, phase, fill, opacity, revealAt}]}
                karaokeParticles: 'array',         // hạt bụi/khói đang bay
                karaokeFxDirty: 'boolean',         // canvas hiệu ứng còn nội dung cần vẽ/xoá
                karaokeFx: 'any',                  // {ctx, scratch, dpr} | null
                karaokeSprites: 'map',             // khoá màu|độ mềm -> canvas sprite
                karaokeLastMediaTime: 'nullable-number', // currentTime khung trước (phát hiện seek/tua lùi)
                karaokePointerLineId: 'any', // id dòng đang giữ pointer | null
            },
            buildDefaults() {
                return {
                    subtitles: [],
                    isSubtitlesEnabled: true,
                    activeSubIds: new Set(),
                    currentCalculatedBpm: '---',
                    karaokeRenderConfig: null,
                    karaokeLines: new Map(),
                    karaokeParticles: [],
                    karaokeFxDirty: false,
                    karaokeFx: null,
                    karaokeSprites: new Map(),
                    karaokeLastMediaTime: null,
                    karaokePointerLineId: null,
                };
            },
        });
