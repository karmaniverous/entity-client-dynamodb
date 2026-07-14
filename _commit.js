const { execSync } = require('child_process');
const o = { cwd: 'D:\\repos\\karmaniverous\\entity-client-dynamodb', stdio: 'inherit' };
execSync('git add -A', o);
execSync('git commit -m "fix: replace conditional expects with direct assertions"', o);
execSync('git push origin main', o);
