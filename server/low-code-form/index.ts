import type {Static, TSchema} from "typebox";
import {Value} from "typebox/value";
import type {
    LowCodeFieldComponentDto,
    LowCodeFieldDto,
    LowCodeFieldOptionDto,
    LowCodeFieldOptionValueDto,
    LowCodeFormDto,
    LowCodeFormIssueDto,
    LowCodeJsonObject,
    LowCodeJsonValue,
} from "nbook/shared/dto/low-code-form.dto";

export type LowCodeFormResolveContext = {
    profileKey: string;
    scope: "global" | "project";
    workspaceRoot?: string;
    projectPath?: string;
};

export type LowCodeFieldOptionsProvider = (
    ctx: LowCodeFormResolveContext,
) => readonly LowCodeFieldOptionDto[] | Promise<readonly LowCodeFieldOptionDto[]>;

export type LowCodeFieldDefinition = {
    path: string;
    component: LowCodeFieldComponentDto;
    label: string;
    description?: string;
    placeholder?: string;
    required?: boolean;
    defaultValue?: LowCodeJsonValue;
    options?: readonly LowCodeFieldOptionDto[] | LowCodeFieldOptionsProvider;
    rows?: number;
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
};

export type LowCodeFormDefinition<TSettingsSchema extends TSchema = TSchema> = {
    schema: TSettingsSchema;
    defaults: Static<TSettingsSchema>;
    fields: readonly LowCodeFieldDefinition[];
    validate?: (
        value: Static<TSettingsSchema>,
        ctx: LowCodeFormResolveContext,
    ) => readonly LowCodeFormIssueDto[] | Promise<readonly LowCodeFormIssueDto[]>;
};

export type LowCodeFormValidationResult<TValue> = {
    value: TValue;
    issues: LowCodeFormIssueDto[];
};

/**
 * 表示低代码表单校验失败，同时保留字段级 issues。
 */
export class LowCodeFormValidationError extends Error {
    constructor(
        message: string,
        readonly issues: LowCodeFormIssueDto[],
    ) {
        super(message);
        this.name = "LowCodeFormValidationError";
    }
}

/**
 * 定义低代码表单，并保留 TypeBox schema 推导能力。
 */
export function defineLowCodeForm<const TSettingsSchema extends TSchema>(
    definition: LowCodeFormDefinition<TSettingsSchema>,
): LowCodeFormDefinition<TSettingsSchema> {
    assertLowCodeFormDefinition(definition);
    return definition;
}

/**
 * 执行动态 options，生成前端可渲染的低代码表单 DTO。
 */
export async function resolveLowCodeForm<TSettingsSchema extends TSchema>(
    form: LowCodeFormDefinition<TSettingsSchema>,
    ctx: LowCodeFormResolveContext,
): Promise<LowCodeFormDto> {
    const defaults = cloneJsonObject(form.defaults as LowCodeJsonObject);
    return {
        defaults,
        fields: await Promise.all(form.fields.map((field) => resolveField(field, ctx, defaults))),
    };
}

/**
 * 合并 defaults 与存储 patch，并返回已通过 TypeBox 校验的值。
 */
export function parseLowCodeFormValue<TSettingsSchema extends TSchema>(
    form: LowCodeFormDefinition<TSettingsSchema>,
    rawValue: LowCodeJsonObject | undefined,
): Static<TSettingsSchema> {
    const merged = mergeSettings(form.defaults as LowCodeJsonObject, rawValue);
    const schemaIssues = typeboxIssues(form.schema, merged);
    if (schemaIssues.length > 0) {
        throw new LowCodeFormValidationError("低代码表单值校验失败", schemaIssues);
    }
    return Value.Parse(form.schema, merged) as Static<TSettingsSchema>;
}

/**
 * 校验低代码表单值，并执行 options 与自定义校验。
 */
export async function validateLowCodeFormValue<TSettingsSchema extends TSchema>(
    form: LowCodeFormDefinition<TSettingsSchema>,
    rawValue: LowCodeJsonObject | undefined,
    ctx: LowCodeFormResolveContext,
): Promise<LowCodeFormValidationResult<Static<TSettingsSchema>>> {
    let value: Static<TSettingsSchema>;
    let issues: LowCodeFormIssueDto[] = [];
    try {
        value = parseLowCodeFormValue(form, rawValue);
    } catch (error) {
        if (error instanceof LowCodeFormValidationError) {
            return {
                value: mergeSettings(form.defaults as LowCodeJsonObject, rawValue) as Static<TSettingsSchema>,
                issues: error.issues,
            };
        }
        throw error;
    }

    const defaults = cloneJsonObject(form.defaults as LowCodeJsonObject);
    const resolvedFields = await Promise.all(form.fields.map((field) => resolveField(field, ctx, defaults)));
    issues = issues.concat(optionIssues(value as LowCodeJsonObject, resolvedFields));
    if (form.validate) {
        issues = issues.concat([...(await form.validate(value, ctx))]);
    }
    return {value, issues};
}

/**
 * 合并 profile 默认值与用户 patch。
 */
export function mergeLowCodeFormValue(
    defaults: LowCodeJsonObject,
    patch: LowCodeJsonObject | undefined,
): LowCodeJsonObject {
    return mergeSettings(defaults, patch);
}

/**
 * 解析单个字段的 options。
 */
async function resolveField(
    field: LowCodeFieldDefinition,
    ctx: LowCodeFormResolveContext,
    defaults: LowCodeJsonObject,
): Promise<LowCodeFieldDto> {
    const options = await resolveFieldOptions(field.options, ctx);
    const normalizedOptions = normalizeOptions(options);
    assertFieldOptions(field, normalizedOptions);
    const defaultValue = field.defaultValue ?? readPath(defaults, field.path);
    return {
        ...field,
        required: field.required ?? false,
        ...(defaultValue !== undefined ? {defaultValue} : {}),
        options: normalizedOptions,
    };
}

/**
 * 校验低代码 form 定义期合同。第一版只支持顶层字段，避免 patch 合并语义变成隐式 deep merge。
 */
function assertLowCodeFormDefinition(form: LowCodeFormDefinition): void {
    const paths = new Set<string>();
    for (const field of form.fields) {
        assertFieldPath(field.path);
        if (paths.has(field.path)) {
            throw new Error(`低代码表单字段 path 重复：${field.path}`);
        }
        paths.add(field.path);
        if (Array.isArray(field.options)) {
            assertFieldOptions(field, field.options);
        }
    }
}

/**
 * 第一版 field.path 仅表示 settings 对象的顶层 key。
 */
function assertFieldPath(path: string): void {
    if (!/^[A-Za-z0-9_-]+$/u.test(path)) {
        throw new Error(`低代码表单字段 path 第一版只支持顶层字段：${path}`);
    }
}

/**
 * 校验组件自己的 option 约束。
 */
function assertFieldOptions(field: Pick<LowCodeFieldDefinition, "component" | "path">, options: readonly LowCodeFieldOptionDto[]): void {
    if (field.component !== "checkbox") {
        return;
    }
    for (const option of options) {
        if (typeof option.value !== "string" && typeof option.value !== "number") {
            throw new Error(`低代码 checkbox 字段 ${field.path} 的 option value 只支持 string 或 number。`);
        }
    }
}

/**
 * 调用字段 options provider。
 */
async function resolveFieldOptions(
    options: LowCodeFieldDefinition["options"],
    ctx: LowCodeFormResolveContext,
): Promise<readonly LowCodeFieldOptionDto[]> {
    if (!options) {
        return [];
    }
    if (typeof options === "function") {
        return options(ctx);
    }
    return options;
}

/**
 * 规范化 options，保证前端拿到稳定数组。
 */
function normalizeOptions(options: readonly LowCodeFieldOptionDto[]): LowCodeFieldOptionDto[] {
    return options.map((option) => ({
        value: option.value,
        label: option.label,
        ...(option.description ? {description: option.description} : {}),
        ...(option.disabled ? {disabled: option.disabled} : {}),
    }));
}

/**
 * 用 TypeBox 生成字段级 issue。
 */
function typeboxIssues(schema: TSchema, value: LowCodeJsonValue): LowCodeFormIssueDto[] {
    if (Value.Check(schema, value)) {
        return [];
    }
    return [...Value.Errors(schema, value)].map((issue) => ({
        path: pointerToPath(readIssuePath(issue)),
        severity: "error",
        code: "type",
        message: issue.message,
    }));
}

/**
 * TypeBox error 联合里不是所有分支都公开 path 字段，运行时按可选字段读取。
 */
function readIssuePath(issue: object): string {
    return "path" in issue && typeof issue.path === "string" ? issue.path : "";
}

/**
 * 校验选择类字段的值必须来自 options。
 */
function optionIssues(value: LowCodeJsonObject, fields: readonly LowCodeFieldDto[]): LowCodeFormIssueDto[] {
    const issues: LowCodeFormIssueDto[] = [];
    for (const field of fields) {
        if (!requiresOptionsValidation(field.component) || field.options.length === 0) {
            continue;
        }
        const current = readPath(value, field.path);
        if (current === undefined || current === null || current === "") {
            continue;
        }
        if (field.component === "checkbox") {
            issues.push(...checkboxOptionIssues(field, current));
            continue;
        }
        if (!isOptionValue(current) || !hasOptionValue(field.options, current)) {
            issues.push({
                path: field.path,
                severity: "error",
                code: "option",
                message: `字段 ${field.label} 的值不在可用选项中。`,
            });
        }
    }
    return issues;
}

/**
 * 判断组件是否需要 options 校验。
 */
function requiresOptionsValidation(component: LowCodeFieldComponentDto): boolean {
    return component === "select"
        || component === "combobox"
        || component === "radio"
        || component === "checkbox";
}

/**
 * 校验 checkbox 数组值。
 */
function checkboxOptionIssues(field: LowCodeFieldDto, value: LowCodeJsonValue): LowCodeFormIssueDto[] {
    if (!Array.isArray(value)) {
        return [{
            path: field.path,
            severity: "error",
            code: "option",
            message: `字段 ${field.label} 必须是数组。`,
        }];
    }
    return value.flatMap((item) => {
        if (!isCheckboxOptionValue(item) || !hasOptionValue(field.options, item)) {
            return [{
                path: field.path,
                severity: "error" as const,
                code: "option",
                message: `字段 ${field.label} 包含不可用选项。`,
            }];
        }
        return [];
    });
}

/**
 * 判断值是否能作为单选 option value。
 */
function isOptionValue(value: LowCodeJsonValue): value is LowCodeFieldOptionValueDto {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * 判断值是否能作为 checkbox option value。
 */
function isCheckboxOptionValue(value: LowCodeJsonValue): value is string | number {
    return typeof value === "string" || typeof value === "number";
}

/**
 * 判断 option 列表中是否包含指定值。
 */
function hasOptionValue(options: readonly LowCodeFieldOptionDto[], value: LowCodeFieldOptionValueDto): boolean {
    return options.some((option) => option.value === value);
}

/**
 * 用点路径读取对象字段。
 */
function readPath(value: LowCodeJsonObject, path: string): LowCodeJsonValue | undefined {
    const segments = path.split(".").filter(Boolean);
    let current: LowCodeJsonValue | undefined = value;
    for (const segment of segments) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}

/**
 * 合并 settings patch。
 */
function mergeSettings(defaults: LowCodeJsonObject, patch: LowCodeJsonObject | undefined): LowCodeJsonObject {
    return {
        ...cloneJsonObject(defaults),
        ...(patch ? cloneJsonObject(patch) : {}),
    };
}

/**
 * 克隆 JSON 对象，避免调用方共享引用。
 */
function cloneJsonObject(value: LowCodeJsonObject): LowCodeJsonObject {
    return JSON.parse(JSON.stringify(value)) as LowCodeJsonObject;
}

/**
 * 将 JSON pointer 转成低代码字段路径。
 */
function pointerToPath(pointer: string): string {
    return pointer
        .replace(/^\//u, "")
        .split("/")
        .filter(Boolean)
        .map((segment) => segment.replace(/~1/gu, "/").replace(/~0/gu, "~"))
        .join(".");
}
