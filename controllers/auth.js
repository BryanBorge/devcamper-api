const User = require("../models/User");
const asyncHandler = require("../middleware/async");
const ErrorReponse = require("../utils/errorResponse");

//@desc    Register user
//@route   GET /api/v1/auth/register
//@access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const {name, email, password, role} = req.body;

  //Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  //Create token
  const token = user.getSignedJwtToken();

  res.status(200).json({success: true, token});
});
