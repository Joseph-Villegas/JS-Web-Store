var express = require("express");
var router = express.Router();

router.get("/", function (req, res, next) {
  res.render("home", { title: "Webstore - Home" });
});

module.exports = router;
