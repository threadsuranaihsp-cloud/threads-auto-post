# Threads自動投稿システム（GAS + スプレッドシート）

Googleスプレッドシートに書いたテーマから、Claude APIで投稿本文を生成し、
承認後にThreads APIへ画像付き（最大3枚）で自動投稿するシステムです。

## 全体フロー

1. **生成バッチ**（毎日12:00・`dailyGenerationBatch`）
   投稿キューシートの未スケジュール行（テーマのみ入っている行）を最大10件取り出し、
   「翌日」の10スロット（7:00〜24:00, 約113分間隔）に割り当て、Claude APIで本文を生成して書き戻す。
   承認ステータスは「未確認」になる。
2. **人による確認**
   スプレッドシート上で本文・画像を確認し、承認ステータスを `OK` または `NG` に変更する。
   `NG`にした行は生成ステータスを「未生成」に戻すと次回バッチで再生成される。
3. **投稿巡回**（15分おき・7:00〜24:00・`postingCycle`）
   投稿予定日時を過ぎていて承認ステータスが`OK`の行を検出し、Threads APIで投稿する。
   予定日時を過ぎても未承認のままの行は「スキップ(未承認)」として記録し、投稿しない。
4. **トークン自動更新**（毎日3:00・`tokenRefreshCheck`）
   Threadsの長期アクセストークン（60日有効）の残り期限が7日以内になったら自動更新する。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `appsscript.json` | マニフェスト（タイムゾーン、Webアプリ公開設定） |
| `Main.gs` | トリガーから呼ばれるエントリポイント |
| `Config.gs` | シート名・列番号・スクリプトプロパティのアクセサ |
| `SchedulerService.gs` | 生成バッチ（要件①） |
| `ClaudeService.gs` | Claude API呼び出し |
| `PostingService.gs` | 投稿巡回処理（要件②） |
| `ThreadsService.gs` | Threads API呼び出し（コンテナ作成〜公開） |
| `DriveService.gs` | Drive画像取得・許可フォルダ検証 |
| `ImageProxyWebApp.gs` | 画像プロキシ（Webアプリ、`doGet`） |
| `TokenService.gs` | アクセストークン自動更新（要件③） |
| `SheetService.gs` | スプレッドシート読み書き共通処理 |
| `TriggerSetup.gs` | トリガーの作成（手動実行用） |
| `Setup.gs` | シート初期化（手動実行用） |
| `Utils.gs` | ログ出力・リトライ・日時計算 |

## セットアップ手順

### 1. スプレッドシートとスクリプトの用意

1. 新規Googleスプレッドシートを作成する。
2. 「拡張機能」→「Apps Script」を開き、このスクリプトを紐づける（コンテナバインド型）。
3. `src/` 配下の各ファイルをApps Scriptエディタにコピーする（`.gs`拡張子で保存、`appsscript.json`は「プロジェクトの設定」から表示・編集）。
   `clasp` を使う場合は `clasp push`（`rootDir: src`）でも可。

### 2. スクリプトプロパティの設定

「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定する。

| キー | 内容 |
|---|---|
| `CLAUDE_API_KEY` | Claude APIキー |
| `CLAUDE_MODEL` | （任意）モデルID。未設定時は `claude-sonnet-5` |
| `THREADS_ACCESS_TOKEN` | Threads長期アクセストークン |
| `THREADS_USER_ID` | Threadsのユーザー（アプリ）ID |
| `THREADS_TOKEN_EXPIRES_AT` | トークン取得時の有効期限（ISO8601、例: `2026-09-25T00:00:00Z`） |
| `ALLOWED_DRIVE_FOLDER_ID` | 画像を置く許可フォルダのDriveフォルダID |
| `IMAGE_PROXY_BASE_URL` | 手順3でデプロイ後に設定（`.../exec` のURL） |
| `IMAGE_PROXY_SHARED_TOKEN` | （任意）画像プロキシ用の追加の共有シークレット |

### 3. 画像プロキシのデプロイ

1. Apps Scriptエディタで「デプロイ」→「新しいデプロイ」→種類「ウェブアプリ」を選択。
2. アクセスできるユーザー: 「全員」、実行するユーザー: 「自分」でデプロイ。
3. 発行された `/exec` のURLを `IMAGE_PROXY_BASE_URL` に設定する。
4. **重要**: このWebアプリは公開URLになるため、`ImageProxyWebApp.gs`の`doGet`内で
   `ALLOWED_DRIVE_FOLDER_ID`配下のファイルIDのみ許可するチェックを必ず維持すること。
   投稿に使う画像はすべてこのフォルダ（またはそのサブフォルダ）に置く。

### 4. 初期化

Apps Scriptエディタで以下を一度だけ手動実行する。

1. `initializeSpreadsheet` — 4つのシート（投稿キュー/設定/トークン状態/実行ログ）と見出し行を作成
2. `installTriggers` — 生成バッチ・投稿巡回・トークン更新の3トリガーを作成

初回実行時、Drive/スプレッドシート/UrlFetchApp等の権限承認が求められるので許可する。

### 5. 運用

1. 投稿キューシートに「テーマ」列と、画像を使う場合は「画像1〜3」列（DriveのファイルID）を入力しておく。
   画像は`ALLOWED_DRIVE_FOLDER_ID`のフォルダに「リンクを知っている人が閲覧可」で共有しておく。
2. 毎日12:00に翌日分が自動生成される。
3. 生成された本文を確認し、承認ステータスを`OK`（またはNG）に変更する。
4. 承認済みの行は、投稿予定日時になると自動投稿される。

## 注意事項

- `ImageProxyWebApp.gs`の`doGet`はGoogle Apps Scriptの`ContentService`が公式にはバイナリ出力を
  文書化していない挙動（Blobを直接return）を利用しています。デプロイ後、ブラウザで
  `/exec?fileId=...` にアクセスし、画像として正しく表示されることを確認してください。
- Threads APIのエンドポイント・パラメータ仕様は変更される可能性があるため、実装後に
  実際のレスポンスを確認しながら調整してください。
