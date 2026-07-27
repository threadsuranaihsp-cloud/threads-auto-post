/**
 * Google Drive画像の取得と、許可フォルダ配下かどうかの検証を行うモジュール。
 * ここでの検証結果を画像プロキシ(ImageProxyWebApp.gs)と生成バッチの両方で利用する。
 */
var DriveService = {
  // 画像プロキシ経由で外部(Threads側)から取得可能なURLを組み立てる
  getImageProxyUrl: function (fileId) {
    var base = Config.getImageProxyBaseUrl();
    var token = Config.getImageProxySharedToken();
    var url = base + '?fileId=' + encodeURIComponent(fileId);
    if (token) {
      url += '&token=' + encodeURIComponent(token);
    }
    return url;
  },

  // fileIdが許可フォルダ(ALLOWED_DRIVE_FOLDER_ID)配下にあるかどうかを判定する。
  // 直下だけでなく、許可フォルダのサブフォルダ内にある場合も許可する。
  isFileInAllowedFolder: function (fileId) {
    var allowedFolderId = Config.getAllowedDriveFolderId();
    return isFileWithinFolder_(fileId, allowedFolderId);
  },

  getImageBlob: function (fileId) {
    return DriveApp.getFileById(fileId).getBlob();
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
