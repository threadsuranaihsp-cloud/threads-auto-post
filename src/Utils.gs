/**
 * 共通ユーティリティ（ログ出力、リトライ、日時計算）。
 */
var Utils = {
  // ログシートへの1件書き込み。detailにAPIの生レスポンス等が丸ごと入ることがあるため、
  // シートの1セルあたりの文字数上限(5万文字)を大きく下回る範囲に切り詰めてから書き込む
  // （異常に長いdetailが原因でappendRow自体が失敗し、失敗ログが記録されないことを防ぐため）。
  // また、Spreadsheetサービス側の一時的な接続エラーなどでappendRowが失敗した場合に備え、
  // 短い間隔で数回リトライしてから諦める。それでも失敗した場合はconsole.errorにのみ記録する
  // （ログ書き込みの失敗で本処理自体を止めたくないため、ここでは例外を再送出しない）。
  logEvent: function (type, rowNo, result, detail) {
    var safeDetail = String(detail || '');
    if (safeDetail.length > 2000) {
      safeDetail = safeDetail.slice(0, 2000) + '...(省略)';
    }
    try {
      Utils.withRetry(function () {
        var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.LOGS);
        sheet.appendRow([new Date(), type, rowNo, result, safeDetail]);
      }, 2, 300);
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
  },

  // 配列から要素を1つ均等ランダムに選ぶ
  pickRandom: function (array) {
    return array[Math.floor(Math.random() * array.length)];
  }
};
