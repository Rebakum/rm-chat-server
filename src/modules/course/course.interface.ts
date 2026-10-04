export interface CreateCourseDTO {
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  terms?: boolean;
  courseName: string;
}

export interface CourseQueryParams {
  page?: number;
  limit?: number;
}
