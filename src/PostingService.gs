/**
 * 投稿予定日時が到来し、承認ステータスがOKの行をThreads APIで投稿する巡回処理（要件②）。
 * 7:00〜24:00の間、数分おきに実行されることを想定している。
 */
var PostingService = {
  runPostingCycle: function () {
    var now = new Date();
    if (now.getHours() < 7) {
      return; // 0:00〜6:59は投稿対象外
    }

    var rows = SheetService.getQueueRows();
    rows.forEach(function (row) {
      if (row.postStatus !== Config.POST_STATUS.PENDING) return;
      if (!row.scheduledAt || row.scheduledAt > now) return;

      if (row.approvalStatus !== Config.APPROVAL_STATUS.OK) {
        SheetService.updateQueueRow(row.rowIndex, {
          postStatus: Config.POST_STATUS.SKIPPED_UNAPPROVED
        });
        Utils.logEvent('投稿', row.rowIndex, 'スキップ', '承認ステータスが' + row.approvalStatus);
        return;
      }

      postRow_(row);
    });
  }
};

function postRow_(row) {
  try {
    if (!row.body) {
      throw new Error('投稿本文が空です');
    }
    // 承認後にシートが編集され画像が許可フォルダ外に差し替えられているケースに備え、投稿直前にも再検証する
    DriveService.assertImagesAllowed([row.image1, row.image2, row.image3]);
    var postId = ThreadsService.publishPost(row.body, [row.image1, row.image2, row.image3]);
    SheetService.updateQueueRow(row.rowIndex, {
      postStatus: Config.POST_STATUS.DONE,
      postedAt: new Date(),
      threadsPostId: postId
    });
    Utils.logEvent('投稿', row.rowIndex, '成功', 'postId=' + postId);
  } catch (err) {
    SheetService.updateQueueRow(row.rowIndex, {
      postStatus: Config.POST_STATUS.ERROR,
      errorMessage: String(err)
    });
    Utils.logEvent('投稿', row.rowIndex, '失敗', String(err));
  }
}
