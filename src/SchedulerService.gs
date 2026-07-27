/**
 * 「翌日分の投稿を前日12:00に生成する」バッチ処理（要件①）。
 * 未スケジュールのテーマ行を最大10件取り出し、翌日の10スロットに割り当ててから
 * Claude APIで本文を生成し、承認待ち状態でスプレッドシートに書き戻す。
 */
var SchedulerService = {
  runDailyGenerationBatch: function () {
    var targetDate = Utils.addDays(new Date(), 1);
    var rows = SheetService.getQueueRows();
    var unscheduled = rows.filter(function (row) {
      return row.theme && !row.scheduledAt;
    });
    var toSchedule = unscheduled.slice(0, Config.SLOT_MINUTES.length);

    if (toSchedule.length < Config.SLOT_MINUTES.length) {
      Utils.logEvent(
        '生成バッチ',
        '-',
        '警告',
        'テーマ不足のため' + toSchedule.length + '件のみ割り当て（必要:' + Config.SLOT_MINUTES.length + '件）'
      );
    }

    toSchedule.forEach(function (row, i) {
      var scheduledAt = Utils.getSlotDateTime(targetDate, i);
      SheetService.updateQueueRow(row.rowIndex, {
        scheduledAt: scheduledAt,
        approvalStatus: Config.APPROVAL_STATUS.PENDING
      });
      generateAndFillCaption_(row.rowIndex, row.theme, row.image1, row.image2, row.image3);
    });

    Utils.logEvent('生成バッチ', '-', '完了', toSchedule.length + '件処理');
  }
};

function generateAndFillCaption_(rowIndex, theme, image1, image2, image3) {
  try {
    validateImages_(image1, image2, image3);
    var caption = ClaudeService.generateCaption(theme);
    SheetService.updateQueueRow(rowIndex, {
      body: caption,
      genStatus: Config.GEN_STATUS.DONE
    });
    Utils.logEvent('生成', rowIndex, '成功', theme);
  } catch (err) {
    SheetService.updateQueueRow(rowIndex, {
      genStatus: Config.GEN_STATUS.ERROR,
      errorMessage: String(err)
    });
    Utils.logEvent('生成', rowIndex, '失敗', String(err));
  }
}

// 投稿時になってから画像が許可フォルダ外だと判明するのを避けるため、生成時点で先に検証する
function validateImages_(image1, image2, image3) {
  [image1, image2, image3].forEach(function (fileId) {
    if (!fileId) return;
    if (!DriveService.isFileInAllowedFolder(fileId)) {
      throw new Error('画像ファイルID「' + fileId + '」は許可されたDriveフォルダ内にありません');
    }
  });
}
