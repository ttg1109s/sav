/**
 * service/state/app-panel-nav.js — Package STATE domain "app-panel-nav" (MỚI, đợt tái cấu trúc
 * App Panel bottom nav — Media/Folder/Photo/Storage/Game/Statis/Setting).
 *
 * `appPanelActiveTab` — tab đang active của bottom nav, dùng bởi core/app-panel-nav.js để tô sáng
 * đúng nút. Mặc định 'media' (Home Screen). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js, TRƯỚC service/state/record/index.js.
 */
        AppState.definePackage('app-panel-nav', {
            schema: {
                appPanelActiveTab: 'string', // 'media' | 'folder' | 'photo' | 'storage' | 'game' | 'statis' | 'setting'
            },
            buildDefaults() {
                return {
                    appPanelActiveTab: 'media',
                };
            },
        });
