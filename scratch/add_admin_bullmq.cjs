const fs = require('fs');
const pkgPath = 'apps/admin/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.dependencies['bullmq'] = '^5.58.5';
pkg.dependencies['ioredis'] = '^5.5.0';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log("Added bullmq and ioredis to admin");
