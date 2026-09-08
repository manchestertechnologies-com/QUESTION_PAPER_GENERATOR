require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://Roopesh:Roopesh041204@cluster0.qsk7ii7.mongodb.net/qpg-app?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(mongoURI);
    const hash = await bcrypt.hash('123456', 10);
    const res = await mongoose.connection.collection('users').updateMany({}, { $set: { password: hash } });
    console.log('Successfully updated users passwords to 123456. Count:', res.modifiedCount);
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
