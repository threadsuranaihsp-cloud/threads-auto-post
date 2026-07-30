/**
 * 投稿タイプ別シートへの本文生成処理。手動実行を想定している（トリガーには紐付けない）。
 * 生成された内容は各シートに書き戻され、承認ステータスは初期値のまま(未承認)になる。
 * 投稿キューへの反映はTransferServiceが別途行う。
 */
var TAROT_FIXED_MESSAGE_ =
  '直感で3枚の中から好きなカードを選んでください🔮\n' +
  'コメント欄であなたに必要なメッセージをお届けしています。\n' +
  '見逃さないためにフォロー＆「💧」を置いて受け取り完了してね。';

// リプライ①②③の本文先頭に機械的に付与する固定見出し。AIには生成させず、コード側で連結する。
var TAROT_REPLY_HEADINGS_ = ['①を選んだ方\n\n', '②を選んだ方\n\n', '③を選んだ方\n\n'];

// 情弱ポスト・HSPあるあるポストのように、手動実行1回で一気に生成する件数
var FIXED_BATCH_COUNT_ = 10;

// 開運ポストで、手動実行1回で一気に生成する最大件数
var KAIUN_BATCH_MAX_ = 31;

var GenerationService = {
  // タロットポストシートの「質問が入っていて投稿本文が空」の行を対象に、
  // カード抽選・画像解決・リプライ本文生成・本体投稿文の組み立てをまとめて行う。
  generateTarotBatch: function () {
    var typeConfig = Config.POST_TYPES.TAROT;
    var sheet = SheetService.getSheetByName(typeConfig.sheetName);
    var targets = SheetService.readRows(sheet, typeConfig.col).filter(function (row) {
      return row.question && !row.body;
    });

    targets.forEach(function (row) {
      try {
        var draw = TarotService.prepareDraw();
        var cards = draw.cards;
        var replyBodies = ClaudeService.generateTarotCaptions(row.question, cards);

        SheetService.writeRow(sheet, row.rowIndex, typeConfig.col, {
          image1: draw.imageFileIds[0],
          image2: draw.imageFileIds[1],
          image3: draw.imageFileIds[2],
          card1: formatCardLabel_(cards[0]),
          card2: formatCardLabel_(cards[1]),
          card3: formatCardLabel_(cards[2]),
          body: buildTarotMainBody_(row.question),
          replyBody1: TAROT_REPLY_HEADINGS_[0] + replyBodies[0],
          replyBody2: TAROT_REPLY_HEADINGS_[1] + replyBodies[1],
          replyBody3: TAROT_REPLY_HEADINGS_[2] + replyBodies[2],
          generatedAt: new Date()
        });
        Utils.logEvent('生成', row.rowIndex, '成功', 'タロット: ' + row.question);
      } catch (err) {
        Utils.logEvent('生成', row.rowIndex, '失敗', 'タロット: ' + String(err));
      }
    });

    Utils.logEvent('生成', '-', '完了', 'タロット生成対象' + targets.length + '件処理');
  },

  // 情弱ポストシートに、Claude生成した本文を1回の実行で10件追加する
  generateJoujakuBatch: function () {
    generateFixedCountBatch_(Config.POST_TYPES.JOUJAKU, ClaudeService.generateJoujakuCaption);
  },

  // HSPあるあるポストシートに、Claude生成した本文を1回の実行で10件追加する
  generateHspAlarmBatch: function () {
    generateFixedCountBatch_(Config.POST_TYPES.HSP_ALARM, ClaudeService.generateHspAlarmCaption);
  },

  // 開運日カレンダーシートに書かれている行を上から順に確認し、まだ投稿文が生成されていない
  // 日付を最大KAIUN_BATCH_MAX_件まで処理する。カレンダーシートには運用側が「投稿したい
  // 開運日」だけを厳選して貼り付ける運用のため、任意の日付範囲を走査してスキップする処理は行わない。
  generateKaiunBatch: function () {
    var typeConfig = Config.POST_TYPES.KAIUN;
    var sheet = SheetService.getSheetByName(typeConfig.sheetName);
    var existingDates = SheetService.readRows(sheet, typeConfig.col)
      .map(function (row) { return row.date; })
      .filter(function (d) { return d; });

    var targets = KaiunService.listEntries()
      .filter(function (entry) {
        return !existingDates.some(function (d) {
          return isSameDate_(d, entry.date);
        });
      })
      .slice(0, KAIUN_BATCH_MAX_);

    var successCount = 0;

    targets.forEach(function (entry) {
      try {
        var body = ClaudeService.generateKaiunCaption(entry.date, entry.luckyDays);
        SheetService.appendRow(sheet, typeConfig.col, {
          date: entry.date,
          luckyDays: entry.luckyDays.join(','),
          body: body,
          generatedAt: new Date()
        });
        successCount++;
      } catch (err) {
        Utils.logEvent('生成', '-', '失敗', '開運(' + Utils.formatJapaneseDate(entry.date) + '): ' + String(err));
      }
    });

    Utils.logEvent('生成', '-', '完了', '開運ポストを' + successCount + '件生成');
  }
};

function generateFixedCountBatch_(typeConfig, generateFn) {
  var sheet = SheetService.getSheetByName(typeConfig.sheetName);
  var successCount = 0;

  for (var i = 0; i < FIXED_BATCH_COUNT_; i++) {
    try {
      var body = generateFn();
      SheetService.appendRow(sheet, typeConfig.col, { body: body, generatedAt: new Date() });
      successCount++;
    } catch (err) {
      Utils.logEvent('生成', '-', '失敗', typeConfig.label + ': ' + String(err));
    }
  }

  Utils.logEvent('生成', '-', '完了', typeConfig.label + 'を' + successCount + '/' + FIXED_BATCH_COUNT_ + '件生成');
}

function formatCardLabel_(card) {
  return card.name + '(' + card.orientation + ')';
}

function buildTarotMainBody_(question) {
  return '【' + question + '】\n' + TAROT_FIXED_MESSAGE_;
}
