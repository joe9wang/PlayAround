const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendPremiumWelcomeEmail } = require('./_email');

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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken, sessionId } = req.body || {};
        if (!idToken) {
            return res.status(401).json({ error: 'Missing ID token' });
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        // 1. If sessionId is provided (returning from checkout)
        if (sessionId) {
            try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
                    if (session.metadata?.firebaseUID === uid || session.customer_details?.email === email) {
                        const userDoc = await db.collection('users').doc(uid).get();
                        const userData = userDoc.exists ? userDoc.data() : {};
                        const emailToSend = email || userData.email || session.customer_details?.email;

                        await db.collection('users').doc(uid).set({
                            premium: true,
                            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                            stripeCustomerId: session.customer,
                            stripeSubscriptionId: session.subscription,
                            welcomeEmailSent: true,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        if (!userData.welcomeEmailSent && emailToSend) {
                            sendPremiumWelcomeEmail({ email: emailToSend, displayName: userData.displayName }).catch(console.error);
                        }

                        return res.status(200).json({ ok: true, premium: true });
                    }
                }
            } catch (err) {
                console.warn('[sync-subscription] Session verification error:', err.message);
            }
        }

        // 2. Otherwise check Stripe by customerId or email
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        let customerId = userData.stripeCustomerId;

        // Look for customer in Stripe if not set
        if (!customerId && email) {
            const customers = await stripe.customers.list({ email: email, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            }
        }

        if (customerId) {
            const subs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1
            });

            const isActive = subs.data.length > 0;
            if (isActive) {
                await db.collection('users').doc(uid).set({
                    premium: true,
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subs.data[0].id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                return res.status(200).json({ ok: true, premium: true });
            }
        }

        res.status(200).json({ ok: true, premium: !!userData.premium });
    } catch (error) {
        console.error('Sync Subscription Error:', error);
        res.status(500).json({ error: error.message });
    }
};
