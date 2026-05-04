require("dotenv").config();
const express = require("express");
const path = require("path");
const connectDB = require("./src/db/db");
const loadStaticData = require("./src/db/loadStaticData");

const app = express();

connectDB().then(loadStaticData);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/vendor/chart.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/chart.js/dist/chart.umd.js"));
});
app.use("/", require("./src/routes/routes"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
