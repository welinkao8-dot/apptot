const mobileUrls = require('./src/config/mobileUrls');

const requiredReleaseUrls = ['TOT_CLIENT_API_URL', 'TOT_CLIENT_SOCKET_URL'];
const environmentValues = Object.fromEntries(requiredReleaseUrls.map((key) => [key, process.env[key] || '']));
if (process.env.NODE_ENV === 'production') {
    requiredReleaseUrls.forEach((key) => mobileUrls.validateReleaseUrl(environmentValues[key], key));
}

module.exports = {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
        [require('./scripts/inline-mobile-env'), { keys: requiredReleaseUrls, values: environmentValues }],
        'react-native-reanimated/plugin',
    ],
};
