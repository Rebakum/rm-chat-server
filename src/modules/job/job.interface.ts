export interface CreateJobDTO {
  jobTitle: string;
  teacherType?: string;
  category?: string;
  jobDescription?: string;
  qualifications?: string;
  minSalary?: number;
  maxSalary?: number;
  genderPreference?: string;
  hoursPerWeek?: string;
  howManyDays?: string;
}

export interface ApplyToJobDTO {
  message?: string;
}

export interface JobQueryParams {
  page?: number;
  limit?: number;
}
