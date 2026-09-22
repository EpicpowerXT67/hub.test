const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const createToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  profile: user.profile,
});

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(409).json({ message: "Email is already registered" });

    const user = await User.create({ name, email, password });
    res.status(201).json({ user: publicUser(user), token: createToken(user._id.toString()) });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ user: publicUser(user), token: createToken(user._id.toString()) });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res) => res.json({ user: publicUser(req.user) });

module.exports = { register, login, me };