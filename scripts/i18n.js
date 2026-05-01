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

        "lobby.welcome": "バトライテーブルへようこそ！",
        "auth.login": "Googleでログイン",
        "auth.loginBtn": "ログインする",
        "auth.logout": "ログアウト",
        "app.mypage": "マイページ",

        "join.section": "既存ルームに参加（ゲスト）",
        "join.roomId": "参加するルームID",
        "join.roomId.ph": "例: room-1",
        "join.password": "入室パスワード（任意）",
        "join.password.ph": " ",
        "join.name": "プレイヤー名",
        "join.name.ph": "例: SOLVENTER",
        "join.chooseSeat": "座席を選択",
        "join.seat.spectator": "観戦",
        "join.start": "開始",

        "create.section": "新しいルームを作成（ホスト）",
        "create.roomId": "新しいルームID",
        "create.roomId.ph": "例: room-1",
        "create.password": "入室パスワード（任意）",
        "create.password.ph": " ",
        "create.name": "プレイヤー名",
        "create.name.ph": "例: SOLVENTER",
        "create.chooseSeat": "座席を選択",
        "create.seat.spectator": "観戦",
        "create.chooseMode": "ゲームの種類",
        "create.mode.card": "カードゲーム",
        "create.mode.board": "ボードゲーム",
        "create.mode.trump": "トランプ",
        "create.createBtn": "作成",
        "create.playerCount": "人数",
        "create.anonWarning.title": "⚠️ 注意",
        "create.anonWarning.message": "ログインしていない場合は、ルームは作成後24時間で削除されます。",
        "create.anonWarning.ok": "OK",
        "create.anonWarning.cancel": "戻る",

        // --- Side / Panel / Buttons ---
        "side.panel": "操作パネル",
        "side.panel.toggle": "操作パネルの表示/非表示",
        "side.saveRoom": "💾 ルームを保存",
        "side.save": "💾 セーブ",
        "side.load": "📂 ロード",
        "side.resetFacing": "↻ 全カード向きリセット",
        "side.faceDown": "🂠 全て裏に",
        "side.faceUp": "🂡 全て表に",
        "side.flipCoin": "🪙 コイントス",
        "side.rollD4": "🎲 4面ダイス",
        "side.rollD6": "🎲 6面ダイス",
        "side.rollD10": "🎲 10面ダイス",
        "side.rollD20": "🎲 20面ダイス",
        "side.rollD100": "🎲 100面ダイス",
        "side.shuffle": "⇅ デッキをシャッフル",
        "side.collectSelected": "❖ 選択カードをまとめる",
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
        "side.memo": "📝 メモ作成",
        "game.addCard": "🃏 カードを追加",
        "game.addCard.sub": "（画像をカードサイズにして生成）",
        "game.addToken": "♟ コマ・ボードを追加",
        "game.addToken.sub": "（画像のサイズを変えずに生成）",
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
        "preview.title": "選択中のカード",
        "preview.toggle": "選択中のカードの表示/非表示",
        "hp.title": "プレイヤーHP",
        "hp.header.seat": "座席",
        "hp.header.name": "プレイヤー名",
        "hp.header.points": "ポイント",

        // alerts
        "err.roomId": "ルームIDを入力してください",
        "err.playerName": "プレイヤー名を入力してください",
        "err.noSelectedCards": "カードが選択されていません。",
        "err.seat": "座席を選んでください",
        "err.passWrong": "パスワードが違います。",
        "err.hostAbsent": "ホストが不在のため、このルームには参加できません。",

        "spectator.warning": "現在は【観戦者】です（『座席に座る』ボタンから参加できます）",

        "auth.loggedIn": "ログインしました。",
        "auth.loggedOut": "ログアウトしました。",
        "auth.logoutFail": "ログアウトに失敗しました。",

        // --- Auth Form ---
        "auth.emailSection": "メールアドレスでログインする",
        "auth.emailPlaceholder": "メールアドレス",
        "auth.passwordPlaceholder": "パスワード",
        "auth.emailLoginBtn": "ログイン",
        "auth.forgotPassword": "パスワードを忘れた場合",
        "auth.snsSection": "SNS認証でログインする",
        "auth.loginGoogle": "Googleでログイン",
        "auth.noAccount": "アカウントをお持ちでない方",
        "auth.registerBtn": "新規アカウント作成",

        // --- Premium ---
        "premium.badge": "✨ Premium",
        "premium.register": "プレミアムに登録",
        "premium.registered": "プレミアム会員",
        "premium.since": "登録日",
        "premium.hint": "月額300円で特別な機能が使えます（近日公開）",
        "premium.status": "プレミアムステータス"
    },
    en: {
        "app.title": "Play board/card games with images (up to 4)",

        "links.privacy": "Privacy Policy",
        "links.terms": "Terms",
        "links.contact": "Contact",

        "lobby.welcome": "Welcome to BatriTable!",

        "auth.login": "Sign in with Google",
        "auth.loginBtn": "Sign in",
        "auth.logout": "Sign out",
        "app.mypage": "My Page",

        "join.section": "Join an existing room (Guest)",
        "join.roomId": "Room ID to join",
        "join.roomId.ph": "e.g., room-1",
        "join.password": " ",
        "join.password.ph": "Required if host set one",
        "join.name": "Player name",
        "join.name.ph": "e.g., SOLVENTER",
        "join.chooseSeat": "Choose your seat",
        "join.seat.spectator": "Spectator",
        "join.start": "Start",

        "create.section": "Create a new room (Host)",
        "create.roomId": "Create a new room",
        "create.roomId.ph": "e.g., room-1",
        "create.password": "Join password (optional)",
        "create.password.ph": " ",
        "create.name": "Player name",
        "create.name.ph": "e.g., SOLVENTER",
        "create.chooseSeat": "Choose your seat",
        "create.seat.spectator": "Spectator",
        "create.chooseMode": "Choose field layout",
        "create.mode.card": "Card game",
        "create.mode.board": "Board game",
        "create.mode.trump": "Playing cards",
        "create.createBtn": "Create",
        "create.playerCount": "Number of players",
        "create.anonWarning.title": "⚠️ Warning",
        "create.anonWarning.message": "If you are not logged in, the room will be deleted 24 hours after creation.",
        "create.anonWarning.ok": "OK",
        "create.anonWarning.cancel": "Back",

        // --- Side / Panel / Buttons ---
        "side.panel": "Control Panel",
        "side.panel.toggle": "Show/Hide control panel",
        "side.saveRoom": "💾 Save room",
        "side.save": "💾 Save",
        "side.load": "📂 Load",
        "side.resetFacing": "↻ Reset card orientation",
        "side.faceDown": "🂠 Face-down",
        "side.faceUp": "🂡 Face-up",
        "side.flipCoin": "🪙 flip a coin",
        "side.rollD4": "🎲 Roll a d4",
        "side.rollD6": "🎲 Roll a d6",
        "side.rollD10": "🎲 Roll a d10",
        "side.rollD20": "🎲 Roll a d20",
        "side.rollD100": "🎲 Roll a d100",
        "side.shuffle": "⇅ Shuffle my Deck",
        "side.collectSelected": "❖ Gather selected cards",
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
        "side.memo": "Create memo",
        "game.addCard": "🃏 Add Cards",
        "game.addCard.sub": "(Generate at card size)",
        "game.addToken": "♟ Add Piece/Board",
        "game.addToken.sub": "(Original size)",
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
        "preview.title": "Selected card",
        "preview.toggle": "Show/Hide selected card",
        "hp.title": "Players' HP",
        "hp.header.seat": "Seat",
        "hp.header.name": "Player",
        "hp.header.points": "Points",

        // alerts
        "err.roomId": "Please enter a Room ID.",
        "err.playerName": "Please enter your player name.",
        "err.noSelectedCards": "No cards selected.",
        "err.seat": "Please select a seat.",
        "err.passWrong": "Wrong password.",
        "err.hostAbsent": "The host is not available, so you can't join this room.",

        "spectator.warning": "Currently Spectating (Click 'Sit in a seat' to play)",

        "auth.loggedIn": "Signed in.",
        "auth.loggedOut": "Signed out.",
        "auth.logoutFail": "Failed to sign out.",

        // --- Auth Form ---
        "auth.emailSection": "Sign in with email",
        "auth.emailPlaceholder": "Email address",
        "auth.passwordPlaceholder": "Password",
        "auth.emailLoginBtn": "Sign in",
        "auth.forgotPassword": "Forgot your password?",
        "auth.snsSection": "Sign in with SNS",
        "auth.loginGoogle": "Sign in with Google",
        "auth.noAccount": "Don't have an account?",
        "auth.registerBtn": "Create new account",

        // --- Premium ---
        "premium.badge": "✨ Premium",
        "premium.register": "Go Premium",
        "premium.registered": "Premium Member",
        "premium.since": "Member since",
        "premium.hint": "Unlock special features for ¥300/mo (coming soon)",
        "premium.status": "Premium Status"
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
    function syncLangUI() {
        if (langSelHeader) langSelHeader.value = LANG;
    }
    if (langSelHeader) {
        langSelHeader.addEventListener('change', () => {
            setLang(langSelHeader.value);
            syncLangUI();
        });
    }
    syncLangUI();
    applyI18n();
}
