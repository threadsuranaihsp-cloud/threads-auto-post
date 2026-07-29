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

  // 開運日カレンダーを参照し、翌日からdaysAhead日分のうち、開運日がありまだ生成していない
  // 日付だけをまとめて生成する（デフォルト30日）。GASの実行時間制限に引っかかる場合は、
  // 例えば generateKaiunBatch(14) を2回に分けて手動実行すればよい。
  generateKaiunBatch: function (daysAhead) {
    var days = daysAhead || 30;
    var typeConfig = Config.POST_TYPES.KAIUN;
    var sheet = SheetService.getSheetByName(typeConfig.sheetName);
    var existingDates = SheetService.readRows(sheet, typeConfig.col)
      .map(function (row) { return row.date; })
      .filter(function (d) { return d; });

    var successCount = 0;
    var skippedCount = 0;

    for (var i = 1; i <= days; i++) {
      var targetDate = Utils.addDays(new Date(), i);
      var alreadyGenerated = existingDates.some(function (d) {
        return isSameDate_(d, targetDate);
      });
      if (alreadyGenerated) {
        skippedCount++;
        continue;
      }

      var luckyDays = KaiunService.findLuckyDaysForDate(targetDate);
      if (luckyDays.length === 0) {
        skippedCount++;
        continue;
      }

      try {
        var body = ClaudeService.generateKaiunCaption(targetDate, luckyDays);
        SheetService.appendRow(sheet, typeConfig.col, {
          date: targetDate,
          luckyDays: luckyDays.join(','),
          body: body,
          generatedAt: new Date()
        });
        existingDates.push(targetDate); // 同一実行内での重複生成を防ぐ
        successCount++;
      } catch (err) {
        Utils.logEvent('生成', '-', '失敗', '開運(' + Utils.formatJapaneseDate(targetDate) + '): ' + String(err));
      }
    }

    Utils.logEvent(
      '生成', '-', '完了',
      '開運ポストを' + successCount + '件生成（対象' + days + '日分走査、スキップ' + skippedCount + '件）'
    );
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
