/**
 * 共通ユーティリティ（ログ出力、リトライ、日時計算）。
 */
var Utils = {
  logEvent: function (type, rowNo, result, detail) {
    try {
      var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.LOGS);
      sheet.appendRow([new Date(), type, rowNo, result, detail || '']);
    } catch (e) {
      console.error('ログ書き込みに失敗しました: ' + e);
    }
  },

  // fn()を実行し、失敗したら指数バックオフで再試行する
  withRetry: function (fn, retries, baseDelayMs) {
    var attempt = 0;
    while (true) {
      try {
        return fn();
      } catch (err) {
        attempt++;
        if (attempt > retries) throw err;
        Utilities.sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  },

  addDays: function (date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  },

  // baseDateの0:00を基準に、Config.SLOT_MINUTES[slotIndex]分後の日時を返す
  // slotIndexの分数が1440(=24:00)の場合は自動的に翌日0:00になる
  getSlotDateTime: function (baseDate, slotIndex) {
    var minutes = Config.SLOT_MINUTES[slotIndex];
    var dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
    dt.setMinutes(dt.getMinutes() + minutes);
    return dt;
  },

  // dateを「7月6日（日）」形式の文字列にする。曜日はロケール依存を避けるため配列から算出する。
  formatJapaneseDate: function (date) {
    var weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return (date.getMonth() + 1) + '月' + date.getDate() + '日（' + weekdayNames[date.getDay()] + '）';
  }
};
