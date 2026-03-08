const fs = require('fs');
const path = require('path');

const filesToFixGrid = [
    'terms.html', 'privacy.html', 'news.html', 'law.html',
    'index.html', 'howto.html', 'Geki-Mahjong.html', 'contact.html'
];
const allFiles = [...filesToFixGrid, 'plans.html'];

filesToFixGrid.forEach(f => {
    const filePath = path.join(__dirname, f);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // 1. In .layout, change grid-template-rows: 1fr auto; to grid-template-rows: 1fr;
    // Use regex to only match exactly 1fr auto
    content = content.replace(/grid-template-rows:\s*1fr\s+auto;/g, 'grid-template-rows: 1fr;');

    // 2. In .sidebar, change grid-row: 1 / span 2; to grid-row: 1;
    content = content.replace(/grid-row:\s*1\s*\/\s*span\s*2;/g, 'grid-row: 1;');

    fs.writeFileSync(filePath, content, 'utf8');
});

allFiles.forEach(f => {
    const filePath = path.join(__dirname, f);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // 3. Remove margin-top: 20px; from the footer inline style
    content = content.replace(/margin-top:\s*20px;/g, 'margin-top: 0px;');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Processed ' + f);
});
