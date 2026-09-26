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
        "auth.rejoinCreatedRoom": "🚪 作成したルームに入る",
        "auth.logout": "ログアウト",
        "app.mypage": "マイページ",
        "mypage.profile": "プロフィール",
        "mypage.back": "← ゲームへ戻る",
        "nav.home": "ホーム",
        "nav.lobby": "ロビー",
        "nav.howto": "遊び方",
        "nav.plans": "プラン",
        "nav.about": "運営者情報",
        "nav.privacy": "プライバシー",
        "nav.terms": "利用規約",
        "nav.contact": "お問い合わせ",

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
        "create.anonWarning.message": "ログインしていない場合は、ルームは作成後24時間で削除されます。<br>※ 未ログイン状態でのルーム作成は24時間に1回までとなります。",
        "create.anonWarning.ok": "OK",
        "create.anonWarning.cancel": "戻る",
        "create.limit.title": "⚠️ ルーム作成制限（24時間に1回）",
        "create.limit.message": "未ログイン状態でのルーム作成は24時間に1回までとなっています。<br>続けてルームを作成・開催するには、無料アカウントへのログインまたは新規登録を行ってください。<br><br><span style='font-size:13px; color:#555;'>※ ログインすると、ルームを同時に最大10部屋まで管理できるようになり、作成したルームも保存されます。</span>",
        "create.limit.loginBtn": "ログイン / 新規登録へ",
        "create.limit.cancel": "閉じる",
        "create.limit.badgeNotice": "💡 未ログインでの作成は24時間に1回まで（ログインで作成）",
        "create.limit.badgeCooldown": "⚠️ 本日の未ログイン作成枠を使用済みです",
        "create.limit.badgeLoginLink": "ログインして作成",
        "create.limit.loggedIn": "✨ ログイン中",

        // --- Room Limit Manage Modal ---
        "roomLimit.modalTitle": "⚠️ ルーム保持数の上限",
        "roomLimit.desc": "同時に保持できるルーム数の上限に達しています。<br>新しいルームを作成するには、不要なルームを削除して空きを作ってください。<br><span style='font-size:13px; color:#e64a5a; font-weight:700;'>※ 新規作成には残り9部屋以下にする必要があります</span>",
        "roomLimit.currentCount": "現在のルーム数",
        "roomLimit.deleteConfirm": "このルームを完全に削除しますか？\n（元に戻すことはできません）",
        "roomLimit.continueBtn": "作成を続ける",
        "roomLimit.closeBtn": "閉じる",
        "roomLimit.premiumHint": "✨ プレミアム会員なら最大100部屋まで同時に管理できます",
        "roomLimit.empty": "保持しているルームはありません",
        "roomLimit.deleted": "ルームを削除しました",

        // --- Side / Panel / Buttons ---
        "side.panel": "操作パネル",
        "side.panel.toggle": "操作パネルの表示/非表示",
        "side.search": "検索",
        "side.saveRoom": "💾 ルームを保存",
        "side.save": "💾 セーブ",
        "side.load": "📂 ロード",
        "side.resetFacing": "↻ 全カード<br>向きリセット",
        "side.faceDown": "🂠 全て裏に",
        "side.faceUp": "🂡 全て表に",
        "side.flipCoin": "🪙 コイントス",
        "side.rollD4": "🎲 4面ダイス",
        "side.rollD6": "🎲 6面ダイス",
        "side.rollD10": "🎲 10面ダイス",
        "side.rollD20": "🎲 20面ダイス",
        "side.rollD100": "🎲 100面ダイス",
        "side.shuffle": "🌀 デッキエリアを<br>シャッフル",
        "side.shuffleSelected": "🌀 選択カードを<br>シャッフル",
        "side.resetSelectedFacing": "↻ 選択カード<br>向きリセット",
        "side.collectSelected": "❖ 選択カードを<br>まとめる",
        "side.collect": "❖ 全カードを<br>デッキにまとめる",
        "chat.title": "チャット & ログ",
        "chat.logSettingsTitle": "ログ設定",
        "chat.logSettingsBtn": "設定",
        "logSettings.btn": "設定",
        "logSettings.title": "チャット＆ログ設定",
        "logSettings.timeFormat": "ログの時間表示形式",
        "logSettings.timeMinute": "時分 (12:34)",
        "logSettings.timeSecond": "時分秒 (12:34:56)",
        "logSettings.timeMillisecond": "時分秒.コンマ (12:34:56.78)",
        "logSettings.eventsTitle": "イベント別ログ表示",
        "logSettings.cardAdd": "画像読み込み・カード追加",
        "logSettings.saveLoad": "マイセットのセーブ・ロード",
        "logSettings.search": "検索・一覧の実行",
        "logSettings.cardFlip": "カードのウラ/オモテ反転",
        "logSettings.shuffle": "シャッフル実行",
        "logSettings.cardSelect": "カードの選択（かるた用）",
        "logSettings.sendBack": "選択カードを最背面に送る",
        "logSettings.cardCollect": "カードをまとめる",
        "logSettings.backImage": "ウラ画像の設定",
        "logSettings.diceCoin": "ダイス・コイントス",
        "logSettings.cardRotate": "カードの回転・タップ",
        "logSettings.cardDelete": "カードの削除",
        "logSettings.hpCounter": "HP・数値カウンター変更",
        "logSettings.roleHost": "👑 ホスト（設定可能）",
        "logSettings.roleGuest": "👀 ゲスト（閲覧のみ）",
        "logSettings.guestHint": "※ログ設定の変更はホストのみ行えます（ゲストは現在の設定の閲覧のみ可能です）。",
        "room.hostBadge": "ホスト",
        "common.player": "プレイヤー",
        "common.spectator": "観戦",
        "common.close": "閉じる",
        "session.duplicateTitle": "切断されました",
        "session.duplicateMsg": "別の端末またはブラウザからログインされたため、このセッションを切断しました。",
        "session.returnToLobby": "ロビーへ戻る",
        "side.allMyCards": "🔍 一覧",
        "side.deckList": "🔍 デッキ一覧",
        "side.discardList": "🔍 捨て札一覧",
        "side.deleteMine": "🗑 全カード<br>削除",
        "side.deleteSelected": "🗑 選択カード<br>削除",
        "side.sendSelectedBack": "⇊ 選択カードを最背面に",
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
        "side.hoverZoom": "ホバー時カード拡大",
        "side.cardAnimation": "カード移動アニメーション",
        "side.cardAnimationTitle": "ONにすると、他人が動かしたカードが滑らかに加減速して移動します（デフォルトON）",
        "side.lockOtherHand": "他人の手札カード移動制限",
        "side.lockOtherHandTitle": "ONにすると、他人の手札内にあるカードを動かすことができなくなります（デフォルト: OFF）",
        "side.pieceShadow": "コマの影表示",
        "side.pieceShadowTitle": "ONにすると、将棋やチェスなどのコマ・トークンに影を表示します（デフォルトOFF）",
        "side.rotateSection": "カード回転設定",
        "side.rotateDir": "回転方向",
        "side.rotateDirCW": "右回り（時計）",
        "side.rotateDirCCW": "左回り（反時計）",
        "side.rotateAngle": "回転量",
        "side.rotateToggle": "回転反転",
        "side.fieldSection": "フィールド",
        "side.fieldHelp": "(クリックで配置、右クリックで操作)",
        "side.addDeck": "🗂 デッキエリア追加",
        "side.addDiscard": "🗑 捨て札エリア追加",
        "side.addSpecial": "✨ 特殊エリア追加",
        "game.addCard": "🃏 カードを追加",
        "game.addCard.sub": "（画像をカードサイズにして生成）",
        "game.addPiece": "♟ コマを追加",
        "game.addPiece.sub": "（画像サイズ維持）",
        "game.addBoard": "🏁 ボードを追加",
        "game.addBoard.sub": "（画像サイズ維持・最背面）",
        "side.BackImage": "🖼 全カードの<br>ウラ画像設定",
        "side.BackImageSelected": "🖼 選択カードの<br>ウラ画像設定",

        // --- Zones ---
        "zone.special": "特殊エリア",
        "zone.special1": "特殊エリア1",
        "zone.special2": "特殊エリア2",
        "zone.play": "プレイエリア",
        "zone.discard": "捨て札エリア",
        "zone.deck": "デッキエリア",
        "zone.deck1": "デッキエリア1",
        "zone.deck2": "デッキエリア2",
        "zone.hand": "手札エリア",
        "zone.play.shared": "プレイエリア（共有）",
        "zone.deck.shared": "デッキエリア（共有）",
        "zone.discard.shared": "捨て札エリア（共有）",

        // --- Field Layouts ---
        "layout.modalTitle": "フィールド構成を選択",
        "layout.standard1": "スタンダード1",
        "layout.standard2": "スタンダード2",
        "layout.simple1": "シンプル1",
        "layout.simple2": "シンプル2",
        "layout.custom1": "カスタム1",
        "layout.custom2": "カスタム2",

        // --- Area Image Fit Modal ---
        "areaFit.title": "エリア画像の設定",
        "areaFit.imgSize": "選択した画像:",
        "areaFit.areaSize": "現在のエリアサイズ:",
        "areaFit.fitCurrentTitle": "現在のエリアサイズに合わせる",
        "areaFit.fitCurrentDesc": "現在のエリアのサイズに合うように画像が出現します。画像の縦横比も現在のエリアのサイズに合わせます。",
        "areaFit.fitImageTitle": "画像のサイズに合わせる",
        "areaFit.fitImageDesc": "手札エリアが画像のサイズと全く同じ形状になります。",
        "areaFit.cancel": "キャンセル",
        "areaFit.uploading": "⏳ 画像をアップロード中...",

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
        "premium.status": "プレミアムステータス",

        "mypage.dangerZone": "危険な操作",
        "mypage.deleteAccountDesc": "アカウントを完全に削除します。この操作は取り消せません。",
        "mypage.deleteAccountBtn": "アカウントを削除する",
        "mypage.deleteConfirm": "本当にアカウントを完全に削除しますか？\n保存されたマイルームやマイセットも含むすべてのデータが消去され、元に戻すことはできません。",
        "auth.accountNotFound": "アカウントが見つかりません。先に「新規アカウント作成」から登録を行ってください。",
        "auth.registrationComplete": "アカウント作成完了！ウェルカムメールを送信しました。",
        "auth.verifyRequired": "メールアドレスの確認が必要です。",
        "auth.verifySent": "確認メールを送信しました。メール内のリンクをクリックしてください。",
        "auth.resendBtn": "確認メールを再送する",
        "auth.resending": "送信中...",
        "mypage.deleteSuccess": "アカウントとすべてのデータを削除しました。ご利用ありがとうございました。"
    },
    en: {
        "app.title": "Play board/card games with images (up to 4)",

        "links.privacy": "Privacy Policy",
        "links.terms": "Terms",
        "links.contact": "Contact",

        "lobby.welcome": "Welcome to BatriTable!",

        "auth.login": "Sign in with Google",
        "auth.loginBtn": "Sign in",
        "auth.rejoinCreatedRoom": "🚪 Enter Created Room",
        "auth.logout": "Sign out",
        "app.mypage": "My Page",
        "mypage.profile": "Profile",
        "mypage.back": "← Back to Game",
        "nav.home": "Home",
        "nav.lobby": "Lobby",
        "nav.howto": "How to Play",
        "nav.plans": "Plans",
        "nav.about": "Owner",
        "nav.privacy": "Privacy",
        "nav.terms": "Terms",
        "nav.contact": "Contact",

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
        "create.anonWarning.message": "If you are not logged in, the room will be deleted 24 hours after creation.<br>※ Room creation while not logged in is limited to once per 24 hours.",
        "create.anonWarning.ok": "OK",
        "create.anonWarning.cancel": "Back",
        "create.limit.title": "⚠️ Room Creation Limit (Once per 24 hours)",
        "create.limit.message": "Room creation while not logged in is limited to once per 24 hours.<br>To create more rooms, please log in or sign up for a free account.<br><br><span style='font-size:13px; color:#555;'>※ Logged-in users can manage up to 10 active rooms and saved rooms.</span>",
        "create.limit.loginBtn": "Log In / Sign Up",
        "create.limit.cancel": "Close",
        "create.limit.badgeNotice": "💡 Creation while not logged in is limited to once per 24h (Log in to create)",
        "create.limit.badgeCooldown": "⚠️ Today's creation limit reached for non-logged-in users",
        "create.limit.badgeLoginLink": "Log in to create",
        "create.limit.loggedIn": "✨ Logged in",

        // --- Room Limit Manage Modal ---
        "roomLimit.modalTitle": "⚠️ Room Storage Limit",
        "roomLimit.desc": "You have reached the maximum number of active rooms.<br>Please delete unneeded rooms to free up space.<br><span style='font-size:13px; color:#e64a5a; font-weight:700;'>※ Must be 9 or fewer to create a new room</span>",
        "roomLimit.currentCount": "Current Rooms",
        "roomLimit.deleteConfirm": "Are you sure you want to delete this room completely?\n(This action cannot be undone)",
        "roomLimit.continueBtn": "Continue Creation",
        "roomLimit.closeBtn": "Close",
        "roomLimit.premiumHint": "✨ Premium members can manage up to 100 rooms simultaneously",
        "roomLimit.empty": "No active rooms found",
        "roomLimit.deleted": "Room deleted",

        // --- Side / Panel / Buttons ---
        "side.panel": "Control Panel",
        "side.panel.toggle": "Show/Hide control panel",
        "side.search": "Search",
        "side.saveRoom": "💾 Save room",
        "side.save": "💾 Save",
        "side.load": "📂 Load",
        "side.resetFacing": "↻ Reset All<br>Orientation",
        "side.faceDown": "🂠 Face-down",
        "side.faceUp": "🂡 Face-up",
        "side.flipCoin": "🪙 flip a coin",
        "side.rollD4": "🎲 Roll a d4",
        "side.rollD6": "🎲 Roll a d6",
        "side.rollD10": "🎲 Roll a d10",
        "side.rollD20": "🎲 Roll a d20",
        "side.rollD100": "🎲 Roll a d100",
        "side.shuffle": "🌀 Shuffle<br>Deck Area",
        "side.shuffleSelected": "🌀 Shuffle<br>Selected",
        "side.resetSelectedFacing": "↻ Reset Sel<br>Orientation",
        "side.collectSelected": "❖ Gather<br>Selected",
        "side.collect": "❖ Gather All<br>to Deck",
        "chat.title": "Chat & Log",
        "chat.logSettingsTitle": "Log Settings",
        "chat.logSettingsBtn": "Settings",
        "logSettings.btn": "Settings",
        "logSettings.title": "Chat & Log Settings",
        "logSettings.timeFormat": "Timestamp Format",
        "logSettings.timeMinute": "Min (12:34)",
        "logSettings.timeSecond": "Sec (12:34:56)",
        "logSettings.timeMillisecond": "Ms (12:34:56.78)",
        "logSettings.eventsTitle": "Event Log Toggles",
        "logSettings.cardAdd": "Load images / Add cards",
        "logSettings.saveLoad": "Save / Load My Set",
        "logSettings.search": "Search / Card lists",
        "logSettings.cardFlip": "Flip card face-up/down",
        "logSettings.shuffle": "Shuffle deck / selected",
        "logSettings.cardSelect": "Card selection (Karuta)",
        "logSettings.sendBack": "Send card to back",
        "logSettings.cardCollect": "Gather cards",
        "logSettings.backImage": "Card back image settings",
        "logSettings.diceCoin": "Dice roll / Coin flip",
        "logSettings.cardRotate": "Card rotation / Tap",
        "logSettings.cardDelete": "Delete cards",
        "logSettings.hpCounter": "HP / Counter changes",
        "logSettings.roleHost": "👑 Host (Editable)",
        "logSettings.roleGuest": "👀 Guest (View only)",
        "logSettings.guestHint": "※ Only the host can modify log settings (guests can view current settings).",
        "room.hostBadge": "Host",
        "common.player": "Player ",
        "common.spectator": "Spectator",
        "common.close": "Close",
        "session.duplicateTitle": "Disconnected",
        "session.duplicateMsg": "This session was disconnected because your account logged in from another device or tab.",
        "session.returnToLobby": "Return to Lobby",
        "side.allMyCards": "🔍 List",
        "side.deckList": "🔍 My deck-area cards",
        "side.discardList": "🔍 My discard-area cards",
        "side.deleteMine": "🗑 Delete<br>All Cards",
        "side.deleteSelected": "🗑 Delete<br>Selected",
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
        "side.hoverZoom": "Card Hover Zoom",
        "side.cardAnimation": "Card Move Animation",
        "side.cardAnimationTitle": "When ON, cards moved by other players will smoothly animate with acceleration/deceleration (Default: ON)",
        "side.lockOtherHand": "Lock Other Hand Cards",
        "side.lockOtherHandTitle": "When ON, cards in other players' hand areas cannot be moved (Default: OFF)",
        "side.pieceShadow": "Piece Shadow",
        "side.pieceShadowTitle": "When ON, shows shadows for pieces/tokens (Default: OFF)",
        "side.rotateSection": "Card Rotation",
        "side.rotateDir": "Direction",
        "side.rotateDirCW": "Clockwise",
        "side.rotateDirCCW": "Counter-CW",
        "side.rotateAngle": "Step Angle",
        "side.rotateToggle": "Toggle Reversal",
        "side.fieldSection": "Field",
        "side.fieldHelp": "(Click to place, right-click to edit)",
        "side.addDeck": "🗂 Add Deck Area",
        "side.addDiscard": "🗑 Add Discard Area",
        "side.addSpecial": "✨ Add Special Area",
        "game.addCard": "🃏 Add Cards",
        "game.addCard.sub": "(Generate at card size)",
        "game.addPiece": "♟ Add Piece",
        "game.addPiece.sub": "(Original size)",
        "game.addBoard": "🏁 Add Board",
        "game.addBoard.sub": "(Original size, background)",
        "side.BackImage": "🖼 All Cards<br>Back Image Settings",
        "side.BackImageSelected": "🖼 Selected Card<br>Back Image Settings",

        // --- Zones ---
        "zone.special": "Special",
        "zone.special1": "Special 1",
        "zone.special2": "Special 2",
        "zone.play": "Play area",
        "zone.discard": "Discard",
        "zone.deck": "Deck",
        "zone.deck1": "Deck 1",
        "zone.deck2": "Deck 2",
        "zone.hand": "Hand",
        "zone.play.shared": "Shared play area",
        "zone.deck.shared": "Shared deck area",
        "zone.discard.shared": "Shared discard area",

        // --- Field Layouts ---
        "layout.modalTitle": "Choose Field Layout",
        "layout.standard1": "Standard 1",
        "layout.standard2": "Standard 2",
        "layout.simple1": "Simple 1",
        "layout.simple2": "Simple 2",
        "layout.custom1": "Custom 1",
        "layout.custom2": "Custom 2",

        // --- Area Image Fit Modal ---
        "areaFit.title": "Area Image Settings",
        "areaFit.imgSize": "Selected image:",
        "areaFit.areaSize": "Current area size:",
        "areaFit.fitCurrentTitle": "Fit to Current Area Size",
        "areaFit.fitCurrentDesc": "The image appears sized to fit the current area size, conforming to its aspect ratio.",
        "areaFit.fitImageTitle": "Fit Area to Image Size",
        "areaFit.fitImageDesc": "The area changes to the exact same size and shape as the image.",
        "areaFit.cancel": "Cancel",
        "areaFit.uploading": "⏳ Uploading image...",

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
        "premium.status": "Premium Status",

        "mypage.dangerZone": "Danger Zone",
        "mypage.deleteAccountDesc": "Permanently delete your account. This action cannot be undone.",
        "mypage.deleteAccountBtn": "Delete Account",
        "mypage.deleteConfirm": "Are you sure you want to delete your account permanently?\nAll your data including My Rooms and My Sets will be lost and cannot be recovered.",
        "auth.accountNotFound": "Account not found. Please register via 'Create new account' first.",
        "auth.registrationComplete": "Account created! A welcome email has been sent.",
        "auth.verifyRequired": "Email verification required.",
        "auth.verifySent": "Verification email sent. Please click the link in the email.",
        "auth.resendBtn": "Resend verification email",
        "auth.resending": "Sending...",
        "mypage.deleteSuccess": "Your account and all data have been deleted. Thank you for using BatriTable."
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
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const val = t(el.dataset.i18n);
        if (val.includes('<br>') || val.includes('<br/>')) {
            el.innerHTML = `<span>${val}</span>`;
        } else {
            el.textContent = val;
        }
    });
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
