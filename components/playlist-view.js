/**
 * components/playlist-view.js — template màn Playlist (`TPL_PLAYLIST_VIEW`, components/app-mount.js chèn lúc khởi động) +
 * các hàm render nhỏ dùng lúc dựng item / modal Chi tiết. `#playlist-view` là 1 "trang" trong `#side-left-container`
 * (components/app-view-stack.js), nền ảnh dùng chung đặt ở container đó.
 */
const TPL_PLAYLIST_VIEW = `
    <div id="playlist-view" class="flex flex-col overflow-hidden">
        <div class="px-5 pt-4 pb-3 z-20 relative shrink-0" data-uitk="panelFlushBg glassTunable">
            <!-- Hàng 1: logo + cụm icon (Chọn nhiều, Thêm, Cài đặt, Khởi động lại). -->
            <div class="flex justify-between items-center gap-5 mb-3" data-uitk="textPrimary">
                <!-- Logo "Audivis": hover chuột thật / chạm -> bung "Audio Visualizer" (cụm savLogo bật/tắt .sav-logo-expanded, chuyển động là CSS — assets/css/misc.css). touch-action: manipulation chống WebKit hiểu nhầm double-tap thành zoom trang. -->
                <div id="sav-logo" class="block whitespace-nowrap shrink-0 select-none leading-none font-extrabold text-base" style="touch-action: manipulation;">Audi<span class="sav-logo-expand sav-logo-expand-1">o </span><span class="sav-logo-swap-out">v</span><span class="sav-logo-swap-in">V</span>is<span class="sav-logo-expand sav-logo-expand-2">ualizer</span></div>
                <div class="flex items-center gap-5 shrink-0">
                <button id="btn-toggle-selection" class="transition-colors" data-uitk="hoverAccentText" data-i18n-title="playlistView.selection.toggleTitle" title="${t('playlistView.selection.toggleTitle')}">
                    ${iconSvg('check-circle', 'h-6 w-6')}
                </button>
                <!-- Nút "Thêm" dùng chung 3 Nguồn — mở #upload-action-menu. -->
                <button id="btn-upload-audio" class="transition-colors" data-uitk="hoverAccentText" data-i18n-title="playlistView.btnUploadAudio.title" title="${t('playlistView.btnUploadAudio.title')}">
                    ${iconSvg('upload', 'h-6 w-6')}
                </button>
                <button id="btn-settings-playlist" class="transition-colors" data-uitk="hoverAccentText" data-i18n-title="playlistView.btnSettings.title" title="${t('playlistView.btnSettings.title')}">
                    ${iconSvg('cog', 'h-6 w-6')}
                </button>
                <!-- Khởi động lại app — id dùng chung với core/dom-refs.js (btnRestartApp) + event/listener/settings-misc.js. -->
                <button id="setting-restart-app" class="transition-colors" data-uitk="hoverAccentText" data-i18n-title="appSettings.resetApp.restartApp.label" title="${t('appSettings.resetApp.restartApp.label')}">
                    ${iconSvg('refresh', 'h-6 w-6')}
                </button>
                </div>
            </div>

            <!-- Hàng 2: ô tìm kiếm full ngang. -->
            <div class="mb-3">
                <!-- Khung tròn ở div ngoài (focus-within); kính lúp, badge folder, input, nút X xếp ngang trong cùng khung. -->
                <div class="relative flex items-center gap-2 w-full rounded-2xl pl-3.5 pr-3 py-2.5 transition-colors border" data-uitk="searchBoxSurface inputFocusWithinBorder">
                    ${iconSvg('search', 'h-4 w-4 pointer-events-none shrink-0', 'data-uitk="textMutedIcon"')}
                    <!-- Badge folder đang Scope — ẩn mặc định; hiện/đổi tên: applyActiveFolderBadge() (core/playlist/main.js). -->
                    <div id="playlist-active-folder-badge" class="hidden shrink-0 min-w-0">
                        <div class="inline-flex items-center gap-1 max-w-[110px] text-xs font-medium pl-2 pr-1 py-0.5 rounded-full" data-uitk="accentBadge">
                            <span id="playlist-active-folder-badge-name" class="truncate"></span>
                            <button id="playlist-active-folder-badge-close" class="w-3.5 h-3.5 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="accentBadgeHover" data-i18n-title="playlistView.activeFolderBadge.exit.title" title="${t('playlistView.activeFolderBadge.exit.title')}">
                                ${iconSvg('x', 'h-2.5 w-2.5')}
                            </button>
                        </div>
                    </div>
                    <input id="playlist-search-input" type="text" inputmode="search" autocomplete="off" data-i18n-placeholder="playlistView.search.placeholder" placeholder="${t('playlistView.search.placeholder')}" class="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] py-0" data-uitk="inputText inputPlaceholder">
                    <button id="playlist-search-clear" class="hidden shrink-0 transition-colors p-1" data-uitk="textMutedIcon hoverPrimaryText" data-i18n-title="playlistView.search.clear.title" title="${t('playlistView.search.clear.title')}">
                        ${iconSvg('x', 'h-4 w-4')}
                    </button>
                </div>
            </div>

            <!-- Hàng 3: Phát | Trộn bài (Sắp xếp / Kiểu xem nằm trong Settings). -->
            <div class="flex gap-3">
                <button id="btn-playlist-empty-play" class="flex-1 min-w-0 active:scale-95 transition-transform py-3 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[14px]" data-uitk="cardBg cardBorder cardHoverBg textPrimary" data-playing="false">
                    ${iconSvg('play-circle', 'h-5 w-5 shrink-0')}
                    <span id="btn-playlist-empty-play-label" data-i18n="playlistView.btnPlay">${t('playlistView.btnPlay')}</span>
                </button>
                <button id="btn-playlist-empty-shuffle" class="flex-1 min-w-0 active:scale-95 transition-transform py-3 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[14px] whitespace-nowrap" data-uitk="cardBg cardBorder cardHoverBg textPrimary">
                    ${iconSvg('switch-horizontal', 'h-5 w-5 shrink-0')}
                    <span data-i18n="playlistView.btnShuffleAll">${t('playlistView.btnShuffleAll')}</span>
                </button>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto z-10 w-full relative" data-uitk="panelFlushBg glassTunable">
            <div id="playlist-empty" class="hidden h-[60%] flex flex-col items-center justify-center gap-4" data-uitk="textSecondary">
                ${iconSvg('collection', 'h-16 w-16 opacity-50')}
                <p class="text-sm" data-i18n="playlistView.empty.noSongs">${t('playlistView.empty.noSongs')}</p>
            </div>
            <div id="playlist-search-empty" class="hidden h-[40%] flex flex-col items-center justify-center gap-3" data-uitk="textSecondary">
                ${iconSvg('search', 'h-12 w-12 opacity-50')}
                <p class="text-sm" data-i18n="playlistView.empty.noSearchResults">${t('playlistView.empty.noSearchResults')}</p>
            </div>
            <!-- Lớp "đang nạp danh sách": phủ vùng list lúc boot đọc IndexedDB (tránh nháy "Chưa có bài"), mờ dần khi list dựng xong — event/workflow/app-boot.js. -->
            <div id="playlist-loading-list" class="hidden absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 transition-opacity duration-300" style="opacity:0;" data-uitk="panelFlushBg textSecondary">
                <svg class="animate-spin h-10 w-10" data-uitk="accentTextSoft" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p id="playlist-loading-text" class="text-sm font-medium tracking-wide">${t('playlistView.loading.generic')}</p>
            </div>
            <div id="playlist-container" class="flex flex-col pb-32"></div>
        </div>

        <!-- Thanh hành động "chọn nhiều" — ẩn mặc định, hiện khi selectionMode=true (workflowPlaylist.toggleSelectionMode()). Trái: số lượng; phải: nút 3 chấm mở dropup. z-20: trên #playlist-container, dưới mọi modal. -->
        <div id="selection-action-bar" class="hidden absolute bottom-0 inset-x-0 z-20 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-2" data-uitk="modalCardBg dividerBorder">
            <span id="selection-count-label" class="text-sm font-semibold" data-uitk="textPrimary"></span>
            <button id="btn-selection-more" class="p-1.5 rounded-full transition-colors" data-uitk="cardHoverBg textPrimary" data-i18n-title="playlistView.selection.moreTitle" title="${t('playlistView.selection.moreTitle')}">
                ${iconSvg('dots-horizontal', 'h-6 w-6')}
            </button>
        </div>
    </div>

    <!-- Dropup hành động "chọn nhiều" — luôn mở phía trên #btn-selection-more (openSelectionMoreMenu(), core/playlist/selection.js); đóng bằng #song-action-overlay. -->
    <div id="selection-more-menu" class="hidden fixed z-[115] w-52 rounded-xl shadow-2xl overflow-hidden" data-uitk="modalCardBg modalCardBorder">
        <button data-menu-action="play" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors" data-uitk="cardHoverBg textPrimary">
            ${iconSvg('play-circle', 'h-4 w-4 shrink-0', 'data-uitk="accentTextSoft"')}
            <span data-i18n="playlistView.selection.btnPlay">${t('playlistView.selection.btnPlay')}</span>
        </button>
        <button data-menu-action="export" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('download', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:amber"')}
            <span data-i18n="playlistView.selection.btnExport">${t('playlistView.selection.btnExport')}</span>
        </button>
        <button data-menu-action="addToFolder" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('folder', 'h-4 w-4 shrink-0', 'data-uitk="successText"')}
            <span data-i18n="playlistView.selection.btnAddToFolder">${t('playlistView.selection.btnAddToFolder')}</span>
        </button>
        <button data-menu-action="delete" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="menuDestructiveItem dividerBorder">
            ${iconSvg('trash', 'h-4 w-4 shrink-0')}
            <span data-i18n="playlistView.selection.btnDelete">${t('playlistView.selection.btnDelete')}</span>
        </button>
        <!-- Chỉ hiện khi đang Scope 1 folder — gỡ khỏi riêng folder này, không đụng bản ghi thư viện. -->
        <button data-menu-action="removeFromFolder" class="hidden flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('folder-remove', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:amber"')}
            <span data-i18n="playlistView.selection.btnRemoveFromFolder">${t('playlistView.selection.btnRemoveFromFolder')}</span>
        </button>
    </div>

    <!-- Modal Chi tiết / Sửa thông tin (3 tab Chi tiết / Sửa / Ảnh bìa). Neo mép trên (items-start + pt-16) để đổi tab chỉ mép dưới di chuyển; overflow-y-auto cho màn thấp. -->
    <div id="song-edit-modal" class="fixed inset-0 z-[120] backdrop-blur-sm hidden flex items-start justify-center px-5 pt-16 pb-8 overflow-y-auto" data-uitk="overlayBg">
        <div class="rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" data-uitk="modalCardBg modalCardBorder">
            <div class="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b" data-uitk="dividerBorder">
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" data-uitk="accentIconBoxBg accentSoftBorder">
                    ${iconSvg('information-circle', 'h-4 w-4', 'data-uitk="accentIconBoxText"')}
                </div>
                <h3 class="text-base font-bold" data-uitk="modalTitleText" data-i18n="playlistView.songEdit.title">${t('playlistView.songEdit.title')}</h3>
            </div>

            <!-- Cả 3 nút giống nhau — aria-selected do setSongEditTab() (core/playlist/actions.js) đặt, kiểu chọn ở key theme segmentTabActive. -->
            <div class="flex gap-1 px-5 pt-4">
                <div class="flex w-full p-1 rounded-xl gap-1" role="tablist" data-uitk="cardBg cardBorder">
                    <button data-edit-tab="details" role="tab" aria-selected="false" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all" data-uitk="textSecondary segmentTabActive">
                        ${iconSvg('information-circle', 'h-3.5 w-3.5')}
                        <span data-i18n="playlistView.songEdit.tabDetails">${t('playlistView.songEdit.tabDetails')}</span>
                    </button>
                    <button data-edit-tab="fields" role="tab" aria-selected="false" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all" data-uitk="textSecondary segmentTabActive">
                        ${iconSvg('pencil', 'h-3.5 w-3.5')}
                        <span data-i18n="playlistView.songEdit.tabFields">${t('playlistView.songEdit.tabFields')}</span>
                    </button>
                    <button id="song-edit-tab-btn-cover" data-edit-tab="cover" role="tab" aria-selected="false" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all" data-uitk="textSecondary segmentTabActive">
                        ${iconSvg('photograph', 'h-3.5 w-3.5')}
                        <span data-i18n="playlistView.songEdit.tabCover">${t('playlistView.songEdit.tabCover')}</span>
                    </button>
                </div>
            </div>

            <!-- Tab 1 (mặc định): Chi tiết — chỉ đọc, nội dung do workflowPlaylist.openSongEditModal() điền (renderSongInfoRowHtml()). -->
            <div id="song-edit-tab-details" class="flex flex-col p-5"></div>

            <!-- Tab 2: Sửa — 3 nhóm loại trừ theo loại media (Song: title/artist/album; Video, Photo: tên hiển thị + album), toggleSongEditFieldGroups(). -->
            <div id="song-edit-tab-fields" class="hidden flex-col gap-3 p-5">
                <div id="song-edit-fields-song-group" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldTitle">${t('playlistView.songEdit.fieldTitle')}</label>
                        <div class="relative">
                            ${iconSvg('music-note', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-title" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldArtist">${t('playlistView.songEdit.fieldArtist')}</label>
                        <div class="relative">
                            ${iconSvg('user', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-artist" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldAlbum">${t('playlistView.songEdit.fieldAlbum')}</label>
                        <div class="relative">
                            ${iconSvg('album', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-album" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                </div>
                <div id="song-edit-fields-video-group" class="hidden flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldCustomName">${t('playlistView.songEdit.fieldCustomName')}</label>
                        <div class="relative">
                            ${iconSvg('music-note', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-custom-name" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldAlbum">${t('playlistView.songEdit.fieldAlbum')}</label>
                        <div class="relative">
                            ${iconSvg('album', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-video-album" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                </div>
                <!-- Nhóm Photo: tên hiển thị + album + thời lượng (nút mở time-picker — workflowPlaylist.openPhotoEditDurationPicker()). -->
                <div id="song-edit-fields-photo-group" class="hidden flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldCustomName">${t('playlistView.songEdit.fieldCustomName')}</label>
                        <div class="relative">
                            ${iconSvg('music-note', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-photo-name" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldAlbum">${t('playlistView.songEdit.fieldAlbum')}</label>
                        <div class="relative">
                            ${iconSvg('album', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <input type="text" id="song-edit-photo-album" class="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold uppercase tracking-wide ml-0.5" data-uitk="textSecondary" data-i18n="playlistView.songEdit.fieldDuration">${t('playlistView.songEdit.fieldDuration')}</label>
                        <button type="button" id="song-edit-photo-duration-btn" class="w-full flex items-center justify-between rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-colors relative text-left" data-uitk="inputBg inputBorder inputText">
                            ${iconSvg('clock', 'h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2', 'data-uitk="textMutedIcon"')}
                            <span id="song-edit-photo-duration-value">0:00</span>
                            ${iconSvg('chevron-right', 'h-3.5 w-3.5 shrink-0', 'data-uitk="textMutedIcon"')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Ảnh bìa — "Choose" xổ dropdown nổi Photo / Video thumbnail (workflowPlaylist.openCoverChooseMenu()), "Remove" cùng hàng. -->
            <div id="song-edit-tab-cover" class="hidden flex-col gap-4 p-5">
                <div class="flex items-center gap-4">
                    <div class="w-24 h-24 rounded-2xl overflow-hidden shrink-0 shadow-lg" data-uitk="cardBorder cardBg">
                        <img id="song-edit-cover-preview" src="" class="w-full h-full object-cover" data-i18n-title="playlistView.songEdit.coverAlt" alt="${t('playlistView.songEdit.coverAlt')}">
                    </div>
                    <div class="flex flex-col gap-2 flex-1 min-w-0">
                        <div class="flex gap-2">
                            <button id="song-edit-cover-choose" aria-haspopup="menu" class="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors shadow" data-uitk="btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent">
                                <span data-i18n="playlistView.songEdit.coverChoose">${t('playlistView.songEdit.coverChoose')}</span>
                                ${iconSvg('chevron-down', 'h-3.5 w-3.5 shrink-0')}
                            </button>
                            <button id="song-edit-cover-remove" class="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors" data-uitk="cardBg cardBorder destructiveText hoverDestructiveBg">
                                ${iconSvg('trash', 'h-4 w-4 shrink-0')}
                                <span data-i18n="playlistView.songEdit.coverRemove">${t('playlistView.songEdit.coverRemove')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-3 p-5 pt-2 border-t" data-uitk="dividerBorder">
                <button id="song-edit-cancel" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText" data-i18n="playlistView.songEdit.btnCancel">${t('playlistView.songEdit.btnCancel')}</button>
                <button id="song-edit-save" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors shadow" data-uitk="btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent" data-i18n="playlistView.songEdit.btnSave">${t('playlistView.songEdit.btnSave')}</button>
            </div>
        </div>
    </div>


    <!-- Menu nhỏ của nút "Thêm" (dùng chung 3 Nguồn): chọn file rời hoặc cả thư mục. Định vị fixed ngay dưới nút, đóng bằng #song-action-overlay. "accept" dưới đây là mặc định của Song, đổi theo Nguồn ở core/playlist/main.js::applyPlaylistSourceChrome(). 2 mục là <label> bọc thẳng <input type="file"> — vài trình duyệt/WebView (file://, Android WebView cũ) im lặng bỏ qua input.click() gọi bằng JS, chỉ click thật lên label/input mới chắc chạy. -->
    <div id="upload-action-menu" class="hidden fixed z-[115] w-52 rounded-xl shadow-2xl overflow-hidden" data-uitk="modalCardBg modalCardBorder">
        <label class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors cursor-pointer" data-uitk="cardHoverBg textPrimary">
            ${iconSvg('document-text', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:sky"')}
            <span data-i18n="playlistView.uploadMenu.pickFiles">${t('playlistView.uploadMenu.pickFiles')}</span>
            <input type="file" id="media-upload" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac" multiple class="hidden">
        </label>
        <label class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t cursor-pointer" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('folder', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:amber"')}
            <span data-i18n="playlistView.uploadMenu.pickFolder">${t('playlistView.uploadMenu.pickFolder')}</span>
            <input type="file" id="media-upload-folder" webkitdirectory directory multiple class="hidden">
        </label>
    </div>


    <!-- Menu 3 chấm dùng chung cho mọi mục — 1 phần tử duy nhất, JS định vị lại (fixed) dưới nút vừa bấm; mục nào hiện do openSongActionMenu() (core/playlist/actions.js). -->
    <div id="song-action-overlay" class="hidden fixed inset-0 z-[110]"></div>
    <div id="song-action-menu" class="hidden fixed z-[115] w-48 rounded-xl shadow-2xl overflow-hidden" data-uitk="modalCardBg modalCardBorder">
        <button id="song-menu-btn-edit" data-menu-action="edit" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors" data-uitk="cardHoverBg textPrimary">
            ${iconSvg('information-circle', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:emerald"')}
            <span data-i18n="playlistView.songMenu.edit">${t('playlistView.songMenu.edit')}</span>
        </button>
        <button id="song-menu-btn-edit-subtitles" data-menu-action="editSubtitles" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('translate', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:yellow"')}
            <span data-i18n="playlistView.songMenu.editSubtitles">${t('playlistView.songMenu.editSubtitles')}</span>
        </button>
        <button id="song-menu-btn-restore" data-menu-action="restore" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('upload', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:amber"')}
            <span data-i18n="playlistView.songMenu.export">${t('playlistView.songMenu.export')}</span>
        </button>
        <!-- Ẩn mặc định — chỉ hiện với Video. -->
        <button id="song-menu-btn-edit-video" data-menu-action="editVideoFile" class="hidden flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('crop', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:violet"')}
            <span data-i18n="playlistView.songMenu.editVideoFile">${t('playlistView.songMenu.editVideoFile')}</span>
        </button>
        <!-- Ẩn mặc định — chỉ hiện với Photo. -->
        <button id="song-menu-btn-edit-image" data-menu-action="editImage" class="hidden flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('photograph', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:violet"')}
            <span data-i18n="playlistView.songMenu.editImage">${t('playlistView.songMenu.editImage')}</span>
        </button>
        <button data-menu-action="addToFolder" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('folder', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:sky"')}
            <span data-i18n="playlistView.songMenu.addToFolder">${t('playlistView.songMenu.addToFolder')}</span>
        </button>
        <!-- Ẩn mặc định — chỉ hiện khi đang Scope 1 folder không Read-only; gỡ khỏi riêng folder này, không đụng bản ghi thư viện. -->
        <button id="song-menu-btn-remove-from-folder" data-menu-action="removeFromFolder" class="hidden flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="cardHoverBg textPrimary dividerBorder">
            ${iconSvg('folder-remove', 'h-4 w-4 shrink-0', 'data-uitk="iconHue:amber"')}
            <span data-i18n="playlistView.songMenu.removeFromFolder">${t('playlistView.songMenu.removeFromFolder')}</span>
        </button>
        <!-- Nhãn đổi theo loại mục (Xoá bài hát / video / ảnh). -->
        <button data-menu-action="delete" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors border-t" data-uitk="menuDestructiveItem dividerBorder">
            ${iconSvg('trash', 'h-4 w-4 shrink-0')}
            <span id="song-menu-delete-label" data-i18n="playlistView.songMenu.delete">${t('playlistView.songMenu.delete')}</span>
        </button>
    </div>

    <!-- Modal: bài hát lỗi lúc phát (decode thật thất bại) — Giữ lại (ẩn khỏi playlist, còn trong Quản lý lưu trữ) hay Xoá luôn. -->
    <div id="playback-error-modal" class="fixed inset-0 z-[125] backdrop-blur-sm hidden flex items-center justify-center px-5" data-uitk="overlayBg">
        <div class="rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4" data-uitk="modalCardBg modalCardBorder">
            <div class="flex items-center gap-2">
                ${iconSvg('exclamation', 'h-5 w-5 shrink-0', 'data-uitk="cautionText"')}
                <h3 class="text-base font-bold" data-uitk="cautionText" data-i18n="playlistView.playbackError.title">${t('playlistView.playbackError.title')}</h3>
            </div>
            <p id="playback-error-filename" class="text-sm break-all" data-uitk="modalBodyText"></p>
            <p class="text-xs" data-uitk="textSecondary" data-i18n="playlistView.playbackError.body">${t('playlistView.playbackError.body')}</p>
            <div class="flex gap-3 mt-1">
                <button id="playback-error-keep" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText" data-i18n="playlistView.playbackError.btnKeep">${t('playlistView.playbackError.btnKeep')}</button>
                <button id="playback-error-delete" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnDestructiveBg btnDestructiveHoverBg textOnAccent" data-i18n="playlistView.playbackError.btnDelete">${t('playlistView.playbackError.btnDelete')}</button>
            </div>
        </div>
    </div>
`;

// ===================== Template nhỏ dùng lúc render item =====================
// Hàm (gọi lúc render), không nội suy lúc nạp file; icon qua iconSvg() (core/ui-theme/icon-svg-ui.js).

/** Nút 3 chấm mỗi item playlist — event/workflow/playlist-render.js::buildSongNode(). Luôn hiện (không phụ thuộc hover —
 * cảm ứng không có hover thật). `onDarkBg` (Grid): nút nằm trong vòng tròn tối đè ảnh bìa -> icon sáng cố định; List: màu
 * icon theo key theme `iconBtnMuted`. */
function renderSongActionMenuButtonHtml(key, onDarkBg) {
    const colorCls = onDarkBg ? 'text-white/70 hover:text-white' : '';
    const themeKeyAttr = onDarkBg ? '' : ' data-uitk="iconBtnMuted"';
    return `<button data-action="menu" data-key="${key}" class="p-2 rounded-full transition-colors z-10 ${colorCls}"${themeKeyAttr} title="${t('playlistView.songMenu.title')}">
        ${iconSvg('dots-vertical', 'h-5 w-5')}
    </button>`;
}

/** Phần dùng chung của 2 bố cục node: thuộc tính src ảnh bìa (bìa thật gắn sau, lúc node lại gần khung nhìn), dòng 2
 * (nghệ sĩ · thời lượng), icon đang phát (sóng EQ khi đang chạy, chấm khi tạm dừng). Tên/nghệ sĩ escape.
 * @param {{title: string, artist: string, hasRealCover: boolean, isPlaying: boolean, isActuallyPlaying: boolean}} view @param {string} durationLabel */
function renderSongNodeParts(view, durationLabel) {
    const eqBarsHtml = `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] eq-1" data-uitk="eqBarBg"></div><div class="w-[3px] eq-2" data-uitk="eqBarBg"></div><div class="w-[3px] eq-3" data-uitk="eqBarBg"></div></div>`;
    const pausedDotHtml = `<div class="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.8)]" data-uitk="btnPrimaryPillBg"></div>`;
    return {
        title: escapeHtml(view.title),
        secondLineHtml: view.artist ? `${escapeHtml(view.artist)} <span class="opacity-50">·</span> ${durationLabel}` : durationLabel,
        coverSrcAttr: view.hasRealCover ? '' : `src="${DEFAULT_VINYL}"`,
        eqIconHtml: view.isActuallyPlaying ? eqBarsHtml : (view.isPlaying ? pausedDotHtml : ''),
    };
}

/**
 * 1 node Playlist bố cục Grid (phần tử gốc + nội dung) — core/playlist/node-ui.js::createSongNode() dựng.
 * `loading="lazy"` + `decoding="async"`: item đang bị `content-visibility: auto` bỏ qua hoặc ẩn vì Search không tải ảnh
 * bìa tới khi lại gần khung nhìn; decode không chặn main thread. `data-cover-pending="true"`: <img> chưa có src, chờ bìa
 * thật (event/listener/playlist.js theo dõi). Nút 3 chấm nằm trong vòng tròn tối đè ảnh bìa.
 * @param {{key: string, title: string, artist: string, hasRealCover: boolean, isPlaying: boolean, isActuallyPlaying: boolean}} view
 *   - computeSongNodeView() (core/playlist/render.js) @param {string} durationLabel
 */
function renderGridSongNodeHtml(view, durationLabel) {
    const p = renderSongNodeParts(view, durationLabel);
    return `<div data-key="${view.key}" data-cover-pending="${view.hasRealCover}" data-role="play-item" class="flex flex-col cursor-pointer active:scale-[0.98] transition-transform group relative w-full">
                <div class="w-full aspect-square relative mb-2.5">
                    <img ${p.coverSrcAttr} loading="lazy" decoding="async" class="w-full h-full rounded-2xl object-cover shadow-lg">
                    ${view.isPlaying ? `<div class="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">${p.eqIconHtml}</div>` : ''}
                    <div class="absolute top-2 right-2 flex bg-black/40 rounded-full">${renderSongActionMenuButtonHtml(view.key, true)}</div>
                </div>
                <h3 class="text-[15px] font-semibold leading-tight line-clamp-1 px-1" data-uitk="textPrimary">${p.title}</h3>
                <p class="text-[13px] font-medium line-clamp-1 px-1 mt-0.5" data-uitk="textSecondary">${p.secondLineHtml}</p></div>`;
}

/** 1 node Playlist bố cục List — `data-uitk="cardHoverBg rowPressBg"` (rê chuột / nhấn giữ); nền hàng đang chọn do
 * showSelectionIndicator() (core/playlist/selection.js) thêm/gỡ. @param {object} view - cùng shape renderGridSongNodeHtml()
 * @param {string} durationLabel */
function renderListSongNodeHtml(view, durationLabel) {
    const p = renderSongNodeParts(view, durationLabel);
    return `<div data-key="${view.key}" data-cover-pending="${view.hasRealCover}" data-uitk="cardHoverBg rowPressBg" data-role="play-item" class="flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer w-full group">
                <img ${p.coverSrcAttr} loading="lazy" decoding="async" class="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-md">
                <div class="flex-grow flex flex-col justify-center overflow-hidden gap-0.5">
                    <div class="flex items-center gap-2"><h3 class="text-[16px] leading-tight font-semibold truncate" data-uitk="${view.isPlaying ? 'accentText' : 'textPrimary'}">${p.title}</h3>${view.isPlaying ? p.eqIconHtml : ''}</div>
                    <p class="text-[13px] truncate font-medium" data-uitk="textSecondary">${p.secondLineHtml}</p>
                </div>
                <div class="flex">${renderSongActionMenuButtonHtml(view.key, false)}</div></div>`;
}

/** 1 dòng phẳng tab "Chi tiết" của song-edit-modal (icon tròn màu + nhãn + giá trị đã escape, viền mảnh dưới trừ dòng
 * cuối). `hue`: tên hue trong bảng `iconTone` (core/ui-theme/*.js); `iconName`: tên trong
 * assets/icon/icons.js. */
function renderSongInfoRowHtml(iconName, hue, label, value) {
    return `
        <div class="flex items-center gap-3 py-2.5 border-b last:border-b-0" data-uitk="dividerBorder">
            <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0" data-uitk="iconTone:${hue}">
                ${iconSvg(iconName, 'h-3.5 w-3.5')}
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-wide shrink-0 w-[88px]" data-uitk="textSecondary">${label}</span>
            <span class="text-sm text-right flex-1 break-all" data-uitk="textPrimary">${value}</span>
        </div>`;
}

/** Icon tab "Chi tiết" (tên trong assets/icon/icons.js). */
const SONG_INFO_ICON = {
    file: 'document-text', resolution: 'arrows-expand', album: 'album', playCount: 'music-notes',
    clock: 'clock', size: 'drive', title: 'music-note', artist: 'user',
};

/** Ô chữ tab "Chi tiết": dữ liệu từ file/người dùng (tag ID3, tên file, album) -> escape; rỗng -> nhãn "trống". */
function renderSongInfoTextValue(value) {
    return value ? escapeHtml(value) : t('playlistView.songInfo.empty');
}

/** "Rộng×Cao" hoặc nhãn "trống" khi thiếu kích thước. */
function renderSongInfoResolution(width, height) {
    return (width && height) ? `${width}×${height}` : t('playlistView.songInfo.empty');
}

/** Tab "Chi tiết" của Video. @param {{filename?: string, width?: number, height?: number, album?: string, playCount: number,
 * listenLabel: string, sizeLabel: string}} view - nhãn thời gian/dung lượng Workflow định dạng sẵn */
function renderVideoEditDetailsHtml(view) {
    return renderSongInfoRowHtml(SONG_INFO_ICON.file, 'sky', t('playlistView.songInfo.fieldFilename'), renderSongInfoTextValue(view.filename))
        + renderSongInfoRowHtml(SONG_INFO_ICON.resolution, 'emerald', t('playlistView.songInfo.fieldResolution'), renderSongInfoResolution(view.width, view.height))
        + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'fuchsia', t('playlistView.songInfo.fieldAlbum'), renderSongInfoTextValue(view.album))
        + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: view.playCount }))
        + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldViewDuration'), view.listenLabel)
        + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), view.sizeLabel);
}

/** Tab "Chi tiết" của Photo — như Video, thêm dòng thời lượng. @param {object} view - như renderVideoEditDetailsHtml() + `durationLabel` */
function renderPhotoEditDetailsHtml(view) {
    return renderSongInfoRowHtml(SONG_INFO_ICON.file, 'sky', t('playlistView.songInfo.fieldFilename'), renderSongInfoTextValue(view.filename))
        + renderSongInfoRowHtml(SONG_INFO_ICON.resolution, 'emerald', t('playlistView.songInfo.fieldResolution'), renderSongInfoResolution(view.width, view.height))
        + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'fuchsia', t('playlistView.songInfo.fieldAlbum'), renderSongInfoTextValue(view.album))
        + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'amber', t('playlistView.songInfo.fieldDuration'), view.durationLabel)
        + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: view.playCount }))
        + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldViewDuration'), view.listenLabel)
        + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), view.sizeLabel);
}

/** Tab "Chi tiết" của Song. @param {{title: string, artist: string, album: string, durationLabel: string, playCount: number,
 * listenLabel: string, sizeLabel: string}} view - tag ID3 thô (escape ở đây) */
function renderSongEditDetailsHtml(view) {
    return renderSongInfoRowHtml(SONG_INFO_ICON.title, 'sky', t('playlistView.songInfo.fieldTitle'), renderSongInfoTextValue(view.title))
        + renderSongInfoRowHtml(SONG_INFO_ICON.artist, 'violet', t('playlistView.songInfo.fieldArtist'), renderSongInfoTextValue(view.artist))
        + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'emerald', t('playlistView.songInfo.fieldAlbum'), renderSongInfoTextValue(view.album))
        + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'amber', t('playlistView.songInfo.fieldDuration'), view.durationLabel)
        + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: view.playCount }))
        + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldListened'), view.listenLabel)
        + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), view.sizeLabel);
}

/** `{list}` của `common.upload.failedList` — modal render HTML nên tên file + lý do đều escape.
 * @param {Array<{filename: string, reason: string}>} items */
function renderUploadFailedListHtml(items) {
    return items.map((x) => `${escapeHtml(x.filename)} — ${escapeHtml(x.reason)}`).join('\n\n');
}

/** `{names}` của `fileManager.video.uploadSkipped` (tên file escape). @param {string[]} names */
function renderUploadSkippedNamesHtml(names) {
    return names.map((name) => escapeHtml(name)).join(', ');
}

/** `{message}` của các modal lỗi upload (lỗi bất kỳ -> chữ, escape). @param {*} err */
function renderUploadErrorMessageHtml(err) {
    return escapeHtml(err && err.message ? err.message : err);
}

/** Vòng "đã chọn" có tick (chế độ chọn nhiều) — core/playlist/selection.js::showSelectionIndicator() chèn vào node.
 * @param {string} selectedClass - class nền + chữ theo theme (btnPrimaryPillBg + textOnAccent), Workflow tra sẵn */
function renderSelectionIndicatorHtml(selectedClass) {
    return `<div data-role="selection-indicator" class="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-transparent ${selectedClass}">${iconSvg('check', 'h-4 w-4')}</div>`;
}
