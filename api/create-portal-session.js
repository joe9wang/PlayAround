const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(401).json({ error: 'Missing ID token' });
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Fetch user from Firestore to get their Stripe Customer ID
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found in Firestore' });
        }

        const stripeCustomerId = userDoc.data().stripeCustomerId;
        if (!stripeCustomerId) {
            return res.status(400).json({ error: 'User has no active Stripe subscription.' });
        }

        // Create a portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.batritable.com'}/mypage.html`,
        });

        res.status(200).json({ url: portalSession.url });
    } catch (error) {
        console.error('Stripe Portal Error:', error);
        res.status(500).json({ error: error.message });
    }
}
