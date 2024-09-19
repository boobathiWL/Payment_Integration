//Modules and Middlewars
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const routes = require("./route/paymentRoute");
app.use(cors());
app.use(express.json());
app.use(routes);



const PORT = 6001;
app.listen(PORT, () => {
  console.log(`Server connected to PORT ${PORT}`);
});
