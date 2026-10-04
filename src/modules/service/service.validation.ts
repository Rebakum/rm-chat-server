import { z } from "zod";

const createServiceSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    price: z.number().positive(),
    deliveryTime: z.string().optional(),
    engLevel: z.string().optional(),
    category: z.string().optional(),
    featuredImage: z.string().optional(),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  }),
});

const updateServiceSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    price: z.number().positive().optional(),
    deliveryTime: z.string().optional(),
    engLevel: z.string().optional(),
    category: z.string().optional(),
    featuredImage: z.string().optional(),
  }),
  params: z.object({ id: z.uuid() }),
});

export { createServiceSchema, updateServiceSchema };
