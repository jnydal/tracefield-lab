import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'This field is required')
    .email('Invalid email address'),
  password: z.string().min(1, 'This field is required'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
