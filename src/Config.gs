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
    ALLOWED_DRIVE_FOLDER_ID: 'ALLOWED_DRIVE_FOLDER_ID'
  };

  var SHEET_NAMES = {
    QUEUE: '投稿キュー',
    CONFIG: '設定',
    TOKEN_STATUS: 'トークン状態',
    LOGS: '実行ログ',
    KAIUN_CALENDAR: '開運日カレンダー',
    TAROT: 'タロットポスト',
    JOUJAKU: '情弱ポスト',
    KAIUN_POST: '開運ポスト',
    HSP_ALARM: 'HSPあるあるポスト',
    NUMEROLOGY: '数秘術ポスト'
  };

  // 投稿キューシートの列番号（1始まり）。スケジュール管理・投稿実行専用で、生成には使わない。
  var QUEUE_COL = {
    NO: 1,
    POST_TYPE: 2,
    SCHEDULED_AT: 3,
    IMAGE1: 4,
    IMAGE2: 5,
    IMAGE3: 6,
    BODY: 7,
    REPLY_BODY1: 8,
    REPLY_BODY2: 9,
    REPLY_BODY3: 10,
    REPLY_ID1: 11,
    REPLY_ID2: 12,
    REPLY_ID3: 13,
    POST_STATUS: 14,
    POSTED_AT: 15,
    THREADS_POST_ID: 16,
    ERROR_MESSAGE: 17,
    UPDATED_AT: 18
  };

  // 投稿タイプ別シートの列番号（1始まり）。共通列(投稿本文/リプライ本文1〜3/承認ステータス/
  // 転記ステータス/生成日時)に加え、タイプごとの生成用入力列を持つ。
  var TAROT_SHEET_COL = {
    NO: 1,
    QUESTION: 2,
    IMAGE1: 3,
    IMAGE2: 4,
    IMAGE3: 5,
    CARD1: 6,
    CARD2: 7,
    CARD3: 8,
    BODY: 9,
    REPLY_BODY1: 10,
    REPLY_BODY2: 11,
    REPLY_BODY3: 12,
    APPROVAL_STATUS: 13,
    TRANSFER_STATUS: 14,
    GENERATED_AT: 15
  };

  var JOUJAKU_SHEET_COL = {
    NO: 1,
    BODY: 2,
    REPLY_BODY1: 3,
    REPLY_BODY2: 4,
    REPLY_BODY3: 5,
    APPROVAL_STATUS: 6,
    TRANSFER_STATUS: 7,
    GENERATED_AT: 8
  };

  var HSP_ALARM_SHEET_COL = {
    NO: 1,
    BODY: 2,
    REPLY_BODY1: 3,
    REPLY_BODY2: 4,
    REPLY_BODY3: 5,
    APPROVAL_STATUS: 6,
    TRANSFER_STATUS: 7,
    GENERATED_AT: 8
  };

  var KAIUN_POST_SHEET_COL = {
    NO: 1,
    DATE: 2,
    LUCKY_DAYS: 3,
    BODY: 4,
    REPLY_BODY1: 5,
    REPLY_BODY2: 6,
    REPLY_BODY3: 7,
    APPROVAL_STATUS: 8,
    TRANSFER_STATUS: 9,
    GENERATED_AT: 10
  };

  var NUMEROLOGY_SHEET_COL = {
    NO: 1,
    THEME: 2,
    GROUP: 3,
    BODY: 4,
    REPLY_BODY1: 5,
    REPLY_BODY2: 6,
    REPLY_BODY3: 7,
    APPROVAL_STATUS: 8,
    TRANSFER_STATUS: 9,
    GENERATED_AT: 10
  };

  var APPROVAL_STATUS = { PENDING: '未承認', OK: 'OK', NG: 'NG' };
  var TRANSFER_STATUS = { PENDING: '未転記', DONE: '転記済み' };
  var POST_STATUS = {
    PENDING: '未投稿',
    REPLIES_PENDING: '本文投稿済み(リプライ未完了)',
    DONE: '投稿済み',
    ERROR: '投稿エラー'
  };

  // 投稿タイプのレジストリ。TransferService/GenerationServiceはこれを介して
  // タイプごとのシート名・列マップ・1日あたりの必要件数・画像の有無を参照する。
  // quotaの合計はSLOT_MINUTES.length(10)と一致させること。
  var POST_TYPES = {
    TAROT: { key: 'TAROT', label: 'タロット', sheetName: SHEET_NAMES.TAROT, col: TAROT_SHEET_COL, quota: 3, hasImages: true },
    JOUJAKU: { key: 'JOUJAKU', label: '情弱', sheetName: SHEET_NAMES.JOUJAKU, col: JOUJAKU_SHEET_COL, quota: 4, hasImages: false },
    KAIUN: { key: 'KAIUN', label: '開運', sheetName: SHEET_NAMES.KAIUN_POST, col: KAIUN_POST_SHEET_COL, quota: 1, hasImages: false },
    HSP_ALARM: { key: 'HSP_ALARM', label: 'HSPあるある', sheetName: SHEET_NAMES.HSP_ALARM, col: HSP_ALARM_SHEET_COL, quota: 1, hasImages: false },
    NUMEROLOGY: { key: 'NUMEROLOGY', label: '数秘術', sheetName: SHEET_NAMES.NUMEROLOGY, col: NUMEROLOGY_SHEET_COL, quota: 1, hasImages: false }
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
    APPROVAL_STATUS: APPROVAL_STATUS,
    TRANSFER_STATUS: TRANSFER_STATUS,
    POST_STATUS: POST_STATUS,
    POST_TYPES: POST_TYPES,
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
    }
  };
})();
