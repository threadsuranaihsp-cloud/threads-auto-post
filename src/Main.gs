/**
 * トリガーから呼び出されるエントリポイント、および手動実行用の関数群。
 */

// --- トリガーから呼ばれる関数 ---

function transferCycle() {
  TransferService.runTransferCycle();
}

function postingCycle() {
  PostingService.runPostingCycle();
}

function tokenRefreshCheck() {
  TokenService.checkAndRefreshToken();
}

function insightsCollection() {
  InsightsService.runInsightsCollection();
}

// --- 手動実行用の関数（Apps Scriptエディタから実行する） ---

// タロットポストシートの「質問が入っていて投稿本文が空」の行をまとめて生成する
function generateTarotBatch() {
  GenerationService.generateTarotBatch();
}

// 情弱ポストシートに本文を10件まとめて生成する
function generateJoujakuBatch() {
  GenerationService.generateJoujakuBatch();
}

// HSPあるあるポストシートに本文を10件まとめて生成する
function generateHspAlarmBatch() {
  GenerationService.generateHspAlarmBatch();
}

// 開運日カレンダーシートに書かれている行を上から順に確認し、まだ生成していない開運ポストを
// 最大KAIUN_BATCH_MAX_件までまとめて生成する
function generateKaiunBatch() {
  GenerationService.generateKaiunBatch();
}
