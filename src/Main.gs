/**
 * トリガーから呼び出されるエントリポイント。
 */
function dailyGenerationBatch() {
  SchedulerService.runDailyGenerationBatch();
}

function postingCycle() {
  PostingService.runPostingCycle();
}

function tokenRefreshCheck() {
  TokenService.checkAndRefreshToken();
}
