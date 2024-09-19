const { paymentProcess, get } = require("../controller/paymentController");

const router = require("express").Router();

router.post("/payment", paymentProcess);
router.get("/",get)

module.exports = router;
