/**
 * service/state/record/index.js — Đăng ký account cho index.html (đợt tái cấu trúc state,
 * 25/07/2026). Thay cho đoạn `<script>` inline trước đây nằm ngay trong index.html — dồn về đây
 * theo đúng mục 4 của đợt tái cấu trúc ("mọi registry() + EventStore khai báo tập trung theo
 * từng trang tại service/state/record/*.js").
 *
 * index.html vẫn cần HẦU HẾT mọi domain STATE hiện có -> đăng ký 'all' (mọi package đã
 * `AppState.definePackage()` tính tới thời điểm dòng này chạy) — giữ NGUYÊN phạm vi truy cập như
 * bản registry('player', 'all') cũ, KHÔNG thu hẹp gì.
 *
 * KHÔNG đụng tới các `new EventStore(...)` đã có sẵn rải trong từng router của index.html (vd
 * `playlistStore`, `storageStore`...) — những instance đó đã đúng chỗ theo quy ước cũ của
 * event/store.js (mỗi router tự new tại top-level file của chính nó), nằm NGOÀI phạm vi đợt tái
 * cấu trúc STATE/CONFIG này.
 *
 * PHẢI nạp SAU: mọi file service/state/*.js (18 package, cần đã definePackage() xong).
 */
        const APP_ACCOUNT = 'player';
        appState.registry(APP_ACCOUNT, 'all');
