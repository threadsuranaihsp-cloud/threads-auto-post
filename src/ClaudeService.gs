/**
 * Claude APIを呼び出して、タロット3択ポストのリプライ本文①②③を生成するモジュール。
 */
var ClaudeService = {
  // question: 質問文, cards: TarotService.drawThreeCardsで得た3件の{name, orientation, meaning}
  // 戻り値: [本文①, 本文②, 本文③] (3件の文字列)
  generateTarotCaptions: function (question, cards) {
    var apiKey = Config.getClaudeApiKey();
    var model = Config.getClaudeModel();
    var payload = {
      model: model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildTarotPrompt_(question, cards) }]
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = Utils.withRetry(function () {
      return UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    }, 3, 1000);

    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code !== 200) {
      throw new Error('Claude APIエラー(' + code + '): ' + body);
    }

    var json = JSON.parse(body);
    var content = json.content || [];
    var textBlock = content.filter(function (block) {
      return block && block.type === 'text';
    })[0];
    var text = textBlock && textBlock.text;
    if (!text) {
      throw new Error('Claude APIのレスポンスにテキストが含まれていません: ' + body);
    }
    return parseTarotCaptions_(text);
  }
};

function buildTarotPrompt_(question, cards) {
  return [
    'あなたはHSP占い師「しずく」のSNS担当です。',
    'Threadsに投稿する、タロット3択ポストを作成するサポートをします。',
    '',
    '## 進め方',
    '### STEP1：質問受け取り',
    '質問文は運営側で事前に用意します。この質問文をそのまま使ってください。',
    '',
    '### STEP2：カード情報の受け取り',
    '以下の情報を受け取ります。',
    '- 質問文',
    '- ①②③それぞれのカード名と意味',
    '',
    '### STEP3：本文の出力',
    '受け取った情報をもとに、①②③それぞれの本文を出力してください。',
    '',
    '## 各本文のルール',
    '- 各①②③の本文は300文字程度で書くこと',
    '- カード名や占術名を直接出さないこと（タロットでは〇〇が出ています、などの表現は禁止）',
    '- カードの意味は、しずくさんが受け取った洞察として自然に統合して書くこと',
    '- 選んだ人へのメッセージとして、二人称（あなた）で書くこと',
    '- 現状の描写→気づき→近い未来へのメッセージ、という流れで書くこと',
    '- 文中に「」（鍵括弧）は使わないこと',
    '- ポジティブで温かく締めること',
    '- しずくさんらしいキーワード（バイタル・調律など）を自然に1〜2か所入れること',
    '- 句点や意味の切れ目で改行を入れること',
    '- 各カードで異なる言葉・表現を使い、3つが似通わないようにすること',
    '',
    '## 口調・トーン',
    '- 丁寧で温かい、しずくさんらしい静かなトーン',
    '- 押しつけず、でもちゃんと伝わる言葉を選ぶ',
    '',
    '## 出力形式',
    '以下のJSON形式のみで出力してください。他のテキストは一切含めないでください。',
    '{"text1":"（①の本文）","text2":"（②の本文）","text3":"（③の本文）"}',
    '',
    '## 入力データ',
    '質問文: ' + question,
    '①カード名: ' + cards[0].name + '（' + cards[0].orientation + '）',
    '①意味: ' + cards[0].meaning,
    '②カード名: ' + cards[1].name + '（' + cards[1].orientation + '）',
    '②意味: ' + cards[1].meaning,
    '③カード名: ' + cards[2].name + '（' + cards[2].orientation + '）',
    '③意味: ' + cards[2].meaning
  ].join('\n');
}

// Claudeの応答テキストから{"text1":...,"text2":...,"text3":...}形式のJSONを取り出す。
// コードフェンス(```json ... ```)で囲って返してきた場合にも対応する。
function parseTarotCaptions_(text) {
  var cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  var json;
  try {
    json = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Claude応答のJSON解析に失敗しました: ' + text);
  }

  var texts = [json.text1, json.text2, json.text3];
  texts.forEach(function (t, i) {
    if (!t) {
      throw new Error('Claude応答に本文' + (i + 1) + 'が含まれていません: ' + text);
    }
  });
  return texts.map(function (t) {
    return String(t).trim();
  });
}
