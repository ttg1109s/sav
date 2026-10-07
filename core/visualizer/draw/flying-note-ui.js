/**
 * core/visualizer/draw/flying-note-ui.js — ĐỔI TÊN 28/09/2026 từ flying-note.js (Rule 5c: file core chuyên
 * dựng UI phải có hậu tố `-ui`; file cũ xoá tay).
 *
 * Nốt nhạc bay lên (DOM, không phải canvas) trên #record-container khi nhạc đủ mạnh, bất kể kiểu hiệu
 * ứng nào đang chọn. TÁCH RIÊNG (19/07/2026, yêu cầu Giang — mỗi hàm 1 file trong core/visualizer/draw/)
 * từ file gộp cũ core/visualizer/draw-helpers.js (đã xoá, xem readme/changelog/v13.md mục 6).
 *
 * [SỬA — 28/09/2026, Phase 2 dọn visualizer] `spawnFlyingNote()` cũ ĐÃ XOÁ — hàm đó tự đọc appState
 * (`frameCounter`, `globalHueOffset`) và tự hẹn giờ gỡ nốt bằng `taskManager.once()` (taskManager CẤM
 * trong Core, xem readme/task-manager-conventions.md mục 2). Giờ tách 2 Core thuần:
 *   - `createFlyingNoteEl(container, hue)` — dựng + gắn 1 nốt, trả về phần tử.
 *   - `removeFlyingNoteEl(noteEl)` — gỡ nốt (DỌN tài nguyên do chính vòng đời này tạo, Rule 3b).
 *   - `shouldSpawnFlyingNote(...)` — phép tính "frame này có sinh nốt không" (thuần, trả boolean).
 * Workflow `workflowAudioAnalysis._spawnFlyingNote()` (event/workflow/audio-analysis.js) dùng kết quả làm
 * guard, rồi tự hẹn giờ gỡ nốt qua taskManager.
 */

/** Ký hiệu nốt chọn ngẫu nhiên cho mỗi lần bay. */
const FLYING_NOTE_SYMBOLS = ['♪', '♫', '♩', '♬'];
/** Ngưỡng năng lượng, xác suất bỏ qua mỗi frame (Math.random() > 0.6 cũ), nhịp tối đa 1 nốt mỗi N frame,
 * thời gian sống trước khi gỡ khỏi DOM — giữ nguyên giá trị cũ. */
const FLYING_NOTE_ENERGY_MIN = 0.3;
const FLYING_NOTE_SKIP_CHANCE = 0.6;
const FLYING_NOTE_EVERY_N_FRAMES = 8;
const FLYING_NOTE_LIFETIME_MS = 1500;

/**
 * Frame này có sinh nốt bay không: đang phát, năng lượng đủ, trúng xác suất, đúng nhịp mỗi N frame.
 * @param {boolean} isPlaying @param {number} smoothedEnergy @param {number} frameCounter
 * @param {number} randomValue - Math.random() do nơi gọi truyền vào (giữ hàm thuần, dễ thử).
 * @returns {boolean}
 */
function shouldSpawnFlyingNote(isPlaying, smoothedEnergy, frameCounter, randomValue) {
    return isPlaying
        && smoothedEnergy > FLYING_NOTE_ENERGY_MIN
        && randomValue > FLYING_NOTE_SKIP_CHANCE
        && frameCounter % FLYING_NOTE_EVERY_N_FRAMES === 0;
}

/**
 * Dựng 1 nốt nhạc bay (class `.music-note` lo phần animation bay lên), đặt lệch ngẫu nhiên quanh tâm
 * đĩa, màu theo hue hiện tại (+ lệch ngẫu nhiên tối đa 60°), gắn vào `container`.
 * @param {HTMLElement} container - #record-container.
 * @param {number} hue - globalHueOffset của frame hiện tại (0-360).
 * @returns {HTMLDivElement} nốt vừa gắn — nơi gọi giữ lại để gỡ sau.
 */
function createFlyingNoteEl(container, hue) {
    const note = document.createElement('div');
    note.className = 'music-note';
    note.textContent = FLYING_NOTE_SYMBOLS[Math.floor(Math.random() * FLYING_NOTE_SYMBOLS.length)];
    const offsetX = Math.random() * 40 - 20;
    const offsetY = Math.random() * 20 - 10;
    note.style.left = `calc(50% + ${offsetX}px)`;
    note.style.top = `calc(50% + ${offsetY}px)`;
    note.style.color = `hsl(${hue + Math.random() * 60}, 100%, 70%)`;
    container.appendChild(note);
    return note;
}

/** Gỡ 1 nốt khỏi DOM — nốt đã bị gỡ trước đó (container bị dựng lại...) thì bỏ qua. */
function removeFlyingNoteEl(noteEl) {
    if (!noteEl.parentNode) return;
    noteEl.parentNode.removeChild(noteEl);
}
