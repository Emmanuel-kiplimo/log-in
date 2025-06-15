const bcrypt = require('bcrypt');
const sendEmail = require('../utils/sendEmail.js');

const User = require('../models/userModel.js'); // Changed from Users to User (conventional)

exports.register = async (req, res) => {
  const { email, password } = req.body;

  // Simple email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const existingUser = await User.findOne({ email: email });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8-digit code
    const verificationCodeExpires = Date.now() + 3600000; // Code expires in 1 hour

    const newUser = new User({ // Use the User model
      email,
      password: hashedPassword,
      verified: false,
      verificationCode,
      verificationCodeExpires
    });
    await newUser.save(); // Save to MongoDB
    const html = `<p>Your email verification code is: <strong>${verificationCode}</strong></p><p>This code will expire in 1 hour.</p>`;
    await sendEmail(newUser.email, 'Confirm Your Email Address', html);

    return res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.'
    });
  } catch (error) {
    // Check if it's an email sending error or a database error
    if (error.message.includes("Failed to send verification email")) { // This is a custom check based on previous console.error
      console.error("Failed to send verification email:", error);
      // User might be registered, but email failed.
      // Consider if you want to roll back user creation or just inform.
      // For now, assuming user was created if error is specifically email related post-save.
      return res.status(201).json({
        message: 'User registered successfully, but failed to send verification email. Please contact support or try resending verification.'
      });
    }
    console.error("Error during registration:", error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  const {email, password} = req.body;

  // Simple email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.verified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.'
      });
    }

    // Assuming you still want JWT for session management after login
    const jwt = require('jsonwebtoken'); // Require JWT here if only used for login token
    const loginToken = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Login successful',
      token: loginToken
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.verified) {
      return res.status(400).json({ message: 'Account already verified.' });
    }

    if (user.verificationCode !== otp || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    user.verified = true;
    user.verificationCode = undefined; // Clear OTP after use
    user.verificationCodeExpires = undefined; // Clear OTP expiry
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (err) {
    console.error('Error during OTP verification:', err);
    return res.status(500).json({ message: 'Server error during OTP verification.' });
  }
};
