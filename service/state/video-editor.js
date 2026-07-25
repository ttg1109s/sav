/**
 * service/state/video-editor.js — Package STATE domain "video-editor" (trang riêng, account
 * 'videoEditor'). CHỈ 2 field cross-cutting đọc bởi Block gate (event/block.js) — phần state nội
 * bộ khác của video-editor.html (clip/track/timeline...) sống trong EventStore riêng
 * ('videoEditor', xem event/store.js), KHÔNG qua AppState — xem service/state/record/video-editor.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('video-editor', {
            schema: {
                // event/workflow/video-editor.js tự ghi lại 2 field này MỖI LẦN _audioClips/
                // _textClips đổi — true khi track đó đã "phủ kín" tới hết _totalDuration(). Event/
                // block.js đọc 2 field này để CHẶN videoEdit.addMusic.open/videoEdit.addText.click.
                videoEditAudioTrackFull: 'boolean',
                videoEditTextTrackFull: 'boolean',
            },
            buildDefaults() {
                return {
                    videoEditAudioTrackFull: false,
                    videoEditTextTrackFull: false,
                };
            },
        });
