import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Feltet kan ikke være tomt'),
  password: z.string().min(1, 'Feltet kan ikke være tomt'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

