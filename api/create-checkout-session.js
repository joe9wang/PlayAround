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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(401).json({ error: 'Missing ID token' });
        }

        // Verify Firebase Auth Token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Check if user already has a Stripe customer ID
        const userDoc = await db.collection('users').doc(uid).get();
        const existingCustomerId = userDoc.exists ? userDoc.data().stripeCustomerId : null;

        let validCustomerId = null;
        if (existingCustomerId) {
            try {
                const customer = await stripe.customers.retrieve(existingCustomerId);
                if (customer && !customer.deleted) {
                    validCustomerId = existingCustomerId;
                } else {
                    console.warn(`Customer ${existingCustomerId} is deleted or invalid in Stripe. Clearing.`);
                    await db.collection('users').doc(uid).update({ stripeCustomerId: admin.firestore.FieldValue.delete() });
                }
            } catch (err) {
                // 'resource_missing' やテスト/本番キー不一致などの場合
                console.warn(`Failed to retrieve customer ${existingCustomerId}: ${err.message}. Clearing invalid customer ID.`);
                await db.collection('users').doc(uid).update({ stripeCustomerId: admin.firestore.FieldValue.delete() });
            }
        }

        const sessionParams = {
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID, // 500 JPY / mo
                    quantity: 1,
                },
            ],
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://batritable.com'}/mypage.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://batritable.com'}/mypage.html`,
            metadata: {
                firebaseUID: uid, // We need this in webhook to update firestore
            },
            allow_promotion_codes: true,
        };

        if (validCustomerId) {
            sessionParams.customer = validCustomerId;
        } else if (decodedToken.email) {
            sessionParams.customer_email = decodedToken.email;
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create(sessionParams);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        res.status(500).json({ error: error.message });
    }
}
