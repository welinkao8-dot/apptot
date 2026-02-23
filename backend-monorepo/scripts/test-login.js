const http = require('http');

const data = JSON.stringify({
    email: 'admin@tot.ao',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/admin/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', body);
    });
});

req.on('error', (error) => {
    console.error('ERROR:', error.message);
});

req.write(data);
req.end();
