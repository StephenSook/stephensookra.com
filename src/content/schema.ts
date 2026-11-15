import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd");
const isoMonth = z.string().regex(/^\d{4}-\d{2}$/, "expected yyyy-mm");

/** Where a fact came from. Every placed result and every award carries one. */
export const sourceSchema = z.object({
  label: z.string().min(3),
  url: httpsUrl.optional(),
});

export const resultSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("placed"),
    /** Prize text in the resume's own wording, plus verified extras only. */
    prize: z.string().min(2),
    event: z.string().min(2),
    source: sourceSchema,
  }),
  z.object({
    state: z.literal("waiting"),
    event: z.string().min(2),
    resultsDate: isoDate.optional(),
    source: sourceSchema,
  }),
  z.object({
    state: z.literal("role"),
    role: z.string().min(2),
    org: z.string().min(2),
    start: isoMonth,
    end: isoMonth.optional(),
  }),
]);

export const linkSchema = z
  .object({
    kind: z.enum(["try", "repo", "film", "devpost"]),
    url: httpsUrl,
    label: z.string().min(2),
    /** Required for Try links: a GET past the home page whose body proves the core works. */
    check: z.object({ url: httpsUrl, expectText: z.string().min(3) }).optional(),
  })
  .refine((l) => l.kind !== "try" || l.check !== undefined, {
    message: "a Try link needs a core-path check",
  });

export const caseStudySchema = z.object({
  evidence: z.string().min(10),
  /** Omitted until Stephen supplies it when the sources do not say who built what. */
  myPart: z.string().min(10).optional(),
  howItWorks: z.string().min(10),
  engineering: z.string().min(10),
  /** Omitted when no sourced measurement exists; never filled with a guess. */
  measured: z
    .object({ value: z.string().min(1), label: z.string().min(3), source: sourceSchema })
    .optional(),
  /** Omitted when the sources record no failure. */
  whatBroke: z.string().min(10).optional(),
  sources: z.array(sourceSchema).min(1),
});

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(2),
  line: z.string().min(10),
  platform: z.string().min(2),
  group: z.enum(["xr", "software", "bench", "archive"]),
  order: z.number().int().positive(),
  result: resultSchema,
  solo: z.boolean().optional(),
  /** "owner/name" of a PUBLIC repo; private repos are never listed. */
  repo: z
    .string()
    .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/)
    .optional(),
  poster: z
    .object({
      /** Path under /public, e.g. "/posters/case-light.webp". */
      src: z.string().regex(/^\/posters\/[a-z0-9-]+\.webp$/),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      alt: z.string().min(10),
    })
    .optional(),
  links: z.array(linkSchema),
  disclosure: z.string().min(10).optional(),
  caseStudy: caseStudySchema.optional(),
});

export const awardSchema = z.object({
  /** Omitted when the resume names no project for the award. */
  project: z.string().min(2).optional(),
  event: z.string().min(2),
  prize: z.string().min(2),
  source: sourceSchema,
});

export type Source = z.infer<typeof sourceSchema>;
export type Result = z.infer<typeof resultSchema>;
export type ProjectLink = z.infer<typeof linkSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Project = z.infer<typeof projectSchema>;
export type Award = z.infer<typeof awardSchema>;
