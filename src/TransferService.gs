/**
 * 投稿タイプ別シートで承認済み(OK)になった行を、投稿キューシートへ転記する処理。
 * 1時間おきの巡回トリガーで実行することを想定している。
 *
 * 「翌日」ぶんについて、Config.POST_TYPESで定義した1日あたりの必要件数(quota)に対する
 * 不足分だけを転記する。既に必要件数を満たしているタイプはスキップするため、
 * 何度実行しても安全（冪等）。供給が足りないタイプは無理に埋め合わせず、その日の
 * 投稿本数がそのぶん少なくなる。
 *
 * 転記対象の選び方は、各シートを上から順に見て「承認ステータス=OK かつ 転記ステータス=未転記」の
 * 行を必要数だけ選ぶ方式（タロット・情弱・HSPあるある・数秘術の4タイプ共通）。生成日時列は
 * 記録用として残っているが、転記順の判定には使わない。
 *
 * 開運ポストのみ例外で、シート上の並び順ではなく「投稿予定日（翌日）と開運ポストシートの
 * 日付列が一致する行」を探して転記する。開運ポストは日付ごとに書かれた専用の内容のため、
 * 他タイプと同じ「上から順に必要数だけ」だと投稿予定日と噛み合わない日に転記されてしまう
 * おそれがあるため。日付が一致する行が無い、またはあっても未承認の場合はその日は
 * 開運ポストなしとする（他タイプで埋め合わせない、という既存方針を踏襲）。
 */
var TransferService = {
  runTransferCycle: function () {
    var targetDate = Utils.addDays(new Date(), 1);
    var existingRows = getQueueRowsForDate_(targetDate);
    var countByType = countRowsByType_(existingRows);
    var usedSlots = existingRows.length;

    Object.keys(Config.POST_TYPES).forEach(function (typeKey) {
      var typeConfig = Config.POST_TYPES[typeKey];
      var already = countByType[typeKey] || 0;
      var remaining = typeConfig.quota - already;
      if (remaining <= 0) return;

      var candidates = typeKey === 'KAIUN'
        ? getApprovedUntransferredKaiunRowForDate_(targetDate).slice(0, remaining)
        : getApprovedUntransferredRows_(typeConfig).slice(0, remaining);
      candidates.forEach(function (candidateRow) {
        if (usedSlots >= Config.SLOT_MINUTES.length) return; // 念のための安全弁（通常は発生しない）
        var scheduledAt = Utils.getSlotDateTime(targetDate, usedSlots);
        transferRow_(typeConfig, candidateRow, scheduledAt);
        usedSlots++;
      });
    });

    Utils.logEvent('転記', '-', '完了', Utils.formatJapaneseDate(targetDate) + '分の転記を実行(計' + usedSlots + '件)');
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
