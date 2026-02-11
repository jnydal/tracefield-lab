import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Feltet kan ikke være tomt')
    .email('Ugyldig e-postadresse'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
