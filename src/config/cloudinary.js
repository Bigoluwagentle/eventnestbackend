const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

// Uploads are optional: until all three values are set, upload endpoints answer 503.
const isConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

module.exports = { cloudinary, isConfigured };