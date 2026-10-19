/**
 * event/workflow/config.js — Workflow "config": lưu vizConfig (localStorage ngay + bản backup IndexedDB hẹn 2s) và nạp lại
 * lúc boot (đọc localStorage, rỗng thì phục hồi từ backup; merge + di trú; resolve nền media thư viện; áp vài UI phụ thuộc
 * config). Default, domain và các hàm thuần: core/config.js.
 *
 * NẠP SAU: core/config.js, service/db.js (getMeta/setMeta/delMeta/getImageRecord/getVideoRecord), service/blob-url.js,
 * core/auto-switch-visual.js, core/visualizer/visualizer-display.js, core/visualizer-ui-visibility.js.
 */

const CONFIG_BACKUP_FLUSH_TASK = 'configBackupFlush';
const CONFIG_BACKUP_FLUSH_MS = 2000;

/** Chuỗi cấu hình lúc boot: có bản localStorage thì dùng, không thì thử phục hồi từ backup IndexedDB. */
const CONFIG_BOOT_SOURCE_BY_FOUND = {
    true: async (stored) => stored,
    false: async () => workflowConfig._restoreFromBackup(),
};

/** Đọc record thư viện theo loại nền media (service/db.js). */
const APP_BG_MEDIA_RECORD_READER_BY_KIND = {
    photo: (key) => getImageRecord(key),
    video: (key) => getVideoRecord(key),
};

/** Nền media lúc boot (classifyAppBgMediaBoot()): resolve được -> gán 3 URL runtime; hỏng -> gỡ tham chiếu + fallback kiểu
 * nền; không dùng -> giữ nguyên (3 URL vừa reset). */
const APP_BG_MEDIA_BOOT_BY_CASE = {
    found: (media) => appConfigViz.mutateAll((cfg) => {
        cfg.bgImage = media.imageUrl; cfg.bgVideo = media.videoUrl; cfg.bgMediaThumb = media.thumbUrl;
    }),
    broken: () => {
        const fallback = computeAppBgMediaFallback(appConfigViz.getAll()); // core/config.js
        appConfigViz.mutateAll((cfg) => { Object.assign(cfg, fallback); });
        console.log(`writer: "workflowConfig._loadAppBgMediaOnBoot", page: "config", content: "nền media mất -> themeMode '${fallback.themeMode}'"`);
    },
    none: () => {},
};

const workflowConfig = {
    /** Lưu vizConfig: localStorage ngay, backup IndexedDB sau 2s (gọi dồn chỉ ghi 1 lần). */
    save() {
        writeVizConfigToStorage(appConfigViz.getAll()); // core/config.js
        taskManager.once(() => this._flushBackup(), CONFIG_BACKUP_FLUSH_MS, CONFIG_BACKUP_FLUSH_TASK);
    },

    _flushBackup() {
        taskManager.kill(CONFIG_BACKUP_FLUSH_TASK);
        setMeta('configBackup', buildVizConfigBackup(appConfigViz.getAll())) // core/config.js
            .catch((e) => console.warn('[config] Lưu configBackup (IndexedDB) lỗi:', e));
    },

    /** localStorage rỗng: lấy bản backup IndexedDB, ghi lại vào localStorage. @returns {Promise<string|null>} */
    async _restoreFromBackup() {
        try {
            const backup = await getMeta('configBackup');
            if (!backup || typeof backup !== 'object') return null;
            writeVizConfigToStorage(backup); // core/config.js
            console.warn('[config] localStorage rỗng — đã phục hồi cấu hình từ bản backup IndexedDB.');
            return JSON.stringify(backup);
        } catch (e) {
            console.warn('[config] Không đọc được configBackup (IndexedDB):', e);
            return null;
        }
    },

    /**
     * Item thư viện làm nền App -> blob: URL runtime. Dùng lúc boot và khi chọn nền mới (event/workflow/theme.js).
     * @param {'photo'|'video'|''} kind @param {string} key
     * @returns {Promise<null|{imageUrl:string, videoUrl:string, thumbUrl:string}>} null = không có/mất/thiếu blob
     */
    async resolveAppBgMedia(kind, key) {
        const readRecord = APP_BG_MEDIA_RECORD_READER_BY_KIND[kind];
        if (!key || !readRecord) return null;
        const blobs = pickAppBgMediaBlobs(kind, await readRecord(key)); // core/config.js
        if (!blobs) return null;
        return { imageUrl: this._blobUrlOrEmpty(blobs.image), videoUrl: this._blobUrlOrEmpty(blobs.video), thumbUrl: this._blobUrlOrEmpty(blobs.thumb) };
    },

    _blobUrlOrEmpty(blob) {
        return blob ? createBlobUrl(blob) : ''; // service/blob-url.js
    },

    async _loadAppBgMediaOnBoot() {
        delMeta('bgImage').catch(() => {}); // bản copy ảnh nền của cơ chế cũ — xoá để trả dung lượng
        const cfg = appConfigViz.getAll();
        const media = await this.resolveAppBgMedia(cfg.bgMediaKind, cfg.bgMediaKey);
        APP_BG_MEDIA_BOOT_BY_CASE[classifyAppBgMediaBoot(cfg, !!media)](media); // core/config.js
    },

    /** Bước đầu của boot (event/workflow/app-boot.js): nạp + di trú cấu hình đã lưu, resolve nền media, áp UI phụ thuộc. */
    async loadOnBoot() {
        const stored = localStorage.getItem(VIZ_CONFIG_STORAGE_KEY) || localStorage.getItem(VIZ_CONFIG_LEGACY_STORAGE_KEY);
        const raw = await CONFIG_BOOT_SOURCE_BY_FOUND[!!stored](stored);
        appConfigViz.setAll(mergeSavedVizConfig(appConfigViz.getAll(), parseSavedVizConfig(raw))); // core/config.js
        appConfigViz.mutateAll(migrateVizConfig); // core/config.js
        appConfigViz.mutateAll((cfg) => {
            cfg.autoSwitchVisualGroupList = normalizeAutoSwitchGroupList(cfg.autoSwitchVisualGroupList, EFFECT_GROUPS); // core/auto-switch-visual.js
            cfg.autoSwitchVisualStyleList = normalizeAutoSwitchStyleList(cfg.autoSwitchVisualStyleList, MODES);
            // blob: URL chỉ sống 1 phiên — reset trước khi resolve lại nền media.
            cfg.bgImage = ''; cfg.bgVideo = ''; cfg.bgMediaThumb = '';
        });
        await this._loadAppBgMediaOnBoot();
        this.save();

        const cfg = appConfigViz.getAll();
        const modeIndex = resolveModeIndexFromConfig(cfg); // core/config.js
        appState.set('currentModeIndex', modeIndex);
        console.log(`writer: "workflowConfig.loadOnBoot", page: "config", content: "currentModeIndex = ${modeIndex}"`);
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
        // 3 toggle ẩn/hiện UI chrome màn Visualizer (core/visualizer-ui-visibility.js).
        setBottomPlayerVisible(cfg.bottomPlayerVisible !== false);
        setPlaylistButtonVisible(cfg.playlistButtonVisible !== false);
        setControlCenterButtonVisible(cfg.controlCenterButtonVisible !== false);
    },
};
