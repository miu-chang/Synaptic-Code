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
        'Unity/Blenderツール検索を改善（カテゴリ説明を追加）',
        'ツール検索結果にinputSchemaを追加（パラメータヒント向上）',
        '"category: all"で0件になる問題を修正',
        '/changelogコマンドを追加（日英対応）',
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
        'Synaptic連携の初期実装（Blender/Unity）',
        'サブエージェントシステム（並列タスク実行）',
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
        'クラウドプロバイダー対応（OpenAI, Anthropic, Google）',
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
