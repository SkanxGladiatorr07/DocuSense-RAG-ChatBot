const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const generateToken = require('../utils/generateToken');

// Email regex shared by both register and (if needed) other validators
const EMAIL_REGEX = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

/**
 * Builds a safe user object to return in responses (no password, no __v).
 * @param {import('mongoose').Document} user
 */
const sanitiseUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  dateOfBirth: user.dateOfBirth,
  company: user.company,
  isEmployed: user.isEmployed,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate required fields (trim name/email to catch whitespace-only strings)
    if (!name?.trim() || !email?.trim() || !password) {
      throw new ApiError(400, 'Please provide name, email, and password');
    }

    // 2. Validate email format
    if (!EMAIL_REGEX.test(email.trim())) {
      throw new ApiError(400, 'Please provide a valid email address');
    }

    // 3. Validate name length
    if (name.trim().length < 2) {
      throw new ApiError(400, 'Name must be at least 2 characters long');
    }

    // 4. Validate password length (must happen here, BEFORE the bcrypt pre-save hook)
    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long');
    }

    // 5. Validate role if explicitly provided
    if (role && !['admin', 'employee'].includes(role)) {
      throw new ApiError(400, 'Role must be either "admin" or "employee"');
    }

    // 6. Check for duplicate email
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    // 7. Create user — password is hashed automatically by the pre-save hook
    //    Role defaults to 'employee' in the schema, so we omit the fallback here
    const user = await User.create({
      name: name.trim(),
      email: email.trim(),
      password,
      ...(role && { role }),
    });

    return ApiResponse.success(res, 201, 'User registered successfully', {
      user: sanitiseUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Login user and return JWT
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email?.trim() || !password) {
      throw new ApiError(400, 'Please provide email and password');
    }

    // 2. Find user — explicitly select password field (hidden by default)
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      // Use the same generic message for both "not found" and "wrong password"
      // to prevent user enumeration attacks
      throw new ApiError(401, 'Invalid email or password');
    }

    // 3. Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // 4. Generate JWT
    const token = generateToken(user._id, user.role);

    return ApiResponse.success(res, 200, 'Login successful', {
      token,
      user: sanitiseUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get currently authenticated user's profile
 * @route   GET /api/v1/auth/me
 * @access  Private (authenticate middleware required)
 */
const getMe = (req, res) => {
  // req.user is already populated by the authenticate middleware
  return ApiResponse.success(res, 200, 'User profile fetched successfully', {
    user: sanitiseUser(req.user),
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Update the authenticated user's profile
 * @route   PATCH /api/v1/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { dateOfBirth, company, isEmployed } = req.body;

    // Build update object — only include fields that were actually sent
    const updates = {};

    if (dateOfBirth !== undefined) {
      if (dateOfBirth === null || dateOfBirth === '') {
        updates.dateOfBirth = null;
      } else {
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          throw new ApiError(400, 'Invalid date of birth format');
        }
        if (dob > new Date()) {
          throw new ApiError(400, 'Date of birth cannot be in the future');
        }
        updates.dateOfBirth = dob;
      }
    }

    if (isEmployed !== undefined) {
      updates.isEmployed = Boolean(isEmployed);
    }

    if (company !== undefined) {
      updates.company = company?.trim() || null;
    }

    // Clear company if user marks themselves as not employed
    if (updates.isEmployed === false) {
      updates.company = null;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, 200, 'Profile updated successfully', {
      user: sanitiseUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = { register, login, getMe, updateProfile };
