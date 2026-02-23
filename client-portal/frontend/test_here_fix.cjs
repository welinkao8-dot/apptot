
const https = require('https');

const API_KEY = 'UN2gxhPRLhPhUiKVSUTeegOmmDuDwsFcPsQZhX8V040';
const QUERY = 'Talatona';
// Using AGO (ISO-3) as required by HERE V7
const URL = `https://geocode.search.hereapi.com/v1/autocomplete?q=${QUERY}&apiKey=${API_KEY}&in=countryCode:AGO&limit=5&lang=pt`;

console.log('Testing URL:', URL);

https.get(URL, (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        console.log('Status Code:', resp.statusCode);
        console.log('Body:', data);
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
