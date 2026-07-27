/**
 * Threadsの長期アクセストークンを期限切れ前に自動更新する処理（要件③）。
 * Threadsの長期トークンは発行から60日有効で、発行後24時間経過していれば更新可能。
 * 有効期限がTOKEN_REFRESH_THRESHOLD_DAYS以内になったら更新する。
 */
var TOKEN_REFRESH_THRESHOLD_DAYS_ = 7;

var TokenService = {
  checkAndRefreshToken: function () {
    var expiresAt = Config.getThreadsTokenExpiresAt();
    if (!expiresAt) {
      Utils.logEvent('トークン更新', '-', '警告', 'THREADS_TOKEN_EXPIRES_ATが未設定のため期限判定できません');
      return;
    }

    var daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft > TOKEN_REFRESH_THRESHOLD_DAYS_) {
      return;
    }

    try {
      var token = Config.getThreadsAccessToken();
      var url = 'https://graph.threads.net/refresh_access_token' +
        '?grant_type=th_refresh_token' +
        '&access_token=' + encodeURIComponent(token);
      var response = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
      var code = response.getResponseCode();
      var body = response.getContentText();
      if (code !== 200) {
        throw new Error('トークン更新APIエラー(' + code + '): ' + body);
      }

      var json = JSON.parse(body);
      if (!json.access_token) {
        throw new Error('レスポンスにaccess_tokenが含まれていません: ' + body);
      }

      var expiresInSeconds = json.expires_in || 60 * 24 * 60 * 60;
      var newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      Config.setThreadsAccessToken(json.access_token);
      Config.setThreadsTokenExpiresAt(newExpiresAt);

      recordTokenStatus_('成功', newExpiresAt, '');
      Utils.logEvent('トークン更新', '-', '成功', '新有効期限:' + newExpiresAt);
    } catch (err) {
      recordTokenStatus_('失敗', null, String(err));
      Utils.logEvent('トークン更新', '-', '失敗', String(err));
    }
  }
};

function recordTokenStatus_(result, newExpiresAt, detail) {
  var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.TOKEN_STATUS);
  sheet.appendRow([new Date(), result, newExpiresAt || '', detail || '']);
}
