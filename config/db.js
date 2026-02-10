import mongoose from "mongoose";
import colors from "colors";

const DBConnection = async () => {
  const urls = [
    process.env.MONGO_URL,          // primary (usually mongodb+srv)
    process.env.FALLBACK_MONGO_URL, // fallback (mongodb:// shards)
  ];

  for (const url of urls) {
    if (!url) continue;

    try {
      await mongoose.connect(url, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log("Connected To Database".bgCyan);
      console.log("Connected DB:", mongoose.connection.name);
      return;
    } catch (error) {
      console.log("Mongo connection failed, trying fallback...".yellow);
    }
  }

  console.log("All MongoDB connections failed".bgRed.white);
  process.exit(1);
};

export default DBConnection;
