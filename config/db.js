import mongoose from "mongoose";
import colors from "colors";

const DBConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log('Connected To Database'.bgCyan);
    } catch (error) {
        console.log("Error Connecting Database:".bgRed.white, error);
    }
}

export default DBConnection