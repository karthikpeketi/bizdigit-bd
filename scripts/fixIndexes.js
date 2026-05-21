const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const fixIndexes = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/bussinessDig';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('payments');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // We want to find any unique indexes that shouldn't be unique
    // and drop them. transactionRef SHOULD be unique, so we keep that.
    // userId, businessId, and senderEmail should NOT be unique.
    
    const fieldsToFix = ['userId', 'businessId', 'senderEmail'];
    
    for (const index of indexes) {
      if (index.unique && index.name !== '_id_' && !index.name.includes('transactionRef')) {
        const keys = Object.keys(index.key);
        const shouldDrop = keys.some(k => fieldsToFix.includes(k));
        
        if (shouldDrop) {
          console.log(`Dropping unique index: ${index.name}`);
          await collection.dropIndex(index.name);
          console.log(`Dropped ${index.name}`);
        }
      }
    }
    
    console.log('Index cleanup complete.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error fixing indexes:', err);
    process.exit(1);
  }
};

fixIndexes();
