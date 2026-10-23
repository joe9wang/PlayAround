/**
 * game-dev-ai.js
 * BatriTable Developer Mode - AI（ChatGPT）カード選択クライアント
 * 自然言語ルールに基づいて盤面（可視カード）から最適なカードを選択する。
 *
 * OpenAI API キーはブラウザには一切置かず、サーバー関数 /api/ai-select
 * （Vercel 環境変数 OPENAI_API_KEY を使用）経由で呼び出す。
 */

import { auth } from './firebase.init.js';

const AI_ENDPOINT = '/api/ai-select';

/**
 * AI にカードを選択させる
 * @param {Object} params
 * @param {string} params.ruleText - ユーザーが入力した自然言語ゲームルール
 * @param {Array} params.candidateCards - 選択候補となるカード配列 (例: 自分の手札)
 * @param {Object} params.visibleContext - 盤面で見えている全エリアとカードの情報
 * @param {string} params.cpuPlayerLabel - 思考中のCPUプレイヤー名 (例: "P2 (プレイヤー2)")
 * @returns {Promise<{ selectedCardIds: string[], reason: string }>}
 */
export async function queryAiCardSelection({ ruleText, candidateCards, visibleContext, cpuPlayerLabel = 'CPU' }) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ログインしていないためAI思考を利用できません。');
  }
  const idToken = await user.getIdToken();

  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      ruleText,
      cpuPlayerLabel,
      visibleContext,
      candidateCards: (candidateCards || []).map(c => ({
        id: c.id,
        name: c.name || c.id,
        tags: c.tags || c.tagValues || {}
      }))
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    console.error('[AI Select API Error]', response.status, data);
    throw new Error(data.error || `AIサーバーエラー (${response.status})`);
  }

  return {
    selectedCardIds: Array.isArray(data.selectedCardIds) ? data.selectedCardIds : [],
    reason: data.reason || 'AIが判断を行いました'
  };
}
