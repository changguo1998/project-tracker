<template>
    <div class="level1-list-container">
        <v-sheet class="d-flex align-center pa-2">
            <v-chip-group>
                <v-chip
                    v-for="p in topLevelProjects"
                    :key="p.id"
                    @click="shownProjectStore.switchShownFlag(p.id)"
                    :variant="shownProjectStore.isShown(p.id) ? 'elevated' : 'outlined'"
                >
                    {{ p.name }}
                    <v-menu>
                        <template #activator="{ props }">
                            <v-icon size="small" v-bind="props" @click.stop>mdi-dots-horizontal</v-icon>
                        </template>
                        <v-list density="compact">
                            <v-list-item @click="openRename(p)">
                                <v-list-item-title>改名</v-list-item-title>
                            </v-list-item>
                            <v-list-item @click="removeProject(p)">
                                <v-list-item-title>删除</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-chip>
            </v-chip-group>
            <v-spacer />
            <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
                新增项目
            </v-btn>
        </v-sheet>

        <ProjectDialog
            :open="dialogOpen"
            :mode="dialogMode"
            :project="dialogProject"
            @save="onSave"
            @close="dialogOpen = false"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Project } from "@/types/main";
import { useProjectStore } from "@/stores/projectStore";
import { useShownProjectStore } from "@/stores/shownProjectStore";
import { reportError } from "@/utils/errorBus";
import ProjectDialog from "./ProjectDialog.vue";

const projectStore = useProjectStore();
const shownProjectStore = useShownProjectStore();

const topLevelProjects = computed(() => projectStore.getLevel1());

const dialogOpen = ref(false);
const dialogMode = ref<"create" | "rename">("create");
const dialogProject = ref<Project | undefined>(undefined);

const openCreate = () => {
    dialogMode.value = "create";
    dialogProject.value = undefined;
    dialogOpen.value = true;
};

const openRename = (p: Project) => {
    dialogMode.value = "rename";
    dialogProject.value = p;
    dialogOpen.value = true;
};

const onSave = async (payload: { name: string; parentID: string | null }) => {
    try {
        if (dialogMode.value === "create") {
            await projectStore.addProject(payload.name, payload.parentID);
        } else if (dialogProject.value) {
            await projectStore.renameProject(dialogProject.value.id, payload.name);
        }
        shownProjectStore.update();
        dialogOpen.value = false;
    } catch (err) {
        reportError(err);
    }
};

const removeProject = async (p: Project) => {
    const ok = window.confirm(
        `删除项目「${p.name}」将同时删除其全部子项目与关联日志，确认删除？`,
    );
    if (!ok) return;
    try {
        await projectStore.rmProject(p.id);
        shownProjectStore.update();
    } catch (err) {
        reportError(err);
    }
};
</script>

<style>
.level1-list-container {
    width: 100%;
    height: auto;
    padding: 10px;
    border-radius: 10px;
    margin: 10px;
}

.level1-list-container .v-chip {
    margin: 4px;
    padding: 4px;
    border-radius: 5px;
}
</style>
