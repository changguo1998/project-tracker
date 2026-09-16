<template>
    <div class="app-container">
        <div class="app-wrapper">
            <Header :loading="loading" @sync="sync" />
            <v-progress-linear v-if="loading" indeterminate color="primary" />
            <TopLevelProjects />
            <ProjectTimeTable />
        </div>
        <v-snackbar v-model="errorState.show" color="error" location="bottom">
            {{ errorState.message }}
        </v-snackbar>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Header from "@/components/Header.vue";
import TopLevelProjects from "@/components/TopLevelProjects.vue";
import ProjectTimeTable from "@/components/ProjectTimeTable.vue";
import { useProjectStore } from "@/stores/projectStore";
import { useLogStore } from "@/stores/logStore";
import { useShownProjectStore } from "@/stores/shownProjectStore";
import { errorState, reportError } from "@/utils/errorBus";

const projectStore = useProjectStore();
const logStore = useLogStore();
const shownProjectStore = useShownProjectStore();
const loading = ref(true);

/** 启动载入 / Sync 共用：全量拉取后重建显示态 */
const sync = async () => {
    loading.value = true;
    try {
        await Promise.all([projectStore.loadState(), logStore.loadState()]);
        shownProjectStore.update();
    } catch (err) {
        reportError(err);
    } finally {
        loading.value = false;
    }
};

onMounted(sync);
</script>

<style>
.app-container {
    display: block;
    position: relative;
    width: 100%;
    height: 100vh;
    top: 0;
    left: 0;
    padding: 5px;
}

.app-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
}
</style>
