const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { listDepartments } = require('../controllers/userController');

const router = express.Router();

router.get('/', authMiddleware, listDepartments);

module.exports = router;
