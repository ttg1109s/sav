/**
 * core/app-visibility.js — Core thuần cho ẩn/hiện app (event/workflow/app-visibility.js): gộp 1 lần mọi điều kiện phát nền
 * từ trạng thái Player + phần tử media do Workflow đọc sẵn.
 */

/**
 * @param {{isVideoPlayerMode: boolean, isPhotoPlayerMode: boolean, photoPlayerPaused: boolean, isAudioPaused: boolean,
 *   isVideoPaused: boolean, pausedVideoPlayer: boolean, pausedPhotoPlayer: boolean}} s - `pausedVideoPlayer`/`pausedPhotoPlayer`:
 *   Workflow đã tự dừng Video/Photo Player lúc vào chế độ nền.
 * @returns {{isSongPlaying: boolean, isAnyPlaying: boolean, shouldWakeContextOnShow: boolean, shouldPauseVideo: boolean,
 *   shouldPausePhoto: boolean, shouldRestoreVideo: boolean, shouldRestorePhoto: boolean}}
 */
function computeBackgroundPlaybackView({ isVideoPlayerMode, isPhotoPlayerMode, photoPlayerPaused, isAudioPaused, isVideoPaused, pausedVideoPlayer, pausedPhotoPlayer }) {
    const isMediaPlaying = isVideoPlayerMode ? !isVideoPaused : !isAudioPaused; // Song, hoặc video của Player Video
    const isPhotoRunning = isPhotoPlayerMode && !photoPlayerPaused;
    return {
        isSongPlaying: !isVideoPlayerMode && !isPhotoPlayerMode && !isAudioPaused,
        isAnyPlaying: isMediaPlaying || isPhotoRunning,
        shouldWakeContextOnShow: isMediaPlaying || (pausedVideoPlayer && isVideoPlayerMode),
        shouldPauseVideo: isVideoPlayerMode && !isVideoPaused,
        shouldPausePhoto: isPhotoRunning,
        shouldRestoreVideo: pausedVideoPlayer && isVideoPlayerMode && isVideoPaused,
        shouldRestorePhoto: pausedPhotoPlayer && isPhotoPlayerMode && photoPlayerPaused,
    };
}

/** Dòng log trạng thái AudioContext lúc app ẩn (Debug console). @param {string} contextState @param {boolean} isSongPlaying */
function formatKeepAliveContextLog(contextState, isSongPlaying) {
    const resumeNote = isSongPlaying && contextState !== 'running' ? ' -> resume()' : '';
    return `[workflowAppVisibility] (app ẩn) AudioContext state="${contextState}", Song ${isSongPlaying ? 'đang phát' : 'không phát'}${resumeNote}`;
}
