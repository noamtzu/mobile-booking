import { serviceInputSchema } from '@booking/shared';
import { z } from 'zod';

/** Form fields are strings; the schema turns them into the API's ServiceInput. */
export const serviceFormSchema = z.object({
  name: serviceInputSchema.shape.name,
  description: z.string().trim().max(500),
  duration: z
    .string()
    .regex(/^\d+$/, 'Whole minutes, e.g. 45')
    .transform(Number)
    .pipe(serviceInputSchema.shape.durationMinutes),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'A price like 45 or 45.50')
    .transform((v) => Math.round(Number.parseFloat(v) * 100)),
});
export type ServiceFormIn = z.input<typeof serviceFormSchema>;
export type ServiceFormOut = z.output<typeof serviceFormSchema>;
