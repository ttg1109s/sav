/**
 * core/file-manager/folder.js — Folder nhạc (File Manager → Song → Folder), ver 12 "Multi Media".
 * Toàn bộ function MỚI ở file này viết từ đầu theo plan-v12-multimedia.md mục 4.b1 — tuân 4 rule
 * ở core-function-conventions.md.
 *
 * GHI CHÚ THIẾT KẾ (đọc trước khi sửa file này): các hàm CRUD thô định nghĩa ở core/db.js
 * (getFolderRecord/setFolderRecord/deleteFolderRecord/getAllFolderKeys,
 * getFolderSongMap/setFolderSongMap/deleteFolderSongMap) được coi là TẦNG DỮ LIỆU thuần (tương
 * đương idbKeyval.get/set/del dùng trực tiếp khắp project) — KHÔNG tính là "core khác" theo Rule 3
 * (core-function-conventions.md). Rule 3 nhắm tới việc 1 hàm core MỚI gọi 1 hàm core NGHIỆP VỤ
 * khác (có thể là workflow-shaped) mà không dùng kết quả — không nhắm tới việc gọi thẳng hàm CRUD
 * đọc/ghi 1 record IndexedDB. Nhờ vậy, các hàm dưới đây được phép tự đọc/ghi nhiều record trong
 * CÙNG 1 hàm nếu đó là ĐÚNG 1 tiến trình nghiệp vụ duy nhất (Rule 1) — ví dụ deleteFolder() đọc +
 * ghi nhiều record `songs` để dọn field `folder[folderId]` TRƯỚC khi xoá `folder_song`/`folders`,
 * vẫn là 1 tiến trình "xoá 1 folder", không phải nhiều tiến trình khác nhau.
 *
 * Schema (CHỐT — xem plan-v12-multimedia.md mục 4.b1):
 *   folders     : { [folderId]: { id, name } }
 *   folder_song : { [folderId]: { list: [songKey|null, ...], empty: number } } — tombstone null
 *                 khi gỡ bài khỏi folder, KHÔNG splice (giữ nguyên index/position).
 *   songs (field mới trên record có sẵn) : record.folder = { [folderId]: position (number) } —
 *                 sự TỒN TẠI của key folderId đã đủ biết "từng thêm vào folder này chưa"; trạng
 *                 thái đang-ở-trong hay đã-gỡ đọc thẳng từ folder_song[folderId].list[position].
 *   meta.deletedFolderIds : string[] — MỚI (03/07/2026, đợt 5). Danh sách folderId ĐÃ TỪNG bị xoá,
 *                 dùng để KHÔNG BAO GIỜ cấp lại (xem resolveFolderId()) — chặn bug tham chiếu cũ
 *                 (record.folder[folderId] còn sót trên bài đã tombstone-rồi-folder-bị-xoá) đọc
 *                 nhầm sang 1 folder MỚI trùng id.
 *
 * NẠP SAU: core/db.js (cần mọi hàm CRUD kể trên + slugify() dùng chung cho resolveFolderId),
 * event/virtual-machine-state.js (addSongsToFolder() dùng VirtualMachineState.run() để chọn đúng
 * hàm theo trạng thái thành viên — chỉ tham chiếu BÊN TRONG thân hàm, không chạy lúc parse, nên
 * an toàn dù event/virtual-machine-state.js nạp SAU file này trong index.html thật, giống cách
 * nhiều file core khác tham chiếu hàm định nghĩa muộn hơn).
 */

/**
 * Sinh folderId DUY NHẤT từ tên folder, tái dùng slugify() đã có ở db.js (cùng thuật toán với
 * resolveSongKey — KHÔNG trùng logic, chỉ đổi store kiểm tra tồn tại).
 *
 * SỬA 03/07/2026 (đợt 5) — THÊM điều kiện thứ 2: id ứng viên KHÔNG được nằm trong
 * `meta.deletedFolderIds` (danh sách id đã TỪNG bị xoá, dù hiện không còn record `folders` nào).
 * LÝ DO: `deleteFolder()` chỉ dọn được `record.folder[folderId]` cho bài ĐANG active trong folder
 * lúc xoá (không thể biết bài nào đã bị TOMBSTONE trước đó — folder_song.list đã null hoá, mất
 * dấu vết songKey). Nếu 1 folderId bị tái sử dụng (folder mới trùng tên -> trùng slug), bài từng
 * bị tombstone-rồi-folder-bị-xoá vẫn còn `record.folder[folderId] = vị trí cũ` sống sót trên chính
 * record của nó — đọc nhầm sang `folder_song` MỚI (rỗng) sẽ bị hiểu sai thành 'active' (vì
 * `list[vị trí cũ]` ở mảng rỗng là `undefined`, không phải `null`) -> addSongsToFolder() coi như
 * "đã có sẵn", bỏ qua, không thêm thật — đúng bug bác vừa phát hiện (TH1: báo thành công nhưng
 * folder vẫn rỗng). Cách sửa AN TOÀN NHẤT (không đổi schema `folders`/`folder_song` hiện có, không
 * cần quét toàn bộ thư viện bài — vẫn giữ deleteFolder() ở đúng O(số bài ĐANG có trong folder)):
 * KHÔNG BAO GIỜ cấp lại 1 id đã từng tồn tại, kể cả sau khi xoá — folder tạo lại cùng tên sẽ nhận
 * id khác (`...-2`, `...-3`...), y hệt cơ chế suffix có sẵn khi trùng tên với folder ĐANG SỐNG.
 * @param {string} name
 * @returns {Promise<string>}
 */
async function resolveFolderId(name) {
    const baseSlug = slugify(name) || 'folder'; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveFolderId] callTo: "slugify", request: "chuẩn hoá tên '${name}' thành slug làm base cho id"`);
    const deletedIds = (await getMeta('deletedFolderIds')) || []; // data layer (core/db.js)
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getFolderRecord(candidate);
        if (!existing && !deletedIds.includes(candidate)) return candidate;
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Tạo 1 folder mới rỗng. 1 tiến trình duy nhất: sinh id -> ghi metadata -> ghi mapping rỗng.
 * @param {string} name
 * @returns {Promise<string>} folderId vừa tạo
 */
async function createFolder(name) {
    const folderId = await resolveFolderId(name); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[createFolder] callTo: "resolveFolderId", request: "sinh id duy nhất từ tên '${name}'"`);
    await setFolderRecord(folderId, { id: folderId, name });
    await setFolderSongMap(folderId, { list: [], empty: 0 });
    return folderId;
}

/**
 * Đổi tên 1 folder đã có. Guard clause thuần (không tồn tại -> dừng sớm) — KHÔNG phải rẽ nhánh
 * tiến trình theo Rule 1.
 * @param {string} folderId
 * @param {string} newName
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function renameFolder(folderId, newName) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.name = newName;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Xoá 1 folder — thứ tự BẮT BUỘC theo plan mục 6 "Đã chốt": dọn field `folder[folderId]` khỏi
 * TỪNG bài đang có trong `list` TRƯỚC, xong mới xoá `folder_song`, cuối cùng xoá metadata `folders`.
 * @param {string} folderId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteFolder(folderId) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const songKeys = getFolderSongKeys(folderMap); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[deleteFolder] callTo: "getFolderSongKeys", request: "lấy danh sách bài đang thật trong folder ${folderId} để dọn field trước khi xoá"`);
    for (const songKey of songKeys) {
        const record = await getSongRecord(songKey);
        if (!record || !record.folder) continue; // guard: record đã bị xoá/hỏng dữ liệu ở nơi khác — bỏ qua, không chặn xoá folder
        delete record.folder[folderId];
        await setSongRecord(songKey, record);
    }

    await deleteFolderSongMap(folderId);
    await deleteFolderRecord(folderId);

    // MỚI (03/07/2026, đợt 5) — ghi nhận id này ĐÃ TỪNG DÙNG, vĩnh viễn không cấp lại (xem giải
    // thích đầy đủ ở resolveFolderId() phía trên).
    const deletedIds = (await getMeta('deletedFolderIds')) || [];
    if (!deletedIds.includes(folderId)) {
        deletedIds.push(folderId);
        await setMeta('deletedFolderIds', deletedIds);
    }

    return { status: 'ok' };
}

/**
 * Đặt lại TOÀN BỘ folder về rỗng (`list: [], empty: 0`) — dùng khi xoá sạch thư viện nhạc (mục 3,
 * CHỐT 03/07/2026): lúc đó mọi bài đã mất, mọi `folder_song` còn lại chỉ là tham chiếu rác tới
 * songKey không còn tồn tại. KHÔNG xoá record `folders` (giữ tên folder người dùng đã đặt) — chỉ
 * dọn rỗng nội dung. Rule 1: đơn tuyến (1 tiến trình "dọn sạch mọi folder"), lặp qua từng folder là
 * chi tiết triển khai, không phải rẽ nhánh nghiệp vụ khác nhau.
 * @returns {Promise<void>}
 */
async function clearAllFolderSongData() {
    const ids = await getAllFolderKeys(); // data layer (core/db.js)
    for (const id of ids) {
        await setFolderSongMap(id, { list: [], empty: 0 }); // data layer (core/db.js)
    }
}

/**
 * SỬA LẦN 2 (sau trao đổi Rule 3): bản trước tách `insertNewFolderMembership`/
 * `refillTombstonedFolderMembership` thành 2 hàm core riêng rồi GỌI chúng (void, không return) từ
 * bên trong `addSongsToFolder()` — dù đi qua VirtualMachineState, đây VẪN LÀ core gọi core void chỉ
 * để side-effect (Rule 3, "bất kể đơn giản, bất kể qua cơ chế chọn hàm nào"). VMState chỉ giải
 * quyết Rule 1 (CHỌN hàm nào chạy) — KHÔNG "miễn" Rule 3 (hàm được chọn có được phép void hay
 * không). Sửa đúng: 2 callback của VMState.run() dưới đây là CODE NỘI BỘ (closure) của chính
 * addSongsToFolder(), KHÔNG gọi ra hàm nào khác — không còn là "core gọi core" nữa nên Rule 3 không
 * áp dụng, đồng thời vẫn giữ đúng Rule 1 (điều phối qua VMState, không if/else tay).
 *
 * `getFolderMembershipState()` GIỮ LẠI là hàm core riêng vì nó CÓ return value và addSongsToFolder
 * DÙNG NGAY giá trị đó để chọn nhánh VMState — đúng tiêu chí "ĐƯỢC" của Rule 3 (kèm console.log
 * callTo bắt buộc, xem bên dưới).
 */

/**
 * Xác định 1 trong 3 trạng thái LOẠI TRỪ NHAU của "songKey đối với folderId" — pure, không I/O,
 * không mutate gì (chỉ đọc tham số truyền vào, KHÔNG phải appState.get()).
 * @returns {'new'|'tombstoned'|'active'}
 */
function getFolderMembershipState(record, folderMap, folderId) {
    if (!(folderId in record.folder)) return 'new';
    return folderMap.list[record.folder[folderId]] === null ? 'tombstoned' : 'active';
}

/** Thêm NHIỀU bài vào 1 folder — đúng thuật toán CHỐT ở plan mục 4.b1 "Thêm vào folder".
 * @param {string[]} songKeys
 * @param {string} folderId
 * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
 */
async function addSongsToFolder(songKeys, folderId) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound', addedCount: 0 };

    let addedCount = 0;
    for (const songKey of songKeys) {
        const record = await getSongRecord(songKey);
        if (!record) continue; // guard: bài không còn tồn tại — bỏ qua, không chặn cả lô (early-exit thuần, đúng guard clause)
        if (!record.folder) record.folder = {};

        const membershipState = getFolderMembershipState(record, folderMap, folderId); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
        console.log(`[addSongsToFolder] callTo: "getFolderMembershipState", request: "xác định trạng thái thành viên của ${songKey} trong folder ${folderId}"`);
        VirtualMachineState.run([
            // 2 callback dưới đây là CODE NỘI BỘ (đóng gói trong chính addSongsToFolder), KHÔNG
            // gọi ra hàm core nào khác -> không phải "core gọi core", Rule 3 không áp dụng.
            { state: membershipState, operation: '===', value: 'new', callback: () => {
                const position = folderMap.list.length;
                folderMap.list.push(songKey);
                record.folder[folderId] = position;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'tombstoned', callback: () => {
                const position = record.folder[folderId];
                folderMap.list[position] = songKey;
                folderMap.empty--;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'active', callback: () => {} }, // đã ở trong rồi — no-op có chủ đích (khai báo rõ, tránh cảnh báo "không rule nào khớp")
        ]);
        await setSongRecord(songKey, record);
    }
    await setFolderSongMap(folderId, folderMap);
    return { status: 'ok', addedCount };
}

/**
 * Gỡ cascade 1 bài khỏi TẤT CẢ folder nó từng thuộc — dùng khi bài bị XOÁ THẬT khỏi `songs`
 * (khác "gỡ khỏi 1 folder cụ thể", xem plan mục 6 "Đã chốt"). Nhận songRecord qua tham số (Rule 2
 * — không tự appState.get()), KHÔNG tự setSongRecord() lại record (nơi gọi đang xoá hẳn record đó
 * ngay sau, ghi lại vô nghĩa).
 * @param {Object} songRecord - record đầy đủ của bài SẮP bị xoá (đã getSongRecord() từ trước)
 */
async function removeSongFromAllFolders(songRecord) {
    if (!songRecord || !songRecord.folder) return;
    for (const folderId of Object.keys(songRecord.folder)) {
        const folderMap = await getFolderSongMap(folderId);
        if (!folderMap) continue; // guard: folder đã bị xoá trước đó, record chỉ còn sót field cũ
        const position = songRecord.folder[folderId];
        if (folderMap.list[position] != null) {
            folderMap.list[position] = null;
            folderMap.empty++;
            await setFolderSongMap(folderId, folderMap);
        }
    }
}

/**
 * Gỡ ĐÚNG 1 bài khỏi 1 folder cụ thể — CHỈ gỡ khỏi danh sách, KHÔNG xoá bài (khác hẳn "Xoá bài
 * khỏi Playlist", xem plan-v12-multimedia.md mục 6 "Đã chốt"). Đối xứng với addSongsToFolder() —
 * cùng thuật toán tombstone (`list[position] = null`, `empty++`) đã CHỐT ở mục 4.b1.
 * MỚI (Phase 2, CHỐT 03/07/2026) — dùng bởi icon X trong Folder Detail Drawer.
 * @param {string} songKey
 * @param {string} folderId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeSongFromFolder(songKey, folderId) {
    const record = await getSongRecord(songKey);
    if (!record || !record.folder || !(folderId in record.folder)) return { status: 'notFound' };

    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const position = record.folder[folderId];
    if (folderMap.list[position] !== null) {
        folderMap.list[position] = null;
        folderMap.empty++;
        await setFolderSongMap(folderId, folderMap);
    }
    return { status: 'ok' };
}

/**
 * Liệt kê toàn bộ folder hiện có (metadata), dùng cho picker/UI danh sách.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function listFolders() {
    const ids = await getAllFolderKeys();
    const records = await Promise.all(ids.map(id => getFolderRecord(id)));
    return records.filter(Boolean);
}

/** Pure — danh sách songKey ĐANG THẬT trong folder (lọc bỏ lỗ tombstone null). Không I/O. */
function getFolderSongKeys(folderMap) {
    return folderMap.list.filter(k => k != null);
}

/** Pure — check rỗng hoàn toàn O(1), không scan mảng. Không I/O. */
function isFolderEmpty(folderMap) {
    return folderMap.empty === folderMap.list.length;
}
