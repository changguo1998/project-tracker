<template>
    <div class="app-container">
        <div class="app-wapper">
            <Header />
            <TopLevelProjects />
            <ProjectTimeTable />
        </div>
    </div>
</template>

<script setup lang="ts">
import Header from "@/components/Header.vue";
import TopLevelProjects from "@/components/TopLevelProjects.vue";
import ProjectTimeTable from "@/components/ProjectTimeTable.vue";
</script>

<style>
.app-container {
    display: block;
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    padding: 20px;
    font-size: xx-large;
    align-items: center;
}

.app-wapper {
    width: 90%;
    height: 90%;
    flex-direction: column;
    justify-content: center;
    position: relative;
}
</style>
