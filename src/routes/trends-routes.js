const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const googleTrendsController = require('../controllers/google-trends');

var jsonParser = bodyParser.json()

router.delete('/:date', async function (req, res) {
    res.send(await googleTrendsController.deleteTrends(req));
});

router.get('/:date', async function (req, res) {
    res.send(await googleTrendsController.readTrends(req));
});

router.put('/:date', async function (req, res) {
    res.send(await googleTrendsController.writeTrends(req));
});

router.put('/email', jsonParser, async function (req, res) {
    res.send(await googleTrendsController.emailTrends(req));
});

module.exports = router;