<template>
    <div class="app-container">
        <div class="app-wrapper">
            <div>
                <Header />
                <TopLevelProjects />
            </div>
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
    top: 0;
    left: 0;
    padding: 5px;
    font-size: xx-large;
    align-items: center;
    align-content: center;
}

.app-wrapper {
    width: 90%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    background-color: red;
}
</style>
