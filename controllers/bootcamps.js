const path = require("path");
const Bootcamp = require("../models/Bootcamp");
const asyncHandler = require("../middleware/async");
const ErrorReponse = require("../utils/errorResponse");
const geocoder = require("../utils/geocoder");

//@desc    Get all bootcamps
//@route   GET /api/v1/bootcamps
//@access  Public
exports.getBootcamps = asyncHandler(async (req, res, next) => {
  let query;
  //Copy of req.query
  const reqQuery = {...req.query};

  //Field to exclude so they dont match as a field
  const removeFields = ["select", "sort", "page", "limit"];

  //Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  //Create query string
  let queryStr = JSON.stringify(reqQuery);

  //Create operaters ($gt, $gte, etc)
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b()/g,
    match => `$${match}`
  );

  //Finding resource
  query = Bootcamp.find(JSON.parse(queryStr)).populate("courses");

  //Select fields
  if (req.query.select) {
    const fields = req.query.select.split(",").join(" ");
    query = query.select(fields);
  }

  //Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    //sory by descending createAt date
    query = query.sort("-createdAt");
  }

  //Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Bootcamp.countDocuments();
  query = query.skip(startIndex).limit(limit);

  //Exec query
  const bootcamps = await query;

  //Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: bootcamps.length,
    pagination,
    data: bootcamps,
  });
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
  const newBootcamp = await Bootcamp.create(req.body);
  res.status(201).json({success: true, data: newBootcamp});
});

//@desc    Update bootcamp
//@route   PUT /api/v1/bootcamps/:id
//@access  Private
exports.updateBootcamp = asyncHandler(async (req, res, next) => {
  const updatedBootcamp = await Bootcamp.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedBootcamp) {
    return next(
      new ErrorReponse(`Bootcamp not found with id of ${req.params.id}`, 404)
    );
  }
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
