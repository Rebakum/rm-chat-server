import { Response } from "express";

class ApiResponse {
  static success(res: Response, data: any, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res: Response, data: any, message = "Created") {
    return ApiResponse.success(res, data, message, 201);
  }

  static error(res: Response, message = "Error", statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  static paginated(res: Response, data: any, total: number, page: number, limit: number, message = "Success", extra?: Record<string, unknown>) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        ...extra,
      },
    });
  }
}

export default ApiResponse;
