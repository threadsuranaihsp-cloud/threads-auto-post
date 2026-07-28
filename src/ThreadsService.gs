/**
 * Threads Graph APIへの投稿処理（画像コンテナ作成→カルーセル作成→公開）。
 * 画像URLはDriveService.getPublicImageUrlで生成する。呼び出し側(PostingService)で
 * DriveService.assertImagesAllowedによる許可フォルダ検証を済ませてから呼び出すこと。
 */
var THREADS_API_BASE_ = 'https://graph.threads.net/v1.0';

var ThreadsService = {
  // caption: 投稿本文, imageFileIds: 最大3件のDriveファイルID（空要素は無視）
  publishPost: function (caption, imageFileIds) {
    var accessToken = Config.getThreadsAccessToken();
    var userId = Config.getThreadsUserId();
    var validImageIds = (imageFileIds || []).filter(Boolean);

    var creationId;
    if (validImageIds.length >= 2) {
      var childrenIds = validImageIds.map(function (fileId) {
        var imageUrl = DriveService.getPublicImageUrl(fileId);
        return createCarouselItemContainer_(userId, accessToken, imageUrl);
      });
      creationId = createCarouselContainer_(userId, accessToken, childrenIds, caption);
    } else if (validImageIds.length === 1) {
      var imageUrl = DriveService.getPublicImageUrl(validImageIds[0]);
      creationId = createImageContainer_(userId, accessToken, imageUrl, caption);
    } else {
      creationId = createTextContainer_(userId, accessToken, caption);
    }

    waitUntilFinished_(creationId, accessToken);
    return publishContainer_(userId, accessToken, creationId);
  }
};

function createCarouselItemContainer_(userId, token, imageUrl) {
  var url = THREADS_API_BASE_ + '/' + userId + '/threads' +
    '?media_type=IMAGE' +
    '&image_url=' + encodeURIComponent(imageUrl) +
    '&is_carousel_item=true' +
    '&access_token=' + encodeURIComponent(token);
  return postAndGetId_(url);
}

function createImageContainer_(userId, token, imageUrl, caption) {
  var url = THREADS_API_BASE_ + '/' + userId + '/threads' +
    '?media_type=IMAGE' +
    '&image_url=' + encodeURIComponent(imageUrl) +
    '&text=' + encodeURIComponent(caption) +
    '&access_token=' + encodeURIComponent(token);
  return postAndGetId_(url);
}

function createCarouselContainer_(userId, token, childrenIds, caption) {
  var url = THREADS_API_BASE_ + '/' + userId + '/threads' +
    '?media_type=CAROUSEL' +
    '&children=' + encodeURIComponent(childrenIds.join(',')) +
    '&text=' + encodeURIComponent(caption) +
    '&access_token=' + encodeURIComponent(token);
  return postAndGetId_(url);
}

function createTextContainer_(userId, token, caption) {
  var url = THREADS_API_BASE_ + '/' + userId + '/threads' +
    '?media_type=TEXT' +
    '&text=' + encodeURIComponent(caption) +
    '&access_token=' + encodeURIComponent(token);
  return postAndGetId_(url);
}

function postAndGetId_(url) {
  var response = Utils.withRetry(function () {
    return UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  }, 3, 1000);
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) {
    throw new Error('Threads APIエラー(' + code + '): ' + body);
  }
  var json = JSON.parse(body);
  if (!json.id) {
    throw new Error('Threads APIレスポンスにidがありません: ' + body);
  }
  return json.id;
}

// メディアコンテナの処理完了(FINISHED)を待つ。最大 maxAttempts * waitMs 秒待機する。
function waitUntilFinished_(creationId, token) {
  var maxAttempts = 10;
  var waitMs = 2000;
  for (var i = 0; i < maxAttempts; i++) {
    var url = THREADS_API_BASE_ + '/' + creationId +
      '?fields=status,error_message&access_token=' + encodeURIComponent(token);
    var response = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());
    if (json.status === 'FINISHED') return;
    if (json.status === 'ERROR') {
      throw new Error('Threadsメディア処理エラー: ' + (json.error_message || JSON.stringify(json)));
    }
    Utilities.sleep(waitMs);
  }
  throw new Error('Threadsメディア処理がタイムアウトしました(creationId=' + creationId + ')');
}

function publishContainer_(userId, token, creationId) {
  var url = THREADS_API_BASE_ + '/' + userId + '/threads_publish' +
    '?creation_id=' + encodeURIComponent(creationId) +
    '&access_token=' + encodeURIComponent(token);
  return postAndGetId_(url);
}
