const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const checkIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bussinessDig');
    console.log('Connected to MongoDB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      if (col.name === 'payments' || col.name === 'users') {
        console.log(`\nIndexes for collection: ${col.name}`);
        const indexes = await mongoose.connection.db.collection(col.name).indexes();
        console.log(JSON.stringify(indexes, null, 2));
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkIndexes();
