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

// Helper: Read raw body Stream
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let buf;
    try {
        buf = await buffer(req);
    } catch (e) {
        console.error('Buffer error:', e);
        buf = Buffer.from('');
    }

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
                const firebaseUID = session.metadata?.firebaseUID;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                if (firebaseUID) {
                    console.log(`Setting premium for user: ${firebaseUID}`);
                    await db.collection('users').doc(firebaseUID).set({
                        premium: true,
                        premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } else if (customerId) {
                    // Fallback: look up user by email or customerId
                    try {
                        const customer = await stripe.customers.retrieve(customerId);
                        if (customer?.email) {
                            const snap = await db.collection('users').where('email', '==', customer.email).get();
                            if (!snap.empty) {
                                for (const doc of snap.docs) {
                                    await doc.ref.set({
                                        premium: true,
                                        premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                                        stripeCustomerId: customerId,
                                        stripeSubscriptionId: subscriptionId,
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    }, { merge: true });
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[webhook] Customer lookup fallback error:', e);
                    }
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
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                } else {
                    console.log(`No user found for canceled subscription customer: ${customerId}`);
                }
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                const isActive = (subscription.status === 'active' || subscription.status === 'trialing');

                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        console.log(`Updating premium for user ${doc.id} to ${isActive} (status: ${subscription.status})`);
                        batch.update(doc.ref, {
                            premium: isActive,
                            stripeSubscriptionId: subscription.id,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                } else {
                    // If no user has stripeCustomerId yet, check by customer email
                    try {
                        const customer = await stripe.customers.retrieve(customerId);
                        if (customer?.email) {
                            const emailSnap = await usersRef.where('email', '==', customer.email).get();
                            if (!emailSnap.empty) {
                                const batch = db.batch();
                                emailSnap.forEach(doc => {
                                    batch.set(doc.ref, {
                                        premium: isActive,
                                        stripeCustomerId: customerId,
                                        stripeSubscriptionId: subscription.id,
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    }, { merge: true });
                                });
                                await batch.commit();
                            }
                        }
                    } catch (e) {
                        console.warn('[webhook] Customer lookup error:', e);
                    }
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

// Export handler first, then attach config for Vercel
module.exports = handler;
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
