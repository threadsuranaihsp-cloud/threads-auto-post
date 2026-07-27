/**
 * Threads APIの画像取得に使う公開Webアプリのエントリポイント。
 * 「許可されたDriveフォルダ配下のファイルIDのみ」を受け付けることで、
 * 誰でもアクセスできるURLであっても任意のDriveファイルを配信しない制限をかけている。
 *
 * デプロイ後、発行された/execのURLをスクリプトプロパティ IMAGE_PROXY_BASE_URL に設定すること。
 *
 * 注意: Apps ScriptのContentServiceは公式にはtext/json/xml等のみ対応で、
 * バイナリ(画像)を直接返すAPIは文書化されていない。ただしdoGetからBlobを直接returnすると
 * 画像として配信される挙動が広く利用されているため、デプロイ後に実際にブラウザで
 * 画像として表示されるか確認すること。
 */
function doGet(e) {
  try {
    var fileId = e.parameter.fileId;
    if (!fileId) {
      return ContentService.createTextOutput('fileId is required').setMimeType(ContentService.MimeType.TEXT);
    }

    var requiredToken = Config.getImageProxySharedToken();
    if (requiredToken && e.parameter.token !== requiredToken) {
      Utils.logEvent('画像プロキシ', '-', '拒否', 'トークン不一致 fileId=' + fileId);
      return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
    }

    if (!DriveService.isFileInAllowedFolder(fileId)) {
      Utils.logEvent('画像プロキシ', '-', '拒否', '許可フォルダ外のfileId: ' + fileId);
      return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
    }

    return DriveService.getImageBlob(fileId);
  } catch (err) {
    Utils.logEvent('画像プロキシ', '-', 'エラー', String(err));
    return ContentService.createTextOutput('error').setMimeType(ContentService.MimeType.TEXT);
  }
}
