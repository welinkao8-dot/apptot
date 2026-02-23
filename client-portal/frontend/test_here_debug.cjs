
const https = require('https');

const API_KEY = 'UN2gxhPRLhPhUiKVSUTeegOmmDuDwsFcPsQZhX8V040';
const QUERY = 'Talatona';
const URL = `https://geocode.search.hereapi.com/v1/autocomplete?q=${QUERY}&apiKey=${API_KEY}&in=countryCode:AO&limit=5&lang=pt`;

console.log('Testing URL:', URL);

https.get(URL, (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received.
    resp.on('end', () => {
        console.log('Status Code:', resp.statusCode);
        console.log('Body:', data);
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
