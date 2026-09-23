const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'solventer.com@gmail.com',
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

/**
 * プレミアム会員登録完了時のお礼・案内メールを送信する
 */
async function sendPremiumWelcomeEmail({ email, displayName }) {
  if (!email) {
    console.warn('[Email] No email address provided. Skipping welcome email.');
    return false;
  }
  if (!process.env.GMAIL_APP_PASS) {
    console.warn('[Email] Missing GMAIL_APP_PASS. Skipping welcome email.');
    return false;
  }

  const transporter = getTransporter();
  const name = displayName || email.split('@')[0] || 'ユーザー';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://batritable.com';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #333333; line-height: 1.6;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #7c3aed; margin: 0 0 8px; font-size: 22px; font-weight: 800;">✨ BatriTable プレミアム会員へようこそ！</h1>
        <p style="color: #64748b; font-size: 14px; margin: 0;">ご登録いただき、誠にありがとうございます。</p>
      </div>

      <p style="font-size: 15px; margin-bottom: 16px;"><strong>${name} 様</strong></p>

      <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
        この度は、BatriTable プレミアムプラン（月額 500 円）にご登録いただき、心より感謝申し上げます。<br>
        お支払いが正常に完了し、あなたのアカウントでプレミアム会員の全機能が有効化されました！
      </p>

      <div style="background: linear-gradient(135deg, #f5f3ff, #faf5ff); border: 1px solid #ddd6fe; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
        <h3 style="color: #6d28d9; margin-top: 0; margin-bottom: 12px; font-size: 15px;">🎁 プレミアム会員の限定特典</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.8;">
          <li><strong>マイセット保存枠の大幅拡張</strong>: 最大100スロット（10スロット×10ページ）まで自由に保存可能</li>
          <li><strong>高画質・大容量画像アップロード</strong>: 1枚あたり最大20MBまで対応</li>
          <li><strong>ルーム作成が無制限</strong>: 1日の作成制限なし、最大100部屋まで同時に保持可能</li>
          <li><strong>1部屋あたり最大1,000枚のカード</strong> を配置可能</li>
          <li><strong>盤面・裏面デザイン</strong> の自由なカスタマイズ</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${siteUrl}/mypage.html" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; padding: 13px 32px; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 15px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
          マイページを開いて特典を利用する
        </a>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #64748b;">
        <h4 style="margin: 0 0 8px; color: #334155; font-size: 14px;">💳 ご契約内容とご解約について</h4>
        <p style="margin: 0 0 8px;">
          ・本プランは月額 500 円（税込）の自動更新サブスクリプションです。<br>
          ・次回更新日までは追加料金なくすべての機能をご利用いただけます。
        </p>
        <p style="margin: 0;">
          ・ご契約内容の確認、お支払い方法の変更、またはご解約は、いつでも <a href="${siteUrl}/mypage.html" style="color: #7c3aed; text-decoration: underline;">マイページ</a> の「サブスクリプションを管理」ボタンからワンクリックでお手続きいただけます。<br>
          ※解約された場合でも、すでに決済済みの期間終了日まではプレミアム機能を引き続きご利用いただけます。
        </p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;">

      <div style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;">
        <p style="margin: 0 0 4px;">ご不明な点やお気づきの点がございましたら、お気軽に <a href="${siteUrl}/contact.html" style="color: #7c3aed;">お問い合わせ</a> よりご連絡ください。</p>
        <p style="margin: 0;">&copy; 2026 BatriTable チーム - <a href="${siteUrl}" style="color: #94a3b8; text-decoration: none;">https://batritable.com</a></p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"BatriTable" <${process.env.GMAIL_USER || 'solventer.com@gmail.com'}>`,
      to: email,
      subject: '【BatriTable】プレミアム会員へのご登録ありがとうございます！',
      html: html,
    });
    console.log(`[Email] Premium welcome email sent successfully to ${email}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send premium welcome email to ${email}:`, err);
    return false;
  }
}

module.exports = {
  sendPremiumWelcomeEmail
};
