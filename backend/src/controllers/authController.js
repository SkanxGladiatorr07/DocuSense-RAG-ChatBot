const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      throw new ApiError(400, 'Please provide name, email, and password');
    }

    // 2. Validate email format basic check
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, 'Please provide a valid email address');
    }

    // 3. Validate password length
    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long');
    }

    // 4. Validate role if provided
    if (role && !['admin', 'employee'].includes(role)) {
      throw new ApiError(400, 'Role must be either admin or employee');
    }

    // 5. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // 6. Create user (password is automatically hashed via Mongoose pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
    });

    // 7. Format response (exclude password field)
    const createdUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return ApiResponse.success(res, 201, 'User registered successfully', { user: createdUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
};
