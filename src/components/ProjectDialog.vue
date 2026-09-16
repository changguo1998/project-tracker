<template>
    <v-dialog
        :model-value="open"
        width="520"
        @update:model-value="(v) => { if (!v) emit('close'); }"
    >
        <v-card>
            <v-card-title>{{ mode === "create" ? "新增项目" : "重命名项目" }}</v-card-title>
            <v-card-text>
                <v-text-field v-model="name" label="项目名称" autofocus density="compact" />
                <v-select
                    v-if="mode === 'create'"
                    v-model="parentID"
                    :items="parentOptions"
                    label="父级项目（留空为顶层）"
                    clearable
                    density="compact"
                />
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="emit('close')">取消</v-btn>
                <v-btn color="primary" variant="tonal" :disabled="!name.trim()" @click="save">
                    保存
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Project } from "@/types/main";
import { useProjectStore } from "@/stores/projectStore";

const props = defineProps<{
    open: boolean;
    mode: "create" | "rename";
    project?: Project;
}>();

const emit = defineEmits<{
    (e: "save", payload: { name: string; parentID: string | null }): void;
    (e: "close"): void;
}>();

const projectStore = useProjectStore();
const name = ref("");
const parentID = ref<string | null>(null);

watch(
    () => props.open,
    (v) => {
        if (!v) return;
        name.value = props.mode === "rename" ? (props.project?.name ?? "") : "";
        parentID.value = props.mode === "create" ? null : (props.project?.parentID ?? null);
    },
);

const parentOptions = computed(() =>
    Array.from(projectStore.projectMap.values())
        .filter((p) => p.parentID === null && p.id !== props.project?.id)
        .map((p) => ({ title: p.name, value: p.id })),
);

const save = () => {
    const trimmed = name.value.trim();
    if (!trimmed) return;
    emit("save", { name: trimmed, parentID: parentID.value ?? null });
};
</script>
