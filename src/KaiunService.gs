/**
 * 「開運日カレンダー」シート(A=日付, B=曜日, C=開運日(カンマ区切り、複数可))を参照するモジュール。
 * このシートには運用側が「投稿したい開運日」だけを厳選して貼り付ける運用のため、
 * シートに書かれている行をそのまま読み込むだけでよく、任意の日付範囲を走査する必要はない。
 *
 * GenerationService.generateKaiunBatchが、開運ポストシートへの一括生成時にこれを使う。
 */
var KaiunService = {
  // 開運日カレンダーシートの2行目以降を上から順に読み込み、{date, luckyDays}の配列にする。
  // 日付(A列)が空の行は無視する。
  listEntries: function () {
    var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.KAIUN_CALENDAR);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    return values
      .filter(function (row) {
        return row[0];
      })
      .map(function (row) {
        return { date: row[0], luckyDays: parseLuckyDayNames_(row[2]) };
      });
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
