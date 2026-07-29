/**
 * 初回セットアップ用のヘルパー。Apps Scriptエディタから一度だけ手動実行する。
 */
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 投稿キューシート: スケジュール管理・投稿実行専用（生成は行わない）
  createSheetIfMissing_(ss, Config.SHEET_NAMES.QUEUE, [
    'No', '投稿タイプ', '投稿予定日時', '画像1(DriveファイルID)', '画像2(DriveファイルID)', '画像3(DriveファイルID)',
    '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    'リプライ①投稿ID', 'リプライ②投稿ID', 'リプライ③投稿ID',
    '投稿ステータス', '実投稿日時', 'Threads投稿ID', 'エラーメッセージ', '最終更新日時',
    'いいね数', '返信数', 'リポスト数', '表示回数', '集計ステータス'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.CONFIG, ['項目', '値', '備考']);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.TOKEN_STATUS, ['更新日時', '結果', '新有効期限', '詳細']);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.LOGS, ['日時', '処理種別', '対象行', '結果', '詳細']);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.KAIUN_CALENDAR, ['日付', '曜日', '開運日']);

  // 投稿タイプ別シート: 生成 → 内容確認 → 承認(OK) の運用を行うシート群
  createSheetIfMissing_(ss, Config.SHEET_NAMES.TAROT, [
    'No', '質問', '画像1(DriveファイルID)', '画像2(DriveファイルID)', '画像3(DriveファイルID)',
    'カード①', 'カード②', 'カード③',
    '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '承認ステータス', '転記ステータス', '生成日時'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.JOUJAKU, [
    'No', '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '承認ステータス', '転記ステータス', '生成日時'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.HSP_ALARM, [
    'No', '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '承認ステータス', '転記ステータス', '生成日時'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.KAIUN_POST, [
    'No', '日付', '開運日', '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '承認ステータス', '転記ステータス', '生成日時'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.NUMEROLOGY, [
    'No', 'テーマ', 'グループ', '投稿本文', 'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '承認ステータス', '転記ステータス', '生成日時'
  ]);

  Logger.log('シートの初期化が完了しました');
}

function createSheetIfMissing_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
