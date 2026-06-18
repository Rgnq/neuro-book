import {z} from "zod";

export type LowCodeJsonValue =
    | string
    | number
    | boolean
    | null
    | LowCodeJsonValue[]
    | {[key: string]: LowCodeJsonValue};

export type LowCodeJsonObject = {[key: string]: LowCodeJsonValue};

const LowCodeJsonValueSchema: z.ZodType<LowCodeJsonValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(LowCodeJsonValueSchema),
    z.record(z.string(), LowCodeJsonValueSchema),
]));

export const LowCodeJsonObjectSchema: z.ZodType<LowCodeJsonObject> = z.record(z.string(), LowCodeJsonValueSchema);

export const LowCodeFieldComponentDtoSchema = z.enum([
    "text",
    "textarea",
    "number",
    "switch",
    "select",
    "combobox",
    "radio",
    "checkbox",
]);

export const LowCodeFieldOptionValueDtoSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
]);

export const LowCodeFieldOptionDtoSchema = z.object({
    value: LowCodeFieldOptionValueDtoSchema,
    label: z.string().trim().min(1),
    description: z.string().trim().optional(),
    disabled: z.boolean().optional(),
});

export const LowCodeFieldDtoSchema = z.object({
    path: z.string().trim().min(1),
    component: LowCodeFieldComponentDtoSchema,
    label: z.string().trim().min(1),
    description: z.string().trim().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().default(false),
    defaultValue: LowCodeJsonValueSchema.optional(),
    options: z.array(LowCodeFieldOptionDtoSchema).default([]),
    rows: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    integer: z.boolean().optional(),
});

export const LowCodeFormDtoSchema = z.object({
    defaults: LowCodeJsonObjectSchema.default({}),
    fields: z.array(LowCodeFieldDtoSchema).default([]),
});

export const LowCodeFormIssueDtoSchema = z.object({
    path: z.string().trim().optional(),
    severity: z.enum(["error", "warning"]).default("error"),
    code: z.string().trim().optional(),
    message: z.string().trim().min(1),
});

export type LowCodeFieldComponentDto = z.infer<typeof LowCodeFieldComponentDtoSchema>;
export type LowCodeFieldOptionValueDto = z.infer<typeof LowCodeFieldOptionValueDtoSchema>;
export type LowCodeFieldOptionDto = z.infer<typeof LowCodeFieldOptionDtoSchema>;
export type LowCodeFieldDto = z.infer<typeof LowCodeFieldDtoSchema>;
export type LowCodeFormDto = z.infer<typeof LowCodeFormDtoSchema>;
export type LowCodeFormIssueDto = z.infer<typeof LowCodeFormIssueDtoSchema>;
