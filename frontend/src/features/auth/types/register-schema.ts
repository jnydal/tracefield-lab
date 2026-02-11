import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Feltet kan ikke være tomt')
    .email('Ugyldig e-postadresse'),
  password: z.string().min(1, 'Feltet kan ikke være tomt'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
