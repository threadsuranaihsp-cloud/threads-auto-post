/**
 * インストール型トリガーの作成。Apps Scriptエディタから一度だけ手動実行する。
 * 再実行すると、対象ハンドラの既存トリガーを削除してから再作成するため何度実行しても安全。
 */
function installTriggers() {
  removeProjectTriggers_(['transferCycle', 'postingCycle', 'tokenRefreshCheck', 'insightsCollection']);

  // 投稿タイプ別シートで承認済み(OK)になった行を投稿キューへ転記する（1時間おき）
  ScriptApp.newTrigger('transferCycle')
    .timeBased()
    .everyHours(1)
    .create();

  // 7:00〜24:00の投稿スロットを検知するため15分おきに巡回（時間外は関数内で早期リターン）
  ScriptApp.newTrigger('postingCycle')
    .timeBased()
    .everyMinutes(15)
    .create();

  // トークンの有効期限を毎日チェックし、期限が近ければ自動更新
  ScriptApp.newTrigger('tokenRefreshCheck')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();

  // 投稿から2日以上経った行のインサイト(いいね/返信/リポスト/表示回数)を毎朝集計
  ScriptApp.newTrigger('insightsCollection')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();

  Logger.log('トリガーを設定しました');
}

function removeProjectTriggers_(handlerNames) {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
