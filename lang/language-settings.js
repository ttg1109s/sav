/**
 * language-settings.js — 3 hàm core cho UI section "Ngôn ngữ" trong Settings (xem
 * js/components/settings/language.js): dựng <option> theo danh sách ngôn ngữ hiện có, xử lý
 * chọn ngôn ngữ trong <select>, xử lý upload file .json mới, xóa ngôn ngữ đang chọn.
 *
 * ÁP DỤNG /event/ (cụm "languageSettings"): `addEventListener` cũ đã CHUYỂN sang
 * event/listener/language-settings.js. Nhánh xóa cần modal xác nhận -> đặt ở
 * event/workflow/language-settings.js (core không biết modalChoice/alertModal tồn tại). DOM ref
 * (settingLanguageSelect/Upload/Delete) đã dọn về core/dom-refs.js.
 *
 * PHẢI nạp SAU: lang.js (cần saveLanguagePack/applySavedLanguage/listAvailableLanguages/
 * applyLanguageToDom/currentLangCode), db.js (cần deleteLanguagePack).
 */
        /**
         * Dựng lại toàn bộ <option> trong <select> theo danh sách ngôn ngữ hiện có (English +
         * mọi ngôn ngữ đã upload trong IndexedDB) — gọi lúc mở màn Language (Setting > System)
         * VÀ sau mỗi lần upload/xóa thành công để danh sách luôn khớp dữ liệu thật.
         *
         * SỬA (đợt tái cấu trúc bottom nav App Panel + phân phối lại section Settings, phản hồi
         * Giang) — `#setting-language-select`/`#setting-language-delete` KHÔNG còn TĨNH (Language
         * giờ là 1 màn ĐỘNG trong Setting, render mỗi lần mở qua event/workflow/app-settings.js) —
         * đọc THẲNG qua `genericDrawerBody.querySelector(...)` (core/generic-drawer.js, LUÔN có
         * sẵn từ boot) thay vì 2 dom-ref tĩnh cũ (đã null hoá). An toàn khi màn Language đang ĐÓNG
         * (querySelector trả null, guard bỏ qua) — vd lúc upload/xóa xong TỪ 1 phiên trước đó mà
         * người dùng đã rời màn Language sang màn khác.
         */
        async function renderLanguageOptions() {
            const selectEl = genericDrawerBody ? genericDrawerBody.querySelector('#setting-language-select') : null;
            if (!selectEl) return;
            const list = await listAvailableLanguages();
            selectEl.innerHTML = '';
            for (const lang of list) {
                const opt = document.createElement('option');
                opt.value = lang.code;
                opt.textContent = lang.name;
                selectEl.appendChild(opt);
            }
            selectEl.value = currentLangCode;
            updateLanguageDeleteButtonVisibility();
        }

        /** Nút "Xóa ngôn ngữ này" chỉ hiện khi ngôn ngữ ĐANG CHỌN trong <select> khác 'en'. */
        function updateLanguageDeleteButtonVisibility() {
            const selectEl = genericDrawerBody ? genericDrawerBody.querySelector('#setting-language-select') : null;
            const deleteBtnEl = genericDrawerBody ? genericDrawerBody.querySelector('#setting-language-delete') : null;
            if (!selectEl || !deleteBtnEl) return;
            const selected = selectEl.value;
            deleteBtnEl.classList.toggle('hidden', selected === 'en');
        }

        /** Core thuần: áp dụng ngôn ngữ vừa chọn trong <select>. */
        async function selectLanguage(code) {
            const applied = await applySavedLanguage(code);
            if (applied) applyLanguageToDom();
            updateLanguageDeleteButtonVisibility();
        }

        /** Core thuần: đọc + parse + lưu 1 file .json ngôn ngữ vừa upload, trả {status, ...} rõ
         *  ràng — KHÔNG tự alertModal (đặt ở workflow). resolve KHÔNG BAO GIỜ reject cho lỗi
         *  nghiệp vụ đã biết trước (parse lỗi/file không hợp lệ/đọc file lỗi). */
        function readAndSaveLanguageFile(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    let parsed;
                    try {
                        parsed = JSON.parse(evt.target.result);
                    } catch (err) {
                        resolve({ status: 'parseError', message: err && err.message ? err.message : String(err) });
                        return;
                    }
                    const result = await saveLanguagePack(parsed);
                    if (!result.ok) {
                        resolve({ status: 'invalidFile' });
                        return;
                    }
                    await applySavedLanguage(result.code);
                    applyLanguageToDom();
                    await renderLanguageOptions();
                    resolve({ status: 'success', name: result.name });
                };
                reader.onerror = () => {
                    resolve({ status: 'parseError', message: null }); // null -> workflow tự dùng t('common.unknownError')
                };
                reader.readAsText(file);
            });
        }

        /** Core thuần: thực thi xóa ngôn ngữ theo code đã xác nhận. */
        async function deleteLanguageByCode(code) {
            await deleteLanguagePack(code);
            // Ngôn ngữ vừa xóa CHÍNH LÀ ngôn ngữ đang active -> quay về English ngay (không thể
            // tiếp tục hiển thị 1 ngôn ngữ đã bị xóa khỏi DB).
            if (currentLangCode === code) {
                await applySavedLanguage('en');
                applyLanguageToDom();
            }
            await renderLanguageOptions();
        }

        // Dựng danh sách ngay khi script này nạp (không đợi mở Settings lần đầu) — section nằm
        // trong drawer ẨN SẴN lúc khởi động (display: none qua transform), nhưng <select> vẫn cần
        // có đúng <option> ngay từ đầu để hiện đúng giá trị nếu người dùng mở Settings ngay lập
        // tức sau khi trang load xong, không phải đợi 1 lượt click nào khác mới dựng.
        renderLanguageOptions();
