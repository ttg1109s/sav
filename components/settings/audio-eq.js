/**
 * Component (sub-template): Settings Drawer — Section "Âm thanh & Equalizer".
 * Tách từ js/components/settings-drawer.js (ver 8). Âm lượng tổng + chọn preset EQ + dải
 * tần số thủ công (10 thanh kéo, dựng bằng JS ở equalizer-settings.js).
 */
const TPL_SETTINGS_AUDIO_EQ = `

        <!-- SECTION: AUDIO EQ & VOLUME -->
        <div>
            <h3 class="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsAudioEq.sectionTitle">${t('settingsAudioEq.sectionTitle')}</h3>
            <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" /></svg> <span data-i18n="settingsAudioEq.volume.label">${t('settingsAudioEq.volume.label')}</span></span>
                        <span id="val-volume" class="text-xs text-sky-400 font-mono">100%</span>
                    </div>
                    <input type="range" id="setting-volume" min="0" max="100" step="1" value="100" class="setting-slider">
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div><div class="text-sm font-medium truncate" data-i18n="settingsAudioEq.mode.label">${t('settingsAudioEq.mode.label')}</div></div>
                    <select id="setting-eq" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                        <option value="flat" data-i18n="settingsAudioEq.mode.flat">${t('settingsAudioEq.mode.flat')}</option>
                        <option value="bass_boost" data-i18n="settingsAudioEq.mode.bassBoost">${t('settingsAudioEq.mode.bassBoost')}</option>
                        <option value="pop" data-i18n="settingsAudioEq.mode.pop">${t('settingsAudioEq.mode.pop')}</option>
                        <option value="rock" data-i18n="settingsAudioEq.mode.rock">${t('settingsAudioEq.mode.rock')}</option>
                        <option value="acoustic" data-i18n="settingsAudioEq.mode.acoustic">${t('settingsAudioEq.mode.acoustic')}</option>
                        <option value="electronic" data-i18n="settingsAudioEq.mode.electronic">${t('settingsAudioEq.mode.electronic')}</option>
                        <option value="manual" data-i18n="settingsAudioEq.mode.manual">${t('settingsAudioEq.mode.manual')}</option>
                    </select>
                </div>
                <div id="eq-manual-container" class="p-4 bg-black/20 flex flex-col gap-2 transition-all">
                    <span class="text-xs text-slate-400 text-center mb-1" data-i18n="settingsAudioEq.manualHeading">${t('settingsAudioEq.manualHeading')}</span>
                    <div class="flex justify-between items-end h-32 px-2" id="eq-sliders-wrapper">
                        <!-- Tạo bằng JS -->
                    </div>
                </div>
            </div>
        </div>
`;

