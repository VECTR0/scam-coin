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

  MIN_TIMESTAMP_DIFFERENCE_BETWEEN_BLOCKS: z
    .number({
      description: 'Thime difference between consecutive blocks, in seconds.',
    })
    .min(1, {
      message: 'The minimum timestamp difference must be at least 1 second.',
    })
    .max(3600, {
      message:
        'The maximum timestamp difference is set to 3600 seconds (1 hour).',
    })
    .default(60),
});

export const env = EnvSchema.parse(process.env);
