<template>
    <v-dialog
        :model-value="open"
        width="560"
        @update:model-value="(v) => { if (!v) emit('close'); }"
    >
        <v-card>
            <v-card-title>{{ mode === "create" ? "记录日志" : "编辑日志" }}</v-card-title>
            <v-card-text>
                <v-select v-model="status" :items="statusOptions" label="状态" density="compact" />
                <v-text-field v-model="summary" label="摘要" density="compact" />
                <v-textarea
                    v-model="detail"
                    label="详情"
                    density="compact"
                    auto-grow
                    rows="3"
                />
            </v-card-text>
            <v-card-actions>
                <v-btn v-if="mode === 'edit'" color="error" variant="text" @click="emit('delete')">
                    删除
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="emit('close')">取消</v-btn>
                <v-btn color="primary" variant="tonal" :disabled="!summary.trim()" @click="save">
                    保存
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { LogRec, TaskStatus } from "@/types/main";

const props = defineProps<{
    open: boolean;
    mode: "create" | "edit";
    log?: LogRec;
    projectID: string;
    date: string;
}>();

const emit = defineEmits<{
    (e: "save", payload: { projectID: string; date: string; status: TaskStatus; summary: string; detail: string }): void;
    (e: "delete"): void;
    (e: "close"): void;
}>();

const statusOptions: { title: string; value: TaskStatus }[] = [
    { title: "计划", value: "plan" },
    { title: "进行中", value: "progress" },
    { title: "失败", value: "failed" },
    { title: "完成", value: "done" },
    { title: "延期", value: "delay" },
];

const status = ref<TaskStatus>("plan");
const summary = ref("");
const detail = ref("");

watch(
    () => props.open,
    (v) => {
        if (!v) return;
        status.value = props.log?.status ?? "plan";
        summary.value = props.log?.summary ?? "";
        detail.value = props.log?.detail ?? "";
    },
);

const save = () => {
    emit("save", {
        projectID: props.projectID,
        date: props.date,
        status: status.value,
        summary: summary.value.trim(),
        detail: detail.value,
    });
};
</script>
