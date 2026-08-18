/**
 * service/state.js — Lõi (core) quản lý STATE + CONFIG của toàn app. TÁI CẤU TRÚC 25/07/2026
 * (thảo luận đầy đủ trong phiên làm việc cùng ngày) — thay cho 1 file 924 dòng gộp hết
 * STATE_SCHEMA/buildDefaultState/CONST/AppState vào 1 chỗ, giờ tách theo domain:
 *
 *   - service/state/*.js (~18 file, "package") — CHỈ chứa STATE nghiệp vụ thuần (playlist,
 *     player, visualizer runtime/scenes, three-vortex/space, audio-engine, subtitle,
 *     shuffle-repeat, video-bg, video-player-mode, wakelock-tab, auto-switch, listen-stats,
 *     app-misc, file-manager, generic-drawer, video-editor). MỖI file tự gọi
 *     `AppState.definePackage(name, { schema, buildDefaults })` lúc nạp — CHỈ đăng ký, KHÔNG tự
 *     gộp vào STATE sống. STATE/SCHEMA thật sự chỉ được DỰNG khi 1 trang gọi
 *     `appState.registry(account, [...packageNames])` (xem service/state/record/*.js) — TRANG
 *     NÀO CHỈ NẠP <script> ĐÚNG các package file nó cần (vd video-editor.html chỉ 3 package, KHÔNG
 *     còn phải tải/dựng cả ~90 key như trước).
 *   - service/state.js (file này) — class AppState (cơ chế package/compose ở trên) VÀ class
 *     AppConfig (MỚI) — quản lý runtime của 3 "config" (vizConfig/slideshowConfig/readerConfig,
 *     xem core/config.js) theo domain riêng ('viz'/'slideshow'/'reader'), TÁCH HẲN khỏi STATE:
 *     CONFIG là giá trị người dùng tự chỉnh (Settings), có default/seed/restore riêng; STATE là
 *     dữ liệu vận hành (playlist, hot path visualizer...). 2 khái niệm KHÔNG gộp chung 1 class.
 *   - core/config.js — giữ 3 bản default (DEFAULT_VIZ_CONFIG/DEFAULT_SLIDESHOW_CONFIG/
 *     DEFAULT_READER_CONFIG) + toàn bộ hàm nghiệp vụ thuần (saveConfig/loadConfig/seed/restore) —
 *     KHÔNG tự giữ giá trị runtime, gọi vào AppConfig (file này) để đọc/ghi.
 *
 * KHÁC VỚI event/store.js (EventStore): EventStore chỉ quản lý "state context" — dữ liệu nhớ
 * giữa 2 message liên tiếp của 1 router trong /event/ (vd lastScanResults), VÀ (từ đợt này) toàn
 * bộ state nội bộ của 2 trang độc lập video-editor.html/subtitle-editor.html (clip/track/
 * timeline...) — 2 phạm vi KHÔNG chồng lấn, KHÔNG gộp chung với AppState/AppConfig ở đây.
 *
 * THIẾT KẾ AppState (không đổi so với bản gốc, TRỪ registry() — xem docstring tại chỗ):
 *   - MỌI đọc/ghi (kể cả hot path 60fps) ĐỀU BẮT BUỘC đi qua appState.get()/set()/mutate(),
 *     không có ngoại lệ, không có STATE.xxx trần nào lọt ra ngoài file này.
 *   - `appState.get(key)` — đọc; nhận cả `key` dạng ARRAY (gộp nhiều lần đọc vào 1 lệnh gọi).
 *   - `appState.set(key, value, options)` — gán TOÀN BỘ giá trị mới, validate theo schema (trừ
 *     skipCheck). Sai kiểu: console.warn + KHÔNG ghi + (notifyUI=true) alertModal.
 *   - `appState.mutate(key, mutatorFn, options)` — thao tác IN-PLACE lên collection đã có sẵn.
 *   - `options.skipCheck = true` (set/mutate) — CHỈ dùng cho hot path 60fps.
 *
 * THIẾT KẾ AppConfig (MỚI):
 *   - `AppConfig.defineDomain(name, { schema, defaults })` — core/config.js gọi 1 lần/domain lúc
 *     nạp (3 domain: 'viz', 'slideshow', 'reader'). CHỈ đăng ký, chưa seed giá trị runtime.
 *   - `appConfig.seed(domain)` — dựng giá trị runtime = deep-clone của `defaults` đã đăng ký (deep
 *     clone qua JSON — tránh HẲN lớp bug "spread nông giữ reference mảng/object con bị Object.freeze()"
 *     đã từng gặp với `manualEq`, xem changelog cũ — deep-clone generic áp dụng cho MỌI field lồng,
 *     không chỉ riêng field đó). Gọi 1 LẦN/domain lúc boot (xem event/workflow/app-boot.js), TRƯỚC
 *     khi loadConfig() merge lại từ localStorage.
 *   - `appConfig.access(domain)` — trả 1 accessor SCOPED cho đúng domain đó:
 *       • `.get(field)` / `.set(field, value, options)` / `.mutate(field, mutatorFn, options)` —
 *         thao tác TỪNG field, validate theo schema riêng của domain (fine-grained, khuyến khích
 *         dùng cho code MỚI viết từ đợt này).
 *       • `.getAll()` / `.setAll(value)` / `.mutateAll(mutatorFn)` — thao tác NGUYÊN object config
 *         (KHÔNG validate từng field con, chỉ giữ đúng hành vi `appState.get/set/mutate('vizConfig',
 *         ...)` CŨ) — cầu nối tương thích cho các file core/event ĐANG gọi kiểu cũ (171 chỗ/49
 *         file tại thời điểm tái cấu trúc — đã ĐỔI TÊN cơ giới sang `.getAll()`/`.setAll()`/
 *         `.mutateAll()` trong CÙNG đợt này, xem changelog — KHÔNG viết lại logic bên trong từng
 *         file, chỉ đổi đúng lớp truy cập).
 *       • `.restoreDefaults()` — trả domain về đúng bản `defaults` đã đăng ký (deep-clone lại).
 *
 * PHẢI nạp TRƯỚC: mọi file service/state/*.js (cần class AppState.definePackage đã tồn tại) và
 *   core/config.js (cần class AppConfig).
 * PHẢI nạp SAU: core/modal-choice-ui.js (alertModal — dùng cho option notifyUI).
 */

        /**
         * Kiểm tra giá trị `value` có khớp kiểu mong đợi `expectedType` không. Dùng chung cho CẢ
         * AppState LẪN AppConfig. Hỗ trợ: 'string' | 'number' | 'boolean' | 'array' | 'map' |
         * 'set' | 'object' | 'nullable-string' | 'nullable-number' | 'any'.
         */
        function matchesType(value, expectedType) {
            switch (expectedType) {
                case 'any': return true;
                case 'string': return typeof value === 'string';
                case 'number': return typeof value === 'number' && !Number.isNaN(value);
                case 'boolean': return typeof value === 'boolean';
                case 'array': return Array.isArray(value);
                case 'map': return value instanceof Map;
                case 'set': return value instanceof Set;
                case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
                case 'nullable-string': return value === null || typeof value === 'string';
                case 'nullable-number': return value === null || (typeof value === 'number' && !Number.isNaN(value));
                default: return true; // schema thiếu entry -> không chặn, coi như 'any'
            }
        }

        class AppState {
            constructor() {
                this._state = {};
                this._schema = {};
                this._currentAccount = null;
                this._composedPackages = [];
            }

            /**
             * Gọi bởi TỪNG file service/state/*.js lúc nạp — CHỈ đăng ký metadata (schema +
             * hàm dựng default), KHÔNG đụng gì tới STATE sống. `buildDefaults` là 1 HÀM (không
             * phải object) để mỗi lần compose() đều tạo Map/Set/array MỚI, không share reference
             * giữa các lần đăng ký.
             */
            static definePackage(name, { schema, buildDefaults }) {
                if (AppState._packages[name]) {
                    console.warn(`[AppState.definePackage] Package "${name}" đã được đăng ký trước đó — ghi đè.`);
                }
                AppState._packages[name] = { schema, buildDefaults };
            }

            /**
             * [SỬA 25/07/2026, đợt tái cấu trúc state — registry() giờ là COMPOSE BUILDER, KHÁC
             * bản gốc (permission gate thuần trên 1 STATE đã dựng sẵn đủ ~90 key bất kể trang nào
             * gọi)] Dựng THẬT `_schema`/`_state` của appState CHỈ từ đúng các package được liệt kê
             * — trang nào không cần domain nào thì domain đó KHÔNG tồn tại trong bộ nhớ của trang
             * đó (video-editor.html không còn phải build ~90 key/Map/Set/THREE placeholder chỉ để
             * dùng 2 key). Gọi ĐÚNG 1 LẦN, CÀNG SỚM CÀNG TỐT, SAU KHI mọi file service/state/*.js
             * cần dùng đã nạp xong (xem service/state/record/*.js — nạp SAU CÙNG các package file).
             *
             * KHÔNG TƯƠNG THÍCH NGƯỢC như bản cũ: nếu trang QUÊN gọi registry(), `_schema`/`_state`
             * vẫn rỗng `{}` — mọi get()/set()/mutate() sau đó console.warn + trả undefined/false
             * (fail SILENT, không throw — xem get()/set()/mutate() bên dưới), KHÔNG còn "mặc định
             * mở hết mọi key" như bản cũ.
             *
             * @param {string} account - tên trang, vd 'player' (index.html), 'videoEditor' (video-editor.html).
             * @param {string[]|'all'} packageNames - mảng tên package cần dùng, hoặc 'all' = TOÀN
             *   BỘ package đã đăng ký qua definePackage() tính tới thời điểm gọi (dùng cho index.html).
             */
            registry(account, packageNames) {
                const names = packageNames === 'all' ? Object.keys(AppState._packages) : packageNames;
                const mergedSchema = {};
                const mergedState = {};
                names.forEach((name) => {
                    const pkg = AppState._packages[name];
                    if (!pkg) {
                        console.warn(`[AppState.registry] Package "${name}" chưa được định nghĩa — kiểm tra lại đã nạp <script src="service/state/${name}.js"> TRƯỚC dòng registry() này chưa. Bỏ qua package này.`);
                        return;
                    }
                    Object.assign(mergedSchema, pkg.schema);
                    Object.assign(mergedState, pkg.buildDefaults());
                });
                this._schema = mergedSchema;
                this._state = mergedState;
                this._currentAccount = account;
                this._composedPackages = names;
                console.log(`[AppState.registry] account: "${account}", packages: ${JSON.stringify(names)}, tổng ${Object.keys(mergedSchema).length} key.`);
            }

            /** Đọc giá trị hiện tại của 1 KEY (string) HOẶC NHIỀU key cùng lúc (array). */
            get(key) {
                if (Array.isArray(key)) return this._getMany(key);
                if (!this._currentAccount) {
                    console.warn(`[AppState.get] Trang này CHƯA gọi appState.registry() — chưa package nào được compose. Đọc "${key}" trả undefined.`);
                    return undefined;
                }
                if (!(key in this._schema)) {
                    console.warn(`[AppState.get] Key "${key}" không thuộc package nào đã đăng ký cho account "${this._currentAccount}" (gõ sai tên, hay quên thêm package vào registry()?). Trả undefined.`);
                    return undefined;
                }
                return this._state[key];
            }

            /** Private: đọc NHIỀU key cùng lúc, dùng bởi get() khi nhận array. */
            _getMany(keys) {
                const result = {};
                keys.forEach((k) => { result[k] = this.get(k); });
                return result;
            }

            /** Snapshot toàn bộ state hiện tại (copy nông — dùng cho debug/log, KHÔNG dùng trong hot path). */
            getAll() {
                return { ...this._state };
            }

            /**
             * Ghi giá trị mới cho 1 key, CÓ validate kiểu theo schema (trừ khi skipCheck=true).
             * @param {string} key
             * @param {*} value
             * @param {Object} [options]
             * @param {boolean} [options.notifyUI=false]
             * @param {string} [options.message]
             * @param {boolean} [options.skipCheck=false]
             * @returns {boolean} true nếu ghi thành công.
             */
            set(key, value, options) {
                options = options || {};
                const notifyUI = options.notifyUI === true;
                const skipCheck = options.skipCheck === true;

                if (!this._currentAccount) {
                    console.warn(`[AppState.set] Trang này CHƯA gọi appState.registry() — chưa package nào được compose. KHÔNG ghi "${key}".`);
                    return false;
                }

                if (skipCheck) {
                    this._state[key] = value;
                    return true;
                }

                const expectedType = this._schema[key];

                if (expectedType === undefined) {
                    console.warn(`[AppState.set] Key "${key}" không tồn tại trong schema đã compose cho account "${this._currentAccount}" — kiểm tra lại tên key hoặc danh sách package ở registry().`);
                    if (notifyUI && typeof alertModal === 'function') {
                        alertModal(options.message || `Lỗi nội bộ: state key "${key}" không tồn tại trong schema.`, { title: 'Lỗi state' });
                    }
                    return false;
                }

                if (!matchesType(value, expectedType)) {
                    console.warn(
                        `[AppState.set] Sai kiểu dữ liệu cho key "${key}": mong đợi "${expectedType}", nhận "${typeof value}".`,
                        'Giá trị nhận được:', value,
                        '— GIỮ NGUYÊN giá trị cũ, không ghi đè.'
                    );
                    if (notifyUI && typeof alertModal === 'function') {
                        alertModal(
                            options.message || `Không thể cập nhật "${key}": dữ liệu không đúng định dạng.`,
                            { title: 'Lỗi dữ liệu' }
                        );
                    }
                    return false;
                }

                this._state[key] = value;
                return true;
            }

            /**
             * Thao tác IN-PLACE lên 1 collection (Map/Set/Array/Object) đã có sẵn trong STATE.
             * @param {string} key
             * @param {function(collection): void} mutatorFn
             * @param {Object} [options]
             * @param {boolean} [options.skipCheck=false]
             * @returns {boolean}
             */
            mutate(key, mutatorFn, options) {
                options = options || {};
                const skipCheck = options.skipCheck === true;

                if (!this._currentAccount) {
                    console.warn(`[AppState.mutate] Trang này CHƯA gọi appState.registry() — chưa package nào được compose. Bỏ qua mutate "${key}".`);
                    return false;
                }

                if (!(key in this._schema)) {
                    console.warn(`[AppState.mutate] Key "${key}" không tồn tại trong schema đã compose cho account "${this._currentAccount}" — không thể mutate.`);
                    return false;
                }

                const collection = this._state[key];
                mutatorFn(collection);

                if (skipCheck) return true;

                const expectedType = this._schema[key];
                if (expectedType !== undefined && !matchesType(collection, expectedType)) {
                    console.warn(
                        `[AppState.mutate] Sau khi mutate, key "${key}" không còn đúng kiểu "${expectedType}" — kiểm tra lại mutatorFn.`,
                        'Giá trị hiện tại:', collection
                    );
                    return false;
                }
                return true;
            }
        }

        AppState._packages = {}; // { [packageName]: { schema, buildDefaults } } — xem definePackage()

        /** Instance quản lý STATE — MỌI đường ghi từ file khác PHẢI đi qua appState.set()/mutate(). */
        const appState = new AppState();

        /**
         * class AppConfig (MỚI, 25/07/2026) — quản lý runtime của CONFIG (vizConfig/
         * slideshowConfig/readerConfig), TÁCH HẲN khỏi AppState/STATE. Xem docstring đầu file cho
         * lý do tách + thiết kế đầy đủ. Domain data (schema/defaults) do core/config.js đăng ký
         * qua `AppConfig.defineDomain()` — file này CHỈ chứa cơ chế, KHÔNG chứa giá trị default
         * thật của bất kỳ domain nào (đúng tinh thần "core/config.js giữ default, service/state.js
         * giữ runtime" đã chốt).
         */
        class AppConfig {
            static defineDomain(name, { schema, defaults }) {
                if (AppConfig._domains[name]) {
                    console.warn(`[AppConfig.defineDomain] Domain "${name}" đã được đăng ký trước đó — ghi đè.`);
                }
                AppConfig._domains[name] = { schema, defaults };
            }

            constructor() {
                this._state = {}; // { [domain]: { [field]: value } }
            }

            /**
             * Dựng giá trị runtime lần đầu cho 1 domain = deep-clone của `defaults` đã đăng ký.
             * Deep-clone qua JSON (KHÔNG spread nông) — tránh HẲN lớp bug "field con bị
             * Object.freeze() ở bản mẫu, spread nông chỉ copy reference, sửa vào field con coi
             * như KHÔNG ghi được gì" (xem changelog cũ, bug "chỉnh EQ/Volume không lưu" —
             * `manualEq`). An toàn cho CẢ 3 domain hiện tại vì defaults của chúng đều là dữ liệu
             * JSON thuần (string/number/boolean/object/array lồng nhau) — KHÔNG dùng cách này cho
             * dữ liệu không phải JSON thuần.
             */
            seed(domain) {
                const def = AppConfig._domains[domain];
                if (!def) {
                    console.warn(`[AppConfig.seed] Domain "${domain}" chưa được đăng ký qua defineDomain() — bỏ qua.`);
                    return;
                }
                this._state[domain] = JSON.parse(JSON.stringify(def.defaults));
            }

            /** Trả 1 accessor SCOPED cho đúng 1 domain — xem docstring đầu file cho từng phương thức. */
            access(domain) {
                const self = this;
                if (!(domain in this._state)) {
                    console.warn(`[AppConfig.access] Domain "${domain}" chưa seed() — mọi thao tác trên accessor này sẽ cảnh báo thêm cho tới khi seed() được gọi.`);
                }
                return {
                    get(field) {
                        const schema = (AppConfig._domains[domain] || {}).schema || {};
                        if (!(field in schema)) {
                            console.warn(`[AppConfig.access('${domain}').get] Field "${field}" không có trong schema domain "${domain}".`);
                            return undefined;
                        }
                        const store = self._state[domain];
                        if (!store) {
                            console.warn(`[AppConfig.access('${domain}').get] Domain "${domain}" chưa seed() — trả undefined.`);
                            return undefined;
                        }
                        return store[field];
                    },
                    set(field, value, options) {
                        options = options || {};
                        const store = self._state[domain];
                        if (!store) {
                            console.warn(`[AppConfig.access('${domain}').set] Domain "${domain}" chưa seed() — KHÔNG ghi.`);
                            return false;
                        }
                        const schema = (AppConfig._domains[domain] || {}).schema || {};
                        const expectedType = schema[field];
                        if (expectedType === undefined) {
                            console.warn(`[AppConfig.access('${domain}').set] Field "${field}" không tồn tại trong schema domain "${domain}".`);
                            return false;
                        }
                        if (!options.skipCheck && !matchesType(value, expectedType)) {
                            console.warn(`[AppConfig.access('${domain}').set] Sai kiểu dữ liệu cho field "${field}": mong đợi "${expectedType}", nhận "${typeof value}". GIỮ NGUYÊN giá trị cũ.`);
                            return false;
                        }
                        store[field] = value;
                        return true;
                    },
                    mutate(field, mutatorFn, options) {
                        options = options || {};
                        const store = self._state[domain];
                        if (!store) {
                            console.warn(`[AppConfig.access('${domain}').mutate] Domain "${domain}" chưa seed() — bỏ qua.`);
                            return false;
                        }
                        mutatorFn(store[field]);
                        if (options.skipCheck) return true;
                        const schema = (AppConfig._domains[domain] || {}).schema || {};
                        const expectedType = schema[field];
                        if (expectedType !== undefined && !matchesType(store[field], expectedType)) {
                            console.warn(`[AppConfig.access('${domain}').mutate] Sau khi mutate, field "${field}" không còn đúng kiểu "${expectedType}".`);
                            return false;
                        }
                        return true;
                    },
                    /** Đọc NGUYÊN object config — cầu nối tương thích cho code CŨ (appConfigViz.getAll() trước đây). */
                    getAll() {
                        return self._state[domain];
                    },
                    /** Gán NGUYÊN object config — cầu nối tương thích cho code CŨ (appConfigViz.setAll(...) trước đây). */
                    setAll(value) {
                        self._state[domain] = value;
                        return true;
                    },
                    /** Mutate NGUYÊN object config — cầu nối tương thích cho code CŨ (appConfigViz.mutateAll(...) trước đây). */
                    mutateAll(mutatorFn) {
                        const store = self._state[domain];
                        if (!store) {
                            console.warn(`[AppConfig.access('${domain}').mutateAll] Domain "${domain}" chưa seed() — bỏ qua.`);
                            return false;
                        }
                        mutatorFn(store);
                        return true;
                    },
                    /** Trả domain về đúng bản defaults đã đăng ký (deep-clone lại — xem seed()). */
                    restoreDefaults() {
                        self.seed(domain);
                    },
                };
            }
        }

        AppConfig._domains = {}; // { [domainName]: { schema, defaults } } — xem defineDomain()

        /** Instance quản lý CONFIG — seed()/access() gọi từ core/config.js. */
        const appConfig = new AppConfig();
