import mongoose from "mongoose";
import User from "./models/User.js";
import { ENV } from "./config/env.js";
import { seedInitialUserData } from "./services/seedService.js";

const runSeed = async () => {
  try {
    console.log("Connecting to database at:", ENV.MONGO_URI ? ENV.MONGO_URI.replace(/:[^:]*@/, ":****@") : "undefined");
    await mongoose.connect(ENV.MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    let user = await User.findOne({ email: "pavithravbhat13@gmail.com" });
    if (!user) {
      console.log("Creating master user: pavithravbhat13@gmail.com ...");
      user = await User.create({
        name: "Pavithra V Bhat",
        email: "pavithravbhat13@gmail.com",
        password: "111Pavithra*"
      });
      console.log("Master user created with ID:", user._id);
    } else {
      console.log("Master user already exists with ID:", user._id);
    }

    console.log("Seeding initial accounts, categories, and rules...");
    await seedInitialUserData(user._id);
    console.log("Seeding complete! Database is initialized and ready to use.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

runSeed();
