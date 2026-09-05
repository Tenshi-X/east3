const https = require('https');
const options = {hostname:'east3-4cx84b6w7-tenshi-xs-projects.vercel.app',port:443,path:'/api/hello',method:'GET'};
const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => { console.log('CODE=' + res.statusCode); console.log('BODY=' + body); });
});
req.on('error', (e) => { console.log('ERROR=' + e.message); });
req.end();
