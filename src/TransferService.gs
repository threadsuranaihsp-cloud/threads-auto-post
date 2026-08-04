/**
 * 投稿タイプ別シートで承認済み(OK)になった行を、投稿キューシートへ転記する処理。
 * 毎日3:00に1回実行することを想定している（日中の承認・確認作業とシートの自動更新が
 * 競合しないよう、作業のない深夜にまとめて実行する）。
 *
 * targetDateは実行日そのもの（オフセット無し）。3:00に実行し、その日の7:00からの
 * 投稿スロットを準備する設計のため、「翌日」ではなく「当日（実行時点の日付）」を対象にする。
 * その日の投稿は、Config.SLOT_MINUTESの10個の固定時刻スロットそれぞれに、
 * どの投稿タイプを割り当てるかを固定した1日パターン(Config.DAILY_PATTERN_WITH_KAIUN /
 * DAILY_PATTERN_WITHOUT_KAIUN)に従って埋めていく。どちらのパターンを使うかは、開運ポストシートに
 * 「投稿予定日（当日）と日付が一致し、承認ステータス=OK かつ 転記ステータス=未転記」の行が
 * あるかどうかで判定する（getApprovedUntransferredKaiunRowForDate_の結果を流用。開運日
 * カレンダーシートは生成後に運用側で行を削除するため参照しない）。そのため、開運ポストが
 * 当日3:00の実行時点で未承認だと、その日はKAIUN無しのパターン（HSPあるあるが2枠）になる
 * （空きの開運枠を残すより、他タイプで10枠を埋めきる方を優先する設計）。
 *
 * パターンを先頭のスロットから順に見ていき、各タイプについて「パターン内で何回目の
 * 登場か」を数える。その回数が既に投稿キューに存在する当日のそのタイプの件数
 * （countRowsByType_）未満であれば、既に転記済みの枠とみなしてスキップする。
 * これによりスロットごとの時刻を直接比較しなくても、（メニューからの手動再実行等で）
 * 複数回実行された場合でも安全（冪等）に埋めていける。まだ埋まっていない枠に来たら、
 * そのタイプの承認済み・未転記の候補（タロット・情弱・HSPあるある・数秘術はシート上から順に、
 * 開運のみ投稿予定日と日付が一致する1件）から未使用の1件を取り出し、そのスロットの固定時刻で
 * 転記する。候補が尽きている場合はその枠は埋めず、翌日以降の実行に持ち越す
 * （他タイプで穴埋めしない）。
 */
var TransferService = {
  runTransferCycle: function () {
    var targetDate = new Date();
    var existingRows = getQueueRowsForDate_(targetDate);
    var countByType = countRowsByType_(existingRows);

    var kaiunCandidates = getApprovedUntransferredKaiunRowForDate_(targetDate);
    var hasKaiunToday = kaiunCandidates.length > 0;
    var pattern = hasKaiunToday ? Config.DAILY_PATTERN_WITH_KAIUN : Config.DAILY_PATTERN_WITHOUT_KAIUN;

    var occurrenceIndexByType = {};
    var candidatesByType = { KAIUN: kaiunCandidates };
    var transferredCount = 0;

    pattern.forEach(function (typeKey, slotIndex) {
      var occIndex = occurrenceIndexByType[typeKey] || 0;
      occurrenceIndexByType[typeKey] = occIndex + 1;

      var alreadyFilled = occIndex < (countByType[typeKey] || 0);
      if (alreadyFilled) return;

      if (!candidatesByType[typeKey]) {
        candidatesByType[typeKey] = getApprovedUntransferredRows_(Config.POST_TYPES[typeKey]);
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
      'パターン=' + (hasKaiunToday ? '開運あり' : '開運なし') + ')'
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
    replyBody3: candidateRow.replyBody3,
    topicTag: candidateRow.topicTag
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
