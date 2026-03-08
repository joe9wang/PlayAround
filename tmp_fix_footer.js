const fs = require('fs');
const path = require('path');

const files = [
    'terms.html', 'privacy.html', 'news.html', 'law.html',
    'index.html', 'howto.html', 'Geki-Mahjong.html', 'contact.html', 'plans.html'
];

files.forEach(f => {
    const filePath = path.join(__dirname, f);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // Replace background color from navy blue to the previous brand blue #1e82e0
    let newContent = content.replace(/background:\s*#18182a;/ig, 'background: #1e82e0;');

    // Change link text color from blue to white to contrast with the new blue background
    newContent = newContent.replace(/color:\s*#3b82f6;/ig, 'color: #ffffff;');

    // Change copyright text color from gray to semi-transparent white
    newContent = newContent.replace(/color:\s*#888;/ig, 'color: rgba(255, 255, 255, 0.8);');

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Updated ' + f);
    }
});
