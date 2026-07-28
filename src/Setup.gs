/**
 * 初回セットアップ用のヘルパー。Apps Scriptエディタから一度だけ手動実行する。
 */
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetIfMissing_(ss, Config.SHEET_NAMES.QUEUE, [
    'No', '質問', '画像1(DriveファイルID)', '画像2(DriveファイルID)', '画像3(DriveファイルID)',
    '投稿予定日時', '投稿本文(本体)',
    'リプライ本文①', 'リプライ本文②', 'リプライ本文③',
    '生成ステータス', '承認ステータス', '投稿ステータス',
    '実投稿日時', 'Threads投稿ID(本体)', 'エラーメッセージ', '最終更新日時',
    'カード①', 'カード②', 'カード③',
    'リプライ①投稿ID', 'リプライ②投稿ID', 'リプライ③投稿ID'
  ]);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.CONFIG, ['項目', '値', '備考']);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.TOKEN_STATUS, ['更新日時', '結果', '新有効期限', '詳細']);

  createSheetIfMissing_(ss, Config.SHEET_NAMES.LOGS, ['日時', '処理種別', '対象行', '結果', '詳細']);

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
