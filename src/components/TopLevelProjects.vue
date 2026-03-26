<template>
    <div class="level1-list-container">
        <v-sheet>
            <v-chip-group>
                <v-chip v-for="p in projectList">{{ p }}</v-chip>
            </v-chip-group>
        </v-sheet>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Project } from "@/types/main";

const projectList = ref(["Project 1", "Project 2"]);
</script>
<style>
.level1-list-container {
    width: 100%;
    background-color: mediumseagreen;
    padding: 10px;
    border-radius: 10px;
    margin: 10px;
}

.level1-list-container v-chip {
    margin: 10px;
    padding: 5px;
    border-radius: 5px;
    font-size: normal;
    background-color: darkgreen;
    color: black;
}
</style>
