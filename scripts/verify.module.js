import { auth, applyActionCode } from "./firebase.init.js";

async function verifyEmail() {
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');
    const loadingState = document.getElementById('loading-state');
    const successState = document.getElementById('success-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');

    if (!oobCode) {
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        errorMessage.textContent = '無効なリクエストです。確認コードが見つかりません。';
        return;
    }

    try {
        // Firebase のアクションコードを適用（メール確認完了）
        await applyActionCode(auth, oobCode);
        
        loadingState.style.display = 'none';
        successState.style.display = 'block';

        // 3秒後に自動的にロビーへ移動
        setTimeout(() => {
            window.location.href = '/lobby.html';
        }, 5000);

    } catch (error) {
        console.error('Email verification error:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        
        if (error.code === 'auth/invalid-action-code') {
            errorMessage.textContent = 'このリンクは既に使用されているか、期限が切れています。';
        } else {
            errorMessage.textContent = '確認中にエラーが発生しました: ' + error.message;
        }
    }
}

// 実行
window.addEventListener('DOMContentLoaded', verifyEmail);
