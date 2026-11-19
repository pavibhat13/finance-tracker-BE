import AllowedUser from "../models/AllowedUser.js";
import User from "../models/User.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await AllowedUser.find()
      .populate("registeredUserId", "name email currency createdAt updatedAt isActive")
      .populate("addedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

export const inviteUser = async (req, res, next) => {
  try {
    const { email, role = "USER" } = req.body;
    const normalizedEmail = email ? email.toLowerCase().trim() : "";

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (!["ADMIN", "USER"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified. Role must be ADMIN or USER."
      });
    }

    const existingAllowed = await AllowedUser.findOne({ email: normalizedEmail });
    if (existingAllowed) {
      if (existingAllowed.status === "REGISTERED") {
        return res.status(400).json({
          success: false,
          message: "A user with this email has already registered."
        });
      }
      if (existingAllowed.status === "PENDING") {
        return res.status(400).json({
          success: false,
          message: "An invitation is already pending for this email."
        });
      }
      if (existingAllowed.status === "DEACTIVATED") {
        return res.status(400).json({
          success: false,
          message: "This email is currently deactivated. Use the 'Reactivate' button in the list to restore access."
        });
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const allowedUser = await AllowedUser.create({
      email: normalizedEmail,
      role,
      status: "PENDING",
      addedBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: `Invitation created for ${normalizedEmail} with ${role} privileges.`,
      user: allowedUser
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["ADMIN", "USER"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Role must be ADMIN or USER."
      });
    }

    const allowedUser = await AllowedUser.findById(id);
    if (!allowedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (allowedUser.role === role) {
      return res.json({
        success: true,
        message: `Role is already ${role}.`,
        user: allowedUser
      });
    }

    // Guardrail: If demoting from ADMIN to USER, ensure at least one other active admin remains
    if (allowedUser.role === "ADMIN" && role === "USER") {
      const otherActiveAdmins = await AllowedUser.countDocuments({
        _id: { $ne: allowedUser._id },
        role: "ADMIN",
        status: { $ne: "DEACTIVATED" }
      });

      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot demote the last remaining active Administrator. Assign another Administrator first."
        });
      }
    }

    allowedUser.role = role;
    await allowedUser.save();

    if (allowedUser.registeredUserId) {
      await User.findByIdAndUpdate(allowedUser.registeredUserId, { role });
    }

    return res.json({
      success: true,
      message: `User role updated to ${role}.`,
      user: allowedUser
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["PENDING", "REGISTERED", "DEACTIVATED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Status must be PENDING, REGISTERED, or DEACTIVATED."
      });
    }

    const allowedUser = await AllowedUser.findById(id);
    if (!allowedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (status === "DEACTIVATED") {
      // Guardrail 1: Cannot deactivate the last remaining active admin
      if (allowedUser.role === "ADMIN") {
        const otherActiveAdmins = await AllowedUser.countDocuments({
          _id: { $ne: allowedUser._id },
          role: "ADMIN",
          status: { $ne: "DEACTIVATED" }
        });

        if (otherActiveAdmins === 0) {
          return res.status(400).json({
            success: false,
            message: "Cannot deactivate the only active Administrator."
          });
        }
      }

      // Guardrail 2: Cannot deactivate self
      if (
        allowedUser.registeredUserId &&
        allowedUser.registeredUserId.toString() === req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "You cannot deactivate your own active session. Ask another Administrator to manage your account."
        });
      }

      allowedUser.status = "DEACTIVATED";
      await allowedUser.save();

      if (allowedUser.registeredUserId) {
        await User.findByIdAndUpdate(allowedUser.registeredUserId, { isActive: false });
      }

      return res.json({
        success: true,
        message: `Account for ${allowedUser.email} has been deactivated.`,
        user: allowedUser
      });
    }

    // Reactivation logic
    if (allowedUser.registeredUserId) {
      allowedUser.status = "REGISTERED";
      await allowedUser.save();
      await User.findByIdAndUpdate(allowedUser.registeredUserId, { isActive: true });
    } else {
      allowedUser.status = "PENDING";
      await allowedUser.save();
    }

    return res.json({
      success: true,
      message: `Account for ${allowedUser.email} has been reactivated.`,
      user: allowedUser
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAllowedUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const allowedUser = await AllowedUser.findById(id);
    if (!allowedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (allowedUser.status === "REGISTERED") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a registered account. Deactivate the user instead to preserve data integrity."
      });
    }

    if (allowedUser.role === "ADMIN") {
      const otherActiveAdmins = await AllowedUser.countDocuments({
        _id: { $ne: allowedUser._id },
        role: "ADMIN",
        status: { $ne: "DEACTIVATED" }
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot remove the only Administrator."
        });
      }
    }

    await AllowedUser.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: `Invitation for ${allowedUser.email} has been revoked.`
    });
  } catch (error) {
    next(error);
  }
};
