const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    if (file && file.mimetype === 'application/pdf') {
      return {
        folder: 'qpg_uploads',
        format: 'pdf',
        resource_type: 'raw'
      };
    }
    return {
      folder: 'qpg_uploads',
      allowed_formats: ['jpg', 'png', 'jpeg', 'svg', 'webp'],
      transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    };
  }
});

module.exports = { cloudinary, storage };
