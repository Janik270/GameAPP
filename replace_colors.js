const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directoryPath);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace text-white and related with foreground
    content = content.replace(/text-white/g, 'text-foreground');
    content = content.replace(/bg-white/g, 'bg-foreground');
    content = content.replace(/border-white/g, 'border-foreground');
    content = content.replace(/ring-white/g, 'ring-foreground');

    // We also might want to change bg-black/40 to bg-background/40 to invert it nicely
    content = content.replace(/bg-black/g, 'bg-background');
    content = content.replace(/text-black/g, 'text-background');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Done replacing colors');
