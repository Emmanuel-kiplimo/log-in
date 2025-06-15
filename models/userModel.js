const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
 
verificationCode: {
  type: String,
  default: undefined
},
verificationCodeExpires: {
  type: Date,
  default: undefined
}


}, { timestamps: true }); // `timestamps: true` adds createdAt and updatedAt fields

module.exports = mongoose.model('User', userSchema);