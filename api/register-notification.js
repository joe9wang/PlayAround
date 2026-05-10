// api/register-notification.js
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, lang } = body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // SMTP settings from environment variables
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // If no SMTP config, log and return (allows development without erroring)
    if (!config.auth.user || !config.auth.pass) {
      console.warn('[register-notification] Missing SMTP credentials. Skipping email.');
      res.status(200).json({ ok: true, note: 'SMTP not configured' });
      return;
    }

    const transporter = nodemailer.createTransport(config);

    const isJa = lang === 'ja';
    const subject = isJa ? 'BatriTable アカウント作成完了のお知らせ' : 'Welcome to BatriTable - Account Created';
    
    const text = isJa 
      ? `BatriTable へようこそ！\n\nアカウントの作成が正常に完了しました。\nこれからはマイセットの保存や、自分専用のルーム作成が可能になります。\n\nお楽しみください！\n\nhttps://batritable.com`
      : `Welcome to BatriTable!\n\nYour account has been successfully created.\nYou can now save your My Sets and create your own rooms.\n\nEnjoy!\n\nhttps://batritable.com`;

    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #0a7;">${isJa ? 'BatriTable へようこそ！' : 'Welcome to BatriTable!'}</h2>
        <p>${isJa ? 'アカウントの作成が正常に完了しました。' : 'Your account has been successfully created.'}</p>
        <p>${isJa ? 'これからは以下の機能が利用可能です：' : 'You can now use the following features:'}</p>
        <ul>
          <li>${isJa ? 'マイセットの保存（最大10スロット）' : 'Save My Sets (up to 10 slots)'}</li>
          <li>${isJa ? '自分専用ルームの作成と管理' : 'Create and manage your own rooms'}</li>
          <li>${isJa ? 'プレミアム機能への登録（準備中）' : 'Premium membership (coming soon)'}</li>
        </ul>
        <p><a href="https://batritable.com" style="display: inline-block; padding: 10px 20px; background: #0a7; color: #fff; text-decoration: none; border-radius: 6px;">
          ${isJa ? 'サイトへ移動' : 'Go to Site'}
        </a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">BatriTable Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"BatriTable" <${process.env.SMTP_FROM || config.auth.user}>`,
      to: email,
      subject: subject,
      text: text,
      html: html,
    });

    console.log(`[register-notification] Welcome email sent to: ${email}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[register-notification] Error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
};
