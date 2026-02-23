const axios = require('axios');

async function test() {
    const url = 'http://192.168.100.121:3004/auth/check-phone';
    console.log(`Testing connection to: ${url}`);
    try {
        const response = await axios.post(url, {
            phone: '923000000'
        });
        console.log('✅ SUCCESS:', response.data);
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

test();
