const mobileUrls = require('./src/config/mobileUrls');
const environmentValues = {
  TOT_DRIVER_API_URL: process.env.TOT_DRIVER_API_URL || '',
};

if (process.env.NODE_ENV === 'production') {
  mobileUrls.validateReleaseUrl(environmentValues.TOT_DRIVER_API_URL, 'TOT_DRIVER_API_URL');
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [require('./scripts/inline-mobile-env'), { keys: Object.keys(environmentValues), values: environmentValues }],
    'react-native-reanimated/plugin',
  ],
};
