import { z } from "zod";

const createJobSchema = z.object({
  body: z.object({
    jobTitle: z.string().min(1),
    teacherType: z.string().optional(),
    category: z.string().optional(),
    jobDescription: z.string().optional(),
    qualifications: z.string().optional(),
    minSalary: z.number().optional(),
    maxSalary: z.number().optional(),
    genderPreference: z.string().optional(),
    hoursPerWeek: z.string().optional(),
    howManyDays: z.string().optional(),
  }),
});

const applyToJobSchema = z.object({
  body: z.object({
    message: z.string().optional(),
  }),
  params: z.object({ jobId: z.uuid() }),
});

const updateJobStatusSchema = z.object({
  body: z.object({
    jobStatus: z.enum(["Open", "Closed", "Filled"]),
  }),
  params: z.object({ jobId: z.uuid() }),
});

export { createJobSchema, applyToJobSchema, updateJobStatusSchema };
