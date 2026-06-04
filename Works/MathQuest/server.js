require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'questions.json');

// OpenAI クライアント (APIキーが設定されていない場合はnull)
const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('ここに')
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

// JSONボディのパース
app.use(express.json());

// index.html を静的ファイルとして配信
app.use(express.static(__dirname));

// ─── API エンドポイント ───────────────────────────────────────────────────

// GET /api/questions : 全問題データを返す
app.get('/api/questions', (req, res) => {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        res.json(data);
    } catch (err) {
        console.error('Failed to read questions.json:', err);
        res.status(500).json({ error: 'データの読み込みに失敗しました。' });
    }
});

// POST /api/questions : 全問題データを上書き保存する
app.post('/api/questions', (req, res) => {
    try {
        const data = req.body;
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'リクエストボディはJSON配列である必要があります。' });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to write questions.json:', err);
        res.status(500).json({ error: 'データの保存に失敗しました。' });
    }
});

// POST /api/generate-similar : 苦手問題の類題をAIで生成する
app.post('/api/generate-similar', async (req, res) => {
    if (!openai) {
        return res.status(503).json({ error: 'OpenAI APIキーが設定されていません。.envファイルを確認してください。' });
    }

    const { category, theme, weapon, questionText } = req.body;
    if (!category || !theme) {
        return res.status(400).json({ error: 'category と theme は必須です。' });
    }

    const prompt = `あなたは優秀な数学教師です。以下の問題と同じ分野・難易度の「類題」を1問作成してください。

【元の問題情報】
- 分野: ${category}
- テーマ: ${theme}
- 習得すべき武器（解法のポイント）: ${weapon || '未設定'}
- 問題文: ${questionText || '（問題文なし）'}

【出力形式】
以下のJSON形式で厳密に返してください。他の文字は一切含めないでください。
{
  "theme": "（類題のテーマ・概要を30文字以内で）",
  "weapon": "（この類題で習得すべき思考の型・ポイントを40文字以内で）",
  "questionText": "（具体的な問題文。数式はLaTeX記法で $...$ または $$...$$ を使用）",
  "answer": "（模範解答。数式はLaTeX記法を使用。ステップを分かりやすく記述）"
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1500,
        });

        const content = completion.choices[0].message.content.trim();

        // JSONのみを抽出（```json ``` で囲まれている場合も対応）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AIの返答からJSONを抽出できませんでした');
        }

        const generated = JSON.parse(jsonMatch[0]);
        generated.category = category; // 元と同じカテゴリを設定

        res.json(generated);
    } catch (err) {
        console.error('Failed to generate similar question:', err);
        res.status(500).json({ error: `類題の生成に失敗しました: ${err.message}` });
    }
});

// ─── サーバー起動 ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`✅ MathQuest サーバー起動中: http://localhost:${PORT}`);
    if (!openai) {
        console.log('⚠️  OpenAI APIキー未設定: 類題生成機能は無効です (.env を設定してください)');
    }
});
