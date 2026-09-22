const express = require("express");
const multer = require("multer");
const requireAuth = require("../middlewares/auth.middleware");
const controller = require("../controllers/game.controller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);
router.get("/campaigns", controller.getCampaigns);
router.post("/campaigns", controller.createCampaign);
router.delete("/campaigns/:campaignId", controller.deleteCampaign);
router.get("/campaigns/:campaignId", controller.getCampaign);
router.post("/campaigns/:campaignId/characters", controller.createCharacter);
router.post("/characters/:characterId/sheet", upload.single("sheet"), controller.uploadSheet);
router.post("/campaigns/:campaignId/dm", controller.talkToDm);

module.exports = router;
