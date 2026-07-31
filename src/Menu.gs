/**
 * スプレッドシートのメニューバーに独自メニュー「投稿システム」を追加する。
 *
 * onOpen()はGASのシンプルトリガーとして、スプレッドシートを開くたびに自動実行される
 * （installTriggersのようなScriptApp.newTriggerでのインストールは不要）。
 *
 * 各メニュー項目は、実際の処理を呼ぶ前後にtoast（開始）・alert（完了）を出す薄いラッパー
 * 関数を経由する。addItemは関数名を文字列で指定する仕様のため項目ごとに専用関数が必要になる。
 * transferCycle・postingCycle・insightsCollectionは時間主導トリガーからも自動実行されるが、
 * SpreadsheetApp.getUi()はトリガーによる自動実行時には呼び出せず例外になるため、それらの
 * 関数本体には手を入れず、ここでラップする形にしている。
 *
 * ラッパー関数名の末尾の"_"はGASの命名規則で、Apps Scriptエディタの実行関数選択の
 * ドロップダウンに表示されなくなる（既存の非公開ヘルパーと同じ規則）。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('投稿システム')
    .addItem('タロット生成', 'menuGenerateTarotBatch_')
    .addItem('情弱ポスト生成', 'menuGenerateJoujakuBatch_')
    .addItem('HSPあるあるポスト生成', 'menuGenerateHspAlarmBatch_')
    .addItem('開運ポスト生成', 'menuGenerateKaiunBatch_')
    .addSeparator()
    .addItem('転記を今すぐ実行', 'menuTransferCycle_')
    .addItem('投稿を今すぐ実行', 'menuPostingCycle_')
    .addItem('インサイト集計を今すぐ実行', 'menuInsightsCollection_')
    .addSeparator()
    .addItem('初期セットアップ', 'menuInitialSetup_')
    .addToUi();
}

// label: メニューに表示する処理名（toast・alertの文言に使う）, fn: 実行する処理（引数なし）
function runFromMenu_(label, fn) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(label + 'を実行中です。しばらくお待ちください…', '投稿システム', -1);
  fn();
  SpreadsheetApp.getUi().alert(label + 'が完了しました。');
}

function menuGenerateTarotBatch_() {
  runFromMenu_('タロット生成', generateTarotBatch);
}

function menuGenerateJoujakuBatch_() {
  runFromMenu_('情弱ポスト生成', generateJoujakuBatch);
}

function menuGenerateHspAlarmBatch_() {
  runFromMenu_('HSPあるあるポスト生成', generateHspAlarmBatch);
}

function menuGenerateKaiunBatch_() {
  runFromMenu_('開運ポスト生成', generateKaiunBatch);
}

function menuTransferCycle_() {
  runFromMenu_('転記', transferCycle);
}

function menuPostingCycle_() {
  runFromMenu_('投稿', postingCycle);
}

function menuInsightsCollection_() {
  runFromMenu_('インサイト集計', insightsCollection);
}

function menuInitialSetup_() {
  runFromMenu_('初期セットアップ', function () {
    initializeSpreadsheet();
    installTriggers();
  });
}
