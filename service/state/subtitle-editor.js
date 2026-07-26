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
                };
            },
        });
