/**
 * service/state/subtitle-editor.js — Package STATE domain "subtitle-editor" (MỚI, 25/07/2026, đợt
 * tái cấu trúc state, lượt 2 — trang `subtitle-editor.html` TRƯỚC ĐÂY không hề dùng `appState`,
 * lượt 1 nhét 20 field state của trang vào EventStore — SAI ranh giới EventStore (chỉ dành cho
 * "state context" nhỏ giữa 2 message, không phải state nghiệp vụ toàn trang, xem docstring
 * event/store.js). SỬA LẠI: toàn bộ 20 field của `event/workflow/subtitle-editor.js` (subtitles,
 * waveform/region, playback, editing dòng, shift hàng loạt...) vào ĐÚNG đây, cùng schema/
 * registry() như mọi domain khác của app — trang này giờ CÓ nạp `service/state.js`.
 *
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('subtitle-editor', {
            schema: {
                _songKey: 'nullable-string',
                _record: 'any',                  // object đầy đủ từ getSongRecord() | null trước init() xong
                _subtitles: 'array',              // mảng làm việc — chưa chắc đã lưu xuống DB (bấm "Lưu" mới ghi thật)
                _autoSubStartTime: 'nullable-number', // đang "ghi" auto-timing hay không (khác null = đang ghi)

                _wavesurfer: 'any',                // WaveSurfer instance | null
                _regionsPlugin: 'any',
                _timelinePlugin: 'any',            // dải mốc thời gian | null (CDN chặn)
                _zoomLevel: 'number',               // px/giây hiện tại, zoomIn()/zoomOut() tự cập nhật
                _region: 'any',                     // Region duy nhất, sống suốt vòng đời trang | null

                _isDebugPanelOpen: 'boolean',
                _lineRangeStopHandler: 'any',       // function | null — handler 'timeupdate' đang canh dừng phát 1 dòng
                _isPlayingRegion: 'boolean',
                _activePlaybackLineId: 'nullable-string', // null = đang phát vùng chung, id = đang phát đúng dòng đó

                _isShiftSelectionMode: 'boolean',
                _shiftSelectedIds: 'set',
                _lineCardNodesById: 'map',          // subId -> card DOM, giữ nguyên qua các lần render

                _editingLineId: 'nullable-string',  // id dòng đang ở "chế độ sửa" (null = không dòng nào đang sửa)
                _editingPendingStart: 'nullable-number',
                _editingPendingEnd: 'nullable-number',
                _editingCardEl: 'any',              // DOM element | null

                // MỚI (17/09/2026, tính năng karaoke) — xem core/subtitle/subtitle-karaoke.js +
                // event/workflow/subtitle-editor.js (openKaraokeDrawer()...). Waveform mini TÁCH
                // HẲN khỏi _wavesurfer/_regionsPlugin ở trên.
                _karaokeEditingLineId: 'nullable-string', // id dòng đang mở drawer karaoke (null = đóng)
                _karaokeWords: 'array',             // mảng làm việc {word, ms} — CHƯA chắc đã Apply (bấm Áp dụng mới ghi vào field `karaoke` của dòng)
                _karaokeLineStart: 'number',        // cache start (giây) của dòng đang mở — cắt đúng đoạn audio cho waveform mini (trục thời gian mini: 0 = start dòng)
                _karaokeLineEnd: 'number',
                _karaokeWavesurfer: 'any',          // WaveSurfer instance MINI (waveform riêng vùng dòng đó) | null
                _karaokeRegionsPlugin: 'any',
                _karaokeAudioUrl: 'nullable-string', // URL WAV nhỏ làm nguồn <audio> nội bộ của WaveSurfer mini (không phát qua nó) — tự revoke lúc đóng drawer
                // MỚI (30/09/2026) — waveform mini chỉ chứa đúng đoạn dòng (PCM giải mã sẵn), nút ▶ từng từ
                // phát TRÊN nó — xem _initKaraokeMiniWaveform().
                _karaokeSourceAudio: 'any',         // {samples: Float32Array mono, sampleRate} — giải mã 1 LẦN/phiên trang, dùng lại cho mọi dòng | null
                _karaokeInitToken: 'number',        // tăng mỗi lần dựng waveform mini — lượt dựng cũ (đang await) thấy lệch token thì tự bỏ
                _karaokeMiniReady: 'boolean',       // waveform mini đã 'ready' (mở khoá nút ▶ từng từ)
                _karaokePlayingIndex: 'nullable-number', // index từ đang phát trên waveform mini (null = không phát)
                _karaokePlayEndSec: 'number',       // mốc dừng (giây, TƯƠNG ĐỐI trong dòng) của từ đang phát
                // MỚI (30/09/2026, lần 2) — nghe từ bằng Web Audio + highlight vùng phát + chữ trong vùng từ + cuộn ngang.
                _karaokeSegment: 'any',             // {samples: Float32Array, sampleRate} — PCM đúng đoạn dòng đang mở | null
                _karaokeSegmentBuffer: 'any',       // AudioBuffer dựng từ _karaokeSegment (lười, lúc bấm ▶ lần đầu) | null
                _karaokeAudioCtx: 'any',            // AudioContext DÙNG CHUNG cả phiên trang (tạo lúc bấm ▶ lần đầu) | null
                _karaokeSourceNode: 'any',          // AudioBufferSourceNode đang phát | null
                _karaokePlayStartSec: 'number',     // đầu từ đang phát (giây, TƯƠNG ĐỐI trong dòng)
                _karaokePlayStartCtxTime: 'number', // AudioContext.currentTime lúc bắt đầu phát — tính vị trí đang phát
                _karaokeHighlightRegion: 'any',     // region bôi xanh [đầu từ, vị trí đang phát] | null
                _karaokeLabelRegions: 'array',      // region vùng TỪ (có chữ bên trong), theo index từ
                _karaokeMarkerRegions: 'array',     // region mốc chia (kéo được)
                _karaokeMiniPxPerSec: 'number',     // px/giây của waveform mini (quy đổi thời điểm -> vị trí cuộn)
            },
            buildDefaults() {
                return {
                    _songKey: null,
                    _record: null,
                    _subtitles: [],
                    _autoSubStartTime: null,

                    _wavesurfer: null,
                    _regionsPlugin: null,
                    _timelinePlugin: null,
                    _zoomLevel: 70,
                    _region: null,

                    _isDebugPanelOpen: false,
                    _lineRangeStopHandler: null,
                    _isPlayingRegion: false,
                    _activePlaybackLineId: null,

                    _isShiftSelectionMode: false,
                    _shiftSelectedIds: new Set(),
                    _lineCardNodesById: new Map(),

                    _editingLineId: null,
                    _editingPendingStart: null,
                    _editingPendingEnd: null,
                    _editingCardEl: null,

                    _karaokeEditingLineId: null,
                    _karaokeWords: [],
                    _karaokeLineStart: 0,
                    _karaokeLineEnd: 0,
                    _karaokeWavesurfer: null,
                    _karaokeRegionsPlugin: null,
                    _karaokeAudioUrl: null,
                    _karaokeSourceAudio: null,
                    _karaokeInitToken: 0,
                    _karaokeMiniReady: false,
                    _karaokePlayingIndex: null,
                    _karaokePlayEndSec: 0,
                    _karaokeSegment: null,
                    _karaokeSegmentBuffer: null,
                    _karaokeAudioCtx: null,
                    _karaokeSourceNode: null,
                    _karaokePlayStartSec: 0,
                    _karaokePlayStartCtxTime: 0,
                    _karaokeHighlightRegion: null,
                    _karaokeLabelRegions: [],
                    _karaokeMarkerRegions: [],
                    _karaokeMiniPxPerSec: 1,
                };
            },
        });
