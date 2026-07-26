/**
 * service/state/video-editor.js — Package STATE domain "video-editor" (trang riêng, account
 * 'videoEditor'). MỞ RỘNG 25/07/2026 (đợt tái cấu trúc state, lượt 2) — lượt 1 chỉ có 2 key
 * cross-cutting ở đây (videoEditAudioTrackFull/videoEditTextTrackFull) rồi nhét 32 field state
 * THẬT của trang vào EventStore — SAI ranh giới EventStore (chỉ dành cho "state context" nhỏ
 * giữa 2 message, không phải state nghiệp vụ toàn trang, xem docstring event/store.js). SỬA LẠI:
 * toàn bộ 32 field state của `event/workflow/video-editor.js` (clip video/nhạc/chữ, crop, zoom,
 * drag/pinch, waveform "dịch chuyển đoạn", gain boost...) vào ĐÚNG đây, cùng schema/registry() như
 * mọi domain khác của app. (2 key `dbReadyPromise`/`isGenericDrawerOpen` mà trang này cũng cần
 * thuộc 2 package KHÁC — 'app-misc'/'generic-drawer' — xem service/state/record/video-editor.js.)
 *
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('video-editor', {
            schema: {
                // 2 key cross-cutting đọc bởi Block gate (event/block.js) — event/workflow/
                // video-editor.js tự ghi lại MỖI LẦN _audioClips/_textClips đổi.
                videoEditAudioTrackFull: 'boolean',
                videoEditTextTrackFull: 'boolean',

                _videoKey: 'nullable-string',
                _record: 'any',              // object đầy đủ từ getVideoRecord() | null trước init() xong
                _fullSourceDuration: 'number',
                _nativeW: 'number',
                _nativeH: 'number',
                _pixelsPerSecond: 'number',

                _videoClips: 'array',         // {sourceStart,sourceEnd,volume}[] — xem docstring đầu event/workflow/video-editor.js
                _audioClips: 'array',
                _textClips: 'array',
                _currentClipIndex: 'nullable-number',
                _idCounter: 'number',

                _rotateDeg: 'number',
                _cropFraction: 'any',         // {x,y,w,h} | null
                _cropper: 'any',              // Cropper.js instance | null

                _selected: 'any',             // {track:'video'|'audio'|'text', index} | null
                _isPlaying: 'boolean',
                _dragHandle: 'any',           // {track,index,handleType} | null
                _dragLastClientX: 'number',
                _pinchState: 'any',           // {startDist,startAngleDeg,baseSize,baseRotation} | null

                // waveform "Dịch chuyển đoạn" — sống trong lúc Generic Drawer nội dung đó đang mở.
                _shiftWavesurfer: 'any',
                _shiftRegionsPlugin: 'any',
                _shiftRegion: 'any',
                _shiftIsPlayingRegion: 'boolean',
                _shiftStopHandler: 'any',      // function | null

                _videoGainBoost: 'any',        // GainNode | null
                _songGainBoost: 'any',

                _songListCache: 'any',         // array | null
                _songSearchQuery: 'string',
                _masterFilmstripFrames: 'any', // array | null

                _hasUnsavedChanges: 'boolean',
                _activePreviewAudioClipId: 'nullable-string',
                _previewTextDragIndex: 'nullable-number',
            },
            buildDefaults() {
                return {
                    videoEditAudioTrackFull: false,
                    videoEditTextTrackFull: false,

                    _videoKey: null,
                    _record: null,
                    _fullSourceDuration: 0,
                    _nativeW: 0,
                    _nativeH: 0,
                    _pixelsPerSecond: 40,

                    _videoClips: [],
                    _audioClips: [],
                    _textClips: [],
                    _currentClipIndex: null,
                    _idCounter: 1,

                    _rotateDeg: 0,
                    _cropFraction: null,
                    _cropper: null,

                    _selected: null,
                    _isPlaying: false,
                    _dragHandle: null,
                    _dragLastClientX: 0,
                    _pinchState: null,

                    _shiftWavesurfer: null,
                    _shiftRegionsPlugin: null,
                    _shiftRegion: null,
                    _shiftIsPlayingRegion: false,
                    _shiftStopHandler: null,

                    _videoGainBoost: null,
                    _songGainBoost: null,

                    _songListCache: null,
                    _songSearchQuery: '',
                    _masterFilmstripFrames: null,

                    _hasUnsavedChanges: false,
                    _activePreviewAudioClipId: null,
                    _previewTextDragIndex: null,
                };
            },
        });
