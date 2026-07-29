/**
 * 投稿から2日後の朝に、いいね数・返信数・リポスト数・表示回数を1回だけ取得して記録する処理。
 * 毎朝8:00の巡回トリガーで実行することを想定している（Main.gsのinsightsCollection）。
 *
 * 対象行の条件:
 * - 投稿ステータス = 投稿済み または 本文投稿済み(リプライ未完了)（本体さえ投稿されていれば集計可能なため）
 * - 実投稿日時の「日付」+2日 ≤ 今日の日付（例: 7/1投稿 → 7/3以降が対象。時刻は無視し暦日で判定）
 * - 集計ステータス ≠ 集計済み
 *
 * 取得できた行は集計ステータスを「集計済み」に更新し、以降は対象から外れる（1回きりの集計）。
 * 取得に失敗した行は集計ステータスを更新せず、エラーメッセージ列にだけ記録するため、
 * 翌朝の巡回で自動的に再試行される。
 */
var InsightsService = {
  runInsightsCollection: function () {
    var today = new Date();
    var targets = SheetService.getQueueRows().filter(function (row) {
      return isReadyForInsights_(row, today);
    });

    targets.forEach(function (row) {
      try {
        var insights = ThreadsService.getPostInsights(row.threadsPostId);
        SheetService.updateQueueRow(row.rowIndex, {
          likes: insights.likes,
          replies: insights.replies,
          reposts: insights.reposts,
          views: insights.views,
          insightsStatus: Config.INSIGHTS_STATUS.DONE
        });
        Utils.logEvent(
          '集計', row.rowIndex, '成功',
          'likes=' + insights.likes + ' replies=' + insights.replies +
          ' reposts=' + insights.reposts + ' views=' + insights.views
        );
      } catch (err) {
        SheetService.updateQueueRow(row.rowIndex, {
          errorMessage: String(err)
        });
        Utils.logEvent('集計', row.rowIndex, '失敗', String(err));
      }
    });

    Utils.logEvent('集計', '-', '完了', targets.length + '件処理');
  }
};

function isReadyForInsights_(row, today) {
  if (!row.threadsPostId) return false;
  if (row.insightsStatus === Config.INSIGHTS_STATUS.DONE) return false;
  if (row.postStatus !== Config.POST_STATUS.DONE && row.postStatus !== Config.POST_STATUS.REPLIES_PENDING) return false;
  if (!row.postedAt) return false;

  var collectionDate = Utils.addDays(startOfDay_(row.postedAt), 2);
  return collectionDate.getTime() <= startOfDay_(today).getTime();
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
