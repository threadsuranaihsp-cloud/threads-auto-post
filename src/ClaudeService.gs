/**
 * Claude APIを呼び出して投稿本文を生成するモジュール。
 */
var ClaudeService = {
  generateCaption: function (theme) {
    var apiKey = Config.getClaudeApiKey();
    var model = Config.getClaudeModel();
    var payload = {
      model: model,
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt_(theme) }]
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
    var text = json.content && json.content[0] && json.content[0].text;
    if (!text) {
      throw new Error('Claude APIのレスポンスにテキストが含まれていません: ' + body);
    }
    return text.trim();
  }
};

function buildPrompt_(theme) {
  return [
    'あなたはThreadsに投稿するSNS運用担当者です。',
    '以下のテーマに基づいて、Threadsに投稿する本文を1つ作成してください。',
    '',
    'テーマ: ' + theme,
    '',
    '条件:',
    '- 日本語で書く',
    '- 500文字以内',
    '- 読み手が親近感を持てる自然な口調にする',
    '- 本文のみを出力し、前置き・説明・引用符は付けない'
  ].join('\n');
}
