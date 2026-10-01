/**
 * core/visualizer/stats-bar.js — Thanh số liệu BPM / Pitch / Energy trên màn Visualizer: định dạng chữ + ghi DOM.
 *
 * [DỜI — 01/10/2026, Giang: "move những hàm không liên quan ra khỏi audio-analysis"] Từ core/audio-analysis.js, logic
 * giữ nguyên. Core thuần (Rule 1-3): nhận tham số, không đọc state. event/workflow/audio-analysis.js gọi mỗi frame
 * (bỏ qua phần ghi DOM khi dải số liệu đang ẩn — xem core/visualizer-ui-visibility.js::setStatsPanelVisible()).
 */

/** Giữ hiển thị nốt cuối trong khoảng này (ms) khi worker tạm chưa bắt được pitch. */
const AUDIO_NOTE_HOLD_MS = 250;

/** Chữ hiển thị ô Pitch: đang phát + đủ năng lượng + nốt gần nhất còn "tươi" (trong
 * AUDIO_NOTE_HOLD_MS) -> tên nốt đó; mọi trường hợp khác -> "---". */
// SỬA 01/10/2026: tham số 2 đổi từ `energyPercent` (<= 1 -> "---") sang `hasSignal` (RMS trên ngưỡng im lặng, xem
// workflowAudioAnalysis._tick()). Energy % tính trên 1024 bin của phổ phân tích cố định nên 1 giọng/nhạc cụ đơn
// (ít bin có năng lượng) dễ rơi <= 1% dù nghe rõ — pitch bị tắt oan (phát hiện khi test vibrato).
function resolveNoteDisplayText(isPlaying, hasSignal, lastNoteStr, lastNoteTime, now) { // isPlaying: Workflow truyền "không dừng thật" (phase !== 'stopped')
    if (!isPlaying || !hasSignal) return '---';
    if (!lastNoteStr || (now - lastNoteTime) >= AUDIO_NOTE_HOLD_MS) return '---';
    return lastNoteStr;
}

/** Ghi 3 ô số liệu BPM / Pitch / Energy trên thanh trạng thái. */
function paintAudioStatsBar(energyEl, bpmEl, noteEl, energyText, bpmText, noteText) {
    energyEl.textContent = energyText;
    bpmEl.textContent = bpmText;
    noteEl.textContent = noteText;
}
