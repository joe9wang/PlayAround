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

// Required to parse raw body for Stripe signature verification in Vercel
export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper: Read raw body Stream
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const firebaseUID = session.metadata.firebaseUID;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                if (firebaseUID) {
                    console.log(`Setting premium for user: ${firebaseUID}`);
                    await db.collection('users').doc(firebaseUID).set({
                        premium: true,
                        premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId
                    }, { merge: true });
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                // Find user by stripeCustomerId
                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        console.log(`Removing premium for user: ${doc.id}`);
                        batch.update(doc.ref, {
                            premium: false,
                            premiumSince: null
                            // Keeping customerId so we know they were a customer
                        });
                    });
                    await batch.commit();
                } else {
                    console.log(`No user found for canceled subscription customer: ${customerId}`);
                }
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}
