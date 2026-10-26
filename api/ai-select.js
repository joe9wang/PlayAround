// api/ai-select.js
// CPU の AI カード選択（OpenAI gpt-4o-mini）をサーバー側で中継する。
// - OpenAI API キーは Vercel 環境変数 OPENAI_API_KEY にのみ保存（ブラウザには一切出さない）
// - Firebase ID トークンでログインユーザーのみに制限
// - ユーザーごとの1日あたり呼び出し回数を Firestore で制限（料金の暴走防止）
const admin = require('firebase-admin');

const DAILY_LIMIT_PER_USER = Number(process.env.AI_DAILY_LIMIT || 300);
const MAX_RULE_LENGTH = 2000;
const MAX_CANDIDATES = 100;
const MAX_CONTEXT_CHARS = 20000;

function initAdmin() {
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const projectId   = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert({ project_id: projectId, client_email: clientEmail, private_key: privateKey }) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(json) });
    } else {
      throw new Error('Missing Firebase admin credentials in env vars.');
    }
  }
}

// 1日あたりの利用回数をカウントし、上限超過なら false
async function consumeDailyQuota(db, uid) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // UTC日付 YYYYMMDD
  const ref = db.doc(`aiUsage/${uid}_${day}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= DAILY_LIMIT_PER_USER) return false;
    tx.set(ref, {
      uid,
      day,
      count: count + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  });
}

function buildPrompts({ ruleText, candidateCards, visibleContext, cpuPlayerLabel }) {
  const systemPrompt = `あなたはカードゲームの優秀なAIプレイヤー（${cpuPlayerLabel}）です。
プレイヤーから提供された「ゲームルール」と「現在の盤面情報（あなたが見えているカード）」を理解し、
指定された「選択候補カード」の中から、ルールに従って出すべきカード（1枚または複数枚、あるいは何も出さない）を論理的に判断してください。

【重要な行動原則】
1. 現在の場（プレイエリア・バトルゾーン等）にカードが1枚も出ていない場合（初手や場が流れた直後など）：
   ゲームを進行させるため、パスせずに手札の中からルールに最も適したカード（特に指示がなければ一番弱いカードや出しやすいカードなど）を必ず1枚以上選んで場に出してください。
2. すでに場にカードが出ている場合：
   場のカードに対してルールを満たすカードを手札から選択してください。出せるカードがない場合や、戦略的にカードを温存してパスすべき場合は selectedCardIds を空配列 [] にしてください。

回答は必ず以下のJSON形式のみを出力してください（Markdownコードブロックは不要です）：
{
  "selectedCardIds": ["card_id1", ...],
  "reason": "思考理由（なぜそのカードを選んだか、またはなぜパスしたかを日本語で1〜2文で簡潔に）"
}
selectedCardIds には選択候補カードの id のみを入れてください。出せるカードがない場合は空配列 [] にしてください。`;

  const contextJson = JSON.stringify(visibleContext || {}, null, 2).slice(0, MAX_CONTEXT_CHARS);

  const userPrompt = `【ゲームルール】
${ruleText || '場に出ているカードの数字より大きいカードを手札から1枚出してください。出せるカードがなければパス（選択なし）してください。'}

【盤面の状況（あなたに見えている情報）】
${contextJson}

【あなたの手札・選択候補（ここから選んでください）】
${JSON.stringify(candidateCards, null, 2)}

ルールに従い、どのカードを選択するかJSON形式で回答してください。`;

  return { systemPrompt, userPrompt };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'サーバーに OPENAI_API_KEY が設定されていません。' });
      return;
    }

    initAdmin();
    const db = admin.firestore();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { idToken, ruleText, candidateCards, visibleContext, cpuPlayerLabel } = body;

    // 1. 認証
    if (!idToken) { res.status(401).json({ error: 'ログインが必要です (idToken required)' }); return; }
    const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
    if (!decoded || !decoded.uid) { res.status(401).json({ error: 'invalid token' }); return; }

    // 2. 入力チェック
    if (!Array.isArray(candidateCards) || candidateCards.length === 0) {
      res.status(200).json({ selectedCardIds: [], reason: '選択候補のカードがありません' });
      return;
    }
    if (candidateCards.length > MAX_CANDIDATES) {
      res.status(400).json({ error: `候補カードが多すぎます (最大${MAX_CANDIDATES}枚)` });
      return;
    }
    const safeRule = String(ruleText || '').slice(0, MAX_RULE_LENGTH);
    const safeLabel = String(cpuPlayerLabel || 'CPU').slice(0, 50);
    const safeCandidates = candidateCards.map(c => ({
      id: String(c && c.id || ''),
      name: String(c && c.name || c && c.id || '').slice(0, 100),
      tags: (c && typeof c.tags === 'object' && c.tags) ? c.tags : {}
    })).filter(c => c.id);

    // 3. 利用回数制限
    const allowed = await consumeDailyQuota(db, decoded.uid);
    if (!allowed) {
      res.status(429).json({ error: `本日のAI思考の利用上限（${DAILY_LIMIT_PER_USER}回）に達しました` });
      return;
    }

    // 4. OpenAI 呼び出し
    const { systemPrompt, userPrompt } = buildPrompts({
      ruleText: safeRule,
      candidateCards: safeCandidates,
      visibleContext,
      cpuPlayerLabel: safeLabel
    });

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.2,
        max_tokens: 300
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[ai-select] OpenAI error', aiRes.status, errText);
      res.status(502).json({ error: `OpenAI API エラー (${aiRes.status})` });
      return;
    }

    const data = await aiRes.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    let parsed = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.error('[ai-select] JSON parse failed', rawContent);
      res.status(200).json({ selectedCardIds: [], reason: 'AIレスポンスの解析に失敗しました' });
      return;
    }

    // 候補に存在するIDだけを返す（AIのでっち上げIDを除外）
    const validIds = new Set(safeCandidates.map(c => c.id));
    const selectedCardIds = (Array.isArray(parsed.selectedCardIds) ? parsed.selectedCardIds : [])
      .map(String)
      .filter(id => validIds.has(id));

    res.status(200).json({
      selectedCardIds,
      reason: String(parsed.reason || 'AIが判断を行いました').slice(0, 200)
    });
  } catch (e) {
    console.error('[ai-select]', e);
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
