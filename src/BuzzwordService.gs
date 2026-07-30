/**
 * 「バズ構文」シート(A=No, B=バズ構文)を参照するモジュール。
 * このシートは運営側が随時バズ構文を追加・削除して管理する運用のため、
 * プロンプト内に固定でバズワードのリストを書く代わりに、このシートの内容を都度読み込む。
 *
 * ClaudeService.build{Joujaku,HspAlarm,Kaiun}Prompt_が、プロンプト組み立て時にこれを使う。
 */
var BuzzwordService = {
  // バズ構文シートのB列を上から順に読み込み、空でない値だけの配列にする。
  listAll: function () {
    var sheet = SheetService.getSheetByName(Config.SHEET_NAMES.BUZZWORDS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    return values
      .map(function (row) {
        return row[0];
      })
      .filter(function (v) {
        return v;
      });
  },

  // バズ構文を1件ランダムに選んで返す。シートが空の場合はエラーを投げる
  // （バズ構文は各投稿タイプで必須要素として扱っており、無言で欠落させると
  // 投稿の質が気づかれないまま下がるため、明示的に失敗させる）。
  pickRandom: function () {
    var all = this.listAll();
    if (all.length === 0) {
      throw new Error('「バズ構文」シートにデータがありません。B列に1件以上登録してください。');
    }
    return Utils.pickRandom(all);
  }
};
