const bcrypt = require('bcrypt');
const sendEmail = require('../utils/sendEmail.js');
const jwt = require('jsonwebtoken');

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
    const newUser = new User({ // Use the User model
      email,
      password: hashedPassword,
      verified: false
    });
    await newUser.save(); // Save to MongoDB

    const verificationToken = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `http://localhost:5000/api/auth/verify-email?token=${verificationToken}`; // Corrected query parameter
    const html = `<p>Please confirm your email by clicking the link below:</p><a href="${verifyUrl}">${verifyUrl}</a>`;
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

    const token = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Login successful',
      token
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const emailToVerify = decoded.email;

    const userToVerify = await User.findOne({ email: emailToVerify });

    if (!userToVerify) {
      return res.status(404).json({ message: 'User not found for this verification token.' });
    }

    if (userToVerify.verified) {
      // Optionally, you can just inform them it's already verified and let them proceed
      return res.send('Email already verified. You can now log in.');
    }

    userToVerify.verified = true;
    await userToVerify.save(); // Save the updated user status to MongoDB

    res.send('Email verified successfully');
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }
    console.error('Error during email verification:', err);
    return res.status(500).json({ message: 'Error verifying email.' });
  }
};
