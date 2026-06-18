import {describe, expect, it} from "vitest";
import {Type} from "typebox";
import {
    defineLowCodeForm,
    parseLowCodeFormValue,
    resolveLowCodeForm,
    validateLowCodeFormValue,
} from "nbook/server/low-code-form";

describe("low-code form", () => {
    it("合并 defaults 并用 TypeBox 校验值", () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                title: Type.String(),
                count: Type.Number(),
            }, {additionalProperties: false}),
            defaults: {
                title: "默认",
                count: 1,
            },
            fields: [],
        });

        expect(parseLowCodeFormValue(form, {title: "覆盖"})).toEqual({
            title: "覆盖",
            count: 1,
        });
    });

    it("把 TypeBox 校验失败转换为 issue", async () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                count: Type.Number(),
            }, {additionalProperties: false}),
            defaults: {
                count: 1,
            },
            fields: [],
        });

        const result = await validateLowCodeFormValue(form, {count: "bad"}, context());

        expect(result.issues).toEqual([
            expect.objectContaining({
                severity: "error",
                code: "type",
            }),
        ]);
    });

    it("解析动态 options 生成 DTO", async () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                mode: Type.String(),
            }),
            defaults: {
                mode: "a",
            },
            fields: [{
                path: "mode",
                component: "combobox",
                label: "模式",
                async options() {
                    return [
                        {value: "a", label: "A"},
                        {value: "b", label: "B"},
                    ];
                },
            }],
        });

        const dto = await resolveLowCodeForm(form, context());

        expect(dto.fields[0]?.options).toEqual([
            {value: "a", label: "A"},
            {value: "b", label: "B"},
        ]);
    });

    it("执行自定义校验", async () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                title: Type.String(),
            }),
            defaults: {
                title: "",
            },
            fields: [],
            validate(value) {
                return value.title.includes("禁用")
                    ? [{path: "title", severity: "error", message: "标题不能包含禁用词。"}]
                    : [];
            },
        });

        const result = await validateLowCodeFormValue(form, {title: "禁用"}, context());

        expect(result.issues).toEqual([
            {path: "title", severity: "error", message: "标题不能包含禁用词。"},
        ]);
    });

    it("combobox 不接受 options 外的值", async () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                preset: Type.String(),
            }),
            defaults: {
                preset: "a",
            },
            fields: [{
                path: "preset",
                component: "combobox",
                label: "预设",
                options: [{value: "a", label: "A"}],
            }],
        });

        const result = await validateLowCodeFormValue(form, {preset: "x"}, context());

        expect(result.issues).toEqual([
            expect.objectContaining({
                path: "preset",
                code: "option",
            }),
        ]);
    });

    it("checkbox 不接受 options 外的数组项", async () => {
        const form = defineLowCodeForm({
            schema: Type.Object({
                tags: Type.Array(Type.String()),
            }),
            defaults: {
                tags: [],
            },
            fields: [{
                path: "tags",
                component: "checkbox",
                label: "标签",
                options: [{value: "a", label: "A"}],
            }],
        });

        const result = await validateLowCodeFormValue(form, {tags: ["a", "x"]}, context());

        expect(result.issues).toEqual([
            expect.objectContaining({
                path: "tags",
                code: "option",
            }),
        ]);
    });

    it("第一版只允许顶层字段 path", () => {
        expect(() => defineLowCodeForm({
            schema: Type.Object({
                nested: Type.Object({
                    title: Type.String(),
                }),
            }),
            defaults: {
                nested: {
                    title: "默认",
                },
            },
            fields: [{
                path: "nested.title",
                component: "text",
                label: "标题",
            }],
        })).toThrow("顶层字段");
    });

    it("checkbox option value 只允许 string 或 number", async () => {
        expect(() => defineLowCodeForm({
            schema: Type.Object({
                flags: Type.Array(Type.Boolean()),
            }),
            defaults: {
                flags: [],
            },
            fields: [{
                path: "flags",
                component: "checkbox",
                label: "标记",
                options: [{value: true, label: "启用"}],
            }],
        })).toThrow("string 或 number");

        const form = defineLowCodeForm({
            schema: Type.Object({
                flags: Type.Array(Type.String()),
            }),
            defaults: {
                flags: [],
            },
            fields: [{
                path: "flags",
                component: "checkbox",
                label: "标记",
                async options() {
                    return [{value: true, label: "启用"}];
                },
            }],
        });

        await expect(resolveLowCodeForm(form, context())).rejects.toThrow("string 或 number");
    });
});

/**
 * 创建测试用低代码 form 上下文。
 */
function context() {
    return {
        profileKey: "writer",
        scope: "global" as const,
        workspaceRoot: "workspace",
    };
}
