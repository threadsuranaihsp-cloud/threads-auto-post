/**
 * 投稿タイプ別シートで承認済み(OK)になった行を、投稿キューシートへ転記する処理。
 * 1時間おきの巡回トリガーで実行することを想定している。
 *
 * 「翌日」の投稿は、Config.SLOT_MINUTESの10個の固定時刻スロットそれぞれに、
 * どの投稿タイプを割り当てるかを固定した1日パターン(Config.DAILY_PATTERN_WITH_KAIUN /
 * DAILY_PATTERN_WITHOUT_KAIUN)に従って埋めていく。どちらのパターンを使うかは、
 * 開運日カレンダーシートに翌日の日付が存在するかどうかで判定する（開運ポスト自体の
 * 承認状況は見ない。承認が間に合わなかった場合はKAIUNの枠だけが空いたままになり、
 * 他タイプへの振替は行わない＝既存の「埋め合わせない」方針を踏襲）。
 *
 * パターンを先頭のスロットから順に見ていき、各タイプについて「パターン内で何回目の
 * 登場か」を数える。その回数が既に投稿キューに存在する当日のそのタイプの件数
 * （countRowsByType_）未満であれば、前回までのサイクルで転記済みの枠とみなしてスキップする。
 * これによりスロットごとの時刻を直接比較しなくても、複数回の巡回実行にまたがって
 * 安全（冪等）に埋めていける。まだ埋まっていない枠に来たら、そのタイプの承認済み・
 * 未転記の候補（タロット・情弱・HSPあるある・数秘術はシート上から順に、開運のみ
 * 投稿予定日と日付が一致する1件）から未使用の1件を取り出し、そのスロットの固定時刻で
 * 転記する。候補が尽きている場合はその枠を今回は埋めず、次回サイクルに持ち越す
 * （他タイプで穴埋めしない）。
 */
var TransferService = {
  runTransferCycle: function () {
    var targetDate = Utils.addDays(new Date(), 1);
    var existingRows = getQueueRowsForDate_(targetDate);
    var countByType = countRowsByType_(existingRows);

    var hasKaiunTomorrow = KaiunService.listEntries().some(function (entry) {
      return isSameDate_(entry.date, targetDate);
    });
    var pattern = hasKaiunTomorrow ? Config.DAILY_PATTERN_WITH_KAIUN : Config.DAILY_PATTERN_WITHOUT_KAIUN;

    var occurrenceIndexByType = {};
    var candidatesByType = {};
    var transferredCount = 0;

    pattern.forEach(function (typeKey, slotIndex) {
      var occIndex = occurrenceIndexByType[typeKey] || 0;
      occurrenceIndexByType[typeKey] = occIndex + 1;

      var alreadyFilled = occIndex < (countByType[typeKey] || 0);
      if (alreadyFilled) return;

      if (!candidatesByType[typeKey]) {
        candidatesByType[typeKey] = typeKey === 'KAIUN'
          ? getApprovedUntransferredKaiunRowForDate_(targetDate)
          : getApprovedUntransferredRows_(Config.POST_TYPES[typeKey]);
      }

      var usedCountForType = occIndex - (countByType[typeKey] || 0);
      var candidateRow = candidatesByType[typeKey][usedCountForType];
      if (!candidateRow) return; // 供給不足。この枠は今回埋めず次回サイクルに持ち越す

      var scheduledAt = Utils.getSlotDateTime(targetDate, slotIndex);
      transferRow_(Config.POST_TYPES[typeKey], candidateRow, scheduledAt);
      transferredCount++;
    });

    Utils.logEvent(
      '転記', '-', '完了',
      Utils.formatJapaneseDate(targetDate) + '分の転記を実行(今回' + transferredCount + '件、' +
      'パターン=' + (hasKaiunTomorrow ? '開運あり' : '開運なし') + ')'
    );
  }
};

function getQueueRowsForDate_(date) {
  return SheetService.getQueueRows().filter(function (row) {
    return row.scheduledAt && isSameDate_(row.scheduledAt, date);
  });
}

function countRowsByType_(rows) {
  var counts = {};
  rows.forEach(function (row) {
    var typeKey = findTypeKeyByLabel_(row.postType);
    if (!typeKey) return;
    counts[typeKey] = (counts[typeKey] || 0) + 1;
  });
  return counts;
}

function findTypeKeyByLabel_(label) {
  return Object.keys(Config.POST_TYPES).filter(function (key) {
    return Config.POST_TYPES[key].label === label;
  })[0];
}

// 承認ステータス=OK かつ 転記ステータス=未転記の行を、シート上での並び順（上から順）で返す。
// 生成日時列は記録用として残すが、転記順の判定には使わない。
function getApprovedUntransferredRows_(typeConfig) {
  var sheet = SheetService.getSheetByName(typeConfig.sheetName);
  var rows = SheetService.readRows(sheet, typeConfig.col);

  return rows.filter(function (row) {
    var approvalStatus = row.approvalStatus || Config.APPROVAL_STATUS.PENDING;
    var transferStatus = row.transferStatus || Config.TRANSFER_STATUS.PENDING;
    return approvalStatus === Config.APPROVAL_STATUS.OK && transferStatus !== Config.TRANSFER_STATUS.DONE;
  });
}

// 開運ポストシートから、投稿予定日(targetDate)と「日付」列が一致する行を1件探し、
// 承認ステータス=OK かつ 転記ステータス=未転記であればその1件だけを配列で返す。
// 一致する行が無い、または一致してもOK・未転記でない場合は空配列を返す
// （その日は開運ポストなしとする。他タイプで埋め合わせない既存方針を踏襲）。
function getApprovedUntransferredKaiunRowForDate_(targetDate) {
  var typeConfig = Config.POST_TYPES.KAIUN;
  var sheet = SheetService.getSheetByName(typeConfig.sheetName);
  var rows = SheetService.readRows(sheet, typeConfig.col);

  var matched = rows.filter(function (row) {
    return row.date && isSameDate_(row.date, targetDate);
  })[0];
  if (!matched) return [];

  var approvalStatus = matched.approvalStatus || Config.APPROVAL_STATUS.PENDING;
  var transferStatus = matched.transferStatus || Config.TRANSFER_STATUS.PENDING;
  if (approvalStatus !== Config.APPROVAL_STATUS.OK || transferStatus === Config.TRANSFER_STATUS.DONE) {
    return [];
  }
  return [matched];
}

function transferRow_(typeConfig, candidateRow, scheduledAt) {
  var fields = {
    postType: typeConfig.label,
    scheduledAt: scheduledAt,
    body: candidateRow.body,
    replyBody1: candidateRow.replyBody1,
    replyBody2: candidateRow.replyBody2,
    replyBody3: candidateRow.replyBody3
  };
  if (typeConfig.hasImages) {
    fields.image1 = candidateRow.image1;
    fields.image2 = candidateRow.image2;
    fields.image3 = candidateRow.image3;
  }
  SheetService.appendQueueRow(fields);

  var sheet = SheetService.getSheetByName(typeConfig.sheetName);
  SheetService.writeRow(sheet, candidateRow.rowIndex, typeConfig.col, {
    transferStatus: Config.TRANSFER_STATUS.DONE
  });

  Utils.logEvent('転記', candidateRow.rowIndex, '成功', typeConfig.label + 'から転記');
}
