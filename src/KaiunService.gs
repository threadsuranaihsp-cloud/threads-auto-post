/**
 * 「開運日カレンダー」シート(A=日付, B=曜日, C=開運日(カンマ区切り、複数可))を参照し、
 * 指定した日付に該当する開運日名を判定するモジュール。
 *
 * 現時点ではSchedulerServiceへの組み込み(投稿タイプの判定・差し替え)は行わず、
 * 判定機能のみを提供する。
 */
var KaiunService = {
  // dateに一致する開運日名の配列を返す。該当する行がない、またはC列が空の場合は空配列を返す。
  findLuckyDaysForDate: function (date) {
    var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.KAIUN_CALENDAR);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (isSameDate_(row[0], date)) {
        return parseLuckyDayNames_(row[2]);
      }
    }
    return [];
  }
};

// カンマ区切りの開運日名を分割し、前後の空白を除去・空要素を除外した配列にする
function parseLuckyDayNames_(cellValue) {
  if (!cellValue) return [];
  return String(cellValue)
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s.length > 0;
    });
}

// aとbが同じ日付かどうかを判定する。
// A列の値が文字列("2026-09-01"形式)・Date型のどちらであっても比較できるよう、
// 両方をyyyy-MM-dd形式の文字列に正規化してから比較する。
function isSameDate_(a, b) {
  return formatDateKey_(a) === formatDateKey_(b);
}

function formatDateKey_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).trim();
}
