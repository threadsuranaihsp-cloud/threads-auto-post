/**
 * スクリプトプロパティ・シート名・列定義など、全体で共有する設定値をまとめるモジュール。
 * APIキーやアクセストークンはシートに書かず、必ずスクリプトプロパティに保存する。
 */
var Config = (function () {
  var PROP_KEYS = {
    CLAUDE_API_KEY: 'CLAUDE_API_KEY',
    CLAUDE_MODEL: 'CLAUDE_MODEL',
    THREADS_ACCESS_TOKEN: 'THREADS_ACCESS_TOKEN',
    THREADS_USER_ID: 'THREADS_USER_ID',
    THREADS_TOKEN_EXPIRES_AT: 'THREADS_TOKEN_EXPIRES_AT',
    ALLOWED_DRIVE_FOLDER_ID: 'ALLOWED_DRIVE_FOLDER_ID',
    TAROT_SHEET_ID: 'TAROT_SHEET_ID'
  };

  var SHEET_NAMES = {
    QUEUE: '投稿キュー',
    CONFIG: '設定',
    TOKEN_STATUS: 'トークン状態',
    LOGS: '実行ログ'
  };

  // 投稿キューシートの列番号（1始まり）
  var QUEUE_COL = {
    NO: 1,
    QUESTION: 2,
    IMAGE1: 3,
    IMAGE2: 4,
    IMAGE3: 5,
    SCHEDULED_AT: 6,
    BODY: 7,
    REPLY_BODY1: 8,
    REPLY_BODY2: 9,
    REPLY_BODY3: 10,
    GEN_STATUS: 11,
    APPROVAL_STATUS: 12,
    POST_STATUS: 13,
    POSTED_AT: 14,
    THREADS_POST_ID: 15,
    ERROR_MESSAGE: 16,
    UPDATED_AT: 17,
    CARD1: 18,
    CARD2: 19,
    CARD3: 20,
    REPLY_ID1: 21,
    REPLY_ID2: 22,
    REPLY_ID3: 23
  };

  var GEN_STATUS = { PENDING: '未生成', DONE: '生成済み', ERROR: '生成エラー' };
  var APPROVAL_STATUS = { PENDING: '未確認', OK: 'OK', NG: 'NG' };
  var POST_STATUS = {
    PENDING: '未投稿',
    REPLIES_PENDING: '本文投稿済み(リプライ未完了)',
    DONE: '投稿済み',
    SKIPPED_UNAPPROVED: 'スキップ(未承認)',
    ERROR: '投稿エラー'
  };

  // 7:00〜24:00(17時間=1020分)を9分割し、両端(7:00と24:00)を含む10スロット。
  // 1440分は24:00=翌日0:00を意味する。
  var SLOT_MINUTES = [420, 533, 647, 760, 873, 987, 1100, 1213, 1327, 1440];

  function getProp_(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
  }

  function setProp_(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }

  function requireProp_(key) {
    var value = getProp_(key);
    if (!value) {
      throw new Error('スクリプトプロパティ「' + key + '」が設定されていません');
    }
    return value;
  }

  return {
    PROP_KEYS: PROP_KEYS,
    SHEET_NAMES: SHEET_NAMES,
    QUEUE_COL: QUEUE_COL,
    GEN_STATUS: GEN_STATUS,
    APPROVAL_STATUS: APPROVAL_STATUS,
    POST_STATUS: POST_STATUS,
    SLOT_MINUTES: SLOT_MINUTES,

    getClaudeApiKey: function () {
      return requireProp_(PROP_KEYS.CLAUDE_API_KEY);
    },
    getClaudeModel: function () {
      return getProp_(PROP_KEYS.CLAUDE_MODEL) || 'claude-sonnet-5';
    },
    getThreadsAccessToken: function () {
      return requireProp_(PROP_KEYS.THREADS_ACCESS_TOKEN);
    },
    setThreadsAccessToken: function (value) {
      setProp_(PROP_KEYS.THREADS_ACCESS_TOKEN, value);
    },
    getThreadsUserId: function () {
      return requireProp_(PROP_KEYS.THREADS_USER_ID);
    },
    getThreadsTokenExpiresAt: function () {
      var value = getProp_(PROP_KEYS.THREADS_TOKEN_EXPIRES_AT);
      return value ? new Date(value) : null;
    },
    setThreadsTokenExpiresAt: function (date) {
      setProp_(PROP_KEYS.THREADS_TOKEN_EXPIRES_AT, date.toISOString());
    },
    // 投稿に使う画像として許可するDriveフォルダID（タロットカード画像フォルダを兼ねる）
    getAllowedDriveFolderId: function () {
      return requireProp_(PROP_KEYS.ALLOWED_DRIVE_FOLDER_ID);
    },
    // カード意味が書かれた別スプレッドシートのID
    getTarotSheetId: function () {
      return requireProp_(PROP_KEYS.TAROT_SHEET_ID);
    }
  };
})();
