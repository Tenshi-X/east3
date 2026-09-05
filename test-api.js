const https = require('https');

const data = JSON.stringify({
  email: 'tes@tes.com',
  password: 'pass123',
  display_name: 'tester'
});

const options = {
  hostname: 'east3-h1nv30nna-tenshi-xs-projects.vercel.app',
  port: 443,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('HTTP_CODE=' + res.statusCode);
    console.log('BODY=' + body);
  });
});

req.on('error', (e) => {
  console.log('ERROR=' + e.message);
});

req.write(data);
req.end();
