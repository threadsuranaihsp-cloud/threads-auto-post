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
      // 各子コンテナ(画像)がFINISHEDになるのを待ってから、カルーセルの親コンテナ作成に渡す。
      // 待たずに渡すと「子アイテムのIDが無効/期限切れ」というエラーになることがある。
      var childrenIds = validImageIds.map(function (fileId) {
        var imageUrl = DriveService.getPublicImageUrl(fileId);
        var itemId = createCarouselItemContainer_(userId, accessToken, imageUrl);
        waitUntilFinished_(itemId, accessToken);
        return itemId;
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
  },

  // replyToId(投稿のThreads投稿ID)に対して、textのみのリプライを投稿し、そのIDを返す
  replyToPost: function (replyToId, text) {
    var accessToken = Config.getThreadsAccessToken();
    var userId = Config.getThreadsUserId();
    var creationId = createReplyContainer_(userId, accessToken, replyToId, text);
    waitUntilFinished_(creationId, accessToken);
    return publishContainer_(userId, accessToken, creationId);
  },

  // mediaId(投稿のThreads投稿ID)のインサイト(いいね/返信/リポスト/表示回数)を取得する。
  // アクセストークンに threads_manage_insights 権限が付与されている必要がある。
  getPostInsights: function (mediaId) {
    var accessToken = Config.getThreadsAccessToken();
    var url = THREADS_API_BASE_ + '/' + mediaId + '/insights' +
      '?metric=likes,replies,reposts,views' +
      '&access_token=' + encodeURIComponent(accessToken);
    var response = Utils.withRetry(function () {
      return UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    }, 3, 1000);
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code !== 200) {
      throw new Error('Threads APIエラー(' + code + '): ' + body);
    }
    return parseInsights_(JSON.parse(body));
  }
};

// /insightsエンドポイントの応答({"data":[{"name":"likes","values":[{"value":12}]},...]})から、
// 指定した4指標を{likes, replies, reposts, views}の数値オブジェクトに整形する。
// 該当指標がレスポンスに含まれない場合は0として扱う。
function parseInsights_(json) {
  var data = json.data || [];
  var result = { likes: 0, replies: 0, reposts: 0, views: 0 };
  data.forEach(function (metric) {
    if (!Object.prototype.hasOwnProperty.call(result, metric.name)) return;
    var value = metric.values && metric.values[0] && metric.values[0].value;
    result[metric.name] = typeof value === 'number' ? value : 0;
  });
  return result;
}

function createCarouselItemContainer_(userId, token, imageUrl) {
  return postAndGetId_('/' + userId + '/threads', token, {
    media_type: 'IMAGE',
    image_url: imageUrl,
    is_carousel_item: 'true'
  });
}

function createImageContainer_(userId, token, imageUrl, caption) {
  return postAndGetId_('/' + userId + '/threads', token, {
    media_type: 'IMAGE',
    image_url: imageUrl,
    text: caption
  });
}

function createCarouselContainer_(userId, token, childrenIds, caption) {
  return postAndGetId_('/' + userId + '/threads', token, {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    text: caption
  });
}

function createTextContainer_(userId, token, caption) {
  return postAndGetId_('/' + userId + '/threads', token, {
    media_type: 'TEXT',
    text: caption
  });
}

function createReplyContainer_(userId, token, replyToId, text) {
  return postAndGetId_('/' + userId + '/threads', token, {
    media_type: 'TEXT',
    text: text,
    reply_to_id: replyToId
  });
}

// POSTパラメータ(投稿本文やアクセストークンを含む)はURLクエリではなくリクエストボディで送る。
// 本文は最大500文字の日本語を想定しており、URLエンコードすると大きく膨らんでURL長の上限
// (UrlFetchApp: Limit Exceeded: URLFetch URL Length)に達するため。
function postAndGetId_(path, token, params) {
  var url = THREADS_API_BASE_ + path;
  var payload = Object.assign({}, params, { access_token: token });
  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  };
  var response = Utils.withRetry(function () {
    return UrlFetchApp.fetch(url, options);
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
// ここで渡すパラメータは短いため、URL長の問題を起こさずクエリ文字列のままで問題ない。
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
  return postAndGetId_('/' + userId + '/threads_publish', token, {
    creation_id: creationId
  });
}
