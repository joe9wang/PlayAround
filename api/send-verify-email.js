const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

function initAdmin() {
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
      });
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          project_id: process.env.FIREBASE_PROJECT_ID,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    } else {
      throw new Error('Missing Firebase admin credentials.');
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let stage = 'init';
  try {
    stage = 'initAdmin';
    initAdmin();
    const auth = admin.auth();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { idToken, lang } = body;

    if (!idToken) {
      return res.status(401).json({ error: 'idToken required' });
    }

    stage = 'verifyIdToken';
    // 1. Verify the ID Token and get user info
    const decodedToken = await auth.verifyIdToken(idToken);
    const email = decodedToken.email;
    const displayName = decodedToken.name || '';

    if (!email) {
      return res.status(400).json({ error: 'Email not found in token' });
    }

    stage = 'generateLink';
    // 2. Generate the verification link
    const actionCodeSettings = {
      url: 'https://batritable.com/lobby.html',
      handleCodeInApp: false,
    };
    
    const link = await auth.generateEmailVerificationLink(email, actionCodeSettings);

    stage = 'setupTransporter';
    // 3. Setup Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'solventer.com@gmail.com',
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    stage = 'composeEmail';
    // 4. Compose Email
    const isJa = (lang === 'ja');
    const subject = isJa ? '【BatriTable】メールアドレスの確認' : '[BatriTable] Email Verification';
    
    const htmlContent = isJa ? `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #b350be;">BatriTable へようこそ！</h2>
        <p>${displayName ? displayName + ' 様' : 'ユーザー 様'}</p>
        <p>BatriTable へのご登録ありがとうございます。以下のボタンをクリックして、メールアドレスの確認を完了してください。</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background-color: #3cd08e; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px;">メールアドレスを確認する</a>
        </div>
        <p style="font-size: 0.9em; color: #666;">もし上のボタンが表示されない場合は、以下のリンクをブラウザに貼り付けてください：<br>
        <a href="${link}">${link}</a></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #999;">このメールに心当たりがない場合は、破棄してください。</p>
        <p style="font-size: 0.8em; color: #999;">&copy; 2026 BatriTable チーム</p>
      </div>
    ` : `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #b350be;">Welcome to BatriTable!</h2>
        <p>Dear ${displayName || 'User'},</p>
        <p>Thank you for registering with BatriTable. Please click the button below to verify your email address.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background-color: #3cd08e; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify Email Address</a>
        </div>
        <p style="font-size: 0.9em; color: #666;">If the button doesn't work, please copy and paste the following link into your browser:<br>
        <a href="${link}">${link}</a></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #999;">If you did not request this, please ignore this email.</p>
        <p style="font-size: 0.8em; color: #999;">&copy; 2026 BatriTable Team</p>
      </div>
    `;

    stage = 'sendEmail';
    // 5. Send Email
    await transporter.sendMail({
      from: '"BatriTable" <noreply@batritable.com>',
      to: email,
      subject: subject,
      html: htmlContent,
    });

    console.log(`[API] Verification email sent to ${email}`);
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error(`[API] Error at stage "${stage}":`, error);
    res.status(500).json({ error: error.message || 'Internal Server Error', stage });
  }
};
