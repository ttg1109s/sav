/**
 * core/visualizer/draw/flying-note-ui.js — nốt nhạc bay lên (DOM) từ #record-container — khung bìa nằm trong nút Play/Pause
 * của Bottom Player — khi nhạc đủ mạnh, bất kể effect nào. `shouldSpawnFlyingNote()` thuần (frame này có sinh nốt không),
 * `createFlyingNoteEl()` dựng + gắn, `removeFlyingNoteEl()` gỡ; hẹn giờ gỡ ở Workflow
 * (event/workflow/audio-analysis.js::_spawnFlyingNote()).
 */

/** Ký hiệu nốt chọn ngẫu nhiên cho mỗi lần bay. */
const FLYING_NOTE_SYMBOLS = ['♪', '♫', '♩', '♬'];
/** Ngưỡng năng lượng, xác suất bỏ qua mỗi frame, nhịp tối đa 1 nốt mỗi N frame, thời gian sống trước khi gỡ khỏi DOM. */
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
 * nút Play, màu theo hue hiện tại (+ lệch ngẫu nhiên tối đa 60°), gắn vào `container`.
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
