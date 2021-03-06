const path = require("path");
const Bootcamp = require("../models/Bootcamp");
const asyncHandler = require("../middleware/async");
const ErrorReponse = require("../utils/errorResponse");
const geocoder = require("../utils/geocoder");
const ErrorResponse = require("../utils/errorResponse");

//@desc    Get all bootcamps
//@route   GET /api/v1/bootcamps
//@access  Public
exports.getBootcamps = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

//@desc    Get single bootcamp
//@route   GET /api/v1/bootcamps/:id
//@access  Public
exports.getBootcamp = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.findById(req.params.id);
  if (!bootcamp) {
    return next(
      new ErrorReponse(`Bootcamp not found with id of ${req.params.id}`, 404)
    );
  }
  res.status(200).json({success: true, data: bootcamp});
});

//@desc    Create new bootcamp
//@route   POST /api/v1/bootcamps
//@access  Private
exports.createBootcamp = asyncHandler(async (req, res, next) => {
  //Add user to req.body
  req.body.user = req.user.id;

  //Check for published bootcamp
  const publishedBootcamp = await Bootcamp.findOne({user: req.user.id});

  //If user is not admin, they an only add one bootcamp
  if (publishedBootcamp && req.user.role !== "admin") {
    return next(
      new ErrorResponse(
        `User with id ${req.user.id} has already published a bootcamp`,
        400
      )
    );
  }

  const newBootcamp = await Bootcamp.create(req.body);

  res.status(201).json({success: true, data: newBootcamp});
});

//@desc    Update bootcamp
//@route   PUT /api/v1/bootcamps/:id
//@access  Private
exports.updateBootcamp = asyncHandler(async (req, res, next) => {
  let updatedBootcamp = await Bootcamp.findById(req.params.id);

  if (!updatedBootcamp) {
    return next(
      new ErrorReponse(`Bootcamp not found with id of ${req.params.id}`, 404)
    );
  }

  //Make sure user is bootcamp owner
  if (
    updatedBootcamp.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorReponse(
        `User '${req.params.id}' is not authorized to update this bootcamp`,
        401
      )
    );
  }

  updatedBootcamp = await Bootcamp.findOneAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({success: true, data: updatedBootcamp});
});

//@desc    Delete bootcamp
//@route   DELETE /api/v1/bootcamps/:id
//@access  Private
exports.deleteBootcamp = asyncHandler(async (req, res, next) => {
  const deletedBootcamp = await Bootcamp.findById(req.params.id);

  if (!deletedBootcamp) {
    return next(
      new ErrorReponse(`Bootcamp not found with id of ${req.params.id}`, 404)
    );
  }
  //Make sure user is bootcamp owner
  if (
    deletedBootcamp.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorReponse(
        `User '${req.params.id}' is not authorized to delete this bootcamp`,
        401
      )
    );
  }
  deletedBootcamp.remove();
  res.status(200).json({success: true, data: {}});
});

//@desc    Get bootcamps within a radius
//@route   GET /api/v1/bootcamps/radius/:zipcode/:distance
//@access  Private
exports.getBootcampsInRadius = asyncHandler(async (req, res, next) => {
  const {zipcode, distance} = req.params;

  //Get lat, log from geocoder
  const loc = await geocoder.geocode(zipcode);
  const lat = loc[0].latitude;
  const long = loc[0].longitude;

  //Calc rradius using radians
  //Divide distance by radius of the earth
  //Eath radius: 3, 963 miles (6,378 km)
  const EARTH_RADIUS = 4963;
  const radius = distance / EARTH_RADIUS;
  const bootcamps = await Bootcamp.find({
    location: {
      $geoWithin: {
        $centerSphere: [[long, lat], radius],
      },
    },
  });

  res
    .status(200)
    .json({success: true, count: bootcamps.length, data: bootcamps});
});

//@desc    Upload photo for bootcamp
//@route   PUT /api/v1/bootcamps/:id/photo
//@access  Private
exports.bootcampPhotoUpload = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.findById(req.params.id);

  if (!bootcamp) {
    return next(
      new ErrorReponse(`Bootcamp not found with id of ${req.params.id}`, 404)
    );
  }
  //Make sure user is bootcamp owner
  if (bootcamp.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(
      new ErrorReponse(
        `User '${req.params.id}' is not authorized to update this bootcamp`,
        401
      )
    );
  }

  if (!req.files) {
    return next(new ErrorReponse(`Please upload a file`, 404));
  }

  // res.status(200).json({success: true, data: {}});
  const file = req.files.file;

  //Make sure image is a photo
  if (!file.mimetype.startsWith("image")) {
    return next(new ErrorReponse(`Please upload an image file`, 404));
  }

  //Check file size
  if (file.size > process.env.MAX_FILE_UPLOAD) {
    return next(
      new ErrorReponse(
        `Please upload an image lsess than ${process.env.MAX_FILE_UPLOAD}`,
        404
      )
    );
  }

  //Create custom filename
  file.name = `photo_${bootcamp._id}${path.parse(file.name).ext}`;
  file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {
    if (err) {
      console.error(err);
      return next(new ErrorReponse(`Problem with file upload`, 500));
    }

    await Bootcamp.findByIdAndUpdate(req.params.id, {photo: file.name});
    res.status(200).json({success: true, data: file.name});
  });
});
