// ====================================================================
// i18n.js — 多言語対応
// 辞書データ (ja/en) と翻訳関数 t(), DOM適用関数 applyI18n() を提供。
// ====================================================================

const I18N = {
    ja: {
        "app.title": "画像で遊べるボドゲ・カードゲーム（最大4人）",

        "links.privacy": "プライバシーポリシー",
        "links.terms": "利用規約",
        "links.contact": "お問い合わせ",

        "lobby.welcome": "プレイアラウンドへようこそ！",
        "auth.login": "Googleでログイン",
        "auth.logout": "ログアウト",
        "app.mypage": "マイページ",

        "join.section": "既存ルームに参加（非ホスト）",
        "join.roomId": "参加するルームID",
        "join.roomId.ph": "例: SOLVENTER room-1",
        "join.password": "入室パスワード",
        "join.password.ph": "",
        "join.name": "プレイヤー名",
        "join.name.ph": "例: SOLVENTER",
        "join.chooseSeat": "座席を選択",
        "join.start": "開始",

        "create.section": "新しいルームを作成して参加（ホスト）",
        "create.roomId": "新しいルームを作成",
        "create.roomId.ph": "例: SOLVENTER room-1",
        "create.password": "入室パスワード（任意）",
        "create.password.ph": "",
        "create.name": "プレイヤー名",
        "create.name.ph": "例: SOLVENTER",
        "create.chooseSeat": "座席を選択",
        "create.chooseMode": "フィールド構成を選択",
        "create.mode.card": "🃏 カードゲーム",
        "create.mode.board": "🎲 ボードゲーム",
        "create.mode.trump": "🂠 トランプ",
        "create.createBtn": "作成",

        // --- Side / Panel / Buttons ---
        "side.panel": "操作パネル",
        "side.panel.toggle": "操作パネルの表示/非表示",
        "side.save": "💾 セーブ",
        "side.load": "📂 ロード",
        "side.resetFacing": "↻ 全カード向きリセット",
        "side.faceDown": "🂠 全て裏に",
        "side.faceUp": "🂡 全て表に",
        "side.flipCoin": "🪙 コイントス",
        "side.rollD6": "🎲 6面ダイス",
        "side.rollD10": "🎲 10面ダイス",
        "side.rollD20": "🎲 20面ダイス",
        "side.shuffle": "⇅ デッキをシャッフル",
        "side.collect": "❖ 全カードを集める",
        "side.allMyCards": "🔍 全カード一覧",
        "side.deckList": "🔍 デッキ一覧",
        "side.discardList": "🔍 捨て札一覧",
        "side.deleteMine": "🗑 全カードを削除",
        "side.deleteSelected": "🗑 指定カードを削除",
        "side.sendSelectedBack": "⇊ 指定カードを最背面",
        "side.numCounter": "🔢 数値カウンター",
        "side.plus1": "➕1",
        "side.plus10": "➕10",
        "side.plus50": "➕50",
        "side.plus100": "➕100",
        "side.minus1": "➖1",
        "side.minus10": "➖10",
        "side.minus50": "➖50",
        "side.minus100": "➖100",
        "side.token": "📝 トークン作成",
        "side.BackImage": "🖼 カード背景画像",
        "side.fieldSize": "フィールドサイズ変更",
        "side.sizeS": "小",
        "side.sizeM": "中",
        "side.sizeL": "大",

        // --- Zones ---
        "zone.special": "特殊エリア",
        "zone.play": "プレイエリア",
        "zone.discard": "捨て札エリア",
        "zone.deck": "デッキエリア",
        "zone.hand": "手札エリア",
        "zone.play.shared": "プレイエリア（共有）",
        "zone.deck.shared": "デッキエリア（共有）",
        "zone.discard.shared": "捨て札エリア（共有）",

        // --- Preview / Misc ---
        "preview.title": "選択肢のカード",
        "preview.toggle": "選択肢のカードの表示/非表示",
        "hp.title": "プレイヤーHP",

        // alerts
        "err.roomId": "ルームIDを入力してください",
        "err.playerName": "プレイヤー名を入力してください",
        "err.seat": "座席を選んでください",
        "err.passWrong": "パスワードが違います。",
        "err.hostAbsent": "ホストが不在のため、このルームには参加できません。",

        "auth.loggedIn": "ログインしました。",
        "auth.loggedOut": "ログアウトしました。",
        "auth.logoutFail": "ログアウトに失敗しました。"
    },
    en: {
        "app.title": "Play board/card games with images (up to 4)",

        "links.privacy": "Privacy Policy",
        "links.terms": "Terms",
        "links.contact": "Contact",

        "lobby.welcome": "Welcome to PlayAround!",

        "auth.login": "Sign in with Google",
        "auth.logout": "Sign out",
        "app.mypage": "My Page",

        "join.section": "Join an existing room (Guest)",
        "join.roomId": "Room ID to join",
        "join.roomId.ph": "e.g., SOLVENTER room-1",
        "join.password": "",
        "join.password.ph": "Required if host set one",
        "join.name": "Player name",
        "join.name.ph": "e.g., SOLVENTER",
        "join.chooseSeat": "Choose your seat",
        "join.start": "Start",

        "create.section": "Create a new room (Host)",
        "create.roomId": "Create a new room",
        "create.roomId.ph": "e.g., SOLVENTER room-1",
        "create.password": "Join password (optional)",
        "create.password.ph": "",
        "create.name": "Player name",
        "create.name.ph": "e.g., SOLVENTER",
        "create.chooseSeat": "Choose your seat",
        "create.chooseMode": "Choose field layout",
        "create.mode.card": "🃏 Card game",
        "create.mode.board": "🎲 Board game",
        "create.mode.trump": "🂠 Playing cards",
        "create.createBtn": "Create",

        // --- Side / Panel / Buttons ---
        "side.panel": "Control Panel",
        "side.panel.toggle": "Show/Hide control panel",
        "side.save": "💾 Save",
        "side.load": "📂 Load",
        "side.resetFacing": "↻ Reset card orientation",
        "side.faceDown": "🂠 Face-down",
        "side.faceUp": "🂡 Face-up",
        "side.flipCoin": "🪙 flip a coin",
        "side.rollD6": "🎲 Roll a d6",
        "side.rollD10": "🎲 Roll a d10",
        "side.rollD20": "🎲 Roll a d20",
        "side.shuffle": "⇅ Shuffle my Deck",
        "side.collect": "❖ Gather my cards",
        "side.allMyCards": "🔍 All my cards",
        "side.deckList": "🔍 My deck-area cards",
        "side.discardList": "🔍 My discard-area cards",
        "side.deleteMine": "🗑 Delete all my cards",
        "side.deleteSelected": "🗑 Delete selected card",
        "side.sendSelectedBack": "⇊ Send selected card to back",
        "side.numCounter": "Number counter",
        "side.plus1": "➕1 counter",
        "side.plus10": "➕10 counter",
        "side.plus50": "➕50 counter",
        "side.plus100": "➕100 counter",
        "side.minus1": "➖1 counter",
        "side.minus10": "➖10 counter",
        "side.minus50": "➖50 counter",
        "side.minus100": "➖100 counter",
        "side.token": "Create token",
        "side.BackImage": "Back Image",
        "side.fieldSize": "Change field size",
        "side.sizeS": "Small",
        "side.sizeM": "Medium",
        "side.sizeL": "Large",

        // --- Zones ---
        "zone.special": "Special",
        "zone.play": "Play area",
        "zone.discard": "Discard",
        "zone.deck": "Deck",
        "zone.hand": "Hand",
        "zone.play.shared": "Shared play area",
        "zone.deck.shared": "Shared deck area",
        "zone.discard.shared": "Shared discard area",

        // --- Preview / Misc ---
        "preview.title": "Candidate cards",
        "preview.toggle": "Show/Hide candidate cards",
        "hp.title": "Players' HP",

        // alerts
        "err.roomId": "Please enter a Room ID.",
        "err.playerName": "Please enter your player name.",
        "err.seat": "Please select a seat.",
        "err.passWrong": "Wrong password.",
        "err.hostAbsent": "The host is not available, so you can't join this room.",

        "auth.loggedIn": "Signed in.",
        "auth.loggedOut": "Signed out.",
        "auth.logoutFail": "Failed to sign out."
    }
};

// 地域ベースのデフォルト：日本(Asia/Tokyo)ならja、それ以外はen
function defaultLangByRegion() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz === 'Asia/Tokyo') return 'ja';
    } catch (_) { }
    return 'en';
}

let LANG = (localStorage.getItem('lang') || '').toLowerCase();
if (!['ja', 'en'].includes(LANG)) LANG = defaultLangByRegion();
document.documentElement.lang = LANG;

export function t(key) {
    return (I18N[LANG] && I18N[LANG][key]) || I18N.ja[key] || key;
}

export function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

export function setLang(lang) {
    LANG = lang;
    localStorage.setItem('lang', LANG);
    document.documentElement.lang = LANG;
    applyI18n();
}

export function getLang() { return LANG; }

// 初期適用
export function initI18n() {
    const langSelHeader = document.getElementById('lang-switch');
    const langSelLobby = document.getElementById('lang-switch-lobby');
    function syncLangUI() {
        if (langSelHeader) langSelHeader.value = LANG;
        if (langSelLobby) langSelLobby.value = LANG;
    }
    [langSelHeader, langSelLobby].forEach(sel => {
        sel && sel.addEventListener('change', () => {
            setLang(sel.value);
            syncLangUI();
        });
    });
    syncLangUI();
    applyI18n();
}
