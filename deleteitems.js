const mongoose = require('mongoose');
const Item = require('./model/Item');

// Adjust the path to your Item model as necessary


// Replace with your actual MongoDB connection string
const mongoURI = 'mongodb+srv://yusif:yusif@salaprod.ge3m3ug.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');

    // Verify items to be deleted
    const itemsToDelete = await Item.find({
      $or: [
        { mainImageUrl: { $exists: false } },
        { supplier: { $exists: false } }
      ]
    });

    console.log('Items to delete:', itemsToDelete);

    // Confirm deletion
    if (itemsToDelete.length > 0) {
      // Proceed with deletion
      const result = await Item.deleteMany({
        $or: [
          { mainImageUrl: { $exists: false } },
          { supplier: { $exists: false } }
        ]
      });
      console.log(`${result.deletedCount} items deleted.`);
    } else {
      console.log('No items found matching the criteria.');
    }

    // Close the connection
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.connection.close();
  });
