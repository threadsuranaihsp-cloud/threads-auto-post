/**
 * 「翌日分の投稿を前日12:00に生成する」バッチ処理（要件①）。
 * 未処理(投稿予定日時が未設定)の質問行を最大10件取り出し、翌日の10スロットに割り当ててから
 * タロットカードを抽選し、Claude APIでリプライ本文①②③を生成して、承認待ち状態で
 * スプレッドシートに書き戻す。
 */
var TAROT_FIXED_MESSAGE_ =
  '直感で3枚の中から好きなカードを選んでください🔮\n' +
  'コメント欄であなたに必要なメッセージをお届けしています。\n' +
  '見逃さないためにフォロー＆「💧」を置いて受け取り完了してね。';

// リプライ①②③の本文先頭に機械的に付与する固定見出し。AIには生成させず、コード側で連結する。
var TAROT_REPLY_HEADINGS_ = ['①を選んだ方\n\n', '②を選んだ方\n\n', '③を選んだ方\n\n'];

var SchedulerService = {
  runDailyGenerationBatch: function () {
    var targetDate = Utils.addDays(new Date(), 1);
    var rows = SheetService.getQueueRows();
    var unscheduled = rows.filter(function (row) {
      return row.question && !row.scheduledAt;
    });
    var toSchedule = unscheduled.slice(0, Config.SLOT_MINUTES.length);

    if (toSchedule.length < Config.SLOT_MINUTES.length) {
      Utils.logEvent(
        '生成バッチ',
        '-',
        '警告',
        '質問不足のため' + toSchedule.length + '件のみ割り当て（必要:' + Config.SLOT_MINUTES.length + '件）'
      );
    }

    toSchedule.forEach(function (row, i) {
      var scheduledAt = Utils.getSlotDateTime(targetDate, i);
      SheetService.updateQueueRow(row.rowIndex, {
        scheduledAt: scheduledAt,
        approvalStatus: Config.APPROVAL_STATUS.PENDING
      });
      generateTarotPost_(row.rowIndex, row.question);
    });

    Utils.logEvent('生成バッチ', '-', '完了', toSchedule.length + '件処理');
  }
};

function generateTarotPost_(rowIndex, question) {
  try {
    var draw = TarotService.prepareDraw();
    var cards = draw.cards;
    var replyBodies = ClaudeService.generateTarotCaptions(question, cards);
    var mainBody = buildMainPostBody_(question);

    SheetService.updateQueueRow(rowIndex, {
      image1: draw.imageFileIds[0],
      image2: draw.imageFileIds[1],
      image3: draw.imageFileIds[2],
      card1: formatCardLabel_(cards[0]),
      card2: formatCardLabel_(cards[1]),
      card3: formatCardLabel_(cards[2]),
      replyBody1: TAROT_REPLY_HEADINGS_[0] + replyBodies[0],
      replyBody2: TAROT_REPLY_HEADINGS_[1] + replyBodies[1],
      replyBody3: TAROT_REPLY_HEADINGS_[2] + replyBodies[2],
      body: mainBody,
      genStatus: Config.GEN_STATUS.DONE
    });
    Utils.logEvent('生成', rowIndex, '成功', question);
  } catch (err) {
    SheetService.updateQueueRow(rowIndex, {
      genStatus: Config.GEN_STATUS.ERROR,
      errorMessage: String(err)
    });
    Utils.logEvent('生成', rowIndex, '失敗', String(err));
  }
}

function formatCardLabel_(card) {
  return card.name + '(' + card.orientation + ')';
}

function buildMainPostBody_(question) {
  return '【' + question + '】\n' + TAROT_FIXED_MESSAGE_;
}
