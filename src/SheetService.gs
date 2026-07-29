/**
 * スプレッドシートの読み書きを共通化するモジュール。
 * このスクリプトはスプレッドシートに紐づくコンテナバインド型を前提にしている。
 *
 * readRows/writeRow/appendRowは、投稿キューシート・投稿タイプ別シートのどちらに対しても
 * 使える汎用処理。フィールド名(JS側のキー)と列マップ(Config.QUEUE_COLやConfig.POST_TYPES.*.col
 * などのUPPER_SNAKEキーを持つオブジェクト)との対応はFIELD_TO_COL_KEY_で一元管理しており、
 * 列マップに存在しないフィールドは自動的に無視される（例：投稿キューにはtheme/groupが無い）。
 */
var FIELD_TO_COL_KEY_ = {
  no: 'NO',
  postType: 'POST_TYPE',
  question: 'QUESTION',
  theme: 'THEME',
  group: 'GROUP',
  date: 'DATE',
  luckyDays: 'LUCKY_DAYS',
  scheduledAt: 'SCHEDULED_AT',
  image1: 'IMAGE1',
  image2: 'IMAGE2',
  image3: 'IMAGE3',
  card1: 'CARD1',
  card2: 'CARD2',
  card3: 'CARD3',
  body: 'BODY',
  replyBody1: 'REPLY_BODY1',
  replyBody2: 'REPLY_BODY2',
  replyBody3: 'REPLY_BODY3',
  replyId1: 'REPLY_ID1',
  replyId2: 'REPLY_ID2',
  replyId3: 'REPLY_ID3',
  approvalStatus: 'APPROVAL_STATUS',
  transferStatus: 'TRANSFER_STATUS',
  generatedAt: 'GENERATED_AT',
  postStatus: 'POST_STATUS',
  postedAt: 'POSTED_AT',
  threadsPostId: 'THREADS_POST_ID',
  errorMessage: 'ERROR_MESSAGE',
  updatedAt: 'UPDATED_AT',
  likes: 'LIKES',
  replies: 'REPLIES',
  reposts: 'REPOSTS',
  views: 'VIEWS',
  insightsStatus: 'INSIGHTS_STATUS'
};

var SheetService = {
  getSpreadsheet: function () {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  getSheetByName: function (name) {
    var sheet = this.getSpreadsheet().getSheetByName(name);
    if (!sheet) {
      throw new Error('シートが見つかりません: ' + name);
    }
    return sheet;
  },

  getQueueSheet: function () {
    return this.getSheetByName(Config.SHEET_NAMES.QUEUE);
  },

  // sheetの2行目以降をcolMapに基づいて読み込み、{rowIndex, ...フィールド}の配列にする。
  // 値の型変換や既定値の適用は行わない（呼び出し側の責務）。
  readRows: function (sheet, colMap) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var lastCol = sheet.getLastColumn();
    var maxCol = Math.max.apply(null, Object.keys(colMap).map(function (key) {
      return colMap[key];
    }));
    var values = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, maxCol)).getValues();

    return values.map(function (raw, i) {
      var row = { rowIndex: i + 2 };
      Object.keys(FIELD_TO_COL_KEY_).forEach(function (fieldKey) {
        var colKey = FIELD_TO_COL_KEY_[fieldKey];
        var colIndex = colMap[colKey];
        if (!colIndex) return;
        row[fieldKey] = raw[colIndex - 1];
      });
      return row;
    });
  },

  // fieldsに指定したキーのみ、colMapを介して該当セルに書き込む
  writeRow: function (sheet, rowIndex, colMap, fields) {
    Object.keys(fields).forEach(function (key) {
      var colKey = FIELD_TO_COL_KEY_[key];
      var colIndex = colKey && colMap[colKey];
      if (!colIndex) return;
      sheet.getRange(rowIndex, colIndex).setValue(fields[key]);
    });
  },

  // sheetの最終行の次に新しい行を追加し、No列に連番を自動採番する。追加した行番号を返す。
  appendRow: function (sheet, colMap, fields) {
    var newRowIndex = sheet.getLastRow() + 1;
    var no = newRowIndex - 1;
    var payload = Object.assign({ no: no }, fields);
    this.writeRow(sheet, newRowIndex, colMap, payload);
    return newRowIndex;
  },

  // 投稿キューシートの2行目以降を読み込み、扱いやすいオブジェクト配列に変換する
  getQueueRows: function () {
    var rows = this.readRows(this.getQueueSheet(), Config.QUEUE_COL);
    rows.forEach(function (row) {
      row.scheduledAt = row.scheduledAt instanceof Date ? row.scheduledAt : null;
      row.postedAt = row.postedAt instanceof Date ? row.postedAt : null;
      row.postStatus = row.postStatus || Config.POST_STATUS.PENDING;
      row.insightsStatus = row.insightsStatus || Config.INSIGHTS_STATUS.PENDING;
    });
    return rows;
  },

  // fieldsに指定したキーのみ更新する。UPDATED_AT列は常に現在時刻で更新される。
  updateQueueRow: function (rowIndex, fields) {
    var sheet = this.getQueueSheet();
    this.writeRow(sheet, rowIndex, Config.QUEUE_COL, fields);
    sheet.getRange(rowIndex, Config.QUEUE_COL.UPDATED_AT).setValue(new Date());
  },

  // 投稿キューシートに新しい行を追加する（TransferServiceが承認済み行を転記する際に使う）
  appendQueueRow: function (fields) {
    var sheet = this.getQueueSheet();
    var rowIndex = this.appendRow(sheet, Config.QUEUE_COL, fields);
    sheet.getRange(rowIndex, Config.QUEUE_COL.UPDATED_AT).setValue(new Date());
    return rowIndex;
  }
};
