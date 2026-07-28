/**
 * タロットカードの抽選と、抽選結果に対応する画像ファイルの解決を行うモジュール。
 * カード意味は投稿キューと同じスプレッドシート内の「カード意味」シートで管理されている。
 */
var TAROT_SHEET_NAME_ = 'カード意味';
var TAROT_POSITION_LABELS_ = ['①', '②', '③'];

var TarotService = {
  // カード名重複なしで3枚抽選し、[{name, orientation, meaning}, ...](3件)を返す。
  // 同じ行ごとに正/逆が別行として存在するシート構成でも、カード名単位でグルーピングしてから
  // 抽選するため、同じカードの正逆違いが重複して選ばれることはない。
  drawThreeCards: function () {
    var cards = getAllCards_();
    return pickRandomCards_(cards, 3);
  },

  // drawThreeCardsで得たカード配列(3件)に対応する画像のDriveファイルIDを、
  // 画像用Driveフォルダ(Config.getAllowedDriveFolderId)から「カード名_正逆_①②③.png」の
  // ファイル名で検索して解決する。配列のインデックス0/1/2がそれぞれ①/②/③に対応する。
  resolveImageFileIds: function (cards) {
    var folderId = Config.getAllowedDriveFolderId();
    return cards.map(function (card, i) {
      var positionLabel = TAROT_POSITION_LABELS_[i];
      var fileName = buildCardImageFileName_(card, positionLabel);
      var fileId = DriveService.findFileIdInFolder(folderId, fileName);
      if (!fileId) {
        throw new Error('画像ファイルが見つかりません: ' + fileName);
      }
      return fileId;
    });
  },

  // drawThreeCards + resolveImageFileIdsをまとめて行い、{cards, imageFileIds}を返す。
  prepareDraw: function () {
    var cards = TarotService.drawThreeCards();
    var imageFileIds = TarotService.resolveImageFileIds(cards);
    return { cards: cards, imageFileIds: imageFileIds };
  }
};

function buildCardImageFileName_(card, positionLabel) {
  return card.name + '_' + card.orientation + '_' + positionLabel + '.png';
}

function getTarotSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// カード意味シートのA〜C列(カード名/向き/意味)を全行読み込む。カード名が空の行は除外する。
function getAllCards_() {
  var ss = getTarotSpreadsheet_();
  var sheet = ss.getSheetByName(TAROT_SHEET_NAME_);
  if (!sheet) {
    throw new Error('タロットスプレッドシートに「' + TAROT_SHEET_NAME_ + '」シートが見つかりません');
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('タロットシートにカードデータがありません');
  }
  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return values
    .filter(function (row) {
      return row[0];
    })
    .map(function (row) {
      return {
        name: String(row[0]).trim(),
        orientation: String(row[1]).trim(),
        meaning: String(row[2]).trim()
      };
    });
}

// カードをカード名単位でグルーピングし、名前が重複しないようcount件をランダムに選ぶ。
// 選ばれた各カード名について、そのグループ内(正/逆)からランダムに1件を採用する。
function pickRandomCards_(cards, count) {
  var groups = {};
  cards.forEach(function (card) {
    if (!groups[card.name]) groups[card.name] = [];
    groups[card.name].push(card);
  });

  var names = shuffle_(Object.keys(groups));
  if (names.length < count) {
    throw new Error('カード名の種類が' + count + '種類未満です(' + names.length + '種類)');
  }

  return names.slice(0, count).map(function (name) {
    var group = groups[name];
    return group[Math.floor(Math.random() * group.length)];
  });
}

function shuffle_(array) {
  var result = array.slice();
  for (var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
