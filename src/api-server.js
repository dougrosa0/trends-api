const cors = require("cors");
const express = require("express");
const trendsRoutes = require('./routes/trends-routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/trends', trendsRoutes);

app.listen(port, function () {
  console.log(`Trends app listening on port ${port}!`);
});