const express = require('express');
const router = express.Router();
const {register, login, verifyOtp} = require('../controllers/usercontroller'); // Changed verifyEmail to verifyOtp

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp); // This now correctly refers to the imported verifyOtp


module.exports = router;