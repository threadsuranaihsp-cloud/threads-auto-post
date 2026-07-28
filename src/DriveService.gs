/**
 * Google Drive画像のURL組み立てと、許可フォルダ配下かどうかの検証を行うモジュール。
 *
 * 注意: Google Apps ScriptのWebアプリ(doGet)はTextOutput/HtmlOutputしか返却できず、
 * 画像などのバイナリを直接配信することはできない（実機検証済み）。そのため、
 * Drive上のファイルを外部(Threads側)から取得可能にするには、Googleが画像配信用に
 * 提供している直リンク形式(lh3.googleusercontent.com)を利用する。
 * 「許可フォルダ内のみ」という制限は取得時点のゲートではなく、
 * SchedulerService(生成時)とPostingService(投稿直前)の2箇所で
 * isFileInAllowedFolderによる事前検証を行うことで実現している。
 */
var DriveService = {
  // Threads APIから取得可能な、実際の画像バイナリを返す公開URLを組み立てる。
  // 対象ファイルはDrive上で「リンクを知っている人」に共有しておく必要がある。
  getPublicImageUrl: function (fileId) {
    return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId);
  },

  // fileIdが許可フォルダ(ALLOWED_DRIVE_FOLDER_ID)配下にあるかどうかを判定する。
  // 直下だけでなく、許可フォルダのサブフォルダ内にある場合も許可する。
  isFileInAllowedFolder: function (fileId) {
    var allowedFolderId = Config.getAllowedDriveFolderId();
    return isFileWithinFolder_(fileId, allowedFolderId);
  },

  // imageFileIdsの中に許可フォルダ外のファイルIDがあれば例外を投げる（空要素はスキップ）
  assertImagesAllowed: function (imageFileIds) {
    (imageFileIds || []).forEach(function (fileId) {
      if (!fileId) return;
      if (!DriveService.isFileInAllowedFolder(fileId)) {
        throw new Error('画像ファイルID「' + fileId + '」は許可されたDriveフォルダ内にありません');
      }
    });
  }
};

function isFileWithinFolder_(fileId, allowedFolderId) {
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (e) {
    return false;
  }

  var visited = {};
  var queue = [];
  var parents = file.getParents();
  while (parents.hasNext()) {
    queue.push(parents.next());
  }

  var depth = 0;
  var maxDepth = 15; // 無限ループ防止のための探索上限
  while (queue.length > 0 && depth < maxDepth) {
    var next = [];
    for (var i = 0; i < queue.length; i++) {
      var folder = queue[i];
      var id = folder.getId();
      if (id === allowedFolderId) return true;
      if (visited[id]) continue;
      visited[id] = true;
      var folderParents = folder.getParents();
      while (folderParents.hasNext()) {
        next.push(folderParents.next());
      }
    }
    queue = next;
    depth++;
  }
  return false;
}
