import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AllowedUser from "../models/AllowedUser.js";
import { ENV } from "../config/env.js";
import { seedInitialUserData } from "../services/seedService.js";

const generateToken = (id) => {
  return jwt.sign({ id }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN
  });
};

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: ENV.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

export const ensureAdminSync = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      const allowedCount = await AllowedUser.countDocuments();
      if (allowedCount === 0) {
        const users = await User.find().sort({ createdAt: 1 });
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          const role = i === 0 ? "ADMIN" : (u.role || "USER");
          u.role = role;
          if (u.isActive === undefined) u.isActive = true;
          await u.save();

          await AllowedUser.create({
            email: u.email,
            role,
            status: "REGISTERED",
            registeredUserId: u._id
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync initial admin allowlist:", err);
  }
};

export const checkRegistrationStatus = async (req, res, next) => {
  try {
    const userCount = await User.countDocuments();
    return res.json({
      success: true,
      registrationAllowed: true,
      isFirstUser: userCount === 0,
      isInviteOnly: userCount > 0
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email ? email.toLowerCase().trim() : "";

    if (!normalizedEmail || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password."
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists. Please sign in."
      });
    }

    const count = await User.countDocuments();
    let assignedRole = "USER";
    let allowedRecord = null;

    if (count === 0) {
      // First ever user becomes ADMIN
      assignedRole = "ADMIN";
    } else {
      allowedRecord = await AllowedUser.findOne({ email: normalizedEmail });
      if (!allowedRecord) {
        return res.status(403).json({
          success: false,
          message: "Registration is invite-only. This email has not been invited by an administrator."
        });
      }
      if (allowedRecord.status === "DEACTIVATED") {
        return res.status(403).json({
          success: false,
          message: "Access for this email has been deactivated. Please contact an administrator."
        });
      }
      if (allowedRecord.status === "REGISTERED") {
        return res.status(400).json({
          success: false,
          message: "This email has already been registered. Please log in."
        });
      }
      assignedRole = allowedRecord.role || "USER";
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: assignedRole,
      isActive: true
    });

    if (count === 0) {
      await AllowedUser.create({
        email: normalizedEmail,
        role: "ADMIN",
        status: "REGISTERED",
        registeredUserId: user._id
      });
    } else if (allowedRecord) {
      allowedRecord.status = "REGISTERED";
      allowedRecord.registeredUserId = user._id;
      await allowedRecord.save();
    }

    // Seed isolated initial data (categories, accounts, rules)
    await seedInitialUserData(user._id);

    const token = generateToken(user._id);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Account created and initialized successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.toLowerCase().trim() : "";

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact an administrator."
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Auto-heal check for legacy accounts missing role or AllowedUser record
    if (!user.role) {
      const isOnlyOrFirst = (await User.countDocuments()) <= 1;
      user.role = isOnlyOrFirst ? "ADMIN" : "USER";
      await user.save();
    }

    let allowed = await AllowedUser.findOne({ email: user.email });
    if (!allowed) {
      await AllowedUser.create({
        email: user.email,
        role: user.role || "ADMIN",
        status: user.isActive ? "REGISTERED" : "DEACTIVATED",
        registeredUserId: user._id
      });
    }

    const token = generateToken(user._id);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: ENV.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0)
  });
  return res.json({
    success: true,
    message: "Logged out successfully"
  });
};

export const getMe = async (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      currency: req.user.currency,
      role: req.user.role || "USER",
      isActive: req.user.isActive !== false
    }
  });
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    user.password = newPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    next(error);
  }
};
