/**
 * service/state/subtitle.js — Package STATE domain "subtitle" (phụ đề trong màn Player chính —
 * KHÁC hẳn subtitle-editor.html, trang đó không dùng AppState, xem event/store.js). Xem cơ chế
 * package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('subtitle', {
            schema: {
                subtitles: 'array',
                isSubtitlesEnabled: 'boolean',
                activeSubIds: 'set',
                editingSubId: 'any',           // string | null
                currentCalculatedBpm: 'string',
                autoSubStartTime: 'nullable-number',
            },
            buildDefaults() {
                return {
                    subtitles: [],
                    isSubtitlesEnabled: true,
                    activeSubIds: new Set(),
                    editingSubId: null,
                    currentCalculatedBpm: '---',
                    autoSubStartTime: null,
                };
            },
        });
