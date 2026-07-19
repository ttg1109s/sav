/**
 * Tạo 1 nốt nhạc bay lên (DOM, không phải canvas) — gọi từ vòng lặp render chính
 * (core/visualizer/draw-visualizer.js) khi nhạc đủ mạnh, bất kể kiểu hiệu ứng nào đang chọn.
 * TÁCH RIÊNG (19/07/2026, yêu cầu Giang — mỗi hàm 1 file trong core/visualizer/draw/) từ file gộp
 * cũ core/visualizer/draw-helpers.js (đã xoá, xem readme/folder-structure.md).
 */
        function spawnFlyingNote() {
            if (appState.get('frameCounter') % 8 !== 0) return;
            const symbols = ['♪', '♫', '♩', '♬'];
            const note = document.createElement('div'); note.className = 'music-note'; note.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            const offsetX = Math.random() * 40 - 20; const offsetY = Math.random() * 20 - 10;
            note.style.left = `calc(50% + ${offsetX}px)`; note.style.top = `calc(50% + ${offsetY}px)`;
            note.style.color = `hsl(${appState.get('globalHueOffset') + Math.random()*60}, 100%, 70%)`; recordContainer.appendChild(note);
            taskManager.once(() => { if (note.parentNode) note.parentNode.removeChild(note); }, 1500);
        }
