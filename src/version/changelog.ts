/**
 * Changelog data for Synaptic Code
 * Bilingual: English and Japanese
 */

import { getLanguage } from '../i18n/index.js';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    en: string[];
    ja: string[];
  };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.19',
    date: '2026-05-08',
    changes: {
      en: [
        'Fix: bash command not found on Windows → falls back to cmd.exe',
        'web_fetch: added POST/PUT/DELETE/PATCH support with method/body/headers parameters',
        'read_file: PDF support (auto-extract from text layer; image OCR not supported)',
      ],
      ja: [
        '修正: Windows環境で bash コマンドが見つからないエラー → cmd.exe にフォールバック',
        'web_fetch: POST/PUT/DELETE/PATCH対応、method body headers パラメータ追加',
        'read_file: PDF読み込み対応（テキストレイヤーから自動抽出。画像OCRは非対応）',
      ],
    },
  },
  {
    version: '0.2.17',
    date: '2026-04-21',
    changes: {
      en: [
        'Fix: web_fetch now falls back to curl on Windows (bun TLS certificate store issue)',
        'Fixes "Unable to connect" errors when fetching URLs on Windows',
        'Updated User-Agent and added Accept-Language header for better compatibility',
      ],
      ja: [
        '修正: web_fetchがWindows環境でcurlフォールバック対応(bunのTLS証明書問題)',
        'Windows環境での「Unable to connect」エラーを修正',
        'User-Agent更新、Accept-Languageヘッダー追加で互換性向上',
      ],
    },
  },
  {
    version: '0.2.16',
    date: '2026-04-21',
    changes: {
      en: [
        'Fix: Web search on Windows - curl fallback when bun fetch fails (bot detection bypass)',
        'Fix: Model reload now passes GPU offload setting (prevents ctx: 0 on reload)',
      ],
      ja: [
        '修正: Windows環境のWeb検索 - fetchが失敗時にcurlフォールバック(bot検出回避)',
        '修正: モデルリロード時にGPUオフロード設定を渡すように(リロード時ctx: 0を防止)',
      ],
    },
  },
  {
    version: '0.2.15',
    date: '2026-04-20',
    changes: {
      en: [
        '/context command: manually set context length and reload model (e.g. /context 16384)',
        'Reduced auto context for 8GB VRAM (48000→32000) and 12GB VRAM (64000→48000)',
        'Auto GPU offload: calculates optimal layers based on VRAM and model size',
        'Prevents timeout on low-VRAM systems running large models (e.g. 35B on 8GB)',
      ],
      ja: [
        '/context コマンド: コンテキスト長を手動設定してモデル再ロード(例: /context 16384)',
        '8GB VRAM自動コンテキストを縮小(48000→32000)、12GBも調整(64000→48000)',
        'GPUオフロード自動計算: VRAMとモデルサイズから最適レイヤー数を算出',
        '低VRAMで大モデル実行時のタイムアウトを軽減(例: 8GBで35B)',
      ],
    },
  },
  {
    version: '0.2.14',
    date: '2026-04-19',
    changes: {
      en: [
        'Fix: Web search (DuckDuckGo) now returns results correctly',
        'Changed to POST method to avoid bot detection',
        'Fixed snippet parsing for HTML-formatted results',
      ],
      ja: [
        '修正: Web検索(DuckDuckGo)が正しく結果を返すように',
        'bot検出回避のためPOSTメソッドに変更',
        'HTML形式のスニペット解析を修正',
      ],
    },
  },
  {
    version: '0.2.13',
    date: '2026-04-19',
    changes: {
      en: [
        '/reasoning command: toggle reasoning mode (none/low/medium/high)',
        'Uses LM Studio /v1/responses API for reasoning effort control',
        'Auto-fallback to /v1/chat/completions when /v1/responses unavailable',
        'Status bar shows current reasoning level',
      ],
      ja: [
        '/reasoning コマンド: 推論モード切り替え (none/low/medium/high)',
        'LM Studio /v1/responses APIで推論制御',
        '/v1/responses未対応時は/v1/chat/completionsに自動フォールバック',
        'ステータスバーに現在の推論レベルを表示',
      ],
    },
  },
  {
    version: '0.2.12',
    date: '2026-04-17',
    changes: {
      en: [
        'Fix: model context reload now triggers even when context detection returns 0',
        'Prevents "ctx: unknown" and ensures correct context length on startup',
      ],
      ja: [
        '修正: コンテキスト検出が0を返す場合でもリロードが発動するように',
        '「ctx: unknown」表示を防止、起動時に正しいコンテキスト長を保証',
      ],
    },
  },
  {
    version: '0.2.11',
    date: '2026-04-17',
    changes: {
      en: [
        'Default model: Qwen 3.6 35B-A3B (MCPMark +37%, Terminal-Bench +27% vs 3.5)',
        'Startup context fix: detects loaded model context, reloads with correct size if too low',
        'Fixes response stopping mid-sentence (was caused by 4096 context on models needing 128K+)',
        'Model recommendations updated: Qwen 3.6 → Gemma 4 → Qwen 3.5 14B/9B/4B',
      ],
      ja: [
        'デフォルトモデル: Qwen 3.6 35B-A3B (MCPMark +37%, Terminal-Bench +27% vs 3.5)',
        '起動時コンテキスト修正: ロード済みモデルのコンテキスト長を検出、不足時は正しいサイズでリロード',
        '応答が途中で止まる問題を修正(4096コンテキストで128K+必要なモデルが動いていた)',
        'モデル推奨更新: Qwen 3.6 → Gemma 4 → Qwen 3.5 14B/9B/4B',
      ],
    },
  },
  {
    version: '0.2.10',
    date: '2026-04-17',
    changes: {
      en: [
        'Bridge server WebSocket: replaced custom RFC 6455 implementation with battle-tested ws package',
        'Fixes Chrome extension connection issues on Windows (WebSocket handshake timeout)',
        'Removed per-message model context reload (was causing duplicate model loads with wrong context)',
        'Chrome extension connection: waits up to 12s for extension to connect after bridge start',
      ],
      ja: [
        'ブリッジサーバーWebSocket: 自前RFC 6455実装を実績あるwsパッケージに置換',
        'Windows環境でのChrome拡張接続問題を修正(WebSocketハンドシェイクタイムアウト)',
        'メッセージ送信ごとのモデルコンテキストリロードを削除(不正なコンテキスト長でのリロード問題を解消)',
        'Chrome拡張接続: ブリッジ起動後、拡張の接続を最大12秒待機',
      ],
    },
  },
  {
    version: '0.2.9',
    date: '2026-04-17',
    changes: {
      en: [
        'Default model changed: Gemma 4 26B-A4B ★Recommended (was Qwen 3.5 35B-A3B)',
        'Gemma 4: high quality responses with excellent tool use support',
        'Removed Gemma tool exclusion: all Gemma models now send tools (Gemma 2/3 included)',
        'Model fallback priority updated: Gemma 4 → Qwen 35B → 14B → 9B → 4B',
      ],
      ja: [
        'デフォルトモデル変更: Gemma 4 26B-A4B ★推奨(旧: Qwen 3.5 35B-A3B)',
        'Gemma 4: 高品質な応答と優れたツール使用をサポート',
        'Gemmaツール除外を削除: 全Gemmaモデルでツール送信(Gemma 2/3含む)',
        'モデルフォールバック優先順位更新: Gemma 4 → Qwen 35B → 14B → 9B → 4B',
      ],
    },
  },
  {
    version: '0.2.8',
    date: '2026-04-17',
    changes: {
      en: [
        'Bridge server embedded in binary: no more external bridge-server.cjs file needed',
        'Auto-update no longer breaks Chrome extension (bridge-server was missing after update)',
        'WebSocket implementation using Node.js built-in http+crypto (no ws dependency)',
      ],
      ja: [
        'ブリッジサーバーをバイナリに内蔵: 外部のbridge-server.cjsファイルが不要に',
        '自動アップデート後もChrome拡張が動作するように(bridge-serverファイル欠落問題を解決)',
        'WebSocket実装をNode.js標準のhttp+cryptoに変更(ws依存排除)',
      ],
    },
  },
  {
    version: '0.2.7',
    date: '2026-04-15',
    changes: {
      en: [
        'Improved Blender/Unity tool descriptions: clear workflow (search→list→execute), common tool params',
        'Animation workflow: detect_avatar_parts→ai_get_motion_prompt→ai_apply_motion flow documented',
        'Fixed "Armature and bone name required" errors by adding parameter examples to descriptions',
        'Unity tool examples added: add_component, create_script, instantiate_prefab, set_material',
      ],
      ja: [
        'Blender/Unityツール説明を改善: ワークフロー明記(search→list→execute)、主要パラメータ例',
        'アニメーション: detect_avatar_parts→ai_get_motion_prompt→ai_apply_motionのフロー文書化',
        '「Armature and bone name required」エラーの修正(パラメータ例をdescriptionに追加)',
        'Unityツール例を追加: add_component, create_script, instantiate_prefab, set_material',
      ],
    },
  },
  {
    version: '0.2.6',
    date: '2026-04-15',
    changes: {
      en: [
        'Blender: AI motion tools moved to Animation category (ai_get_motion_prompt, ai_apply_motion, etc.)',
        'Blender: category descriptions updated to 14 categories with tool counts',
        'Blender: 3D modeling guide added (create_mesh_from_data) and VRM animation guide (ai_get_motion_prompt → ai_apply_motion)',
        'Blender: blender_search_tools meta-tool for keyword-based tool search across all categories',
      ],
      ja: [
        'Blender: AIモーションツールをAnimationカテゴリに移動(ai_get_motion_prompt, ai_apply_motion等)',
        'Blender: カテゴリ説明を14カテゴリ(ツール数付き)に更新',
        'Blender: 3Dモデリングガイド(create_mesh_from_data推奨)とVRMアニメーションガイドを追加',
        'Blender: blender_search_toolsメタツール追加(キーワードでツール横断検索)',
      ],
    },
  },
  {
    version: '0.2.5',
    date: '2026-04-15',
    changes: {
      en: [
        'Bridge server auto-start: Synaptic Code now automatically starts the Chrome bridge server on launch',
        'No need to manually run bridge-server.cjs — Chrome extension connects automatically',
        'Windows install fix: removes existing exe before copy to prevent upgrade errors',
      ],
      ja: [
        'ブリッジサーバー自動起動: Synaptic Code起動時にChromeブリッジサーバーを自動起動',
        'bridge-server.cjsの手動起動が不要に — Chrome拡張が自動接続',
        'Windowsインストール修正: アップグレード時のコピーエラーを防止(既存exeを事前削除)',
      ],
    },
  },
  {
    version: '0.2.4',
    date: '2026-04-15',
    changes: {
      en: [
        'Fixed 400 error when LM Studio model differs from config (e.g., Gemma loaded but Qwen configured)',
        'Auto-detects loaded model in LM Studio and uses it instead of configured default',
        'Gemma 4 now recognized as tool-capable (only Gemma 2/3 excluded)',
      ],
      ja: [
        'LM Studioのロード済みモデルと設定が異なる場合の400エラーを修正(例: Gemmaロード中にQwen設定)',
        'LM Studioのロード済みモデルを自動検出し、設定のデフォルトより優先して使用',
        'Gemma 4をツール対応モデルとして認識(Gemma 2/3のみ除外に変更)',
      ],
    },
  },
  {
    version: '0.2.3',
    date: '2026-04-15',
    changes: {
      en: [
        'Fixed 400 error on first launch: checks LM Studio API for loaded models before attempting load',
        'Auto setup wizard when no model loaded and CLI unavailable',
        'No more blind model load attempts with unconfigured default model',
      ],
      ja: [
        '初回起動時の400エラーを修正: モデルロード前にLM Studio APIでロード済みモデルを確認',
        'モデル未ロード+CLI未検出時にセットアップウィザードを自動起動',
        '未設定のデフォルトモデルでの盲目的なロード試行を廃止',
      ],
    },
  },
  {
    version: '0.2.2',
    date: '2026-04-15',
    changes: {
      en: [
        'xAI (Grok) provider support: grok-4-1-fast-non-reasoning, grok-4-1-fast-reasoning, grok-4.20 models',
        'OpenAI models updated: gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-5.3-codex',
        'OpenAI Cloud client now supports custom base URL (enables xAI, Azure, etc.)',
        'Update prompt: single keypress (y/n without Enter)',
        'Fixed ZIP file encoding: Japanese filenames replaced with ASCII for Windows compatibility',
      ],
      ja: [
        'xAI (Grok) プロバイダー対応: grok-4-1-fast-non-reasoning, grok-4-1-fast-reasoning, grok-4.20 モデル',
        'OpenAIモデル更新: gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-5.3-codex',
        'OpenAI Cloudクライアントにカスタムbase URL対応(xAI, Azure等に対応)',
        'アップデート確認: y/nの1キー入力で即実行(Enter不要)',
        'ZIP内の日本語ファイル名を英語に変更(Windows文字化け修正)',
      ],
    },
  },
  {
    version: '0.2.1',
    date: '2026-04-14',
    changes: {
      en: [
        '/memory command: view, show, delete, clear saved memories',
        '/memory on|off: toggle learning mode (disable memory recording for casual use)',
        'Tool description optimization: reduced token usage for faster responses',
        'Chrome side panel: i18n (auto Japanese/English based on browser language)',
        'Chrome side panel: page context ON by default, input clear fix',
        'User guide (HTML) and Chrome extension setup guide included in package',
        'Synaptic brand font applied across all UIs',
      ],
      ja: [
        '/memoryコマンド: メモリの一覧表示、内容確認、削除、全削除',
        '/memory on|off: 学習モード切替(通常使用時はメモリ記録を停止可能)',
        'ツール説明文の最適化: トークン消費を削減、レスポンス高速化',
        'Chromeサイドパネル: i18n対応(ブラウザ言語に応じて日英自動切替)',
        'Chromeサイドパネル: ページコンテキストをデフォルトON、入力欄クリア修正',
        '使い方ガイド(HTML)とChrome拡張セットアップガイドをパッケージに同梱',
        'Synapticブランドフォントを全UIに適用',
      ],
    },
  },
  {
    version: '0.2.0',
    date: '2026-04-14',
    changes: {
      en: [
        'Auto Memory: persistent memory across sessions (memory_save/read/list/delete tools)',
        'Memory index auto-injected into system prompt at session start',
        'Chrome Extension: browser automation via side panel + 10 tools (get_page, click, type, navigate, scroll, screenshot, tabs, eval, get_elements)',
        'Chrome Side Panel: chat UI with LLM, model switching, page context injection',
        'Tab Group: Synaptic-opened tabs auto-grouped in blue "Synaptic" group',
        'Bridge Server: HTTP+WebSocket bridge (port 19222) for Chrome extension communication',
        'Voice Input: /voice command with push-to-talk recording loop (Enter: send, Esc: skip, Esc×2: exit)',
        'Whisper STT: auto-selects best model based on system specs (Lightning MLX on Apple Silicon, faster-whisper on Windows/Linux)',
        'Voice setup in wizard: auto-installs sox/ffmpeg + Whisper backend',
        'LM Studio detection fix: auto-opens setup wizard when not installed',
        'Model fallback: finds installed model when configured model is missing (no more 400 errors)',
        'Timeout increase: bash 30s→5min, Synaptic tools 30s→5min, LLM stream 5min→30min, chunk 60s→3min',
        'Windows support: Python/pip path detection (Program Files, scoop, choco, D: drive), shell mode for spawn',
        'Hallucination filter: blocks common Whisper false positives',
        'i18n: all voice UI messages in English and Japanese',
      ],
      ja: [
        'Auto Memory: セッション間で永続記憶 (memory_save/read/list/delete ツール)',
        'メモリインデックスをセッション開始時にシステムプロンプトへ自動注入',
        'Chrome拡張: サイドパネル+10ツールでブラウザ操作 (ページ取得, クリック, 入力, 遷移, スクロール, スクリーンショット等)',
        'Chromeサイドパネル: LLMチャットUI、モデル切替、ページコンテキスト注入',
        'タブグループ: Synapticが開いたタブを青い「Synaptic」グループに自動追加',
        'ブリッジサーバー: Chrome拡張通信用HTTP+WebSocketブリッジ (ポート19222)',
        '音声入力: /voiceコマンドでプッシュトゥトーク録音ループ (Enter: 送信, Esc: やり直し, Esc×2: 終了)',
        'Whisper STT: スペック検知で最適モデル自動選択 (Apple SiliconはLightning MLX, Windows/Linuxはfaster-whisper)',
        'セットアップウィザードに音声入力ステップ追加: sox/ffmpeg + Whisperバックエンドの自動インストール',
        'LM Studio検知修正: 未インストール時にセットアップウィザードを自動起動',
        'モデルフォールバック: 設定モデルが未インストールの場合、インストール済みモデルを自動選択 (400エラー解消)',
        'タイムアウト延長: bash 30秒→5分, Synapticツール 30秒→5分, LLMストリーム 5分→30分, チャンク間 60秒→3分',
        'Windows対応強化: Python/pipパス検出 (Program Files, scoop, choco, D:ドライブ), spawn時のshellモード',
        'ハルシネーションフィルター: Whisperの一般的な誤認識をブロック',
        'i18n: 音声UI全メッセージを日英対応',
      ],
    },
  },
  {
    version: '0.1.6',
    date: '2026-04-09',
    changes: {
      en: [
        'Massively increased auto-detected context length limits (2-4x across all hardware)',
        'Apple Silicon: Leverages unified memory for much larger contexts (e.g., M1 16GB: 8k→32k)',
        'NVIDIA GPU: Now considers both VRAM + system RAM for context sizing (hybrid offload)',
        'CPU-only: Increased limits reflecting actual RAM availability (e.g., 32GB: 8k→32k)',
        'Based on 2026 benchmarks: Qwen 3.5 SSM+Attention hybrid uses minimal KV cache (640MB at 32k)',
        'Flash Attention and KV cache quantization reduce memory usage up to 75%',
      ],
      ja: [
        'コンテキスト長の自動設定を大幅強化(全ハードウェアで2-4倍に拡大)',
        'Apple Silicon: ユニファイドメモリを活用しコンテキスト大幅拡大(例: M1 16GB: 8k→32k)',
        'NVIDIA GPU: VRAM + システムRAMの合計を考慮したハイブリッド設定に変更',
        'CPUのみ: 実際のRAM容量を反映し限界値を引き上げ(例: 32GB: 8k→32k)',
        '2026年ベンチマーク反映: Qwen 3.5 SSMハイブリッドのKVキャッシュ軽量化(32kで640MB)',
        'Flash AttentionとKVキャッシュ量子化でメモリ使用量最大75%削減',
      ],
    },
  },
  {
    version: '0.1.5',
    date: '2026-04-06',
    changes: {
      en: [
        'Fixed Windows LM Studio connection - auto-detect port at startup for all commands',
        'Port detection now checks both localhost and 127.0.0.1 (IPv4/IPv6 compatibility)',
        'Settings automatically updated with detected LM Studio URL',
      ],
      ja: [
        'Windows LM Studio接続を修正 - 全コマンドで起動時にポートを自動検出',
        'ポート検出がlocalhostと127.0.0.1の両方をチェック(IPv4/IPv6互換)',
        '検出したLM Studio URLで設定を自動更新',
      ],
    },
  },
  {
    version: '0.1.4',
    date: '2026-04-05',
    changes: {
      en: [
        'Fixed 400 Bad Request error with small models (Gemma, Phi) - auto-strip tools for unsupported models',
        'Auto-detect LM Studio port (scans 1234, 8084, 8080, etc.) - fixes Windows connection issues',
        'Updated recommended models: Qwen3.5 4B (97.5% tool accuracy) replaces Gemma 3 4B (55%)',
        'Added Nemotron Nano 4B and Qwen3 8B to recommendations',
        'Fixed model IDs for lms get command (publisher/model format)',
      ],
      ja: [
        '小規模モデル(Gemma, Phi)での400エラーを修正 - ツール非対応モデルを自動検出',
        'LM Studioポート自動検出(1234, 8084, 8080等をスキャン) - Windows接続問題を修正',
        '推奨モデル更新: Qwen3.5 4B(ツール精度97.5%)がGemma 3 4B(55%)に代わり推奨に',
        'Nemotron Nano 4BとQwen3 8Bを推奨モデルに追加',
        'lms getコマンド用モデルID修正(publisher/model形式)',
      ],
    },
  },
  {
    version: '0.1.3',
    date: '2026-04-04',
    changes: {
      en: [
        'Improved Unity/Blender tool discovery with full category descriptions',
        'Added inputSchema to tool search results for better parameter hints',
        'Fixed "category: all" returning 0 tools',
        'Added /changelog command with bilingual support',
      ],
      ja: [
        'Unity/Blenderツール検索を改善(カテゴリ説明を追加)',
        'ツール検索結果にinputSchemaを追加(パラメータヒント向上)',
        '"category: all"で0件になる問題を修正',
        '/changelogコマンドを追加(日英対応)',
      ],
    },
  },
  {
    version: '0.1.1',
    date: '2026-04-01',
    changes: {
      en: [
        'Initial Synaptic integration (Blender/Unity)',
        'Sub-agent system for parallel task execution',
        'Session history and timeline view',
        'Undo/restore system for code changes',
      ],
      ja: [
        'Synaptic連携の初期実装(Blender/Unity)',
        'サブエージェントシステム(並列タスク実行)',
        'セッション履歴とタイムライン表示',
        'コード変更のUndo/復元システム',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-03-15',
    changes: {
      en: [
        'Initial release',
        'Local LLM support via LM Studio',
        'Cloud provider support (OpenAI, Anthropic, Google)',
        'File operations, bash commands, web search',
        'TODO management',
        'Conversation compaction',
      ],
      ja: [
        '初期リリース',
        'LM Studio経由のローカルLLMサポート',
        'クラウドプロバイダー対応(OpenAI, Anthropic, Google)',
        'ファイル操作、bashコマンド、Web検索',
        'TODO管理',
        '会話圧縮',
      ],
    },
  },
];

/**
 * Get formatted changelog for display
 */
export function getFormattedChangelog(): string {
  const lang = getLanguage();
  const lines: string[] = [];

  for (const entry of CHANGELOG) {
    lines.push(`\n## v${entry.version} (${entry.date})`);
    const changes = lang === 'ja' ? entry.changes.ja : entry.changes.en;
    for (const change of changes) {
      lines.push(`  - ${change}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get changelog for a specific version
 */
export function getVersionChangelog(version: string): string | null {
  const lang = getLanguage();
  const entry = CHANGELOG.find(e => e.version === version);
  if (!entry) return null;

  const changes = lang === 'ja' ? entry.changes.ja : entry.changes.en;
  return changes.map(c => `- ${c}`).join('\n');
}
