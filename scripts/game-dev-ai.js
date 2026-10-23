/**
 * game-dev-ai.js
 * BatriTable Developer Mode - OpenAI (ChatGPT) 連携モジュール
 * 自然言語ルールに基づいて盤面（可視カード）から最適なカードをJSON推論・選択する
 */

// ローカルストレージキー
const STORAGE_KEY_OPENAI = 'batritable_openai_api_key';

export function getOpenAiApiKey() {
  const saved = localStorage.getItem(STORAGE_KEY_OPENAI);
  if (saved && saved.trim()) return saved.trim();
  return '';
}

export function setOpenAiApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(STORAGE_KEY_OPENAI, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_OPENAI);
  }
}

/**
 * ChatGPT APIを呼び出してカードを選択させる
 * @param {Object} params
 * @param {string} params.ruleText - ユーザーが入力した自然言語ゲームルール
 * @param {Array} params.candidateCards - 選択候補となるカード配列 (例: 自分の手札)
 * @param {Object} params.visibleContext - 盤面で見えている全エリアとカードの情報
 * @param {string} params.cpuPlayerLabel - 思考中のCPUプレイヤー名 (例: "P2 (プレイヤー2)")
 * @returns {Promise<{ selectedCardIds: string[], reason: string }>}
 */
export async function queryAiCardSelection({ ruleText, candidateCards, visibleContext, cpuPlayerLabel = 'CPU' }) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  // 1. プロンプト用データの構築
  const systemPrompt = `あなたはカードゲームの優秀なAIプレイヤー（${cpuPlayerLabel}）です。
プレイヤーから提供された「ゲームルール」と「現在の盤面情報（あなたが見えているカード）」を理解し、
指定された「選択候補カード」の中から、ルールに従って出すべきカード（1枚または複数枚、あるいは何も出さない）を論理的に判断してください。

回答は必ず以下のJSON形式のみを出力してください（Markdownコードブロックは不要です）：
{
  "selectedCardIds": ["card_id1", ...], // 選択するカードのID配列。出せるカードがない場合は空配列 []
  "reason": "思考理由（なぜそのカードを選んだか、またはなぜパスしたかを日本語で1〜2文で簡潔に）"
}`;

  const userPrompt = `【ゲームルール】
${ruleText || '場に出ているカードの数字より大きいカードを手札から1枚出してください。出せるカードがなければパス（選択なし）してください。'}

【盤面の状況（あなたに見えている情報）】
${JSON.stringify(visibleContext, null, 2)}

【あなたの手札・選択候補（ここから選んでください）】
${JSON.stringify(candidateCards.map(c => ({
    id: c.id,
    name: c.name || c.id,
    tags: c.tags || c.tagValues || {}
  })), null, 2)}

ルールに従い、どのカードを選択するかJSON形式で回答してください。`;

  // 2. OpenAI API リクエスト (gpt-4o-mini, response_format: json_object)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[OpenAI API Error]', response.status, errText);
    throw new Error(`OpenAI API エラー (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const parsed = JSON.parse(rawContent);
    const selectedIds = Array.isArray(parsed.selectedCardIds) ? parsed.selectedCardIds : [];
    const reason = parsed.reason || 'AIが判断を行いました';
    return { selectedCardIds: selectedIds, reason };
  } catch (e) {
    console.error('Failed to parse AI response JSON:', rawContent, e);
    return { selectedCardIds: [], reason: 'AIレスポンスの解析に失敗しました' };
  }
}
