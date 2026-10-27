import { z } from "zod";
import { officeTypes } from "./ballot";
const uuid = z.uuid();
export const districtBoundarySchema = z
  .object({
    id: uuid,
    districtId: uuid,
    version: z.number().int().positive(),
    validFrom: z.iso.date(),
    validTo: z.iso.date().nullable(),
    coordinateReference: z.literal("EPSG:4326"),
    geometryGeojson: z.object({
      type: z.enum(["Polygon", "MultiPolygon"]),
      coordinates: z.array(z.unknown()).min(1),
    }),
    provenanceId: uuid,
  })
  .refine(
    (v) => v.validTo === null || v.validTo > v.validFrom,
    "Boundary validity must end after it starts.",
  );
export const jurisdictionOverlapSchema = z
  .object({
    jurisdictionId: uuid,
    overlappingJurisdictionId: uuid,
    provenanceId: uuid,
  })
  .refine(
    (v) => v.jurisdictionId !== v.overlappingJurisdictionId,
    "A jurisdiction cannot overlap itself in this relation.",
  );
export const questionSchema = z.object({
  id: uuid,
  stableKey: z.string().min(1),
  provenanceId: uuid,
});
export const questionJurisdictionSchema = z.object({
  questionId: uuid,
  jurisdictionId: uuid,
});
export const questionOfficeTypeSchema = z.object({
  questionId: uuid,
  officeType: z.enum(officeTypes).exclude(["judicial", "proposition"]),
});
export const questionResponseOptionSchema = z.object({
  questionVersionId: uuid,
  value: z.number().int().min(1).max(5),
  label: z.string().min(1),
});
export const importanceResponseOptionSchema = z.object({
  scoringMethodVersionId: uuid,
  value: z.number().int().min(1).max(5),
  label: z.string().min(1),
  weight: z.number().positive(),
});
export const userSessionSchema = z.object({
  id: uuid,
  userId: uuid,
  scoringMethodVersionId: uuid,
  consentedAt: z.iso.datetime(),
});
export type DistrictBoundary = z.infer<typeof districtBoundarySchema>;
export type JurisdictionOverlap = z.infer<typeof jurisdictionOverlapSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionJurisdiction = z.infer<typeof questionJurisdictionSchema>;
export type QuestionOfficeType = z.infer<typeof questionOfficeTypeSchema>;
export type QuestionResponseOption = z.infer<
  typeof questionResponseOptionSchema
>;
export type ImportanceResponseOption = z.infer<
  typeof importanceResponseOptionSchema
>;
export type UserSession = z.infer<typeof userSessionSchema>;
