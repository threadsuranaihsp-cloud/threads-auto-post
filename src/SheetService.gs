/**
 * スプレッドシートの読み書きを共通化するモジュール。
 * このスクリプトはスプレッドシートに紐づくコンテナバインド型を前提にしている。
 */
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

  // 投稿キューシートの2行目以降を読み込み、扱いやすいオブジェクト配列に変換する
  getQueueRows: function () {
    var sheet = this.getQueueSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var col = Config.QUEUE_COL;
    var numRows = lastRow - 1;
    var lastCol = sheet.getLastColumn();
    var values = sheet.getRange(2, 1, numRows, Math.max(lastCol, col.REPLY_ID3)).getValues();

    return values.map(function (row, i) {
      return {
        rowIndex: i + 2,
        no: row[col.NO - 1],
        question: row[col.QUESTION - 1],
        image1: row[col.IMAGE1 - 1],
        image2: row[col.IMAGE2 - 1],
        image3: row[col.IMAGE3 - 1],
        scheduledAt: row[col.SCHEDULED_AT - 1] instanceof Date ? row[col.SCHEDULED_AT - 1] : null,
        body: row[col.BODY - 1],
        genStatus: row[col.GEN_STATUS - 1] || Config.GEN_STATUS.PENDING,
        approvalStatus: row[col.APPROVAL_STATUS - 1] || Config.APPROVAL_STATUS.PENDING,
        postStatus: row[col.POST_STATUS - 1] || Config.POST_STATUS.PENDING,
        postedAt: row[col.POSTED_AT - 1],
        threadsPostId: row[col.THREADS_POST_ID - 1],
        errorMessage: row[col.ERROR_MESSAGE - 1],
        updatedAt: row[col.UPDATED_AT - 1],
        card1: row[col.CARD1 - 1],
        card2: row[col.CARD2 - 1],
        card3: row[col.CARD3 - 1],
        replyBody1: row[col.REPLY_BODY1 - 1],
        replyBody2: row[col.REPLY_BODY2 - 1],
        replyBody3: row[col.REPLY_BODY3 - 1],
        replyId1: row[col.REPLY_ID1 - 1],
        replyId2: row[col.REPLY_ID2 - 1],
        replyId3: row[col.REPLY_ID3 - 1]
      };
    });
  },

  // fieldsに指定したキーのみ更新する。UPDATED_AT列は常に現在時刻で更新される。
  updateQueueRow: function (rowIndex, fields) {
    var sheet = this.getQueueSheet();
    var col = Config.QUEUE_COL;
    var map = {
      question: col.QUESTION,
      image1: col.IMAGE1,
      image2: col.IMAGE2,
      image3: col.IMAGE3,
      scheduledAt: col.SCHEDULED_AT,
      body: col.BODY,
      genStatus: col.GEN_STATUS,
      approvalStatus: col.APPROVAL_STATUS,
      postStatus: col.POST_STATUS,
      postedAt: col.POSTED_AT,
      threadsPostId: col.THREADS_POST_ID,
      errorMessage: col.ERROR_MESSAGE,
      card1: col.CARD1,
      card2: col.CARD2,
      card3: col.CARD3,
      replyBody1: col.REPLY_BODY1,
      replyBody2: col.REPLY_BODY2,
      replyBody3: col.REPLY_BODY3,
      replyId1: col.REPLY_ID1,
      replyId2: col.REPLY_ID2,
      replyId3: col.REPLY_ID3
    };
    Object.keys(fields).forEach(function (key) {
      var colIndex = map[key];
      if (!colIndex) return;
      sheet.getRange(rowIndex, colIndex).setValue(fields[key]);
    });
    sheet.getRange(rowIndex, col.UPDATED_AT).setValue(new Date());
  }
};
