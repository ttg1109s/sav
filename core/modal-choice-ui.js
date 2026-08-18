/**
 * modal-choice-ui.js — Hàm dùng CHUNG để hiện 1 modal hỏi quyết định (text/HTML + N nút tuỳ biến),
 * dùng được cho NHIỀU tình huống khác nhau trong app (không riêng 1 case cụ thể nào).
 *
 * Ý TƯỞNG: KHÔNG dựng sẵn HTML cố định trong template tĩnh — modal loại này không phải lúc nào
 * cũng xuất hiện, không cần giữ DOM tồn tại sẵn suốt đời app. `modalChoice()` tự DỰNG DOM động
 * ngay lúc gọi, gắn vào `document.body` (NGOÀI #app-root, không phụ thuộc timing mount của
 * main.js), và TỰ XOÁ HẲN khỏi DOM ngay sau khi người dùng chọn 1 nút.
 *
 * CÁCH DÙNG:
 *   modalChoice(text, buttons)
 *     - text: chuỗi nội dung hỏi (hỗ trợ HTML đơn giản, ví dụ in đậm tên bài hát bằng <b>).
 *     - buttons: mảng các nút, mỗi nút { label, className, onClick }.
 *         - label:     chữ hiện trên nút (dùng cả cho <option> nếu rơi vào diện dropdown, xem dưới).
 *         - className: class Tailwind cho riêng nút đó — CHỈ áp dụng khi render dạng hàng nút
 *                      thường (≤2 nút); diện dropdown (>2 nút) dùng style cố định cho <select> +
 *                      nút "Chọn", không đọc className.
 *         - onClick:   hàm chạy khi bấm nút đó (hoặc khi bấm nút "Chọn" với option này đang chọn
 *                      trong dropdown). Modal LUÔN tự đóng + xoá DOM TRƯỚC khi gọi onClick.
 *   modalChoice(text, buttons, options?)
 *     - options.title: tiêu đề ngắn phía trên (tuỳ chọn).
 *     - options.bodyHtml: chuỗi HTML dạng KHỐI, chèn giữa `text` và hàng nút — dùng cho nội dung
 *       không hợp trong 1 dòng `<p>` đơn giản (stat-grid, breakdown điểm, bộ chọn độ khó...). Nội
 *       dung gán qua `innerHTML` — PHẢI tự escapeHtml() phần dữ liệu không đáng tin cậy TRƯỚC khi
 *       ghép vào chuỗi, cùng nguyên tắc với `text`.
 *     - options.dismissOnOverlayClick: true (mặc định false) cho phép bấm ra ngoài để đóng — gọi
 *       nút cuối cùng trong `buttons`.
 *
 *   **>2 nút tự đổi layout**: hàng nút ngang chỉ hợp lý với ≤2 lựa chọn — từ 3 nút trở lên,
 *   `modalChoice()` tự render 1 `<select>` (liệt kê `label` từng nút làm option) + 1 nút "Chọn" duy
 *   nhất đứng cạnh. Bấm nút "Chọn" mới thực thi đúng `onClick` của option đang chọn trong dropdown.
 *
 *   Mỗi phần tử trong `buttons` còn hỗ trợ thêm (tuỳ chọn, dùng khi cần khoá tạm 1 nút lúc mới mở
 *   modal — ví dụ chờ dữ liệu nào đó load xong mới cho bấm):
 *     - disabled:  true để nút này (hoặc option này, diện dropdown) bắt đầu ở trạng thái khoá.
 *     - dataset:   object {key: value} gán thẳng vào phần tử (button hoặc option) — dùng để code
 *                  BÊN NGOÀI modalChoice() querySelector lại sau khi mở.
 *
 * KHÔNG dùng chung cơ chế với loading-shield (`withLoadingShield`, `js/core/loading-shield-util.js`)
 * — đã kiểm tra: loading-shield chỉ là spinner + 1 dòng text, không có chỗ cho nút bấm nào, sửa nó
 * để nhồi thêm nút sẽ làm rối mục đích gốc (chỉ để "che màn hình lúc xử lý xong dữ liệu trong bao
 * lâu", không phải hỏi quyết định). modalChoice() vì vậy là 1 component HOÀN TOÀN riêng, độc lập,
 * không đụng gì tới loading-shield.js/loading-shield-util.js.
 *
 * alertModal(text, options?) (THÊM, xem định nghĩa dưới) — wrapper 1-nút "OK" dựng trên CHÍNH
 * modalChoice() này, dùng để THAY THẾ TOÀN BỘ alert() rải rác khắp app (core/playlist/actions.js,
 * core/playlist/loader.js, core/id3-export.js, core/state-and-video-bg.js, core/storage-manager.js,
 * core/player-controls.js, core/language-settings.js, core/subtitles.js). LÝ DO: alert() là API
 * đồng bộ-chặn của trình duyệt — có thể bị 1 số WebView mobile chặn hẳn (không hiện gì, coi như
 * mất luôn thông báo lỗi), hoặc gây "đứng" cảm giác crash khi rơi đúng lúc 1 #loading-shield khác
 * đang chạy. alertModal() không chặn gì cả, là 1 lớp DOM thật giống modalChoice(), an toàn 100%
 * trên mọi trình duyệt/WebView. escapeHtml(str) (THÊM, xem định nghĩa dưới) đi kèm — dùng để
 * escape phần dữ liệu KHÔNG đáng tin cậy (tên file người dùng chọn, err.message gốc) trước khi
 * truyền vào alertModal()/modalChoice(), vì cả 2 đều gán trực tiếp qua `innerHTML`.
 *
 * z-[130]: đứng trên mọi modal tĩnh hiện có (song-edit-modal/song-info-modal/playback-error-modal
 * đều z-[120]/z-[125]) — modal loại "quyết định" này cần luôn nổi trên cùng nếu cả 2 cùng xuất
 * hiện — nhưng vẫn DƯỚI loading-shield (z-[200], xem loading-shield.js) vì shield là trạng thái
 * "đang xử lý dữ liệu", ưu tiên cao hơn mọi hộp thoại hỏi người dùng.
 */
        /**
         * escapeHtml(str) — Escape 5 ký tự HTML đặc biệt (& < > " ') trước khi nhồi vào
         * `textEl.innerHTML` của modalChoice()/alertModal(). BẮT BUỘC dùng cho bất kỳ chuỗi nào
         * không hoàn toàn do code app tự dựng (ví dụ: tên file người dùng chọn — file.name có thể
         * chứa bất kỳ ký tự gì kể cả "<img onerror=...>", hoặc err.message từ exception gốc của
         * trình duyệt) — KHÔNG escape các chuỗi dịch (t()/tFormat()) vì chúng vốn đã được phép
         * chứa HTML đơn giản có chủ đích (in đậm, xuống dòng) theo đúng thiết kế của modalChoice().
         */
        function escapeHtml(str) {
            return String(str == null ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        /**
         * alertModal(text, options?) — Thay thế CHO alert() ở mọi nơi trong app (FIX runtime: alert()
         * là API đồng bộ-CHẶN của trình duyệt, có thể bị 1 số WebView/trình duyệt mobile chặn hẳn
         * hoặc gây cảm giác "đứng app"/treo khung hình đang dở dang — đặc biệt nguy hiểm nếu gọi
         * trong lúc 1 #loading-shield khác đang hiển thị, vì alert() chặn cả luồng render của
         * shield đó luôn). Tận dụng LẠI modalChoice() đã có sẵn (xem file này) — KHÔNG dùng
         * withLoadingShield(): đã xác nhận loading-shield chỉ là spinner + 1 dòng text, không có
         * chỗ cho nút bấm, không phù hợp để hiện thông báo cần người dùng đọc + xác nhận đã đọc.
         *
         * Khác alert() ở chỗ KHÔNG chặn luồng JS — code gọi sau nó vẫn chạy tiếp ngay (modal chỉ là
         * 1 lớp DOM hiện ra, đóng bằng cách bấm nút). Những nơi code cũ dựa vào tính "chặn" của
         * alert() (ví dụ `alert(...); return;` để dừng hành động ngay) vẫn hoạt động đúng vì lệnh
         * `return` đứng ngay sau, không phụ thuộc gì vào việc modal đã đóng hay chưa. Những nơi cần
         * CHỜ người dùng bấm "OK" rồi mới chạy tiếp (hiếm) có thể `await alertModal(...)` vì hàm trả
         * về 1 Promise, resolve ngay khi nút OK được bấm.
         *
         * - text: chuỗi nội dung thông báo. PHẢI tự escapeHtml() phần nào không phải do code app tự
         *   dựng (tên file, message lỗi gốc) TRƯỚC khi truyền vào đây — alertModal() không tự
         *   escape vì nhiều chỗ gọi cần giữ HTML đơn giản hợp lệ từ chuỗi dịch (in đậm, xuống dòng).
         * - options.title: tiêu đề tuỳ chọn (giống modalChoice()).
         * - options.okLabel: chữ trên nút (mặc định t('common.ok') nếu hàm t() đã sẵn sàng, fallback 'OK').
         */
        function alertModal(text, options) {
            options = options || {};
            const okLabel = options.okLabel || (typeof t === 'function' ? t('common.ok') : 'OK');
            return new Promise((resolve) => {
                modalChoice(
                    text,
                    [
                        {
                            label: okLabel,
                            className: 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors',
                            onClick: () => resolve()
                        }
                    ],
                    { title: options.title }
                );
            });
        }

        /** Hàng nút ngang thường (≤2 nút) — mỗi nút gọi thẳng onClick của chính nó. */
        function _appendButtonRow(card, buttons, closeModal) {
            const buttonRow = document.createElement('div');
            buttonRow.className = 'flex gap-3 mt-1';
            buttons.forEach((btnDef) => {
                const btnEl = document.createElement('button');
                btnEl.className = btnDef.className || 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
                btnEl.textContent = btnDef.label;
                if (btnDef.dataset) Object.keys(btnDef.dataset).forEach(k => { btnEl.dataset[k] = btnDef.dataset[k]; });
                if (btnDef.disabled) {
                    btnEl.disabled = true;
                    btnEl.classList.add('opacity-40', 'cursor-not-allowed');
                }
                btnEl.addEventListener('click', () => { closeModal(); if (typeof btnDef.onClick === 'function') btnDef.onClick(); });
                buttonRow.appendChild(btnEl);
            });
            card.appendChild(buttonRow);
        }

        /** >2 nút — 1 <select> liệt kê label từng nút + 1 nút "Chọn" duy nhất thực thi onClick của
         * option đang chọn. */
        function _appendDropdownRow(card, buttons, closeModal) {
            const row = document.createElement('div');
            row.className = 'flex gap-3 mt-1';

            const selectEl = document.createElement('select');
            selectEl.className = 'flex-1 py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white';
            buttons.forEach((btnDef, i) => {
                const optionEl = document.createElement('option');
                optionEl.value = String(i);
                optionEl.textContent = btnDef.label;
                if (btnDef.dataset) Object.keys(btnDef.dataset).forEach(k => { optionEl.dataset[k] = btnDef.dataset[k]; });
                if (btnDef.disabled) optionEl.disabled = true;
                selectEl.appendChild(optionEl);
            });

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors';
            confirmBtn.textContent = typeof t === 'function' ? t('common.select') : 'Chọn';

            row.appendChild(selectEl);
            row.appendChild(confirmBtn);
            card.appendChild(row);

            confirmBtn.addEventListener('click', () => {
                const chosen = buttons[Number(selectEl.value)];
                closeModal();
                if (chosen && typeof chosen.onClick === 'function') chosen.onClick();
            });
        }

        function modalChoice(text, buttons, options) {
            options = options || {};
            buttons = buttons || [];
            // Tự đóng modalChoice cũ (nếu lỡ có, hiếm khi xảy ra vì mỗi lần đều xoá hẳn DOM ngay
            // sau khi chọn) — phòng trường hợp gọi modalChoice() chồng lệnh trước khi cái cũ đóng.
            const stale = document.getElementById('modal-choice-overlay');
            if (stale) stale.remove();

            const overlay = document.createElement('div');
            overlay.id = 'modal-choice-overlay';
            overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';
            overlay.style.zIndex = String(Z_INDEX.MODAL_CHOICE);

            const card = document.createElement('div');
            card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

            if (options.title) {
                const titleEl = document.createElement('h3');
                titleEl.className = 'text-base font-bold text-white';
                titleEl.textContent = options.title;
                card.appendChild(titleEl);
            }

            const textEl = document.createElement('p');
            textEl.className = 'text-sm text-slate-300 leading-relaxed whitespace-pre-line';
            textEl.innerHTML = text; // cho phép <b>/<br> đơn giản — nội dung luôn do code app tự dựng, không lấy trực tiếp từ input người dùng chưa qua escape
            textEl.id = 'modal-choice-text'; // cho phép code bên ngoài cập nhật lại nội dung sau khi mở
            card.appendChild(textEl);

            if (options.bodyHtml) {
                const bodyEl = document.createElement('div');
                bodyEl.id = 'modal-choice-body';
                bodyEl.innerHTML = options.bodyHtml; // khối nội dung tự do (stat-grid, bộ chọn độ khó...) — cùng nguyên tắc escape với `text`
                card.appendChild(bodyEl);
            }

            function closeModal() {
                overlay.remove(); // xoá hẳn khỏi DOM ngay khi đóng — không giữ lại để tiết kiệm RAM
            }

            if (buttons.length > 2) _appendDropdownRow(card, buttons, closeModal);
            else _appendButtonRow(card, buttons, closeModal);

            overlay.appendChild(card);

            if (options.dismissOnOverlayClick) {
                overlay.addEventListener('click', (e) => {
                    if (e.target !== overlay) return; // chỉ tính click ĐÚNG lên overlay, không phải lên card/nút bên trong
                    const fallbackBtn = buttons[buttons.length - 1];
                    closeModal();
                    if (fallbackBtn && typeof fallbackBtn.onClick === 'function') fallbackBtn.onClick();
                });
            }

            document.body.appendChild(overlay);
            return closeModal; // trả về hàm đóng, phòng trường hợp code gọi cần tự đóng modal sớm hơn (hiếm dùng)
        }
