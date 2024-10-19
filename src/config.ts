import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      description: 'This gets updated depending on your environment',
    })
    .default('development'),

  PORT: z.coerce
    .number({
      description:
        '.env files convert numbers to strings, therefoore we have to enforce them to be numbers',
    })
    .positive()
    .max(65536, `options.port should be >= 0 and < 65536`)
    .default(3000),

  SECRET_IV: z
    .string({
      description: 'Secret IV for AES encryption',
      required_error: 'Secret IV is required for AES encryption',
    })
    .min(32)
    .max(256),
});

export const env = EnvSchema.parse(process.env);
