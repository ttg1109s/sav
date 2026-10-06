/**
 * service/state/recorder.js — Package STATE domain "recorder" (MỚI 01/10/2026, Giang yêu cầu) — chế độ GHI ÂM ở
 * Player Song/Video (icon Control Center). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js, TRƯỚC service/state/record/index.js (registry('player','all') cần package này đã
 * definePackage() xong).
 *
 * SESSION-ONLY (Giang chốt "bản ghi lưu tạm trong ram state") — KHÔNG có bản sao nào trong AppConfig/DB. Cấu hình bền
 * (chế độ thu, Sync, Count-in, chất lượng — SỬA 07/10/2026) là chuyện KHÁC — domain AppConfig 'recorder' (core/config.js).
 *
 * `recordPhase` (enum string):
 *   'idle'      — không ghi. Mọi điều khiển bình thường.
 *   'starting'  — đang xin mic/dựng graph (chặn bấm ghi lần 2), và cả lúc Count-in đếm ngược (MỚI 07/10/2026 — overlay đã
 *                 hiện, điều khiển đã khoá, MediaRecorder CHƯA chạy).
 *   'recording' — đang ghi, overlay che toàn màn Visualizer, mọi cử chỉ/điều khiển bị chặn.
 *   'stopping'  — đã bấm X/hết bài/bị ngắt, đang đợi MediaRecorder trả dữ liệu (pause tự bắn trong lúc này bị bỏ qua).
 *   'review'    — modal nghe lại (mini waveform, phát lặp) đang mở.
 *   'saving'    — đang ghi bản ghi vào DB songs.
 * Mọi phase KHÁC 'idle' đều chặn Next/Prev/Play-Pause/Restart (event/block.js) và giữ 'ended' không tự chuyển bài
 * (event/router/player-controls.js).
 *
 * `recordBlob` — Blob bản ghi hoàn chỉnh (chế độ Headphones: giọng + nhạc gốc trộn sẵn lúc ghi, Giang chốt phương án A;
 *   chế độ Speaker: chỉ mic — nhạc từ loa + giọng). null khi chưa có.
 * `recordMeta` — { mediaKind: 'song'|'video', sourceKey, sourceTag, sourceCover, mimeType, mode, latencyMs, mediaEnded,
 *   durationSec } — chốt lúc bắt đầu ghi; `mediaEnded` bật true nếu media hết THẬT trong phiên (Huỷ/Lưu xong sẽ sang
 *   bài kế thay vì phát tiếp); `durationSec` điền lúc mở modal nghe lại.
 */
        AppState.definePackage('recorder', {
            schema: {
                recordPhase: 'string',
                recordBlob: 'any',
                recordMeta: 'any',
            },
            buildDefaults() {
                return {
                    recordPhase: 'idle',
                    recordBlob: null,
                    recordMeta: null,
                };
            },
        });
