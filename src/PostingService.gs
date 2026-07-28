/**
 * 投稿予定日時が到来した行を投稿する巡回処理（要件②）。
 * 7:00〜24:00の間、数分おきに実行されることを想定している。
 *
 * 対象行の判定は「投稿ステータス(postStatus)が完了(投稿済み)以外はすべて処理対象」に統一している。
 * 画像IDやリプライIDなど個別セルの空欄・非空欄で対象から除外することはしない
 * （エラー時に一部の値だけ書き込まれても、次回サイクルで正しく再試行できるようにするため）。
 * 各行の中でどこから再開するかは、postRow_内でthreadsPostId(本体投稿ID)の有無によって判断する。
 *
 * 1行につき「本体投稿(画像3枚+固定文言+質問文)」→「リプライ①②③」の順で投稿する。
 * リプライ①②③(リプライ本文①〜③列)は投稿種別を問わない汎用の仕組みで、
 * タロット投稿ではSchedulerServiceが生成本文を自動で書き込み、それ以外の投稿では
 * 運営が手動で入力する想定。①→②→③の順に中身をチェックし、空でないものだけ
 * 順番にリプライとして投稿する（空欄はエラーにせずスキップする）。
 * 本体投稿が成功した時点でpostStatusをREPLIES_PENDINGにして即座に保存するため、
 * リプライの途中で失敗しても、本体の再投稿や投稿済みリプライの重複投稿を起こさずに
 * 次回サイクルで未完了分だけ再開できる。
 */
var PostingService = {
  runPostingCycle: function () {
    var now = new Date();
    if (now.getHours() < 7) {
      return; // 0:00〜6:59は投稿対象外
    }

    var rows = SheetService.getQueueRows();
    rows.forEach(function (row) {
      if (row.postStatus === Config.POST_STATUS.DONE) return; // 完全に完了した行のみ除外
      if (!row.scheduledAt || row.scheduledAt > now) return;

      postRow_(row);
    });
  }
};

function postRow_(row) {
  var mainPostId = row.threadsPostId;

  if (!mainPostId) {
    if (row.approvalStatus !== Config.APPROVAL_STATUS.OK) {
      SheetService.updateQueueRow(row.rowIndex, {
        postStatus: Config.POST_STATUS.SKIPPED_UNAPPROVED
      });
      Utils.logEvent('投稿', row.rowIndex, 'スキップ', '承認ステータスが' + row.approvalStatus);
      return;
    }

    try {
      if (!row.body) {
        throw new Error('投稿本文が空です');
      }
      // 承認後にシートが編集され画像が許可フォルダ外に差し替えられているケースに備え、投稿直前にも再検証する
      DriveService.assertImagesAllowed([row.image1, row.image2, row.image3]);
      mainPostId = ThreadsService.publishPost(row.body, [row.image1, row.image2, row.image3]);
      SheetService.updateQueueRow(row.rowIndex, {
        postStatus: Config.POST_STATUS.REPLIES_PENDING,
        postedAt: new Date(),
        threadsPostId: mainPostId
      });
      Utils.logEvent('投稿', row.rowIndex, '本文投稿成功', 'postId=' + mainPostId);
    } catch (err) {
      SheetService.updateQueueRow(row.rowIndex, {
        postStatus: Config.POST_STATUS.ERROR,
        errorMessage: String(err)
      });
      Utils.logEvent('投稿', row.rowIndex, '本文投稿失敗', String(err));
      return;
    }
  }

  try {
    postReplyIfNeeded_(row, mainPostId, 1, row.replyBody1, row.replyId1);
    postReplyIfNeeded_(row, mainPostId, 2, row.replyBody2, row.replyId2);
    postReplyIfNeeded_(row, mainPostId, 3, row.replyBody3, row.replyId3);

    SheetService.updateQueueRow(row.rowIndex, {
      postStatus: Config.POST_STATUS.DONE
    });
    Utils.logEvent('投稿', row.rowIndex, '成功', 'postId=' + mainPostId);
  } catch (err) {
    // 本文と、ここまでのリプライは投稿済みのためpostStatusはREPLIES_PENDINGのまま維持し、
    // 次回サイクルで未完了のリプライだけ再試行させる
    SheetService.updateQueueRow(row.rowIndex, {
      errorMessage: String(err)
    });
    Utils.logEvent('投稿', row.rowIndex, 'リプライ投稿失敗', String(err));
  }
}

function postReplyIfNeeded_(row, mainPostId, index, replyBody, existingReplyId) {
  if (existingReplyId) return; // 既に投稿済みならスキップ(再実行時の重複投稿防止)
  if (!replyBody) return; // 未入力はエラーにせずスキップ(タロット以外の投稿で一部だけ使うケースに対応)
  var replyId = ThreadsService.replyToPost(mainPostId, replyBody);
  var field = {};
  field['replyId' + index] = replyId;
  SheetService.updateQueueRow(row.rowIndex, field);
  Utils.logEvent('投稿', row.rowIndex, 'リプライ' + index + '成功', 'replyId=' + replyId);
}
