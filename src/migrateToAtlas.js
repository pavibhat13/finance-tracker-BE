import { MongoClient } from "mongodb";

const LOCAL_URI = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/personal_finance_manager";
const CLOUD_URI = process.argv[2] || process.env.CLOUD_MONGO_URI;

if (!CLOUD_URI) {
  console.error("Error: Please provide your MongoDB Atlas URI as an argument.");
  console.error("Usage: node src/migrateToAtlas.js \"mongodb+srv://<user>:<password>@cluster0...\"");
  process.exit(1);
}

const migrate = async () => {
  let localClient;
  let cloudClient;

  try {
    console.log("Connecting to local MongoDB...");
    localClient = new MongoClient(LOCAL_URI);
    await localClient.connect();
    const localDb = localClient.db();
    console.log("Connected to local database:", localDb.databaseName);

    console.log("Connecting to MongoDB Atlas...");
    cloudClient = new MongoClient(CLOUD_URI);
    await cloudClient.connect();
    const cloudDb = cloudClient.db();
    console.log("Connected to cloud database:", cloudDb.databaseName);

    const collections = await localDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections to transfer.\n`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith("system.")) continue;

      const docs = await localDb.collection(colName).find({}).toArray();
      console.log(`Migrating '${colName}' (${docs.length} documents)...`);

      if (docs.length > 0) {
        const cloudCol = cloudDb.collection(colName);
        // Clean existing docs in target collection to avoid duplicate key conflicts
        await cloudCol.deleteMany({});
        await cloudCol.insertMany(docs);
      }
      console.log(`  -> Successfully copied ${docs.length} documents into '${colName}'`);
    }

    console.log("\nMigration completed successfully! All local data is now in your cloud database.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    if (localClient) await localClient.close();
    if (cloudClient) await cloudClient.close();
    process.exit(0);
  }
};

migrate();
