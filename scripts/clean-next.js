const fs = require('fs');
const path = require('path');

function rm(d) {
  if (!fs.existsSync(d)) return;
  const s = fs.lstatSync(d);
  if (s.isDirectory()) {
    for (const f of fs.readdirSync(d)) rm(path.join(d, f));
    try { fs.rmdirSync(d); } catch {}
  } else {
    try { fs.unlinkSync(d); } catch {}
  }
}

rm(path.join(__dirname, '..', '.next'));
console.log('.next cleaned');
