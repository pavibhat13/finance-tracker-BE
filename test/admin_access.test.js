import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import AllowedUser from "../src/models/AllowedUser.js";
import { register, login } from "../src/controllers/authController.js";
import {
  getAllUsers,
  inviteUser,
  updateUserRole,
  updateUserStatus,
  deleteAllowedUser
} from "../src/controllers/adminController.js";

const TEST_MONGO_URI = "mongodb://127.0.0.1:27017/personal_finance_manager_admin_test";

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookie: () => {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
};

test.before(async () => {
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("First user registration assigns ADMIN role and creates AllowedUser record", async () => {
  const req = {
    body: {
      name: "Master Admin",
      email: "master@finance.local",
      password: "Password123!"
    }
  };
  const res = mockRes();

  await register(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.role, "ADMIN");

  const allowed = await AllowedUser.findOne({ email: "master@finance.local" });
  assert.ok(allowed, "AllowedUser record should be created");
  assert.equal(allowed.role, "ADMIN");
  assert.equal(allowed.status, "REGISTERED");
});

test("Uninvited registration is blocked with 403 invite-only message", async () => {
  const req = {
    body: {
      name: "Intruder User",
      email: "intruder@finance.local",
      password: "Password123!"
    }
  };
  const res = mockRes();

  await register(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /invite-only/i);
});

test("Admin invites user and creates PENDING AllowedUser record", async () => {
  const master = await User.findOne({ email: "master@finance.local" });
  const req = {
    user: master,
    body: {
      email: "friend@finance.local",
      role: "USER"
    }
  };
  const res = mockRes();

  await inviteUser(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.email, "friend@finance.local");
  assert.equal(res.body.user.status, "PENDING");
  assert.equal(res.body.user.role, "USER");

  // Duplicate invite blocked
  const dupRes = mockRes();
  await inviteUser(req, dupRes, () => {});
  assert.equal(dupRes.statusCode, 400);
});

test("Invited user can successfully register with their email", async () => {
  const req = {
    body: {
      name: "Invited Friend",
      email: "friend@finance.local",
      password: "Password123!"
    }
  };
  const res = mockRes();

  await register(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.role, "USER");

  const allowed = await AllowedUser.findOne({ email: "friend@finance.local" });
  assert.equal(allowed.status, "REGISTERED");
  assert.ok(allowed.registeredUserId);
});

test("Admin can promote user to ADMIN and demote with last-admin guardrail", async () => {
  const master = await User.findOne({ email: "master@finance.local" });
  const friendAllowed = await AllowedUser.findOne({ email: "friend@finance.local" });

  // Promote friend to ADMIN
  const promoteReq = {
    user: master,
    params: { id: friendAllowed._id },
    body: { role: "ADMIN" }
  };
  const promoteRes = mockRes();
  await updateUserRole(promoteReq, promoteRes, () => {});

  assert.equal(promoteRes.statusCode, 200);
  assert.equal(promoteRes.body.user.role, "ADMIN");

  const friendUser = await User.findById(friendAllowed.registeredUserId);
  assert.equal(friendUser.role, "ADMIN");

  // Demote friend back to USER
  const demoteReq = {
    user: master,
    params: { id: friendAllowed._id },
    body: { role: "USER" }
  };
  const demoteRes = mockRes();
  await updateUserRole(demoteReq, demoteRes, () => {});
  assert.equal(demoteRes.statusCode, 200);

  // Demoting master (now the only ADMIN) should fail with guardrail
  const masterAllowed = await AllowedUser.findOne({ email: "master@finance.local" });
  const demoteMasterReq = {
    user: master,
    params: { id: masterAllowed._id },
    body: { role: "USER" }
  };
  const demoteMasterRes = mockRes();
  await updateUserRole(demoteMasterReq, demoteMasterRes, () => {});
  assert.equal(demoteMasterRes.statusCode, 400);
  assert.match(demoteMasterRes.body.message, /last remaining active administrator/i);
});

test("Deactivating user blocks login and reactivating restores access", async () => {
  const master = await User.findOne({ email: "master@finance.local" });
  const friendAllowed = await AllowedUser.findOne({ email: "friend@finance.local" });

  // Deactivate friend
  const deactReq = {
    user: master,
    params: { id: friendAllowed._id },
    body: { status: "DEACTIVATED" }
  };
  const deactRes = mockRes();
  await updateUserStatus(deactReq, deactRes, () => {});

  assert.equal(deactRes.statusCode, 200);
  assert.equal(deactRes.body.user.status, "DEACTIVATED");

  const friendUser = await User.findById(friendAllowed.registeredUserId);
  assert.equal(friendUser.isActive, false);

  // Login attempt by deactivated friend fails
  const loginReq = {
    body: {
      email: "friend@finance.local",
      password: "Password123!"
    }
  };
  const loginRes = mockRes();
  await login(loginReq, loginRes, () => {});
  assert.equal(loginRes.statusCode, 403);
  assert.match(loginRes.body.message, /deactivated/i);

  // Guardrail: Master cannot deactivate themselves
  const masterAllowed = await AllowedUser.findOne({ email: "master@finance.local" });
  const deactMasterReq = {
    user: master,
    params: { id: masterAllowed._id },
    body: { status: "DEACTIVATED" }
  };
  const deactMasterRes = mockRes();
  await updateUserStatus(deactMasterReq, deactMasterRes, () => {});
  assert.equal(deactMasterRes.statusCode, 400);

  // Reactivate friend
  const reactReq = {
    user: master,
    params: { id: friendAllowed._id },
    body: { status: "REGISTERED" }
  };
  const reactRes = mockRes();
  await updateUserStatus(reactReq, reactRes, () => {});
  assert.equal(reactRes.statusCode, 200);

  // Friend can now log in
  const loginRes2 = mockRes();
  await login(loginReq, loginRes2, () => {});
  assert.equal(loginRes2.statusCode, 200);
});

test("Pending invite revocation and registered user deletion protection", async () => {
  const master = await User.findOne({ email: "master@finance.local" });

  // Invite temporary user
  const inviteReq = {
    user: master,
    body: { email: "temp@finance.local", role: "USER" }
  };
  const inviteRes = mockRes();
  await inviteUser(inviteReq, inviteRes, () => {});
  const tempAllowed = inviteRes.body.user;

  // Revoke pending invite
  const deleteReq = {
    user: master,
    params: { id: tempAllowed._id }
  };
  const deleteRes = mockRes();
  await deleteAllowedUser(deleteReq, deleteRes, () => {});
  assert.equal(deleteRes.statusCode, 200);

  const found = await AllowedUser.findById(tempAllowed._id);
  assert.equal(found, null);

  // Deleting registered user should be prevented
  const friendAllowed = await AllowedUser.findOne({ email: "friend@finance.local" });
  const delFriendReq = {
    user: master,
    params: { id: friendAllowed._id }
  };
  const delFriendRes = mockRes();
  await deleteAllowedUser(delFriendReq, delFriendRes, () => {});
  assert.equal(delFriendRes.statusCode, 400);
  assert.match(delFriendRes.body.message, /deactivate/i);
});
