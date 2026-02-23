const axios = require('axios');

async function test() {
    try {
        const response = await axios.post('http://localhost:3004/auth/check-phone', {
            phone: '923000000'
        });
        console.log('✅ SUCCESS:', response.data);
    } catch (error) {
        console.error('❌ ERROR:', error.response?.data || error.message);
    }
}

test();
