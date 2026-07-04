/**
 * patch-common.js — patch default-language keys (tiếng Anh), phần common (runtime rời rạc, core/* + playlist/*).
 *
 * Đây KHÔNG phải file JSON: project chạy qua file://, không thể fetch() file tĩnh, nên các
 * "patch" default-language được viết thành .js gán vào 1 biến global, để core/../lang.js (nay đã
 * dời sang /lang/lang.js) gom lại bằng Object.assign(). File này CHỈ chứa dữ liệu (key -> chuỗi
 * tiếng Anh), không chứa logic.
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html, khối nạp /lang/patch/*.js đứng trước /lang/lang.js).
 */
const LANG_PATCH_COMMON = {
    'common.unit.hour': 'h',
    'common.unit.minute': 'min',
    'common.unit.second': 'sec',
    'common.unknownArtist': 'Unknown artist',
    'common.untitled': '(Untitled)',
    'common.empty': '—',
    'common.unknownError': 'Unknown error',

    'common.listenTime.hourMinute': '{h}h {m}m',
    'common.listenTime.minuteSecond': '{m}m {s}s',
    'common.listenTime.secondOnly': '{s}s',
    'common.listenTime.zero': '0 sec',
    'common.durationLong.hourMinute': '{h}h {m}m',
    'common.durationLong.minuteOnly': '{m}m',

    'common.song.untitled': '(Untitled)',
    'common.song.unknownArtist': 'Unknown artist',

    'common.upload.failedList': 'Failed to load {n} file(s):\n\n{list}',
    'common.upload.shieldBusy': 'Another task is in progress, please wait and try adding music again.',
    'common.upload.genericError': 'An unexpected error occurred while loading music:\n\n{message}',
    'common.upload.folderEmpty': "Couldn't read any files from the selected folder. It may be empty, or the browser/device blocked folder access.",
    'common.upload.folderError': 'An error occurred while loading the music folder:\n\n{message}',
    'common.upload.fileError': 'An error occurred while loading the music file:\n\n{message}',
    'common.upload.loadingProgress': 'Loading {done} / {total}...',
    'common.upload.notFound': "Couldn't read this song, the data may have been deleted.",

    'common.playSong.error': 'Error playing this song:\n\n{message}',
    'common.playSong.notFound': "Couldn't read this song, the data may have been deleted.",
    'common.songEdit.notFound': "Couldn't read this song, the data may be corrupted.",
    'common.songEdit.defaultTitle': '(Untitled)',
    'common.songEdit.defaultArtist': 'Unknown artist',

    'common.subtitle.exportEmpty': 'No subtitles to export yet!',

    'common.export.notFound': "Couldn't read this song, the data may be corrupted.",
    'common.export.tagWriteFailed': "Couldn't write the tag to the file, exporting the original file instead.",

    'common.storage.zipLibMissing': 'The JSZip library failed to load (check your network connection to the CDN).',
    'common.storage.noSongsToDownload': 'No songs to download yet.',
    'common.storage.zipBuildError': "Couldn't build the zip file: {message}",
    'common.storage.zippingProgress': 'Packing zip file ({percent}%)...',
    'common.storage.zippingStart': 'Packing zip file (0%)...',
    'common.storage.deletingData': 'Deleting data...',
    'common.storage.downloadThenClearTitle': 'Download then delete',
    'common.storage.downloadThenClearConfirm': 'Download all music as a zip file, then DELETE all SONGS from this device? (Background image/video is kept.) The delete action cannot be undone once the download finishes.',
    'common.storage.downloadThenClearConfirmBtn': 'Download & delete',
    'common.storage.downloadThenClearDone': 'Zip file downloaded and all songs deleted. Background image/video is kept.',
    'common.storage.clearNoDownloadTitle': 'Delete all songs',
    'common.storage.clearNoDownloadConfirm': 'Delete all SONGS saved on this device? (Background image/video is kept.) This action CANNOT be undone.',
    'common.storage.clearNoDownloadConfirmBtn': 'Delete everything',
    'common.storage.clearNoDownloadDone': 'All songs deleted. Background image/video is kept.',
    'common.storage.scanning': 'Scanning data...',
    'common.storage.scanningProgress': 'Scanning {n} / {total}...',
    'common.storage.scanNoneFound': 'No broken files found — all data is valid.',
    'common.storage.scanFoundCount': 'Found {n} problematic file(s):',
    'common.storage.scanReasonBrokenBlob': 'No file data (empty blob)',
    'common.storage.scanReasonBadMime': 'Not a valid mp3 format (MIME: "{mime}")',
    'common.storage.scanReasonBadMimeEmpty': '(empty)',
    'common.storage.scanReasonNoDecode': "Browser couldn't read/decode the audio content",
    'common.storage.scanReasonKeptFromError': 'Playback error — chose to "Keep" for later',
    'common.storage.deleteBrokenTitle': 'Delete broken files',
    'common.storage.deleteBrokenConfirm': 'Delete the {n} broken file(s) found? This cannot be undone.',
    'common.storage.deleteBrokenConfirmBtn': 'Delete',
    'common.storage.deletingBroken': 'Deleting broken files...',
    'common.storage.deleteBrokenDone': 'Broken files deleted.',
    'common.playlist.cleaningUpPrevious': 'Cleaning up unfinished data from last session...',

    'common.loading.deleting': 'Deleting...',
    'common.loading.switchingSong': 'Switching song...',
    'common.loading.savingInfo': 'Saving info...',
    'common.loading.savingVideoBg': 'Saving background video...',
    'common.loading.savingImageBg': 'Saving background image...',
    'common.loading.exportingFile': 'Exporting file...',
    'common.loading.deletingVideoBg': 'Removing background video...',
    'common.loading.deletingImageBg': 'Removing background image...',
    'common.loading.generic': 'Processing...',

    'common.validate.unsupportedMime': 'Unsupported format ({mime}). Only {typeLabel} is accepted.',
    'common.validate.unsupportedMimeUnknown': 'unknown',
    'common.validate.unknownFormat': 'Could not determine the format of file "{filename}". Only {typeLabel} is accepted.',
    'common.validate.typeLabel.audio': 'music files (mp3, wav, ogg, m4a, aac, flac)',
    'common.validate.typeLabel.image': 'PNG, JPG, or WEBP images',
    'common.validate.typeLabel.video': 'MP4, WEBM, OGG, or MOV videos',

    'common.fatalError.alert': 'An unexpected error occurred ({context}). Please reload the page (F5).\n\nDetails: {message}',

    'common.appRecovery.restartTitle': 'Restart app',
    'common.appRecovery.restartBody': 'Restart the app? The player will reload from scratch. Your music, playlist, and saved settings will NOT be lost.',
    'common.appRecovery.restartConfirmBtn': 'Restart',
    'common.appRecovery.restoreDefaultsTitle': 'Restore default settings',
    'common.appRecovery.restoreDefaultsBody': 'Restore default settings? Colors, effects, EQ, and all other display customizations will return to their original defaults. Your uploaded music and playlist will NOT be deleted.',
    'common.appRecovery.restoreDefaultsConfirmBtn': 'Restore defaults',
    'common.cancel': 'Cancel',
    // MỚI (04/07/2026, mục 2 phản hồi Giang).
    'common.save': 'Save',
    'common.ok': 'OK',
    'common.btn.upload': 'Upload',

    'common.resumeModal.title': 'Resume playback?',
    'common.resumeModal.question': 'Do you want to resume playing <b>{title}</b>?',
    'common.resumeModal.btnNo': 'No',
    'common.resumeModal.btnResume': 'Resume',
    'common.resumeModal.btnRestart': 'Restart',
};
