const fs = require('fs');

const files = [
    'terms.html', 'privacy.html', 'news.html', 'law.html',
    'index.html', 'howto.html', 'Geki-Mahjong.html', 'contact.html'
];

const newFooter = `    <!-- フッター -->
    <footer style="grid-column: 1 / -1; background: #18182a; padding: 40px 32px; border-radius: 14px; display: flex; flex-direction: column; gap: 24px; box-shadow: 0 10px 24px rgba(0,0,0,.15); margin-top: 20px;">
      <div style="display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;">
        <a href="/terms.html" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem; font-weight: 600;">利用規約</a>
        <a href="/privacy.html" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem; font-weight: 600;">プライバシーポリシー</a>
        <a href="/law.html" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem; font-weight: 600;">特定商取引法に基づく表記</a>
        <a href="/contact.html" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem; font-weight: 600;">お問い合わせ</a>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="/BatriTable-icon.png" alt="BatriTable" style="width: 28px; height: 28px; border-radius: 6px;">
          <strong style="font-size: 1.2rem; color: #fff; letter-spacing: 0.05em;">BatriTable</strong>
        </div>
        <div style="color: #888; font-size: 0.8rem;">
          © 2025 SOLVENTER
        </div>
      </div>
    </footer>`;

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let content = fs.readFileSync(f, 'utf8');
    // Match <section class="cta"...> ... </section>
    const replaced = content.replace(/[\s\t]*<section class="cta"[\s\S]*?<\/section>/, '\n' + newFooter);
    if (replaced !== content) {
        fs.writeFileSync(f, replaced, 'utf8');
        console.log('Updated ' + f);
    } else {
        console.log('No change in ' + f);
    }
});
