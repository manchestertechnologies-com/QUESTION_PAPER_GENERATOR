const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
(async () => {
  const js = await get('https://question-paper-generator-swart.vercel.app/assets/index-CVeCfgT1.js');
  console.log('JS Status:	, js.status, 'Length:', js.body.length);
  const importMatches = js.body.match(/import[^s\*]\*['"][^"']+['"]/g) || [];
  console.log('Imports:', importMatches);
  const dynMatches = js.body.match(/import\(['"][^"']+['"]])/g) || [];
  console.log('Dynamic Imports:', dynMatches);
})();