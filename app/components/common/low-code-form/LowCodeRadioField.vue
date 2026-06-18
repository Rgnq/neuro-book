<script setup lang="ts">
import type {LowCodeFieldDto, LowCodeJsonValue} from "nbook/shared/dto/low-code-form.dto";

const props = withDefaults(defineProps<{
    field: LowCodeFieldDto;
    modelValue?: LowCodeJsonValue;
    disabled?: boolean;
}>(), {
    modelValue: null,
    disabled: false,
});
const emit = defineEmits<{
    (e: "update:modelValue", value: LowCodeJsonValue): void;
}>();
</script>

<template>
    <div class="inline-flex max-w-full flex-wrap rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] p-0.5">
        <button
            v-for="option in props.field.options"
            :key="`${typeof option.value}:${String(option.value)}`"
            type="button"
            class="inline-flex h-7 min-w-0 items-center justify-center rounded px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="option.value === props.modelValue ? 'bg-[var(--bg-panel)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'"
            :disabled="props.disabled || option.disabled"
            :aria-pressed="option.value === props.modelValue"
            @click="emit('update:modelValue', option.value)"
        >
            <span class="truncate">{{ option.label }}</span>
        </button>
    </div>
</template>
