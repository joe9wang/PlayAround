// ====================================================================
// premium.js — プレミアム会員状態管理
// Firestore の users/{uid} ドキュメントからプレミアム状態を読み取り、
// UI に反映するためのユーティリティを提供する。
// ====================================================================

import { db, doc, getDoc, onSnapshot } from './firebase.init.js';

// ===== プレミアム / 非課金 制限定数 =====
export const LIMITS = {
    FREE: {
        roomsPerDay: 5,
        cardsPerRoom: 100,
        maxImageMB: 1,
        saveSlots: 0,
        roomSaveSlots: 0,
    },
    PREMIUM: {
        roomsPerDay: Infinity,
        cardsPerRoom: 500,
        maxImageMB: 10,
        saveSlots: 10,
        roomSaveSlots: 10,
    }
};

/** 現在のユーザー種別に応じた制限値を返す */
export function getLimits(isPremium) {
    return isPremium ? LIMITS.PREMIUM : LIMITS.FREE;
}

/**
 * プレミアム会員かどうかを1回だけ取得
 * @param {string} uid
 * @returns {Promise<{premium: boolean, premiumSince: Date|null}>}
 */
export async function fetchPremiumStatus(uid) {
    if (!uid) return { premium: false, premiumSince: null };
    try {
        const snap = await getDoc(doc(db, `users/${uid}`));
        if (!snap.exists()) return { premium: false, premiumSince: null };
        const data = snap.data() || {};
        return {
            premium: !!data.premium,
            premiumSince: data.premiumSince?.toDate?.() || null,
        };
    } catch (e) {
        console.warn('[premium] fetchPremiumStatus failed:', e);
        return { premium: false, premiumSince: null };
    }
}

/**
 * プレミアム状態をリアルタイムで監視
 * @param {string} uid
 * @param {(status: {premium: boolean, premiumSince: Date|null}) => void} callback
 * @returns {() => void} unsubscribe 関数
 */
export function onPremiumChange(uid, callback) {
    if (!uid) {
        callback({ premium: false, premiumSince: null });
        return () => { };
    }
    return onSnapshot(doc(db, `users/${uid}`), (snap) => {
        if (!snap.exists()) {
            callback({ premium: false, premiumSince: null });
            return;
        }
        const data = snap.data() || {};
        callback({
            premium: !!data.premium,
            premiumSince: data.premiumSince?.toDate?.() || null,
        });
    }, (err) => {
        console.warn('[premium] onPremiumChange error:', err);
        callback({ premium: false, premiumSince: null });
    });
}

/**
 * プレミアムバッジの HTML 文字列を返す
 * @param {boolean} isPremium
 * @returns {string}
 */
export function premiumBadgeHTML(isPremium) {
    if (!isPremium) return '';
    return '<span class="premium-badge">✨ Premium</span>';
}

/**
 * プレミアムステータス表示用の HTML 文字列を返す（マイページ用）
 * @param {{premium: boolean, premiumSince: Date|null}} status
 * @param {(key: string) => string} t — i18n 翻訳関数
 * @returns {string}
 */
export function premiumStatusHTML(status, t) {
    if (status.premium) {
        const since = status.premiumSince
            ? status.premiumSince.toLocaleDateString()
            : '—';
        return `
            <div class="premium-status premium-active">
                <span class="premium-badge">✨ Premium</span>
                <span class="premium-since">${t('premium.since')}: ${since}</span>
            </div>`;
    }
    return `
        <div class="premium-status premium-inactive">
            <button class="btn-premium-register" id="btn-premium-register" disabled>
                ${t('premium.register')}
            </button>
            <span class="premium-hint">${t('premium.hint')}</span>
        </div>`;
}
