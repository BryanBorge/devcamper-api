const Course = require("../models/Course");
const asyncHandler = require("../middleware/async");
const ErrorReponse = require("../utils/errorResponse");

//@desc    Get all courses
//@route   GET /api/v1/courses
//@route   GET /api/v1/bootcamps/:bootcampId/courses
//@access  Public
exports.getCourses = asyncHandler(async (req, res, next) => {
  let query;
  console.log(req.params);
  if (req.params.bootcampId) {
    query = Course.find({bootcamp: req.params.bootcampId});
  } else {
    query = Course.find();
  }

  const courses = await query;
  console.log(courses);
  res.status(200).json({
    success: true,
    count: courses.length,
    data: courses,
  });
});
